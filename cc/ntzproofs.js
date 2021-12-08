'use strict'

const Debug = require('debug');
const logdebug = Debug('net:nspv');
const logerror = Debug('net:nspv:error');

const bcrypto = require('../src/crypto');
const fastMerkleRoot = require('merkle-lib/fastRoot');
const bmp = require('bitcoin-merkle-proof');
const ccutils = require('./ccutils');
const ntzpubkeys = require('./ntzpubkeys');
//const TransactionBuilder = require('../src/transaction_builder');
const Transaction = require('../src/transaction');
const kmdblockindex = require('../src/kmdblockindex');
const coins = require('../src/coins');
const { NSPV_VERSION, NSPV_VERSION_5 } = require('../net/kmdtypes');

exports.nspvTxProof = nspvTxProof;
function nspvTxProof(peers, txidhex, vout, height)
{
  return new Promise((resolve, reject) => {
    peers.nspvTxProof(txidhex, vout, height, {}, (err, res, peer) => {
    //console.log('err=', err, 'res=', res);
    if (!err) 
        resolve(res);
    else
        reject(err);
    });
  });
}

exports.nspvNtzs = nspvNtzs;
function nspvNtzs(peers, height)
{
  return new Promise((resolve, reject) => {
      peers.nspvNtzs(height, {}, (err, res, peer) => {
      //console.log('err=', err, 'res=', res);
      if (!err) 
          resolve(res);
      else
          reject(err);
      });
    });
}


/**
 * get notarization txns with their proofs
 * @param {*} peers 
 * @param {*} ntzTxid 
 * @returns 
 */
function nspvNtzsProof(peers, ntzTxid)
{
  return new Promise((resolve, reject) => {
    peers.nspvNtzsProof(ntzTxid, {}, (err, res, peer) => {
    //console.log('err=', err, 'res=', res);
    if (!err) 
        resolve(res);
    else
        reject(err);
    });
  });
}

exports.nspvNtzsProof = nspvNtzsProof;
/**
 * get notarization bracket then for this bracket get notarization txns with their proofs
 * @param {*} peers 
 * @param {*} prevTxid 
 * @param {*} nextTxid 
 * @returns 
 */
function nspvNtzsThenNtzProofs(peers, height)
{
  return new Promise((resolve, reject) => {
    peers.nspvNtzs(height, {}, (ntzErr, ntzsRes, peer) => {
      resolve ({ nspvVersion: NSPV_VERSION_5 });  // TODO: temp allow old nodes, do not continue with nspvNtzsProof
      /*if (peer.nspvVersion == NSPV_VERSION_5) {
        resolve ({ nspvVersion: NSPV_VERSION_5 });  // TODO: temp allow old nodes, do not continue with nspvNtzsProof
        return;
      }*/
      if (!ntzErr) {
        peers.nspvNtzsProof(ntzsRes.ntz.txid, {}, (ntzsProofErr, ntzsProofRes, peer) => {
          if (!ntzsProofErr) 
            resolve({ ntzs: ntzsRes, ntzsProof: ntzsProofRes, nspvVersion: peer.nspvVersion });
          else
            reject(ntzsProofErr);
        });
      }
      else
        reject(ntzErr);
      });
  });
}

function validateHeadersInNtzBracket(ntz)
{

}

/**
 * validate a transaction with txproof (partial merkle tree) object or 
 * @param {*} peers 
 * @param {*} txid 
 * @param {*} height 
 * @returns object with vaidation result or null
 */
exports.validateTxUsingNtzsProof = async function(peers, network, _txid, height)
{
  let txid = ccutils.castHashBin(_txid);
  let promizeTxproof = nspvTxProof(peers, txid, 0, 0);
  let promizeNtzsProof = nspvNtzsThenNtzProofs(peers, height);

  let results = await Promise.all([promizeTxproof, promizeNtzsProof]);
  if (results.length < 2 || !results[0] || !results[1] || ccutils.isError(results[0]) || ccutils.isError(results[1]) )  {
    logerror("bad results for proofs or ntzsProofs received", "results[0]", results[0], "results[1]", results[1] );
    return false;
  }

  let txProof = results[0];
  if (results[1]?.nspvVersion == 5) return true;
  let ntzs = results[1].ntzs;  // notarization txids, heights
  let ntzsProof = results[1].ntzsProof;  // notarization txns and block headers

  if (!ntzs || !ntzsProof)  {
    logerror("empty ntzs or ntzsProofs results received");
    return false;
  }
  
  /*
  let hdrOffset = height - (ntzs.prevntz.height + 1);  // first height in the bracket is prevntz.height + 1
  if (hdrOffset < 0 || hdrOffset > ntzs.nextntz.height)  {
    logerror(`invalid notarization bracket found: [${ntzs.prevntz.height}, ${ntzs.nextntz.height}] for tx height: ${height}`);
    return null;
  } */
  let hdrOffset = height - (ntzsProof.common.ntzedHeight - ntzsProof.common.hdrs.length) - 1; 

  if (hdrOffset < 0 || hdrOffset >= ntzsProof.common.hdrs.length)  {
    logerror(`invalid header array offset ${hdrOffset} for notarization headers length ${ntzsProof.common.hdrs.length}`);
    return false;
  }

  if (!txProof || !txProof.partialMerkleTree || !txProof.partialMerkleTree.merkleRoot)
    throw new Error("proof (partial merkle tree) not found for txid!"); 

  // validate tx against txproof (partial merkle tree)
  let hashes = bmp.verify(txProof.partialMerkleTree);
  if (hashes.length == 0 || Buffer.compare(hashes[0], txid) != 0 )  {
    logerror("invalid tx proof for txid:",  ccutils.hashToHex(txid));
    throw new Error("txid existence in the chain is not proved!");
  }
  // check txproof's merkle root is in notarized block
  if (Buffer.compare(ntzsProof.common.hdrs[hdrOffset].merkleRoot, txProof.partialMerkleTree.merkleRoot) != 0)   {
    logerror("merkle root does not match notarization data for txid:",  ccutils.hashToHex(txid));
    throw new Error("could not check merkle root against notarization data!");
  }

  // validate next notarization transaction and its notary sigs:
  let ntzTx = Transaction.fromBuffer(ntzsProof.ntzTxBuf, network);
  let ntzTxOpreturn = ntzpubkeys.NSPV_notarizationextract(false, true, ntzTx, ntzs.ntz.timestamp);
  if (ccutils.isError(ntzTxOpreturn))
    throw ntzTxOpreturn;
  // check next ntz data
  if (Buffer.compare(ntzTxOpreturn.destTxid, ntzs.ntz.destTxid) != 0)
    throw new Error('notarisation data invalid (destTxid in ntz)');
  if (ntzTxOpreturn.height !== ntzs.ntz.height)
    throw new Error('notarisation data invalid (height in ntz)');
  if (ntzTxOpreturn.height !== ntzsProof.common.ntzedHeight)
    throw new Error('notarisation data invalid (height in ntzsproof)');
  if (Buffer.compare(ntzTxOpreturn.blockhash, kmdblockindex.kmdHdrHash(ntzsProof.common.hdrs[ntzsProof.common.hdrs.length-1])) != 0)
    throw new Error('notarisation data invalid (blockhash)');

  // check mom
  let ntzparsed = ntzpubkeys.NSPV_opretextract(false, ntzTx.outs[1].script);
  //console.log(ntzparsed)

  // check mom
  let leaves = [];
  ntzsProof.common.hdrs.slice().reverse().forEach(h => leaves.push(h.merkleRoot));
  let mom = fastMerkleRoot(leaves, bcrypto.hash256);
  if (Buffer.compare(mom, ntzparsed.MoM) !== 0)
    throw new Error('notarisation MoM invalid'); 

  // check chain name
  if (coins.getNetworkName(network) !== ntzparsed.symbol)
    throw new Error('notarisation chain name invalid');

  return true;
}

/**
 * validate txid presence in the chain by requesting txproof object and checking merkle root
 * @param {*} peers 
 * @param {*} _txid 
 * @returns true or false or throws exception
 */
exports.validateTxUsingTxProof = async function(peers, _txid)
{
  let txid = ccutils.castHashBin(_txid);
  let promizeTxproof = nspvTxProof(peers, txid, 0, 0);

  let results = await Promise.all([promizeTxproof]);
  if (results.length < 1 || !results[0] || ccutils.isError(results[0]))  {
    logerror("bad results for proofs received", results[0]);
    return false;
  }

  let txProof = results[0];
  if (!txProof || !txProof.partialMerkleTree || !txProof.partialMerkleTree.merkleRoot)
    throw new Error("invalid merkle root object in proof!"); 

  // validate tx against txproof (partial merkle tree)
  let hashes = bmp.verify(txProof.partialMerkleTree);
  if (hashes.length == 0 || Buffer.compare(hashes[0], txid) != 0 )  {
    logerror("invalid tx proof for txid:",  ccutils.hashToHex(txid));
    throw new Error("txid existence in the chain is not proved!");
  }
  return true
}


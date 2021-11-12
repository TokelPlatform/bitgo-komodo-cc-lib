'use strict'

const Debug = require('debug');
const logdebug = Debug('net:nspv');
const logerror = Debug('net:nspv:error');

var bcrypto = require('../src/crypto');
var fastMerkleRoot = require('merkle-lib/fastRoot');
var bmp = require('bitcoin-merkle-proof');
const ccutils = require('./ccutils');
const ntzpubkeys = require('./ntzpubkeys');
//const TransactionBuilder = require('../src/transaction_builder');
const Transaction = require('../src/transaction');
const kmdblockindex = require('../src/kmdblockindex');
const coins = require('../src/coins')

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
 * @param {*} prevTxid 
 * @param {*} nextTxid 
 * @returns 
 */
function nspvNtzsProof(peers, prevTxid, nextTxid)
{
  return new Promise((resolve, reject) => {
    peers.nspvNtzsProof(prevTxid, nextTxid, {}, (err, res, peer) => {
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
    
    //console.log('err=', err, 'ntzRes=', ntzRes);
    if (!ntzErr) {
      peers.nspvNtzsProof(ntzsRes.prevntz.txid, ntzsRes.nextntz.txid, {}, (ntzsProofErr, ntzsProofRes, peer) => {
        if (!ntzsProofErr) 
          resolve({ ntzs: ntzsRes, ntzsProof: ntzsProofRes });
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
    return null;
  }

  let txProof = results[0];
  let ntzs = results[1].ntzs;  // notarization txids, heights
  let ntzsProof = results[1].ntzsProof;  // notarization txns and block headers

  if (!ntzs || !ntzsProof)  {
    logerror("empty ntzs or ntzsProofs results received");
    return null;
  }
  
  let hdrOffset = height - (ntzs.prevntz.height + 1);  // first height in the bracket is prevntz.height + 1
  if (hdrOffset < 0 || hdrOffset > ntzs.nextntz.height)  {
    logerror(`invalid notarization bracket found: [${ntzs.prevntz.height}, ${ntzs.nextntz.height}] for tx height: ${height}`);
    return null;
  }

  if (hdrOffset >= ntzsProof.common.hdrs.length)  {
    logerror(`invalid notarization headers length: ${ntzsProof.common.hdrs.length} for tx header offset: ${hdrOffset}`);
    return null;
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

  // validate prev notarization transaction and its notary sigs:
  let prextx = Transaction.fromBuffer(ntzsProof.prevtxbuf, network);
  let prevNtzData = ntzpubkeys.NSPV_notarizationextract(false, true, prextx, ntzs.prevntz.timestamp);
  if (ccutils.isError(prevNtzData))
    throw prevNtzData;

  // check prev ntz data
  if (Buffer.compare(prevNtzData.desttxid, ntzs.prevntz.otherTxid) != 0)
    throw new Error('notarisation data invalid (prev txid in ntzs)');
  if (prevNtzData.height !== ntzs.prevntz.height)
    throw new Error('notarisation data invalid (prev height in ntzs)');
  if (prevNtzData.height !== ntzsProof.common.prevht)
    throw new Error('notarisation data invalid (prev height in ntzsproof)');

  // validate next notarization transaction and its notary sigs:
  let nexttx = Transaction.fromBuffer(ntzsProof.nexttxbuf, network);
  let nextNtzData = ntzpubkeys.NSPV_notarizationextract(false, true, nexttx, ntzs.nextntz.timestamp);
  if (ccutils.isError(nextNtzData))
    throw nextNtzData;
  // check next ntz data
  if (Buffer.compare(nextNtzData.desttxid, ntzs.nextntz.otherTxid) != 0)
    throw new Error('notarisation data invalid (next txid in ntzs)');
  if (nextNtzData.height !== ntzs.nextntz.height)
    throw new Error('notarisation data invalid (next height in ntzs)');
  if (nextNtzData.height !== ntzsProof.common.nextht)
    throw new Error('notarisation data invalid (next height in ntzsproof)');
  if (Buffer.compare(nextNtzData.blockhash, kmdblockindex.kmdHdrHash(ntzsProof.common.hdrs[ntzsProof.common.hdrs.length-1])) != 0)
    throw new Error('notarisation data invalid (next blockhash)');

  // check mom
  let ntzparsed = ntzpubkeys.NSPV_opretextract(false, nexttx.outs[1].script);
  //console.log(ntzparsed)
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


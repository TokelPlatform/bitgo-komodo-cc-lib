'use strict'

const Debug = require('debug');
const logdebug = Debug('nspv');
const logerror = Debug('nspv:error');

const bcrypto = require('../src/crypto');
const fastMerkleRoot = require('merkle-lib/fastRoot');
const bmp = require('bitcoin-merkle-proof');
const ccutils = require('./ccutils');
const ntzpubkeys = require('./ntzpubkeys');
//const TransactionBuilder = require('../src/transaction_builder');
const Transaction = require('../src/transaction');
const kmdblockindex = require('../src/kmdblockindex');
const coins = require('../src/coins');
const typeforce = require('typeforce');
const types = require('../src/types');
const map = require('bitcoin-ops/map');
const { NspvError } = require('../net/nspvPeer');

var txProofCache = new Map();
var ntzProofCache = new Map();

function addTxProofToCache(height, txproof)
{
  if (!txProofCache.has(height))
    txProofCache.set(height, txproof);
}
function findTxProofInCache(height)
{
  return txProofCache.has(height) ? txProofCache[height] : null;
}

function addNtzProofToCache(height, ntz, ntzProof)
{
  if (!ntzProofCache.has(height)) {
    ntzProofCache.set(height, { ntz : ntz, ntzProof : ntzProof });
  }
}
function findNtzProofInCache(height)
{
  let found = null;
  for (const [k, v] of ntzProofCache) {
    if (height <= v.ntzProof.common.ntzedHeight && height > v.ntzProof.common.ntzedHeight - v.ntzProof.common.hdrs.length)  {
      found = v;
      break;
    }
  }
  return found;
}

exports.nspvTxProof = nspvTxProof;
function nspvTxProof(peers, txidhex, vout, height)
{
  return new Promise((resolve, reject) => {
    peers.nspvTxProof(txidhex, vout, height, { timeout: 1000 }, (err, res, peer) => {
      //console.log('err=', err, 'res=', res);
      if (!err) {
        res.peer = peer;
        resolve(res);
      }
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
      if (!err)  {
        res.peer = peer;
        resolve(res);
      }
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
      if (!err)  {
        res.peer = peer;
        resolve(res);
      }
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
    peers.nspvNtzs(height, { timeout: 1000 }, (ntzErr, ntzsRes, peer) => {
      if (!ntzErr) {
        ntzsRes.peer = peer;
        if (ccutils.isEmptyHash(ntzsRes?.ntz?.txid))  {
          reject(new NspvError('ntz data not found for height'));
          return;
        }
        peers.nspvNtzsProof(ntzsRes.ntz.txid, { timeout: 1000 }, (ntzsProofErr, ntzsProofRes, peer) => {
          if (!ntzsProofErr)  {
            ntzsProofRes.peer = peer;
            resolve({ ntz: ntzsRes, ntzProof: ntzsProofRes, nspvVersion: peer.nspvVersion });
          }
          else
            reject(ntzsProofErr);
        });
      }
      else
        reject(ntzErr);
      });
  });
}

/**
 * validate a transaction with txproof (partial merkle tree) object or 
 * @param {*} peers 
 * @param {*} txid 
 * @param {*} height 
 * @returns object with validation result or null
 */
exports.validateTxUsingNtzsProof = async function(peers, network, _txid, height)
{
  typeforce('PeerGroup', peers);
  typeforce(types.Network, network);
  let txid = ccutils.castHashBin(_txid);
  typeforce('Number', height);

  logdebug('getting ntz data for height', height);
  let txProof = findTxProofInCache(height);
  if (txProof) logdebug('found txproof data in cache for height', height);
  let ntzData = findNtzProofInCache(height);
  if (ntzData) logdebug('found ntz data in cache for height', height);
  let ntz;
  let ntzProof;

  let promises = new Array();
  if (!txProof)
    promises.push(nspvTxProof(peers, txid, 0, 0));

  if (!ntzData)
    promises.push(nspvNtzsThenNtzProofs(peers, height));
  else  {
    ntz = ntzData.ntz;
    ntzProof = ntzData.ntzProof;
  }

  if (promises.length > 0)  {

    let results = await Promise.all(promises);
    let nspvErr = results.find((v)=> { return ccutils.isError(v) ? true : false; });  // check if any errors returned
    if (results.length < promises.length || nspvErr)  {
      logerror("bad results for tx or ntzs proofs received, error=", nspvErr);
      return false;
    }
    let i = 0;
    if (!txProof) {
      txProof = results[i];
      i ++;
    }
    
    if (!ntzData)  {
      ntz = results[i].ntz;  // notarization txids, heights
      ntzProof = results[i].ntzProof;  // notarization txns and block headers
    }
  }

  if (!ntz || !ntzProof)  {
    logerror("empty ntz or ntzsProofs results received");
    return false;
  }
  
  let ntzProofInvalid = false; 
  try 
  {
    let hdrOffset = height - (ntzProof.common.ntzedHeight - ntzProof.common.hdrs.length) - 1; 
    if (hdrOffset < 0 || hdrOffset >= ntzProof.common.hdrs.length)  {
      logerror(`invalid header array offset ${hdrOffset} for notarization headers length ${ntzProof.common.hdrs.length}`);
      //ntzProofInvalid = true; // gaps possible
      throw new Error("invalid header offset in notarisation data for txid!");
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
    if (Buffer.compare(ntzProof.common.hdrs[hdrOffset].merkleRoot, txProof.partialMerkleTree.merkleRoot) != 0)   {
      logerror("merkle root does not match notarization data for txid:",  ccutils.hashToHex(txid));
      throw new Error("could not check merkle root against notarization data!");
    }

    // validate notarization transaction and its notary sigs:
    let ntzTx = Transaction.fromBuffer(ntzProof.ntzTxBuf, network);
    let ntzTxOpreturn = ntzpubkeys.NSPV_notarizationextract(false, true, ntzTx, ntz.ntz.timestamp);
    if (ccutils.isError(ntzTxOpreturn)) {
      ntzProofInvalid = true;  // cant decode ntz tx or check notary signatures
      throw ntzTxOpreturn;
    }
    // check ntz data
    if (Buffer.compare(ntzTxOpreturn.destTxid, ntz.ntz.destTxid) != 0)
      throw new Error('notarisation data invalid (destTxid in ntz)');
    if (ntzTxOpreturn.height !== ntz.ntz.height)
      throw new Error('notarisation data invalid (height in ntz)');
    if (ntzTxOpreturn.height !== ntzProof.common.ntzedHeight)
      throw new Error('notarisation data invalid (height in ntzsproof)');
    if (Buffer.compare(ntzTxOpreturn.blockhash, kmdblockindex.kmdHdrHash(ntzProof.common.hdrs[ntzProof.common.hdrs.length-1])) != 0)
      throw new Error('notarisation data invalid (blockhash)');

    if (ntzTx.outs.length != 2) {
      ntzProofInvalid = true;
      throw new Error('invalid notarisation tx outputs size');
    }
    // check mom
    let ntzparsed = ntzpubkeys.NSPV_opretextract(false, ntzTx.outs[1].script);
    //console.log(ntzparsed)
    if (!ntzparsed)  {
      ntzProofInvalid = true;
      throw new Error('cannot parse notarisation tx opreturn');
    }

    // check mom
    let leaves = [];
    ntzProof.common.hdrs.slice().reverse().forEach(h => leaves.push(h.merkleRoot));
    let mom = fastMerkleRoot(leaves, bcrypto.hash256);
    if (Buffer.compare(mom, ntzparsed.MoM) !== 0)  {
      ntzProofInvalid = true;
      throw new Error('notarisation MoM invalid'); 
    }

    // check chain name
    if (coins.getNetworkName(network) !== ntzparsed.symbol)  {
      ntzProofInvalid = true;
      throw new Error('notarisation chain name invalid');
    }

  } catch(e)  {
    logdebug('could not validate txid with notarisation data, error=', e?.message);
    if (ntzProofInvalid)  {
      let err = Error(`peer disconnected due to bad ntz tx returned ${e?.message} from`, ntzProof.peer.getUrl());
      err.ban = 1000; // ban this node forever
      ntzProof.peer.disconnect(err);
      if (peers.hasMethods()) {
        logdebug('retrying txid validation with notarisation data, error=', e?.message);
        return exports.validateTxUsingNtzsProof(peers, network, _txid, height);  // retry if there are connections left
      }
    }
    return false;
  }
  // cache good proofs
  addTxProofToCache(height, txProof);
  addNtzProofToCache(height, ntz, ntzProof);
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
  typeforce('PeerGroup', peers);

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

class NtzUtxoValidation {

  constructor(_peers, _network, _utxos)
  {
    typeforce('PeerGroup', _peers);
    typeforce(types.Network, _network);
    typeforce('Array', _utxos);

    this.peers = _peers;
    this.network = _network;
    this.utxos = _utxos;
    this.inWait = new Map();
    this.tried = new Set();
  }

  _runLoop(maxcalls)  
  {
    let BreakException = {};
    try {
      let count = 0;
      this.utxos.forEach((utxo) => { 
        if (this.inWait.size > 20) throw BreakException;
        if (typeof utxo.ntzValid === 'undefined' && !this.inWait.has(utxo.txid))  {
          //let p = new Promise(async (resolve, reject) => {
          this.inWait.set(utxo.txid, true); //p;
          (async ()=>{ 
            try {
              let valid = await exports.validateTxUsingNtzsProof(this.peers, this.network, utxo.txid, utxo.height);
              this.inWait.delete(utxo.txid); // not in wait any more
              utxo.ntzValid = valid;
              this.tried.add(utxo.txid);
            } catch(err) {
              logdebug('NtzUtxoValidation received error for height', utxo.height, err?.message);
              this.inWait.delete(utxo.txid); 
              if (!err.rateTimeout) {
                this.tried.add(utxo.txid);
              }
              //else
              //  console.log('rateTimeout for height', utxo.height);
            } 
          })();
          count ++;
        }
      });
    }
    catch(e) {
      if (e !== BreakException) throw e;
    }
  }

  // calc utxos with ntzValidated
  getTried() 
  { 
    //return this.utxos && 
    //  this.utxos.length > 0 ? this.utxos.reduce((acc, cur)=>{ return acc + (typeof cur?.ntzTried != 'undefined' ? 1 : 0); }, 0) : 0; 
    return this.tried.size;
  }

  async execute() 
  {
    let sleep = function(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    // validate in loop by using max calls at once not to be rejected by the rate limiter
    let maxcalls = 1000;
    this._runLoop(maxcalls);      
    // wait for utxos to validate
    let tried = this.getTried();

    while (tried < this.utxos.length)  {  
      //if (this.activeRequests() == 0)  {
      let active = this.activeRequests();
      //if (active == 0)
      //}
      //else {
      if (active > 0)  {
        await sleep(1000);
        if (active < 20)
          this._runLoop(maxcalls);
        console.log('validated utxos count=', tried, 'total count=', this.utxos.length, 'active reqs=', active);
      }
      this._runLoop(maxcalls); 
      tried = this.getTried();
    }
  }

  activeRequests()
  {
    return this.inWait.size;
  }
}

exports.NtzUtxoValidation = NtzUtxoValidation;

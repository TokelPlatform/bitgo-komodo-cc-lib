/**
 * cc utils to create cryptocondition tx in javascript
 * Note: max amount enforced in typeforce SATOSHI_MAX changed from btc 21 * 1e14 to MAX_SAFE_INTEGER
 * Also readUInt64 and typeforce(type.Satoshi) enforce same MAX_SAFE_INTEGER == 900719925474991 (0x001fffffffffffff) == 90 * 1e14. 
 */

const Transaction = require('../src/transaction');
const ccbasic = require('./ccbasic');
const ecc = require('secp256k1');
const crypto = require('../src/crypto');
const address = require('../src/address');
const bufferutils = require("../src/bufferutils");
const bscript = require('../src/script')
const types = require('../src/types');
const { decodeTransactionData, parseTransactionData, isCcTransaction } = require('./txParser');
const { MAX_TX_PER_REQUEST } = require('./constants');
var typeforce = require('typeforce');
var typeforceNT = require('typeforce/nothrow');
const OPS = require('bitcoin-ops');
const BN = require('bn.js');
const p2pkcltv = require('../src/templates/pubkey-cltv');
const p2pkhcltv = require('../src/templates/pubkeyhash-cltv');


const { splitArrayInChunks } = require('./helper')

const Debug = require('debug')
const logdebug = Debug('cc')

const networks = require('../src/networks');
const { getAddress } = require('./general');

exports.finalizeCCtx = finalizeCCtx;
exports.createTxAndAddNormalInputs = createTxAndAddNormalInputs;
exports.getNormalUtxos = getNormalUtxos;
exports.getCCUtxos = getCCUtxos;
exports.getUtxos = getUtxos;
exports.getTxids = getTxids;
exports.getTxidsV2 = getTxidsV2;
exports.hex2Base64 = hex2Base64;
exports.byte2Base64 = byte2Base64;
exports.addInputsFromPreviousTxns = addInputsFromPreviousTxns;
exports.pubkey2NormalAddressKmd = pubkey2NormalAddressKmd;
exports.getRawTransaction = getRawTransaction;
exports.getTransactionsMany = getTransactionsMany;
exports.getTransactionsManyDecoded = getTransactionsManyDecoded;
exports.isEmptyObject = isEmptyObject;
exports.ccTxidPubkey_tweak = ccTxidPubkey_tweak;

const EMPTY_TXID = '0000000000000000000000000000000000000000000000000000000000000000';
exports.BN_MYDUST = new BN(200);

/**
 * sign c cc transaction in the txbuilder, checks inputs and calls either standard signing function or cc signing function
 * @param {*} keyPairIn ecc key pair
 * @param {*} txbuilder TransactionBuilder object
 * @param {*} ccProbes array of objects { cond, privateKey } specifying dedicated private keys for some cc conds
 */
function finalizeCCtx(keyPairIn, txbuilder, ccProbes)
{
  typeforce('ECPair', keyPairIn);
  typeforce('TransactionBuilder', txbuilder);

  //let tx = txb.buildIncomplete();
  //for (let index = 0; index < tx.ins.length; index ++)
  for (let index = 0; index < txbuilder.inputs.length; index ++)
  {
    /*let unspent = addedUnspents.find((u) => {
      //let txid = bufferutils.reverseBuffer(Buffer.from(u.txId, 'hex'));
      let txid = u.txId;
      //logdebug('hash=', tx.ins[index].hash.toString('hex'), ' txId=', txid.toString('hex'));
      return txb.__TX.ins[index].hash.toString('hex') === txid.toString('hex');
    });
    if (unspent === undefined) 
      throw new Error('internal err: could not find tx unspent in addedUnspents');
    
    logdebug('unspent.script=', Buffer.from(unspent.script).toString('hex'));*/
    //let keyPairIn = ecpair.fromWIF(wif, mynetwork);

    if (!ccbasic.isSpkPayToCryptocondition(txbuilder.inputs[index].prevOutScript))  {
      txbuilder.sign(
        index, keyPairIn, undefined, Transaction.SIGHASH_ALL, txbuilder.inputs[index].value
      /*{
        //prevOutScriptType: classify.output(Buffer.from(unspent.script)),
        prevOutScriptType: getOutScriptTypeFromOutType(txb.__INPUTS[index].prevOutType),  // TODO: replace accessing seemingly an internal var
        vin: index,
        keyPair: keyPairIn,
        value: unspent.value
      }*/);
      //txbuilder.finalizeInput(index);
    }
    else {
      // sign cc vin:
      // find a cond, it might also provide with a private key, if not use keyPairIn private key:
      let privateKey;
      let inputCond;
      if (ccProbes !== undefined) 
      {
        if (!Array.isArray(ccProbes))
          throw new Error('finalizeCCtx cannot sign tx: probe not an array ');

        let probe = findCCProbeForSpk(ccProbes, txbuilder.inputs[index].prevOutScript);
        if (probe !== undefined) {
          inputCond = probe.cond;
          if (probe.privateKey !== undefined)
            privateKey = probe.privateKey;
        }
      }
      if (privateKey === undefined)
        privateKey = keyPairIn.getPrivateKeyBuffer();
      if (inputCond === undefined)
        throw new Error('finalizeCCtx cannot sign tx: no probe found for cc input: ' + index);

      let signatureHash = txbuilder.tx.hashForZcashSignature(
        index,
        ccbasic.makeCCSpk(inputCond),  // pure spk should be here
        txbuilder.inputs[index].value,   // unspent.value,
        Transaction.SIGHASH_ALL,
      );    

      let signedCond = ccbasic.cryptoconditions.js_sign_secp256k1(inputCond, privateKey, signatureHash);
      if (signedCond)
        inputCond = signedCond;
      signedCond = ccbasic.cryptoconditions.js_cc_sign_secp256k1hash(inputCond, privateKey, signatureHash);
      let ccScriptSig = ccbasic.makeCCScriptSig(signedCond);

      txbuilder.inputs[index].ccScriptSig = ccScriptSig;
      
      /*txbuilder.finalizeInput(index, (index, psbtInput) => {
        //if (psbtInput.finalScriptSig)
        //  psbtInput.finalScriptSig = undefined;  // 'un-finalize' psbt output. No need of this as we now recreating all inputs/outputs for each faucet get txpow try
        return { finalScriptSig: ccScriptSig };  // looks like a hack but to avoid extra psbt after-signing checks 
      });*/
      //logdebug('signed cccond=', signedCond);
    }
  }
}


/**
 * Creates a frequently used M of N cryptocondition
 * @param {*} evalcode 
 * @param {*} dests array of pubkeys or addresses
 * @param {*} M M-value
 * @param {*} opdrop optional opdrop data to be added with OP_DROP
 */
 function makeCCCondMofN(evalcodes, dests, M) {
  typeforce(typeforce.oneOf(types.arrayOf(types.UInt8),types.UInt8), evalcodes);
  typeforce(typeforce.oneOf(types.arrayOf('Buffer'), types.arrayOf('String')), dests);
  typeforce(types.UInt32, M);

  let _evalcodes = Array.isArray(evalcodes) ? evalcodes : [evalcodes];

  let subconds = [];
  dests.forEach(d => {
    let secpcond;
    if (Buffer.isBuffer(d) ) {
      if (d.length == 33) {
        secpcond = {  
          type:	"secp256k1-sha-256",
          publicKey:	d.toString('hex')  
        };
      } else {
        secpcond = {  
          type:	"secp256k1hash-sha-256",
          publicKeyHash:	d.toString('hex')  
        }
      }
    } else {
      if (d.length == 66) {
        secpcond = {  
          type:	"secp256k1-sha-256",
          publicKey:	d  
        };
      } else {
        secpcond = {  
          type:	"secp256k1hash-sha-256",
          publicKeyHash:	address.fromBase58Check(d).hash.toString('hex')  
        }
      }
    }
    subconds.push(secpcond);
  }); 

  let subfulfillments = [];
  _evalcodes.forEach(evalcode => subfulfillments.push( {
    type:	"eval-sha-256",   
    code:	byte2Base64(evalcode)     
  }));
  subfulfillments.push({            
    type:	"threshold-sha-256",
    threshold:	M,
    subfulfillments:	subconds  
  });
  let cond = {
    type:	"threshold-sha-256",
    threshold:	subfulfillments.length,
    subfulfillments: subfulfillments
  };
  return cond;
}
exports.makeCCCondMofN = makeCCCondMofN;


/**
 * Creates an spk in cc v2 format (mixed mode) for a frequently used M of N cryptocondition
 * @param {*} evalcode 
 * @param {*} dests array of pubkeys or addresses
 * @param {*} M M-value in MofN
 * @param {*} opdrop optional opdrop data to be added with OP_DROP
 * @param {*} ccSubver cc spk subversion
 */
 function makeCCSpkV2MofN(evalcodes, pubkeys, M, opdrop, ccSubver) {
  let cond = makeCCCondMofN(evalcodes, pubkeys, M);
  return ccbasic.makeCCSpkV2(cond, opdrop, ccSubver);
}
exports.makeCCSpkV2MofN = makeCCSpkV2MofN;

/*
function getOutScriptTypeFromOutType(outType)
{
  switch(outType) {
    case classify.types.P2PK:
      return 'p2pk';
    case classify.types.P2PKH:
      return 'p2pkh';
    default:
      return undefined;
  }
}*/

/*function isPayToCryptocondition(spk)
{
  //let ccimp = await cryptoconditions;
  if (cryptoconditions === undefined)
    return false;

  console.log('IsPayToCryptocondition spk=', spk.toString('hex'));
  if (Buffer.isBuffer(spk) && spk.length >= 46 && spk[spk.length-1] == 0xcc)  {
    let condbin = spk.slice(1, spk.length-1);
    console.log('IsPayToCryptocondition checking buffer=', condbin.toString('hex'))
    let cond = cryptoconditions.js_read_ccondition_binary(condbin);
    if (cond !== undefined)
      return true;
  }
  return false;
}*/

/*
function getPsbtPrevOut(psbt, index)
{
  let input = psbt.data.inputs[index];
  if (input.nonWitnessUtxo) { 
    const unsignedTx = psbt.__CACHE.__TX;
    const c = psbt.__CACHE.__NON_WITNESS_UTXO_TX_CACHE;
    const nonWitnessUtxoTx = c[index];

    const prevoutHash = unsignedTx.ins[index].hash;
    const utxoHash = nonWitnessUtxoTx.getHash();

    // If a non-witness UTXO is provided, its hash must match the hash specified in the prevout
    if (!prevoutHash.equals(utxoHash)) {
      throw new Error(
        `Non-witness UTXO hash for input #${index} doesn't match the hash specified in the prevout`,
      );
    }

    const prevoutIndex = unsignedTx.ins[index].index;
    const prevout = nonWitnessUtxoTx.outs[prevoutIndex];
    return prevout;
  }
  return { script: Buffer.from([]), value: 0 };
}*/

function findCCProbeForSpk(ccProbes, spk)
{
  let isMixed = false;
  let condbin = ccbasic.parseCCSpk(spk).cc;
  let ccsubver = Number(condbin[0]) - ccbasic.CC_MIXED_MODE_PREFIX;
  if (condbin.length > 0 && ccsubver >= ccbasic.CCSUBVERS.CC_MIXED_MODE_SUBVER_0 && ccsubver <= ccbasic.CCSUBVERS.CC_MIXED_MODE_SECHASH_SUBVER_1) {
    condbin = condbin.slice(1, condbin.length);
    isMixed = true;
  }

  return ccProbes.find(probe => {
    if (probe.cond === undefined)   
      throw new Error("FinalizeCCtx can't sign tx: invalid probe array");
    if (!isMixed) {
      let condbinp = ccbasic.ccConditionBinary(probe.cond);
      //logdebug('prev condbin=', condbin.toString('hex'), 'probe condbin=', condbinp.toString('hex'));
      return condbin.equals(condbinp);
    }
    else {
      let noAnon = (ccsubver >= ccbasic.CCSUBVERS.CC_MIXED_MODE_SECHASH_SUBVER_1);
      let condbinv2p = ccbasic.ccConditionBinaryV2(probe.cond, noAnon);
      //logdebug('mixed prev condbin=', condbin.toString('hex'), 'probe condbinv2=', condbinv2p.toString('hex'));
      return condbin.equals(condbinv2p);
    }
  });
}

function updateCltvData(utxos)
{
  if (!Array.isArray(utxos)) return;
  utxos.forEach((value) => {
    if (value.script)  {
      let decoded
      if (p2pkcltv.output.check(value.script))
        decoded = p2pkcltv.output.decode(value.script);
      if (p2pkhcltv.output.check(value.script))
        decoded = p2pkhcltv.output.decode(value.script);
      if (decoded)
        value.nLockTime = decoded?.nLockTime;
    }
  })
}

/**
 * returns utxos (unspent outputs) for an address
 * @param {*} peers PeerGroup object with NspvPeers ext
 * @param {*} address address to get utxos from
 * @param {*} isCC if 1 get cc or if 0 get normal utxos
 * @param {*} skipCount number of utxo to skip 
 * @param {*} maxrecords max number of returned utxos, if 0 will return max records set by the server
 */
function getUtxos(peers, address, isCC, skipCount, maxrecords)
{
  return new Promise((resolve, reject) => {
    peers.nspvGetUtxos(address, isCC, skipCount, maxrecords, {}, (err, res, peer) => {
      //console.log('err=', err, 'res=', res);
      if (!err) {
        updateCltvData(res.utxos);
        resolve(res);
      }
      else
        reject(err);
    });
  });
}

/**
 * returns array with txids relevant to an address: tx outputs (spent and unspent) and spending txids (from this address)
 * @param {*} peers PeerGroup object with NspvPeers additions
 * @param {*} address address to get txids from
 * @param {*} isCC get txids with normal (isCC is 0) or cc (isCC is 1) utxos on this address
 * @param {*} skipCount number of txos to skip 
 * @param {*} maxrecords max number of returned txos, if 0 will return max records set by the server
 * @returns a promise returning object containing nspv params and a 'txids' array with txid, index and amount props. 
 * Note that txids with negative amount denote spending transactions, and the 'index' property means input's index
 * for txids with positive amounts those are tx outputs
 */
function getTxids(peers, address, isCC, skipCount, maxrecords)
{
  return new Promise((resolve, reject) => {
    peers.nspvGetTxids(address, isCC, skipCount, maxrecords, {}, (err, res, peer) => {
      //console.log('err=', err, 'res=', res);
      if (!err)
        resolve(res);
      else
        reject(err);
    });
  });
}

/**
 * returns array with txids relevant to an address: tx outputs (spent and unspent) and spending txids (from this address)
 * @param {*} peers PeerGroup object with NspvPeers additions
 * @param {*} address address to get txids from
 * @param {*} isCC get txids with normal (isCC is 0) or cc (isCC is 1) utxos on this address
 * @param {*} beginHeight begin height to search txids from 
 * @param {*} endHeight to search txids up to
 * @returns a promise returning object containing nspv params and a 'txids' array with txid, index and amount props. 
 * Note that txids with negative amount denote spending transactions, and the 'index' property means input's index
 * for txids with positive amounts those are tx outputs
 */
 function getTxidsV2(peers, address, isCC, beginHeight, endHeight)
 {
   return new Promise((resolve, reject) => {
     peers.nspvGetTxidsV2(address, isCC, beginHeight, endHeight, {}, (err, res, peer) => {
       //console.log('err=', err, 'res=', res);
       if (!err)
         resolve(res);
       else
         reject(err);
     });
   });
 }

/**
 * create a tx and adds normal inputs for equal or more than the amount param 
 * @param {*} peers PeerGroup object with NspvPeers ext
 * @param {*} mypk pk to add normal inputs from
 * @param {*} bnAmount that will be added (not less than)
 * @returns tx with added inputs along with the added transactions in hex
 */
function createTxAndAddNormalInputs(peers, mypk, amount)
{
  typeforce('PeerGroup', peers);
  typeforce('Buffer', mypk);
  typeforce(typeforce.oneOf(types.Satoshi, types.BN), amount);

  let bnAmount = typeof amount == 'number' ? new BN(amount) : amount;
  return new Promise((resolve, reject) => {
    /*let request = `{
      "method": "createtxwithnormalinputs",
      "mypk": "${mypk}",
      "params": [
        "${amount}" 
      ]
    }`;*/
    peers.nspvRemoteRpc("createtxwithnormalinputs", mypk, bnAmount.toString(), {}, (err, res, peer) => {
      //console.log('err=', err, 'res=', res);
      if (!err) 
        resolve(res);
      else
        reject(err);
    });
  });
}

/**
 * get normal (non-CC) utxos from an address
 * @param {*} peers PeerGroup object with NspvPeers ext
 * @param {*} address to add normal from
 * @param {*} skipCount number of utxos to skip 
 * @param {*} maxrecords max number of returned utxos, if 0 max records limit set by the server will be used
 * @returns utxo list
 */
function getNormalUtxos(peers, address, skipCount = 0, maxrecords = 0)
{
  typeforce('PeerGroup', peers);
  typeforce('String', address);
  typeforce('Number', skipCount);
  typeforce('Number', maxrecords);

  return getUtxos(peers, address, 0, skipCount, maxrecords);
}
/**
 * get CC utxos
 * @param {*} peers PeerGroup object with NspvPeers ext
 * @param {*} address to add cc inputs from
 * @param {*} skipCount number of utxos to skip 
 * @param {*} maxrecords max number of returned utxos, if 0 will return max records set by the server
 * @returns utxo list
 */
function getCCUtxos(peers, address, skipCount, maxrecords)
{
  typeforce('PeerGroup', peers);
  typeforce('String', address);
  typeforce('Number', skipCount);
  typeforce('Number', maxrecords);

  return getUtxos(peers, address, 1, skipCount, maxrecords);
}

/**
 * converts number encoded in hex into base64
 * @param {*} hexString to convert to base64
 * @returns base64 string
 */
function hex2Base64(hexString)
{
  return Buffer.from(hexString, 'hex').toString('base64');
}

function byte2Base64(uint8Eval)
{
  return Buffer.from([ uint8Eval ], 'hex').toString('base64');
}

/**
 * adds inputs into TransactionBuilder object from tx with inputs and array of previous txns in hex 
 * @param {*} txbuilder TransactionBuilder object
 * @param {*} tx tx where inputs reside
 * @param {*} prevTxnsHex array of input txns in hex
 * @returns added amount
 */
function addInputsFromPreviousTxns(txbuilder, tx, prevTxnsHex, network)
{
  typeforce('TransactionBuilder', txbuilder);
  typeforce('Transaction', tx);
  typeforce(typeforce.arrayOf('String'), prevTxnsHex);
  typeforce(types.Network, network);

  let bnAdded = new BN(0);
  for(let i = 0; i < tx.ins.length; i ++) {
    let prevTxHex = prevTxnsHex.find((txHex) => {
        return Transaction.fromHex(txHex, network).getHash().equals(tx.ins[i].hash);
    });
    if (prevTxHex !== undefined) {
      let prevTx = Transaction.fromBuffer(Buffer.from(prevTxHex, 'hex'), network);
      bnAdded.iadd(prevTx.outs[tx.ins[i].index].value);
      // 0xFFFFFFFE to allow time lock:
      txbuilder.addInput(prevTx, tx.ins[i].index, 0xFFFFFFFE, prevTx.outs[tx.ins[i].index].script);
    }
  }
  return bnAdded;
}

/**
 * makes komodo normal address from a pubkey
 * @param {*} pk pubkey to get komodod address from
 * @returns komodo normal address
 */
function pubkey2NormalAddressKmd(pk) {
  //return address.toBase58Check(crypto.hash160(pk), 0x3c);
  let _pk = (typeof pk == 'string') ? Buffer.from(pk, 'hex') : pk
  return address.toBase58Check(crypto.hash160(_pk), networks.KMD.pubKeyHash);
}

/**
 * Get transaction both in hex and decoded 
 * @param {*} peers PeerGroup obj
 * @param {*} mypk my pubkey
 * @param {*} txid 
 * @returns a promise object with to get the tx
 */
function getRawTransaction(peers, mypk, txid)
{
  typeforce('PeerGroup', peers);
  typeforce('Buffer', mypk);
  typeforce(types.Hash256bit, txid);

  return new Promise((resolve, reject) => {
    let txidhex;
    if (Buffer.isBuffer(txid)) {
      txidhex = hashToHex(txid);
    }
    else
      txidhex = txid;
    peers.nspvRemoteRpc("getrawtransaction", mypk, [txidhex, 1], {}, (err, res, peer) => {
      //console.log('err=', err, 'res=', res);
      if (!err) 
        resolve(res);
      else
        reject(err);
    });
  });
}

/**
 * Get many transactions (in hex)
 * @param {*} peers PeerGroup obj
 * @param {*} mypk my pubkey
 * @param {*} ...args
 * ...
 * @returns a promise to get the txns in hex
 */
function getTransactionsMany(peers, pubkey, ...args)
{
  typeforce('PeerGroup', peers);
  typeforce(typeforce.oneOf('Buffer', 'String'), pubkey);

  let pubkeybin = typeof pubkey == 'string' ? pubkey.toString('hex') : pubkey;

  let txids = [];
  for(let i = 0; i < args.length; i ++) {
    let txid = exports.castHashBin(args[i]);
    typeforce(types.Hash256bit, txid);
    txids.push(exports.hashToHex(txid));
  }

  return new Promise((resolve, reject) => {
    peers.nspvRemoteRpc("gettransactionsmany", pubkeybin, txids, {}, (err, res, peer) => {
      //console.log('err=', err, 'res=', res);
      if (!err) 
        resolve(res);
      else
        reject(err);
    });
  });
}

/**
 * Get many transactions decoded
 * @param {*} peers PeerGroup obj
 * @param {*} network
 * @param {*} mypk my pubkey
 * @param {*} ...args
 * ...
 * @returns a promise to get the txns in hex
 */
 async function getTransactionsManyDecoded(peers, network, mypk, args)
 {
  typeforce('PeerGroup', peers);
  typeforce(typeforce.oneOf('Buffer', 'String'), mypk);
  let pubkeybin = typeof mypk == 'string' ? mypk.toString('hex') : mypk;

   try {
    let decodedTxs = [];
    let inTransactionsIds = [];
    const txs = await getTransactionsMany(peers, pubkeybin, ...args);
    txs.transactions.forEach( tx => {
      const decoded = decodeTransactionData(tx.tx, tx.blockHeader, network)
      if (!decoded) {
        return;
      }
      decodedTxs.push(decoded);
      // Empty ids are for transactions which are VINS for mining transactions
      let txids = decoded.ins.filter(one => one.txid !== EMPTY_TXID ? one.txid : false)
      txids = txids.map(one => one.txid);
      if (txids.length > 0) {
        inTransactionsIds.push(txids)
      }
    })
    const parsedInTransactions = {}

    if (inTransactionsIds.length > 0) {
      inTransactionsIds = inTransactionsIds.flat();

      let inTransactionsFull;

      if (inTransactionsIds.length > MAX_TX_PER_REQUEST) {
        const promises = [];
        const chunks = splitArrayInChunks(inTransactionsIds, MAX_TX_PER_REQUEST);
        inTransactionsFull = await chunks.reduce(async (previousPromise, chunk, index) => {
          let transactions = await previousPromise;

          const tx = await new Promise((resolve) => setTimeout(() => {
            getTransactionsMany(peers, mypk, ...chunk).then((value) => resolve(value));
          }, 100 * index));

          return [...transactions, ...tx.transactions];
        }, Promise.resolve([]));
      } else {
        inTransactionsFull = await getTransactionsMany(peers, mypk, ...inTransactionsIds);
        inTransactionsFull = inTransactionsFull.transactions;
      }
      
      inTransactionsFull.forEach(tx => {
        const newTx = decodeTransactionData(tx.tx, tx.blockHeader, network)
        parsedInTransactions[newTx.txid] = newTx
      });
    }

    const requestedAddress = getAddress(mypk, network);

    decodedTxs = decodedTxs.map(tx => {
      const parsedTx = {
        ...tx,
        ins: tx.ins.map(txin => {
          return {
            ...txin,
            tx: parsedInTransactions[txin.txid]?.outs[txin.index]
          }
        })
      }
      if (isCcTransaction(parsedTx)) {
        return null;
      }
      const { recipients, senders, fees, value } = parseTransactionData(parsedTx, requestedAddress);
      return {
        recipients,
        senders,
        fees,
        value,
        ...parsedTx
      }
    });
    return decodedTxs.filter(a => a);
   } catch (e) {
    // logdebug(e)
    throw new Error(e);
  }
}

exports.nspvGetInfo = nspvGetInfo;
/**
 * calls getinfo from a nspv peer
 * @param {*} peers 
 * @param {*} reqHeight, if 0 current height returned
 * @returns 
 */
function nspvGetInfo(peers, reqHeight)
{
  typeforce('PeerGroup', peers);
  typeforce('Number', reqHeight);

  return new Promise((resolve, reject) => {
    peers.nspvGetInfo(reqHeight, {}, (err, res, peer) => {
    if (!err) 
        resolve(res);
    else
        reject(err);
    });
  });
}

exports.nspvBroadcast = nspvBroadcast;
/**
 * broadcast a tx
 * @param {*} peers 
 * @param {*} txid 
 * @param {*} txhex tx encoded as hex
 * @returns promise to get broadcast result
 */
function nspvBroadcast(peers, txid, txhex)
{
  typeforce('PeerGroup', peers);
  typeforce(typeforce.oneOf('String', 'Buffer'), txid);
  typeforce('String', txhex);

  return new Promise((resolve, reject) => {
    peers.nspvBroadcast(txid, txhex, {}, (err, res, peer) => {
    if (!err) 
        resolve(res);
    else
        reject(err);
    });
  });
}

exports.nspvGetHeaders = nspvGetHeaders;
/**
 * calls GetHeaders from a nspv peer
 * @param {*} peers 
 * @param {*} rloc starting header
 * @returns promise to get headers
 */
function nspvGetHeaders(peers, loc)
{
  typeforce('PeerGroup', peers);
  typeforce(typeforce.oneOf('String', 'Buffer'), loc);

  let locbin = exports.castHashBin(loc);
  return new Promise((resolve, reject) => {
    peers.getHeaders([locbin], {}, (err, res, peer) => {
    if (!err) 
        resolve(res);
    else
        reject(err);
    });
  });
}

exports.nspvGetSpentInfo = nspvGetSpentInfo;
/**
 * broadcast a tx
 * @param {*} peers 
 * @param {*} txid txid to get spent info
 * @param {*} vout vout of tx to get spent info
 * @returns promise to get spent info @see 
 */
function nspvGetSpentInfo(peers, txid, vout)
{
  typeforce('PeerGroup', peers);
  typeforce(typeforce.oneOf('String', 'Buffer'), txid);
  typeforce('Number', vout);

  return new Promise((resolve, reject) => {
    peers.nspvGetSpentInfo(txid, vout, {}, (err, res, peer) => {
    if (!err) 
        resolve(res);
    else
        reject(err);
    });
  });
}


/**
 * helper to test if object is empty
 * @param {*} obj 
 */
function isEmptyObject(obj) {
  for(var prop in obj) {
    if(obj.hasOwnProperty(prop)) {
      return false;
    }
  }
  return JSON.stringify(obj) === JSON.stringify({});
}

/**
 * Creates a pubkey from txid. The function tweaks last byte until the pubkey is valid. 
 * NOTE: Should be the same tweak algo as in the ccutils.cpp
 * @param {*} txid 
 */
function ccTxidPubkey_tweak(txid)
{
  if (typeforceNT(types.Hash256bit, txid))
  {
    let pkbuf = Buffer.allocUnsafe(33);
    pkbuf[0] = 0x02;
    txid.copy(pkbuf, 1);
    i = 256;
    while(i-- > 0) {
      if (ecc.isPoint(pkbuf))
        break;
      pkbuf[32] ++;
    }
    if (ecc.isPoint(pkbuf))
      return pkbuf;
  }
  return Buffer.from([]);
}

exports.isValidHash = isValidHash;
/**
 * valid txid means it is a buf of correct length and non empty
 * @param {*} txid 
 */
function isValidHash(hash)
{
  return typeforceNT(types.Hash256bit, hash);
  //if (Buffer.isBuffer(hash) && hash.length == 32 /*&& !hash.equals(Buffer.allocUnsafe(32).fill('\0'))*/)
  //  return true;
  //else
  //  return false;
}

//exports.isValidHashHex = isValidHashHex;
/**
 * valid txid means it is a string of correct length and has hex chars
 * @param {string} hash 
 */
/*function isValidHashHex(hash)
{
  if (typeof hash === 'string' && hash.length == 64 && hash.match(/[0-9a-f]/gi) /*&& (hash.match(/0/g) || '').length !== hash.length*//*)
    return true;
  else
    return false;
}*/

exports.isValidPubKey = isValidPubKey;
/**
 * buf of correct length and non-empty
 * @param {buffer} pubkey 
 */
function isValidPubKey(pubkey)
{
  if (Buffer.isBuffer(pubkey) && pubkey.length == 33 && !pubkey.equals(Buffer.allocUnsafe(33).fill('\0')))
    return true;
  else
    return false;
}
//exports.isValidPubKeyHex = isValidPubKeyHex;
/**
 * string of correct length and has hex chars and non empty
 * @param {string} pubkey 
 */
/*function isValidPubKeyHex(pubkey)
{
  if (typeof pubkey === 'string' && pubkey.length == 66 && txid.match(/[0-9a-f]/gi) && (txid.match(/0/g) || '').length !== txid.length)
    return true;
  else
    return false;
}*/

exports.hashToHex = hashToHex;
/**
 * converts txid as buffer into hex LE
 * @param {Buffer} buf 
 * @returns {string} hex string or empty string if txid is not valid
 */
function hashToHex(txid)
{
  if (typeforceNT(types.Hash256bit, txid))  {
    let reversed = Buffer.allocUnsafe(txid.length);
    txid.copy(reversed);
    reversed.reverse();
    return reversed.toString('hex');
  }
  return ''; //'0'.repeat(32*2);
}

exports.hashFromHex = hashFromHex;
/**
 * converts from hex into buffer reversing from LE
 * @param {string} hex 
 * @returns {Buffer} converted txid as Buffer or empty Buffer
 */
function hashFromHex(hex)
{
  if (typeof hex === 'string' && hex.length == 64 && hex.match(/[0-9a-f]/gi))  {
    let reversed = Buffer.from(hex, 'hex');
    reversed.reverse();
    return reversed;
  }
  return Buffer.from([]); //Buffer.allocUnsafe(32).fill('\0');
}

exports.hashReverse = hashReverse;
/**
 * reverse txid, this is used by cc modules to write txid in opreturn (for readability)
 * @param {string} txid 
 * @returns {Buffer} reversed txid as Buffer or empty Buffer
 */
function hashReverse(txid)
{
  if (txid.length > 0)  {
    let reversed = Buffer.allocUnsafe(txid.length);
    txid.copy(reversed);
    bufferutils.reverseBuffer(reversed);
    return reversed;
  }
  return Buffer.from([]);
}


// TODO lets change to string representation
exports.CoinsToBNSatoshi = function (val) {
  typeforce('Number', val)
  //if (types.Satoshi(val))
  //  throw new Error('value not a number');
  let coins = Math.trunc(val);
  let fract = ((val - coins) * 100000000) >>> 0;
  let r = new BN(coins);
  r.imul(new BN(100000000));
  r.iadd(new BN(fract));
  return r;
}

exports.castHashBin = function(_txid) {
  let txid = _txid;
  if (typeof _txid === 'string')
    txid = hashFromHex(_txid);
  if (!types.Hash256bit(txid)) {
    return null;
  }
  return txid;
}

/**
 * returns if scriptPubKey has OP_RETURN
 * @param {*} script 
 * @returns 
 */
exports.isOpReturnSpk = function(script)
{
  let chunks = bscript.decompile(script);
  if (Array.isArray(chunks) && chunks.length > 0) {
    if (chunks[0] == OPS.OP_RETURN) {
      if (chunks.length > 1)
        return chunks[1];
      else
        Buffer.from([]);
    }
  }
  return false;
}

exports.isError = function(o)
{
  return typeof(o) === 'object' && o.name === 'Error';
}

exports.isEmptyHash = function(hash)
{
  return !hash || Buffer.compare(Buffer.from([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), hash) == 0;
}
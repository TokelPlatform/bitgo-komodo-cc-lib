/**
 * cc utils to create cryptocondition tx in javascript
 * Note: max amount enforced in typeforce is SATOSHI_MAX == 21 * 1e14 
 * Also readUInt64 and typeforce(type.Satoshi) enforce yet another max 900719925474991 (0x001fffffffffffff) == 90 * 1e14. 
 * This is MAX_SAFE_INTEGER constant represents the maximum safe integer in JavaScript (2^53 - 1)
 */

const Transaction = require('../src/transaction');
//const TransactionBuilder = require('../src/transaction_builder');
const p2cryptoconditions = require('../src/payments/p2cryptoconditions');
//const ecpair = require('../src/ecpair');
//const ecc = require('tiny-secp256k1');
const ecc = require('secp256k1');
const crypto = require('../src/crypto');
const address = require('../src/address');
const bufferutils = require("../src/bufferutils");

const types = require('../src/types');
var typeforce = require('typeforce');
var typeforceNT = require('typeforce/nothrow');


exports.finalizeCCtx = finalizeCCtx;
exports.createTxAndAddNormalInputs = createTxAndAddNormalInputs;
exports.getNormalUtxos = getNormalUtxos;
exports.getCCUtxos = getCCUtxos;
exports.getUtxos = getUtxos;
exports.getTxids = getTxids;
exports.hex2Base64 = hex2Base64;
exports.byte2Base64 = byte2Base64;
exports.addInputsFromPreviousTxns = addInputsFromPreviousTxns;
exports.pubkey2NormalAddressKmd = pubkey2NormalAddressKmd;
exports.getRawTransaction = getRawTransaction;
exports.getTransactionsMany = getTransactionsMany;
exports.isEmptyObject = isEmptyObject;
exports.ccTxidPubkey_tweak = ccTxidPubkey_tweak;

exports.MYDUST = 100;

/**
 * sign c cc transaction, checks inputs and calls either standard signing function or cc signing function
 * @param {*} keyPairIn ecc key pair
 * @param {*} psbt psbt object
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
      //console.log('hash=', tx.ins[index].hash.toString('hex'), ' txId=', txid.toString('hex'));
      return txb.__TX.ins[index].hash.toString('hex') === txid.toString('hex');
    });
    if (unspent === undefined) 
      throw new Error('internal err: could not find tx unspent in addedUnspents');
    
    console.log('unspent.script=', Buffer.from(unspent.script).toString('hex'));*/
    //let keyPairIn = ecpair.fromWIF(wif, mynetwork);

    if (!p2cryptoconditions.isSpkPayToCryptocondition(txbuilder.inputs[index].prevOutScript))  {
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
        p2cryptoconditions.makeCCSpk(inputCond),  // pure spk should be here
        txbuilder.inputs[index].value,   // unspent.value,
        Transaction.SIGHASH_ALL,
      );    

      let signedCond = p2cryptoconditions.cryptoconditions.js_sign_secp256k1(inputCond, privateKey, signatureHash);
      let ccScriptSig = p2cryptoconditions.makeCCScriptSig(signedCond);

      //let ttt = p2cryptoconditions.makeCCSpk(signedCond);
      //console.log("signed spk=", ttt.toString('hex'));
      
      txbuilder.inputs[index].ccScriptSig = ccScriptSig;
      
      /*txbuilder.finalizeInput(index, (index, psbtInput) => {
        //if (psbtInput.finalScriptSig)
        //  psbtInput.finalScriptSig = undefined;  // 'un-finalize' psbt output. No need of this as we now recreating all inputs/outputs for each faucet get txpow try
        return { finalScriptSig: ccScriptSig };  // looks like a hack but to avoid extra psbt after-signing checks 
      });*/
      //console.log('signed cccond=', signedCond);
    }
  }
}

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
  let condbin = p2cryptoconditions.parseSpkCryptocondition(spk);
  if (condbin.length > 0 && condbin[0] == 'M'.charCodeAt(0)) {
    condbin = condbin.slice(1, condbin.length);
    isMixed = true;
  }

  return ccProbes.find(probe => {
    if (probe.cond === undefined)   
      throw new Error("FinalizeCCtx can't sign tx: invalid probe array");
    if (!isMixed) {
      let condbinp = p2cryptoconditions.ccConditionBinary(probe.cond);
      console.log('prev condbin=', condbin.toString('hex'), 'probe condbin=', condbinp.toString('hex'));
      return condbin.equals(condbinp);
    }
    else {
      let condbinv2p = p2cryptoconditions.ccConditionBinaryV2(probe.cond);
      console.log('prev condbin=', condbin.toString('hex'), 'probe condbinv2=', condbinv2p.toString('hex'));
      return condbin.equals(condbinv2p);
    }
  });
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
      if (!err)
        resolve(res);
      else
        reject(err);
    });
  });
}

/**
 * returns txos (tx outputs bith spent and unspent) for an address
 * @param {*} peers PeerGroup object with NspvPeers additions
 * @param {*} address address to get txids from
 * @param {*} isCC get txids with normal (isCC is 0) or cc (isCC is 1) utxos on this address
 * @param {*} skipCount number of txos to skip 
 * @param {*} maxrecords max number of returned txos, if 0 will return max records set by the server
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
 * create a tx and adds normal inputs for equal or more than the amount param 
 * @param {*} peers PeerGroup object with NspvPeers ext
 * @param {*} mypk pk to add normal inputs from
 * @param {*} amount that will be added (not less than)
 * @returns tx with added inputs along with the added transactions in hex
 */
function createTxAndAddNormalInputs(peers, mypk, amount)
{
  typeforce('PeerGroup', peers);
  typeforce('Buffer', mypk);
  typeforce(types.Satoshi, amount);

  return new Promise((resolve, reject) => {
    /*let request = `{
      "method": "createtxwithnormalinputs",
      "mypk": "${mypk}",
      "params": [
        "${amount}" 
      ]
    }`;*/

    peers.nspvRemoteRpc("createtxwithnormalinputs", mypk, amount, {}, (err, res, peer) => {
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
function getNormalUtxos(peers, address, skipCount, maxrecords)
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

  let added = 0;
  for(let i = 0; i < tx.ins.length; i ++) {
    let prevTxHex = prevTxnsHex.find((txHex) => {
        let r = Transaction.fromHex(txHex, network).getHash().equals(tx.ins[i].hash);
        // console.log('prevtx getHash()=', Transaction.fromHex(txHex, network).getHash().toString('hex'), 'tx.ins[i].hash=', tx.ins[i].hash.toString('hex'), 'equals=', r);
        return Transaction.fromHex(txHex, network).getHash().equals(tx.ins[i].hash);
    });
    if (prevTxHex !== undefined) {
      let prevTx = Transaction.fromBuffer(Buffer.from(prevTxHex, 'hex'), network);
      added += prevTx.outs[tx.ins[i].index].value;
      txbuilder.addInput(prevTx, tx.ins[i].index, tx.ins[i].sequence, prevTx.outs[tx.ins[i].index].script);
    }
  }
  return added;
}

/**
 * makes komodo normal address from a pubkey
 * @param {*} pk pubkey to get komodod address from
 * @returns komodo normal address
 */
function pubkey2NormalAddressKmd(pk) {
  return address.toBase58Check(crypto.hash160(pk), 0x3c);
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
      txidhex = txidToHex(txid);
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
function getTransactionsMany(peers, mypk, ...args)
{
  typeforce('PeerGroup', peers);
  typeforce('Buffer', mypk);

  let txids = [];
  for(let i = 0; i < args.length; i ++) {
    if (Buffer.isBuffer(args[i])) {
      txidhex = txidToHex(args[i]);
    }
    else
      txidhex = args[i];
    txids.push(txidhex);
  }

  return new Promise((resolve, reject) => {
    peers.nspvRemoteRpc("gettransactionsmany", mypk, txids, {}, (err, res, peer) => {
      //console.log('err=', err, 'res=', res);
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

exports.IsValidTxid = IsValidTxid;
/**
 * valid txid means it is a buf of correct length and non empty
 * @param {*} txid 
 */
function IsValidTxid(txid)
{
  return typeforceNT(types.Hash256bit, txid);
  //if (Buffer.isBuffer(txid) && txid.length == 32 /*&& !txid.equals(Buffer.allocUnsafe(32).fill('\0'))*/)
  //  return true;
  //else
  //  return false;
}

//exports.IsValidTxidHex = IsValidTxidHex;
/**
 * valid txid means it is a string of correct length and has hex chars
 * @param {string} txid 
 */
/*function IsValidTxidHex(txid)
{
  if (typeof txid === 'string' && txid.length == 64 && txid.match(/[0-9a-f]/gi) /*&& (txid.match(/0/g) || '').length !== txid.length*//*)
    return true;
  else
    return false;
}*/

exports.IsValidPubKey = IsValidPubKey;
/**
 * buf of correct length and non-empty
 * @param {buffer} pubkey 
 */
function IsValidPubKey(pubkey)
{
  if (Buffer.isBuffer(pubkey) && pubkey.length == 33 /*&& !pubkey.equals(Buffer.allocUnsafe(33).fill('\0'))*/)
    return true;
  else
    return false;
}
//exports.IsValidPubKeyHex = IsValidPubKeyHex;
/**
 * string of correct length and has hex chars and non empty
 * @param {string} pubkey 
 */
/*function IsValidPubKeyHex(pubkey)
{
  if (typeof pubkey === 'string' && pubkey.length == 66 && txid.match(/[0-9a-f]/gi) && (txid.match(/0/g) || '').length !== txid.length)
    return true;
  else
    return false;
}*/

exports.txidToHex = txidToHex;
/**
 * converts txid as buffer into hex LE
 * @param {Buffer} buf 
 * @returns {string} hex string or empty string if txid is not valid
 */
function txidToHex(txid)
{
  if (typeforceNT(types.Hash256bit, txid))  {
    let reversed = Buffer.allocUnsafe(txid.length);
    txid.copy(reversed);
    reversed.reverse();
    return reversed.toString('hex');
  }
  return ''; //'0'.repeat(32*2);
}

exports.txidFromHex = txidFromHex;
/**
 * converts from hex into buffer reversing from LE
 * @param {string} hex 
 * @returns {Buffer} converted txid as Buffer or empty Buffer
 */
function txidFromHex(hex)
{
  if (typeof hex === 'string' && hex.length == 64 && hex.match(/[0-9a-f]/gi))  {
    let reversed = Buffer.from(hex, 'hex');
    reversed.reverse();
    return reversed;
  }
  return Buffer.from([]); //Buffer.allocUnsafe(32).fill('\0');
}

exports.txidReverse = txidReverse;
/**
 * reverse txid, this is used by cc modules to write txid in opreturn (for readability)
 * @param {string} txid 
 * @returns {Buffer} reversed txid as Buffer or empty Buffer
 */
function txidReverse(txid)
{
  if (txid.length > 0)  {
    let reversed = Buffer.allocUnsafe(txid.length);
    txid.copy(reversed);
    bufferutils.reverseBuffer(reversed);
    return reversed;
  }
  return Buffer.from([]);
}

exports.toSatoshi = function (val) {
  if (typeof val !== 'number')
    throw new Error('amount not a number');
  return Math.round(val * 100000000);
}

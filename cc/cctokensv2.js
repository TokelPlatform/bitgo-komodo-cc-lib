'use strict';

const assert = require('assert');
const TransactionBuilder = require('../src/transaction_builder');
const Transaction = require('../src/transaction');
const OPS = require('bitcoin-ops');

const Debug = require('debug')
const logdebug = Debug('cctokens')

const bufferutils = require("../src/bufferutils");
const kmdmessages = require('../net/kmdmessages');
const ccutils = require('../cc/ccutils');
const networks = require('../src/networks');
const script = require("../src/script");
const ecpair = require('../src/ecpair');
const varuint = require('varuint-bitcoin');

const types = require('../src/types');
const typeforce = require('typeforce');
const typeforceNT = require('typeforce/nothrow');
const bscript = require("../src/script");
const address = require('../src/address');


// tokel data props ids:
const TKLPROP_ID = 1;
const TKLPROP_URL = 2;
const TKLPROP_ROYALTY = 3;
const TKLPROP_ARBITRARY = 4;

const TKLPROPNAME_URL = "url";
const TKLPROPNAME_ID = "id";
const TKLPROPNAME_ROYALTY = "royalty";
const TKLPROPNAME_ARBITRARY = "arbitrary";

const OPDROP_HAS_PKS_VER = 2;

const ccbasic = require('./ccbasic');
/* decided to init cryptoconditions at the user level */
let ccimp;
if (process.browser)
  ccimp = import('@tokel/cryptoconditions');
else
  ccimp = require('@tokel/cryptoconditions');

const tokensv2GlobalPk = "032fd27f72591b02f13a7f9701246eb0296b2be7cfdad32c520e594844ec3d4801"
const tokensv2GlobalPrivkey = Buffer.from([ 0xb5, 0xba, 0x92, 0x7f, 0x53, 0x45, 0x4f, 0xf8, 0xa4, 0xad, 0x0d, 0x38, 0x30, 0x4f, 0xd0, 0x97, 0xd1, 0xb7, 0x94, 0x1b, 0x1f, 0x52, 0xbd, 0xae, 0xa2, 0xe7, 0x49, 0x06, 0x2e, 0xd2, 0x2d, 0xa5 ])
const tokensv2GlobalAddress = "RSc4RycihBEWQP2GDvSYS46MvFJsTKaNVU"
const EVAL_TOKENSV2 = 0xF5

const assetsv2GlobalPk =  "0345d2e7ab018619da6ed58ccc0138c5f58a7b754bd8e9a1a9d2b811c5fe72d467";
const assetsv2GlobalPrivkey = Buffer.from([ 0x46, 0x58, 0x3b, 0x18, 0xee, 0x16, 0x63, 0x51, 0x6f, 0x60, 0x6e, 0x09, 0xdf, 0x9d, 0x27, 0xc8, 0xa7, 0xa2, 0x72, 0xa5, 0xd4, 0x6a, 0x9b, 0xcb, 0xd5, 0x4f, 0x7d, 0x1c, 0xb1, 0x2e, 0x63, 0x21 ]);
const assetsv2GlobalAddress = "RX99NCswvrLiM6vNE4zmpKKBWMZU9zqwAk";
const EVAL_ASSETSV2 = 0xF6;

const EVAL_TOKELDATA = 0xf7;

// nspv calls:

// tokenv2addccinputs nspv caller
function NspvAddTokensInputs(peers, tokenid, pk, amount)
{
  assert(peers);
  assert(ccutils.isValidPubKey(pk));
  assert(ccutils.isValidTxid(tokenid));

  return new Promise((resolve, reject) => {

    peers.nspvRemoteRpc("tokenv2addccinputs", pk, [ccutils.txidToHex(tokenid), pk.toString('hex'), amount.toString() ], {}, (err, res, peer) => {
      //console.log('err=', err, 'res=', res);
      if (!err) 
        resolve(res);
      else
        reject(err);
    });
  });
}

// tokenv2infotokel nspv caller
function NspvTokenV2InfoTokel(peers, pk, tokenid)
{
  assert(peers);
  assert(ccutils.isValidPubKey(pk));
  assert(ccutils.isValidTxid(tokenid));

  return new Promise((resolve, reject) => {

    peers.nspvRemoteRpc("tokenv2infotokel", pk, [ccutils.txidToHex(tokenid)], {}, (err, res, peer) => {
      //console.log('err=', err, 'res=', res);
      if (!err) 
        resolve(res);
      else
        reject(err);
    });
  });
}

// exported top level functions to be called from browser or desktop GUI
// param check and pass further:

/**
 * create token v2 transaction with tokel data.
 * The change is sent to the wif pubkey  
 * @param {*} peers initialised nspvPeerGroup object
 * @param {*} mynetwork a network from networks.js chain definitions
 * @param {*} wif wif to sign transaction inputs 
 * @param {*} name token name
 * @param {*} desc token description
 * @param {*} satoshi token amount to transfer (must be 1 for Tokel NFT)
 * @param {*} nftdata optional binary to add to token creation tx opreturn, in hex. First byte is the evalcode of additional validation cc or 0 if no validation 
 * @returns promise to create creation tx
 */
async function tokensv2Create(peers, mynetwork, wif, name, desc, satoshi, nftdatahex) {
  let nftdata;
  if (nftdatahex)
    nftdata = Buffer.from(nftdatahex, 'hex');
    let txpromise = makeTokensV2CreateTx(peers, mynetwork, wif, name, desc, satoshi, nftdata);

  return txpromise;
};

/**
 * create token v2 transaction with tokel data.
 * The change is sent to the wif pubkey  
 * @param {*} peers initialised nspvPeerGroup object
 * @param {*} mynetwork a network from networks.js chain definitions
 * @param {*} wif wif to sign transaction inputs 
 * @param {*} name token name
 * @param {*} desc token description
 * @param {*} satoshi token amount to transfer (must be 1 for Tokel NFT)
 * @param {*} jsondata tokel data as json with properties "url":string, "id":number, "royalty":number, "arbitrary":hex-string
 * @returns promise to create creation tx
 */
async function tokensv2CreateTokel(peers, mynetwork, wif, name, desc, satoshi, jsondata) {
  let nftdata;
  if (jsondata)
    nftdata = makeTokelData(jsondata);
  let txpromise = makeTokensV2CreateTx(peers, mynetwork, wif, name, desc, satoshi, nftdata);
  return txpromise;
};

/**
 * transfer token v2  
 * @param {*} peers initialised nspvPeerGroup object
 * @param {*} mynetwork a network from networks.js chain definitions
 * @param {*} wif 
 * @param {*} tokenidhex tokenid in hex to transfer
 * @param {*} destpk destination pubkey
 * @param {*} satoshi token amount to transfer (must be 1 for Tokel NFT)
 * @returns promise to create transfer tx
 */
async function tokensv2Transfer(peers, mynetwork, wif, tokenidhex, destpkhex, satoshi) {
  let tokenid = ccutils.txidFromHex(tokenidhex);
  let destpk = Buffer.from(destpkhex, 'hex');

  let txpromise = makeTokensV2TransferTx(peers, mynetwork, wif, tokenid, destpk, satoshi);
  return txpromise;
};

/**
 * returns info about token
 * @param {*} wif 
 * @param {*} tokenidhex 
 * @returns promise to return info
 */
async function tokensInfoV2Tokel(peers, mynetwork, wif, tokenidhex) {
  let mypair = ecpair.fromWIF(wif, mynetwork);
  let mypk = mypair.getPublicKeyBuffer();
  let tokenid = ccutils.txidFromHex(tokenidhex);
  return NspvTokenV2InfoTokel(peers, mypk, tokenid);;
};

// encode token OP_RETURN data
function makeTokensCreateV2Opreturn(origpk, name, desc, nftdata)
{
  let version = 1;

  let buffer = Buffer.allocUnsafe(1+1+1 + 
    varuint.encodingLength(origpk.length) + origpk.length + 
    varuint.encodingLength(name.length) + name.length + 
    varuint.encodingLength(desc.length) + desc.length + 
    (Buffer.isBuffer(nftdata) && nftdata.length > 0 ? varuint.encodingLength(nftdata.length) + nftdata.length : 0));
  let bufferWriter = new bufferutils.BufferWriter(buffer);

  bufferWriter.writeUInt8(EVAL_TOKENSV2);
  bufferWriter.writeUInt8('c'.charCodeAt(0));
  bufferWriter.writeUInt8(version);
  bufferWriter.writeVarSlice(origpk);
  bufferWriter.writeVarSlice(Buffer.from(name));
  bufferWriter.writeVarSlice(Buffer.from(desc));
  if (Buffer.isBuffer(nftdata) && nftdata.length > 0)
    bufferWriter.writeVarSlice(nftdata);

  return script.compile([OPS.OP_RETURN, buffer]);
}

// convert tokel data json to buffer
function makeTokelData(jsondata)
{
  let royalty;
  let id;
  let url;
  let arbitrary;

  if(jsondata[TKLPROPNAME_ROYALTY]) {
    if (!Number.isInteger(jsondata[TKLPROPNAME_ROYALTY]))
      throw new Error("invalid royalty: not an int")
    if (jsondata[TKLPROPNAME_ROYALTY] < 0 || jsondata[TKLPROPNAME_ROYALTY] > 999)
      throw new Error("invalid royalty value")
    royalty = jsondata[TKLPROPNAME_ROYALTY];
  }
  if(jsondata[TKLPROPNAME_ID]) {
    if (!Number.isInteger(jsondata[TKLPROPNAME_ID]))
      throw new Error("invalid id: not an int")
    id = jsondata[TKLPROPNAME_ID];
  }
  if(jsondata[TKLPROPNAME_URL]) {
    if (! jsondata[TKLPROPNAME_URL] instanceof String)
      throw new Error("invalid url: not a string")
    url = Buffer.from(jsondata[TKLPROPNAME_URL]);
  }
  if(jsondata[TKLPROPNAME_ARBITRARY]) {
    let re = /[0-9A-Fa-f]{6}/g;
    if (!jsondata[TKLPROPNAME_ARBITRARY] instanceof String || !re.test(jsondata[TKLPROPNAME_ARBITRARY]))
      throw new Error("invalid arbitrary: not a hex string")
    arbitrary = Buffer.from(jsondata[TKLPROPNAME_ARBITRARY], 'hex');
  }
  let buflen = 2;
  if (url)
    buflen += 1+varuint.encodingLength(url.length)+url.length;  // pro-pid-len+url.length
  if (id)
    buflen += 1+varuint.encodingLength(id);
  if (royalty)
    buflen += 1+varuint.encodingLength(royalty);
  if (arbitrary)
    buflen += 1+varuint.encodingLength(arbitrary.length)+arbitrary.length;

  if (buflen == 2)  // no data
    return [];

  let buffer = Buffer.allocUnsafe(buflen);
  let bufferWriter = new bufferutils.BufferWriter(buffer);

  bufferWriter.writeUInt8(EVAL_TOKELDATA); // tokel evalcode
  bufferWriter.writeUInt8(1);  // version
  if (id) {
    bufferWriter.writeUInt8(TKLPROP_ID);
    bufferWriter.writeVarInt(id);
  }
  if (url) {
    bufferWriter.writeUInt8(TKLPROP_URL);
    bufferWriter.writeVarSlice(url);
  }
  if (royalty) {
    bufferWriter.writeUInt8(TKLPROP_ROYALTY);
    bufferWriter.writeVarInt(royalty);
  }
  if (arbitrary) {
    bufferWriter.writeUInt8(TKLPROP_ARBITRARY);
    bufferWriter.writeVarSlice(arbitrary);
  }
  return buffer;
}

// encode token vdata to be added in OP_DROP
function makeTokensV2VData(tokenid, destpks)
{
  let destpks_len = 0;
  if (destpks)
    destpks_len = varuint.encodingLength(destpks.length) + destpks.length * (varuint.encodingLength(destpks[0].length) + destpks[0].length);
  let buffer = Buffer.allocUnsafe(1+1+1 + tokenid.length + destpks_len);
  let bufferWriter = new bufferutils.BufferWriter(buffer);
  let version = 1;
  let funcid = 't';

  bufferWriter.writeUInt8(EVAL_TOKENSV2);
  bufferWriter.writeUInt8(funcid.charCodeAt(0));
  bufferWriter.writeUInt8(version);
  bufferWriter.writeSlice(ccutils.txidReverse(tokenid));  // tokenid is stored in opreturn reversed, for readability (historically) 
  if (destpks && destpks.length > 0) {
    bufferWriter.writeUInt8(destpks.length);
    for (let i = 0; i < destpks.length; i ++) 
      bufferWriter.writeVarSlice(destpks[i]);
  }
  return buffer;
}

// make token creation tx
async function makeTokensV2CreateTx(peers, mynetwork, wif, name, desc, amount, nftdata)
{
  // init lib cryptoconditions
  //ccbasic.cryptoconditions = await ccimp;  // lets load it in the topmost call

  const txbuilder = new TransactionBuilder(mynetwork);
  const txfee = 10000;
  const markerfee = 10000;

  let mypair = ecpair.fromWIF(wif, mynetwork);
  let mypk = mypair.getPublicKeyBuffer();
  let mynormaladdress = ccutils.pubkey2NormalAddressKmd(mypk);
  let txwutxos = await ccutils.createTxAndAddNormalInputs(peers, mypair.getPublicKeyBuffer(), amount + txfee + markerfee);

  let tx = Transaction.fromBuffer(Buffer.from(txwutxos.txhex, 'hex'), mynetwork);

  // zcash stuff:
  txbuilder.setVersion(tx.version);
  if (txbuilder.tx.version >= 3)
    txbuilder.setVersionGroupId(tx.versionGroupId);

  // add vins to the created tx
  let added = ccutils.addInputsFromPreviousTxns(txbuilder, tx, txwutxos.previousTxns, mynetwork);
  if (added < amount + txfee)
    throw new Error("insufficient normal inputs (" + added + ")")

  // create tokens cc to my address
  /*let subfulfillments = [];
  let threshold = 2;
  subfulfillments.push({ type:	"eval-sha-256", code:	ccutils.byte2Base64(EVAL_TOKENSV2) });  
  /* no nft evalcode anymore:
  if (Buffer.isBuffer(nftdata) && nftdata.length > 0 && nftdata[0]) {
    subfulfillments.push({ type:	"eval-sha-256", code:	ccutils.byte2Base64(nftdata[0]) });  // add nft data evalcode to cond
    threshold ++;
  }*//*
  subfulfillments.push({            
    type:	"threshold-sha-256",
    threshold:	1,
    subfulfillments: [{ type:	"secp256k1-sha-256", publicKey:	mypk.toString('hex') }]
  });

  let mycond = {
    type:	"threshold-sha-256",
    threshold:	threshold,
    subfulfillments:	subfulfillments
  };*/
  let myccSpk = ccutils.makeCCSpkV2MofN(EVAL_TOKENSV2, [mypk], 1);
  if (myccSpk == null)  {
    throw new Error('could not create tokens cc spk');
  }

  // add search in chain marker
  /*let markercond = {
    type:	"threshold-sha-256",
    threshold:	2,
    subfulfillments:	[{
        type:	"eval-sha-256",   
        code:	ccutils.byte2Base64(EVAL_TOKENSV2)     
      }, {            
        type:	"threshold-sha-256",
        threshold:	1,
        subfulfillments:	[{  
                type:	"secp256k1-sha-256",
                publicKey:	tokensv2GlobalPk
        }]  
      }]   
    }; */
  let markerccSpk = ccutils.makeCCSpkV2MofN(EVAL_TOKENSV2, [Buffer.from(tokensv2GlobalPk, 'hex')], 1);
  if (markerccSpk == null)  {
    throw new Error('could not create tokens marker cc spk');
  }

  txbuilder.addOutput(markerccSpk, markerfee);
  txbuilder.addOutput(myccSpk, amount);

  if (added - amount - txfee - markerfee > ccutils.MYDUST)
    txbuilder.addOutput(mynormaladdress, added - amount - txfee - markerfee);  // change
  txbuilder.addOutput(makeTokensCreateV2Opreturn(mypk, name, desc, nftdata), 0); // make opreturn

  if (txbuilder.tx.version >= 4)
    txbuilder.setExpiryHeight(tx.expiryHeight);

  ccutils.finalizeCCtx(mypair, txbuilder);
  return txbuilder.build();
}

// sleep to insert delay between nspv calls to bypass the old nspv rate limiter
//function sleep(ms) {
//  return new Promise(resolve => setTimeout(resolve, ms));
//}

// make token transfer tx
async function makeTokensV2TransferTx(peers, mynetwork, wif, tokenid, _destpk, ccamount) 
{
  typeforce(typeforce.anyOf(types.Buffer, types.String), _destpk);

  // init lib cryptoconditions
  // ccbasic.cryptoconditions = await ccimp;  // maybe move this in start code? (but we dont bother a user with this)
  const txbuilder = new TransactionBuilder(mynetwork);
  const txfee = 10000;

  let mypair = ecpair.fromWIF(wif, mynetwork);
  let mypk = mypair.getPublicKeyBuffer();
  let mynormaladdress = ccutils.pubkey2NormalAddressKmd(mypk);

  let destpk = Buffer.isBuffer(_destpk) ? _destpk : Buffer.from(_destpk, 'hex');
  if (!ccutils.isValidPubKey(destpk))
    throw new Error("invalid destination pubkey");

  let txwutxos = await ccutils.createTxAndAddNormalInputs(peers, mypair.getPublicKeyBuffer(), txfee);
  let bearertx1 = Transaction.fromBuffer(Buffer.from(txwutxos.txhex, 'hex'), mynetwork);

  // set zcash stuff:
  txbuilder.setVersion(bearertx1.version);
  if (txbuilder.tx.version >= 3)
    txbuilder.setVersionGroupId(bearertx1.versionGroupId);

  // add vins to the created tx
  let added = ccutils.addInputsFromPreviousTxns(txbuilder, bearertx1, txwutxos.previousTxns, mynetwork);
  if (added < txfee)
    throw new Error("insufficient normal inputs (" + added + ")");

  //await sleep(1100); // to bypass old server rate limiter
  let ccutxos = await NspvAddTokensInputs(peers, tokenid, mypk, ccamount);
  let bearertx2 = Transaction.fromBuffer(Buffer.from(ccutxos.txhex, 'hex'), mynetwork);
  let ccadded = ccutils.addInputsFromPreviousTxns(txbuilder, bearertx2, ccutxos.previousTxns, mynetwork);
  if (ccadded < ccamount)
    throw new Error("insufficient token inputs (" + ccadded + ")");

  // create tokens cc to dest address
  /*let subfulfillments = [];
  let threshold = 2;
  subfulfillments.push({ type:	"eval-sha-256", code:	ccutils.byte2Base64(EVAL_TOKENSV2) });  
  /* we do not add nft evalcode anymore
  if (ccutxos.evalcodeNFT)  {
    subfulfillments.push({ type:	"eval-sha-256", code:	ccutils.byte2Base64(ccutxos.evalcodeNFT) });  // add nft data evalcode to cond
    threshold ++;
  }*//*
  subfulfillments.push({            
    type:	"threshold-sha-256",
    threshold:	1,
    subfulfillments: [{ type:	"secp256k1-sha-256", publicKey:	destpk.toString('hex') }]
  });

  let destcond = {
    type:	"threshold-sha-256",
    threshold:	threshold,
    subfulfillments:	subfulfillments   
  };*/

  let destccSpk = ccutils.makeCCSpkV2MofN(EVAL_TOKENSV2, [destpk], 1, ccbasic.makeOpDropData(EVAL_TOKENSV2, 1,1, [destpk], makeTokensV2VData(tokenid)));
  if (destccSpk == null)  
    throw new Error('could not create tokens cc spk for destination');
  
  txbuilder.addOutput(destccSpk, ccamount);
  
  // create tokens to my address for cc change and spending probe
  /*let mycond = {
    type:	"threshold-sha-256",
    threshold:	2,
    subfulfillments:	[{
          type:	"eval-sha-256",   
          code:	ccutils.byte2Base64(EVAL_TOKENSV2)     
      }, {            
          type:	"threshold-sha-256",
          threshold:	1,
          subfulfillments:	[{  
                  type:	"secp256k1-sha-256",
                  publicKey:	mypk.toString('hex')
          }]  
      }]   
    };*/

  if (ccadded - ccamount > 0)
  {
    let myccSpk = ccutils.makeCCSpkV2MofN(EVAL_TOKENSV2, [mypk], 1, ccbasic.makeOpDropData(EVAL_TOKENSV2, 1,1, [mypk], makeTokensV2VData(tokenid)));
    if (myccSpk == null)  
      throw new Error('could not create tokens cc spk for mypk');

    txbuilder.addOutput(myccSpk, ccadded-ccamount);
  }
  
  if (added - txfee > ccutils.MYDUST)
  {
    txbuilder.addOutput(mynormaladdress, added-txfee);  // normal change
  }

  if (txbuilder.tx.version >= 4)
    txbuilder.setExpiryHeight(bearertx1.expiryHeight);

  let probeCond = ccutils.makeCCCondMofN(EVAL_TOKENSV2, [mypk], 1);
  ccutils.finalizeCCtx(mypair, txbuilder, [{cond: probeCond}]);
  return txbuilder.build();
}

/**
 * Get many transactions (in hex)
 * @param {*} peers PeerGroup obj
 * @param {*} mypk my pubkey
 * @param {*} pubkey to get ccaddresses for. If not set mypk is used
 * ...
 * @returns a promise to get the txns in hex
 */
function tokenV2Address(peers, network, wif, pubkey)
{
  typeforce('PeerGroup', peers);
  typeforce('String', wif);

  const mypair = ecpair.fromWIF(wif, network);
  const mypk = mypair.getPublicKeyBuffer();

  let pubkeyhex;
  if (pubkey) {
    if (Buffer.isBuffer(pubkey))
      pubkeyhex = pubkey.toString('hex');
    else
      pubkeyhex = pubkey;
  }

  return new Promise((resolve, reject) => {
    peers.nspvRemoteRpc("tokenv2address", mypk, pubkeyhex, {}, (err, res, peer) => {
      if (!err) 
        resolve(res);
      else
        reject(err);
    });
  });
}

function decodeVerusCompatVData(vdata)  {
  
  try {

    let chunks = bscript.decompile(vdata);
    if (Array.isArray(chunks) && chunks.length > 0) {
      let bufferReader = new bufferutils.BufferReader(chunks[0]);
      let version = bufferReader.readUInt8();
      let evalcode = bufferReader.readUInt8();
      let M = bufferReader.readUInt8();
      let N = bufferReader.readUInt8();

      let pubkeys = [];
      let iAppdata = 1;
      if (version == OPDROP_HAS_PKS_VER) {
        if (chunks.length < 1 + M)
          throw new Error("invalid cc opdrop version 2 format: no pubkeys")
        for (let i = 0; i < M; i ++) {
          let pk = chunks[1 + i];
          pubkeys.push(pk);
        }
        iAppdata += M;
      }
      let appdata;
      if (chunks.length > iAppdata)
        appdata = chunks[iAppdata];
      let verusdata = { 
        evalcode, version, M, N
      };
      if (pubkeys)
        verusdata.pubkeys = pubkeys;
      if (appdata)
        verusdata.appdata = appdata;
      return verusdata;
    }
  } catch(err) {
    logdebug("decodeVerusCompatVData error:", err);
  }
  return undefined;
}

function decodeTokensV2VData(vdata)  {
  
  try {
    let bufferReader = new bufferutils.BufferReader(vdata);
    let evalcode = bufferReader.readUInt8();
    let funcid = Buffer.from([ bufferReader.readUInt8() ]).toString();
    let version = bufferReader.readUInt8();
     
    let tokendata = { 
      evalcode, funcid, version,
    };

    // note: no pubkeys for Tokens V2 (they are in opdrop)
    /*  let npks = bufferReader.readUInt8();
    let pubkeys = []
    for (let i = 0; i < npks; i ++) {
      pk = bufferReader.readVarSlice();
      pubkeys.push(pk);
    }  */

    if (funcid == 'c')  { 
      // parse as tokenv2create
      let origpk = bufferReader.readVarSlice();
      tokendata.origpk = origpk;
      let name = bufferReader.readVarSlice().toString();
      tokendata.name = name;
      let description = bufferReader.readVarSlice().toString();
      tokendata.description = description;
      let blobs = [];
      while(bufferReader.offset < bufferReader.buffer.length) {
        let blob = bufferReader.readVarSlice();
        blobs.push(blob);
      }
      if (blobs.length > 0) {
        tokendata.blobs = blobs;
        if (blobs.length > 0 && blobs[0].length > 0 && blobs[0][0] == EVAL_TOKELDATA) {
          // parse tokel data:
          let bufferReaderTokel = new bufferutils.BufferReader(blobs[0]);
          let evalcode = bufferReaderTokel.readUInt8();
          let version = bufferReaderTokel.readUInt8();
          let tokeldata = { evalcode, version };
          let propid;
          while (bufferReaderTokel.offset < bufferReaderTokel.buffer.length) {
            propid = bufferReaderTokel.readUInt8();
            if (propid == TKLPROP_ID) 
              tokeldata.id = bufferReaderTokel.readVarInt();
            else if (propid == TKLPROP_ROYALTY) 
              tokeldata.royalty = bufferReaderTokel.readVarInt();
            else if (propid == TKLPROP_URL) 
              tokeldata.url = Buffer.from(bufferReaderTokel.readVarSlice()).toString();
            else if (propid == TKLPROP_ARBITRARY) 
              tokeldata.arbitrary = bufferReaderTokel.readVarSlice();
            else 
              throw new Error("invalid tokel data format");
          }
          tokendata.tokeldata = tokeldata;
        }
      }
    }
    else if (funcid == 't') {
      // parse as tokenv2transfer
      let tokenid = ccutils.txidReverse(bufferReader.readSlice(32)); 
      tokendata.tokenid = tokenid;
      let blobs = [];
      while(bufferReader.offset < bufferReader.buffer.length) {
        let blob = bufferReader.readVarSlice();
        blobs.push(blob);
      }
      if (blobs.length > 0)
        tokendata.blobs = blobs;
    }
    else {
      throw new Error("invalid token funcid");
    }
    return tokendata;
  } catch(err) {
    logdebug("decodeTokensV2VData error:", err);
  }
  return undefined;
}

function isOpReturnSpk(script)
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

/**
 * Validates if a transaction output is a valid token
 * @param {*} tx a token transaction object of Transaction type
 * @param {*} nvout output order number
 * @returnsan object with token properties or false
 */
function isTokenV2Output(tx, nvout)
{
  if (nvout >= 0 && nvout < tx.outs.length) {
    let parsedSpk = ccbasic.parseCCSpk(tx.outs[nvout].script);
    if (!parsedSpk.cc) {
      logdebug("isTokenV2Output error: not a cc output");
      return false;
    }
    let verusData;
    let vdata;
    if (parsedSpk.opdrop) {
      verusData = decodeVerusCompatVData(parsedSpk.opdrop);
      if (verusData && verusData.appdata)
        vdata = verusData.appdata;   // data in opdrop is the first priority
    }
    if (!vdata) 
      vdata = isOpReturnSpk(tx.outs[tx.outs.length-1].script); // opreturn is the second priority
    if (!vdata) {
      logdebug("isTokenV2Output error: no token data in opreturn or opdrop");
      return false;
    }
    
    let tokenData = decodeTokensV2VData(vdata);
    if (!tokenData) {
      logdebug("isTokenV2Output error: invalid token data");
      return false;
    }
    if (!tokenData.evalcode == EVAL_TOKENSV2)  {
      logdebug("isTokenV2Output error: not the token v2 evalcode");
      return false;
    }
    if (tokenData.funcid == 't' && !typeforceNT(types.Hash256bit, tokenData.tokenid)) {
      logdebug("isTokenV2Output error: invalid tokenid in tx data");
      return false;
    }
    if (tokenData.funcid == 'c' && !ccutils.isValidPubKey(tokenData.origpk)) {
      logdebug("isTokenV2Output error: invalid token originator pubkey in tx data");
      return false;
    }
    return verusData ? Object.assign(verusData, tokenData) : tokenData;
  }
}

/**
 * Loads transactions from ccoutputs objects and validates if they are valid tokens
 * @param {*} mynetwork 
 * @param {*} peers 
 * @param {*} mypk 
 * @param {*} ccutxos - the 'utxos' nested array from the getCCUtxos() result ('result.utxos')
 * @returns ccutxosOut array extended with 'tokenid' property if it is a valid token
 */
async function validateTokensV2Many(mynetwork, peers, mypk, ccutxos)
{
  if (Array.isArray(ccutxos)) {
    let params = [ peers, mypk ];
    ccutxos.forEach(output => {
      params.push(output.txid);
    });

    let ccutxosOut = [];
    let returnedtxns = await ccutils.getTransactionsMany(...params); // maybe simply put txids in array?
    if (returnedtxns && Array.isArray(returnedtxns.transactions)) {
      returnedtxns.transactions.forEach(e => {
        let tx = Transaction.fromHex(e.tx, mynetwork);
        let txid = tx.getHash();
        if (txid) {
          let out = ccutxos.find((out)=>{ return Buffer.compare(out.txid, txid) == 0; }); 
          if (out) {
            let newout = Object.assign([], out);
            let tokendata = isTokenV2Output(tx, out.vout);
            if (tokendata) 
              newout.tokendata = tokendata;
            ccutxosOut.push(newout);
          }
        }
      });
    }
    return ccutxosOut;
  }
  return null;
}

/**
 * Returns validated tokens for the given pubkey
 */
async function getTokensForPubkey(mynetwork, peers, mypk, skipCount, maxrecords) {
  ccbasic.cryptoconditions = await ccimp;
  let ccindexkey = address.fromOutputScript(ccutils.makeCCSpkV2MofN(EVAL_TOKENSV2, [mypk.toString('hex')], 1 ), mynetwork)
  const ccutxos = await ccutils.getCCUtxos(peers, ccindexkey, skipCount, maxrecords);
  if (ccutxos.utxos.length > 0) {
    const validated = await validateTokensV2Many(mynetwork, peers, mypk, ccutxos.utxos);
    return validated;
  }
  return [];
}


module.exports = {
  tokensInfoV2Tokel, tokensv2Create, tokensv2CreateTokel, tokensv2Transfer, tokenV2Address,
  isTokenV2Output, validateTokensV2Many, getTokensForPubkey,
  tokensv2GlobalPk, tokensv2GlobalPrivkey, tokensv2GlobalAddress, EVAL_TOKENSV2,
  assetsv2GlobalPk, assetsv2GlobalPrivkey, assetsv2GlobalAddress, EVAL_ASSETSV2
}

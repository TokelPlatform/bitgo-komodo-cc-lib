'use strict';

const assert = require('assert');
const TransactionBuilder = require('../src/transaction_builder');
const Transaction = require('../src/transaction');
const OPS = require('bitcoin-ops');

const bufferutils = require("../src/bufferutils");
const kmdmessages = require('../net/kmdmessages');
const ccutils = require('../cc/ccutils');
const networks = require('../src/networks');
const tokensv2 = require('../cc/cctokenstokelv2');
const script = require("../src/script");
const ecpair = require('../src/ecpair');
const varuint = require('varuint-bitcoin');

//const types = require('../src/types');
var typeforce = require('typeforce');
//var typeforceNT = require('typeforce/nothrow');

// create peer group
const NspvPeerGroup = require('../net/nspvPeerGroup');
// require('../net/nspvPeer');  // init peer.js too

// tokel data props ids:
const TKLPROP_ID = 1;
const TKLPROP_URL = 2;
const TKLPROP_ROYALTY = 3;
const TKLPROP_ARBITRARY = 4;

const TKLNAME_URL = "url";
const TKLNAME_ID = "id";
const TKLNAME_ROYALTY = "royalty";
const TKLNAME_ARBITRARY = "arbitrary";

// you will need to do a call like:
// p2cryptoconditions.cryptoconditions = await ccimp;
// to init the cryptoconditions wasm lib before cc usage
// (this is due to wasm delayed loading specifics)
const p2cryptoconditions = require('../src/payments/p2cryptoconditions');
const ccimp = import('@tokel/cryptoconditions');   
const tokensv2GlobalPk = "032fd27f72591b02f13a7f9701246eb0296b2be7cfdad32c520e594844ec3d4801"
const tokensv2GlobalPrivkey = Buffer.from([ 0xb5, 0xba, 0x92, 0x7f, 0x53, 0x45, 0x4f, 0xf8, 0xa4, 0xad, 0x0d, 0x38, 0x30, 0x4f, 0xd0, 0x97, 0xd1, 0xb7, 0x94, 0x1b, 0x1f, 0x52, 0xbd, 0xae, 0xa2, 0xe7, 0x49, 0x06, 0x2e, 0xd2, 0x2d, 0xa5 ])
const tokensv2GlobalAddress = "RSc4RycihBEWQP2GDvSYS46MvFJsTKaNVU"
const EVAL_TOKENSV2 = 0xF5

const assetsv2GlobalPk =  "0345d2e7ab018619da6ed58ccc0138c5f58a7b754bd8e9a1a9d2b811c5fe72d467";
const assetsv2GlobalPrivkey = Buffer.from([ 0x46, 0x58, 0x3b, 0x18, 0xee, 0x16, 0x63, 0x51, 0x6f, 0x60, 0x6e, 0x09, 0xdf, 0x9d, 0x27, 0xc8, 0xa7, 0xa2, 0x72, 0xa5, 0xd4, 0x6a, 0x9b, 0xcb, 0xd5, 0x4f, 0x7d, 0x1c, 0xb1, 0x2e, 0x63, 0x21 ]);
const assetsv2GlobalAddress = "RX99NCswvrLiM6vNE4zmpKKBWMZU9zqwAk";
const EVAL_ASSETSV2 = 0xF6;

// nspv calls:

// tokenv2addccinputs nspv caller
function NspvAddTokensInputs(peers, tokenid, pk, amount)
{
  assert(peers);
  assert(ccutils.IsValidPubKey(pk));
  assert(ccutils.IsValidTxid(tokenid));

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
  assert(ccutils.IsValidPubKey(pk));
  assert(ccutils.IsValidTxid(tokenid));

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

// connect to peers, for calling from browser
function Connect()
{
  peers = new NspvPeerGroup(params, opts);
  peers.on('peer', (peer) => {
    //console.log('in event: connected to peer', peer.socket.remoteAddress)
  });

  return new Promise((resolve, reject) => {

    peers.on('connectError', (err, peer)=>{ reject(err, peer) });
    peers.on('peerError', (err)=>reject(err));
    peers.on('error', (err)=>reject(err));

    peers.connect(() => {
      console.log('in promise: connected to peer!!!');
      resolve();
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
async function Tokensv2Create(peers, mynetwork, wif, name, desc, satoshi, nftdatahex) {
  let nftdata;
  if (nftdatahex)
    nftdata = Buffer.from(nftdatahex, 'hex');
    let txpromise = makeTokensCreateTx(peers, mynetwork, wif, name, desc, satoshi, nftdata);

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
async function Tokensv2CreateTokel(peers, mynetwork, wif, name, desc, satoshi, jsondata) {
  let nftdata;
  if (jsondata)
    nftdata = makeTokelData(jsondata);
  let txpromise = makeTokensV2CreateTokelTx(peers, mynetwork, wif, name, desc, satoshi, nftdata);
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
async function Tokensv2Transfer(peers, mynetwork, wif, tokenidhex, destpkhex, satoshi) {
  let tokenid = ccutils.txidFromHex(tokenidhex);
  let destpk = Buffer.from(destpkhex, 'hex');

  let txpromise = makeTokensTransferV2Tx(peers, mynetwork, wif, tokenid, destpk, satoshi);
  return txpromise;
};

/**
 * returns info about token
 * @param {*} wif 
 * @param {*} tokenidhex 
 * @returns promise to return info
 */
async function TokenInfoV2Tokel(wif, tokenidhex) {
  let mypair = ecpair.fromWIF(wif, mynetwork);
  let mypk = mypair.getPublicKeyBuffer();
  let tokenid = ccutils.txidFromHex(tokenidhex);
  let promiseinfo = NspvTokenV2InfoTokel(peers, mypk, tokenid);
  return promiseinfo;
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

  if(jsondata[TKLNAME_ROYALTY]) {
    if (!Number.isInteger(jsondata[TKLNAME_ROYALTY]))
      throw new Error("invalid royalty: not an int")
    if (jsondata[TKLNAME_ROYALTY] < 0 || jsondata[TKLNAME_ROYALTY] > 999)
      throw new Error("invalid royalty value")
    royalty = jsondata[TKLNAME_ROYALTY];
  }
  if(jsondata[TKLNAME_ID]) {
    if (!Number.isInteger(jsondata[TKLNAME_ID]))
      throw new Error("invalid id: not an int")
    id = jsondata[TKLNAME_ID];
  }
  if(jsondata[TKLNAME_URL]) {
    if (! jsondata[TKLNAME_URL] instanceof String)
      throw new Error("invalid url: not a string")
    url = Buffer.from(jsondata[TKLNAME_URL]);
  }
  if(jsondata[TKLNAME_ARBITRARY]) {
    let re = /[0-9A-Fa-f]{6}/g;
    if (!jsondata[TKLNAME_ARBITRARY] instanceof String || !re.test(jsondata[TKLNAME_ARBITRARY]))
      throw new Error("invalid arbitrary: not a hex string")
    arbitrary = Buffer.from(jsondata[TKLNAME_ARBITRARY], 'hex');
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

  bufferWriter.writeUInt8(0xf7); // tokel evalcode
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
async function makeTokensV2CreateTokelTx(peers, mynetwork, wif, name, desc, amount, nftdata)
{
  // init lib cryptoconditions
  p2cryptoconditions.cryptoconditions = await ccimp;

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
  let subfulfillments = [];
  let threshold = 2;
  subfulfillments.push({ type:	"eval-sha-256", code:	ccutils.byte2Base64(EVAL_TOKENSV2) });  
  /* no nft evalcode anymore:
  if (Buffer.isBuffer(nftdata) && nftdata.length > 0 && nftdata[0]) {
    subfulfillments.push({ type:	"eval-sha-256", code:	ccutils.byte2Base64(nftdata[0]) });  // add nft data evalcode to cond
    threshold ++;
  }*/
  subfulfillments.push({            
    type:	"threshold-sha-256",
    threshold:	1,
    subfulfillments: [{ type:	"secp256k1-sha-256", publicKey:	mypk.toString('hex') }]
  });

  let mycond = {
    type:	"threshold-sha-256",
    threshold:	threshold,
    subfulfillments:	subfulfillments
  };
  let myccSpk = p2cryptoconditions.makeCCSpkV2(mycond);
  if (myccSpk == null)  {
    throw new Error('could not create tokens cc spk');
  }

  // add search in chain marker
  let markercond = {
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
    };
  let markerccSpk = p2cryptoconditions.makeCCSpkV2(markercond);
  if (markerccSpk == null)  {
    throw new Error('could not create tokens marker cc spk');
  }

  txbuilder.addOutput(markerccSpk, markerfee);
  txbuilder.addOutput(myccSpk, amount);
  txbuilder.addOutput(mynormaladdress, added - amount - txfee - markerfee);  // change
  txbuilder.addOutput(makeTokensCreateV2Opreturn(mypk, name, desc, nftdata), 0); // make opreturn

  if (txbuilder.tx.version >= 4)
    txbuilder.setExpiryHeight(tx.expiryHeight);

  ccutils.finalizeCCtx(mypair, txbuilder);
  return txbuilder.build();
}

// sleep to insert delay between nspv calls to bypass the old nspv rate limiter
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// make token transfer tx
async function makeTokensTransferV2Tx(peers, mynetwork, wif, tokenid, destpk, ccamount) 
{
  // init lib cryptoconditions
  p2cryptoconditions.cryptoconditions = await ccimp;  // maybe move this in start code? (but we dont bother a user with this)
  const txbuilder = new TransactionBuilder(mynetwork);
  const txfee = 10000;

  let mypair = ecpair.fromWIF(wif, mynetwork);
  let mypk = mypair.getPublicKeyBuffer();
  let mynormaladdress = ccutils.pubkey2NormalAddressKmd(mypk);

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

  await sleep(1100); // to bypass old server rate limiter
  let ccutxos = await NspvAddTokensInputs(peers, tokenid, mypk, ccamount);
  let bearertx2 = Transaction.fromBuffer(Buffer.from(ccutxos.txhex, 'hex'), mynetwork);
  let ccadded = ccutils.addInputsFromPreviousTxns(txbuilder, bearertx2, ccutxos.previousTxns, mynetwork);
  if (ccadded < ccamount)
    throw new Error("insufficient token inputs (" + ccadded + ")");

  // create tokens cc to dest address
  let subfulfillments = [];
  let threshold = 2;
  subfulfillments.push({ type:	"eval-sha-256", code:	ccutils.byte2Base64(EVAL_TOKENSV2) });  
  /* we do not add nft evalcode anymore
  if (ccutxos.evalcodeNFT)  {
    subfulfillments.push({ type:	"eval-sha-256", code:	ccutils.byte2Base64(ccutxos.evalcodeNFT) });  // add nft data evalcode to cond
    threshold ++;
  }*/
  subfulfillments.push({            
    type:	"threshold-sha-256",
    threshold:	1,
    subfulfillments: [{ type:	"secp256k1-sha-256", publicKey:	destpk.toString('hex') }]
  });

  let destcond = {
    type:	"threshold-sha-256",
    threshold:	threshold,
    subfulfillments:	subfulfillments   
  };

  let destccSpk = p2cryptoconditions.makeCCSpkV2(destcond, p2cryptoconditions.makeOpDropData(EVAL_TOKENSV2, 1,1, [destpk], makeTokensV2VData(tokenid)));
  if (destccSpk == null)  
    throw new Error('could not create tokens cc spk for destination');
  
  txbuilder.addOutput(destccSpk, ccamount);
  
  // create tokens to my address for cc change and spending probe
  let mycond = {
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
    };

  if (ccadded - ccamount > 0)
  {
    let myccSpk = p2cryptoconditions.makeCCSpkV2(mycond, p2cryptoconditions.makeOpDropData(EVAL_TOKENSV2, 1,1, [], makeTokensV2VData(tokenid, [mypk])));
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

  ccutils.finalizeCCtx(mypair, txbuilder, [{cond: mycond}]);
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
function TokenV2Address(peers, network, wif, pubkey)
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

module.exports = {
  Connect, 
  TokenInfoV2Tokel, Tokensv2Create, Tokensv2CreateTokel, Tokensv2Transfer, TokenV2Address,
  tokensv2GlobalPk, tokensv2GlobalPrivkey, tokensv2GlobalAddress, EVAL_TOKENSV2,
  assetsv2GlobalPk, assetsv2GlobalPrivkey, assetsv2GlobalAddress, EVAL_ASSETSV2
}

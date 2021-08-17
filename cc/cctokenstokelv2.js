'use strict';

const TransactionBuilder = require('../src/transaction_builder');
const Transaction = require('../src/transaction');
const ECPair = require('../src/ecpair');
const OPS = require('bitcoin-ops');

const bufferutils = require("../src/bufferutils");
const script = require("../src/script");
const kmdmessages = require('../net/kmdmessages');
const ccutils = require('./ccutils');
const ecpair = require('../src/ecpair');
const varuint = require('varuint-bitcoin');

const config = require('../config')

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
// to init the cryptoconditions wasm lib
// (this is due to wasm delayed loading specifics)
const p2cryptoconditions = require('../src/payments/p2cryptoconditions');
const { varint } = require('bitcoin-protocol');
var ccimp;
if (process.browser)
  ccimp = import('cryptoconditions-js/pkg/cryptoconditions.js');   // in browser, use 'wasm-pack build' (no any --target). Don't forget run browerify!
else
  ccimp = require('cryptoconditions-js/pkg/cryptoconditions.js');  // in nodejs, use 'wasm-pack build -t nodejs'


// tokens v2 global privkey/pubkey:
const EVAL_TOKENSV2 = 0xF5;
const EVAL_ASSETSV2 = 0xF6;

/**
 *
 * @param {*} peers
 * @param {*} tokenid
 * @param {*} pk
 * @param {*} amount
 * @returns
 */
function AddTokensInputs(peers, tokenid, pk, amount)
{
  return new Promise((resolve, reject) => {

    peers.nspvRemoteRpc("tokenv2addccinputs", pk, [tokenid.toString('hex'), pk.toString('hex'), amount.toString() ], {}, (err, res, peer) => {
      //console.log('err=', err, 'res=', res);
      if (!err)
        resolve(res);
      else
        reject(err);
    });
  });
}

// exported top level functions to be called from browser
// param check and pass further:

exports.cctokens_create_v2_tokel = cctokens_create_v2_tokel;
/**
 *
 * @param {*} _wif
 * @param {*} _name
 * @param {*} _desc
 * @param {*} _satoshi
 * @param {*} _jsondata
 * @returns
 */
async function cctokens_create_v2_tokel(peers, mynetwork, _wif, _name, _desc, _satoshi, _jsondata) {
  let wif = _wif;
  let name = _name;
  let desc = _desc;
  let satoshi  = _satoshi;
  let nftdata;
  if (_jsondata)
    nftdata = makeTokelData(_jsondata);
    let tx = await makeTokensV2CreateTokelTx(peers, mynetwork, wif, name, desc, satoshi, nftdata);

  return tx.toHex();
};

exports.cctokens_transfer_v2 = cctokens_transfer_v2;
/**
 *
 * @param {*} _wif
 * @param {*} _tokenid
 * @param {*} _destpk
 * @param {*} _satoshi
 * @returns
 */
async function cctokens_transfer_v2(peers, mynetwork, _wif, _tokenid, _destpk, _satoshi) {
  let wif = _wif;
  let tokenid = Buffer.from(_tokenid, 'hex');
  let destpk = Buffer.from(_destpk, 'hex');
  let satoshi  = _satoshi;

  let tx = await makeTokensTransferV2Tx(mynetwork, wif, tokenid, destpk, satoshi);
  //return this.broadcast(tx.toHex());
  return tx.toHex();
};

// encode token OP_RETURN data
/**
 *
 * @param {*} origpk
 * @param {*} name
 * @param {*} desc
 * @param {*} nftdata
 * @returns
 */
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

/**
 *
 * @param {*} jsondata
 * @returns
 */
// convert tokel data json to buffer
function makeTokelData(jsondata)
{
  let chunks = [];
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
/**
 *
 * @param {*} tokenid
 * @param {*} destpks
 * @returns
 */
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
  bufferWriter.writeSlice(tokenid);  // no need to reverse as it is byte array not uint256
  if (destpks && destpks.length > 0) {
    bufferWriter.writeUInt8(destpks.length);
    for (let i = 0; i < destpks.length; i ++)
      bufferWriter.writeVarSlice(destpks[i]);
  }
  return buffer;
}


/**
 *
 * @param {*} wif
 * @param {*} name
 * @param {*} desc
 * @param {*} amount
 * @param {*} nftdata
 * @returns
 */
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

  // create search marker
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
                publicKey:	config.tokensv2GlobalPk
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

/**
 *
 * @param {*} wif
 * @param {*} tokenid
 * @param {*} destpk
 * @param {*} ccamount
 * @returns
 */
async function makeTokensTransferV2Tx(peers, mynetwork, wif, tokenid, destpk, ccamount)
{
  // init lib cryptoconditions
  p2cryptoconditions.cryptoconditions = await ccimp;
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

  let ccutxos = await AddTokensInputs(peers, tokenid, mypk, ccamount);
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

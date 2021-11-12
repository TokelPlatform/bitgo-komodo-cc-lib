'use strict';

const assert = require('assert');
const TransactionBuilder = require('../src/transaction_builder');
const Transaction = require('../src/transaction');
const OPS = require('bitcoin-ops');

const Debug = require('debug')
const logdebug = Debug('cctokens')

const bufferutils = require("../src/bufferutils");
const kmdmessages = require('../net/kmdmessages');
const ccbasic = require('./ccbasic');
const ccutils = require('./ccutils');
const cctokens = require('./cctokensv2');
const networks = require('../src/networks');
const script = require("../src/script");
const crypto = require('../src/crypto');
const ecpair = require('../src/ecpair');
const varuint = require('varuint-bitcoin');
const address = require('../src/address');

const types = require('../src/types');
const typeforce = require('typeforce');
const typeforceNT = require('typeforce/nothrow');
const bscript = require("../src/script");


const assetsv2GlobalPk = "0345d2e7ab018619da6ed58ccc0138c5f58a7b754bd8e9a1a9d2b811c5fe72d467";
const assetsv2GlobalPrivkey = Buffer.from([0x46, 0x58, 0x3b, 0x18, 0xee, 0x16, 0x63, 0x51, 0x6f, 0x60, 0x6e, 0x09, 0xdf, 0x9d, 0x27, 0xc8, 0xa7, 0xa2, 0x72, 0xa5, 0xd4, 0x6a, 0x9b, 0xcb, 0xd5, 0x4f, 0x7d, 0x1c, 0xb1, 0x2e, 0x63, 0x21]);
const assetsv2GlobalAddress = "CeKqrjLjD5WgBETbSeLaJJc1NDKHTdLwUf";
const EVAL_ASSETSV2 = 0xF6;

const TKLROYALTY_DIVISOR = 1000;
const ASSETS_NORMAL_DUST = 500;

function encodeAssetsV2Data(funcid, unitPrice, origpk, expiryHeight)
{
  let bufLen = 1+1+1;
  if (unitPrice !== undefined)
    bufLen += 8;
  if (origpk !== undefined)
    bufLen += varuint.encodingLength(origpk.length) + origpk.length;
  if (expiryHeight !== undefined)
    bufLen += 4;

  let buffer = Buffer.allocUnsafe(bufLen);
  let bufferWriter = new bufferutils.BufferWriter(buffer);
  let version = 1;

  bufferWriter.writeUInt8(EVAL_ASSETSV2);
  bufferWriter.writeUInt8(funcid.charCodeAt(0));
  bufferWriter.writeUInt8(version);
  if (unitPrice !== undefined)
    bufferWriter.writeUInt64(unitPrice);
  if (origpk !== undefined)
    bufferWriter.writeVarSlice(origpk);
  if (expiryHeight !== undefined)
    bufferWriter.writeInt32(expiryHeight);
  return buffer;
}

function decodeAssetsV2Data(script)
{
  let bufferReader = new bufferutils.BufferReader(script);
  let evalcode = bufferReader.readUInt8();
  let funcid = Buffer.from([ bufferReader.readUInt8() ]).toString();
  let version = bufferReader.readUInt8();
   
  let unitPrice = bufferReader.readUInt64();
  let origpk = bufferReader.readVarSlice();
  let expiryHeight = bufferReader.readInt32();

  return { evalcode, funcid, version, unitPrice, origpk, expiryHeight };
}

function decodeTokensAssetsV2OpReturn(spk)
{
  let vdata = ccutils.isOpReturnSpk(spk);
  let tokenData = cctokens.decodeTokensV2Data(vdata);
  if (tokenData && tokenData.blobs && Array.isArray(tokenData.blobs) && tokenData.blobs.length > 0)  {
    let assetData = decodeAssetsV2Data(tokenData.blobs[0]);
    tokenData.assetData = assetData;
  }
  return tokenData;
}

/**
 * create assets v2 ask tx
 * @param {*} peers nspvPeerGroup object
 * @param {*} mynetwork a network from networks.js chain params
 * @param {*} wif wif to sign transaction inputs 
 * @param {*} units number of tokens to ask
 * @param {*} tokenid tokenid as hex or bin form
 * @param {*} price price of one token unit in coins
 * @param {*} expiryHeight block height after which this ask expires
 * @returns promise to create tx
 */
async function tokenv2ask(peers, mynetwork, wif, units, tokenid, price, expiryHeight) {

	let _tokenid = ccutils.castHashBin(tokenid);
  let _expiryHeight = expiryHeight || 0;
  let priceSat = ccutils.toSatoshi(price);
	return makeTokenV2AskTx(peers, mynetwork, wif, units, _tokenid, priceSat, _expiryHeight);
}

/**
 * create assets v2 bid tx
 * @param {*} peers nspvPeerGroup object
 * @param {*} mynetwork a network from networks.js chain params
 * @param {*} wif wif to sign transaction inputs 
 * @param {*} units number of tokens to bid
 * @param {*} tokenid tokenid as hex or bin form
 * @param {*} price price of one token unit in coins
 * @param {*} expiryHeight block height after which this bid expires
 * @returns promise to create tx
 */
 async function tokenv2bid(peers, mynetwork, wif, units, tokenid, price, expiryHeight) {

	let _tokenid = ccutils.castHashBin(tokenid);
  let _expiryHeight = expiryHeight || 0;
  let priceSat = ccutils.toSatoshi(price);
	return makeTokenV2BidTx(peers, mynetwork, wif, units, _tokenid, priceSat, _expiryHeight);
}

/**
 * create assets v2 fill ask tx
 * @param {*} peers nspvPeerGroup object
 * @param {*} mynetwork a network from networks.js chain params
 * @param {*} wif wif to sign transaction inputs 
 * @param {*} units number of tokens to ask
 * @param {*} tokenid tokenid as hex or bin form
 * @param {*} price (optional) suggested unit price in coins
 * @returns promise to create tx
 */
 async function tokenv2fillask(peers, mynetwork, wif, tokenid, askid, units, price) {

	let _tokenid = ccutils.castHashBin(tokenid);
	let _askid = ccutils.castHashBin(askid);
  let priceSat = price !== undefined ? ccutils.toSatoshi(price) : undefined;
	return makeTokenV2FillAskTx(peers, mynetwork, wif, _tokenid, _askid, units, priceSat);
}

/**
 * create assets v2 fill bid tx
 * @param {*} peers nspvPeerGroup object
 * @param {*} mynetwork a network from networks.js chain params
 * @param {*} wif wif to sign transaction inputs 
 * @param {*} tokenid tokenid as hex or bin form
 * @param {*} askid id of ask tx to spend
 * @param {*} units number of tokens to ask
 * @param {*} price (optional) suggested unit price in coins
 * @returns promise to create tx
 */
 async function tokenv2fillbid(peers, mynetwork, wif, tokenid, bidid, units, price) {

	let _tokenid = ccutils.castHashBin(tokenid);
	let _bidid = ccutils.castHashBin(bidid);
  let priceSat = price !== undefined ? ccutils.toSatoshi(price) : undefined;
	return makeTokenV2FillBidTx(peers, mynetwork, wif, _tokenid, _bidid, units, priceSat);
}

/**
 * create assets v2 cancel ask tx
 * @param {*} peers nspvPeerGroup object
 * @param {*} mynetwork a network from networks.js chain params
 * @param {*} wif wif to sign transaction inputs 
 * @param {*} tokenid tokenid as hex or bin form
 * @param {*} askid id of ask tx to spend
 * @returns promise to create tx
 */
 async function tokenv2cancelask(peers, mynetwork, wif, tokenid, askid) {

	let _tokenid = ccutils.castHashBin(tokenid);
	let _askid = ccutils.castHashBin(askid);
	return makeTokenV2CancelAskTx(peers, mynetwork, wif, _tokenid, _askid);
}

/**
 * create assets v2 cancel bid tx
 * @param {*} peers nspvPeerGroup object
 * @param {*} mynetwork a network from networks.js chain params
 * @param {*} wif wif to sign transaction inputs 
 * @param {*} tokenid tokenid as hex or bin form
 * @param {*} bidid id of bid tx to spend
 * @returns promise to create tx
 */
 async function tokenv2cancelbid(peers, mynetwork, wif, tokenid, bidid) {

	let _tokenid = ccutils.castHashBin(tokenid);
	let _bidid = ccutils.castHashBin(bidid);
	return makeTokenV2CancelBidTx(peers, mynetwork, wif, _tokenid, _bidid);
}

// make ask tx
async function makeTokenV2AskTx(peers, mynetwork, wif, units, tokenid, unitPrice, orderExpiryHeight)
{
  // init lib cryptoconditions
  //ccbasic.cryptoconditions = await ccimp;  // lets load it in the topmost call

  const txbuilder = new TransactionBuilder(mynetwork);
  const txfee = 10000;
  const markerfee = 10000;
  const normalAmount = txfee + markerfee;
  if (!units)
    throw new Error("invalid amount or tokens number params");
  if (unitPrice <= 0)
    throw new Error("invalid amount or tokens number params");

  const assetsGlobalPk = Buffer.from(assetsv2GlobalPk, 'hex');
  let mypair = ecpair.fromWIF(wif, mynetwork);
  let mypk = mypair.getPublicKeyBuffer();
  let mynormaladdress = ccutils.pubkey2NormalAddressKmd(mypk);
  let txwutxos = await ccutils.createTxAndAddNormalInputs(peers, mypk, normalAmount);
  let sourcetx1 = Transaction.fromBuffer(Buffer.from(txwutxos.txhex, 'hex'), mynetwork);

  // zcash stuff:
  txbuilder.setVersion(sourcetx1.version);
  if (txbuilder.tx.version >= 3)
    txbuilder.setVersionGroupId(sourcetx1.versionGroupId);

  // add vins to the created tx
  let added = ccutils.addInputsFromPreviousTxns(txbuilder, sourcetx1, txwutxos.previousTxns, mynetwork);
  if (added < normalAmount)
    throw new Error("insufficient normal inputs (" + added + ")")

  let ccutxos = await cctokens.nspvAddTokensInputs(peers, tokenid, mypk, units); // TODO promise all
  let sourcetx2 = Transaction.fromBuffer(Buffer.from(ccutxos.txhex, 'hex'), mynetwork);
  let ccadded = ccutils.addInputsFromPreviousTxns(txbuilder, sourcetx2, ccutxos.previousTxns, mynetwork);
  if (ccadded < units)
    throw new Error("insufficient token inputs (" + ccadded + ")");

  if (!orderExpiryHeight) {
    let getinfo = await ccutils.nspvGetInfo(peers, 0);
    orderExpiryHeight = getinfo.height + 4 * 7 * 24 * 60;
  }

  let globalccSpk = ccutils.makeCCSpkV2MofN([cctokens.EVAL_TOKENSV2, EVAL_ASSETSV2], [assetsGlobalPk], 1);
  txbuilder.addOutput(globalccSpk, units);    // deposit tokens on global assets pk

  let markerccSpk = ccutils.makeCCSpkV2MofN(EVAL_ASSETSV2, [mypk, assetsGlobalPk], 1);
  txbuilder.addOutput(markerccSpk, markerfee);  // 1of2 marker for mytokenorders

  if (ccadded - units > 0)
  {
    let myccSpk = ccutils.makeCCSpkV2MofN(cctokens.EVAL_TOKENSV2, [mypk], 1, ccbasic.makeOpDropData(cctokens.EVAL_TOKENSV2, 1,1, [mypk], cctokens.encodeTokensV2Data(tokenid)));
    txbuilder.addOutput(myccSpk, ccadded - units); // token change to self
  }

  if (added - normalAmount > ccutils.MYDUST)
    txbuilder.addOutput(mynormaladdress, added - normalAmount);  // change

  txbuilder.addOutput(cctokens.encodeTokensV2OpReturn(tokenid, 
                                encodeAssetsV2Data('s', unitPrice, mypk, orderExpiryHeight)), 0); // make opreturn

  if (txbuilder.tx.version >= 4)
    txbuilder.setExpiryHeight(sourcetx1.expiryHeight);

  let probeCond = ccutils.makeCCCondMofN([cctokens.EVAL_TOKENSV2], [mypk], 1);
  ccutils.finalizeCCtx(mypair, txbuilder, [{cond: probeCond}]);
  return txbuilder.build();
}

// make bid tx
async function makeTokenV2BidTx(peers, mynetwork, wif, units, tokenid, unitPrice, orderExpiryHeight)
{
  // init lib cryptoconditions
  //ccbasic.cryptoconditions = await ccimp;  // lets load it in the topmost call

  const txbuilder = new TransactionBuilder(mynetwork);
  const txfee = 10000;
  const markerfee = 10000;
  if (!units)
    throw new Error("invalid amount or tokens number params");
  if (unitPrice <= 0)
    throw new Error("invalid amount or tokens number params");
  const bidAmount = units * unitPrice;
  const normalAmount = txfee + bidAmount + markerfee;

  const assetsGlobalPk = Buffer.from(assetsv2GlobalPk, 'hex');
  let mypair = ecpair.fromWIF(wif, mynetwork);
  let mypk = mypair.getPublicKeyBuffer();
  let mynormaladdress = ccutils.pubkey2NormalAddressKmd(mypk);
  let txwutxos = await ccutils.createTxAndAddNormalInputs(peers, mypk, normalAmount);

  let sourcetx = Transaction.fromBuffer(Buffer.from(txwutxos.txhex, 'hex'), mynetwork);

  // zcash stuff:
  txbuilder.setVersion(sourcetx.version);
  if (txbuilder.tx.version >= 3)
    txbuilder.setVersionGroupId(sourcetx.versionGroupId);

  // add vins to the created tx
  let added = ccutils.addInputsFromPreviousTxns(txbuilder, sourcetx, txwutxos.previousTxns, mynetwork);
  if (added < normalAmount)
    throw new Error("insufficient normal inputs (" + added + ")")

  if (!orderExpiryHeight) {
    let getinfo = await ccutils.nspvGetInfo(peers, 0);
    orderExpiryHeight = getinfo.height + 4 * 7 * 24 * 60;
  }

  let globalccSpk = ccutils.makeCCSpkV2MofN(EVAL_ASSETSV2, [assetsGlobalPk], 1);
  txbuilder.addOutput(globalccSpk, bidAmount);

  let markerccSpk = ccutils.makeCCSpkV2MofN(EVAL_ASSETSV2, [mypk, assetsGlobalPk], 1);
  txbuilder.addOutput(markerccSpk, markerfee);

  if (added - normalAmount > ccutils.MYDUST)
    txbuilder.addOutput(mynormaladdress, added - normalAmount);  // change

  txbuilder.addOutput(cctokens.encodeTokensV2OpReturn(tokenid,
                                encodeAssetsV2Data('b', unitPrice, mypk, orderExpiryHeight)), 0); // make opreturn

  if (txbuilder.tx.version >= 4)
    txbuilder.setExpiryHeight(sourcetx.expiryHeight);

  ccutils.finalizeCCtx(mypair, txbuilder);
  return txbuilder.build();
}

// make fill ask tx
async function makeTokenV2FillAskTx(peers, mynetwork, wif, tokenid, askid, fillUnits, _unitPrice)
{
  let mypair = ecpair.fromWIF(wif, mynetwork);
  let mypk = mypair.getPublicKeyBuffer();
  let mynormaladdress = ccutils.pubkey2NormalAddressKmd(mypk);

  let txns = await ccutils.getTransactionsMany(peers, mypk, tokenid, askid);
  if (!txns || !Array.isArray(txns.transactions) || txns.transactions.length != 2)
    throw new Error("could not load token or ask tx");
  let tokenbasetx = Transaction.fromHex(txns.transactions[0].tx, mynetwork);
  let asktx = Transaction.fromHex(txns.transactions[1].tx, mynetwork);
  if (tokenbasetx.outs.length < 2)
    throw new Error("invalid tokenid (bad token tx)");
  if (asktx.outs.length < 2)
    throw new Error("invalid ask tx (structure)");
    
  let tokenData = cctokens.decodeTokensV2OpReturn(tokenbasetx.outs[tokenbasetx.outs.length-1].script);
  let askData = decodeTokensAssetsV2OpReturn(asktx.outs[asktx.outs.length-1].script);

  if (!tokenData || !tokenData.origpk)
    throw new Error("invalid tokenid (no token data)");
  if (!askData || !askData.assetData || askData.assetData.unitPrice === undefined)
    throw new Error("invalid ask tx (no assets data)");

  let unitPrice = _unitPrice || askData.assetData.unitPrice;
  if (unitPrice <= 0)
    throw new Error("invalid unit price");

  const askVout = 0;
  const askTokens = asktx.outs[askVout].value;
  const royaltyFract = tokenData.tokeldata && tokenData.tokeldata.royalty ? tokenData.tokeldata.royalty : 0;
  let royaltyValue = royaltyFract > 0 ? paidAmount / TKLROYALTY_DIVISOR * royaltyFract : 0;
  if (royaltyFract > 0 && paidAmount - royaltyValue <= ASSETS_NORMAL_DUST / royaltyFract * TKLROYALTY_DIVISOR - ASSETS_NORMAL_DUST)  // if value paid to seller less than when the royalty is minimum
      royaltyValue = 0;

  const txbuilder = new TransactionBuilder(mynetwork);
  const txfee = 10000;
  const markerfee = 10000;
  const paidAmount = unitPrice * fillUnits;
  const normalAmount = txfee + paidAmount + (askTokens - fillUnits > 0 ? markerfee : 0);
  const assetsGlobalPk = Buffer.from(assetsv2GlobalPk, 'hex');

  let txwutxos = await ccutils.createTxAndAddNormalInputs(peers, mypk, normalAmount);
  let sourcetx1 = Transaction.fromBuffer(Buffer.from(txwutxos.txhex, 'hex'), mynetwork);

  // zcash stuff:
  txbuilder.setVersion(sourcetx1.version);
  if (txbuilder.tx.version >= 3)
    txbuilder.setVersionGroupId(sourcetx1.versionGroupId);

  // add vins to the created tx
  let added = ccutils.addInputsFromPreviousTxns(txbuilder, sourcetx1, txwutxos.previousTxns, mynetwork);
  if (added < normalAmount)
    throw new Error("insufficient normal inputs (" + added + ")")

  txbuilder.addInput(asktx, askVout);

  
/*
 // vout.0 tokens remainder to unspendable cc addr:
 mtx.vout.push_back(T::MakeTokensCC1vout(A::EvalCode(), orig_assetoshis - fillunits, GetUnspendable(cpAssets, NULL)));  // token remainder on cc global addr

 //vout.1 purchased tokens to self token single-eval or dual-eval token+nonfungible cc addr:
 mtx.vout.push_back(T::MakeTokensCC1vout(T::EvalCode(), fillunits, mypk));					
 mtx.vout.push_back(CTxOut(paid_nValue - royaltyValue, CScript() << origpubkey << OP_CHECKSIG));		//vout.2 coins to ask originator's normal addr
 if (royaltyValue > 0)    {   // note it makes the vout even if roaltyValue is 0
     mtx.vout.push_back(CTxOut(royaltyValue, CScript() << ownerpubkey << OP_CHECKSIG));	// vout.3 royalty to token owner
     LOGSTREAMFN(ccassets_log, CCLOG_DEBUG1, stream << "royaltyFract=" << royaltyFract << " royaltyValue=" << royaltyValue << " paid_nValue - royaltyValue=" << paid_nValue - royaltyValue << std::endl);
 }

 if (orig_assetoshis - fillunits > 0) // we dont need the marker if order is filled
     mtx.vout.push_back(T::MakeCC1of2vout(A::EvalCode(), ASSETS_MARKER_AMOUNT, origpubkey, GetUnspendable(cpAssets, NULL)));    //vout.3(4 if royalty) marker to origpubkey (for my tokenorders?)
*/
  
  let globalccSpk = ccutils.makeCCSpkV2MofN([cctokens.EVAL_TOKENSV2, EVAL_ASSETSV2], [assetsGlobalPk], 1);
  txbuilder.addOutput(globalccSpk, askTokens - fillUnits);    // send remaining tokens on global assets pk

  let myccSpk = ccutils.makeCCSpkV2MofN(cctokens.EVAL_TOKENSV2, [mypk], 1, ccbasic.makeOpDropData(cctokens.EVAL_TOKENSV2, 1,1, [mypk], cctokens.encodeTokensV2Data(tokenid)));
  txbuilder.addOutput(myccSpk, fillUnits);  // purchased tokens

  let askCreatorAddress = ccutils.pubkey2NormalAddressKmd(askData.assetData.origpk);
  txbuilder.addOutput(askCreatorAddress, paidAmount - royaltyValue);  // coins to ask creator

  if (royaltyValue > 0)  {
    let tokenCreatorAddress = ccutils.pubkey2NormalAddressKmd(tokenData.origpk);
    txbuilder.addOutput(tokenCreatorAddress, royaltyValue);  // royalty to token creator
  }

  if (askTokens - fillUnits > 0)  {
    let markerccSpk = ccutils.makeCCSpkV2MofN(EVAL_ASSETSV2, [mypk, assetsGlobalPk], 1);
    txbuilder.addOutput(markerccSpk, markerfee);  // 1of2 marker for mytokenorders
  }

  if (added - normalAmount > ccutils.MYDUST)
    txbuilder.addOutput(mynormaladdress, added - normalAmount);  // change

  txbuilder.addOutput(cctokens.encodeTokensV2OpReturn(tokenid,
                                encodeAssetsV2Data('S', askData.assetData.unitPrice, askData.assetData.origpk, askData.assetData.expiryHeight)), 0); // make opreturn

  if (txbuilder.tx.version >= 4)
    txbuilder.setExpiryHeight(sourcetx1.expiryHeight);

  let probeGlobal = ccutils.makeCCCondMofN([cctokens.EVAL_TOKENSV2, EVAL_ASSETSV2], [assetsGlobalPk], 1);  // probe to spend coins from assets GlobalPubKey
  let probeMarker = ccutils.makeCCCondMofN(EVAL_ASSETSV2, [mypk, assetsGlobalPk], 1);  // probe to spend from 1of2 marker
  ccutils.finalizeCCtx(mypair, txbuilder, [{cond: probeGlobal, privateKey: assetsv2GlobalPrivkey}, {cond: probeMarker, privateKey: mypair.getPrivateKeyBuffer()}]);
  return txbuilder.build();
}

// make fill bid tx
async function makeTokenV2FillBidTx(peers, mynetwork, wif, tokenid, bidid, fillUnits, _unitPrice)
{
  let mypair = ecpair.fromWIF(wif, mynetwork);
  let mypk = mypair.getPublicKeyBuffer();
  let mynormaladdress = ccutils.pubkey2NormalAddressKmd(mypk);

  let txns = await ccutils.getTransactionsMany(peers, mypk, tokenid, bidid);
  if (!txns || !Array.isArray(txns.transactions) || txns.transactions.length != 2)
    throw new Error("could not load token or bid tx");
  let tokenbasetx = Transaction.fromHex(txns.transactions[0].tx, mynetwork);
  let bidtx = Transaction.fromHex(txns.transactions[1].tx, mynetwork);
  if (tokenbasetx.outs.length < 2)
    throw new Error("invalid tokenid (bad token tx)");
  if (bidtx.outs.length < 2)
    throw new Error("invalid bid tx (structure)");
    
  let tokenData = cctokens.decodeTokensV2OpReturn(tokenbasetx.outs[tokenbasetx.outs.length-1].script);
  let bidData = decodeTokensAssetsV2OpReturn(bidtx.outs[bidtx.outs.length-1].script);

  if (!tokenData || !tokenData.origpk)
    throw new Error("invalid tokenid (no token data)");
  if (!bidData || !bidData.assetData || bidData.assetData.unitPrice === undefined)
    throw new Error("invalid bid tx (no assets data)");

  // _unitPrice is the token price user wishes to pay
  // bidData.assetData.unitPrice is bidder's token price

  let unitPrice = _unitPrice || bidData.assetData.unitPrice;
  if (unitPrice <= 0)
    throw new Error("invalid unit price");

  const bidVout = 0;
  const bidAmount = bidtx.outs[bidVout].value;
  const bidTokens = (bidAmount / bidData.assetData.unitPrice) >>> 0;   // current bid's tokens quantity
  const paidAmount = unitPrice * fillUnits;
  const royaltyFract = tokenData.tokeldata && tokenData.tokeldata.royalty ? tokenData.tokeldata.royalty : 0;
  let royaltyValue = royaltyFract > 0 ? paidAmount / TKLROYALTY_DIVISOR * royaltyFract : 0;
  if (royaltyValue <= ASSETS_NORMAL_DUST) // check for dust
      royaltyValue = 0;

  const txbuilder = new TransactionBuilder(mynetwork);
  const txfee = 10000;
  const markerfee = 10000;
  const normalAmount = txfee + paidAmount + (bidTokens - fillUnits > 0 ? markerfee : 0);

  const assetsGlobalPk = Buffer.from(assetsv2GlobalPk, 'hex');

  let txwutxos = await ccutils.createTxAndAddNormalInputs(peers, mypk, normalAmount);
  let sourcetx1 = Transaction.fromBuffer(Buffer.from(txwutxos.txhex, 'hex'), mynetwork);

  // zcash stuff:
  txbuilder.setVersion(sourcetx1.version);
  if (txbuilder.tx.version >= 3)
    txbuilder.setVersionGroupId(sourcetx1.versionGroupId);

  // add vins to the created tx
  let added = ccutils.addInputsFromPreviousTxns(txbuilder, sourcetx1, txwutxos.previousTxns, mynetwork);
  if (added < normalAmount)
    throw new Error("insufficient normal inputs (" + added + ")")

  txbuilder.addInput(bidtx, bidVout);
  
  let ccutxos = await cctokens.nspvAddTokensInputs(peers, tokenid, mypk, fillUnits);
  let sourcetx2 = Transaction.fromBuffer(Buffer.from(ccutxos.txhex, 'hex'), mynetwork);
  let ccadded = ccutils.addInputsFromPreviousTxns(txbuilder, sourcetx2, ccutxos.previousTxns, mynetwork);
  if (ccadded < fillUnits)
    throw new Error("insufficient token inputs (" + ccadded + ")");

  
/*
if (orig_units - fill_units > 0 || bid_amount - paid_amount <= ASSETS_NORMAL_DUST) { // bidder has coins for more tokens or only dust is sent back to global address
    mtx.vout.push_back(T::MakeCC1vout(A::EvalCode(), bid_amount - paid_amount, unspendableAssetsPk));     // vout0 coins remainder or the dust is sent back to cc global addr
    if (bid_amount - paid_amount <= ASSETS_NORMAL_DUST)
        LOGSTREAMFN(ccassets_log, CCLOG_DEBUG1, stream << "dust detected (bid_amount - paid_amount)=" << (bid_amount - paid_amount) << std::endl);
}
else
    mtx.vout.push_back(CTxOut(bid_amount - paid_amount, CScript() << ParseHex(HexStr(origpubkey)) << OP_CHECKSIG));     // vout0 if no more tokens to buy, send the remainder to originator
mtx.vout.push_back(CTxOut(paid_amount - royaltyValue, CScript() << ParseHex(HexStr(mypk)) << OP_CHECKSIG));	// vout1 coins to mypk normal 
if (royaltyValue > 0)   { // note it makes vout even if roaltyValue is 0
    mtx.vout.push_back(CTxOut(royaltyValue, CScript() << ParseHex(HexStr(ownerpubkey)) << OP_CHECKSIG));  // vout2 trade royalty to token owner
    LOGSTREAMFN(ccassets_log, CCLOG_DEBUG1, stream << "royaltyFract=" << royaltyFract << " royaltyValue=" << royaltyValue << " paid_amount - royaltyValue=" << paid_amount - royaltyValue << std::endl);
}
mtx.vout.push_back(T::MakeTokensCC1vout(T::EvalCode(), fill_units, pubkey2pk(origpubkey)));	  // vout2(3) single-eval tokens sent to the originator
if (orig_units - fill_units > 0)  // order is not finished yet
    mtx.vout.push_back(T::MakeCC1of2vout(A::EvalCode(), ASSETS_MARKER_AMOUNT, origpubkey, unspendableAssetsPk));                    // vout3(4 if royalty) marker to origpubkey

if (tokensChange != 0LL)
    mtx.vout.push_back(T::MakeTokensCC1vout(T::EvalCode(), tokensChange, mypk));  // change in single-eval tokens
*/

  if (bidTokens - fillUnits > 0 || bidAmount - paidAmount <= ASSETS_NORMAL_DUST) {
    let globalccSpk = ccutils.makeCCSpkV2MofN(EVAL_ASSETSV2, [assetsGlobalPk], 1);
    txbuilder.addOutput(globalccSpk, bidAmount - paidAmount);    // send coin remainder on global assets pk
  }
  else {
    let bidCreatorAddress = ccutils.pubkey2NormalAddressKmd(bidData.assetData.origpk);
    txbuilder.addOutput(bidCreatorAddress, bidAmount - paidAmount);  // if no tokens remaining or dust then send back to bidder
  }
  
  txbuilder.addOutput(mynormaladdress, paidAmount - royaltyValue);  // purchased coins for tokens
  if (royaltyValue > 0)  {
    let tokenCreatorAddress = ccutils.pubkey2NormalAddressKmd(tokenData.origpk);
    txbuilder.addOutput(tokenCreatorAddress, royaltyValue);  // royalty to token creator
  }

  let bidderCCSpk = ccutils.makeCCSpkV2MofN(cctokens.EVAL_TOKENSV2, [bidData.assetData.origpk], 1, ccbasic.makeOpDropData(cctokens.EVAL_TOKENSV2, 1,1, [bidData.assetData.origpk], cctokens.encodeTokensV2Data(tokenid)));
  txbuilder.addOutput(bidderCCSpk, fillUnits);  // tokens to bidder

  if (bidTokens - fillUnits > 0)  {
    let markerccSpk = ccutils.makeCCSpkV2MofN(EVAL_ASSETSV2, [mypk, assetsGlobalPk], 1);
    txbuilder.addOutput(markerccSpk, markerfee);  // 1of2 marker for mytokenorders
  }

  if (ccadded - fillUnits > 0)
  {
    let myccSpk = ccutils.makeCCSpkV2MofN(cctokens.EVAL_TOKENSV2, [mypk], 1, ccbasic.makeOpDropData(cctokens.EVAL_TOKENSV2, 1,1, [mypk], cctokens.encodeTokensV2Data(tokenid)));
    txbuilder.addOutput(myccSpk, ccadded - fillUnits); // token change to self
  }

  if (added - normalAmount > ccutils.MYDUST)
    txbuilder.addOutput(mynormaladdress, added - normalAmount);  // change

  txbuilder.addOutput(cctokens.encodeTokensV2OpReturn(tokenid, 
                                encodeAssetsV2Data('B', bidData.assetData.unitPrice, bidData.assetData.origpk, bidData.assetData.expiryHeight)), 0); // make opreturn

  if (txbuilder.tx.version >= 4)
    txbuilder.setExpiryHeight(sourcetx1.expiryHeight);

  let probeMy = ccutils.makeCCCondMofN([cctokens.EVAL_TOKENSV2], [mypk], 1);
  let probeGlobal = ccutils.makeCCCondMofN([EVAL_ASSETSV2], [assetsGlobalPk], 1);  // probe to spend coins from assets GlobalPubKey
  let probeMarker = ccutils.makeCCCondMofN(EVAL_ASSETSV2, [mypk, assetsGlobalPk], 1);  // probe to spend from 1of2 marker
  ccutils.finalizeCCtx(mypair, txbuilder, [{cond: probeMy}, {cond: probeGlobal, privateKey: assetsv2GlobalPrivkey}, {cond: probeMarker, privateKey: mypair.getPrivateKeyBuffer()}]);
  return txbuilder.build();
}



// make cancel ask tx
async function makeTokenV2CancelAskTx(peers, mynetwork, wif, tokenid, askid)
{
  let mypair = ecpair.fromWIF(wif, mynetwork);
  let mypk = mypair.getPublicKeyBuffer();
  let mynormaladdress = ccutils.pubkey2NormalAddressKmd(mypk);

  let txns = await ccutils.getTransactionsMany(peers, mypk, tokenid, askid);
  if (!txns || !Array.isArray(txns.transactions) || txns.transactions.length != 2)
    throw new Error("could not load token or ask tx");
  let tokenbasetx = Transaction.fromHex(txns.transactions[0].tx, mynetwork);
  let asktx = Transaction.fromHex(txns.transactions[1].tx, mynetwork);
  if (tokenbasetx.outs.length < 2)
    throw new Error("invalid tokenid (bad token tx)");
  if (asktx.outs.length < 2)
    throw new Error("invalid ask tx (structure)");
    
  let tokenData = cctokens.decodeTokensV2OpReturn(tokenbasetx.outs[tokenbasetx.outs.length-1].script);
  let askData = decodeTokensAssetsV2OpReturn(asktx.outs[asktx.outs.length-1].script);

  if (!tokenData || !tokenData.origpk)
    throw new Error("invalid tokenid (no token data)");
  if (!askData || !askData.assetData || !askData.assetData.funcid)
    throw new Error("invalid ask tx (no assets data)");

  const askVout = 0;
  const askTokens = asktx.outs[askVout].value;

  const txbuilder = new TransactionBuilder(mynetwork);
  const txfee = 10000;
  const normalAmount = txfee;

  const assetsGlobalPk = Buffer.from(assetsv2GlobalPk, 'hex');

  let txwutxos = await ccutils.createTxAndAddNormalInputs(peers, mypk, normalAmount);
  let sourcetx1 = Transaction.fromBuffer(Buffer.from(txwutxos.txhex, 'hex'), mynetwork);

  // zcash stuff:
  txbuilder.setVersion(sourcetx1.version);
  if (txbuilder.tx.version >= 3)
    txbuilder.setVersionGroupId(sourcetx1.versionGroupId);

  // add vins to the created tx
  let added = ccutils.addInputsFromPreviousTxns(txbuilder, sourcetx1, txwutxos.previousTxns, mynetwork);
  if (added < normalAmount)
    throw new Error("insufficient normal inputs (" + added + ")")

  txbuilder.addInput(asktx, askVout);
  if (askData.assetData.funcid == 's' && asktx.outs.length > 1)
    txbuilder.addInput(asktx, 1);  // spend 1of2 marker
  else if (askData.assetData.funcid == 'S' && asktx.outs.length > 3)
    txbuilder.addInput(asktx, 3);  // spend 1of2 marker
  else 
    throw new Error("invalid ask tx (structure: funcid, outs.length)");

/*
  uint8_t funcid = A::DecodeAssetTokenOpRet(vintx.vout.back().scriptPubKey, dummyEvalCode, dummyAssetid, dummyPrice, origpubkey, expiryHeight);
  if (funcid == 's' && vintx.vout.size() > 1)
      mtx.vin.push_back(CTxIn(asktxid, 1, CScript()));		// spend marker if funcid='s'
  else if (funcid == 'S' && vintx.vout.size() > 3)
      mtx.vin.push_back(CTxIn(asktxid, 3, CScript()));		// spend marker if funcid='S'
  else {
      CCerror = "invalid ask tx or not enough vouts";
      return "";
  }
  mtx.vout.push_back(T::MakeTokensCC1vout(T::EvalCode(), askamount, pubkey2pk(origpubkey)));	// one-eval token vout
*/
  
  let askCreatorCCSpk = ccutils.makeCCSpkV2MofN(cctokens.EVAL_TOKENSV2, [askData.assetData.origpk], 1, ccbasic.makeOpDropData(cctokens.EVAL_TOKENSV2, 1,1, [askData.assetData.origpk], cctokens.encodeTokensV2Data(tokenid)));
  txbuilder.addOutput(askCreatorCCSpk, askTokens);  // tokens to asking party

  if (added - normalAmount > ccutils.MYDUST)
    txbuilder.addOutput(mynormaladdress, added - normalAmount);  // change

  txbuilder.addOutput(cctokens.encodeTokensV2OpReturn(tokenid, encodeAssetsV2Data('x')), 0); // add opreturn

  if (txbuilder.tx.version >= 4)
    txbuilder.setExpiryHeight(sourcetx1.expiryHeight);

  let probeGlobal = ccutils.makeCCCondMofN([cctokens.EVAL_TOKENSV2, EVAL_ASSETSV2], [assetsGlobalPk], 1);  // probe to spend from assets GlobalPubKey
  let probeMarker = ccutils.makeCCCondMofN(EVAL_ASSETSV2, [mypk, assetsGlobalPk], 1);  // probe to spend from 1of2 marker
  ccutils.finalizeCCtx(mypair, txbuilder, [{cond: probeGlobal, privateKey: assetsv2GlobalPrivkey}, {cond: probeMarker, privateKey: mypair.getPrivateKeyBuffer()}]);
  return txbuilder.build();
}

// make cancel bid tx
async function makeTokenV2CancelBidTx(peers, mynetwork, wif, tokenid, bidid)
{
  let mypair = ecpair.fromWIF(wif, mynetwork);
  let mypk = mypair.getPublicKeyBuffer();
  let mynormaladdress = ccutils.pubkey2NormalAddressKmd(mypk);
  
  let txns = await ccutils.getTransactionsMany(peers, mypk, tokenid, bidid);
  if (!txns || !Array.isArray(txns.transactions) || txns.transactions.length != 2)
    throw new Error("could not load token or bid tx");
  let tokenbasetx = Transaction.fromHex(txns.transactions[0].tx, mynetwork);
  let bidtx = Transaction.fromHex(txns.transactions[1].tx, mynetwork);
  if (tokenbasetx.outs.length < 2)
    throw new Error("invalid tokenid (bad token tx)");
  if (bidtx.outs.length < 2)
    throw new Error("invalid bid tx (structure)");
    
  let tokenData = cctokens.decodeTokensV2OpReturn(tokenbasetx.outs[tokenbasetx.outs.length-1].script);
  let bidData = decodeTokensAssetsV2OpReturn(bidtx.outs[bidtx.outs.length-1].script);

  if (!tokenData || !tokenData.origpk)
    throw new Error("invalid tokenid (no token data)");
  if (!bidData || !bidData.assetData || !bidData.assetData.funcid)
    throw new Error("invalid bid tx (no assets data)");

  const bidVout = 0;
  const bidAmount = bidtx.outs[bidVout].value;

  const txbuilder = new TransactionBuilder(mynetwork);
  const txfee = 10000;
  const normalAmount = txfee;

  const assetsGlobalPk = Buffer.from(assetsv2GlobalPk, 'hex');

  let txwutxos = await ccutils.createTxAndAddNormalInputs(peers, mypk, normalAmount);
  let sourcetx1 = Transaction.fromBuffer(Buffer.from(txwutxos.txhex, 'hex'), mynetwork);

  // zcash stuff:
  txbuilder.setVersion(sourcetx1.version);
  if (txbuilder.tx.version >= 3)
    txbuilder.setVersionGroupId(sourcetx1.versionGroupId);

  // add vins to the created tx
  let added = ccutils.addInputsFromPreviousTxns(txbuilder, sourcetx1, txwutxos.previousTxns, mynetwork);
  if (added < normalAmount)
    throw new Error("insufficient normal inputs (" + added + ")")

  txbuilder.addInput(bidtx, bidVout);
  if (bidData.assetData.funcid == 'b' && bidtx.outs.length > 1)
    txbuilder.addInput(bidtx, 1);  // spend 1of2 marker
  else if (bidData.assetData.funcid == 'B' && bidtx.outs.length > 3)
    txbuilder.addInput(bidtx, 3);  // spend 1of2 marker
  else 
    throw new Error("invalid bid tx (structure: funcid, outs.length)");

/*
  if (bidamount > ASSETS_NORMAL_DUST)  
      mtx.vout.push_back(CTxOut(bidamount, CScript() << ParseHex(HexStr(origpubkey)) << OP_CHECKSIG));
  else {
      // send dust back to global addr
      mtx.vout.push_back(T::MakeCC1vout(A::EvalCode(), bidamount, unspendableAssetsPk));
      LOGSTREAMFN(ccassets_log, CCLOG_DEBUG1, stream << "dust detected bidamount=" << bidamount << std::endl);
  }
*/

  if (bidAmount > ASSETS_NORMAL_DUST) {
    let bidCreatorAddress = ccutils.pubkey2NormalAddressKmd(bidData.assetData.origpk);
    txbuilder.addOutput(bidCreatorAddress, bidAmount);  // remaining coins to bid creator
  } else {
    let globalccSpk = ccutils.makeCCSpkV2MofN(EVAL_ASSETSV2, [assetsGlobalPk], 1);
    txbuilder.addOutput(globalccSpk, bidAmount);    // send dust back to global assets pk (as dust allowed on cc but not on normal outputs)
  }

  if (added - normalAmount > ccutils.MYDUST)
    txbuilder.addOutput(mynormaladdress, added - normalAmount);  // change

  txbuilder.addOutput(cctokens.encodeTokensV2OpReturn(tokenid, encodeAssetsV2Data('o')), 0); // add opreturn

  if (txbuilder.tx.version >= 4)
    txbuilder.setExpiryHeight(sourcetx1.expiryHeight);

  let probeGlobal = ccutils.makeCCCondMofN([EVAL_ASSETSV2], [assetsGlobalPk], 1);  // probe to spend coins from assets GlobalPubKey
  let probeMarker = ccutils.makeCCCondMofN(EVAL_ASSETSV2, [mypk, assetsGlobalPk], 1);  // probe to spend from 1of2 marker
  ccutils.finalizeCCtx(mypair, txbuilder, [{cond: probeGlobal, privateKey: assetsv2GlobalPrivkey}, {cond: probeMarker, privateKey: mypair.getPrivateKeyBuffer()}]);
  return txbuilder.build();
}


module.exports = {
  tokenv2ask, tokenv2bid, tokenv2fillask, tokenv2fillbid, tokenv2cancelask, tokenv2cancelbid,
  assetsv2GlobalPk, assetsv2GlobalPrivkey, assetsv2GlobalAddress, EVAL_ASSETSV2
}
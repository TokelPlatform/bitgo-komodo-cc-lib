
'use strict';

const TransactionBuilder = require('../src/transaction_builder');
const Transaction = require('../src/transaction');
const ECPair = require('../src/ecpair');
const OPS = require('bitcoin-ops');

const bufferutils = require("../src/bufferutils");
const script = require("../src/script");
const kmdmessages = require('../net/kmdmessages');
const ccutils = require('../cc/ccutils');
const ecpair = require('../src/ecpair');
const varuint = require('varuint-bitcoin');

// create peer group
var NspvPeerGroup = require('../net/nspvPeerGroup');
require('../net/nspvPeer');  // init peer.js too

const networks = require('../src/networks');
//const mynetwork = networks.rick; 
//const mynetwork = networks.tok6;
//const mynetwork = networks.dimxy23;
const mynetwork = networks.dimxy25;


// you will need to do a call like:
// p2cryptoconditions.cryptoconditions = await ccimp;
// to init the cryptoconditions wasm lib 
// (this is due to wasm delayed loading specifics)
const p2cryptoconditions = require('../src/payments/p2cryptoconditions');
var ccimp;
if (process.browser)
  ccimp = import('cryptoconditions-js/pkg/cryptoconditions.js');   // in browser, use 'wasm-pack build' (no any --target). Don't forget run browerify!
else
  ccimp = require('cryptoconditions-js/pkg/cryptoconditions.js');  // in nodejs, use 'wasm-pack build -t nodejs'


// tokens global privkey/pubkey:
const tokensGlobalPk = "03e6191c70c9c9a28f9fd87089b9488d0e6c02fb629df64979c9cdb6b2b4a68d95";
const tokensGlobalPrivkey = Buffer.from([ 0x1d, 0x0d, 0x0d, 0xce, 0x2d, 0xd2, 0xe1, 0x9d, 0xf5, 0xb6, 0x26, 0xd5, 0xad, 0xa0, 0xf0, 0x0a, 0xdd, 0x7a, 0x72, 0x7d, 0x17, 0x35, 0xb5, 0xe3, 0x2c, 0x6c, 0xa9, 0xa2, 0x03, 0x16, 0x4b, 0xcf ]);
const tokensGlobalAddress = "RAMvUfoyURBRxAdVeTMHxn3giJZCFWeha2";
const EVAL_TOKENS = 0xF2;

// not used for plan websockets, only for PXP which is not supported
var defaultPort = 14722

/*
to connect over p2p:
var dnsSeeds = [
]
*/

//to connect over p2p
var staticPeers = [
  //'127.0.0.1:14722'
  //'18.189.25.123:14722'
  //'rick.kmd.dev:25434'
  '3.136.47.223:14722'
] 


// to connect over websockets:
var webSeeds = [
  //'ws://18.189.25.123:8192'
  'wss://localhost:8192'
  //'ws://3.136.47.223:8192'
  // TODO: add more
]

var params = {
  magic: mynetwork.magic,
  defaultPort: defaultPort,
  //dnsSeeds: dnsSeeds,
  webSeeds: webSeeds,
  //staticPeers: staticPeers,  // dnsSeed works also
  protocolVersion: 170009,
  messages: kmdmessages.kmdMessages
}

var opts = {
  connectWeb: true,     // use websockets
  //wrtc: wrtc,          // not supported any more
  numPeers: 8,
  //hardLimit: 2,        // max peers
  connectPlainWeb: true,  // use plain websockets, no PXP
  wsOpts: { rejectUnauthorized: false }  // enable self-signed certificates
}

var peers;

function AddTokensInputs(peers, tokenid, pk, amount)
{
  return new Promise((resolve, reject) => {

    peers.nspvRemoteRpc("tokenaddccinputs", pk, [ccutils.txidToHex(tokenid), pk.toString('hex'), amount.toString() ], {}, (err, res, peer) => {
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

exports.Connect = Connect;

// exported top level functions to be called from browser
// param check and pass further:

exports.Tokensv2Create = Tokensv2Create;
async function Tokensv2Create(_wif, _name, _desc, _satoshi, _nftdata) {
  let wif = _wif;
  let name = _name;
  let desc = _desc;
  let satoshi  = _satoshi;
  let nftdata;
  if (_nftdata)
    nftdata = Buffer.from(_nftdata, 'hex');
    let tx = await makeTokensCreateTx(wif, name, desc, satoshi, nftdata);

  return tx.toHex();
};

exports.Tokensv2Transfer = Tokensv2Transfer;
async function Tokensv2Transfer(_wif, _tokenidhex, _destpk, _satoshi) {
  let wif = _wif;
  let tokenid = ccutils.txidFromHex(_tokenidhex);
  let destpk = Buffer.from(_destpk, 'hex');
  let satoshi  = _satoshi;

  let tx = await makeTokensTransferTx(wif, tokenid, destpk, satoshi);
  return tx.toHex();
};

// encode token OP_RETURN data
function makeTokensCreateOpreturn(origpk, name, desc, nftdata)
{
  let version = 1;

  let buffer = Buffer.allocUnsafe(1+1+1 + 
    varuint.encodingLength(origpk.length) + origpk.length + 
    varuint.encodingLength(name.length) + name.length + 
    varuint.encodingLength(desc.length) + desc.length + 
    (Buffer.isBuffer(nftdata) && nftdata.length > 0 ? varuint.encodingLength(nftdata.length) + nftdata.length : 0));
  let bufferWriter = new bufferutils.BufferWriter(buffer);

  bufferWriter.writeUInt8(EVAL_TOKENS);
  bufferWriter.writeUInt8('C'.charCodeAt(0));
  bufferWriter.writeUInt8(version);
  bufferWriter.writeVarSlice(origpk);
  bufferWriter.writeVarSlice(Buffer.from(name));
  bufferWriter.writeVarSlice(Buffer.from(desc));
  if (Buffer.isBuffer(nftdata) && nftdata.length > 0)
    bufferWriter.writeVarSlice(nftdata);

  return script.compile([OPS.OP_RETURN, buffer]);
}

// encode token vdata to be added in OP_DROP
function makeTokensVData(tokenid, destpks)
{
  let buffer = Buffer.allocUnsafe(1+1+1 + tokenid.length + (destpks.length > 0 ? 1 + destpks.length * (varuint.encodingLength(destpks[0].length) + destpks[0].length) : 0));
  let bufferWriter = new bufferutils.BufferWriter(buffer);
  let version = 1;
  let funcid = 'T';

  bufferWriter.writeUInt8(EVAL_TOKENS);
  bufferWriter.writeUInt8(funcid.charCodeAt(0));
  bufferWriter.writeUInt8(version);
  bufferWriter.writeSlice(ccutils.txidReverse(tokenid));  // cc modules often store creationid in opreturn reversed, for readability
  if (destpks.length > 0) {
    bufferWriter.writeUInt8(destpks.length);
    for (let i = 0; i < destpks.length; i ++) 
      bufferWriter.writeVarSlice(destpks[i]);
  }
  return buffer;
}

// tx creation code

async function makeTokensCreateTx(wif, name, desc, amount, nftdata)
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
  subfulfillments.push({ type:	"eval-sha-256", code:	ccutils.byte2Base64(EVAL_TOKENS) });  
  if (Buffer.isBuffer(nftdata) && nftdata.length > 0 && nftdata[0]) {
    subfulfillments.push({ type:	"eval-sha-256", code:	ccutils.byte2Base64(nftdata[0]) });  // add nft data evalcode to cond
    threshold ++;
  }
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
  let myccSpk = p2cryptoconditions.makeCCSpk(mycond);
  if (myccSpk == null)  {
    throw new Error('could not create tokens cc spk');
  }

  // create search marker
  let markercond = {
    type:	"threshold-sha-256",
    threshold:	2,
    subfulfillments:	[{
        type:	"eval-sha-256",   
        code:	ccutils.byte2Base64(EVAL_TOKENS)     
      }, {            
        type:	"threshold-sha-256",
        threshold:	1,
        subfulfillments:	[{  
                type:	"secp256k1-sha-256",
                publicKey:	tokensGlobalPk
        }]  
      }]   
    };
  let markerccSpk = p2cryptoconditions.makeCCSpk(markercond);
  if (markerccSpk == null)  {
    throw new Error('could not create tokens marker cc spk');
  }

  txbuilder.addOutput(markerccSpk, markerfee);
  txbuilder.addOutput(myccSpk, amount);
  txbuilder.addOutput(mynormaladdress, added - amount - txfee - markerfee);  // change
  txbuilder.addOutput(makeTokensCreateOpreturn(mypk, name, desc, nftdata), 0); // make opreturn

  if (txbuilder.tx.version >= 4)
    txbuilder.setExpiryHeight(tx.expiryHeight);

  ccutils.finalizeCCtx(mypair, txbuilder);
  return txbuilder.build();
}

async function makeTokensTransferTx(wif, tokenid, destpk, ccamount) 
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
  subfulfillments.push({ type:	"eval-sha-256", code:	ccutils.byte2Base64(EVAL_TOKENS) });  
  if (ccutxos.evalcodeNFT)  {
    subfulfillments.push({ type:	"eval-sha-256", code:	ccutils.byte2Base64(ccutxos.evalcodeNFT) });  // add nft data evalcode to cond
    threshold ++;
  }
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

  let destccSpk = p2cryptoconditions.makeCCSpk(destcond, p2cryptoconditions.makeOpDropData(EVAL_TOKENS, 1,1, [], makeTokensVData(tokenid, [destpk])));
  if (destccSpk == null)  
    throw new Error('could not create tokens cc spk for destination');
  
  txbuilder.addOutput(destccSpk, ccamount);
  

  // create tokens to my address for cc change and spending probe
  let mycond = {
    type:	"threshold-sha-256",
    threshold:	2,
    subfulfillments:	[{
          type:	"eval-sha-256",   
          code:	ccutils.byte2Base64(EVAL_TOKENS)     
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
    let myccSpk = p2cryptoconditions.makeCCSpk(mycond, p2cryptoconditions.makeOpDropData(EVAL_TOKENS, 1,1, [], makeTokensVData(tokenid, [mypk])));
    if (myccSpk == null)  
      throw new Error('could not create tokens cc spk for mypk');

    txbuilder.addOutput(myccSpk, ccadded-ccamount);
  }
  
  if (txbuilder.tx.version >= 4)
    txbuilder.setExpiryHeight(bearertx1.expiryHeight);

  ccutils.finalizeCCtx(mypair, txbuilder, [{cond: mycond}]);
  return txbuilder.build();
}


// Example test calls running under nodejs
const mytokencreatewif = 'UpUdyyTPFsXv8s8Wn83Wuc4iRsh5GDUcz8jVFiE3SxzFSfgNEyed';
const mytokentransferwif = 'UwoxbMPYh4nnWbzT4d4Q1xNjx3n9rzd6BLuato7v3G2FfvpKNKEq';
//const mydestpubkey = "035d3b0f2e98cf0fba19f80880ec7c08d770c6cf04aa5639bc57130d5ac54874db";
const mydestpubkey = "034777b18effce6f7a849b72de8e6810bf7a7e050274b3782e1b5a13d0263a44dc";
const mytokenid = "2bea503a491cae096b0c2af48d504e4fbd7c4747f49eddbb5d2723d6287769f8";

if (!process.browser) 
{
  peers = new NspvPeerGroup(params, opts);
  peers.on('peer', (peer) => {
    // console.log('in event: connected to peer', peer.socket.remoteAddress)
  });
  // create connections to peers
  peers.connect(async () => {
  
    try {

      // Several tests (uncomment needed):
      
      // test get blocks from peer (TODO: update for kmd block and transactions support) : 
      // var hashes = [  bufferutils.reverseBuffer(Buffer.from("099751509c426f89a47361fcd26a4ef14827353c40f42a1389a237faab6a4c5d", 'hex')) ];
      // let blocks = peers.getBlocks(hashes, {});
      // console.log('blocks:', blocks);

      // test get normal utxos from an address:
      //let utxos = await ccutils.getNormalUtxos(peers, faucetcreateaddress);
      //console.log('utxos=', utxos);

      // it should be at least 1 sec between the same type nspv requests (here it is NSPV_UTXOS)
      //var t0 = new Date().getSeconds();
      //do {
      //  var t1 = new Date().getSeconds();
      //} while(t1 == t0);

      // get cc utxos:
      //let ccutxos = await ccutils.getCCUtxos(peers, faucetGlobalAddress);
      //console.log('cc utxos=', ccutxos); 

      // make cc token create tx
      //let txhex = await Tokensv2Create(mytokencreatewif, "MYNFT", "MyDesc", 1, "000101010201010301");
      //console.log('txhex=', txhex);

      // make cc token transfer tx
      let txhex = await Tokensv2Transfer(mytokencreatewif, mytokenid, mydestpubkey, 1);
      console.log('txhex=', txhex);

      // make tx with normal inputs for the specified amount
      // not used let txwnormals = await ccutils.createTxAddNormalInputs('035d3b0f2e98cf0fba19f80880ec7c08d770c6cf04aa5639bc57130d5ac54874db', 100000000*190000);
      //console.log('txwnormals=', txwnormals);
    }
    catch(err) {
      console.log('caught err=', err, 'code=', err.code, 'message=', err.message);
    }
    peers.close();
    console.log('test finished');
  });
}

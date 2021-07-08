
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

// create peer group
var NspvPeerGroup = require('../net/nspvPeerGroup');
require('../net/nspvPeer');  // init peer.js too

const networks = require('../src/networks');
//const mynetwork = networks.rick; 
//const mynetwork = networks.dimxy19;
const mynetwork = networks.tok6; 


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



const FAUCETSIZE = 10000000;


// faucet global privkey/pubkey:
const faucetGlobalPk = "03682b255c40d0cde8faee381a1a50bbb89980ff24539cb8518e294d3a63cefe12";
const faucetGlobalPrivkey = Buffer.from([ 0xd4, 0x4f, 0xf2, 0x31, 0x71, 0x7d, 0x28, 0x02, 0x4b, 0xc7, 0xdd, 0x71, 0xa0, 0x39, 0xc4, 0xbe, 0x1a, 0xfe, 0xeb, 0xc2, 0x46, 0xda, 0x76, 0xf8, 0x07, 0x53, 0x3d, 0x96, 0xb4, 0xca, 0xa0, 0xe9 ]);
const faucetGlobalAddress = "R9zHrofhRbub7ER77B7NrVch3A63R39GuC";

// not used for plan websockets, only for PXP which is not supported
var defaultPort = 14722

/*
to connect over p2p:
var dnsSeeds = [
]
*/

// to connect over p2p
var staticPeers = [
  //'18.189.25.123:14722'
  'rick.kmd.dev:25434'
] 


// to connect over websockets:
var webSeeds = [
  //'ws://18.189.25.123:8192'
  //'ws://localhost:8192'
  'ws:3.136.47.223:8192'
  // TODO: add more
]

var params = {
  magic: mynetwork.magic,
  defaultPort: defaultPort,
  //dnsSeeds: dnsSeeds,
  webSeeds: webSeeds,
  staticPeers: staticPeers,  // dnsSeed works also
  protocolVersion: 170009,
  messages: kmdmessages.kmdMessages
}

var opts = {
  connectWeb: true,     // use websockets
  //wrtc: wrtc,          // not supported any more
  numPeers: 8,
  //hardLimit: 2,        // max peers
  connectPlainWeb: true,  // use plain websockets, no PXP
  wsOpts: { rejectUnauthorized: false } 
}

var peers;

function createTxAndAddFaucetInputs(peers, globalpk, amount)
{
  return new Promise((resolve, reject) => {

    peers.nspvRemoteRpc("faucetaddccinputs", globalpk, amount, {}, (err, res, peer) => {
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

exports.ccfaucet_create = ccfaucet_create;
async function ccfaucet_create(_wif, _myaddress, _satoshi) {
  let wif = _wif || myfaucetcreatewif;
  let myaddress = _myaddress || myfaucetcreateaddress;
  let satoshi  = _satoshi || FAUCETSIZE*20;
  //amount = amount >>> 0; // to int
  let tx = await makeFaucetCreateTx(wif, myaddress, satoshi);

  return tx.toHex();
};

exports.ccfaucet_get = ccfaucet_get;
async function ccfaucet_get(_myaddress) {
  let myaddress = _myaddress || myfaucetgetaddress;
  let tx = await makeFaucetGetTx(myaddress);
  //return this.broadcast(tx.toHex());
  return tx.toHex();
};

// tx creation code

async function makeFaucetCreateTx(wif, myaddress, amount) 
{
  // init lib cryptoconditions
  p2cryptoconditions.cryptoconditions = await ccimp;

  const txbuilder = new TransactionBuilder(mynetwork);
  const txfee = 10000;

  let mypair = ecpair.fromWIF(wif, mynetwork);
  let txwutxos = await ccutils.createTxAndAddNormalInputs(peers, mypair.getPublicKeyBuffer(), amount + txfee);

  let tx = Transaction.fromBuffer(Buffer.from(txwutxos.txhex, 'hex'), mynetwork);

  // zcash stuff:
  txbuilder.setVersion(tx.version);
  if (txbuilder.tx.version >= 3)
    txbuilder.setVersionGroupId(tx.versionGroupId);

  // add vins to the created tx
  let added = ccutils.addInputsFromPreviousTxns(txbuilder, tx, txwutxos.previousTxns, mynetwork);
  if (added < amount + txfee)
    throw new Error("insufficient normal inputs (" + added + ")")

  // create faucet cc to global address
  let cond = {
    type:	"threshold-sha-256",
    threshold:	2,
    subfulfillments:	[{
          type:	"eval-sha-256",   
          code:	ccutils.hex2Base64('e4')     
      }, {            
          type:	"threshold-sha-256",
          threshold:	1,
          subfulfillments:	[{  
                  type:	"secp256k1-sha-256",
                  publicKey:	faucetGlobalPk
          }]  
      }]   
    };
  let ccSpk = p2cryptoconditions.makeCCSpk(cond);
  if (ccSpk == null)  {
    throw new Error('could not create faucet cc spk');
  }

  txbuilder.addOutput(ccSpk, amount);
  txbuilder.addOutput(myaddress, added - amount - txfee);  // change

  if (txbuilder.tx.version >= 4)
    txbuilder.setExpiryHeight(tx.expiryHeight);

  ccutils.finalizeCCtx(mypair, txbuilder);
  return txbuilder.build();
}

async function makeFaucetGetTx(myaddress) 
{
  // init lib cryptoconditions
  p2cryptoconditions.cryptoconditions = await ccimp;

  const txfee = 10000;
  const amount = FAUCETSIZE;

  let txwutxos = await createTxAndAddFaucetInputs(peers, faucetGlobalPk, amount);
  let basetx = Transaction.fromBuffer(Buffer.from(txwutxos.txhex, 'hex'), mynetwork);

  // create a cc to spend from global address
  let cond = {
    type:	"threshold-sha-256",
    threshold:	2,
    subfulfillments:	[{
        type:	"eval-sha-256",   
        code:	 ccutils.hex2Base64('e4')     
    }, {            
        type:	"threshold-sha-256",
        threshold:	1,
        subfulfillments:	[{  
                type:	"secp256k1-sha-256",
                publicKey:	faucetGlobalPk
        }]  
    }]   
  };

  let ccSpk = p2cryptoconditions.makeCCSpk(cond);
  if (ccSpk == null)  {
    throw new Error('could not create cc spk');
  }

  // mine faucet get txpow
  let i = 0;
  let stop = false;
  let txbuilder;
  for(var adj1 = 0; adj1 <= 0xFFFFFFFF && !stop; adj1++)  {
    for(var adj2 = 0; adj2 <= 0xFFFFFFFF && !stop; adj2++)  {
      txbuilder = new TransactionBuilder(mynetwork);

      txbuilder.setVersion(basetx.version);
      if (basetx.version >= 3)
        txbuilder.setVersionGroupId(basetx.versionGroupId);
    
      let added = ccutils.addInputsFromPreviousTxns(txbuilder, basetx, txwutxos.previousTxns, mynetwork);
      if (added < amount)
        throw new Error('could not find cc faucet inputs');

      txbuilder.addOutput(ccSpk, added - amount - txfee);  // change to faucet cc
      txbuilder.addOutput(myaddress, amount);  // get to normal

      // make 4-byte buffer from a number
      const num2Uint32 = num => { 
        let buf = Buffer.alloc(4);
        let bufwr = new bufferutils.BufferWriter(buf);
        bufwr.writeUInt32(num >>> 0);
        return buf;
      };

      // adjust nonces:
      let opreturn = script.compile([ OPS.OP_RETURN, Buffer.concat([ Buffer.from(num2Uint32(adj1 >>> 0)), Buffer.from(num2Uint32(adj2 >>> 0)) ]) ]);
      txbuilder.addOutput(opreturn, 0);
     
      ccutils.finalizeCCtx(ECPair.fromPrivateKeyBuffer(faucetGlobalPrivkey, mynetwork), txbuilder, [{cond: cond}]);
      let tx = txbuilder.build();
      let txid = tx.getId();
      console.log('slice=', txid.slice(0,2), txid.slice(62,64));
      if (txid.slice(0,2) == '00' && txid.slice(62,64) == '00') {  // check valid faucet txpow
        console.log("mined faucet txid");
        stop=true;
      }
      if (++i > 1000000)
        return;
    }
  }

  //console.log('tx..:', txbuilder.buildIncomplete().toHex());
  return txbuilder.build();
}


// Example test calls running under nodejs
const myfaucetcreatewif = 'UpUdyyTPFsXv8s8Wn83Wuc4iRsh5GDUcz8jVFiE3SxzFSfgNEyed';
const myfaucetcreateaddress = 'RJXkCF7mn2DRpUZ77XBNTKCe55M2rJbTcu';
const myfaucetgetwif = 'UwoxbMPYh4nnWbzT4d4Q1xNjx3n9rzd6BLuato7v3G2FfvpKNKEq';
const myfaucetgetaddress = 'RCrTxfdaGL4sc3mpECfamD3wh4YH5K8HAP';

if (!process.browser) 
{
  peers = new NspvPeerGroup(params, opts);
  peers.on('peer', (peer) => {
    // console.log('in event: connected to peer', peer.socket.remoteAddress)
  });
  // create connections to peers
  peers.connect(async () => {
  
    try {

      // Several tests:
      
      // test get blocks from peer (TODO: update for kmd block and transactions support) : 
      // var hashes = [  bufferutils.reverseBuffer(Buffer.from("099751509c426f89a47361fcd26a4ef14827353c40f42a1389a237faab6a4c5d", 'hex')) ];
      // let blocks = peers.getBlocks(hashes, {});
      // console.log('blocks:', blocks);

      // test get normal utxos from an address:
      //let utxos = await ccutils.getNormalUtxos(peers, myfaucetcreateaddress);
      //console.log('utxos=', utxos);

      // it should be at least 1 sec between the same type nspv requests (here it is NSPV_UTXOS)
      //var t0 = new Date().getSeconds();
      //do {
      //  var t1 = new Date().getSeconds();
      //} while(t1 == t0);

      // get cc utxos:
      //let ccutxos = await ccutils.getCCUtxos(peers, faucetGlobalAddress);
      //console.log('cc utxos=', ccutxos); 

      // make cc faucet create tx
      let txhex = await ccfaucet_create(myfaucetcreatewif, myfaucetcreateaddress, FAUCETSIZE*20 /*890719925404991*/);
      console.log('txhex=', txhex);

      // make cc faucet get tx
      //let txhex = await ccfaucet_get(myfaucetgetaddress);
      //console.log('txhex=', txhex);

      // make tx with normal inputs for the specified amount
      // not used let txwnormals = await ccutils.createTxAddNormalInputs('035d3b0f2e98cf0fba19f80880ec7c08d770c6cf04aa5639bc57130d5ac54874db', 100000000*190000);
      //console.log('txwnormals=', txwnormals);
    }
    catch(err) {
      console.log('caught err=', err, 'code=', err.code, 'message=', err.message);
    }
  });
}

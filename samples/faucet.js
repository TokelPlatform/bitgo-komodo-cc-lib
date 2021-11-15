
'use strict';

const TransactionBuilder = require('../src/transaction_builder');
const Transaction = require('../src/transaction');
const ECPair = require('../src/ecpair');
const OPS = require('bitcoin-ops');

const bufferutils = require("../src/bufferutils");
const script = require("../src/script");
const kmdmessages = require('../net/kmdmessages');
const ccutils = require('../cc/ccutils');
const ccfaucet = require('../cc/ccfaucet');
const ecpair = require('../src/ecpair');

// create peer group
const NspvPeerGroup = require('../net/nspvPeerGroup');
//const PeerGroup = require('../net/peerGroup');
const peerutils = require('../net/utils');
require('../net/nspvPeer');  // init peer.js too

const networks = require('../src/networks');
//const mynetwork = networks.rick; 
//const mynetwork = networks.dimxy19;
//const mynetwork = networks.tok6; 
const mynetwork = networks.DIMXY24; 
//const mynetwork = networks.tkltest; 

// you will need to do a call like:
// ccbasic.cryptoconditions = await ccimp;
// to init the cryptoconditions wasm lib 
// (this is due to wasm delayed loading specifics)
const ccbasic = require('../cc/ccbasic');
var ccimp;
if (process.browser)
  ccimp = import('cryptoconditions-js/pkg/cryptoconditions.js');   // in browser, use 'wasm-pack build' (no any --target). Don't forget run browerify!
else
  ccimp = require('cryptoconditions-js/pkg/cryptoconditions.js');  // in nodejs, use 'wasm-pack build -t nodejs'

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
  //'rick.kmd.dev:25434'
  //'127.0.0.1:22024'
  '127.0.0.1:14722'
] 


// to connect over websockets:
var webSeeds = [
  //'ws://18.189.25.123:8192'
  //'ws://localhost:8192'
  'ws:3.136.47.223:8192'
  // TODO: add more
]

var params = {
  network: mynetwork,
  //defaultPort: defaultPort,
  //dnsSeeds: dnsSeeds,
  //webSeeds: webSeeds,
  staticPeers: staticPeers,  // dnsSeed works also
  protocolVersion: 170009,
  messages: kmdmessages.kmdMessages
}

var opts = {
  //connectWeb: true,     // use websockets, not used
  //wrtc: wrtc,          // not supported any more
  numPeers: 8,
  //hardLimit: 2,        // max peers
  //connectPlainWeb: true,  // use plain websockets, no PXP
  wsOpts: { rejectUnauthorized: false } 
}

var peers;

// Example test calls running under nodejs
const myfaucetcreatewif = 'UpUdyyTPFsXv8s8Wn83Wuc4iRsh5GDUcz8jVFiE3SxzFSfgNEyed';
const myfaucetcreateaddress = 'RJXkCF7mn2DRpUZ77XBNTKCe55M2rJbTcu';
const myfaucetgetwif = 'UwoxbMPYh4nnWbzT4d4Q1xNjx3n9rzd6BLuato7v3G2FfvpKNKEq';
const myfaucetgetaddress = 'RCrTxfdaGL4sc3mpECfamD3wh4YH5K8HAP';

// sleep to insert delay between nspv calls to bypass the old nspv rate limiter
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

if (!process.browser) 
{
  peers = new NspvPeerGroup(params, opts);
  peers.on('peer', (peer) => {
    console.log('added new peer', peerutils.getPeerUrl(peer))
  });
  // create connections to peers
  peers.connect(async () => {
  
    try {

      // load cryptoconditions lib
      ccbasic.cryptoconditions = await ccimp;

      // Several tests:
      
      // test get blocks from peer (TODO: update for kmd block and transactions support) : 
      // var hashes = [  bufferutils.reverseBuffer(Buffer.from("099751509c426f89a47361fcd26a4ef14827353c40f42a1389a237faab6a4c5d", 'hex')) ];
      // let blocks = peers.getBlocks(hashes, {});
      // console.log('blocks:', blocks);

      // test get normal utxos from an address:
      //let utxos = await ccutils.getNormalUtxos(peers, myfaucetcreateaddress);
      //console.log('utxos=', utxos);

      // it should be at least 1 sec between the same type nspv requests (here it is NSPV_UTXOS)
      //await sleep(1100);

      // get cc utxos:
      //let ccutxos = await ccutils.getCCUtxos(peers, faucetGlobalAddress);
      //let ccutxos = await ccutils.getCCUtxos(peers, 'RSc4RycihBEWQP2GDvSYS46MvFJsTKaNVU');
      //console.log('cc utxos=', ccutxos); 

      // make cc faucet create tx
      let tx = await ccfaucet.FaucetFund(peers, mynetwork, myfaucetcreatewif, ccfaucet.FAUCETSIZE*20 /*890719925404991*/);
      console.log('txhex=', tx.toHex());

      // make cc faucet get tx:
      //let mypair = ecpair.fromWIF(myfaucetcreatewif, mynetwork);
      //let mypk = mypair.getPublicKeyBuffer();
      //let mynormaladdress = ccutils.pubkey2NormalAddressKmd(mypk);
      //let tx = await ccfaucet.FaucetGet(peers, mynetwork, mynormaladdress);
      //console.log('txhex=', tx.toHex());
      
      // make tx with normal inputs for the specified amount
      // not used let txwnormals = await ccutils.createTxAddNormalInputs('035d3b0f2e98cf0fba19f80880ec7c08d770c6cf04aa5639bc57130d5ac54874db', 100000000*190000);
      //console.log('txwnormals=', txwnormals);
    }
    catch(err) {
      console.log('caught err=', err, 'code=', err.code, 'message=', err.message);
    }
    peers.close();
    console.log('test finished, waiting for peers to close...');
  });
}

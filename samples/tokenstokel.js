
'use strict';

const kmdmessages = require('../net/kmdmessages');
const cctokens = require('../cc/cctokensv2');

// create peer group
const NspvPeerGroup = require('../net/nspvPeerGroup');
//const PeerGroup = require('../net/peerGroup');
const peerutils = require('../net/utils');
require('../net/nspvPeer');  // init peer.js too

const networks = require('../src/networks');
//const mynetwork = networks.rick; 
//const mynetwork = networks.tok6;
//const mynetwork = networks.dimxy23;
//const mynetwork = networks.dimxy20;
//const mynetwork = networks.dimxy24;
const mynetwork = networks.tkltest;
//const mynetwork = networks.tokel;

// you will need to do a call like:
// ccbasic.cryptoconditions = await ccimp;
// to init the cryptoconditions wasm lib before cc usage
// (this is due to wasm delayed loading specifics)
const ccbasic = require('../cc/ccbasic');
let ccimp;
if (process.browser)
  ccimp = import('@tokel/cryptoconditions');
else
  ccimp = require('@tokel/cryptoconditions');


// additional seeds:
// (default seeds are in the mynetwork object)

/*
to connect over p2p:
var dnsSeeds = [
]
//to connect over p2p
var staticPeers = [
  '127.0.0.1:14722'
  //'167.99.114.240:22024'
  //'3.19.194.93:22024',
  //'127.0.0.1:27513',
  //'18.190.86.67:14722'
  //'18.189.25.123:14722'
  //'rick.kmd.dev:25434'
  //'3.136.47.223:14722'
] 
// to connect over websockets:
var webSeeds = [
  //'ws://18.189.25.123:8192'
  //'wss://18.189.25.123:8192'
  //'ws://3.136.47.223:8192'
  // TODO: add more
]
*/

var params = {
  network: mynetwork,  // contains magic and seeds
  //defaultPort: defaultPort,
  //dnsSeeds: dnsSeeds,
  //webSeeds: webSeeds,
  //staticPeers: staticPeers,  // dnsSeed works also
  protocolVersion: 170009,
  messages: kmdmessages.kmdMessages
}

var opts = {
  //connectWeb: true,     // use pxp websockets, not used
  //wrtc: wrtc,          // not supported any more
  numPeers: 8,
  //hardLimit: 2,        // max peers
  //connectPlainWeb: true,  // use plain websockets, no PXP
  wsOpts: { rejectUnauthorized: false }  // enable self-signed certificates
}

var peers;

// sleep to insert delay between nspv calls to bypass the old nspv rate limiter
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Example test calls running under nodejs
const mytokencreatewif = 'UpUdyyTPFsXv8s8Wn83Wuc4iRsh5GDUcz8jVFiE3SxzFSfgNEyed';
const mytokentransferwif = 'UwoxbMPYh4nnWbzT4d4Q1xNjx3n9rzd6BLuato7v3G2FfvpKNKEq';
const mydestpubkey = "035d3b0f2e98cf0fba19f80880ec7c08d770c6cf04aa5639bc57130d5ac54874db";
//const mydestpubkey = "034777b18effce6f7a849b72de8e6810bf7a7e050274b3782e1b5a13d0263a44dc";
//const mytokenid = "38b58149410b5d53f03b06e38452e7b0e232e561a65b89a4517c7dc518e7e739";
const mytokenid = "102cc18e4cd8bf48438196f6713d5cf195eb29e19afd2a06168940190c8df9b6";
//const mytokenid = "f372e9e0c07ce57ccc2a0256ad4febd968757db55156ee954ff23e28e424efb9"; //tokel
/*
if (!process.browser) 
{
  peers = new NspvPeerGroup(params, opts);
  peers.on('peer', (peer) => {    
    console.log('added new peer', peerutils.getPeerUrl(peer))
  });
  // create connections to peers
  peers.nspvConnect(async () => {
  
    try {

      // load cryptoconditions lib
      ccbasic.cryptoconditions = await ccimp;

      // Several tests (uncomment needed):
      
      // test get blocks from peer (TODO: update for kmd block and transactions support) : 
      // var hashes = [  bufferutils.reverseBuffer(Buffer.from("099751509c426f89a47361fcd26a4ef14827353c40f42a1389a237faab6a4c5d", 'hex')) ];
      // let blocks = peers.getBlocks(hashes, {});
      // console.log('blocks:', blocks);

      // test get normal utxos from an address:
      //let utxos = await ccutils.getNormalUtxos(peers, faucetcreateaddress);
      //console.log('utxos=', utxos);

      // it should be at least 1 sec between the same type nspv requests (here it is NSPV_UTXOS)
      // await sleep(1100)

      // get cc utxos:
      //let ccutxos = await ccutils.getCCUtxos(peers, faucetGlobalAddress);
      //console.log('cc utxos=', ccutxos); 

      // make cc token create tx
      //let tx = await cctokens.tokensv2CreateTokel(peers, mynetwork, mytokencreatewif, "MYNFT", "MyDesc", 1, JSON.parse('{"royalty": 1, "id":414565, "url":"https://site.org", "arbitrary":"0202ABCDEF"}'));
      //let tx = await cctokens.tokensv2CreateTokel(peers, mynetwork, mytokencreatewif, "MYNFT", "MyDesc", 10, JSON.parse('{"royalty": 1}'));
      //console.log('txhex=', tx.toHex());

      // make cc token transfer tx
      //let tx = await cctokens.tokensv2Transfer(peers, mynetwork, mytokencreatewif, mytokenid, mydestpubkey, 1);
      //console.log('txhex=', tx.toHex());

      // tkltest
      //let info = await cctokens.tokensInfoV2Tokel(peers, mynetwork, mytokencreatewif, "d45689a1b667218c8ed400ff5603b5e7b745df8ef39c3c1b27f74a1fed6f630a");
      // tokel
      let info = await cctokens.tokensInfoV2Tokel(peers, mynetwork, mytokencreatewif, mytokenid);
      console.log('info=', info);

      // make tx with normal inputs for the specified amount
      // not used let txwnormals = await ccutils.createTxAddNormalInputs('035d3b0f2e98cf0fba19f80880ec7c08d770c6cf04aa5639bc57130d5ac54874db', 100000000*190000);
      //console.log('txwnormals=', txwnormals);

      //let v = await cctokens.getTokensForPubkey(mynetwork, peers, Buffer.from("02bd54776ba32d42c06a17f7a32344b4775c185ef7c48417698b1262e8c91d07ff", 'hex'), 0, 0);
      //console.log('validate=', v);

    }
    catch(err) {
      console.log('caught err=', err, 'code=', err.code, 'message=', err.message);
    }
    peers.close();
    console.log('test finished, waiting for peers to close...');
  });
}
*/
//const Debug = require('debug')
//const logdebug = Debug('net:peergroup')
//const utils = require('../net/utils');
const nspvConnect = require('../net/connect');

async function testNspv() {
  let peers
  try {
    peers = await nspvConnect(params, opts);
    //await sleep(1000);
    // load cryptoconditions lib
    ccbasic.cryptoconditions = await ccimp;
    let info = await cctokens.tokensInfoV2Tokel(peers, mynetwork, mytokencreatewif, mytokenid);
    console.log('info1=', info);
    info = await cctokens.tokensInfoV2Tokel(peers, mynetwork, mytokencreatewif, mytokenid);
    console.log('info2=', info);
    info = await cctokens.tokensInfoV2Tokel(peers, mynetwork, mytokencreatewif, mytokenid);
    console.log('info3=', info);
    info = await cctokens.tokensInfoV2Tokel(peers, mynetwork, mytokencreatewif, mytokenid);
    console.log('info4=', info);
    info = await cctokens.tokensInfoV2Tokel(peers, mynetwork, mytokencreatewif, mytokenid);
    console.log('info5=', info);
    info = await cctokens.tokensInfoV2Tokel(peers, mynetwork, mytokencreatewif, mytokenid);
    console.log('info6=', info);
  }
  catch(err) {
    console.log('caught err=', err, 'code=', err.code, 'message=', err.message);
  }
  if (peers)
    peers.close();
  console.log('test finished, waiting for peers to close...');
}

testNspv();

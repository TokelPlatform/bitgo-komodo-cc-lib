
'use strict';

//const kmdmessages = require('../net/kmdmessages');
const cctokens = require('../cc/cctokensv2');
const ccassets = require('../cc/ccassetsv2');
const ccutils = require('../cc/ccutils');
const ecpair = require('../src/ecpair');
const Transaction = require('../src/transaction');
const Block = require('../src/block');
const address = require('../src/address');

// create peer group
const NspvPeerGroup = require('../net/nspvPeerGroup');
//const PeerGroup = require('../net/peerGroup');
require('../net/nspvPeer');  // init peer.js too

const networks = require('../src/networks');
//const mynetwork = networks.rick; 
//const mynetwork = networks.tok6;
//const mynetwork = networks.dimxy23;
const mynetwork = networks.DIMXY24;
// const mynetwork = networks.dimxy25;
//const mynetwork = networks.tkltest;


// you will need to do a call like:
// ccbasic.cryptoconditions = await ccimp;
// to init the cryptoconditions wasm lib before cc usage
// (this is due to wasm delayed loading specifics)
const ccbasic = require('../cc/ccbasic');
var ccimp = require('../cc/ccimp');   // you will need to do a call like:
const { NSPVMSGS } = require('../net/kmdtypes');
                                      // ccbasic.cryptoconditions = await ccimp;
                                      // to init the cryptoconditions wasm lib before cc usage (this is due to wasm delayed loading specifics)


// additional seeds:
// (default seeds are in the mynetwork object)
/*
to connect over p2p:
var dnsSeeds = [
]
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
*/

var params = {
  network: mynetwork,
  //defaultPort: defaultPort,
  //dnsSeeds: dnsSeeds,
  //webSeeds: webSeeds,
  //staticPeers: staticPeers,  // dnsSeed works also
  //protocolVersion: 170009,
  //messages: kmdmessages.kmdMessages
}

var opts = {
  // connectWeb: true,     // use pxp websockets, not used
  //wrtc: wrtc,          // not supported any more
  numPeers: 8,
  //hardLimit: 2,        // max peers
  //connectPlainWeb: true,  // use plain websockets, no PXP
  wsOpts: { rejectUnauthorized: false }  // enable self-signed certificates
}

var peers;

// Example test calls running under nodejs
const mytokencreatewif = 'UpUdyyTPFsXv8s8Wn83Wuc4iRsh5GDUcz8jVFiE3SxzFSfgNEyed';
const mytokentransferwif = 'UwoxbMPYh4nnWbzT4d4Q1xNjx3n9rzd6BLuato7v3G2FfvpKNKEq';
const mynormalwif = 'UpUhjzv1x6gQoiRL6GkM4Yb44uYPjxshqigVdNSaUqpwDkoqFsGm'; //RTbiYv9u1mrp7TmJspxduJCe3oarCqv9K4
//const mydestpubkey = "035d3b0f2e98cf0fba19f80880ec7c08d770c6cf04aa5639bc57130d5ac54874db";
const mynormalwif2 = 'UuKUSQHnRGk4CDbRnbLRrJHq5Dwx58qR9Q9K2VpJjn3APXLurNcu';
const mydestpubkey = "034777b18effce6f7a849b72de8e6810bf7a7e050274b3782e1b5a13d0263a44dc";
//const mytokenid = "2bea503a491cae096b0c2af48d504e4fbd7c4747f49eddbb5d2723d6287769f8";
//const mytokenid = "d45689a1b667218c8ed400ff5603b5e7b745df8ef39c3c1b27f74a1fed6f630a";
//const mytokenid = "f24e159ba9dce0ecdbe9e066518da063ea2028da01b9b09b97e13d81b345743c";
//const mytokenid = "00ae855df4c4a62a97e4bd1ff7719b4a33abb346c37c2953ee82d52fd1397782"; 100sat
//const mytokenid = "c8bb05e81929e548835a5b7953608e0ea5158a8e51db073b6b53f076af61e15b";  //nft roaylty999
//const mytokenid = "60c01f20d0188ffef811542b1893051459f44aaf32dc869a9536af5b3b410216";  //nft roaylty999
//const mytokenid = "2631002692d3b69ae24019e75ac2c39c16ec06a0bb162513dddcb2cb8b6170c3"; //nft roaylty500
//const mytokenid = "0363312d88b7b7f7b22a6880b64bc9e58ed1cdf7dc4655ff5a378cf66dde61d0"; //nft roaylty500
const mytokenid = "d2d7bc270528687a1b1934b1535eee3608e72e8a468419d8b344862ebaee6d1e"; //nft roaylty500

// sleep to insert delay between nspv calls to bypass the old nspv rate limiter
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


if (!process.browser) 
{
  peers = new NspvPeerGroup(params, opts);
  peers.on('connectError', (err, peer) => {
    // some peers may fail to connect to, but this okay as long as there enough peers in the network
    if (!peers.hasMethods())  { // no working methods found
      console.log("got 'connectError'", "'" + err.message + "'", "no connect methods, exiting...");
      peers.close();
    }
  });
  // create connections to peers
  peers.connect(async () => {
  
    try {

      // load cryptoconditions lib
      ccbasic.cryptoconditions = await ccimp;

      // Several tests (uncomment needed):
      let mywif = mytokencreatewif;
      let mywif2 = mynormalwif2;
      //let mypair = ecpair.fromWIF(mywif, mynetwork);
      //let mypk = mypair.getPublicKeyBuffer();
      const retries = 24;

      // create ask
      let asktx = await ccassets.tokenv2ask(peers, mynetwork, mywif, 1, mytokenid, 0.0002)
      let asktxid = asktx.getHash();
      console.log("tokenv2ask=", asktx.toHex(), 'asktxid', ccutils.hashToHex(asktxid));
      await ccutils.nspvBroadcast(peers, asktxid, asktx.toHex());
      console.log('tokenv2ask sent');

      // create fillask
      let fillasktxid;
      for(let i = 0; i < retries; i ++) {  // 2 min
        console.log("waiting for mining...");
        await sleep(10000);
        try {
          let filltx = await ccassets.tokenv2fillask(peers, mynetwork, mywif2, mytokenid, asktxid, 1);
          fillasktxid = filltx.getHash();
          console.log("tokenv2fillask tx=", filltx.toHex(), 'fillasktxid', ccutils.hashToHex(fillasktxid));
          await ccutils.nspvBroadcast(peers, fillasktxid, filltx.toHex());
          console.log('tokenv2fillask sent');
          break;
        } catch(e) {
          console.log('tokenv2fillask error', e);
          if (e.nspvReq && e.nspvReq === NSPVMSGS.NSPV_BROADCAST) throw new Error('cant send tokenv2cancelbid tx');
        }
      }
      if (!fillasktxid) throw new Error('cant create fill ask');

      // new ask 
      let asktxid2
      for(let i = 0; i < retries; i ++) {
        console.log("waiting for mining...");
        await sleep(10000);
        try {
          let asktx2 = await ccassets.tokenv2ask(peers, mynetwork, mywif2, 1, mytokenid, 0.0002);
          asktxid2 = asktx2.getHash();
          console.log("tokenv2ask-2=", asktx2.toHex(), 'asktxid2', ccutils.hashToHex(asktxid2));
          await ccutils.nspvBroadcast(peers, asktxid2, asktx2.toHex());
          console.log('tokenv2ask 2 sent');
          break;
        } catch(e) {
          console.log('tokenv2ask error', e);
          if (e.nspvReq && e.nspvReq === NSPVMSGS.NSPV_BROADCAST) throw new Error('cant send tokenv2cancelbid tx');
        }
      }
      if (!asktxid2) throw new Error('cant create ask 2');

      // create cancelask
      let cancelasktxid;
      for(let i = 0; i < retries; i ++) {
        console.log("waiting for mining...");
        await sleep(10000);
        try {
          let canceltx = await ccassets.tokenv2cancelask(peers, mynetwork, mywif2, mytokenid, asktxid2);
          cancelasktxid = canceltx.getHash();
          console.log("tokenv2cancelask tx=", canceltx.toHex(), 'cancelasktxid', ccutils.hashToHex(cancelasktxid));
          await ccutils.nspvBroadcast(peers, cancelasktxid, canceltx.toHex());
          console.log('tokenv2cancelask sent');
          break;
        } catch(e) {
          console.log('tokenv2cancelask error', e);
          if (e.nspvReq && e.nspvReq === NSPVMSGS.NSPV_BROADCAST) throw new Error('cant send tokenv2cancelbid tx');
        }
      }
      if (!cancelasktxid) throw new Error('cant create cancel ask');

      // create bid
      let bidtxid
      for(let i = 0; i < retries; i ++) {  // 2 min
        try {
          let bidtx = await ccassets.tokenv2bid(peers, mynetwork, mywif, 1, mytokenid, 0.0002)
          bidtxid = bidtx.getHash();
          console.log("tokenv2bid=", bidtx.toHex(), 'bidtxid', ccutils.hashToHex(bidtxid));
          await ccutils.nspvBroadcast(peers, bidtxid, bidtx.toHex());
          console.log('tokenv2bid sent');
          break;
        } catch(e) {
          console.log('tokenv2bid error', e);
          if (e.nspvReq && e.nspvReq === NSPVMSGS.NSPV_BROADCAST) throw new Error('cant send tokenv2cancelbid tx');
        }
        console.log("waiting for mining...");
        await sleep(10000);
      }
      if (!bidtxid) throw new Error('cant create tokenv2bid');

      // create fillbid
      let fillbidtxid;
      for(let i = 0; i < retries; i ++) {  // 2 min
        console.log("waiting for mining...");
        await sleep(10000);
        try {
          let filltx = await ccassets.tokenv2fillbid(peers, mynetwork, mywif2, mytokenid, bidtxid, 1);
          fillbidtxid = filltx.getHash();
          console.log("tokenv2fillbid tx=", filltx.toHex(), 'fillbidtxid', ccutils.hashToHex(fillbidtxid));
          await ccutils.nspvBroadcast(peers, fillbidtxid, filltx.toHex());
          console.log('tokenv2fillbid sent');
          break;
        } catch(e) {
          console.log('tokenv2fillbid error', e);
          if (e.nspvReq && e.nspvReq === NSPVMSGS.NSPV_BROADCAST) throw new Error('cant send tokenv2cancelbid tx');
        }
      }
      if (!fillbidtxid) throw new Error('cant create tokenv2fillbid');

      // new bid 
      let bidtxid2
      for(let i = 0; i < retries; i ++) {
        console.log("waiting for mining...");
        await sleep(10000);
        try {
          let bidtx2 = await ccassets.tokenv2bid(peers, mynetwork, mywif, 1, mytokenid, 0.0002);
          bidtxid2 = bidtx2.getHash();
          console.log("tokenv2bid-2=", bidtx2.toHex(), 'bidtxid2', ccutils.hashToHex(bidtxid2));
          await ccutils.nspvBroadcast(peers, bidtxid2, bidtx2.toHex());
          console.log('tokenv2bid 2 sent');
          break;
        } catch(e) {
          console.log('tokenv2bid error', e);
          if (e.nspvReq && e.nspvReq === NSPVMSGS.NSPV_BROADCAST) throw new Error('cant send tokenv2cancelbid tx');
        }
      }
      if (!bidtxid2) throw new Error('cant create tokenv2bid 2'); 
      //let bidtxid2 = ccutils.castHashBin("a600e9deeac798809323361c0d1637344a62bb71e99f68bdcf76b8a8388fbc79");
      // create cancelbid
      let cancelbidtxid;
      for(let i = 0; i < retries; i ++) {
        console.log("waiting for mining...");
        await sleep(10000);
        try {
          let canceltx = await ccassets.tokenv2cancelbid(peers, mynetwork, mywif, mytokenid, bidtxid2);
          cancelbidtxid = canceltx.getHash();
          console.log("tokenv2cancelbid tx=", canceltx.toHex(), 'cancelbidtxid', ccutils.hashToHex(cancelbidtxid));
          await ccutils.nspvBroadcast(peers, cancelbidtxid, canceltx.toHex());
          console.log('tokenv2cancelbid sent');
          break;
        } catch(e) {
          console.log('tokenv2cancelbid error', e);
          if (e.nspvReq && e.nspvReq === NSPVMSGS.NSPV_BROADCAST) throw new Error('cant send tokenv2cancelbid tx');
        }
      }
      if (!cancelbidtxid) throw new Error('cant create tokenv2cancelbid');

    }
    catch(err) {
      console.log('caught err=', err, 'code=', err.code, 'message=', err.message);
    }
    peers.close();
    console.log('test finished, waiting for peers to close...');
  });
}

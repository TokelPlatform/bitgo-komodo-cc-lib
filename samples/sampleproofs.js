
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

const ntzsproofs = require('../cc/ntzproofs');

var bmp = require('bitcoin-merkle-proof')


// create peer group
var NspvPeerGroup = require('../net/nspvPeerGroup');
require('../net/nspvPeer');  // init peer.js too

const networks = require('../src/networks');
//const mynetwork = networks.rick; 
//const mynetwork = networks.dimxy19;
//const mynetwork = networks.tok6; 
//const mynetwork = networks.tkltest; 
const mynetwork = networks.tokel; 


/*
to connect over p2p:
var dnsSeeds = [
]
*/

// to connect over p2p
var staticPeers = [
    //'18.189.25.123:14722'
    //'rick.kmd.dev:25434'
    '127.0.0.1:22024'
] 


// to connect over websockets:
var webSeeds = [
    //'ws://18.189.25.123:8192'
    //'ws://localhost:8192'
    'ws://3.136.47.223:8192'
    // TODO: add more
]

var params = {
    network: mynetwork,
    //defaultPort: 8192,
    //dnsSeeds: dnsSeeds,
    //webSeeds: webSeeds,
    //staticPeers: staticPeers,  // dnsSeed works also
    //protocolVersion: 170009,
    //messages: kmdmessages.kmdMessages
}

var opts = {
    //connectWeb: true,     // use websockets
    //wrtc: wrtc,          // not supported any more
    numPeers: 8,
    //hardLimit: 2,        // max peers
    //connectPlainWeb: true,  // use plain websockets, no PXP
    wsOpts: { rejectUnauthorized: false } 
}

var peers;

// connect to peers, for calling from browser
function Connect()
{
  peers = new NspvPeerGroup(params, opts);
  peers.on('peer', (peer) => {
    //console.log('in event: connected to peer', peer.socket.remoteAddress)
  }
);

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
  
if (!process.browser) 
{
  peers = new NspvPeerGroup(params, opts);
  peers.on('peer', (peer) => {
    // console.log('in event: connected to peer', peer.socket.remoteAddress)
  });
  // create connections to peers
  peers.nspvConnect(async () => {
  
    try {

      // tests:
      
      // get txproof for txid:
      let txid = 'fcaf0d4ca6c7392fe67474738da9f51acacd74bd31ae29260085ec9254020768'  // tokel h=10000
      //let txid = '118a95dd6aa92bedc13f223ad5f51a6d6c113313b0f2cc16107e2cac0ccf643c' // dimxy24
      //let txid = 'cce11829d3589cb930ededbf6c0da5cd6d38ac860717308d345f151e7666b54a' //tkltest
      
      /*
      let txproofresp = await ntzsproofs.nspvTxProof(peers, txid, 0, 0); //tokel
      console.log('txproofresp=', txproofresp); 
      let hashes = bmp.verify(txproofresp.partialMerkleTree);
      console.log('verify result compare txids =', hashes.length > 0 ? Buffer.compare(hashes[0], ccutils.txidFromHex(txid)) == 0 : null );
      */


      /*let ntzresp = await ntzsproofs.nspvNtzs(peers, 10000);
      console.log('ntzresp=', ntzresp);

      let ntzsproofresp = await ntzsproofs.nspvNtzsProof(peers, ntzresp.prevntz.txid, ntzresp.nextntz.txid);
      console.log('ntzsproofresp=', ntzsproofresp);
      */
      
      let ntzvalid = await ntzsproofs.validateTxUsingNtzsProof(peers, mynetwork, txid, 10000);
      console.log("ntzvalid=", ntzvalid);

      //let txproofvalid = await ntzsproofs.validateTxUsingTxProof(peers, txid);
      //console.log("txproof valid=", txproofvalid);

      /* download headers
      let locnew = Buffer.from("0c750b86967a5873b3c3f4ba46f1188b731a82327799aa888598582aa61f654b", 'hex');
      let loc = Buffer.from([]);
      let getHeaders = function()
      {
        if (Buffer.compare(loc, locnew) != 0)  {
          loc = locnew;
          console.log('loc', ccutils.txidToHex(loc));
          peers.getHeaders([loc], {}, (err, headers) => {
            if (headers) {
              console.log("received headers", headers.length);
              if (headers.length)
                locnew = ntzsproofs.NSPV_hdrhash(headers[headers.length-1].header);
            }
          });
        }
      }
      let ghInt = setInterval(getHeaders, 10);   */


    }
    catch(err) {
      console.log('caught err=', err, 'code=', err.code, 'message=', err.message);
    }

    peers.close();
    console.log('test finished, waiting for peers to close...');
  });

}

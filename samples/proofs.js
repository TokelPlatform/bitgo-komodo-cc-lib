
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
const kmdblockindex = require('../src/kmdblockindex');

var bmp = require('bitcoin-merkle-proof')


// create peer group
var NspvPeerGroup = require('../net/nspvPeerGroup');
require('../net/nspvPeer');  // init peer.js too

const networks = require('../src/networks');
//const mynetwork = networks.rick; 
//const mynetwork = networks.dimxy19;
//const mynetwork = networks.tok6; 
//const mynetwork = networks.tkltest; 
const mynetwork = networks.TOKEL; 


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

/*
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
*/

//exports.Connect = Connect;
  
if (!process.browser) 
{
  peers = new NspvPeerGroup(params, opts);
  peers.on('peer', (peer) => {
    // console.log('in event: connected to peer', peer.socket.remoteAddress)
  });
  peers.on('connectError', (err, peer) => {
    // some peers may fail to connect to, but this okay as long as there enough peers in the network
    if (!peers.hasMethods())  { // nothing to do
      console.log("got 'connectError'", "'" + err.message + "'", "no connect methods, exiting...");
      peers.close();
    }
  });

  peers.on('peerError', err => {
    // some peers may fail to connect to, but this okay as long as there enough peers in the network
    console.log("got 'peerError'", err.message);
  });
  peers.on('peerGroupError', err => {
    // maybe let the GUI print the error  
    console.log("got 'peerGroupError'", err.message, 'exiting...')
    peers.close();
  });
  peers.on('error', err => {
    // maybe let the GUI print the error  
    console.log("got 'error'", err.message)
  });


  // create connections to peers
  peers.nspvConnect(async () => {
  
    try {

      // tests:
      
      // get txproof for txid:
      //let txid = 'fcaf0d4ca6c7392fe67474738da9f51acacd74bd31ae29260085ec9254020768'  // tokel h=10000
      //let ht = 10000;

      //let txid = '118a95dd6aa92bedc13f223ad5f51a6d6c113313b0f2cc16107e2cac0ccf643c' // DIMXY24
      //let txid = 'cce11829d3589cb930ededbf6c0da5cd6d38ac860717308d345f151e7666b54a' //tkltest
      
      /*
      let txproofresp = await ntzsproofs.nspvTxProof(peers, txid, 0, 0); //tokel
      console.log('txproofresp=', txproofresp); 
      let hashes = bmp.verify(txproofresp.partialMerkleTree);
      console.log('verify result compare txids =', hashes.length > 0 ? Buffer.compare(hashes[0], ccutils.hashFromHex(txid)) == 0 : null );
      */


      let ntzresp = await ntzsproofs.nspvNtzs(peers, 10000);
      console.log('ntzresp=', ntzresp);

      let ntzsproofresp = await ntzsproofs.nspvNtzsProof(peers, ntzresp.ntz.txid);
      console.log('ntzsproofresp=', ntzsproofresp);
      
      
      /*
      let txid1 = '22eca5965bc69361183653aa69fdcdc4f90a3b4a7b39c96e36d042478ff54e34'; 
      let ht1 = 120000;
      let ntzvalid1 = await ntzsproofs.validateTxUsingNtzsProof(peers, mynetwork, txid1, ht1);
      console.log("ntzvalid1=", ntzvalid1);

      try {
        let txid2 = '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b'; 
        let ht2 = 0;  //bad height
        let ntzvalid2 = await ntzsproofs.validateTxUsingNtzsProof(peers, mynetwork, txid2, ht2);
        console.log("bad height ntzvalid2=", ntzvalid2);
        if (ntzvalid2) throw new Error('bad height valid');
      }
      catch(e)  {
        console.log("bad height=", e.message);
      }

      // ht = notarised ht, +/-1
      let txid3 = '5ab764cfd72ecdebf5bb817d02713d48fc103be91ae8fdf7ce56386ada73d1ab'; 
      let ht3 = 119998;
      let ntzvalid3 = await ntzsproofs.validateTxUsingNtzsProof(peers, mynetwork, txid3, ht3);
      console.log("ntzvalid3=", ntzvalid3);
      
      let txid4 = '6f6e5fc10c2410db164dcdfd7450bbd5b36840f6878bcbf0a2e629f42550023c'; 
      let ht4 = 119997;
      let ntzvalid4 = await ntzsproofs.validateTxUsingNtzsProof(peers, mynetwork, txid4, ht4);
      console.log("ntzvalid4=", ntzvalid4);

      let txid5 = '07bc802db63d11ce537ac6127ec5180ee10610be076c4f3096a579bb10d784f9'; 
      let ht5 = 119999;
      let ntzvalid5 = await ntzsproofs.validateTxUsingNtzsProof(peers, mynetwork, txid5, ht5);
      console.log("ntzvalid5=", ntzvalid5);

      try {
        let txid6 = 'f448568a2002a1583c8d6414d2ddf1c91fdbff01d4c0e0f66d3a505cede62ccd';
        let ht6 = 1;
        let ntzvalid6 = await ntzsproofs.validateTxUsingNtzsProof(peers, mynetwork, txid6, ht6);
        console.log("bad height ntzvalid6=", ntzvalid6);
        if (ntzvalid6) throw new Error('bad height valid');
      }
      catch(e)  {
        console.log("bad height=", e.message);
      }

      // ht == notary txid ht, +/-1
      let txid7 = '1c24496526f92113f1bec8b0c76bdd66a55bee41f63bbc20f11dd9a324e49435'; 
      let ht7 = 119994;
      let ntzvalid7 = await ntzsproofs.validateTxUsingNtzsProof(peers, mynetwork, txid7, ht7);
      console.log("ntzvalid7=", ntzvalid7);
      
      let txid8 = '2ba06f6a36d592aa64f01a6522f07ac151dfd9abdb3f6d8074922e5d79afd879'; 
      let ht8 = 119993;
      let ntzvalid8 = await ntzsproofs.validateTxUsingNtzsProof(peers, mynetwork, txid8, ht8);
      console.log("ntzvalid8", ntzvalid8);

      let txid9 = '76811b4051e72d73f718697bdb3006a6187ffe596bb71bed6c2e5286a6829447'; 
      let ht9 = 119995;
      let ntzvalid9 = await ntzsproofs.validateTxUsingNtzsProof(peers, mynetwork, txid9, ht9);
      console.log("ntzvalid9=", ntzvalid9);
      */
      //let txproofvalid = await ntzsproofs.validateTxUsingTxProof(peers, txid);
      //console.log("txproof valid=", txproofvalid);

      /* download headers
      let locnew = Buffer.from("0c750b86967a5873b3c3f4ba46f1188b731a82327799aa888598582aa61f654b", 'hex');
      let loc = Buffer.from([]);
      let getHeaders = function()
      {
        if (Buffer.compare(loc, locnew) != 0)  {
          loc = locnew;
          console.log('loc', ccutils.hashToHex(loc));
          peers.getHeaders([loc], {}, (err, headers) => {
            if (headers) {
              console.log("received headers", headers.length);
              if (headers.length)
                locnew = kmdblockindex.kmdHdrHash(headers[headers.length-1].header);
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

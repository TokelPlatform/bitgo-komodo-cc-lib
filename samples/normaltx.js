
'use strict';

const TransactionBuilder = require('../src/transaction_builder');
const Transaction = require('../src/transaction');
const kmdmessages = require('../net/kmdmessages');
const ccutils = require('../cc/ccutils');
const ecpair = require('../src/ecpair');

// create peer group
var NspvPeerGroup = require('../net/nspvPeerGroup');
require('../net/nspvPeer');  // init peer.js too

const networks = require('../src/networks');
//const mynetwork = networks.rick; 
//const mynetwork = networks.dimxy19;
//const mynetwork = networks.tok6; 
//const mynetwork = networks.tkltest; 
//const mynetwork = networks.dimxy23;
const mynetwork = networks.dimxy24;



// not used for plan websockets, only for PXP which is not supported
var defaultPort = 1111

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


/*
to connect over p2p:
var dnsSeeds = [
]
*/

// to connect over p2p
var staticPeers = [
  //'18.189.25.123:14722'
  '18.190.86.67:14722'
  //'rick.kmd.dev:25434'
  // '127.0.0.1:22024' // tkltest
  //'127.0.0.1:14722'  // dimxy chain def port

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
  //webSeeds: webSeeds,
  staticPeers: staticPeers,  // dnsSeed works also
  protocolVersion: 170009,
  messages: kmdmessages.kmdMessages
}

var opts = {
  //connectWeb: true,     // use websockets
  //wrtc: wrtc,          // not supported any more
  numPeers: 8,
  //hardLimit: 2,        // max peers
  //connectPlainWeb: true,  // use plain websockets, no PXP
  //wsOpts: { rejectUnauthorized: false } 
}

var peers;


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

exports.create_normaltx = create_normaltx;
async function create_normaltx(_wif, _destaddress, _satoshi) {
  let wif = _wif;
  let destaddress = _destaddress;
  let satoshi  = _satoshi;
  let tx = await makeNormalTx(wif, destaddress, satoshi);

  return tx.toHex();
};


// tx creation code

async function makeNormalTx(wif, destaddress, amount) 
{
  // init lib cryptoconditions
  p2cryptoconditions.cryptoconditions = await ccimp;  // note we need cryptoconditions here bcz it is used in FinalizCCtx o check if a vin is normal or cc 

  const txbuilder = new TransactionBuilder(mynetwork);
  const txfee = 10000;

  let mypair = ecpair.fromWIF(wif, mynetwork);
  let txwutxos = await ccutils.createTxAndAddNormalInputs(peers, mypair.getPublicKeyBuffer(), amount + txfee);

  let tx = Transaction.fromBuffer(Buffer.from(txwutxos.txhex, 'hex'), mynetwork);

  // zcash stuff:
  txbuilder.setVersion(tx.version);
  if (txbuilder.tx.version >= 3)
    txbuilder.setVersionGroupId(tx.versionGroupId);

  // parse txwutxos.previousTxns and add them as vins to the created tx
  let added = ccutils.addInputsFromPreviousTxns(txbuilder, tx, txwutxos.previousTxns, mynetwork);
  if (added < amount + txfee)
    throw new Error("insufficient normal inputs (" + added + ")")

  txbuilder.addOutput(destaddress, amount);
  let myaddress = ccutils.pubkey2NormalAddressKmd(mypair.getPublicKeyBuffer());  // pk to kmd address
  txbuilder.addOutput(myaddress, added - amount - txfee);  // change

  if (txbuilder.tx.version >= 4)
    txbuilder.setExpiryHeight(tx.expiryHeight);

  ccutils.finalizeCCtx(mypair, txbuilder);  // sign inputs
  return txbuilder.build();
}

// test key:
const mywif = 'UpUdyyTPFsXv8s8Wn83Wuc4iRsh5GDUcz8jVFiE3SxzFSfgNEyed';

if (!process.browser) 
{
  peers = new NspvPeerGroup(params, opts);
  peers.on('peer', (peer) => {
    // console.log('in event: connected to peer', peer.socket.remoteAddress)
  });
  // create connections to peers
  peers.connect(async () => {
  
    try {

      // tests:
      
      // make a normal tx
      //let txhex = await create_normaltx(mywif, "RR2nTYFBPTJafxQ6en2dhUgaJcMDk4RWef", 5000);  // amount in satoshi
      //console.log('txhex=', txhex);

      let txids = await ccutils.getTxids(peers, "RR2nTYFBPTJafxQ6en2dhUgaJcMDk4RWef", 0, 0, 0);
      console.log('txids=', txids);

    }
    catch(err) {
      console.log('caught err=', err, 'code=', err.code, 'message=', err.message);
    }
  });
}

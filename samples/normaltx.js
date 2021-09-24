
'use strict';

const TransactionBuilder = require('../src/transaction_builder');
const Transaction = require('../src/transaction');
const Block = require('../src/block');
const kmdmessages = require('../net/kmdmessages');
const ccutils = require('../cc/ccutils');
const cctokens = require('../cc/cctokensv2');
const ecpair = require('../src/ecpair');
const addressutils = require('../src/address');

// create peer group
var NspvPeerGroup = require('../net/nspvPeerGroup');
require('../net/nspvPeer');  // init peer.js too

const networks = require('../src/networks');
//const mynetwork = networks.rick; 
//const mynetwork = networks.dimxy19;
//const mynetwork = networks.tok6; 
const mynetwork = networks.tkltest; 
//const mynetwork = networks.dimxy23;
//const mynetwork = networks.dimxy24;
//const mynetwork = networks.tokel; 

// not used for plan websockets, only for PXP which is not supported
var defaultPort = 1111

// you will need to do a call like:
// ccbasic.cryptoconditions = await ccimp;
// to init the cryptoconditions wasm lib 
// (this is due to wasm delayed loading specifics)
const ccbasic = require('../cc/ccbasic');
var ccimp;
if (process.browser)
  ccimp = import('@tokel/cryptoconditions'); 
else
  ccimp = require('@tokel/cryptoconditions'); 

/*
to connect over p2p:
var dnsSeeds = [
]
*/

// to connect over p2p
var staticPeers = [
  //'18.189.25.123:14722'
  // '18.190.86.67:14722'
  //'rick.kmd.dev:25434'
  //'127.0.0.1:22024' // tkltest
  //'127.0.0.1:29404' //  tokel

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
  network: mynetwork,
  //defaultPort: defaultPort,
  //dnsSeeds: dnsSeeds,
  //webSeeds: webSeeds,
  //staticPeers: staticPeers,  // dnsSeed works also
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
  ccbasic.cryptoconditions = await ccimp;  // note we need cryptoconditions here bcz it is used in FinalizCCtx o check if a vin is normal or cc 

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
      ccbasic.cryptoconditions = await ccimp;  // init cryptoconditions var

      let mypair = ecpair.fromWIF(mywif, mynetwork);
      let mypk = mypair.getPublicKeyBuffer();
      // tests:
      
      // make a normal tx
      //let txhex = await create_normaltx(mywif, "RR2nTYFBPTJafxQ6en2dhUgaJcMDk4RWef", 5000);  // amount in satoshi
      //let txhex = await create_normaltx(mywif, "RAsjA3jDLMGMNAtkx7RyPiqvkrmJPqCzfQ", 5000);
      //console.log('txhex=', txhex);

      let result
      //let result = await ccutils.getTxids(peers, "RR2nTYFBPTJafxQ6en2dhUgaJcMDk4RWef", 0, 0, 0);
      //let result = await ccutils.getTxids(peers, "RUXnkW5xrGJe4MG8B7YzM7YhuSoE44RVTe", 0, 0, 0);
      //let result = await ccutils.getUtxos(peers, "RUXnkW5xrGJe4MG8B7YzM7YhuSoE44RVTe", 0, 0, 0);
      //result = await ccutils.getUtxos(peers, "RAsjA3jDLMGMNAtkx7RyPiqvkrmJPqCzfQ", 0, 0, 0);
      /////result = await ccutils.getUtxos(peers, "RAsjA3jDLMGMNAtkx7RyPiqvkrmJPqCzfA", 0, 0, 0); // bad addr (zfQ->zfA)
      //result = await ccutils.getUtxos(peers, "RAsjA3jDLMGMNAtkx7RyPiqvkrmJPqCzfQ", 0, 0, 0);
      //result = await ccutils.getUtxos(peers, "RAsjA3jDLMGMNAtkx7RyPiqvkrmJPqCzfQ", 0, 0, 0);
      //result = await ccutils.getCCUtxos(peers, "RXnxmVxXXvxF8Fo9kstYeJFRbWvhsJV2u8", 0, 0);

      // gettransactionsmany:
      //result = await ccutils.getTransactionsMany(peers, mypk, "cce11829d3589cb930ededbf6c0da5cd6d38ac860717308d345f151e7666b54a", "0a1b489bf8f7c3ca9b29f8a1ecae0de8399e6ef06bd62786d3a8ad36577930b6", "0a1b489bf8f7c3ca9b29f8a1ecae0de8399e6ef06bd62786d3a8ad365779AAAA");
      //console.log('result=', result);

      // tokev2address:
      //let tokev2address = await cctokens.TokenV2Address(peers, mypk, mypk);
      //console.log('tokev2address=', tokev2address);

      // test fromOutputScript: 
      let getxns = await ccutils.getTransactionsMany(peers, mypk, "cce11829d3589cb930ededbf6c0da5cd6d38ac860717308d345f151e7666b54a", "91a53a6b364345360c013ea3de379b647eb9d3f985700e4957b9f45cf275dfc4");
      let tx = Transaction.fromHex(getxns.transactions[0].tx, mynetwork);
      let header = Block.fromHex(getxns.transactions[0].blockHeader, mynetwork);
      console.log('block header=', header);
      console.log('block hash=', getxns.transactions[0].blockHash);
      console.log('block height=', getxns.transactions[0].blockHeight);

      let address = await addressutils.fromOutputScript(tx.outs[0].script, mynetwork); // normal output
      console.log('address=', address);
      let cctx = Transaction.fromHex(getxns.transactions[1].tx, mynetwork);
      let ccaddress = await addressutils.fromOutputScript(cctx.outs[0].script, mynetwork);
      console.log('ccaddress=', ccaddress);

    }
    catch(err) {
      console.log('caught err=', err, 'code=', err.code, 'message=', err.message);
    }
    peers.close();
    console.log('test finished');
  });
}

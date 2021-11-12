
'use strict';

const TransactionBuilder = require('../src/transaction_builder');
const Transaction = require('../src/transaction');
const Block = require('../src/block');
const kmdmessages = require('../net/kmdmessages');
const ccutils = require('../cc/ccutils');
const cctokens = require('../cc/cctokensv2');
const ecpair = require('../src/ecpair');
const address = require('../src/address');

// create peer group
var NspvPeerGroup = require('../net/nspvPeerGroup');
require('../net/nspvPeer');  // init peer.js too

const networks = require('../src/networks');
//const mynetwork = networks.rick; 
//const mynetwork = networks.dimxy19;
//const mynetwork = networks.tok6; 
//const mynetwork = networks.TKLTEST; 
//const mynetwork = networks.dimxy23;
//const mynetwork = networks.DIMXY24;
const mynetwork = networks.TOKEL; 

// not used for plan websockets, only for PXP which is not supported
//var defaultPort = 1111

// you will need to do a call like:
// ccbasic.cryptoconditions = await ccimp;
// to init the cryptoconditions wasm lib 
// (this is due to wasm delayed loading specifics)
const ccbasic = require('../cc/ccbasic');
const { strict } = require('once');
var ccimp = require('../cc/ccimp');   // you will need to do a call like:
                                      // ccbasic.cryptoconditions = await ccimp;
                                      // to init the cryptoconditions wasm lib before cc usage (this is due to wasm delayed loading specifics)

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
  //'ws:3.136.47.223:8192'
  // TODO: add more
]

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

/*
const bigi = require('bigi');
const bip39 = require('bip39');
const sha = require('sha.js');

const ECPair = require('../src/ecpair');
let seed = bip39.mnemonicToSeed('produce hungry kingdom decrease kick popular door author stadium fence fringe unhappy favorite vintage wise')
const hash = sha('sha256').update(seed);
const bytes = hash.digest();
let d = bigi.fromBuffer(bytes)
let p = new ECPair(d)
console.log("wif", p.toWIF());
console.log("");
*/

// test key:
const mywif = 'UpUdyyTPFsXv8s8Wn83Wuc4iRsh5GDUcz8jVFiE3SxzFSfgNEyed';
const mywif2 = 'UuKUSQHnRGk4CDbRnbLRrJHq5Dwx58qR9Q9K2VpJjn3APXLurNcu';
const mywif3 = 'Usr24VoC3h4cSfSrFiGJkWLYwmkM1VnsBiMyWZvrF6QR5ZQ6Fbuu'; //  "address": "RXTUtWXgkepi8f2ohWLL9KhtGKRjBV48hT",
const mywif4 = 'UvksaDo9CTFfmYNcc6ykmAB28k3dfgFcufRLFVcNuNJH4yJf2K9F'; // 03b1e5feb25fa411911d21310716249f14712cead2cdfce62dd66a0c3702262c60 RYPvTE2bECHz17W7k7NaVJFAhNSEFf2grb 

if (!process.browser) 
{
  peers = new NspvPeerGroup(params, opts);
  peers.on('peer', (peer) => {
    // console.log('in event: connected to peer', peer.socket.remoteAddress)
  });
  // create connections to peers
  peers.nspvConnect(async () => {
  
    try {
      ccbasic.cryptoconditions = await ccimp;  // init cryptoconditions var

      let mypair = ecpair.fromWIF(mywif, mynetwork);
      let mypk = mypair.getPublicKeyBuffer();
      // tests:
      
      // make a normal tx
      //let txhex = await create_normaltx(mywif2, "RR2nTYFBPTJafxQ6en2dhUgaJcMDk4RWef", (88+15.4+5)*100000000);  // amount in satoshi
      //let txhex = await create_normaltx(mywif, "RAsjA3jDLMGMNAtkx7RyPiqvkrmJPqCzfQ", 5000);
      //let txhex = await create_normaltx(mywif3, "RR2nTYFBPTJafxQ6en2dhUgaJcMDk4RWef", 30.9 * 100000000);  // amount in satoshi
      //let txhex = await create_normaltx(mywif4, "RR2nTYFBPTJafxQ6en2dhUgaJcMDk4RWef", 0.9 * 100000000);  // amount in satoshi
      //console.log('txhex=', txhex);

      let result
      //let result = await ccutils.getTxids(peers, "RR2nTYFBPTJafxQ6en2dhUgaJcMDk4RWef", 0, 0, 0);
      //let result = await ccutils.getTxids(peers, "RUXnkW5xrGJe4MG8B7YzM7YhuSoE44RVTe", 0, 0, 0);
      //let result = await ccutils.getUtxos(peers, "RUXnkW5xrGJe4MG8B7YzM7YhuSoE44RVTe", 0, 0, 0);
      //result = await ccutils.getUtxos(peers, "RAsjA3jDLMGMNAtkx7RyPiqvkrmJPqCzfQ", 0, 0, 0);
      /////result = await ccutils.getUtxos(peers, "RAsjA3jDLMGMNAtkx7RyPiqvkrmJPqCzfA", 0, 0, 0); // bad addr (zfQ->zfA)
      //result = await ccutils.getUtxos(peers, "RKHhQYybJuAeu4aoc3hhu2nCzLFivBx2D4", 0, 0, 0);
      //result = await ccutils.getUtxos(peers, "RAsjA3jDLMGMNAtkx7RyPiqvkrmJPqCzfQ", 0, 0, 0);
      //result = await ccutils.getCCUtxos(peers, "RXnxmVxXXvxF8Fo9kstYeJFRbWvhsJV2u8", 0, 0);
      //result = await ccutils.getUtxos(peers, "RJXkCF7mn2DRpUZ77XBNTKCe55M2rJbTcu", 0, 0, 0);
      //result = await ccutils.getTxids(peers, "CeyfG2RJpA8CxPLNyTEM8HYFTNgXAdHc8w", 0, 0, 0);
      //result = await ccutils.getTxids(peers, "RAAF8xJ7Ya9hferR3ibtQDJHBFCXY4CSJE", 0, 0, 0);
      result = await ccutils.getCCUtxos(peers, "CWeCaQoWXi9ehiefmGbHFxhnLzvy8CYLQ2", 0, 0);
      console.log('result=', result);

      /* check addresses in the getTxids result
       add txids in set (remove duplicates)
      let params = [ peers, mypk ];
      let set = new Set();
      result.txids.forEach(async (txo) => {
        params.push(ccutils.hashToHex(txo.txid));
        set.add( ccutils.hashToHex(txo.txid) );
      });
      console.log('size=', set.size);
      let gettxns = await ccutils.getTransactionsMany.apply(undefined, params);
      if (gettxns.transactions && gettxns.transactions.length > 0) {
        let i = 0;
        gettxns.transactions.forEach((txh) => {
          let tx = Transaction.fromHex(txh.tx, mynetwork);
          console.log("address=", address.fromOutputScript(tx.outs[result.txids[i].vout].script, mynetwork));
          i ++;
        });
      }  */


      // gettransactionsmany:
      //result = await ccutils.getTransactionsMany(peers, mypk, "cce11829d3589cb930ededbf6c0da5cd6d38ac860717308d345f151e7666b54a", "0a1b489bf8f7c3ca9b29f8a1ecae0de8399e6ef06bd62786d3a8ad36577930b6", "0a1b489bf8f7c3ca9b29f8a1ecae0de8399e6ef06bd62786d3a8ad365779AAAA");
      //console.log('result=', result);

      /*
      // gettransactionsmany:
      let result1 = ccutils.getTransactionsMany(peers, Buffer.from('02c00f9800cfd2eeb1775729d3783357b1db193448712076bf746f7b5058a3241e', 'hex'), 
        'e932fdacaa16906e1ad70c4bfe52779094c565cec52c69b3182cbe081cf9f94b',
        '19f0ec147502bdd012d89f471d8a175ea7e689611faaefe26a9eba3d4375b70f',
        '2a145529738c82be0516b3dd6c4229d1a98b946dd6b80f0152da7dcbed0d9f21',
        '27de267b9562d43540ba923a30872e0a4254c55d986ceeb41cbc24b104237706',
        'eed7f4fc948871e3c386a49cde0a71c497cbc430595c72c2d57af65500767906',
        '649b936d2994fdb40df11bc7d59e480e19b216ad8e86d3eb2df6e4ee4ad17d06',
        '95a677e308b493311bc06f3ccbc6e42583d8e8329c3b782594222a4afdb97a06',
        '645e20c551ad1c654cfbc8df892acc6568e59b782c804ae486dfdddfed1f7f06',
        '69449770e102a1e1fd907900034f47146cbbf3a682a24fa7b088b9e408e951b9',
        'a9bb817e1351d969576ee43936b63ff2ac7ad0aab2c076a6ad43e2de0e509b82',
        'f2b4b311a119db206d8849e3e8082185b9158e616be5b35201ed1f017f21164a',
        '7637227de11ecf4ab870bcbdea5f928632ac957759e8de6069f29f6993e2da6a',
        '014518a956ef11a718414071e0ac132e9e2cfca28c8f0815c7e781de0ba67475',
        'e7a73ec8dcc9e7ffc3fe01ce25ad3fd373f275ec4347363ac49fd5cca0f10bd6');

      let result2 = ccutils.getTransactionsMany(peers, Buffer.from('02c00f9800cfd2eeb1775729d3783357b1db193448712076bf746f7b5058a3241e', 'hex'), 
      '69b8d6eaaa2af8a952c5df329961ecec00a32e9e58eebb8bb831fb8e845e1c25');

      let results = await Promise.all([result1, result2]);
    
      let i = 0;
      results.forEach(r => {
        i++;
        console.log("r" + new String(i) + "=", r);
      });
      */

      // tokev2address:
      //let tokev2address = await cctokens.TokenV2Address(peers, mypk, mypk);
      //console.log('tokev2address=', tokev2address);

      // test fromOutputScript: 
      /*
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
      */

    }
    catch(err) {
      console.log('caught err=', err, 'code=', err.code, 'message=', err.message);
    }
    peers.close();
    console.log('test finished');
  });
}

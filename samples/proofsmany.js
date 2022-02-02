
'use strict';

const TransactionBuilder = require('../src/transaction_builder');
const Transaction = require('../src/transaction');
const Block = require('../src/block');
const kmdmessages = require('../net/kmdmessages');
const ccutils = require('../cc/ccutils');
const cctokens = require('../cc/cctokensv2');
const ntzproofs = require('../cc/ntzproofs');

const ecpair = require('../src/ecpair');
const address = require('../src/address');
const BN = require('bn.js')
const types = require('../src/types');
const typeforce = require('typeforce');
// create peer group
//var NspvPeerGroup = require('../net/nspvPeerGroup');
//require('../net/nspvPeer');  // init peer.js too
const general = require('../cc/general.js')
const connect = require('../net/connect.js')


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
  numPeers: 20,
  //hardLimit: 2,        // max peers
  //connectPlainWeb: true,  // use plain websockets
  //wsOpts: { rejectUnauthorized: false } 
}

// test key:
const mywif = 'UpUdyyTPFsXv8s8Wn83Wuc4iRsh5GDUcz8jVFiE3SxzFSfgNEyed';
const mywif2 = 'UuKUSQHnRGk4CDbRnbLRrJHq5Dwx58qR9Q9K2VpJjn3APXLurNcu';
const mywif3 = 'Usr24VoC3h4cSfSrFiGJkWLYwmkM1VnsBiMyWZvrF6QR5ZQ6Fbuu'; //  "address": "RXTUtWXgkepi8f2ohWLL9KhtGKRjBV48hT",
const mywif4 = 'UvksaDo9CTFfmYNcc6ykmAB28k3dfgFcufRLFVcNuNJH4yJf2K9F'; // 03b1e5feb25fa411911d21310716249f14712cead2cdfce62dd66a0c3702262c60 RYPvTE2bECHz17W7k7NaVJFAhNSEFf2grb 

if (!process.browser) 
{
  connect(params, opts)
  .then(async (peers) => {
    try {
      ccbasic.cryptoconditions = await ccimp;  // init cryptoconditions var

      let mypair = ecpair.fromWIF(mywif, mynetwork);
      let mypk = mypair.getPublicKeyBuffer();

      // sleep for ms
      let sleep = function(ms) { return new Promise(resolve => setTimeout(resolve, ms));  }

      // tests:

      let result
      //result = await ccutils.getUtxos(peers, "RN5w8gFZn3owmbhf9ES8EwU6jWQgzPPZkR", 0, 0); // tokel 22+ miner moved often
      //result = await ccutils.getUtxos(peers, "RWQrQd6MiuW5Eqqv9E8JE6arLQVZ4q8pSS", 0, 0); // tokel 17000 utxos
      result = await ccutils.getUtxos(peers, "RGTb3FySV8kNCp7BbHP2uR4G4Gjwdvqogo", 0, 0); // tokel 2645
      //result = await ccutils.getUtxos(peers, "RWtnNgmwtsiM35tYfWjf8xxgf8GFDZvEfg", 0, 0); // tokel 1
      //result = await ccutils.getUtxos(peers, "R9SNVd4zmTAjrtWrpXebr8PGCEdkA9YZxj", 0, 0); // tokel 305 utxos
      //console.log('result=', result, 'utxo.length=', result?.utxos.length);

      //for(let i = 0; i < result?.utxos.length; i ++)
      //  if (result.utxos[i].height == 197237) 
      //    console.log('txid=', ccutils.hashToHex(result.utxos[i].txid), result.utxos[i].height);

      /*result = await ccutils.getTxids(peers, "RAAF8xJ7Ya9hferR3ibtQDJHBFCXY4CSJE", 0, 0, 0);
      console.log('result=', result, result.txids.length);
      result.txids.forEach(t => {
        console.log(ccutils.hashToHex(t.txid), t.index, t.satoshis.toString(), t.height);
      });*/

      /*
      for(let i = 0; i < result?.utxos.length; i ++)
        if (i == 0) {
          console.log('txid=', ccutils.hashToHex(result.utxos[i].txid), result.utxos[i].height);
          let ntzvalid = await ntzproofs.validateTxUsingNtzsProof(peers, mynetwork, result.utxos[i].txid, result.utxos[i].height);
          console.log("ntzvalid=", ntzvalid); 
        }
        */

      // bad offset:
      //let ntzvalid = await ntzproofs.validateTxUsingNtzsProof(peers, mynetwork, 'ec49e15f04197123a4c2906ecb8ef27d910b733a172e6e9e92ed22ef659dea0f', 197237);
      //console.log("ntzvalid=", ntzvalid); 

      //
      let val = new ntzproofs.NtzUtxoValidation(peers, mynetwork, result.utxos);
      val.execute();

      // wait for utxos to validate
      while (val.getTried() < result.utxos.length)  {  
        await sleep(1000);
      }
      console.log('total checked utxos=', val.getTried(), " ntzValid", (result.utxos.length > 0 ? result.utxos.reduce((acc, cur)=>{ return acc + (typeof cur?.ntzValid != 'undefined' ? 1 : 0); }, 0) : 0) );
    }
    catch(err) {
      console.log('caught err=', err, 'code=', err?.code, 'message=', err?.message);
    }
    peers.close();
    console.log('test finished');
  });
}


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
const bscript = require("../src/script");


const networks = require('../src/networks');
//const mynetwork = networks.rick; 
//const mynetwork = networks.dimxy19;
//const mynetwork = networks.tok6; 
//const mynetwork = networks.TKLTEST; 
const mynetwork = networks.TKLTEST2; 
//const mynetwork = networks.dimxy23;
//const mynetwork = networks.DIMXY24;
//const mynetwork = networks.DIMXY28;
//const mynetwork = networks.DIMXY31;
//const mynetwork = networks.TOKEL; 

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
  numPeers: 8,
  //hardLimit: 2,        // max peers
  //connectPlainWeb: true,  // use plain websockets
  //wsOpts: { rejectUnauthorized: false } 
}

// test keys:
const mywif = 'UpUdyyTPFsXv8s8Wn83Wuc4iRsh5GDUcz8jVFiE3SxzFSfgNEyed';
const mywif2 = 'UuKUSQHnRGk4CDbRnbLRrJHq5Dwx58qR9Q9K2VpJjn3APXLurNcu';
const mywif3 = 'Usr24VoC3h4cSfSrFiGJkWLYwmkM1VnsBiMyWZvrF6QR5ZQ6Fbuu'; // "address": "RXTUtWXgkepi8f2ohWLL9KhtGKRjBV48hT",
const mywif4 = 'UvksaDo9CTFfmYNcc6ykmAB28k3dfgFcufRLFVcNuNJH4yJf2K9F'; // 03b1e5feb25fa411911d21310716249f14712cead2cdfce62dd66a0c3702262c60 RYPvTE2bECHz17W7k7NaVJFAhNSEFf2grb 



let sleep = function(ms) {  return new Promise(resolve => setTimeout(resolve, ms)); }

if (!process.browser) 
{
  connect(params, opts)
  .then(async (peers) => {
    try {
      ccbasic.cryptoconditions = await ccimp;  // init cryptoconditions var

      var OPS = require('bitcoin-ops')
      let mypair = ecpair.fromWIF(mywif, mynetwork);
      let mypk = mypair.getPublicKeyBuffer();

      //
      // Samples how to use normal (non-cc) transactions:
      //
      
      /*
      ** Sample to create a CLTV (time-locked) Pay-to-PKH script and address
      */
      // let scriptpkh = bscript.compile([ Buffer.from('cbbe6862','hex'), OPS.OP_CHECKLOCKTIMEVERIFY, OPS.OP_DROP, OPS.OP_DUP, OPS.OP_HASH160,  Buffer.from('71be4fa8b728659d0cffba7619a7177202b74521', 'hex'), OPS.OP_EQUALVERIFY, OPS.OP_CHECKSIG ])
      // let addrpkh = address.fromOutputScript(scriptpkh, mynetwork)
      // console.log('addrpkh=', addrpkh)

      /*
      ** Sample to create a CLTV Pay-to-PK script and address
      */
      // let scriptpk = bscript.compile([ Buffer.from('cbbe6862','hex'), OPS.OP_CHECKLOCKTIMEVERIFY, OPS.OP_DROP, Buffer.from('035d3b0f2e98cf0fba19f80880ec7c08d770c6cf04aa5639bc57130d5ac54874db', 'hex'), OPS.OP_CHECKSIG ])
      // let addrpk = address.fromOutputScript(scriptpk, mynetwork)
      // console.log('addrpk=', addrpk)

      /*
      ** Samples to make a normal tx (tx with only normal inputs and outputs)
      */
      // let txhex = await general.create_normaltx(mywif2, "RR2nTYFBPTJafxQ6en2dhUgaJcMDk4RWef", new BN((88+15.4+5)*100000000), mynetwork, peers);  // amount in satoshi
      // let txhex = await general.create_normaltx(mywif, "RAsjA3jDLMGMNAtkx7RyPiqvkrmJPqCzfQ", new BN(5000), mynetwork, peers);
      // let txhex = await general.create_normaltx(mywif3, "RR2nTYFBPTJafxQ6en2dhUgaJcMDk4RWef", new BN(30.9 * 100000000), mynetwork, peers);  // amount in satoshi
      // let txhex = await general.create_normaltx(mywif, "RR2nTYFBPTJafxQ6en2dhUgaJcMDk4RWef", new BN(0.9 * 100000000), mynetwork, peers);  // amount in satoshi

      /*
      ** Sample to get utxos and print their time-lock status
      */
      //// let result = await ccutils.getUtxos(peers, "R9gPDtRGsPPARV2CFaQNinsewM2n4WYGSu", 0, 0); // tokel 
      // let result = await ccutils.getUtxos(peers, "RR2nTYFBPTJafxQ6en2dhUgaJcMDk4RWef", 0, 0);  
      // console.log('utxo.length=', result?.utxos.length);
      // let i = 0;
      // for(const utxo of result.utxos) {
      //   let isUnlocked = await general.isUtxoTimeUnlocked(peers, utxo)
      //   i ++
      //   console.log(i, 'amount', utxo.satoshis.toString(), "nLockTime=", utxo.nLockTime, ' isUtxoTimeUnlocked=', isUnlocked)
      // }

      //
      // Sample to get headers using a locator block hash
      //
      /* let loc = Buffer.from("0000000215b33a67cd939b2586ac8fe3bfc8bf54ffc23e7db9fe7f95b874e2f0", 'hex');
      console.log('loc', ccutils.hashToHex(loc));
      peers.getHeaders([loc], {}, (err, headers) => {
        if (headers) {
          console.log("received headers", headers.length);
          //if (headers.length)
          //  locnew = kmdblockindex.kmdHdrHash(headers[headers.length-1].header);
        }
      }); */
      

      /*
       * Sample to create a normal transaction for some amount
       */
      // let txhex = await general.create_normaltx(mywif, "R9gPDtRGsPPARV2CFaQNinsewM2n4WYGSu", new BN(2.469034 * 100000000 - 10000), mynetwork, peers);  // amount in satoshi
      // let txhex = await general.create_normaltx(mywif, "RJXkCF7mn2DRpUZ77XBNTKCe55M2rJbTcu", new BN(1 * 100000000), mynetwork, peers);  // amount in satoshi
      // console.log('txhex=', txhex);

      // sleep to insert delay between nspv calls to bypass the old nspv rate limiter
      // await sleep(11000)

      /*
      ** Sample to call getTxids to get spending inputs and unspent outputs for an address/index key
      */
      // result = await ccutils.getTxids(peers, "RR2nTYFBPTJafxQ6en2dhUgaJcMDk4RWef", 0, 0, 0);
      // result = await ccutils.getTxids(peers, "RUXnkW5xrGJe4MG8B7YzM7YhuSoE44RVTe", 0, 0, 0);
      // result = await ccutils.getTxids(peers, "CeyfG2RJpA8CxPLNyTEM8HYFTNgXAdHc8w", 0, 0, 0);
      // result = await ccutils.getTxids(peers, "RAAF8xJ7Ya9hferR3ibtQDJHBFCXY4CSJE", 0, 0, 0);
      // result = await ccutils.getTxids(peers, "RLJYAu3C76CMjjW4PLZnk7LBLdc4Mv15oZ", 0, 0, 0);
      // console.log('result.txids.length=', result?.txids?.length);
      // result.txids.forEach(t => { console.log('txid=', ccutils.hashToHex(t.txid), 'index=', t.index, 'satoshis=', t.satoshis.toString(), 'height=', t.height) });

      /*
      ** Sample to call a new version getTxidsV2 with begin/end height params
      ** if begin height is 0 or end height is 0 search starts from the first block till the last block
      */
      // let result = await ccutils.getTxidsV2(peers, "RR2nTYFBPTJafxQ6en2dhUgaJcMDk4RWef", 0, 201, 0);
      // console.log('result.txids.length=', result?.txids?.length);
      // result.txids.forEach(t => { console.log('txid=', ccutils.hashToHex(t.txid), 'index=', t.index, 'satoshis=', t.satoshis.toString(), 'height=', t.height) });

      /* 
      ** Sample how to get utxos for an address or index key
      */
      // let result
      // result = await ccutils.getUtxos(peers, "RUXnkW5xrGJe4MG8B7YzM7YhuSoE44RVTe", 0, 0, 0);
      // result = await ccutils.getUtxos(peers, "RAsjA3jDLMGMNAtkx7RyPiqvkrmJPqCzfQ", 0, 0, 0);
      // result = await ccutils.getUtxos(peers, "RKHhQYybJuAeu4aoc3hhu2nCzLFivBx2D4", 0, 0, 0);
      // result = await ccutils.getUtxos(peers, "RN5w8gFZn3owmbhf9ES8EwU6jWQgzPPZkR", 0, 0); // tokel 22+ miner moved often
      // result = await ccutils.getUtxos(peers, "RWQrQd6MiuW5Eqqv9E8JE6arLQVZ4q8pSS", 0, 0); // tokel 17000 utxos
      // result = await ccutils.getUtxos(peers, "RGTb3FySV8kNCp7BbHP2uR4G4Gjwdvqogo", 0, 0); // tokel 2645
      // result = await ccutils.getUtxos(peers, "RWtnNgmwtsiM35tYfWjf8xxgf8GFDZvEfg", 0, 0); // tokel 1
      // result = await ccutils.getUtxos(peers, "R9SNVd4zmTAjrtWrpXebr8PGCEdkA9YZxj", 0, 0); // tokel
      // console.log('result=', result, 'utxo.length=', result?.utxos.length);

      //
      // tool to get addresses in the getTxids result (to verify it)
      // add the txids in set (to remove duplicates)
      //
      /* let params = [ peers, mypk ];
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


      /*
      ** Sample to use gettransactionsmany:
      */
      // let result = await ccutils.getTransactionsMany(peers, mypk, "cce11829d3589cb930ededbf6c0da5cd6d38ac860717308d345f151e7666b54a", "0a1b489bf8f7c3ca9b29f8a1ecae0de8399e6ef06bd62786d3a8ad36577930b6", "0a1b489bf8f7c3ca9b29f8a1ecae0de8399e6ef06bd62786d3a8ad365779AAAA");
      // let result = await ccutils.getTransactionsMany(peers, mypk,"77036823bd324a8e6c79daba87fe2fcbcc7ce21a823e0b7e2706ef9f71232b49", "68a6ae4c286c91aef0aa243f1a00b692c94050ea079c70aca4cfb2a786650db4"); //tokel
      // console.log('result=', result);

      //
      // Yet another sample to use gettransactionsmany in two calls:
      //
      /* let result1 = ccutils.getTransactionsMany(peers, Buffer.from('02c00f9800cfd2eeb1775729d3783357b1db193448712076bf746f7b5058a3241e', 'hex'), 
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
      }); */

      //
      // Sample for new NSPV_TRANSACTION in nspv v7
      // (not supported in tokel)
      //
      /* let result2 = await general.nspvGetTransactions(peers, false, 
        '69b8d6eaaa2af8a952c5df329961ecec00a32e9e58eebb8bb831fb8e845e1c25',   // tokel not exist
        'e932fdacaa16906e1ad70c4bfe52779094c565cec52c69b3182cbe081cf9f94b',   // tokel not exist
        '19f0ec147502bdd012d89f471d8a175ea7e689611faaefe26a9eba3d4375b70f',   // tokel not exist
        "fcaf0d4ca6c7392fe67474738da9f51acacd74bd31ae29260085ec9254020768",   // tokel exists
        "3272f423635c95aec7c33c54964045238d55fa25bd940789b936e5186ea1ba9b"    // tokel exists
        );
      console.log('result nspvGetTransactions', result2);
      result2.txns.forEach(tx => {
        console.log("tx out len", tx.outs.length, "tx", tx );
      }); */

      //
      // Sample to get transactions block data and output addresses with use of fromOutputScript: 
      //
      /* let getxns = await ccutils.getTransactionsMany(peers, mypk, "cce11829d3589cb930ededbf6c0da5cd6d38ac860717308d345f151e7666b54a", "91a53a6b364345360c013ea3de379b647eb9d3f985700e4957b9f45cf275dfc4");
      let tx = Transaction.fromHex(getxns.transactions[0].tx, mynetwork);
      let header = Block.fromHex(getxns.transactions[0].blockHeader, mynetwork);
      console.log('block header=', header);
      console.log('block hash=', getxns.transactions[0].blockHash);
      console.log('block height=', getxns.transactions[0].blockHeight);
      let address = await addressutils.fromOutputScript(tx.outs[0].script, mynetwork); // normal output
      console.log('address=', address);
      let cctx = Transaction.fromHex(getxns.transactions[1].tx, mynetwork);
      let ccaddress = await addressutils.fromOutputScript(cctx.outs[0].script, mynetwork);
      console.log('ccaddress=', ccaddress); */

      /*
      ** Sample to get decoded transaction 
      */
      // let txdecoded = await ccutils.getTransactionsManyDecoded(peers, mynetwork, mypk, ["cce11829d3589cb930ededbf6c0da5cd6d38ac860717308d345f151e7666b54a"]);
      // console.log('txdecoded=', txdecoded);

      /*
      ** Sample to get spent info for a tx
      */
      let txid = '759a8f86d42970c7b95fe2ec2b00929a1313241dd4779b9259942c9d540b86fc';
      let vout = 1;
      let result = await ccutils.nspvGetSpentInfo(peers, txid, vout);
      console.log('result=', result, 'spent txid=', ccutils.hashToHex(result?.txProof?.txid), 'spent vini=', result?.spentVini);
    }
    catch(err) {
      console.log('caught err=', err, 'code=', err?.code, 'message=', err?.message);
    }
    peers.close();
    console.log('test finished');
  });
}

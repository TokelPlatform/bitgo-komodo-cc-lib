
'use strict';

//const kmdmessages = require('../net/kmdmessages');
const cctokens = require('../cc/cctokensv2');
const ccutils = require('../cc/ccutils');
const ecpair = require('../src/ecpair');
const Transaction = require('../src/transaction');
const Block = require('../src/block');
const address = require('../src/address');
const connect = require('../net/connect.js')
const bufferutils = require("../src/bufferutils");


// create peer group
const NspvPeerGroup = require('../net/nspvPeerGroup');
//const PeerGroup = require('../net/peerGroup');
require('../net/nspvPeer');  // init peer.js too

const networks = require('../src/networks');
//const mynetwork = networks.rick; 
//const mynetwork = networks.tok6;
//const mynetwork = networks.dimxy23;
//const mynetwork = networks.DIMXY24;
// const mynetwork = networks.dimxy25;
//const mynetwork = networks.TKLTEST;
const mynetwork = networks.TKLTEST2;
//const mynetwork = networks.TOKEL;
//const mynetwork = networks.DIMXY31;



// you will need to do a call like:
// ccbasic.cryptoconditions = await ccimp;
// to init the cryptoconditions wasm lib before cc usage
// (this is due to wasm delayed loading specifics)
const ccbasic = require('../cc/ccbasic');

var ccimp = require('../cc/ccimp'); 
// Note: 
// to init the cryptoconditions wasm lib before the first cc usage (this is due to wasm delayed loading specifics)
// you will need to do a call:
// ccbasic.cryptoconditions = await ccimp;
                                      


// additional seeds if needed:
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
  numPeers: 8,
  //hardLimit: 2,        // max peers
  //connectPlainWeb: true,  // use plain websockets
  wsOpts: { rejectUnauthorized: false }  // enable self-signed certificates
}

// sample keys:
const mytokencreatewif = 'UpUdyyTPFsXv8s8Wn83Wuc4iRsh5GDUcz8jVFiE3SxzFSfgNEyed';
const mytokentransferwif = 'UwoxbMPYh4nnWbzT4d4Q1xNjx3n9rzd6BLuato7v3G2FfvpKNKEq';
//const mydestpubkey = "035d3b0f2e98cf0fba19f80880ec7c08d770c6cf04aa5639bc57130d5ac54874db";
const mydestpubkey = "034777b18effce6f7a849b72de8e6810bf7a7e050274b3782e1b5a13d0263a44dc";
const deadpubkey = "02deaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaa";

//const mytokenid = "2bea503a491cae096b0c2af48d504e4fbd7c4747f49eddbb5d2723d6287769f8";
//const mytokenid = "d45689a1b667218c8ed400ff5603b5e7b745df8ef39c3c1b27f74a1fed6f630a";
//const mytokenid = "884278724ef2a5207715b9250654dd1bb287b699aaf7da099c259a078ff3dfc4"; // tkltest
const mytokenid = "07137df1a483dbefd378136d674dac22084732483246c003598200b6e5b086fb" // dimxy31
let mypk = "035d3b0f2e98cf0fba19f80880ec7c08d770c6cf04aa5639bc57130d5ac54874db";

// sleep to insert delay between nspv calls to bypass the old nspv rate limiter
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


if (!process.browser) 
{
  // Example test calls running under nodejs

  connect(params, opts)
  .then(async (peers) => {
  
    try {

      // load cryptoconditions lib
      ccbasic.cryptoconditions = await ccimp;

      //
      // Several token samples 
      // (uncomment needed one and change mytokenid to your tokenid):
      //

      /*
      ** Sample how to make a token create transaction
      */
      // let tx = await cctokens.tokensv2Create(peers, mynetwork, mytokencreatewif, "MYNFT", "MyDesc", 1, "000101010201010301");
      // console.log('txhex=', tx.toHex());  // use sendrawtransaction rpc to send the created tx

      /*
      ** Sample to make a token transfer tx to a pubkey
      */
      //let tx = await cctokens.tokensv2Transfer(peers, mynetwork, mytokencreatewif, mytokenid, mydestpubkey, 1);
      //console.log('txhex=', tx.toHex());

      /*
      ** Sample to make a token transfer tx to an R-address
      */
      // let tx = await cctokens.tokensv2Transfer(peers, mynetwork, mypk, mytokenid, 'RR2nTYFBPTJafxQ6en2dhUgaJcMDk4RWef', 1);
      // console.log('txhex=', tx.toHex());

      /*
      ** Sample how to burn a token
      */
      // let tx = await cctokens.tokensv2Transfer(peers, mynetwork, mytokencreatewif, mytokenid, deadpubkey, 1);
      // console.log('txhex=', tx.toHex());

      
      /*
      ** Sample how to check if a utxo is a token by calling isTokenV2Output()
      ** it attaches a 'tokendata' object to the utxo, if this is a valid token
      */
      // let txid =  "f24e159ba9dce0ecdbe9e066518da063ea2028da01b9b09b97e13d81b345743c";
      // let nvout = 1;
      // let getxns = await ccutils.getTransactionsMany(peers, mypk, txid);
      // let tx = Transaction.fromHex(getxns.transactions[0].tx, mynetwork);
      // let tokendata = cctokens.isTokenV2Output(tx, nvout);
      // console.log(`IsTokenV2Output(tx,${nvout})=`, tokendata, "tokenid=", (tokendata?.tokenid ? ccutils.hashToHex(tokendata.tokenid) : null)); 
    
      /*
      ** Sample how to get utxos sent to a R-address
      */
      // let ccindexkey = address.fromOutputScript(ccutils.makeCCSpkV2MofN(cctokens.EVAL_TOKENSV2, ["RJXkCF7mn2DRpUZ77XBNTKCe55M2rJbTcu"], 1, undefined, ccbasic.CCSUBVERS.CC_MIXED_MODE_SECHASH_SUBVER_1), mynetwork); // get index key
      // let ccoutputs = await ccutils.getCCUtxos(peers, ccindexkey, 0, 0);  // make nspv request
      // ccoutputs.forEach(u => { console.log('utxo satoshis=', u.satoshis.toString(), 'txid=', ccutils.hashToHex(u.txid), 'vout=', u.vout, 'funcid=', u?.tokendata?.funcid, 'tokenid=', u?.tokendata?.tokenid ? ccutils.hashToHex(u?.tokendata?.tokenid) : '' ) });

      /*
      ** Sample how to get all token utxos for a pubkey and its R-address,
      ** this function actually does several nspv requests for index keys obtained from the pubkey and R-address
      ** it is also validates token utxos with validateTokensV2Many
      */
      let tokenutxos = await cctokens.getAllTokensV2ForPubkey(peers, mynetwork, mypk, 0, 0);
      tokenutxos.forEach(u => { console.log('utxo satoshis=', u.satoshis.toString(), 'txid=', ccutils.hashToHex(u.txid), 'vout=', u.vout, 'funcid=', u?.tokendata?.funcid, 'tokenid=', u?.tokendata?.tokenid ? ccutils.hashToHex(u?.tokendata?.tokenid) : '' ) });

      /*
      ** sample how to load and validate token utxos
      ** get an old-style cc index key for a pubkey:
      */
      /* get cc index key for a pubkey: */
      // let ccindexkey = address.fromOutputScript(ccutils.makeCCSpkV2MofN(cctokens.EVAL_TOKENSV2, ["035d3b0f2e98cf0fba19f80880ec7c08d770c6cf04aa5639bc57130d5ac54874db"], 1 ), mynetwork)
      /* load utxos: */
      // let ccoutputs = await ccutils.getCCUtxos(peers, ccindexkey, 0, 0);  
      /* call validation function that checks that utxo is a valid token. In this case it would attach a 'tokendata' object to the utxo: */
      // let ccoutputs_validated = await cctokens.validateTokensV2Many(mynetwork, peers, mypk, ccoutputs.utxos);
      // ccoutputs_validated.forEach(u => { console.log('utxo satoshis=', u.satoshis.toString(), 'txid=', ccutils.hashToHex(u.txid), 'vout=', u.vout, 'funcid=', u?.tokendata?.funcid, 'tokenid=', u?.tokendata?.tokenid ? ccutils.hashToHex(u?.tokendata?.tokenid) : '' ) });

      // sleep call 
      // in case you are making too many nspv requests per sec of the same type (here it is NSPV_UTXOS)
      // insert this between calls:
      // await sleep(1100)

    }
    catch(err) {
      console.log('caught err=', err, 'code=', err.code, 'message=', err.message);
    }
    peers.close();
    console.log('test finished, waiting for peers to close...');
  });
}

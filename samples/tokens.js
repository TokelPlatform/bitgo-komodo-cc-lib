
'use strict';

//const kmdmessages = require('../net/kmdmessages');
const cctokens = require('../cc/cctokensv2');
const ccutils = require('../cc/ccutils');
const ecpair = require('../src/ecpair');
const Transaction = require('../src/transaction');
const Block = require('../src/block');

// create peer group
const NspvPeerGroup = require('../net/nspvPeerGroup');
const PeerGroup = require('../net/peerGroup');
require('../net/nspvPeer');  // init peer.js too

const networks = require('../src/networks');
//const mynetwork = networks.rick; 
//const mynetwork = networks.tok6;
//const mynetwork = networks.dimxy23;
const mynetwork = networks.dimxy24;
// const mynetwork = networks.dimxy25;


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
//const mydestpubkey = "035d3b0f2e98cf0fba19f80880ec7c08d770c6cf04aa5639bc57130d5ac54874db";
const mydestpubkey = "034777b18effce6f7a849b72de8e6810bf7a7e050274b3782e1b5a13d0263a44dc";
//const mytokenid = "2bea503a491cae096b0c2af48d504e4fbd7c4747f49eddbb5d2723d6287769f8";
const mytokenid = "d45689a1b667218c8ed400ff5603b5e7b745df8ef39c3c1b27f74a1fed6f630a";

// sleep to insert delay between nspv calls to bypass the old nspv rate limiter
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

if (!process.browser) 
{
  peers = new NspvPeerGroup(params, opts);
  peers.on('peer', (peer) => {
    // console.log('in event: connected to peer', peer.socket.remoteAddress)
  });
  // create connections to peers
  peers.connect(async () => {
  
    try {
      // Several tests (uncomment needed):
      
      // test get blocks from peer (TODO: update for kmd block and transactions support) : 
      // var hashes = [  bufferutils.reverseBuffer(Buffer.from("099751509c426f89a47361fcd26a4ef14827353c40f42a1389a237faab6a4c5d", 'hex')) ];
      // let blocks = peers.getBlocks(hashes, {});
      // console.log('blocks:', blocks);

      // test get normal utxos from an address:
      //let utxos = await ccutils.getNormalUtxos(peers, faucetcreateaddress);
      //console.log('utxos=', utxos);

      // it should be at least 1 sec between the same type nspv requests (here it is NSPV_UTXOS)
      //await sleep(1100)

      // get cc utxos:
      //let ccutxos = await ccutils.getCCUtxos(peers, faucetGlobalAddress);
      //console.log('cc utxos=', ccutxos); 

      // make cc token create tx
      //let tx = await cctokens.tokensv2Create(peers, mynetwork, mytokencreatewif, "MYNFT", "MyDesc", 1, "000101010201010301");
      //console.log('txhex=', tx.toHex());

      // make cc token transfer tx
      //let tx = await cctokens.tokensv2Transfer(peers, mynetwork, mytokencreatewif, mytokenid, mydestpubkey, 1);
      //console.log('txhex=', tx.toHex());

      // make tx with normal inputs for the specified amount
      // not used let txwnormals = await ccutils.createTxAddNormalInputs('035d3b0f2e98cf0fba19f80880ec7c08d770c6cf04aa5639bc57130d5ac54874db', 100000000*190000);
      //console.log('txwnormals=', txwnormals);

      // tokev2address:
      //let tokev2address = await cctokens.tokenV2Address(peers, mypk, mypk);
      //console.log('tokev2address=', tokev2address);

      // test key:
      const mywif = 'UpUdyyTPFsXv8s8Wn83Wuc4iRsh5GDUcz8jVFiE3SxzFSfgNEyed';
      let mypair = ecpair.fromWIF(mywif, mynetwork);
      let mypk = mypair.getPublicKeyBuffer();

      // isTokenV2Output check:
      /*let getxns = await ccutils.getTransactionsMany(peers, mypk, "35ff378351468c43afcc1cea830f706d44979de024a59948ce7ccf4c086c1000");
      //let getxns = await ccutils.getTransactionsMany(peers, mypk, "7ede39c986198aadc354436dad9ecd768a14a3b6b4626d2b193e1e9e2f356528"); //non-token
      let tx = Transaction.fromHex(getxns.transactions[0].tx, mynetwork);
      let res = cctokens.isTokenV2Output(tx, 0);
      console.log("IsTokenV2Output(tx[0], 0)=", res, "tokenid=", (res ? ccutils.txidToHex(res.tokenid) : null)); */

      let ccoutputs = await ccutils.getCCUtxos(peers, "RJRjg45Tcx8tsvv6bzqjUFFsajXoJMH6bR", 0, 0);
      let ccoutputs_validated = await cctokens.validateTokensV2Many(mynetwork, peers, mypk, ccoutputs.utxos);
      console.log("ccoutputs_validated=", ccoutputs_validated);

    }
    catch(err) {
      console.log('caught err=', err, 'code=', err.code, 'message=', err.message);
    }
    peers.close();
    console.log('test finished, waiting for peers to close...');
  });
}

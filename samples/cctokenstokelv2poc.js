'use strict';

const bufferutils = require("../src/bufferutils");
const kmdmessages = require('../net/kmdmessages');
const ccutils = require('../cc/ccutils');
const networks = require('../src/networks');
const tokensv2 = require('../cc/cctokenstokelv2');

// create peer group
const NspvPeerGroup = require('../net/nspvPeerGroup');
require('../net/nspvPeer');  // init peer.js too

/************** SET YOUR OWN VALUES  */

// not used for plan websockets, only for PXP which is not supported
const defaultPort = 22024

//to connect over p2p
const staticPeers = [
  '167.99.114.240:22024', '3.19.194.93:22024'
]

const mynetwork =  {
    messagePrefix: '\x18TKLTEST asset chain:\n',
    bech32: 'R',
    bip32: {
      public: 0x0488b21e,
      private: 0x0488ade4
    },
    pubKeyHash: 0x3c,
    scriptHash: 0x55,
    wif: 0xbc,
    consensusBranchId: {
      1: 0x00,
      2: 0x00,
      3: 0x5ba81b19,
      4: 0x76b809bb // (Sapling branch id used in kmd)
    },
    coin: 'zec',
    komodoAssetNet: true,
    magic: 0xf6475548 // komodo chain magic, obtain with getinfo rpc
  }

// to connect over websockets:
const webSeeds = []

const params = {
  magic: mynetwork.magic,
  defaultPort: defaultPort,
  //dnsSeeds: dnsSeeds,
  webSeeds: webSeeds,
  staticPeers: staticPeers,  // dnsSeed works also
  protocolVersion: 170009,
  messages: kmdmessages.kmdMessages
}

var opts = {
  //connectWeb: true,     // use websockets
  numPeers: 8,
  //hardLimit: 2,        // max peers
  //connectPlainWeb: true,  // use plain websockets, no PXP
  wsOpts: { rejectUnauthorized: false }  // enable self-signed certificates
}

// Example test calls running under nodejs
const mytokencreatewif = 'UpUdyyTPFsXv8s8Wn83Wuc4iRsh5GDUcz8jVFiE3SxzFSfgNEyed';
const mytokentransferwif = 'UwoxbMPYh4nnWbzT4d4Q1xNjx3n9rzd6BLuato7v3G2FfvpKNKEq';
//const mydestpubkey = "035d3b0f2e98cf0fba19f80880ec7c08d770c6cf04aa5639bc57130d5ac54874db";
const mydestpubkey = "034777b18effce6f7a849b72de8e6810bf7a7e050274b3782e1b5a13d0263a44dc";
const mytokenid = "38b58149410b5d53f03b06e38452e7b0e232e561a65b89a4517c7dc518e7e739";

/************** SET YOUR OWN VALUES  */

const peers = new NspvPeerGroup(params, opts);
peers.on('peer', (peer) => {
  console.log('in event: connected to peer', peer.socket.remoteAddress)
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
    // console.log(peers)
    // let utxos = await ccutils.getNormalUtxos(peers, 'RLLqZTkqpNJoAJrckvXHY25xKrv81ft2zT');
    // console.log('utxos=', utxos);

    // it should be at least 1 sec between the same type nspv requests (here it is NSPV_UTXOS)
    //var t0 = new Date().getSeconds();
    //do {
    //  var t1 = new Date().getSeconds();
    //} while(t1 == t0);

    // get cc utxos:
    // let ccutxos = await ccutils.getCCUtxos(peers, faucetGlobalAddress);
    // console.log('cc utxos=', ccutxos);

    // make cc token create tx
    let txhex = await tokensv2.cctokens_create_v2_tokel(peers, mynetwork, mytokencreatewif, "MYNFT", "MyDesc", 1, JSON.parse('{"royalty": 1, "id":414565, "url":"https://site.org", "arbitrary":"0202ABCDEF"}'));
    // let txhex = await tokensv2.cctokens_create_v2_tokel(mytokencreatewif, "MYNFT", "MyDesc", 1, JSON.parse('{"royalty": 1}'));
    console.log('txhex=', txhex);

    // make cc token transfer tx
    // let txhex = await cctokens_transfer_v2(mytokencreatewif, mytokenid, mydestpubkey, 1);
    // console.log('txhex=', txhex);

    // make tx with normal inputs for the specified amount
    // not used let txwnormals = await ccutils.createTxAddNormalInputs('035d3b0f2e98cf0fba19f80880ec7c08d770c6cf04aa5639bc57130d5ac54874db', 100000000*190000);
    //console.log('txwnormals=', txwnormals);
  }
  catch(err) {
    console.log('caught err=', err, 'code=', err.code, 'message=', err.message);
  }
  peers.close();
});


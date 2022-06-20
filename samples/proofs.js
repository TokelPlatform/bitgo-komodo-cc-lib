
'use strict';


const ntzsproofs = require('../cc/ntzproofs');
const connect = require('../net/connect.js')


// create peer group
//var NspvPeerGroup = require('../net/nspvPeerGroup');
//require('../net/nspvPeer');  // init peer.js too

const networks = require('../src/networks');
//const mynetwork = networks.rick; 
//const mynetwork = networks.dimxy19;
//const mynetwork = networks.tok6; 
//const mynetwork = networks.TKLTEST; 
const mynetwork = networks.TKLTEST2; 
//const mynetwork = networks.TOKEL; 
//const mynetwork = networks.DIMXY31; 



var params = {
    network: mynetwork,
}

var opts = {
    numPeers: 8,
    //hardLimit: 2,        // max peers
    //connectPlainWeb: true,  // use plain websockets
    // wsOpts: { rejectUnauthorized: false } 
}



if (!process.browser) 
{
  connect(params, opts)
  .then(async (peers) => {

    try {

      let sleep = function(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
      }
      // wait for at least 2 peers
      /*while (peers.peers.length < 2)  {  
        await sleep(2000);
        console.log('peers.peers.length=', peers.peers.length);
      }*/

      // Samples:
      
      //
      // get txproof for txid on TOKEL net (set mynetwork to TOKEL):
      //
      /*
      let txid = 'fcaf0d4ca6c7392fe67474738da9f51acacd74bd31ae29260085ec9254020768'  // tokel h=10000
      let ht = 10000;

      //let txid = '118a95dd6aa92bedc13f223ad5f51a6d6c113313b0f2cc16107e2cac0ccf643c' // DIMXY24
      //let txid = 'cce11829d3589cb930ededbf6c0da5cd6d38ac860717308d345f151e7666b54a' //tkltest
      
      let txproofresp = await ntzsproofs.nspvTxProof(peers, txid, 0, 0); //tokel
      console.log('txproofresp=', txproofresp); 
      let hashes = bmp.verify(txproofresp.partialMerkleTree);
      console.log('verify result compare txids =', hashes.length > 0 ? Buffer.compare(hashes[0], ccutils.hashFromHex(txid)) == 0 : null );
      */

      //let ntzresp = await ntzsproofs.nspvNtzs(peers, 10000);
      //console.log('ntzresp=', ntzresp);

      //let ntzsproofresp = await ntzsproofs.nspvNtzsProof(peers, ntzresp.ntz.txid);
      //console.log('ntzsproofresp=', ntzsproofresp);
      
      //
      // Sample to validate several txids on TOKEL (set mynetwork to TOKEL) 
      //
      /* ***
      let txid1 = '22eca5965bc69361183653aa69fdcdc4f90a3b4a7b39c96e36d042478ff54e34'; 
      let ht1 = 120000;
      let ntzvalid1 = await ntzsproofs.validateTxUsingNtzsProof(peers, mynetwork, txid1, ht1);
      console.log("ntzvalid1=", ntzvalid1); 

      try {
        let txid2 = '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b'; 
        let ht2 = 0;  //bad height
        let ntzvalid2 = await ntzsproofs.validateTxUsingNtzsProof(peers, mynetwork, txid2, ht2);
        //console.log("bad height ntzvalid2=", ntzvalid2);
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
      *** */
    
      /*
      ** Sample to validate tx using txProofs
      */
      let txid = '759a8f86d42970c7b95fe2ec2b00929a1313241dd4779b9259942c9d540b86fc'
      let txproofvalid = await ntzsproofs.validateTxUsingTxProof(peers, txid);
      console.log("txproof valid=", txproofvalid);

      //
      // download headers
      //
      /* *** 
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
      let ghInt = setInterval(getHeaders, 10); *** */

    }
    catch(err) {
      console.log('caught err=', err, 'code=', err.code, 'message=', err.message);
    }

    peers.close();
    console.log('test finished, waiting for peers to close...');
  });

}

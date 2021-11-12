
'use strict';

const TransactionBuilder = require('../src/transaction_builder');
const Transaction = require('../src/transaction');
const ECPair = require('../src/ecpair');
const OPS = require('bitcoin-ops');

const bufferutils = require("../src/bufferutils");
const script = require("../src/script");
const ccutils = require('../cc/ccutils');
const ecpair = require('../src/ecpair');

// to init the cryptoconditions wasm lib you will need to do a call like:
// ccbasic.cryptoconditions = await ccimp;
// (this is due to wasm delayed loading specifics)

const ccbasic = require('../cc/ccbasic');
var ccimp = require('../cc/ccimp');   // you will need to do a call like:
                                      // ccbasic.cryptoconditions = await ccimp;
                                      // to init the cryptoconditions wasm lib before cc usage (this is due to wasm delayed loading specifics)


const FAUCETSIZE = 10000000;

// faucet global privkey/pubkey:
const faucetGlobalPk = "03682b255c40d0cde8faee381a1a50bbb89980ff24539cb8518e294d3a63cefe12";
const faucetGlobalPrivkey = Buffer.from([ 0xd4, 0x4f, 0xf2, 0x31, 0x71, 0x7d, 0x28, 0x02, 0x4b, 0xc7, 0xdd, 0x71, 0xa0, 0x39, 0xc4, 0xbe, 0x1a, 0xfe, 0xeb, 0xc2, 0x46, 0xda, 0x76, 0xf8, 0x07, 0x53, 0x3d, 0x96, 0xb4, 0xca, 0xa0, 0xe9 ]);
const faucetGlobalAddress = "R9zHrofhRbub7ER77B7NrVch3A63R39GuC";
const EVAL_FAUCET = 0xE4

function createTxAndAddFaucetInputs(peers, globalpk, amount)
{
  return new Promise((resolve, reject) => {

    peers.nspvRemoteRpc("faucetaddccinputs", globalpk, amount, {}, (err, res, peer) => {
      //console.log('err=', err, 'res=', res);
      if (!err) 
        resolve(res);
      else
        reject(err);
    });
  });
}


// exported top level functions to be called from browser
// param check and pass further:

/**
 * create a tx to add satoshi to the faucet fund
 * @param {*} peers initialised NspdPeerGroup object
 * @param {*} mynetwork a chain from networks.js config 
 * @param {*} wif wif to sign the tx and get the change
 * @param {*} satoshi amount to add to the fund
 * @returns promise to create tx
 */
async function FaucetFund(peers, mynetwork, wif, satoshi) {
  //amount = amount >>> 0; // to int
  let txpromise = makeFaucetCreateTx(peers, mynetwork, wif, satoshi);

  return txpromise;
};

/**
 * create a txpow to get FAUCETSIZE from the faucet fund to myaddress
 * @param {*} peers initialised NspdPeerGroup object
 * @param {*} mynetwork a chain from networks.js config
 * @param {*} myaddress where to send satoshis from the faucet fund  
 * @returns promise to create tx
 */
async function FaucetGet(peers, mynetwork, myaddress) {
  let txpromise = makeFaucetGetTx(peers, mynetwork, myaddress);
  return txpromise;
};

// tx creation code

async function makeFaucetCreateTx(peers, mynetwork, wif, amount) 
{
  // init lib cryptoconditions
  ccbasic.cryptoconditions = await ccimp;

  const txbuilder = new TransactionBuilder(mynetwork);
  const txfee = 10000;

  let mypair = ecpair.fromWIF(wif, mynetwork);
  let mypk = mypair.getPublicKeyBuffer();
  let mynormaladdress = ccutils.pubkey2NormalAddressKmd(mypk);

  let txwutxos = await ccutils.createTxAndAddNormalInputs(peers, mypk, amount + txfee);

  let tx = Transaction.fromBuffer(Buffer.from(txwutxos.txhex, 'hex'), mynetwork);

  // zcash stuff:
  txbuilder.setVersion(tx.version);
  if (txbuilder.tx.version >= 3)
    txbuilder.setVersionGroupId(tx.versionGroupId);

  // add vins to the created tx
  let added = ccutils.addInputsFromPreviousTxns(txbuilder, tx, txwutxos.previousTxns, mynetwork);
  if (added < amount + txfee)
    throw new Error("insufficient normal inputs (" + added + ")")

  // create faucet cc to global address
  let cond = {
    type:	"threshold-sha-256",
    threshold:	2,
    subfulfillments:	[{
          type:	"eval-sha-256",   
          code:	ccutils.byte2Base64(EVAL_FAUCET)     
      }, {            
          type:	"threshold-sha-256",
          threshold:	1,
          subfulfillments:	[{  
                  type:	"secp256k1-sha-256",
                  publicKey:	faucetGlobalPk
          }]  
      }]   
    };
  let ccSpk = ccbasic.makeCCSpk(cond);
  if (ccSpk == null)  {
    throw new Error('could not create faucet cc spk');
  }

  txbuilder.addOutput(ccSpk, amount);
  txbuilder.addOutput(mynormaladdress, added - amount - txfee);  // change

  if (txbuilder.tx.version >= 4)
    txbuilder.setExpiryHeight(tx.expiryHeight);

  ccutils.finalizeCCtx(mypair, txbuilder);
  return txbuilder.build();
}

async function makeFaucetGetTx(peers, mynetwork, myaddress) 
{
  // init lib cryptoconditions
  ccbasic.cryptoconditions = await ccimp;

  const txfee = 10000;
  const amount = FAUCETSIZE;

  let txwutxos = await createTxAndAddFaucetInputs(peers, faucetGlobalPk, amount);
  let basetx = Transaction.fromBuffer(Buffer.from(txwutxos.txhex, 'hex'), mynetwork);

  // create a cc to spend from global address
  let cond = {
    type:	"threshold-sha-256",
    threshold:	2,
    subfulfillments:	[{
        type:	"eval-sha-256",   
        code:	 ccutils.byte2Base64(EVAL_FAUCET)     
    }, {            
        type:	"threshold-sha-256",
        threshold:	1,
        subfulfillments:	[{  
                type:	"secp256k1-sha-256",
                publicKey:	faucetGlobalPk
        }]  
    }]   
  };

  let ccSpk = ccbasic.makeCCSpk(cond);
  if (ccSpk == null)  {
    throw new Error('could not create cc spk');
  }

  // mine faucet get txpow
  let i = 0;
  let stop = false;
  let txbuilder;
  for(var adj1 = 0; adj1 <= 0xFFFFFFFF && !stop; adj1++)  {
    for(var adj2 = 0; adj2 <= 0xFFFFFFFF && !stop; adj2++)  {
      txbuilder = new TransactionBuilder(mynetwork);

      txbuilder.setVersion(basetx.version);
      if (basetx.version >= 3)
        txbuilder.setVersionGroupId(basetx.versionGroupId);
    
      let added = ccutils.addInputsFromPreviousTxns(txbuilder, basetx, txwutxos.previousTxns, mynetwork);
      if (added < amount)
        throw new Error('could not find cc faucet inputs');

      txbuilder.addOutput(ccSpk, added - amount - txfee);  // change to faucet cc
      txbuilder.addOutput(myaddress, amount);  // get to normal

      // make 4-byte buffer from a number
      const num2Uint32 = num => { 
        let buf = Buffer.alloc(4);
        let bufwr = new bufferutils.BufferWriter(buf);
        bufwr.writeUInt32(num >>> 0);
        return buf;
      };

      // adjust nonces:
      let opreturn = script.compile([ OPS.OP_RETURN, Buffer.concat([ Buffer.from(num2Uint32(adj1 >>> 0)), Buffer.from(num2Uint32(adj2 >>> 0)) ]) ]);
      txbuilder.addOutput(opreturn, 0);
     
      ccutils.finalizeCCtx(ECPair.fromPrivateKeyBuffer(faucetGlobalPrivkey, mynetwork), txbuilder, [{cond: cond}]);
      let tx = txbuilder.build();
      let txid = tx.getId();
      console.log('slice=', txid.slice(0,2), txid.slice(62,64));
      if (txid.slice(0,2) == '00' && txid.slice(62,64) == '00') {  // check valid faucet txpow
        console.log("mined faucet txid");
        stop=true;
      }
      if (++i > 1000000)
        return;
    }
  }

  //console.log('tx..:', txbuilder.buildIncomplete().toHex());
  return txbuilder.build();
}

module.exports = {
    FaucetFund,
    FaucetGet,
    FAUCETSIZE, 
    faucetGlobalPk, faucetGlobalPrivkey, faucetGlobalAddress, EVAL_FAUCET
}
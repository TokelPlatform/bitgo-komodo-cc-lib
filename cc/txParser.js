const Transaction = require('../src/transaction');
const addresslib = require('../src/address');
const bscript = require('../src/script')
const Block = require('../src/block');

/**
 * Decode Transaction Data into more readable format
 * @param {*} tx  transaction to decode
 * @param {*} network  chosen network
 * @returns 
 */
const decodeTransactionData = (tx, header, network) => {
  const decoded = Transaction.fromHex(tx, network);
  const decodedHeader = Block.fromHex(header, network);
  const outs = decoded.outs.map(out => {
    try {
      return {
        ...out,
        address: addresslib.fromOutputScript(out.script, network),
        asm: bscript.toASM(out.script),
      }
    } catch (e) {
      console.log(e); 
      return {
        ...out,
        address: null,
        asm: bscript.toASM(out.script),
      }
    }
  })
  return {
    time: decodedHeader.timestamp,
    txid: decoded.getHash().reverse().toString('hex'),
    ins: decoded.ins.map(one => {
      const txid = one.hash.reverse().toString('hex')
      return {
        ...one,
        txid,
      }
    }),
    outs: outs.filter(a => !!a)
  }
}

const getRecipients = (tx) => tx.outs.map(out => out.address).flat();

// sometimes there are no senders, for mining transactions
const getSenders = (tx) => [...new Set(tx.ins.filter(v => v.tx).map(v => v.tx.address).flat())];

/**
 
OUTS
[
  {
    value: 10000000000,
    script: <Buffer 76 a9 14 09 a7 c4 8f 0d b7 e8 b5 4b f4 49 4c 01 ed 66 b9 9f 32 16 a6 88 ac>,
    address: 'RAAF8xJ7Ya9hferR3ibtQDJHBFCXY4CSJE',
    asm: 'OP_DUP OP_HASH160 09a7c48f0db7e8b54bf4494c01ed66b99f3216a6 OP_EQUALVERIFY OP_CHECKSIG'
  },
  {
    value: 4999990000,
    script: <Buffer 76 a9 14 26 2b 88 c4 d5 3f ff 85 32 a1 6d fe e0 90 dd e8 7e 57 59 d7 88 ac>,
    address: 'RCm1ucq986kiXyAWFwHnQkJr8sM5sBqbVd',
    asm: 'OP_DUP OP_HASH160 262b88c4d53fff8532a16dfee090dde87e5759d7 OP_EQUALVERIFY OP_CHECKSIG'
  }
]

INS

[
  {
    hash: <Buffer ee d7 f4 fc 94 88 71 e3 c3 86 a4 9c de 0a 71 c4 97 cb c4 30 59 5c 72 c2 d5 7a f6 55 00 76 79 06>,
    index: 0,
    script: <Buffer 48 30 45 02 21 00 a9 fa b1 9a 42 f8 cd 9e 21 0c e8 11 bd 2b f9 c9 49 36 a3 79 fb c5 34 a9 93 b9 26 d7 f0 0c 0f 41 02 20 14 3e b1 25 f2 8a d3 f8 39 39 ... 23 more bytes>,
    sequence: 4294967295,
    witness: [],
    txid: 'eed7f4fc948871e3c386a49cde0a71c497cbc430595c72c2d57af65500767906',
    tx: {
      value: 5000000000,
      script: <Buffer 21 02 90 af f5 67 51 41 83 25 a6 30 5a d1 45 e0 24 5e 58 a9 48 c3 63 74 1d 23 1e ef 3b b5 4e e4 c3 45 ac>,
      address: 'RCm1ucq986kiXyAWFwHnQkJr8sM5sBqbVd',
      asm: '0290aff56751418325a6305ad145e0245e58a948c363741d231eef3bb54ee4c345 OP_CHECKSIG'
    }
  }
]
 */

const parseTransactionData = (tx) => {
  try {
    // skip C-index addresses since those are CC transactions
    const sumOuts = tx.outs.reduce((a, b) => isCindexAddress(b.address) ? a : a += b.value, 0);
    
    let sumIns = 0
    // probably there is a better way to find the current fee
    const FIXED_FEE = 10000;
    let fees = 0;
    // special case - incoming mining transaction
    // those dont have vins, hence they dont have vins values
    if (tx.ins.length > 1 && tx.ins[0].tx) {
      // skip C-index addresses since those are CC transactions
      sumIns = tx.ins.reduce((a, b) => isCindexAddress(b.tx?.address)  ? a : a += b.tx?.value, 0);
      fees = sumIns - sumOuts
    } else {
      fees = FIXED_FEE;
    }

    const senders = getSenders(tx);
    const recipients = getRecipients(tx);
  
    // find the change receiving address
    let changeReceivingAddress = null;
    senders.forEach(addr => {
      if (!changeReceivingAddress) {
        changeReceivingAddress = senders.find(s => s === addr);
      }
    })

    // calculate change
    let change = 0;
    if (changeReceivingAddress) {
      const txToAddress = tx.outs.find(s => s.address === changeReceivingAddress)
      if (txToAddress) {
        change = txToAddress ? txToAddress.value : 0;
      }
    }
    
    return {
      fees,
      value:  sumOuts - change,
      senders,
      recipients
    }
  } catch (e) {
    throw new Error(e);
  }
}


const isCindexAddress = (addr) => addr && addr.indexOf('C') === 0;

const isRAddress = (addr) => addr && addr.indexOf('R') === 0;

const isCcTransaction = (tx) => !!tx.ins.find(intx => isCindexAddress(intx.tx?.address))

module.exports = {
  decodeTransactionData,
  getRecipients,
  getSenders,
  parseTransactionData,
  isCcTransaction
}
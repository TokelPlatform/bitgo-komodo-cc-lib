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
const getSenders = (tx) => [...new Set(tx.ins.filter(v => v.tx ? v.tx.address : false).flat())];

const parseTransactionData = (tx) => {
  try {
    const sumOuts = tx.outs.reduce((a, b) => a += b.value, 0);
    
    let sumIns = 0
    // probably there is a better way to find the current fee
    const FIXED_FEE = 10000;
    let fees = 0;
    
    // special case - incoming mining transaction
    // those dont have vins, hence they dont have vins values
    if (tx.ins.length > 1 && tx.ins[0].tx) {
      sumIns = tx.ins.reduce((a, b) => a += b.tx?.value, 0);
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
      value: sumOuts - change,
      senders,
      recipients
    }
  } catch (e) {
    throw new Error(e);
  }
}
  
module.exports = {
  decodeTransactionData,
  getRecipients,
  getSenders,
  parseTransactionData
}
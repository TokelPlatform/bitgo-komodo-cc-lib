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
    outs: decoded.outs.map(out => {
      return {
        ...out,
        address: addresslib.fromOutputScript(out.script, network),
        asm: bscript.toASM(out.script),
      }
    })
  }
}

const getRecipients = (tx) => tx.outs.map(out => out.address).flat();

const getSenders = (tx) => [...new Set(tx.ins.map(v => v.tx.address).flat())];

const parseTransactionData = (tx) => {
  const sumOuts = tx.outs.reduce((a, b) => a += b.value, 0);
  const sumIns = tx.ins.reduce((a, b) => a += b.tx.value, 0);
  const senders = getSenders(tx);
  const recipients = getRecipients(tx);

  let changeReceivingAddress = null;
  senders.forEach(addr => {
    if (!changeReceivingAddress) {
      changeReceivingAddress = senders.find(s => s === addr);
    }
  })
  let change = 0;
  if (changeReceivingAddress) {
    const address = tx.outs.find(s => s.address === changeReceivingAddress)
    change = address ? address.value : 0;
  }
  return {
    fees: sumIns - sumOuts,
    value: sumOuts - change,
    senders,
    recipients
  }
}
  
module.exports = {
  decodeTransactionData,
  getRecipients,
  getSenders,
  parseTransactionData
}
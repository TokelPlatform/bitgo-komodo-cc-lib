// OP_DUP OP_HASH160 {pubKeyHash} OP_EQUALVERIFY OP_CHECKSIG

var bscript = require('../../script')
var types = require('../../types')
var typeforce = require('typeforce')
var OPS = require('bitcoin-ops')
const varint = require('varuint-bitcoin')

function check (script) {
  var chunks = bscript.decompile(script)

  return chunks.length === 8 &&
    chunks[1] === OPS.OP_CHECKLOCKTIMEVERIFY &&
    chunks[2] === OPS.OP_DROP &&
    chunks[3] === OPS.OP_DUP &&
    chunks[4] === OPS.OP_HASH160 &&
    chunks[5].length == 20 &&
    chunks[6] === OPS.OP_EQUALVERIFY &&
    chunks[7] === OPS.OP_CHECKSIG
}
check.toJSON = function () { return 'CLTV pubKeyHash output' }

function encode (pubKeyHash, nLockTime) {
  typeforce(types.Hash160bit, pubKeyHash)
  typeforce(types.Number, nLockTime)

  return bscript.compile([
    varint.encode(nLockTime), OPS.OP_CHECKLOCKTIMEVERIFY, OPS.OP_DROP,
    OPS.OP_DUP,
    OPS.OP_HASH160,
    pubKeyHash,
    OPS.OP_EQUALVERIFY,
    OPS.OP_CHECKSIG
  ])
}

function decode (buffer) {
  typeforce(check, buffer)

  var chunks = bscript.decompile(buffer)  
  return { pubKeyHash: chunks[5], nLockTime: varint.decode(chunks[0]) }
}

module.exports = {
  check: check,
  decode: decode,
  encode: encode
}

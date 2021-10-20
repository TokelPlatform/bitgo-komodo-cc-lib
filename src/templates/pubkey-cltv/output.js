// {nLockTime} OP_CLTV OP_DROP {pubKey} OP_CHECKSIG

var bscript = require('../../script')
var types = require('../../types')
var typeforce = require('typeforce')
var OPS = require('bitcoin-ops')
const varint = require('varuint-bitcoin')

function check (script) {  // could be either script or chunks
  var chunks = bscript.decompile(script)

  return chunks.length === 5 &&
    chunks[1] === OPS.OP_CHECKLOCKTIMEVERIFY &&
    chunks[2] === OPS.OP_DROP &&
    bscript.isCanonicalPubKey(chunks[3]) &&
    chunks[4] === OPS.OP_CHECKSIG
}
check.toJSON = function () { return 'CLTV pubKey output' }

function encode (pubKey, nLockTime) {
  typeforce(bscript.isCanonicalPubKey, pubKey)
  typeforce(types.Number, nLockTime)

  return bscript.compile([varint.encode(nLockTime), OPS.OP_CHECKLOCKTIMEVERIFY, OPS.OP_DROP, pubKey, OPS.OP_CHECKSIG])
}

function decode (buffer) {
  var chunks = bscript.decompile(buffer)
  typeforce(check, chunks)

  return { pubKey: chunks[3], nLockTime: varint.decode(chunks[0]) }
}

module.exports = {
  check: check,
  decode: decode,
  encode: encode
}

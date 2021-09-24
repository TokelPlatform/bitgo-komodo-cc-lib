// {condbin} OP_CRYPTOCONDITION

var ccbasic = require('../../../cc/ccbasic')
var bscript = require('../../script')
//var typeforce = require('typeforce')
//var OPS = require('bitcoin-ops')

function check (buffer) {
  return !!ccbasic.readCCSpk(buffer)
}
check.toJSON = function () { return 'cryptoconditions output' }

function encode (condition) {
  return ccbasic.makeCCSpk(condition)
}

function decode (buffer) {
  return bscript.compile([ccbasic.parseCCSpk(buffer), ccbasic.CCOPS.OP_CRYPTOCONDITIONS])
}

module.exports = {
  check: check,
  decode: decode,
  encode: encode
}

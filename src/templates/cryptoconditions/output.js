// {condbin} OP_CRYPTOCONDITION

var ccbasic = require('../../../cc/ccbasic')
var bscript = require('../../script')
//var typeforce = require('typeforce')
//var OPS = require('bitcoin-ops')

function check (script) {
  return !!ccbasic.readCCSpk(script)
}
check.toJSON = function () { return 'cryptoconditions output' }

function encode (condition) {
  return ccbasic.makeCCSpk(condition)
}

function decode (script) {
  return bscript.compile([ccbasic.parseCCSpk(script).cc, ccbasic.CCOPS.OP_CRYPTOCONDITIONS])
}

module.exports = {
  check: check,
  decode: decode,
  encode: encode
}

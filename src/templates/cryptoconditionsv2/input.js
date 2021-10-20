// {condition}

//var bscript = require('../../script')
var ccbasic = require('../../../cc/ccbasic')
//var typeforce = require('typeforce')

function check (script) {
  return !!ccbasic.readCCScriptSig(script)
}
check.toJSON = function () { return 'cryptoconditions input' }

function encodeStack (signature) {
  throw Error("encodeStack unsupported for cc")
}

function encode (condition) {
  return ccbasic.makeCCScriptSig(condition)
}

function decodeStack (stack) {
  throw Error("decodeStack unsupported for cc")
}

function decode (buffer) {
  return ccbasic.readCCScriptSig(buffer)
}

module.exports = {
  check: check,
  decode: decode,
  decodeStack: decodeStack,
  encode: encode,
  encodeStack: encodeStack
}

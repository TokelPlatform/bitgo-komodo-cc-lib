var Buffer = require('safe-buffer').Buffer
var bech32 = require('bech32')
var bs58check = require('bs58check')
var bscript = require('./script')
var btemplates = require('./templates')
var networks = require('./networks')
var typeforce = require('typeforce')
var types = require('./types')
var bcrypto = require('./crypto')

function fromBase58Check (address) {
  var payload = bs58check.decode(address)

  // TODO: 4.0.0, move to "toOutputScript"
  if (payload.length < 21) throw new TypeError(address + ' is too short')
  if (payload.length > 22) throw new TypeError(address + ' is too long')

  var multibyte = payload.length === 22
  var offset = multibyte ? 2 : 1

  var version = multibyte ? payload.readUInt16BE(0) : payload[0]
  var hash = payload.slice(offset)

  return { version: version, hash: hash }
}

function fromBech32 (address) {
  var result = bech32.decode(address)
  var data = bech32.fromWords(result.words.slice(1))

  return {
    version: result.words[0],
    prefix: result.prefix,
    data: Buffer.from(data)
  }
}

function toBase58Check (hash, version) {
  typeforce(types.tuple(types.Hash160bit, types.UInt16), arguments)

  // Zcash adds an extra prefix resulting in a bigger (22 bytes) payload. We identify them Zcash by checking if the
  // version is multibyte (2 bytes instead of 1)
  var multibyte = version > 0xff
  var size = multibyte ? 22 : 21
  var offset = multibyte ? 2 : 1

  var payload = Buffer.allocUnsafe(size)
  multibyte ? payload.writeUInt16BE(version, 0) : payload.writeUInt8(version, 0)
  hash.copy(payload, offset)

  return bs58check.encode(payload)
}

function toBech32 (data, version, prefix) {
  var words = bech32.toWords(data)
  words.unshift(version)

  return bech32.encode(prefix, words)
}

function fromOutputScript (outputScript, network) {
  network = network || networks.bitcoin

  // dimxy added this for pubkey (strangely it was omitted):
  if (btemplates.pubKey.output.check(outputScript)) return toBase58Check(bcrypto.hash160(bscript.compile(outputScript).slice(1, 33+1)), network.pubKeyHash)

  if (btemplates.pubKeyHash.output.check(outputScript)) return toBase58Check(bscript.compile(outputScript).slice(3, 23), network.pubKeyHash)
  if (btemplates.scriptHash.output.check(outputScript)) return toBase58Check(bscript.compile(outputScript).slice(2, 22), network.scriptHash)
  if (btemplates.witnessPubKeyHash.output.check(outputScript)) return toBech32(bscript.compile(outputScript).slice(2, 22), 0, network.bech32)
  if (btemplates.witnessScriptHash.output.check(outputScript)) return toBech32(bscript.compile(outputScript).slice(2, 34), 0, network.bech32)

    // dimxy added for cltv:
  if (btemplates.pubKeyHashCLTV.output.check(outputScript)) {
    decoded = btemplates.pubKeyHashCLTV.output.decode(outputScript);
    return toBase58Check(decoded.pubKeyHash, network.pubKeyHash)
  }
  if (btemplates.pubKeyCLTV.output.check(outputScript)) {
    decoded = btemplates.pubKeyCLTV.output.decode(outputScript);
    return toBase58Check(bcrypto.hash160(decoded.pubKey), network.pubKeyHash)
  }

  // dimxy added for cc:
  if (!network.cryptoconditionHash)
    throw new Error(bscript.toASM(outputScript) + ' not cc enabled network (no cryptoconditionHash prefix)')

  if (btemplates.cryptoconditions.output.check(outputScript)) return toBase58Check(bcrypto.hash160(btemplates.cryptoconditions.output.decode(outputScript)), network.cryptoconditionHash)
  // does the same but for readability
  if (btemplates.cryptoconditionsv2.output.check(outputScript)) return toBase58Check(bcrypto.hash160(btemplates.cryptoconditionsv2.output.decode(outputScript)), network.cryptoconditionHash)

  throw new Error(bscript.toASM(outputScript) + ' has no matching Address')
}

function toOutputScript (address, network) {
  network = network || networks.bitcoin

  var decode
  try {
    decode = fromBase58Check(address)
  } catch (e) {}

  if (decode) {
    if (decode.version === network.pubKeyHash) return btemplates.pubKeyHash.output.encode(decode.hash)
    if (decode.version === network.scriptHash) return btemplates.scriptHash.output.encode(decode.hash)
  } else {
    try {
      decode = fromBech32(address)
    } catch (e) {}

    if (decode) {
      if (decode.prefix !== network.bech32) throw new Error(address + ' has an invalid prefix')
      if (decode.version === 0) {
        if (decode.data.length === 20) return btemplates.witnessPubKeyHash.output.encode(decode.data)
        if (decode.data.length === 32) return btemplates.witnessScriptHash.output.encode(decode.data)
      }
    }
  }

  throw new Error(address + ' has no matching Script')
}

module.exports = {
  fromBase58Check: fromBase58Check,
  fromBech32: fromBech32,
  fromOutputScript: fromOutputScript,
  toBase58Check: toBase58Check,
  toBech32: toBech32,
  toOutputScript: toOutputScript
}

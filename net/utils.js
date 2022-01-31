const url = require('url')
const ws = require('ws')
const encodeHeader = require('bitcoin-protocol').types.header.encode
const encodeTx = require('bitcoin-protocol').types.transaction.encode

// TODO: create-hash package
const { createHash } = require('crypto')

function getRandom (array) {
  return array[Math.floor(Math.random() * array.length)]
}

function parseAddress (address) {
  // if address has a protocol in it, we don't need to add a fake one
  if ((/^\w+:\/\//).test(address)) return url.parse(address)
  return url.parse('x://' + address)
}

function assertParams (params) {
  // TODO: check more things
  // TODO: give more specific errors
  if (!params ||
    params.network == null
    /*|| !params.defaultPort*/) {
    throw new Error('Invalid network parameters')
  }
}

function sha256 (data) {
  return createHash('sha256').update(data).digest()
}

function getBlockHash (header) {
  let headerBytes = encodeHeader(header)
  return sha256(sha256(headerBytes))
}

function getTxHash (tx) {
  let txBytes = encodeTx(tx)
  return sha256(sha256(txBytes))
}

/*
isWebSocket(socket)
{
  return socket?.socket instanceof ws;
}
getSocketUrl(socket)
{
  let remotep = '';
  if (socket !== undefined) {
    if (isWebSocket(socket))
      return socket.socket.url;
    else {
      if (socket.remoteAddress)
          remotep += socket.remoteAddress
      if (socket.remotePort)
          remotep += ':' + socket.remotePort
    }
  }
  return remotep
}
*/

const serviceBits = {
  'NODE_NETWORK': 0,
  'NODE_GETUTXO': 1,
  'NODE_BLOOM': 2,
  'NODE_WITNESS': 3,
  'NODE_NETWORK_LIMITED': 10,
  'NODE_NSPV': 30,
}
function getServices (buf) {
  let services = {}
    if (Buffer.isBuffer(buf))  {
    for (let name in serviceBits) {
      let byteIndex = Math.floor(serviceBits[name] / 8)
      let byte = buf.readUInt32LE(byteIndex)
      let bitIndex = serviceBits[name] % 8
      if (byte & (1 << bitIndex)) {
        services[name] = true
      }
    }
  }
  return services
}

function shuffleArray(array) {
  for (var i = array.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = array[i];
      array[i] = array[j];
      array[j] = temp;
  }
}

module.exports = {
  getRandom,
  parseAddress,
  assertParams,
  getBlockHash,
  getTxHash,
  sha256,
  getServices,
  shuffleArray,
}

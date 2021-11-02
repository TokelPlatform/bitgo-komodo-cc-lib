'use strict'

const struct = require('varstruct')
const varint = require('varuint-bitcoin')
const ip = require('ip')

const bufferutils = require("../src/bufferutils");

//var typeforce = require('typeforce');
//const { varBuffer } = require('bitcoin-protocol/src/types');
//var typeforceNT = require('typeforce/nothrow');

exports.nspvVersion = 0x0005;

exports.buffer8 = struct.Buffer(8)
exports.buffer32 = struct.Buffer(32)
exports.varBuffer = struct.VarBuffer(varint)

exports.boolean = (function () {
  function encode (value, buffer, offset) {
    return struct.UInt8.encode(+!!value, buffer, offset)
  }

  function decode (buffer, offset, end) {
    return !!struct.UInt8.decode(buffer, offset, end)
  }

  encode.bytes = decode.bytes = 1
  return { encode, decode, encodingLength: function () { return 1 } }
})()

exports.ipAddress = (function () {
  let IPV4_PREFIX = Buffer.from('00000000000000000000ffff', 'hex')
  function encode (value, buffer, offset) {
    if (!buffer) buffer = Buffer.alloc(16)
    if (!offset) offset = 0
    if (offset + 16 > buffer.length) throw new RangeError('destination buffer is too small')

    if (ip.isV4Format(value)) {
      IPV4_PREFIX.copy(buffer, offset)
      ip.toBuffer(value, buffer, offset + 12)
    } else if (ip.isV6Format(value)) {
      ip.toBuffer(value, buffer, offset)
    } else {
      throw Error('Invalid IP address value')
    }

    return buffer
  }

  function decode (buffer, offset, end) {
    if (!offset) offset = 0
    if (!end) end = buffer.length
    if (offset + 16 > end) throw new RangeError('not enough data for decode')

    let start = buffer.slice(offset, offset + 12).equals(IPV4_PREFIX) ? 12 : 0
    return ip.toString(buffer.slice(offset + start, offset + 16))
  }

  encode.bytes = decode.bytes = 16
  return { encode, decode, encodingLength: () => 16 }
})()

exports.peerAddress = struct([
  { name: 'services', type: exports.buffer8 },
  { name: 'address', type: exports.ipAddress },
  { name: 'port', type: struct.UInt16BE }
])

exports.inventoryVector = struct([
  { name: 'type', type: struct.UInt32LE },
  { name: 'hash', type: exports.buffer32 }
])

exports.alertPayload = struct([
  { name: 'version', type: struct.Int32LE },
  { name: 'relayUntil', type: struct.UInt64LE },
  { name: 'expiration', type: struct.UInt64LE },
  { name: 'id', type: struct.Int32LE },
  { name: 'cancel', type: struct.Int32LE },
  { name: 'cancelSet', type: struct.VarArray(varint, struct.Int32LE) },
  { name: 'minVer', type: struct.Int32LE },
  { name: 'maxVer', type: struct.Int32LE },
  { name: 'subVerSet', type: struct.VarArray(varint, struct.VarString(varint, 'ascii')) },
  { name: 'priority', type: struct.Int32LE },
  { name: 'comment', type: struct.VarString(varint, 'ascii') },
  { name: 'statusBar', type: struct.VarString(varint, 'ascii') },
  { name: 'reserved', type: struct.VarString(varint, 'ascii') }
])

exports.messageCommand = (function () {
  let buffer12 = struct.Buffer(12)

  function encode (value, buffer, offset) {
    let bvalue = Buffer.from(value, 'ascii')
    let nvalue = Buffer.alloc(12)
    bvalue.copy(nvalue, 0)
    for (let i = bvalue.length; i < nvalue.length; ++i) nvalue[i] = 0
    return buffer12.encode(nvalue, buffer, offset)
  }

  function decode (buffer, offset, end) {
    let bvalue = buffer12.decode(buffer, offset, end)
    let stop
    for (stop = 0; bvalue[stop] !== 0; ++stop) {
      if (stop === 11) {
        throw Error('Non-terminated string. Are you sure this is a Bitcoin packet?')
      }
    }
    for (let i = stop; i < bvalue.length; ++i) {
      if (bvalue[i] !== 0) {
        throw Error('Found a non-null byte after the first null byte in a null-padded string')
      }
    }
    return bvalue.slice(0, stop).toString('ascii')
  }

  encode.bytes = decode.bytes = 12
  return { encode, decode, encodingLength: () => 12 }
})()

let kmdtransaction = struct([
  { name: 'version', type: struct.Int32LE },
  { name: 'versionGroupId', type: struct.Int32LE },

  {
    name: 'ins',
    type: struct.VarArray(varint, struct([
      { name: 'hash', type: exports.buffer32 },
      { name: 'index', type: struct.UInt32LE },
      { name: 'script', type: exports.varBuffer },
      { name: 'sequence', type: struct.UInt32LE }
    ]))
  },
  {
    name: 'outs',
    type: struct.VarArray(varint, struct([
      { name: 'value', type: struct.UInt64LE },
      { name: 'script', type: exports.varBuffer }
    ]))
  },
  { name: 'locktime', type: struct.UInt32LE },
  { name: 'expiryHeight', type: struct.UInt32LE },
  { name: 'valueBalance', type: struct.UInt64LE },

  { name: 'vShieldedSpendSize', type: struct.VarArray(varint, struct([ { name: 'hash', type: exports.buffer32 } ])) },
  { name: 'vShieldedOutputSize', type: struct.VarArray(varint, struct([ { name: 'hash', type: exports.buffer32 } ])) },
  { name: 'vJoinSplitSize', type: struct.VarArray(varint, struct([ { name: 'hash', type: exports.buffer32 } ])) }
])
let witnessTransaction = struct([
  { name: 'version', type: struct.Int32LE },
  { name: 'marker', type: struct.Byte },
  { name: 'flag', type: struct.Byte },
  {
    name: 'ins',
    type: struct.VarArray(varint, struct([
      { name: 'hash', type: exports.buffer32 },
      { name: 'index', type: struct.UInt32LE },
      { name: 'script', type: exports.varBuffer },
      { name: 'sequence', type: struct.UInt32LE }
    ]))
  },
  {
    name: 'outs',
    type: struct.VarArray(varint, struct([
      { name: 'value', type: struct.UInt64LE },
      { name: 'script', type: exports.varBuffer }
    ]))
  }
])
let varBufferArray = struct.VarArray(varint, exports.varBuffer)
exports.kmdtransaction = (function () {
  function encode (value, buffer = Buffer.alloc(encodingLength(value)), offset = 0) {
    value = Object.assign({}, value)
    let hasWitness = value.ins.some(({ witness }) =>
      witness != null && witness.length > 0)
    let type = hasWitness ? witnessTransaction : kmdtransaction

    if (hasWitness) {
      value.marker = 0
      value.flag = 1
    }

    type.encode(value, buffer, offset)
    let bytes = type.encode.bytes

    if (hasWitness) {
      let encode = (type, value) => {
        type.encode(value, buffer, offset + bytes)
        bytes += type.encode.bytes
      }
      for (let input of value.ins) {
        encode(varBufferArray, input.witness || [])
      }
      encode(struct.UInt32LE, value.locktime)
    }

    encode.bytes = bytes
    return buffer.slice(offset, offset + bytes)
  }

  function decode (buffer, offset = 0, end = buffer.length) {
    let hasWitness = buffer[offset + 4] === 0
    let type = hasWitness ? witnessTransaction : kmdtransaction

    let tx = type.decode(buffer, offset, end)
    decode.bytes = type.decode.bytes
    return tx
  }

  function encodingLength (value) {
    value = Object.assign({}, value)
    let hasWitness = value.ins.some(({ witness }) =>
      witness != null && witness.length > 0)
    let type = hasWitness ? witnessTransaction : kmdtransaction

    let witnessLength = 0
    if (hasWitness) {
      for (let input of value.ins) {
        witnessLength += varBufferArray.encodingLength(input.witness || [])
      }
      witnessLength += 4
    }

    return type.encodingLength(value) + witnessLength
  }

  return { encode, decode, encodingLength }
})()

exports.kmdheader = struct([
  { name: 'version', type: struct.Int32LE },
  { name: 'prevHash', type: exports.buffer32 },
  { name: 'merkleRoot', type: exports.buffer32 },
  { name: 'hashFinalSaplingRoot', type: exports.buffer32 },
  { name: 'timestamp', type: struct.UInt32LE },
  { name: 'bits', type: struct.UInt32LE },
  { name: 'nonce', type: exports.buffer32 },
  { name: 'solution', type: exports.varBuffer }
])

let vhashes = struct.VarArray(varint, exports.buffer32)

const NSPVMSGS = {
  NSPV_INFO: 0x00,
  NSPV_INFORESP: 0x01,
  NSPV_UTXOS: 0x02,
  NSPV_UTXOSRESP: 0x03,
  NSPV_NTZS: 0x04,
  NSPV_NTZSRESP: 0x05,
  NSPV_NTZSPROOF: 0x06,
  NSPV_NTZSPROOFRESP: 0x07,
  NSPV_TXPROOF: 0x08,
  NSPV_TXPROOFRESP: 0x09,
  NSPV_BROADCAST: 0x0c,
  NSPV_BROADCASTRESP: 0x0d,
  NSPV_TXIDS: 0x0e,
  NSPV_TXIDSRESP: 0x0f,
  NSPV_REMOTERPC: 0x14,
  NSPV_REMOTERPCRESP: 0x15,  
  NSPV_ERRORRESP: 0xff,  
};

exports.NSPVMSGS = NSPVMSGS;

let bufferaddr = struct.Buffer(64);
//let methodtype = struct.Buffer(64);

let nspvNtz = struct([
  { name: 'blockhash', type: exports.buffer32 },
  { name: 'txid', type: exports.buffer32 },
  { name: 'otherTxid', type: exports.buffer32 },
  { name: 'height', type: struct.Int32LE },
  { name: 'txidheight', type: struct.Int32LE },
  { name: 'timestamp', type: struct.UInt32LE },
]);

let nspvInfoReq = struct([
  { name: 'reqCode', type: struct.UInt8 },
  { name: 'requestId', type: struct.UInt32LE },
  { name: 'version', type: struct.UInt32LE },
  { name: 'reqHeight', type: struct.Int32LE }
]);

let nspvInfoResp = struct([
  { name: 'respCode', type: struct.UInt8 },
  { name: 'requestId', type: struct.UInt32LE },
  { name: 'notarization', type: nspvNtz },
  { name: 'blockhash', type: exports.buffer32 },
  { name: 'height', type: struct.Int32LE },
  { name: 'hdrheight', type: struct.Int32LE },
  { name: 'header', type: exports.kmdheader },
  { name: 'version', type: struct.UInt32LE },
]);


let nspvUtxosReq = struct([
  { name: 'reqCode', type: struct.UInt8 },
  { name: 'requestId', type: struct.UInt32LE },
  { name: 'coinaddr', type: struct.VarString(struct.UInt8, 'ascii')  },  // simply UInt8 as komodod currently checks only 1 byte len
  { name: 'CCflag', type: struct.UInt8 },
  { name: 'skipcoint', type: struct.UInt32LE },
  { name: 'filter', type: struct.UInt32LE }
]);

let nspvUtxosResp = struct([
  { name: 'respCode', type: struct.UInt8 },
  { name: 'requestId', type: struct.UInt32LE },
  {
    name: 'utxos',
    type: struct.VarArray(struct.UInt16LE, struct([
      { name: 'txid', type: exports.buffer32 },
      { name: 'satoshis', type: struct.Int64LE },
      { name: 'extradata', type: struct.Int64LE },
      { name: 'vout', type: struct.UInt32LE },
      { name: 'height', type: struct.UInt32LE },
      { name: 'script', type: exports.varBuffer }
    ]))
  },
  { name: 'total', type: struct.UInt64LE },
  { name: 'interest', type: struct.UInt64LE },
  { name: 'nodeheight', type: struct.UInt32LE },
  { name: 'filter', type: struct.UInt32LE },
  { name: 'CCflag', type: struct.UInt16LE },
  { name: 'skipcount', type: struct.UInt32LE },
  { name: 'coinaddr', type: bufferaddr }
]);

// custom parsers for broadcast as this type is impossible to be mapped to standard bitcoin types like varbuffer
let nspvBroadcastReq = (function(){
  function encode(value, buffer, offset) {
    let bufferWriter = new bufferutils.BufferWriter(buffer, offset);
    bufferWriter.writeUInt8(value.reqCode);
    bufferWriter.writeUInt32(value.requestId);
    bufferWriter.writeSlice(value.txid);
    bufferWriter.writeUInt32(value.txdata.length);
    bufferWriter.writeSlice(value.txdata);
    encode.bytes = bufferWriter.offset;
  }
  function encodingLength(value) {
    return 1 + 4 + 32 + 4 + value.txdata.length; // sizeof(uint8_t) + txid256 + sizeof(int32) + txdata.length
  }
  function decode(buffer, offset, end) {
    return { };  // not used
  }
  return { encode, decode, encodingLength }
})();
let nspvBroadcastResp = (function(){
  function encode(value, buffer, offset) {
    // not used
  }
  function encodingLength(value) {
    return 0; // resp not encoded
  }
  function decode(buffer, offset, end) {
    let slicedBuffer = buffer.slice(offset, end);
    let bufferReader = new bufferutils.BufferReader(slicedBuffer);
    let respCode = bufferReader.readUInt8();
    let requestId = bufferReader.readUInt32();
    let txid = bufferReader.readSlice(32);
    let retcode = bufferReader.readInt32();
    return { respCode, requestId, txid, retcode };
  }
  return { encode, decode, encodingLength }
})();

// custom parser for remote rpc req/resp as varBuffer is not supported on the server side
let nspvRemoteRpcReq = (function(){
  function encode(value, buffer, offset) {
    let bufferWriter = new bufferutils.BufferWriter(buffer, offset);
    bufferWriter.writeUInt8(value.reqCode);
    bufferWriter.writeUInt32(value.requestId);
    bufferWriter.writeUInt32(value.length);
    bufferWriter.writeSlice(value.jsonSer);
    encode.bytes = bufferWriter.offset;
  }
  function encodingLength(value) {
    return 1 + 4 + 4 + value.jsonSer.length; // sizeof(uint8_t) + sizeof(int32) + jsonSer.length
  }
  function decode(buffer, offset, end) {
    return { };  // not used
  }
  return { encode, decode, encodingLength }
})();

let nspvRemoteRpcResp = (function(){
  function encode(value, buffer, offset) {
    // not used, only decode
    return {};
  }
  function encodingLength(value) {
    return 0; // not used, only decode
  }
  function decode(buffer, offset, end) {
    let slicedBuffer = buffer.slice(offset, end);
    let bufferReader = new bufferutils.BufferReader(slicedBuffer);
    let respCode = bufferReader.readUInt8();
    let requestId = bufferReader.readUInt32();
    let method = bufferReader.readSlice(64);
    let jsonSer = bufferReader.readSlice(slicedBuffer.length - bufferReader.offset);  // read until end
    return { respCode, requestId, method, jsonSer };
  }
  return { encode, decode, encodingLength };
})();

let nspvTxidsReq = struct([
  { name: 'reqCode', type: struct.UInt8 },
  { name: 'requestId', type: struct.UInt32LE },
  { name: 'coinaddr', type: struct.VarString(struct.UInt8, 'ascii')  },  // simply UInt8 as komodod currently checks only 1 byte len
  { name: 'CCflag', type: struct.UInt8 },
  { name: 'skipcoint', type: struct.UInt32LE },
  { name: 'filter', type: struct.UInt32LE }
]);

let nspvTxidsResp = struct([
  { name: 'respCode', type: struct.UInt8 },
  { name: 'requestId', type: struct.UInt32LE },
  {
    name: 'txids',
    type: struct.VarArray(struct.UInt16LE, struct([
      { name: 'txid', type: exports.buffer32 },
      { name: 'satoshis', type: struct.Int64LE },
      { name: 'vout', type: struct.UInt32LE },
      { name: 'height', type: struct.UInt32LE },
    ]))
  },
  { name: 'nodeheight', type: struct.UInt32LE },
  { name: 'filter', type: struct.UInt32LE },
  { name: 'CCflag', type: struct.UInt16LE },
  { name: 'skipcount', type: struct.UInt32LE },
  { name: 'coinaddr', type: bufferaddr }
]);

// same as kmdmessages.merkleblock but formats flags as array as bitcoin-merkle-proof lib wants it
exports.txProof = (function(){
  function encode(value, buffer, offset) {
    // not used
  }
  function encodingLength(value) {
    return 0; // not used
  }
  function decode(buffer, offset, end) {
    let slicedBuffer = buffer.slice(offset, end);
    let bufferReader = new bufferutils.BufferReader(slicedBuffer);
    let header = exports.kmdheader.decode(bufferReader.buffer, bufferReader.offset);
    bufferReader.offset += exports.kmdheader.decode.bytes;
    let numTransactions = bufferReader.readUInt32();
    let hashes = vhashes.decode(bufferReader.buffer, bufferReader.offset);
    bufferReader.offset += vhashes.decode.bytes;
    let vBits = bufferReader.readVarSlice();
    // make partial merkle tree structure for bitcoin-merkle-proof lib:
    return { numTransactions: numTransactions, hashes: hashes, flags: vBits, merkleRoot: header.merkleRoot }; 
  }
  return { encode, decode, encodingLength }
})();


// custom parser for txproof rpc req/resp msgs (as varBuffer is not used on the server side)
let nspvTxProofReq = (function(){
  function encode(value, buffer, offset) {
    let bufferWriter = new bufferutils.BufferWriter(buffer, offset);
    bufferWriter.writeUInt8(value.reqCode);
    bufferWriter.writeUInt32(value.requestId);
    bufferWriter.writeUInt32(value.height);
    bufferWriter.writeUInt32(value.vout);
    bufferWriter.writeSlice(value.txid);
    encode.bytes = bufferWriter.offset;
  }
  function encodingLength(value) {
    return 1 + 4 + 4 + 4 + 32;
  }
  function decode(buffer, offset, end) {
    return { };  // not used
  }
  return { encode, decode, encodingLength }
})();

let nspvTxProofResp = (function(){
  function encode(value, buffer, offset) {
    // not used, only decode
  }
  function encodingLength(value) {
    return 0; // not used, only decode
  }

  function decode(buffer, offset = 0, end = buffer.length) {
    let slicedBuffer = buffer.slice(offset, end);
    let bufferReader = new bufferutils.BufferReader(slicedBuffer);
    let respCode = bufferReader.readUInt8();
    let requestId = bufferReader.readUInt32();
    let txid = bufferReader.readSlice(32);
    let unspentValue = bufferReader.readUInt64();
    let height = bufferReader.readUInt32();
    let vout = bufferReader.readUInt32();
    let txlen = bufferReader.readUInt32();
    let txbuf = bufferReader.readSlice(txlen);
    let txprooflen = bufferReader.readUInt32();
    let txproofbuf = bufferReader.readSlice(txprooflen);

    let tx = exports.kmdtransaction.decode(txbuf);
    let pmt = exports.txProof.decode(txproofbuf);
    bufferReader.offset += exports.txProof.decode.bytes;

    return { respCode, requestId, txid, unspentValue, height, vout, tx, partialMerkleTree: pmt };
  }
  return { encode, decode, encodingLength }
})();

/*
struct NSPV_ntzsresp {
    struct NSPV_ntz prevntz, nextntz;
    int32_t reqheight;
};
*/


// custom parser for ntz req/resp nspv msgs
let nspvNtzsReq = (function(){
  function encode(value, buffer, offset) {
    let bufferWriter = new bufferutils.BufferWriter(buffer, offset);
    bufferWriter.writeUInt8(value.reqCode);
    bufferWriter.writeUInt32(value.requestId);
    bufferWriter.writeUInt32(value.height);
    encode.bytes = bufferWriter.offset;
  }
  function encodingLength(value) {
    return 1 + 4 + 4;
  }
  function decode(buffer, offset, end) {
    return { };  // not used
  }
  return { encode, decode, encodingLength }
})();

let nspvNtzsResp = (function(){
  function encode(value, buffer, offset) {
    // not used, only decode
    return { };
  }
  function encodingLength(value) {
    return 0; // not used, only decode
  }

  function decode(buffer, offset, end) {
    let slicedBuffer = buffer.slice(offset, end);
    let bufferReader = new bufferutils.BufferReader(slicedBuffer);
    let respCode = bufferReader.readUInt8();
    let requestId = bufferReader.readUInt32();
    let prevntz = nspvNtz.decode(bufferReader.buffer, bufferReader.offset);
    bufferReader.offset += nspvNtz.decode.bytes;
    let nextntz = nspvNtz.decode(bufferReader.buffer, bufferReader.offset);
    bufferReader.offset += nspvNtz.decode.bytes;
    let reqHeight = bufferReader.readUInt32();
    return { respCode, requestId, prevntz, nextntz, reqHeight };
  }
  return { encode, decode, encodingLength };
})();

// custom parser for req/resp nspv msgs to get notarisation txns :
// req ntz txns and tx proofs
let nspvNtzsProofReq = (function(){
  function encode(value, buffer, offset) {
    let bufferWriter = new bufferutils.BufferWriter(buffer, offset);
    bufferWriter.writeUInt8(value.reqCode);
    bufferWriter.writeUInt32(value.requestId);
    bufferWriter.writeSlice(value.prevTxid);
    bufferWriter.writeSlice(value.nextTxid);
    encode.bytes = bufferWriter.offset;
  }
  function encodingLength(value) {
    return 1 + 4 + 32 + 32;
  }
  function decode(buffer, offset, end) {
    return { };  // not used
  }
  return { encode, decode, encodingLength }
})();

// resp with ntz txns 
let nspvNtzsProofResp = (function(){
  function encode(value, buffer, offset) {
    // not used, only decode
    return { };
  }
  function encodingLength(value) {
    return 0; // not used, only decode
  }

  function decodeNtzsProofShared(bufferReader) {
    let numhdrs_l = bufferReader.readUInt8();
    let numhdrs_h = bufferReader.readUInt8();
    let numhdrs = (numhdrs_h << 8) + numhdrs_l;  // dont have this: bufferReader.readUInt16();
    let hdrs = [];
    for (let i = 0; i < numhdrs; i ++)   {
      //hdrs.push(decodeEquiHdr(bufferReader));
      hdrs.push(exports.kmdheader.decode(bufferReader.buffer, bufferReader.offset));
      bufferReader.offset += exports.kmdheader.decode.bytes;
    }

    let prevht = bufferReader.readUInt32();   // from prev ntz tx opreturn
    let nextht = bufferReader.readUInt32();   // from next ntz tx opreturn
    let pad32 = bufferReader.readUInt32();

    let pad16_l = bufferReader.readUInt8();
    let pad16_h = bufferReader.readUInt8();
    let pad16 = (pad16_h << 8) + pad16_l; // bufferReader.readUInt16();
    return { numhdrs, hdrs, prevht, nextht, pad32, pad16 };
  }
  function decode(buffer, offset, end) {
    let slicedBuffer = buffer.slice(offset, end);
    let bufferReader = new bufferutils.BufferReader(slicedBuffer);
    let respCode = bufferReader.readUInt8();
    let requestId = bufferReader.readUInt32();
    let common = decodeNtzsProofShared(bufferReader);
    let prevtxid = bufferReader.readSlice(32);
    let nexttxid = bufferReader.readSlice(32);
    let prevtxidht = bufferReader.readUInt32();  // prev ntz tx height
    let nexttxidht = bufferReader.readUInt32();  // next ntz tx height
    let prevtxlen = bufferReader.readUInt32();
    let prevtxbuf = bufferReader.readSlice(prevtxlen);
    let nexttxlen = bufferReader.readUInt32();
    let nexttxbuf = bufferReader.readSlice(nexttxlen);
    return { respCode, requestId, common, prevtxid, nexttxid, prevtxidht, nexttxidht, prevtxlen, nexttxlen, prevtxbuf, nexttxbuf };
  }
  return { encode, decode, encodingLength };
})();

// error may be returned to any request:
let nspvErrorResp = struct([
  { name: 'respCode', type: struct.UInt8 },
  { name: 'requestId', type: struct.UInt32LE },
  { name: 'errCode', type: struct.Int32LE },
  { name: 'errDesc', type: struct.VarString(struct.UInt8, 'ascii')  },  
]);

// encode nspv requests
exports.nspvReq = (function () {
  function encode (value, buffer = Buffer.alloc(encodingLength(value)), offset = 0) {
    value = Object.assign({}, value)
    let type = getEncodingType(value.reqCode);
    if (type === undefined)
      return;
    type.encode(value, buffer, offset)
    let bytes = type.encode.bytes
    encode.bytes = bytes
    return buffer.slice(offset, offset + bytes)
  }

  function getEncodingType(code)
  {
    let type;
    switch(code)
    {
      case NSPVMSGS.NSPV_INFO:
        type = nspvInfoReq;
        break;
      case NSPVMSGS.NSPV_UTXOS:
        type = nspvUtxosReq;
        break;
      case NSPVMSGS.NSPV_BROADCAST:
        type = nspvBroadcastReq;
        break;
      case NSPVMSGS.NSPV_NTZS:
        type = nspvNtzsReq;
        break;
      case NSPVMSGS.NSPV_NTZSPROOF:
        type = nspvNtzsProofReq;
        break;
      case NSPVMSGS.NSPV_TXPROOF:
        type = nspvTxProofReq;
        break;
      case NSPVMSGS.NSPV_TXIDS:
        type = nspvTxidsReq;
        break;
      case NSPVMSGS.NSPV_REMOTERPC:
        type = nspvRemoteRpcReq;
        break;
      default:
        return;
    }
    return type;
  }

  function decode (buffer, offset = 0, end = buffer.length) {
    let reqCode = buffer[0];
    let type = getEncodingType(reqCode);
    if (type === undefined)
      return;    
    let req = type.decode(buffer, offset, end)
    decode.bytes = type.decode.bytes
    return req
  }

  function encodingLength (value) {
    value = Object.assign({}, value) // filter unknown props
    let type = getEncodingType(value.reqCode);
    if (type === undefined)
      return;
    return type.encodingLength(value)
  }
  return { encode, decode, encodingLength }
})()

// decode nspv responses
exports.nspvResp = (function () {
  function encode (value, buffer = Buffer.alloc(encodingLength(value)), offset = 0) {
    value = Object.assign({}, value)
    let type = getEncodingType(value.respCode);
    if (type === undefined)
      return;
    type.encode(value, buffer, offset)
    let bytes = type.encode.bytes
    encode.bytes = bytes
    return buffer.slice(offset, offset + bytes)
  }

  function getEncodingType(code)
  {
    let type;
    switch(code)
    {
      case NSPVMSGS.NSPV_INFORESP:
        type = nspvInfoResp;
        break;
      case NSPVMSGS.NSPV_UTXOSRESP:
        type = nspvUtxosResp;
        break;
      case NSPVMSGS.NSPV_BROADCASTRESP:
        type = nspvBroadcastResp;
        break;
      case NSPVMSGS.NSPV_NTZSRESP:
        type = nspvNtzsResp;
        break;
      case NSPVMSGS.NSPV_NTZSPROOFRESP:
        type = nspvNtzsProofResp;
        break;
      case NSPVMSGS.NSPV_TXPROOFRESP:
        type = nspvTxProofResp;
        break;
      case NSPVMSGS.NSPV_TXIDSRESP:
        type = nspvTxidsResp;
        break;
      case NSPVMSGS.NSPV_REMOTERPCRESP:
        type = nspvRemoteRpcResp;
        break;
      case NSPVMSGS.NSPV_ERRORRESP:
        type = nspvErrorResp;
        break;
      default:
        return;
    }
    return type;
  }

  function decode (buffer, offset = 0, end = buffer.length) {
    let respCode = buffer[0];
    let type = getEncodingType(respCode);
    if (type === undefined)
      return;
    let resp = type.decode(buffer, offset, end)
    decode.bytes = type.decode.bytes
    return resp
  }

  function encodingLength (value) {
    value = Object.assign({}, value) // filter unknown props
    let type = getEncodingType(value.respCode);
    if (type === undefined)
      return;

    return type.encodingLength(value)
  }

  return { encode, decode, encodingLength }
})()
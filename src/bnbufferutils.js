
const { BufferReader, BufferWriter } = require('./bufferutils')
const bn64 = require('./bn64')

class BNBufferReader extends BufferReader {
  constructor (buffer, offset) {
    super(buffer, offset)
  }

  readBigInt64() {
    let v = bn64.readInt64LE(this.buffer, this.offset)
    this.offset += 8
    return v
  }
}

class BNBufferWriter extends BufferWriter {
  writeBigInt64(i) {
    bn64.writeInt64LE(i, this.buffer, this.offset)
    this.offset += 8
  }
}

module.exports = { BNBufferReader: BNBufferReader, BNBufferWriter: BNBufferWriter }

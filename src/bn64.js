const BigNumber = require('bn.js')

var bn64 = {}


const MAX_UINT32 = 0x00000000FFFFFFFF
const BN_MAX_UINT32 = new BigNumber(MAX_UINT32);
const BN_MAX_INT64 = new BigNumber([0xff, 0xff, 0xff, 0xff,  0xff, 0xff, 0xff, 0xff]);
const BN_ZERO = new BigNumber(0);

function onesComplement(number) {
	number = ~number
	if (number < 0) {
		number = (number & 0x7FFFFFFF) + 0x80000000
	}
	return number
}

function uintHighLow(number) {
	console.assert(BigNumber.isBN(number), "number must be a bn.js")
	console.assert(number.gte(BN_ZERO) && number.lte(BN_MAX_INT64), "number out of range")
	var high = 0
	var signbit = number.uand(BN_MAX_UINT32).toNumber()
	var low = signbit < 0 ? number.uand(new BigNumber(0x7FFFFFFF)).uadd(new BigNumber(0x80000000)).toNumber() : signbit
	if (number.gt(BN_MAX_UINT32)) {
		high = number.sub(new BigNumber(low)).div(BN_MAX_UINT32.add(new BigNumber(1))).toNumber();
	}
	return [high, low]
}

function intHighLow(number) {
	if (number.gt(new BigNumber(-1))) {
		return uintHighLow(number)
	}
	var hl = uintHighLow(number.neg())
	var high = onesComplement(hl[0])
	var low = onesComplement(hl[1])
	if (low == MAX_UINT32) {
		high += 1
		low = 0
	}
	else {
		low += 1
	}
	return [high, low]
}

function toBigInt(high, low, signed) {
	if (signed && (high & 0x80000000) !== 0) {
		high = onesComplement(high)
		low = onesComplement(low)
        let result = new BigNumber(high);
        result.imul(BN_MAX_UINT32.add(new BigNumber(1)))
        result.iadd(new BigNumber(low))
        result.iadd(new BigNumber(1))
		return result.neg()   // -((high * (MAX_UINT32 + 1)) + low + 1)
	}
	else { //positive
		//console.assert(high < 0x00200000, "number too large")
        let result = new BigNumber(high);
        result.imul(BN_MAX_UINT32.add(new BigNumber(1)))
        result.iadd(new BigNumber(low))
		return result  //(high * (MAX_UINT32 + 1)) + low
	}
}

bn64.readInt64BE = function (buffer, offset) {
	offset = offset || 0
	var high = buffer.readUInt32BE(offset)
	var low = buffer.readUInt32BE(offset + 4)
	return toBigInt(high, low, true)
}

bn64.readInt64LE = function (buffer, offset) {
	offset = offset || 0
	var low = buffer.readUInt32LE(offset)
	var high = buffer.readUInt32LE(offset + 4)
	return toBigInt(high, low, true)
}

bn64.readUInt64BE = function (buffer, offset) {
	offset = offset || 0
	var high = buffer.readUInt32BE(offset)
	var low = buffer.readUInt32BE(offset + 4)
	return toBigInt(high, low, false)
}

bn64.readUInt64LE = function (buffer, offset) {
	offset = offset || 0
	var low = buffer.readUInt32LE(offset)
	var high = buffer.readUInt32LE(offset + 4)
	return toBigInt(high, low, false)
}

bn64.writeInt64BE = function (number, buffer, offset) {
	offset = offset || 0
	var hl = intHighLow(number)
	buffer.writeUInt32BE(hl[0], offset)
	buffer.writeUInt32BE(hl[1], offset + 4)
}

bn64.writeInt64LE = function (number, buffer, offset) {
	offset = offset || 0
	var hl = intHighLow(number)
	buffer.writeUInt32LE(hl[1], offset)
	buffer.writeUInt32LE(hl[0], offset + 4)
}

bn64.writeUInt64BE = function (number, buffer, offset) {
	offset = offset || 0
	var hl = uintHighLow(number)
	buffer.writeUInt32BE(hl[0], offset)
	buffer.writeUInt32BE(hl[1], offset + 4)
}

bn64.writeUInt64LE = function (number, buffer, offset) {
	offset = offset || 0
	var hl = uintHighLow(number)
	buffer.writeUInt32LE(hl[1], offset)
	buffer.writeUInt32LE(hl[0], offset + 4)
}

module.exports = bn64

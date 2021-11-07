'use strict'

const Debug = require('debug')
const logdebug = Debug('net:nspv')
const logerror = Debug('net:nspv:error');
const varuint = require('varuint-bitcoin');
const bufferutils = require("../src/bufferutils");
const utils = require('../net/utils');
const ccutils = require('../cc/ccutils');

// calc komodo equiheader hash
function kmdHdrHash(hdr)
{
  let buffer = Buffer.allocUnsafe(4 + 
    hdr.prevHash.length + hdr.merkleRoot.length + hdr.hashFinalSaplingRoot.length + 
    4 + 4 + hdr.nonce.length + varuint.encodingLength(hdr.solution.length) + hdr.solution.length);

  let bufferWriter = new bufferutils.BufferWriter(buffer);

  bufferWriter.writeInt32(hdr.version);
  bufferWriter.writeSlice(hdr.prevHash);
  bufferWriter.writeSlice(hdr.merkleRoot);
  bufferWriter.writeSlice(hdr.hashFinalSaplingRoot);
  bufferWriter.writeUInt32(hdr.timestamp);
  bufferWriter.writeUInt32(hdr.bits);
  bufferWriter.writeSlice(hdr.nonce);
  bufferWriter.writeVarSlice(hdr.solution);

  return utils.sha256(utils.sha256(bufferWriter.buffer));
}
exports.kmdHdrHash = kmdHdrHash;

class kmdBlockIndex {
	constructor(_genesis, _height) {
		//this.genesis = _genesis;
		this.headers = [ {hash: ccutils.castHashBin(_genesis), height: _height} ];
    this.tip = this.headers[0];
	}

	add(_header)  {
		let index = this._findPrev(_header);
		if (index < 0) return false;

    let _height = this.headers[index].height + 1;
    this.headers.push({ hash: kmdHdrHash(_header), header: _header, height: _height });
    if (!this.tip || this.tip.height < _height)
      this.tip = this.headers[ this.headers.length-1 ];

    return true;
	}

	_findPrev(header)  {
		return this.headers.findIndex((e) => {
			return Buffer.compare(e.hash, header.prevHash) == 0;
		});
	}

  createLocator()  {
    let loc = [];

    if (this.tip.hash)
      loc.push(this.tip.hash);
    return loc;
  }
}

exports.kmdBlockIndex = kmdBlockIndex;

var kmdBlockIndexInstance = null;
exports.createInstance = function(network) {

    if (!kmdBlockIndexInstance)
      kmdBlockIndexInstance = new kmdBlockIndex("027e3758c3a65b12aa1046462b486d0a63bfa1beae327897f56c5cfb7daaae71", 0);  // tokel
    return kmdBlockIndexInstance;
}
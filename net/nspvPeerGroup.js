'use strict'

//const debug = require('debug')('net:peergroup')
const Debug = require('debug')
const logdebug = Debug('nspv')
const logerror = Debug('nspv:error');


let net
try { net = require('net') } catch (err) {}
const old = require('old')
const PeerGroup = require('./peerGroup')
require('./nspvPeer'); // init peer.js too

const { nspvResp, nspvVersion } = require('./kmdtypes');

class NspvPeerGroup extends PeerGroup {
  constructor (params, opts) {
    super(params, opts)

    this.on('nSPV', (buf) => {
      let resp = nspvResp.decode(buf);
      if (resp === undefined)
        throw new Error('unknown nSPV response received');
      //this.emit(`nSPV:${resp.respCode}.${resp.requestId}`, resp)
      this.emit(`nSPV:${resp.requestId}`, resp)
    })
  }
}

PeerGroup.prototype.nspvConnect = function(cb) {
  this.connect(() => {
    cb();
    // after verack received we must send NSPV_INFO (sort of secondary nspv connect) to check versions
    /*this.nspvGetInfo(0, {}, (err, nspvInfo, peer) => {
      if (nspvInfo && nspvInfo.version === nspvVersion)
        cb(nspvInfo);
      else {
        if (!nspvInfo)
          logerror('could not parse nspv getinfo response');
        if (nspvInfo && nspvInfo.version !== nspvVersion)
          logerror('unsupported remote nspv node version');
        peer.disconnect(new Error('Node disconnected because of invalid response or version'));
        cb();
      }
    }); */
  });
}

PeerGroup.prototype.nspvGetInfo = function(reqHeight, opts, cb) {
  this._request('nspvGetInfo', reqHeight, opts, cb)
}

PeerGroup.prototype.nspvGetUtxos = function(address, isCC, skipCount, filter, opts, cb) {
  this._request('nspvGetUtxos', address, isCC, skipCount, filter, opts, cb)
}

PeerGroup.prototype.nspvGetTxids = function(address, isCC, skipCount, filter, opts, cb) {
  this._request('nspvGetTxids', address, isCC, skipCount, filter, opts, cb)
}

PeerGroup.prototype.nspvRemoteRpc = function(rpcMethod, mypk, params, opts, cb) {
  this._request('nspvRemoteRpc', rpcMethod, mypk, params, opts, cb)
}

PeerGroup.prototype.nspvBroadcast = function(txidhex, txhex, opts, cb) {
  this._request('nspvBroadcast', txidhex, txhex, opts, cb)
}

PeerGroup.prototype.nspvTxProof = function(txidhex, vout, height, opts, cb) {
  this._request('nspvTxProof', txidhex, vout, height, opts, cb)
}

PeerGroup.prototype.nspvNtzs = function(height, opts, cb) {
  this._request('nspvNtzs', height, opts, cb)
}

PeerGroup.prototype.nspvNtzsProof = function(prevTxid, nextTxid, opts, cb) {
  this._request('nspvNtzsProof', prevTxid, nextTxid, opts, cb)
}

module.exports = old(NspvPeerGroup)

'use strict'

//const debug = require('debug')('net:peergroup')

let net
try { net = require('net') } catch (err) {}
const old = require('old')
const PeerGroup = require('./peerGroup')
require('./nspvPeer'); // init peer.js too

const { nspvResp } = require('./kmdtypes');

class NspvPeerGroup extends PeerGroup {
  constructor (params, opts) {
    super(params, opts)

    this.on('nSPV', (buf) => {
      let resp = nspvResp.decode(buf);
      if (resp === undefined)
        throw new Error('unknown nSPV response received');
      this.emit(`nSPV:${resp.respCode}.${resp.requestId}`, resp)
    })
  }
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

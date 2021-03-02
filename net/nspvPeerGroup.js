'use strict'

//const debug = require('debug')('net:peergroup')

let net
try { net = require('net') } catch (err) {}
const old = require('old')
const PeerGroup = require('./peerGroup')

const { nspvResp } = require('./kmdtypes');

class NspvPeerGroup extends PeerGroup {
  constructor (params, opts) {
    super(params, opts)

    this.on('nSPV', (buf) => {
      let resp = nspvResp.decode(buf);
      if (resp === undefined)
        throw new Error('unknown nSPV response received');
      this.emit(`nSPV:${resp.respCode}`, resp)
    })
  }
}

PeerGroup.prototype.nspvGetUtxos = function(address, isCC, opts, cb) {
  this._request('nspvGetUtxos', address, isCC, opts, cb)
}

PeerGroup.prototype.nspvRemoteRpc = function(rpcMethod, mypk, params, opts, cb) {
  this._request('nspvRemoteRpc', rpcMethod, mypk, params, opts, cb)
}

PeerGroup.prototype.nspvBroadcast = function(txidhex, txhex, opts, cb) {
  this._request('nspvBroadcast', txidhex, txhex, opts, cb)
}

module.exports = old(NspvPeerGroup)
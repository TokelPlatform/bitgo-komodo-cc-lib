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
const kmdblockindex = require('../src/kmdblockindex');

const { nspvResp, NSPV_VERSION } = require('./kmdtypes');

class NspvPeerGroup extends PeerGroup {
  constructor (params, opts) {
    super(params, opts)

    this.periodicInterval = 120 * 1000;
    this.periodicTimer = null;
    this.headersSynced = false;


    this.blockIndex = kmdblockindex.createInstance(this.network);

    this.on('peer', (peer) => {

      peer.on('nspvReady', ()=>{
        //this._startDownloadHeaders();
        //this.emit('downloadHeaders');
        //setImmediate(this._downloadHeaders.bind(this));
        if (!this.periodicTimer)
          this.periodicTimer = setInterval(this._periodic.bind(this), this.periodicInterval);
        this.emit('nspvConnect');
      });  // redirect to nspvGroup listener

    })

    /* TODO: why is this needed? 
    this.on('nSPV', (buf) => {
      let resp = nspvResp.decode(buf);
      if (resp === undefined)
        throw new Error('unknown nSPV response received');
      //this.emit(`nSPV:${resp.respCode}.${resp.requestId}`, resp)
      this.emit(`nSPV:${resp.requestId}`, resp)
    })*/

    this.on('PeerGroupClose', () => {
      if (this.periodicTimer) clearInterval(this.periodicTimer);
    });

    //this.on('downloadHeaders', this._downloadHeaders.bind(this));
  }

}

// should add methods to prototype as we want it as old(PeerGroup) 

PeerGroup.prototype._downloadHeaders = function()   {
  if (!this.blockIndex)
    throw(new Error('block index not set'));
  let loc = this.blockIndex.createLocator();
  if (!loc)
    throw(new Error('could not create locator. Block index genesis or tip invalid'));
  this.getHeaders(loc, {}, (error, headers) => {
    if (headers) {
      headers.forEach(e => this.blockIndex.add(e.header));
      logdebug(`got ${headers.length} height is ${this.blockIndex.tip.height} `);
      //this.emit('downloadHeaders');
      setImmediate(this._downloadHeaders.bind(this))
    }
  });
}

PeerGroup.prototype._periodic = function()  {

  if (this.fConnectPlainWeb)  {
    this.getWsAddr({}, ()=>{})                                    // empty opts and cb to pass through _request()
    //this.getAddrTimer = setInterval(this.getWsAddr.bind(this, {}, ()=>{}), this.getAddrInterval)  // set getwsaddr interval 120 sec
  } else {
    this.getAddr({}, ()=>{})                                    // empty opts and cb to pass through _request()
    //this.getAddrTimer = setInterval(this.getAddr.bind(this, {}, ()=>{}), this.getAddrInterval)  // set getaddr interval 120 sec
  }

}


PeerGroup.prototype.nspvConnect = function(cb) {
  this.connect(() => {
    if (cb)
      this.once('nspvConnect', cb);
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

PeerGroup.prototype.nspvNtzsProof = function(ntzTxid, opts, cb) {
  this._request('nspvNtzsProof', ntzTxid, opts, cb)
}

PeerGroup.prototype.nspvGetTransactions = function(checkMempool, txids, opts, cb) {
  this._request('nspvGetTransactions', checkMempool, txids, opts, cb)
}

module.exports = old(NspvPeerGroup)

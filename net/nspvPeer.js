'use strict'

const Debug = require('debug')
const debug = Debug('net:peer')
debug.rx = Debug('net:messages:rx')
debug.tx = Debug('net:messages:tx')
const errorlog = Debug('net:peer:error');

const bufferutils = require("../src/bufferutils");
const Peer = require('./peer')
const { NSPVREQ, NSPVRESP, nspvReq, nspvResp } = require('./kmdtypes');
const { txidFromHex, txidToHex } = require('../cc/ccutils');

Peer.prototype._registerListenersPrev = Peer.prototype._registerListeners;
Peer.prototype._registerListeners = function() {
  this._registerListenersPrev();
  this.on('nSPV', (buf) => {
    let resp = nspvResp.decode(buf);
    this.emit(`nSPV:${resp.respCode}`, resp);
  })
}

// nspv get utxos
Peer.prototype.nspvGetUtxos = function(address, isCC, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  if (opts.timeout == null) opts.timeout = this._getTimeout()

  var timeout
  var onNspvResp = (resp) => {
    if (timeout) clearTimeout(timeout)
    cb(null, resp)
    //this._nextHeadersRequest()  // TODO: do we also need call to next?
  }
  this.once(`nSPV:${NSPVRESP.NSPV_UTXOSRESP}`, onNspvResp)

  let nspvReqUtxos = {
    reqCode: NSPVREQ.NSPV_UTXOS,
    coinaddr: address,
    CCflag: isCC ? 1 : 0,
    skipcount: 0,
    filter: 0
  }
  let buf = nspvReq.encode(nspvReqUtxos)
  this.send('getnSPV', buf)

  if (!opts.timeout) return
  timeout = setTimeout(() => {
    errorlog(`getnSPV NSPV_UTXOSRESP timed out: ${opts.timeout} ms`)
    var error = new Error('Request timed out')
    error.timeout = true
    cb(error)
  }, opts.timeout)
}

// call nspv remote rpc
Peer.prototype.nspvRemoteRpc = function(rpcMethod, _mypk, _params, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  if (opts.timeout == null) opts.timeout = this._getTimeout()

  let mypk;
  if (Buffer.isBuffer(_mypk))
    mypk = _mypk.toString('hex');
  else
    mypk = _mypk;

  let params;
  if (Array.isArray(_params))  
    params = JSON.stringify(_params);
  else
    params = '["' + _params.toString() + '"]';
  let jsonRequest = `{
    "method": "${rpcMethod}",
    "mypk": "${mypk}",
    "params": ${params}
  }`;

  var timeout
  var onNspvResp = (resp) => {
    if (timeout) clearTimeout(timeout)
    if (!resp || !resp.jsonSer) {
      cb(new Error("could not parse nspv remote rpc response"));
      return;
    }

    //let resStr = resp.jsonSer.toString();
    let result = JSON.parse(resp.jsonSer.toString());
    if (result.error) {
      if (typeof result.result === 'string')
        cb(new Error(result.error));
      else if (result.error.message)
        cb(new Error(result.error.message));
      else if (result.error.code)
        cb(new Error(result.error.code));
      else
        cb(new Error('nspv error (could not parse)'));
      return;
    }

    if (result.result !== undefined && result.result.error) {
      cb(new Error(`nspv remote error: ${result.result.error}`));
      return;
    }

    if (!resp.method) {
      cb(new Error('null nspv response method'));
      return;
    }
    let respMethod = resp.method.toString('ascii', 0, resp.method.indexOf(0x00) >= 0 ? resp.method.indexOf(0x00) : resp.method.length); // cut off ending nulls
    if (rpcMethod !== respMethod)  {
      cb(new Error('invalid nspv response method'));
      return;
    }
    cb(null, result.result); //yes result inside result
    //this._nextHeadersRequest()  // TODO: do we also need call to next?
  }
  this.once(`nSPV:${NSPVRESP.NSPV_REMOTERPCRESP}`, onNspvResp)

  let jsonSer = Buffer.from(jsonRequest);
  let nspvRemoteRpcReq = {
    reqCode: NSPVREQ.NSPV_REMOTERPC,
    length: jsonSer.length,
    jsonSer: jsonSer
  }
  let buf = nspvReq.encode(nspvRemoteRpcReq)
  this.send('getnSPV', buf)

  if (!opts.timeout) return
  timeout = setTimeout(() => {
    errorlog(`getnSPV NSPV_REMOTERPC ${rpcMethod} timed out: ${opts.timeout} ms`)
    var error = new Error('Request timed out')
    error.timeout = true
    cb(error)
  }, opts.timeout)
}

// nspv broadcast
Peer.prototype.nspvBroadcast = function(txidhex, txhex, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  if (opts.timeout == null) opts.timeout = this._getTimeout()

  if (typeof txidhex !== 'string' || txidhex.length != 64) {
    cb(new Error('txid hex should be a string of 64'));
    return;
  }

  if (typeof txhex !== 'string') {
    cb(new Error('txhex not a string'));
    return;
  }

  var timeout
  var onNspvResp = (resp) => {
    if (timeout) clearTimeout(timeout)
    if (!resp || !resp.txid || !resp.retcode) {
      cb(new Error("could not parse nspv broadcast response"));
      return;
    }
    cb(null, { retcode: resp.retcode, txid: txidToHex(resp.txid) }); 
  }
  this.once(`nSPV:${NSPVRESP.NSPV_BROADCASTRESP}`, onNspvResp)

  let nspvBroadcastReq = {
    reqCode: NSPVREQ.NSPV_BROADCAST,
    txid: txidFromHex(txidhex),
    txdata: Buffer.from(txhex, 'hex')  
  }
  let buf = nspvReq.encode(nspvBroadcastReq)
  this.send('getnSPV', buf)

  if (!opts.timeout) return
  timeout = setTimeout(() => {
    errorlog(`getnSPV NSPV_BROADCAST timed out: ${opts.timeout} ms`)
    var error = new Error('Request timed out')
    error.timeout = true
    cb(error)
  }, opts.timeout)
}

// nspv broadcast
Peer.prototype.nspvTxproof = function(txidhex, vout, height, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  if (!opts.timeout) opts.timeout = this._getTimeout()

  if (typeof txidhex !== 'string' || txidhex.length != 64) {
    cb(new Error('txid hex should be a string of 64'));
    return;
  }

  if (typeof vout !== 'number') {
    cb(new Error('vout not a number'));
    return;
  }

  if (typeof height !== 'number') {
    cb(new Error('vout not a number'));
    return;
  }

  var timeout
  var onNspvResp = (resp) => {
    if (timeout) clearTimeout(timeout)
    if (!resp || !resp.respCode || typeof resp.txid === undefined || typeof resp.unspentValue === undefined || typeof resp.vout === undefined || typeof resp.height === undefined || typeof resp.tx === undefined || typeof resp.txproof === undefined) { // check all props?
      cb(new Error("could not parse nspv txproof response"));
      return;
    }
    cb(null, { retcode: resp.retcode, txid: txidToHex(resp.txid), unspentValue:  resp.unspentValue, height: resp.height, vout: resp.vout, txbin: resp.txbin, txproof: resp.txproof }); 
  }
  this.once(`nSPV:${NSPVRESP.NSPV_TXPROOFRESP}`, onNspvResp)

  let nspvTxproofReq = {
    reqCode: NSPVREQ.NSPV_TXPROOF,
    txid: txidFromHex(txidhex),
    vout: vout,
    height: height,
  }
  let buf = nspvReq.encode(nspvTxproofReq)
  this.send('getnSPV', buf)

  if (!opts.timeout) return
  timeout = setTimeout(() => {
    errorlog(`getnSPV NSPV_TXPROOF timed out: ${opts.timeout} ms`)
    var error = new Error('Request timed out')
    error.timeout = true
    cb(error)
  }, opts.timeout)
}




'use strict'

const Debug = require('debug')
const logdebug = Debug('nspv')
const logerror = Debug('nspv:error');

const bufferutils = require("../src/bufferutils");
const Peer = require('./peer')
const { NSPVMSGS, nspvVersion, nspvReq, nspvResp } = require('./kmdtypes');
const { txidFromHex, txidToHex, isValidTxid, castTxid } = require('../cc/ccutils');

Peer.prototype._registerListenersPrev = Peer.prototype._registerListeners;
Peer.prototype._registerListeners = function() {
  this._registerListenersPrev();

  this.on('verack', () => {
    console.log('on verack')
    // after verack received we must send NSPV_INFO (sort of secondary nspv connect) to check versions
    this.nspvGetInfo(0, {}, (err, nspvInfo, peer) => {
      if (nspvInfo && nspvInfo.version === nspvVersion)  {
        //cb(nspvInfo);
        this.gotNspvInfo = true;
        this._nspvReady();
      } else {
        if (!nspvInfo)
          logerror('could not parse nspv getinfo response', err);
        if (nspvInfo && nspvInfo.version !== nspvVersion)
          logerror('unsupported remote nspv node version', err);
        peer.disconnect(new Error('Node disconnected because of invalid response or version '));
        //cb();
      }
    });
  })

  this.on('nSPV', (buf) => {
    let resp = nspvResp.decode(buf);
    //this.emit(`nSPV:${resp.respCode}.${resp.requestId}`, resp);
    this.emit(`nSPV:${resp.requestId}`, resp);
  })
}


Peer.prototype._nspvReady = function() {
  if (!this.verack || !this.version || !this.gotNspvInfo) return
  this.ready = true
  this.emit('ready')
}
var requestId = 0;
function incRequestId() {
  requestId ++;
  if (requestId == 0xFFFFFFFF)
    requestId = 1;
}

Peer.prototype.gotNspvInfo = false;

// get nspv info 
Peer.prototype.nspvGetInfo = function(reqHeight, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  if (!opts.timeout) opts.timeout = this._getTimeout()

  var timeout
  var onNspvResp = (resp) => {
    if (timeout) clearTimeout(timeout)
    if (resp && resp.respCode === NSPVMSGS.NSPV_ERRORRESP) 
      cb(new Error("nspv remote error: " + resp.errDesc));
    if (!resp || !resp.version || typeof resp.notarisation === undefined) { 
      cb(new Error("could not parse nspv getinfo response"));
      return;
    }
    cb(null, resp); 
  }
  incRequestId();
  //this.once(`nSPV:${NSPVMSGS.NSPV_INFO}.${requestId}`, onNspvResp)
  this.once(`nSPV:${requestId}`, onNspvResp)

  let nspvInfoReq = {
    reqCode: NSPVMSGS.NSPV_INFO,
    requestId: requestId,
    version: nspvVersion,
    reqHeight: reqHeight,
  }
  let buf = nspvReq.encode(nspvInfoReq)
  this.send('getnSPV', buf)

  if (!opts.timeout) return
  timeout = setTimeout(() => {
    logerror(`getnSPV NSPV_INFO timed out: ${opts.timeout} ms`)
    var error = new Error('NSPV request timed out')
    error.timeout = true
    cb(error)
  }, opts.timeout)
}

// nspv get utxos
Peer.prototype.nspvGetUtxos = function(address, isCC, skipCount, filter, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  if (opts.timeout == null) opts.timeout = this._getTimeout()

  var timeout
  var onNspvResp = (resp) => {
    if (timeout) clearTimeout(timeout)
    if (resp && resp.respCode === NSPVMSGS.NSPV_ERRORRESP) 
      cb(new Error("nspv remote error: " + resp.errDesc)); 
    cb(null, resp)
  }
  incRequestId();
  //this.once(`nSPV:${NSPVMSGS.NSPV_UTXOSRESP}.${requestId}`, onNspvResp)
  this.once(`nSPV:${requestId}`, onNspvResp)

  let nspvReqUtxos = {
    reqCode: NSPVMSGS.NSPV_UTXOS,
    requestId: requestId,
    coinaddr: address,
    CCflag: isCC ? 1 : 0,
    skipcount: skipCount,
    filter: filter
  }
  let buf = nspvReq.encode(nspvReqUtxos)
  this.send('getnSPV', buf)

  if (!opts.timeout) return
  timeout = setTimeout(() => {
    logerror(`getnSPV NSPV_UTXOSRESP timed out: ${opts.timeout} ms`)
    var error = new Error('NSPV request timed out')
    error.timeout = true
    cb(error)
  }, opts.timeout)
}

// nspv get txids
Peer.prototype.nspvGetTxids = function(address, isCC, skipCount, filter, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  if (opts.timeout == null) opts.timeout = this._getTimeout()

  var timeout
  var onNspvResp = (resp) => {
    if (timeout) clearTimeout(timeout)
    if (resp && resp.respCode === NSPVMSGS.NSPV_ERRORRESP) 
      cb(new Error("nspv remote error: " + resp.errDesc)); 
    cb(null, resp)
  }
  incRequestId();
  //this.once(`nSPV:${NSPVMSGS.NSPV_TXIDSRESP}.${requestId}`, onNspvResp)
  this.once(`nSPV:${requestId}`, onNspvResp)

  let nspvReqTxids = {
    reqCode: NSPVMSGS.NSPV_TXIDS,
    requestId: requestId,
    coinaddr: address,
    CCflag: isCC ? 1 : 0,
    skipcount: skipCount,
    filter: filter
  }
  let buf = nspvReq.encode(nspvReqTxids)
  this.send('getnSPV', buf)

  if (!opts.timeout) return
  timeout = setTimeout(() => {
    logerror(`getnSPV NSPV_TXIDSRESP timed out: ${opts.timeout} ms`)
    var error = new Error('NSPV request timed out')
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
    params =  _params !== undefined ? '["' + _params.toString() + '"]'  : '[]';
  let jsonRequest = `{
    "method": "${rpcMethod}",
    "mypk": "${mypk}",
    "params": ${params}
  }`;

  var timeout
  var onNspvResp = (resp) => {
    if (timeout) clearTimeout(timeout)
    if (resp && resp.respCode === NSPVMSGS.NSPV_ERRORRESP) 
      cb(new Error("nspv remote error: " + resp.errDesc)); 
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
  incRequestId();
  //this.once(`nSPV:${NSPVMSGS.NSPV_REMOTERPCRESP}.${requestId}`, onNspvResp)
  this.once(`nSPV:${requestId}`, onNspvResp)

  let jsonSer = Buffer.from(jsonRequest);
  let nspvRemoteRpcReq = {
    reqCode: NSPVMSGS.NSPV_REMOTERPC,
    requestId: requestId,
    length: jsonSer.length,
    jsonSer: jsonSer
  }
  let buf = nspvReq.encode(nspvRemoteRpcReq)
  this.send('getnSPV', buf)

  if (!opts.timeout) return
  timeout = setTimeout(() => {
    logerror(`getnSPV NSPV_REMOTERPC ${rpcMethod} timed out: ${opts.timeout} ms`)
    var error = new Error('NSPV request timed out')
    error.timeout = true
    cb(error)
  }, opts.timeout)
}

// nspv broadcast
Peer.prototype.nspvBroadcast = function(_txid, txhex, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  if (opts.timeout == null) opts.timeout = this._getTimeout()

  let txid = castTxid(_txid);
  if (!txid) {
    cb(new Error('txid param invalid'));
    return;
  }

  if (typeof txhex !== 'string') {
    cb(new Error('txhex not a string'));
    return;
  }

  var timeout
  var onNspvResp = (resp) => {
    if (timeout) clearTimeout(timeout)
    if (resp && resp.respCode === NSPVMSGS.NSPV_ERRORRESP) 
      cb(new Error("nspv remote error: " + resp.errDesc));
    if (!resp || !resp.txid || !resp.retcode) {
      cb(new Error("could not parse nspv broadcast response"));
      return;
    }
    cb(null, { retcode: resp.retcode, txid: txidToHex(resp.txid) }); 
  }
  incRequestId();
  //this.once(`nSPV:${NSPVMSGS.NSPV_BROADCASTRESP}.${requestId}`, onNspvResp)
  this.once(`nSPV:${requestId}`, onNspvResp)

  let nspvBroadcastReq = {
    reqCode: NSPVMSGS.NSPV_BROADCAST,
    requestId: requestId,
    txid: txid,
    txdata: Buffer.from(txhex, 'hex')  
  }
  let buf = nspvReq.encode(nspvBroadcastReq)
  this.send('getnSPV', buf)

  if (!opts.timeout) return
  timeout = setTimeout(() => {
    logerror(`getnSPV NSPV_BROADCAST timed out: ${opts.timeout} ms`)
    var error = new Error('NSPV request timed out')
    error.timeout = true
    cb(error)
  }, opts.timeout)
}

// nspv tx proof
Peer.prototype.nspvTxProof = function(_txid, vout, height, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  if (!opts.timeout) opts.timeout = this._getTimeout()

  let txid = castTxid(_txid)
  if (!txid) {
    cb(new Error('txid param invalid'));
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
    if (resp && resp.respCode === NSPVMSGS.NSPV_ERRORRESP) 
      cb(new Error("nspv remote error: " + resp.errDesc));
    if (!resp || !resp.respCode || typeof resp.txid === undefined || typeof resp.unspentValue === undefined || typeof resp.vout === undefined || typeof resp.height === undefined || typeof resp.tx === undefined || typeof resp.txproof === undefined) { // check all props?
      cb(new Error("could not parse nspv txproof response"));
      return;
    }
    //cb(null, { retcode: resp.retcode, txid: txidToHex(resp.txid), unspentValue:  resp.unspentValue, height: resp.height, vout: resp.vout, txbin: resp.txbin, txproof: resp.txproof }); 
    cb(null, resp); 
  }
  incRequestId();
  //this.once(`nSPV:${NSPVMSGS.NSPV_TXPROOFRESP}.${requestId}`, onNspvResp)
  this.once(`nSPV:${requestId}`, onNspvResp)

  let nspvTxProofReq = {
    reqCode: NSPVMSGS.NSPV_TXPROOF,
    requestId: requestId,
    txid: txid,
    vout: vout,
    height: height,
  }
  let buf = nspvReq.encode(nspvTxProofReq)
  this.send('getnSPV', buf)

  if (!opts.timeout) return
  timeout = setTimeout(() => {
    logerror(`getnSPV NSPV_TXPROOF timed out: ${opts.timeout} ms`)
    var error = new Error('NSPV request timed out')
    error.timeout = true
    cb(error)
  }, opts.timeout)
}

// get ntz txids and opreturn data
Peer.prototype.nspvNtzs = function(height, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  if (!opts.timeout) opts.timeout = this._getTimeout()

  if (typeof height !== 'number') {
    cb(new Error('height not a number'));
    return;
  }

  var timeout
  var onNspvResp = (resp) => {
    if (timeout) clearTimeout(timeout)
    if (resp && resp.respCode === NSPVMSGS.NSPV_ERRORRESP) 
      cb(new Error("nspv ntzs remote error: " + resp.errDesc));
    if (!resp || !resp.respCode || typeof resp.prevntz === undefined || typeof resp.nextntz === undefined || typeof resp.reqHeight === undefined ) { // check parsed props
      cb(new Error("could not parse nspv ntzs response"));
      return;
    }
    cb(null, resp); 
  }
  incRequestId();
  //this.once(`nSPV:${NSPVMSGS.NSPV_NTZSRESP}.${requestId}`, onNspvResp)
  this.once(`nSPV:${requestId}`, onNspvResp)

  let nspvNtzsReq = {
    reqCode: NSPVMSGS.NSPV_NTZS,
    requestId: requestId,
    height: height,
  }
  let buf = nspvReq.encode(nspvNtzsReq)
  this.send('getnSPV', buf)

  if (!opts.timeout) return
  timeout = setTimeout(() => {
    logerror(`getnSPV NSPV_NTZS timed out: ${opts.timeout} ms`)
    var error = new Error('NSPV request timed out')
    error.timeout = true
    cb(error)
  }, opts.timeout)
}

// get ntz txns
Peer.prototype.nspvNtzsProof = function(_prevTxid, _nextTxid, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  if (!opts.timeout) opts.timeout = this._getTimeout()

  let prevTxid = castTxid(_prevTxid);
  let nextTxid = castTxid(_nextTxid);

  if (!prevTxid) {
    cb(new Error('prevTxid param invalid'));
    return;
  }
  if (!nextTxid) {
    cb(new Error('nextTxid param invalid'));
    return;
  }

  var timeout
  var onNspvResp = (resp) => {
    if (timeout) clearTimeout(timeout)
    if (resp && resp.respCode === NSPVMSGS.NSPV_ERRORRESP) 
      cb(new Error("nspv ntzs proof remote error: " + resp.errDesc));
    if (!resp || !resp.respCode || typeof resp.common === undefined || typeof resp.prevtxid === undefined || typeof resp.nexttxid === undefined || typeof resp.prevntz === undefined || typeof resp.nextntz === undefined ) { // check all props
      cb(new Error("could not parse nspv ntzs proof response"));
      return;
    }
    cb(null, resp); 
  }
  incRequestId();
  //this.once(`nSPV:${NSPVMSGS.NSPV_NTZSPROOFRESP}.${requestId}`, onNspvResp)
  this.once(`nSPV:${requestId}`, onNspvResp)

  let nspvNtzsProofReq = {
    reqCode: NSPVMSGS.NSPV_NTZSPROOF,
    requestId: requestId,
    prevTxid: prevTxid,
    nextTxid: nextTxid,
  }
  let buf = nspvReq.encode(nspvNtzsProofReq)
  this.send('getnSPV', buf)

  if (!opts.timeout) return
  timeout = setTimeout(() => {
    logerror(`getnSPV NSPV_NTZSPROOF timed out: ${opts.timeout} ms`)
    var error = new Error('NSPV request timed out')
    error.timeout = true
    cb(error)
  }, opts.timeout)
}
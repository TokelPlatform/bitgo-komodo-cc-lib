/**
 * Based on: Bitcoin P2P networking that works in Node and the browser (https://www.npmjs.com/package/bitcoin-net)                                                                       
 */

'use strict'

const crypto = require('crypto')
const Debug = require('debug')
const logdebug = Debug('net:peer')
const logerror = Debug('net:peer:error');
logdebug.rx = Debug('net:messages:rx')
logdebug.tx = Debug('net:messages:tx')
const proto = require('bitcoin-protocol')
const INV = proto.constants.inventory
const u = require('bitcoin-util')
const wrapEvents = require('event-cleanup')
const through = require('through2').obj
const EventEmitter = require('events')
const pkg = require('../package.json')
const utils = require('./utils.js')
const ws = require('ws')


const SERVICES_SPV = Buffer.from('0800000000000000', 'hex')
const SERVICES_FULL = Buffer.from('0100000000000000', 'hex')
const BLOOMSERVICE_VERSION = 70011

const LATENCY_EXP = 0.5 // coefficient used for latency exponential average
const INITIAL_PING_N = 4 // send this many pings when we first connect
const INITIAL_PING_INTERVAL = 250 // wait this many ms between initial pings
const MIN_TIMEOUT = 4000 // lower bound for timeouts (in case latency is low)

const serviceBits = {
  'NODE_NETWORK': 0,
  'NODE_GETUTXO': 1,
  'NODE_BLOOM': 2,
  'NODE_WITNESS': 3,
  'NODE_NETWORK_LIMITED': 10
}
function getServices (buf) {
  let services = {}
  for (let name in serviceBits) {
    let byteIndex = Math.floor(serviceBits[name] / 8)
    let byte = buf.readUInt32LE(byteIndex)
    let bitIndex = serviceBits[name] % 8
    if (byte & (1 << bitIndex)) {
      services[name] = true
    }
  }
  return services
}

const debugStream = (f) => through((message, enc, cb) => {
  f(message)
  cb(null, message)
})

module.exports =
class Peer extends EventEmitter {
  constructor (params, opts = {}) {
    utils.assertParams(params)

    super()

    this.params = params
    this.protocolVersion = params.network.protocolVersion || 70012
    this.minimumVersion = params.minimumVersion || 70001
    this.requireBloom = opts.requireBloom && true
    this.userAgent = opts.userAgent
    if (!opts.userAgent) {
      if (process.browser) this.userAgent = `/${navigator.userAgent}/`
      else this.userAgent = `/node.js:${process.versions.node}/`
      this.userAgent += `${pkg.name}:${pkg.version}/`
    }
    if (opts.subUserAgent) this.userAgent += opts.subUserAgent
    this.handshakeTimeout = opts.handshakeTimeout || 8 * 1000
    this.getTip = opts.getTip
    this.relay = opts.relay || false
    this.pingInterval = opts.pingInterval || 15 * 1000
    this.version = null
    this.services = null
    this.socket = null
    this.ready = false
    this._handshakeTimer = null
    this.disconnected = false
    this.latency = 2 * 1000 // default to 2s

    this.getHeadersQueue = []
    this.gettingHeaders = false

    this.setMaxListeners(200)

    if (opts.socket) this.connect(opts.socket)
  }

  _formatCommand(command, payload) {
    return "'"+command+"'";
  }

  send (command, payload) {
    // TODO?: maybe this should error if we try to write after close?
    if (!this.socket.writable) return
    this._encoder.write({ command, payload })
    logdebug("sent cmd", this._formatCommand(command, payload), "to url", this.getUrl())
  }

  connect (socket) {
    if (!socket || !socket.readable || !socket.writable) {
      throw new Error('Must specify socket duplex stream')
    }
    this.socket = socket
    socket.once('close', () => {
      this.disconnect(new Error('Socket closed'))
    })
    socket.on('error', this._error.bind(this))

    var protocolOpts = {
      magic: this.params.network.magic,
      messages: this.params.network.messages
    }

    var decoder = proto.createDecodeStream(protocolOpts)
    decoder.on('error', this._error.bind(this))
    this._decoder = debugStream(logdebug.rx)
    socket.pipe(decoder).pipe(this._decoder)

    this._encoder = debugStream(logdebug.tx)
    let encoder = proto.createEncodeStream(protocolOpts)
    this._encoder.pipe(encoder).pipe(socket)

    // timeout if handshake doesn't finish fast enough
    if (this.handshakeTimeout) {
      this._handshakeTimer = setTimeout(() => {
        this._handshakeTimer = null
        this._error(new Error(`Peer handshake timed out ${this.getUrl()}`))
      }, this.handshakeTimeout)
      this.once('ready', () => {
        this.clearTimers()
      })
    }

    logdebug(`connecting from localaddr: ${socket.localAddress}:${socket.localPort}`)

    // set up ping interval and initial pings
    this.once('ready', () => {
      this._pingInterval = setInterval(this.ping.bind(this), this.pingInterval)  // ping after pingInterval
      //for (var i = 0; i < INITIAL_PING_N; i++) {
      //  setTimeout(this.ping.bind(this), INITIAL_PING_INTERVAL * i)  // TODO: decide if we need extra pings
      //}
    })

    this._registerListeners()
    this._sendVersion()
  }

  disconnect (err) {
    if (this.disconnected) return
    this.disconnected = true
    this.clearTimers()
    if (this._pingInterval) clearInterval(this._pingInterval)
    this._pingInterval = null
    this.socket.end()
    this.emit('disconnect', err)
  }

  clearTimers() {
    if (this._handshakeTimer) clearTimeout(this._handshakeTimer)
    this._handshakeTimer = null
  }

  ping (cb) {
    var start = Date.now()
    var nonce = crypto.pseudoRandomBytes(8)
    var onPong = (pong) => {
      if (pong.nonce.compare(nonce) !== 0) return
      this.removeListener('pong', onPong)
      var elapsed = Date.now() - start
      this.latency = this.latency * LATENCY_EXP + elapsed * (1 - LATENCY_EXP)
      if (cb) cb(null, elapsed, this.latency)
    }
    this.on('pong', onPong)
    this.send('ping', { nonce })
  }

  _error (err) {
    this.emit('error', err)
    this.disconnect(err)
  }

  _registerListeners () {
    this._decoder.on('error', this._error.bind(this))
    this._decoder.on('data', (message) => {
      logdebug("received cmd", this._formatCommand(message.command, message.payload), "from url", this.getUrl())
      this.emit('message', message)                     // forward received messages to PeerGroup.OnMessage()
      this.emit(message.command, message.payload)       // forward messages to Peer processors
    })

    this._encoder.on('error', this._error.bind(this))

    // specific message processors:

    this.on('version', this._onVersion)
    this.on('verack', () => {
      if (this.ready) return this._error(new Error('Got duplicate verack'))
      this.verack = true
      //this._maybeReady() // see nspvPeer
    })

    this.on('ping', (message) => this.send('pong', message))

    this.on('block', (block) => {
      this.emit(`block:${utils.getBlockHash(block.header).toString('base64')}`, block)
    })
    this.on('merkleblock', (block) => {
      this.emit(`merkleblock:${utils.getBlockHash(block.header).toString('base64')}`, block)
    })
    this.on('tx', (tx) => {
      this.emit(`tx:${utils.getTxHash(tx).toString('base64')}`, tx)
    })

    //this.on('addr', this._onAddr)
  }

/*  _onAddr(message) {
    console.log('addr message=', message);
  } */

  _onVersion (message) {
    this.services = getServices(message.services)
    if (!this.services.NODE_NETWORK) {
      return this._error(new Error('Node does not provide NODE_NETWORK service'))
    }
    this.version = message
    if (message.version < this.minimumVersion) {
      return this._error(new Error('Peer is using an incompatible protocol version: ' +
        `required: >= ${this.minimumVersion}, actual: ${message.version}`))
    }
    if (this.requireBloom &&
    message.version >= BLOOMSERVICE_VERSION &&
    !this.services.NODE_BLOOM) {
      return this._error(new Error('Node does not provide NODE_BLOOM service'))
    }
    this.send('verack')
    // this._maybeReady()  // see nspvPeer
  }

  _maybeReady () {
    if (!this.verack || !this.version) return
    this.ready = true
    this.emit('ready')
  }

  /* not used
  _onceReady (cb) {
    if (this.ready) return cb()
    this.once('ready', cb)
  } */

  _sendVersion () {
    this.send('version', {
      version: this.protocolVersion,
      services: SERVICES_SPV,
      timestamp: Math.round(Date.now() / 1000),
      receiverAddress: {
        services: SERVICES_FULL,
        address: this.socket.remoteAddress || '0.0.0.0',
        port: this.socket.remotePort || 0
      },
      senderAddress: {
        services: SERVICES_SPV,
        address: '0.0.0.0',
        port: this.socket.localPort || 0
      },
      nonce: crypto.pseudoRandomBytes(8),
      userAgent: this.userAgent,
      startHeight: this.getTip ? this.getTip().height : 0,
      relay: this.relay
    })
  }

  getAddr () {
    this.send('getaddr', {})
  }

  getWsAddr () {
    this.send('getwsaddr', {})
  }

  _getTimeout () {
    return MIN_TIMEOUT + this.latency * 10
  }

  getBlocks (hashes, opts, cb) {
    if (typeof opts === 'function') {
      cb = opts
      opts = {}
    }
    if (opts.timeout == null) opts.timeout = this._getTimeout()

    var timeout
    var events = wrapEvents(this)
    var output = new Array(hashes.length)
    var remaining = hashes.length
    hashes.forEach((hash, i) => {
      var event = `${opts.filtered ? 'merkle' : ''}block:${hash.toString('base64')}`
      events.once(event, (block) => {
        output[i] = block
        remaining--
        if (remaining > 0) return
        if (timeout != null) clearTimeout(timeout)
        cb(null, output)
      })
    })

    var inventory = hashes.map((hash) => ({
      type: opts.filtered ? INV.MSG_FILTERED_BLOCK : INV.MSG_BLOCK,
      hash
    }))
    this.send('getdata', inventory)

    if (!opts.timeout) return
    timeout = setTimeout(() => {
      logerror(`getBlocks timed out: ${opts.timeout} ms, remaining: ${remaining}/${hashes.length}`)
      events.removeAll()
      var error = new Error('Request timed out')
      error.timeout = true
      cb(error)
    }, opts.timeout)
  }

  // get transactions via the standard p2p 'getdata' message, 
  // it would return transaction from the block passed or from relay queue or mempool
  getTransactions (blockHash, txids, opts, cb) {
    if (Array.isArray(blockHash)) {
      cb = opts
      opts = txids
      txids = blockHash
      blockHash = null
    }
    if (typeof opts === 'function') {
      cb = opts
      opts = {}
    }

    var output = new Array(txids.length)

    if (blockHash) {
      var txIndex = {}
      txids.forEach((txid, i) => { txIndex[txid.toString('base64')] = i })
      this.getBlocks([ blockHash ], opts, (err, blocks) => {
        if (err) return cb(err)
        for (var tx of blocks[0].transactions) {
          var id = utils.getTxHash(tx).toString('base64')
          var i = txIndex[id]
          if (i == null) continue
          delete txIndex[id]
          output[i] = tx
        }
        cb(null, output)
      })
    } else {
      if (opts.timeout == null) opts.timeout = this._getTimeout()
      // TODO: make a function for all these similar timeout request methods

      var timeout
      var remaining = txids.length
      var events = wrapEvents(this)
      txids.forEach((txid, i) => {
        var hash = txid.toString('base64')
        this.once(`tx:${hash}`, (tx) => {
          output[i] = tx
          remaining--
          if (remaining > 0) return
          if (timeout != null) clearTimeout(timeout)
          cb(null, output)
        })
      })

      var inventory = txids.map((hash) => ({ type: INV.MSG_TX, hash }))
      this.send('getdata', inventory)

      if (!opts.timeout) return
      timeout = setTimeout(() => {
        logerror(`getTransactions timed out: ${opts.timeout} ms, remaining: ${remaining}/${txids.length}`)
        events.removeAll()
        var err = new Error('Request timed out')
        err.timeout = true
        cb(err)
      }, opts.timeout)
    }
  }

  getHeaders (locator, opts, cb) {
    if (this.gettingHeaders) {
      this.getHeadersQueue.push({ locator, opts, cb })
      logdebug(`queued "getHeaders" request: queue size=${this.getHeadersQueue.length}`)
      return
    }
    this.gettingHeaders = true

    if (typeof opts === 'function') {
      cb = opts
      opts = {}
    } else if (typeof locator === 'function') {
      cb = locator
      opts = {}
      locator = []
    }

    opts.stop = opts.stop || u.nullHash
    opts.timeout = opts.timeout != null ? opts.timeout : this._getTimeout()
    var timeout
    var onHeaders = (headers) => {
      if (timeout) clearTimeout(timeout)
      cb(null, headers)
      this._nextHeadersRequest()
    }
    this.once('headers', onHeaders)
    this.send('getheaders', {
      version: this.protocolVersion,
      locator,
      hashStop: opts.stop
    })
    if (!opts.timeout) return
    timeout = setTimeout(() => {
      logerror(`getHeaders timed out: ${opts.timeout} ms`)
      this.removeListener('headers', onHeaders)
      var error = new Error('Request timed out')
      error.timeout = true
      cb(error)
      this._nextHeadersRequest()
    }, opts.timeout)
  }

  _nextHeadersRequest () {
    this.gettingHeaders = false
    if (this.getHeadersQueue.length === 0) return
    var req = this.getHeadersQueue.shift()
    this.getHeaders(req.locator, req.opts, req.cb)
  }

  _isWebSocketPeer()
  {
    return this?.socket?.socket instanceof ws;
  }

  
  getUrl()
  {
    let remotep = '';
    if (this._isWebSocketPeer())
      return this.socket.socket.url;
    else if (this.socket) {
      if (this.socket.remoteAddress)
          remotep += this.socket.remoteAddress
      if (this.socket.remotePort)
          remotep += ':' + this.socket.remotePort
    }
    return remotep
  }
  
}

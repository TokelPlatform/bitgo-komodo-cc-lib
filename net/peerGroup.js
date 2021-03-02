'use strict'

const debug = require('debug')('net:peergroup')
const dns = require('dns')
const EventEmitter = require('events')
let net
try { net = require('net') } catch (err) {}
const wsstream = require('websocket-stream')
const ws = require('ws')
const http = require('http')
//const Exchange = require('peer-exchange')
const getBrowserRTC = require('get-browser-rtc')
const once = require('once')
const assign = require('object-assign')
const old = require('old')
const Peer = require('./peer.js')
const utils = require('./utils.js')
const { time } = require('console')
require('setimmediate')

const ADDRSTATE = {
  FREE: 0,
//  FAILED: -1,
  INUSE: 1
};

// pxp not supported
//const DEFAULT_PXP_PORT = 8192 // default port for peer-exchange nodes

class PeerGroup extends EventEmitter {
  constructor (params, opts) {
    utils.assertParams(params)
    super()
    this._params = params
    opts = opts || {}
    this._numPeers = opts.numPeers || 10
    this.peers = []
    this._hardLimit = opts.hardLimit || false
    this.websocketPort = null
    this._connectWeb = opts.connectWeb != null
      ? opts.connectWeb : process.browser
    this.connectTimeout = opts.connectTimeout != null
      ? opts.connectTimeout : 8 * 1000
    this.peerOpts = opts.peerOpts != null
      ? opts.peerOpts : {}
    this.acceptIncoming = opts.acceptIncoming
    let acceptIncoming = this.acceptIncoming
    this.connecting = false
    this.closed = false
    this.accepting = false
    this.fConnectPlainWeb = opts.connectPlainWeb ? opts.connectPlainWeb : false
    this.retryInterval = 10000

    if (this._connectWeb || this.fConnectPlainWeb) {
      let wrtc = opts.wrtc || getBrowserRTC()
      let envSeeds = process.env.WEB_SEED
        ? process.env.WEB_SEED.split(',').map((s) => s.trim()) : []

      // maintain addresses state:
      // last successful connect time
      // unsuccessful retries count
      // if lastConnectTime == 0 (never connected) && retries count > 10 then this address is not used (to prevent spam addresses overusing)
      // after 3h retry count is cleared and the address is again available
      // when addresses are selected it first checked that lastConnectTime != 0 but it is least recently connected
      this._webAddrs = [];
      this._params.webSeeds.concat(envSeeds).forEach( (elem)=>{ 
        this._webAddrs.push({ wsaddr: elem, lastConnectTime: 0, state: ADDRSTATE.FREE, retries: 0 }) 
      })

      /* do not use pxp
      if (!this.fConnectPlainWeb)  {
        try {
          this._exchange = Exchange(params.magic.toString(16),
            assign({ wrtc, acceptIncoming }, opts.exchangeOpts))
        } catch (err) {
          return this._error(err)
        }
        this._exchange.on('error', this._error.bind(this))
        this._exchange.on('connect', (stream) => {
          this._onConnection(null, stream)
        })
        if (!process.browser && acceptIncoming) {
          this._acceptWebsocket()
        }
      }*/
    }

    this.on('block', (block) => {
      this.emit(`block:${utils.getBlockHash(block.header).toString('base64')}`, block)
    })
    this.on('merkleblock', (block) => {
      this.emit(`merkleblock:${utils.getBlockHash(block.header).toString('base64')}`, block)
    })
    this.on('tx', (tx) => {
      this.emit(`tx:${utils.getTxHash(tx).toString('base64')}`, tx)
    })
    this.once('peer', () => this.emit('connect'))

    this.on('wsaddr', this._onAddr)
  }

  _error (err) {
    this.emit('error', err)
  }

  // callback for peer discovery methods
  _onConnection (err, socket) {
    if (err) {
      if (socket) socket.destroy()
      debug(`discovery connection error: ` + errToString(err))
      this.emit('connectError', err, null)  // emit user's event
      // do this in connectPlainWeb:
      //if (isWebSocket(socket) && this.fConnectPlainWeb)
      //  this._updateWebAddrState(getWebSocketUrl(socket), undefined, ADDRSTATE.FREE, true)   // clear inuse state if connect error
      if (this.connecting) {
        // setImmediate(this._connectPeer.bind(this)) // lets wait for some time before
        debug(`waiting for ${this.retryInterval} ms before connection retry`)
        setTimeout(this._connectPeer.bind(this), this.retryInterval)
      }
      return
    }
    if (this.closed) return socket.destroy()
    let opts = assign({ socket }, this.peerOpts)
    let peer = new Peer(this._params, opts)
    let onPeerError = (err) => {
      console.log('onPeerError called')
      err = err || Error('Connection error')
      debug(`peer connection error: ` + errToString(err))
      peer.removeListener('disconnect', onPeerError)
      this.emit('connectError', err, peer)  // emit user's event
      if (isWebSocketPeer(peer) && this.fConnectPlainWeb)
        this._updateWebAddrState(getWebSocketPeerUrl(peer), undefined, ADDRSTATE.FREE, true)   // clear inuse state if connect error
      if (this.connecting) this._connectPeer()  // try to connect new peer
    }

    // wait for socket connection errors:
    peer.once('error', onPeerError)
    peer.once('disconnect', onPeerError)
    // socket connected:
    peer.once('ready', () => {
      if (this.closed) return peer.disconnect()
      // remove once listeners to replace with new ones
      peer.removeListener('error', onPeerError)
      peer.removeListener('disconnect', onPeerError)
      this.addPeer(peer)
      if (isWebSocketPeer(peer) && this.fConnectPlainWeb)
        this._updateWebAddrState(getWebSocketPeerUrl(peer), Date.now())
      // setup getaddr loop
      this.getAddr({}, ()=>{})                                    // empty opts and cb to pass through _request()
      setInterval(this.getAddr.bind(this, {}, ()=>{}), 120*1000)  // same
    })
  }

  // connects to a new peer, via a randomly selected peer discovery method
  _connectPeer (cb) {
    cb = cb || this._onConnection.bind(this)
    if (this.closed) return false
    if (this.peers.length >= this._numPeers) return false
    let getPeerArray = []
    if (!process.browser) {
      if (this._params.dnsSeeds && this._params.dnsSeeds.length > 0) {
        getPeerArray.push(this._connectDNSPeer.bind(this))
      }
      if (this._params.staticPeers && this._params.staticPeers.length > 0) {
        getPeerArray.push(this._connectStaticPeer.bind(this))
      }
    }
    /*if (this._connectWeb && !this.fConnectPlainWeb && this._exchange.peers.length > 0) {
      getPeerArray.push(this._exchange.getNewPeer.bind(this._exchange))
    }*/
    if (this.fConnectPlainWeb && this._freeWebAddrCount() > 0) {
      getPeerArray.push(this._getNewPlainWebPeer.bind(this))
    }
  
    if (this._params.getNewPeer) {
      getPeerArray.push(this._params.getNewPeer.bind(this._params))
    }
    if (getPeerArray.length === 0) { // could not find an addr to connect, let's retry in 8 sec
      this.connecting = false
      if (this.connectTimeout) {
        debug(`scheduling reconnecting to peers`)
        setTimeout(() => {
          this.connecting = true
          debug(`resuming connecting to peers`)
          setImmediate(this.connect.bind(this))
        }, this.connectTimeout)
      }
      this._onConnection(Error('No methods available to get new peers'))
      return false
    }
    let getPeer = utils.getRandom(getPeerArray)
    debug(`_connectPeer: getPeer = ${getPeer.name}`)
    getPeer(cb)
    return true
  }

  // connects to a random TCP peer via a random DNS seed
  // (selected from `dnsSeeds` in the params)
  _connectDNSPeer (cb) {
    let seeds = this._params.dnsSeeds
    let seed = utils.getRandom(seeds)
    dns.resolve(seed, (err, addresses) => {
      if (err) return cb(err)
      let address = utils.getRandom(addresses)
      this._connectTCP(address, this._params.defaultPort, cb)
    })
  }

  // connects to a random TCP peer from `staticPeers` in the params
  _connectStaticPeer (cb) {
    let peers = this._params.staticPeers
    let address = utils.getRandom(peers)
    let peer = utils.parseAddress(address)
    this._connectTCP(peer.hostname, peer.port || this._params.defaultPort, cb)
  }

  // connects to a standard protocol TCP peer
  _connectTCP (host, port, cb) {
    debug(`_connectTCP: tcp://${host}:${port}`)
    let socket = net.connect(port, host)
    let timeout
    if (this.connectTimeout) {
      timeout = setTimeout(() => {
        socket.destroy()
        cb(Error('Connection timed out'))
      }, this.connectTimeout)
    }
    socket.once('error', (err) => {
      clearTimeout(timeout) //added to clear timeout to prevent reconnection duplication (both on error and timeout)
      cb(err, socket)
    })    
    socket.once('connect', () => {
      socket.ref()
      socket.removeListener('error', cb)
      clearTimeout(timeout)
      cb(null, socket)
    })
    socket.unref()
  }

  // not supported
  // connects to the peer-exchange peers provided by the params
  /*_connectWebSeeds () {
    this._webAddrs.forEach((elem) => {
      let seed = elem.wsaddr
      debug(`connecting to web seed: ${JSON.stringify(seed, null, '  ')}`)
      let socket = wsstream(seed)
      socket.on('error', (err) => this._error(err))
      this._exchange.connect(socket, (err, peer) => {
        if (err) {
          debug(`error connecting to web seed (pxp): ${JSON.stringify(seed, null, '  ')} ${err.stack}`)
          return
        }
        debug(`connected to web seed: ${JSON.stringify(seed, null, '  ')}`)
        this.emit('webSeed', peer)
      })
    })
  }*/

  // connects to a plain websocket 
  _connectPlainWeb (wsaddr, cb) {
    debug(`_connectPlainWeb: ${wsaddr}`)
    let socket = wsstream(wsaddr)
    let timeout
    if (this.connectTimeout) {
      timeout = setTimeout(() => {
        socket.destroy()
        cb(Error('Connection timed out, peer ' + wsaddr))
        this._updateWebAddrState(wsaddr, undefined, ADDRSTATE.FREE, true)   // clear inuse state if connect timeout
      }, this.connectTimeout)
    }
    socket.once('error', (err) => {
      clearTimeout(timeout) //added to clear timeout to prevent reconnection duplication (both on error and timeout)
      cb(err + ', peer ' + wsaddr, socket)
      this._updateWebAddrState(wsaddr, undefined, ADDRSTATE.FREE, true)   // clear inuse state if connect error
    })
    socket.once('connect', () => {
      socket.removeListener('error', cb)
      clearTimeout(timeout)
      cb(null, socket)
    })
  }

  _addWebAddr(host, port)  {
    let wsaddr = `ws://${host}:${port}`;
    if (this._webAddrs.find((elem)=>{ return elem.wsaddr===wsaddr }) === undefined) {
      this._webAddrs.push({ wsaddr: wsaddr, lastConnectTime: 0, state: ADDRSTATE.FREE, retries: 0 });
    }
  }

  _freeWebAddrCount()  {
    let freeCount = 0
    this._webAddrs.forEach((elem)=>{
      if (elem.state === ADDRSTATE.FREE) {
        freeCount++;
      }
    })
    return freeCount;
  }

  // allow to try never connected after 3h
  // do not use this for now
  _clearWebAddrStates()  {
    /*let currentTime = Date.now();
    this._webAddrs.forEach((elem)=>{
      if (elem.state === ADDRSTATE.FAILED) {
        if (currentTime - elem.lastConnectTime > 3*60*60)
          elem.state = ADDRSTATE.FREE;
      }
    })*/
  }

  _findBestWebAddr()  {
    this._clearWebAddrStates();
    let wsaddr;
    let currentTime = Date.now();
    let maxTimeAfter = 0;

    // first try ones successfully connected ever, less recently
    this._webAddrs.forEach((elem)=>{      
      if (elem.state === ADDRSTATE.FREE && elem.lastConnectTime) {
        if (maxTimeAfter < currentTime - elem.lastConnectTime)  {
          maxTimeAfter = currentTime - elem.lastConnectTime;
          wsaddr = elem.wsaddr;
        }
      }
    })
    if (wsaddr === undefined) {
      // now try ones which were never connected (possibly fake ones)
      let minRetries = -1;
      this._webAddrs.forEach((elem)=>{
        // pick one with min retries count
        if (elem.state === ADDRSTATE.FREE) {
          if (minRetries < 0 || elem.retries < minRetries)  {  
            wsaddr = elem.wsaddr;
            minRetries = elem.retries;
          }
        }
      })
    }
    return wsaddr;
  }

  _updateWebAddrState(wsaddr, timestamp, state, failed) {
    let index = this._webAddrs.findIndex((elem)=>{ return elem.wsaddr === wsaddr; })
    if (index >= 0) {
      if (timestamp != undefined) {
        this._webAddrs[index].lastConnectTime = timestamp;
        console.log('_webAddr lastConnectTime set to ', this._webAddrs[index].lastConnectTime, 'for addr', wsaddr)
      }
      if (state != undefined) {
        this._webAddrs[index].state = state;
        console.log('_webAddr state set to ', this._webAddrs[index].state, 'for addr', wsaddr)
      }
      if (failed) {
        this._webAddrs[index].retries ++;
        console.log('_webAddr retries set to ', this._webAddrs[index].retries, 'for addr', wsaddr)
      }
    }
  }

  // connects to a random plain (non-pxp) web peer from `webAddrs` in the params
  _getNewPlainWebPeer (cb) {
    //let wspeers = this._params.webSeeds
    //let wsaddr = utils.getRandom(this._webAddrs)
    let wsaddr = this._findBestWebAddr();
    if (wsaddr !== undefined) {
      this._updateWebAddrState(wsaddr, undefined, ADDRSTATE.INUSE)
      this._connectPlainWeb(wsaddr, cb)
    }
  }

  _assertPeers () {
    if (this.peers.length === 0) {
      throw Error('Not connected to any peers')
    }
  }

  _fillPeers () {
    if (this.closed) return

    // TODO: smarter peer logic (ensure we don't have too many peers from the
    // same seed, or the same IP block)
    let n = this._numPeers - this.peers.length  // try hold up to 8 (by default) connections
    /*let freeWebAddrCount = 0;
    if (this.fConnectPlainWeb)  {
      freeWebAddrCount = this._freeWebAddrCount();
      if (n > freeWebAddrCount)
        n = freeWebAddrCount;
    }*/
    debug(`_fillPeers: n = ${n}, numPeers = ${this._numPeers}, peers.length = ${this.peers.length}`)
    for (let i = 0; i < n; i++) 
      if (!this._connectPeer())
        break;
  }

  // sends a message to all peers
  send (command, payload, assert) {
    assert = assert != null ? assert : true
    if (assert) this._assertPeers()
    for (let peer of this.peers) {
      peer.send(command, payload)
    }
  }

  // initializes the PeerGroup by creating peer connections
  connect (onConnect) {
    debug('connect called')
    this.connecting = true
    if (onConnect) this.once('connect', onConnect)

    // first, try to connect to pxp web seeds so we can get web peers
    // once we have a few, start filling peers via any random
    // peer discovery method
    if (this._connectWeb && !this.fConnectPlainWeb && this._params.webSeeds && this._webAddrs.length) {
      this.once('webSeed', () => this._fillPeers())    // connect after pxp discovery
      return this._connectWebSeeds()
    }

    // if we aren't using web seeds, start filling with other methods
    this._fillPeers()
  }

  // disconnect from all peers and stop accepting connections
  close (cb) {
    if (cb) cb = once(cb)
    else cb = (err) => { if (err) this._error(err) }

    debug(`close called: peers.length = ${this.peers.length}`)
    this.closed = true
    if (this.peers.length === 0) return cb(null)
    let peers = this.peers.slice(0)
    for (let peer of peers) {
      peer.once('disconnect', () => {
        if (this.peers.length === 0) cb(null)
      })
      peer.disconnect(Error('PeerGroup closing'))
    }
  }

  /* pxp not supported
  _acceptWebsocket (port, cb) {
    if (process.browser) return cb(null)
    if (!port) port = DEFAULT_PXP_PORT
    this.websocketPort = port
    let server = http.createServer()
    wsstream.createServer({ server }, (stream) => {
      this._exchange.accept(stream)
    })
    http.listen(port)
    cb(null)
  }*/

  _onAddr(message) {
    console.log('wsaddr message=', message);

    if (!Array.isArray(message))
      return;

    message.forEach((elem)=> {
      // TODO: check nspv service bit
      this._addWebAddr(elem.address, elem.port)
    })
    //this._fillPeers();
  }

  // manually adds a Peer
  addPeer (peer) {
    if (this.closed) throw Error('Cannot add peers, PeerGroup is closed')

    this.peers.push(peer)
    debug(`add peer: peers.length = ${this.peers.length}`)

    if (this._hardLimit && this.peers.length > this._numPeers) {
      let disconnectPeer = this.peers.shift()
      disconnectPeer.disconnect(Error('PeerGroup over limit'))
    }

    let onMessage = (message) => {
      this.emit('message', message, peer)
      this.emit(message.command, message.payload, peer)
    }
    peer.on('message', onMessage)

    peer.once('disconnect', (err) => {
      console.log('on peer.disconnect called')
      let index = this.peers.indexOf(peer)
      this.peers.splice(index, 1)
      peer.removeListener('message', onMessage)
      if (isWebSocketPeer(peer) && this.fConnectPlainWeb)
        this._updateWebAddrState(getWebSocketPeerUrl(peer), undefined, ADDRSTATE.FREE)
      debug(`peer disconnect, peer.length = ${this.peers.length}, reason=${err}\n${err.stack}`)
      if (this.connecting) this._fillPeers()
      this.emit('disconnect', peer, err)
    })
    peer.on('error', (err) => {
      console.log('on peer.error called')
      this.emit('peerError', err)
      if (isWebSocketPeer(peer) && this.fConnectPlainWeb)
        this._updateWebAddrState(getWebSocketPeerUrl(peer), undefined, ADDRSTATE.FREE)
      peer.disconnect(err)
    })

    this.emit('peer', peer)
  }

  randomPeer () {
    this._assertPeers()
    return utils.getRandom(this.peers)
  }

  getBlocks (hashes, opts, cb) {
    this._request('getBlocks', hashes, opts, cb)
  }

  getTransactions (blockHash, txids, opts, cb) {
    this._request('getTransactions', blockHash, txids, opts, cb)
  }

  getHeaders (locator, opts, cb) {
    this._request('getHeaders', locator, opts, cb)
  }

  getAddr (opts, cb) {
    this._request('getAddr', opts, cb)
  }

  // calls a method on a random peer,
  // and retries on another peer if it times out
  _request (method, ...args) {
    let cb = args.pop()
    while (!cb) cb = args.pop()
    let peer = this.randomPeer()
    args.push((err, res) => {
      if (this.closed) return
      if (err && err.timeout) {
        // if request times out, disconnect peer and retry with another random peer
        debug(`peer request "${method}" timed out, disconnecting`)
        peer.disconnect(err)
        this.emit('requestError', err)
        return this._request(...arguments)
      }
      cb(err, res, peer)
    })
    peer[method](...args)
  }

  // allow not to retry connections if needed
  stopConnecting()
  {
    this.connecting = false;
  }
}

module.exports = old(PeerGroup)

function isWebSocketPeer(peer)
{
  return peer.socket !== undefined && peer.socket.socket instanceof ws;
}

function getWebSocketPeerUrl(peer)
{
  if (isWebSocketPeer(peer))
    return peer.socket.socket.url;
}

function isWebSocket(socket)
{
  return socket !== undefined && socket.socket instanceof ws;
}

function getWebSocketUrl(socket)
{
  if (isWebSocket(socket))
    return socket.socket.url;
}

function errToString(err)
{
  if (typeof(err) === 'object') {
    if (err.message != undefined)
      return err.message;
    return err.toString();
  }
  return err.toString();
}
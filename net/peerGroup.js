'use strict'

const Debug = require('debug')
const logdebug = Debug('net:peergroup')
const logerror = Debug('net:peergroup:error');

const dns = require('dns')
const EventEmitter = require('events')
let net
try { net = require('net') } catch (err) {}
const wsstream = require('websocket-stream')
//const http = require('http')
//const Exchange = require('peer-exchange')
const getBrowserRTC = require('get-browser-rtc')
const once = require('once')
const assign = require('object-assign')
const old = require('old')
const Peer = require('./peer.js')
const utils = require('./utils.js')
//const { time } = require('console')
require('setimmediate')

const ADDRSTATE = {
  FREE: 0,
//  FAILED: -1,
  INUSE: 1
};
const ADDRSTATEOP = {
  CLEAR:      0,
  SETCONNTIME:   1
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
    // pxp not supported:
    this._connectPxpWeb = false // opts.connectWeb != null ? opts.connectWeb : process.browser
    this.connectTimeout = opts.connectTimeout != null
      ? opts.connectTimeout : 15 * 1000
    this.peerOpts = opts.peerOpts != null
      ? opts.peerOpts : {}
    this.wsOpts = opts.wsOpts != null
      ? opts.wsOpts : {}
    this.acceptIncoming = opts.acceptIncoming
    this.connecting = false
    this.closed = false
    this.accepting = false
    this.fConnectPlainWeb = opts.connectPlainWeb ? opts.connectPlainWeb : false
    this.retryInterval = 10000
    this.getAddrInterval = 120 * 1000
    this.getAddrTimer = null

    if (this.fConnectPlainWeb) {
      let wrtc = opts.wrtc || getBrowserRTC()
      let envWebSeeds = process.env.WEB_SEED
        ? process.env.WEB_SEED.split(',').map((s) => s.trim()) : []

      // maintain addresses state:
      // last successful connect time
      // unsuccessful retries count
      // if lastConnectTime == 0 (never connected) && retries count > 10 then this address is not used (to prevent spam addresses overusing)
      // after 3h retry count is cleared and the address is again available
      // when addresses are selected it first checked that lastConnectTime != 0 but it is least recently connected
      this._webAddrs = [];
      
      let webSeeds = [];
      if (this._params.webSeeds)  
        webSeeds = webSeeds.concat(this._params.webSeeds) // add web seeds from params
      if (envWebSeeds)
        webSeeds = webSeeds.concat(envWebSeeds) // add web seeds from env
      if (this._params.network && this._params.network.webSeeds) // add web seeds from network config
        webSeeds = webSeeds.concat(this._params.network.webSeeds)

      webSeeds.forEach( (elem)=>{ 
        this._webAddrs.push({ addr: elem, lastConnectTime: 0, state: ADDRSTATE.FREE, retries: 0 }) 
      })


      /* do not use pxp:
      if (this._connectPxpWeb)  {
        try {
          this._exchange = Exchange(params.magic.toString(16),
            assign({ wrtc, this.acceptIncoming }, opts.exchangeOpts))
        } catch (err) {
          return this._error(err)
        }
        this._exchange.on('error', this._error.bind(this))
        this._exchange.on('connect', (stream) => {
          this._onConnection(null, stream)
        })
        if (!process.browser && this.acceptIncoming) {
          this._acceptWebsocket()
        }
      }*/
    }
    else {
      this._resolvedAddrs = [];

      this._dnsSeeds = [];
      if (this._params.dnsSeeds)
        this._dnsSeeds = this._dnsSeeds.concat(this._params.dnsSeeds) // add seeds from params
      if (this._params.network && this._params.network.dnsSeeds)
        this._dnsSeeds = this._dnsSeeds.concat(this._params.network.dnsSeeds)  // add seeds from network config

      this._tcpAddrs = [];
      let staticPeers = [];
              
      if (this._params.staticPeers) 
        staticPeers = staticPeers.concat(this._params.staticPeers) // add static peers from params
      if (this._params.network && this._params.network.staticPeers)
        staticPeers = staticPeers.concat(this._params.network.staticPeers) // add static peers from network config

      staticPeers.forEach( (elem)=>{ 
        this._tcpAddrs.push({ addr: elem, lastConnectTime: 0, state: ADDRSTATE.FREE, retries: 0 }) 
      })
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

    if (this.fConnectPlainWeb)
      this.on('wsaddr', this._onWsAddr)  // process "wsaddr" messages (websockets must be supported at the server side)
    else
      this.on('addr', this._onAddr) // process "addr" messages
  }

  _error (err) {
    this.emit('error', err)
  }

  // callback for peer discovery methods
  _onConnection (err, socket, cbUpdateAddrState) {
    if (err) {
      if (socket) socket.destroy()
      logerror('discovery connection error: ' + errToString(err))
      this.emit('connectError', err, null)  // emit user's event
      if (this.connecting) {
        // setImmediate(this._connectPeer.bind(this)) // lets wait for some time before
        logdebug(`waiting for ${this.retryInterval} ms before connection retry`)
        setTimeout(this._connectPeer.bind(this), this.retryInterval)
      }
      if (cbUpdateAddrState)
        cbUpdateAddrState(ADDRSTATEOP.CLEAR, err)
      return
    }
    if (this.closed) return socket.destroy()
    let opts = assign({ socket }, this.peerOpts)
    let peer = new Peer(this._params, opts)

    // peer error callback
    let onPeerError = (err) => {
      err = err || Error('Connection error')
      logdebug('peer connection error: ' + errToString(err))
      peer.removeListener('disconnect', onPeerError)
      this.emit('connectError', err, peer)  // emit user's event

      // clear inuse state:
      if (cbUpdateAddrState)
        cbUpdateAddrState(ADDRSTATEOP.CLEAR, err)

      if (this.connecting) this._connectPeer()  // try to connect new peer
    }

    // peer success callback
    let onPeerReady = () => {
      if (this.closed) return peer.disconnect()
      // remove once listeners to replace with new ones
      peer.removeListener('error', onPeerError)
      peer.removeListener('disconnect', onPeerError)
      this.addPeer(peer, cbUpdateAddrState)

      // setup getaddr or getwsaddr loop
      if (this.fConnectPlainWeb)  {
        this.getWsAddr({}, ()=>{})                                    // empty opts and cb to pass through _request()
        this.getAddrTimer = setInterval(this.getWsAddr.bind(this, {}, ()=>{}), this.getAddrInterval)  // set getwsaddr interval 120 sec
      } else {
        this.getAddr({}, ()=>{})                                    // empty opts and cb to pass through _request()
        this.getAddrTimer = setInterval(this.getAddr.bind(this, {}, ()=>{}), this.getAddrInterval)  // set getaddr interval 120 sec
      }

      // set conn time
      if (cbUpdateAddrState)
        cbUpdateAddrState(ADDRSTATEOP.SETCONNTIME, null)  // update okay
    }

    // wait for socket connection errors:
    peer.once('error', onPeerError)
    peer.once('disconnect', onPeerError)
    // socket connected:
    peer.once('ready', onPeerReady)
  }

  // connects to a new peer, via a randomly selected peer discovery method
  _connectPeer () { 
    // cb = cb || this._onConnection.bind(this)
    let cb = this._onConnection.bind(this)  // always need our onConnection callback to work properly

    if (this.closed) return false
    if (this.peers.length >= this._numPeers) return false
    let getPeerArray = [] // getPeerFuncs will be added here

    if (!process.browser) {
      // non-browser dns resolved connections: 
      if (this._params.dnsSeeds && this.params.dnsSeeds.length > 0) {
        getPeerArray.push(this._connectDNSPeer.bind(this))
      }
      // non-browser static peers connections
      if (this._tcpAddrs && this._freeAddrCount(this._tcpAddrs) > 0) {
        getPeerArray.push(this._connectStaticPeer.bind(this, cb))
      }
    }
    /* pxp not supported:
    if (this._connectPxpWeb && !this.fConnectPlainWeb && this._exchange.peers.length > 0) {
      getPeerArray.push(this._exchange.getNewPeerCustom.bind(this._exchange))
    } */
    if (this.fConnectPlainWeb)  {
      if (this._webAddrs && this._freeAddrCount(this._webAddrs) > 0) {
        getPeerArray.push(this._getNewPlainWebPeer.bind(this))
      }
    }
  
    // user-defined function:
    if (this._params.getNewPeerCustom) {
      getPeerArray.push(this._params.getNewPeerCustom.bind(this._params))
    }
    
    if (getPeerArray.length === 0) { // could not find an addr to connect, let's retry in 8 sec
      this.connecting = false
      if (this.connectTimeout) {
        logdebug(`scheduling reconnection to peers in ${this.connectTimeout} ms`)
        setTimeout(() => {
          if (this.close) return
          this.connecting = true
          logdebug(`resuming connecting to peers`)
          setImmediate(this.connect.bind(this))
        }, this.connectTimeout)
      }
      this._onConnection(Error(`No methods available to get new peers for required ${this._numPeers} peers, current number ${this.peers.length}`))
      return false
    }
    let getPeerFunc = utils.getRandom(getPeerArray)
    logdebug(`_connectPeer: selected getPeerFunc is '${getPeerFunc.name}'`)
    getPeerFunc(cb)
    return true
  }

  // connects to a random TCP peer via a random DNS seed
  // (selected from `dnsSeeds` in the params)
  _connectDNSPeer (cb) {
    let seeds = this._dnsSeeds
    // let seed = utils.getRandom(seeds)  // cant get random as we should track addresses in use 

    seeds.forEach(seed => {
      dns.resolve(seed, (err, addresses) => {
        if (err) return cb(err)
        //let addr = utils.getRandom(addresses)  // we cant get random as we need track addresses in use
        addresses.forEach(addr => {
          if (this._findAddrState(this._resolvedAddrs, addr) != ADDRSTATE.INUSE) {  // check if dns resoled not in use
            this._updateAddrState(this._resolvedAddrs, { addr: addr, state: ADDRSTATE.INUSE });  
            let url = utils.parseAddress(address)

            this._connectTCP(addr, url.port /*|| this._params.defaultPort*/, (err, socket)=>{
              // callback to update addr state for dns peers
              let updateAddrState = (op, err) => {
                console.log('updateAddrState in _connectDNSPeer called', op)
                if (op == ADDRSTATEOP.CLEAR)
                  this._updateAddrState(this._resolvedAddrs, { addr: addr, state: ADDRSTATE.FREE, failed: !!err } )   // clear inuse state if connect error or disconnected
                else if (op == ADDRSTATEOP.SETCONNTIME)
                  this._updateAddrState(this._resolvedAddrs, { addr: addr, lastConnectTime: Date.now(), state: ADDRSTATE.INUSE } )   // set conn time
              }

              cb(err, socket, updateAddrState);
            });
            return
          }
        })
      })
    })
  }

  // connects to a random TCP peer from `staticPeers` in the params
  _connectStaticPeer (cb) {
    //let staticPeers = this._params.staticPeers
    //let address = utils.getRandom(staticPeers)
    let address = this._findBestAddr(this._tcpAddrs);
    if (address !== undefined) {
      this._updateAddrState(this._tcpAddrs, { addr: address, state: ADDRSTATE.INUSE });  
      let peer = utils.parseAddress(address)
      this._connectTCP(peer.hostname, peer.port /*|| this._params.defaultPort*/, (err, socket)=>{
        // callback to update addr state for tcp peers
        let updateAddrState = (op, err) => {
          console.log('updateAddrState in _connectStaticPeer called', op)
          if (op == ADDRSTATEOP.CLEAR)
            this._updateAddrState(this._tcpAddrs, { addr: address, state: ADDRSTATE.FREE, failed: !!err } )   // clear inuse state if error or disconnected
          else if (op == ADDRSTATEOP.SETCONNTIME)
            this._updateAddrState(this._tcpAddrs, { addr: address, lastConnectTime: Date.now(), state: ADDRSTATE.INUSE } )   // set connected time
        }

        cb(err, socket, updateAddrState)
      });
    }
    else 
      logerror("internal error could not find free tcp address");
  }

  // connects to a standard protocol TCP peer
  _connectTCP (host, port, cb) {
    logdebug(`_connectTCP: tcp://${host}:${port}`)
    let socket = net.connect(port, host)
    let timeout
    if (this.connectTimeout) {
      timeout = setTimeout(() => {
        socket.destroy()
        cb(Error(`Connection timed out tcp://${host}:${port}`))
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
  /*_connectPxpWebSeeds () {
    this._webAddrs.forEach((elem) => {
      let seed = elem.wsaddr
      logdebug(`connecting to web seed: ${JSON.stringify(seed, null, '  ')}`)
      let socket = wsstream(seed)
      socket.on('error', (err) => this._error(err))
      this._exchange.connect(socket, (err, peer) => {
        if (err) {
          logdebug(`error connecting to web seed (pxp): ${JSON.stringify(seed, null, '  ')} ${err.stack}`)
          return
        }
        logdebug(`connected to web seed: ${JSON.stringify(seed, null, '  ')}`)
        this.emit('webSeed', peer)
      })
    })
  }*/

  // connects to a plain websocket 
  _connectPlainWebPeer (addr, cb) {
    logdebug(`_connectPlainWebPeer: ${addr}`)
    let socket = wsstream(addr, undefined , this.wsOpts)
    let timeout

    let updateAddrState = (op, err) => {
      console.log('updateAddrState in _connectPlainWebPeer called', op)
      if (op == ADDRSTATEOP.CLEAR)
        this._updateAddrState(this._webAddrs, { addr: addr, state: ADDRSTATE.FREE, failed: !!err } )   // clear inuse state if connect error or disconnected
      else if (op == ADDRSTATEOP.SETCONNTIME)
        this._updateAddrState(this._webAddrs, { addr: addr, lastConnectTime: Date.now(), state: ADDRSTATE.INUSE } )   // set conn time
    }

    if (this.connectTimeout) {
      timeout = setTimeout(() => {
        socket.destroy()
        cb(Error(`Connection timed out, peer ${addr}`), undefined, updateAddrState)
        this._updateAddrState(this._webAddrs, { addr: addr, state: ADDRSTATE.FREE, failed: true} )   // clear inuse state if connect timeout
      }, this.connectTimeout)
    }
    socket.once('error', (err) => {
      clearTimeout(timeout) // clear timeout to prevent reconnection duplication (both on error and timeout)
      cb(Error(errToString(err) + ', peer ' + addr), socket, updateAddrState)
    })
    socket.once('connect', () => {
      socket.removeListener('error', cb)
      clearTimeout(timeout)
      cb(null, socket, updateAddrState)
    })
  }

  _addWebAddr(host, port)  {
    let addr = `ws://${host}:${port}`;
    if (this._webAddrs.find((elem)=>{ return elem.addr===addr }) === undefined) {
      this._webAddrs.push({ addr: addr, lastConnectTime: 0, state: ADDRSTATE.FREE, retries: 0 });
    }
  }

  _addTcpAddr(host, port)  {
    let addr = `${host}:${port}`;
    if (this._tcpAddrs.find((elem)=>{ return elem.addr===addr }) === undefined) {
      this._tcpAddrs.push({ addr: addr, lastConnectTime: 0, state: ADDRSTATE.FREE, retries: 0 });
    }
  }

  _freeAddrCount(addrs)  {
    let freeCount = 0
    addrs.forEach((elem)=>{
      if (elem.state === ADDRSTATE.FREE) {
        freeCount++;
      }
    })
    return freeCount;
  }

  _findAddrState(addrs, addr)  {
    if (addrs.find((a)=>{ return a.addr===addr }) !== undefined)
      return a.state;
    else
      return ADDRSTATE.FREE;
  }

  _findBestAddr(addrs)  {
    let selected;
    let currentTime = Date.now();
    let maxTimeAfter = 0;

    // first try ones successfully connected ever, less recently
    addrs.forEach((a)=>{      
      if (a.state === ADDRSTATE.FREE && a.lastConnectTime) {
        if (maxTimeAfter < currentTime - a.lastConnectTime)  {
          maxTimeAfter = currentTime - a.lastConnectTime;
          selected = a.addr;
        }
      }
    })
    if (selected === undefined) {
      // now try ones which were never connected (possibly fake ones)
      let minRetries = -1;
      addrs.forEach((a)=>{
        // pick one with min retries count
        if (a.state === ADDRSTATE.FREE) {
          if (minRetries < 0 || a.retries < minRetries)  {  
            selected = a.addr;
            minRetries = a.retries;
          }
        }
      })
    }
    return selected;
  }

  _updateAddrState(addrs, o) {
    if (o.addr === undefined)
      return;
    let index = addrs.findIndex((a)=>{ return a.addr === o.addr; })
    if (index >= 0) {
      if (o.timestamp !== undefined) {
        addrs[index].lastConnectTime = o.timestamp;
        addrs[index].retries = 0; // clear retries
        logdebug(`for addr ${addrs[index].addr} lastConnectTime set to ${addrs[index].lastConnectTime}`);
      }
      if (o.state !== undefined) {
        addrs[index].state = o.state;
        logdebug(`for addr ${addrs[index].addr} state set to ${addrs[index].state}`);
      }
      if (o.failed !== undefined) {
        addrs[index].retries ++;
        logdebug(`for addr ${addrs[index].addr} retries set to ${addrs[index].retries}`);
      }
    }
  }

  // connects to a random plain (non-pxp) web peer from `webAddrs` in the params
  _getNewPlainWebPeer (cb) {
    //let wspeers = this._params.webSeeds
    //let wsaddr = utils.getRandom(this._webAddrs)
    let wsaddr = this._findBestAddr(this._webAddrs);
    if (wsaddr !== undefined) {
      this._updateAddrState(this._webAddrs, { addr: wsaddr, state: ADDRSTATE.INUSE });
      this._connectPlainWebPeer(wsaddr, cb)
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
      freeWebAddrCount = this._freeAddrCount();
      if (n > freeWebAddrCount)
        n = freeWebAddrCount;
    }*/
    logdebug(`_fillPeers: n = ${n}, numPeers = ${this._numPeers}, peers.length = ${this.peers.length}`)
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
    logdebug('connect called')
    this.connecting = true
    if (onConnect) this.once('connect', onConnect)

    /* pxp not supported
    // first, try to connect to pxp web seeds so we can get web peers
    // once we have a few, start filling peers via any random
    // peer discovery method
    if (this._connectPxpWeb && !this.fConnectPlainWeb && this._params.webSeeds && this._webAddrs.length) {
      this.once('webSeed', () => this._fillPeers())    // connect after pxp discovery
      return this._connectPxpWebSeeds()
    }
    */

    // if we aren't using web seeds, start filling with other methods
    this._fillPeers()
  }

  // disconnect from all peers and stop accepting connections
  close (cb) {
    if (cb) cb = once(cb)
    else cb = (err) => { if (err) this._error(err) }

    logdebug(`close called: peers.length = ${this.peers.length}`)
    this.closed = true
    if (this.peers.length === 0) return cb(null)
    let peers = this.peers.slice(0)
    for (let peer of peers) {
      peer.once('disconnect', () => {
        if (this.peers.length === 0) cb(null)
      })
      peer.disconnect(Error('PeerGroup closing'))
    }
    if (this.getAddrTimer) clearInterval(this.getAddrTimer)
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

  _onWsAddr(message) {
    logdebug('received wsaddr message=', message);

    if (!Array.isArray(message))
      return;

    message.forEach((elem)=> {
      // TODO: check nspv service bit
      this._addWebAddr(elem.address, elem.port)
    })
  }

  _onAddr(message) {
    //logdebug('received addr message=', message);

    if (!Array.isArray(message))
      return;

    message.forEach((elem)=> {
      // TODO: check nspv service bit
      // this._addTcpAddr(elem.address, elem.port)  // TODO: enable!!  (disable to connect always to only one node, for debug)
    })
  }


  // manually adds a Peer
  addPeer (peer, cbUpdateAddrState) {
    if (this.closed) throw Error('Cannot add peers, PeerGroup is closed')

    this.peers.push(peer)
    logdebug(`add peer: peers.length = ${this.peers.length}`)

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
      let index = this.peers.indexOf(peer)
      this.peers.splice(index, 1)
      peer.removeListener('message', onMessage)

      // clear in-use state: 
      if (cbUpdateAddrState)
        cbUpdateAddrState(ADDRSTATEOP.CLEAR, err);

      logerror(`peer disconnected, peer.length = ${this.peers.length}, reason=${err}\n${err.stack}`)
      if (this.connecting) this._fillPeers()
      this.emit('disconnect', peer, err)
    })
    peer.on('error', (err) => {
      logerror('peer.on error called', errToString(err))
      this.emit('peerError', err)
      peer.disconnect(err)

      // clear in-use state: 
      if (cbUpdateAddrState)
        cbUpdateAddrState(ADDRSTATEOP.CLEAR, err);
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

  // get transactions via the standard p2p 'getdata' message, 
  // it would return transaction from the block passed or from relay queue or mempool
  getTransactions (blockHash, txids, opts, cb) {
    this._request('getTransactions', blockHash, txids, opts, cb)
  }

  getHeaders (locator, opts, cb) {
    this._request('getHeaders', locator, opts, cb)
  }

  getAddr (opts, cb) {
    this._request('getAddr', opts, cb) // forward to peer.GetAddr()
  }

  getWsAddr (opts, cb) {
    this._request('getWsAddr', opts, cb)  // forward to peer.GetWsAddr()
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
        logdebug(`peer request "${method}" timed out, disconnecting`)
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

function errToString(err)
{
  if (typeof(err) === 'object') {
    if (err.message != undefined)
      return err.message;
    return err.toString();
  }
  return err.toString();
}

module.exports = old(PeerGroup)
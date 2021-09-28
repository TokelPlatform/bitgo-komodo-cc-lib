'use strict';

// create peer group
const NspvPeerGroup = require('../net/nspvPeerGroup');
const utils = require('../net/utils');
require('../net/nspvPeer');  // init peer.js too

const Debug = require('debug')
const logdebug = Debug('net:peergroup')

// connect to peers, for calling from browser
function nspvConnect(params, opts) {
  return new Promise((resolve, reject) => {
    const peers = new NspvPeerGroup(params, opts);
    peers.on('peer', peer => {
      logdebug('added new peer', utils.getPeerUrl(peer))
    });

    peers.on('connectError', (err, peer) => {
      // some peers may fail to connect to, but thts okay as long as there enough peers in the network
      logdebug('nspvConnect connectError', err);
    });

    peers.on('peerError', err => {
      // some peers may fail to connect to, but thts okay as long as there enough peers in the network
      logdebug('nspvConnect peerError', err);
    });

    peers.on('error', err => {
      // maybe let the GUI print the error  
      //logdebug('nspvBrowserConnect error', err);
      console.log('error')
      reject(err);
    });

    return peers.connect(() => {
      // maybe let the GUI print this:  
      //logdebug('nspvBrowserConnect connected to peer');
      resolve(peers);
    });
  });
}

module.exports = nspvConnect

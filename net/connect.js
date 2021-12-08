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
      logdebug('added new peer', peer.getUrl())
    });

    peers.on('connectError', (err, peer) => {
      // some peers may fail to connect to, but this okay as long as there enough peers in the network
      if (!peers.hasMethods())  { // nothing to do
        logdebug("nspvConnect got 'connectError'", err?.message, 'no connect methods, exiting...');
        peers.close();
        reject(err);
      }
    });

    peers.on('peerError', err => {
      // some peers may fail to connect to, but this okay as long as there enough peers in the network
      logdebug("nspvConnect got 'peerError'", err?.message);
    });

    peers.on('peerGroupError', err => {
      // maybe let the GUI print the error  
      //logdebug('nspvBrowserConnect error', err);
      logdebug.log("nspvConnect got 'peerGroupError'", err?.message, 'exiting...')
      reject(err);
    });

    return peers.nspvConnect(() => {
      // maybe let the GUI print this:  
      //logdebug('nspvBrowserConnect connected to a peer');
      resolve(peers);
    });
  });
}

module.exports = nspvConnect

'use strict';

// create peer group
const NspvPeerGroup = require('../net/nspvPeerGroup');
//const PeerGroup = require('../net/nspvPeerGroup');
const utils = require('../net/utils');
require('../net/nspvPeer');  // init peer.js too

const Debug = require('debug')
const logdebug = Debug('net:peergroup')

// connect to peers, for calling from browser
function nspvBrowserConnect(params, opts) {
  const peers = new NspvPeerGroup(params, opts);

  // not sure we need this event here (this was in the original sample):
  peers.on('peer', peer => {
    logdebug('added new peer', utils.getPeerUrl(peer))
  });

  return new Promise((resolve, reject) => {
    peers.on('connectError', (err, peer) => {
      // maybe let the GUI print the error  
      //logdebug('nspvBrowserConnect connectError', err);
      reject(err, peer);
    });

    peers.on('peerError', err => {
      // maybe let the GUI print the error  
      //logdebug('nspvBrowserConnect peerError', err);
      reject(err);
    });

    peers.on('error', err => {
      // maybe let the GUI print the error  
      //logdebug('nspvBrowserConnect error', err);
      reject(err);
    });

    peers.connect(() => {
      // maybe let the GUI print this:  
      //logdebug('nspvBrowserConnect connected to peer');
      resolve();
    });
  });
}

exports.nspvBrowserConnect = nspvBrowserConnect;
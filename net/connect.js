// connect to peers, for calling from browser
function nspvBrowserConnect(params, opts) {
  const peers = new NspvPeerGroup(params, opts);
  peers.on('peer', peer => {
    console.log('in event: connected to peer', peer.socket.remoteAddress);
  });

  return new Promise((resolve, reject) => {
    peers.on('connectError', (err, peer) => {
      console.log('connectError');
      reject(err, peer);
    });

    peers.on('peerError', err => {
      console.log('peerError');
      console.log(err);
      reject(err);
    });

    peers.on('error', err => {
      console.log('error');
      console.log(err);
      reject(err);
    });

    peers.connect(() => {
      console.log('in promise: connected to peer!!!');
      resolve();
    });
  });
}

exports.nspvBrowserConnect = nspvBrowserConnect;

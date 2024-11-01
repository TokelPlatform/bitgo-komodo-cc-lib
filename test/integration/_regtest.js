var bitcoin = require('../../')
const got = require('got');

var APIPASS = process.env.APIPASS || 'satoshi'
var APIURL = 'https://api.dcousens.cloud/1'


function broadcast (txHex, callback) {
  got.put(APIURL + '/t/push', { body: txHex }).then(response => callback(null, response.body)).catch(callback);
}

function mine (count, callback) {
  got.post(APIURL + '/r/generate', { searchParams: { count, key: APIPASS } }).then(response => callback(null, response.body)).catch(callback);
}

function height (callback) {
  got.get(APIURL + '/b/best/height').then(response => callback(null, response.body)).catch(callback);
}

function faucet (address, value, callback) {
  got.post(APIURL + '/r/faucet', { searchParams: { address, value, key: APIPASS } })
    .then(response => {
      const txId = response.body;
      return unspents(address, (err, results) => {
        if (err) return callback(err);
        callback(null, results.filter(x => x.txId === txId).pop());
      });
    }).catch(callback);
}

function fetch (txId, callback) {
  got.get(APIURL + '/t/' + txId).then(response => callback(null, response.body)).catch(callback);
}

function unspents (address, callback) {
  got.get(APIURL + '/a/' + address + '/unspents').then(response => callback(null, response.body)).catch(callback);
}

function verify (txo, callback) {
  const { txId } = txo;
  fetch(txId, function (err, txHex) {
    if (err) return callback(err);
    // TODO: verify address and value
    callback();
  });
}

function randomAddress () {
  return bitcoin.ECPair.makeRandom({
    network: bitcoin.networks.testnet
  }).getAddress()
}

module.exports = {
  broadcast: broadcast,
  faucet: faucet,
  fetch: fetch,
  height: height,
  mine: mine,
  network: bitcoin.networks.testnet,
  unspents: unspents,
  verify: verify,
  randomAddress: randomAddress,
  RANDOM_ADDRESS: randomAddress()
}

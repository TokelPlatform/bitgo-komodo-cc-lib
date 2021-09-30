var script = require('./script');

var templates = require('./templates');
for (var key in templates) {
  script[key] = templates[key];
}

module.exports = {
  bitgo: require('./bitgo'),
  bufferutils: require('./bufferutils'), // TODO: remove in 4.0.0

  Block: require('./block'),
  ECPair: require('./ecpair'),
  ECSignature: require('./ecsignature'),
  HDNode: require('./hdnode'),
  Transaction: require('./transaction'),
  TransactionBuilder: require('./transaction_builder'),

  address: require('./address'),
  coins: require('./coins'),
  crypto: require('./crypto'),
  networks: require('./networks'),
  opcodes: require('bitcoin-ops'),
  script: script,
  ccutils: require('../cc/ccutils'),
  kmdMessages: require('../net/kmdmessages'),
  NspvPeerGroup: require('../net/nspvPeerGroup'),
  peer: require('../net/peer'),
  general: require('../cc/general'),
  cctokensv2: require('../cc/cctokensv2'),
  nspvConnect: require('../net/connect'),
};

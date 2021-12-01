/*

The values for the various fork coins can be found in these files:

property       filename             varname                           notes
------------------------------------------------------------------------------------------------------------------------
messagePrefix  src/validation.cpp   strMessageMagic                   Format `${CoinName} Signed Message`
bech32_hrp     src/chainparams.cpp  bech32_hrp                        Only for some networks
bip32.public   src/chainparams.cpp  base58Prefixes[EXT_PUBLIC_KEY]    Mainnets have same value, testnets have same value
bip32.private  src/chainparams.cpp  base58Prefixes[EXT_SECRET_KEY]    Mainnets have same value, testnets have same value
pubKeyHash     src/chainparams.cpp  base58Prefixes[PUBKEY_ADDRESS]
scriptHash     src/chainparams.cpp  base58Prefixes[SCRIPT_ADDRESS]
wif            src/chainparams.cpp  base58Prefixes[SECRET_KEY]        Testnets have same value

*/

const kmdmessages = require('../net/kmdmessages');

const coins = {
  BCH: 'bch',
  BSV: 'bsv',
  BTC: 'btc',
  BTG: 'btg',
  LTC: 'ltc',
  ZEC: 'zec',
  DASH: 'dash',
};

function getDefaultBip32Mainnet() {
  return {
    // base58 'xpub'
    public: 0x0488b21e,
    // base58 'xprv'
    private: 0x0488ade4,
  };
}

function getDefaultBip32Testnet() {
  return {
    // base58 'tpub'
    public: 0x043587cf,
    // base58 'tprv'
    private: 0x04358394,
  };
}

module.exports = {
  // https://github.com/bitcoin/bitcoin/blob/master/src/validation.cpp
  // https://github.com/bitcoin/bitcoin/blob/master/src/chainparams.cpp
  bitcoin: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'bc',
    bip32: getDefaultBip32Mainnet(),
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    wif: 0x80,
    coin: coins.BTC,
  },
  testnet: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'tb',
    bip32: getDefaultBip32Testnet(),
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef,
    coin: coins.BTC,
  },

  // https://github.com/Bitcoin-ABC/bitcoin-abc/blob/master/src/validation.cpp
  // https://github.com/Bitcoin-ABC/bitcoin-abc/blob/master/src/chainparams.cpp
  bitcoincash: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bip32: getDefaultBip32Mainnet(),
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    wif: 0x80,
    coin: coins.BCH,
    forkId: 0x00,
  },
  bitcoincashTestnet: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bip32: getDefaultBip32Testnet(),
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef,
    coin: coins.BCH,
  },

  // https://github.com/BTCGPU/BTCGPU/blob/master/src/validation.cpp
  // https://github.com/BTCGPU/BTCGPU/blob/master/src/chainparams.cpp
  bitcoingold: {
    messagePrefix: '\x18Bitcoin Gold Signed Message:\n',
    bech32: 'btg',
    bip32: getDefaultBip32Mainnet(),
    pubKeyHash: 0x26,
    scriptHash: 0x17,
    wif: 0x80,
    coin: coins.BTG,
    forkId: 0x4f /* 79 */,
  },
  // bitcoingoldTest: TODO

  // https://github.com/bitcoin-sv/bitcoin-sv/blob/master/src/validation.cpp
  // https://github.com/bitcoin-sv/bitcoin-sv/blob/master/src/chainparams.cpp
  bitcoinsv: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bip32: getDefaultBip32Mainnet(),
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    wif: 0x80,
    coin: coins.BSV,
    forkId: 0x00,
  },
  bitcoinsvTestnet: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bip32: getDefaultBip32Testnet(),
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef,
    coin: coins.BSV,
  },

  // https://github.com/dashpay/dash/blob/master/src/validation.cpp
  // https://github.com/dashpay/dash/blob/master/src/chainparams.cpp
  dash: {
    messagePrefix: '\x19DarkCoin Signed Message:\n',
    bip32: getDefaultBip32Mainnet(),
    pubKeyHash: 0x4c,
    scriptHash: 0x10,
    wif: 0xcc,
    coin: coins.DASH,
  },
  dashTest: {
    messagePrefix: '\x19DarkCoin Signed Message:\n',
    bip32: getDefaultBip32Testnet(),
    pubKeyHash: 0x8c,
    scriptHash: 0x13,
    wif: 0xef,
    coin: coins.DASH,
  },

  // https://github.com/litecoin-project/litecoin/blob/master/src/validation.cpp
  // https://github.com/litecoin-project/litecoin/blob/master/src/chainparams.cpp
  litecoin: {
    messagePrefix: '\x19Litecoin Signed Message:\n',
    bech32: 'ltc',
    bip32: getDefaultBip32Mainnet(),
    pubKeyHash: 0x30,
    scriptHash: 0x32,
    wif: 0xb0,
    coin: coins.LTC,
  },
  litecoinTest: {
    messagePrefix: '\x19Litecoin Signed Message:\n',
    bech32: 'tltc',
    bip32: getDefaultBip32Testnet(),
    pubKeyHash: 0x6f,
    scriptHash: 0x3a,
    wif: 0xef,
    coin: coins.LTC,
  },
  // https://github.com/zcash/zcash/blob/master/src/validation.cpp
  // https://github.com/zcash/zcash/blob/master/src/chainparams.cpp
  zcash: {
    messagePrefix: '\x18ZCash Signed Message:\n',
    bip32: getDefaultBip32Mainnet(),
    pubKeyHash: 0x1cb8,
    scriptHash: 0x1cbd,
    wif: 0x80,
    // This parameter was introduced in version 3 to allow soft forks, for version 1 and 2 transactions we add a
    // dummy value.
    consensusBranchId: {
      1: 0x00,
      2: 0x00,
      3: 0x5ba81b19,
      // 4: 0x76b809bb (old Sapling branch id). Blossom branch id becomes effective after block 653600
      // 4: 0x2bb40e60
      4: 0xf5b9230b,
    },
    coin: coins.ZEC,
  },
  zcashTest: {
    messagePrefix: '\x18ZCash Signed Message:\n',
    bip32: getDefaultBip32Testnet(),
    pubKeyHash: 0x1d25,
    scriptHash: 0x1cba,
    wif: 0xef,
    consensusBranchId: {
      1: 0x00,
      2: 0x00,
      3: 0x5ba81b19,
      // 4: 0x76b809bb (old Sapling branch id)
      // 4: 0x2bb40e60
      4: 0xf5b9230b,
    },
    coin: coins.ZEC,
  },

  // komodo main chains:
  KMD: {
    messagePrefix: '\x18KMD main chain:\n',
    bech32: 'R',
    bip32: getDefaultBip32Mainnet(),
    pubKeyHash: 0x3c,
    scriptHash: 0x55,
    cryptoconditionHash: 0x1c,
    wif: 0xbc,
    consensusBranchId: {
      1: 0x00,
      2: 0x00,
      3: 0x5ba81b19,
      4: 0x76b809bb, // (old Sapling branch id, used in kmd)
      // 4: 0x2bb40e60
      // 4: 0xf5b9230b
    },
    coin: coins.ZEC,
    komodoAssetNet: false,
  },

  // komodo asset chains:
  dimxy19: {
    messagePrefix: '\x18DIMXY19 asset chain:\n',
    bech32: 'R',
    bip32: getDefaultBip32Mainnet(),
    pubKeyHash: 0x3c,
    scriptHash: 0x55,
    cryptoconditionHash: 0x1c,
    wif: 0xbc,
    consensusBranchId: {
      1: 0x00,
      2: 0x00,
      3: 0x5ba81b19,
      4: 0x76b809bb, // (old Sapling branch id - used in kmd)
      // 4: 0x2bb40e60
      // 4: 0xf5b9230b
    },
    coin: coins.ZEC,
    komodoAssetNet: true,
    magic: 0xb00668b4,
    protocolVersion: 170009,
    messages: kmdmessages.kmdMessages
  },

  dimxy20: {
    messagePrefix: '\x18DIMXY20 asset chain:\n',
    bech32: 'R',
    bip32: getDefaultBip32Mainnet(),
    pubKeyHash: 0x3c,
    scriptHash: 0x55,
    cryptoconditionHash: 0x1c,
    wif: 0xbc,
    consensusBranchId: {
      1: 0x00,
      2: 0x00,
      3: 0x5ba81b19,
      4: 0x76b809bb, // (old Sapling branch id - used in kmd)
      // 4: 0x2bb40e60
      // 4: 0xf5b9230b
    },
    coin: coins.ZEC,
    komodoAssetNet: true,
    magic: 0x09262b14,
    protocolVersion: 170009,
    messages: kmdmessages.kmdMessages
  },

  rick: {
    messagePrefix: '\x18rick asset chain:\n',
    bech32: 'R',
    bip32: getDefaultBip32Mainnet(),
    pubKeyHash: 0x3c,
    scriptHash: 0x55,
    cryptoconditionHash: 0x1c,
    wif: 0xbc,
    consensusBranchId: {
      1: 0x00,
      2: 0x00,
      3: 0x5ba81b19,
      4: 0x76b809bb, // (old Sapling branch id, used in kmd)
      // 4: 0x2bb40e60
      // 4: 0xf5b9230b
    },
    coin: coins.ZEC,
    komodoAssetNet: true,
    magic: 0xfd750df6,
  },

  tok6: {
    messagePrefix: '\x18TOK6 asset chain:\n',
    bech32: 'R',
    bip32: getDefaultBip32Mainnet(),
    pubKeyHash: 0x3c,
    scriptHash: 0x55,
    cryptoconditionHash: 0x1c,
    wif: 0xbc,
    consensusBranchId: {
      1: 0x00,
      2: 0x00,
      3: 0x5ba81b19,
      4: 0x76b809bb, // (old Sapling branch id - used in kmd)
      // 4: 0x2bb40e60
      // 4: 0xf5b9230b
    },
    coin: coins.ZEC,
    komodoAssetNet: true,
    magic:   0xf4b89a4f,
    protocolVersion: 170009,
    messages: kmdmessages.kmdMessages
  },

  dimxy23: {
    messagePrefix: '\x18DIMXY23 asset chain:\n',
    bech32: 'R',
    bip32: getDefaultBip32Mainnet(),
    pubKeyHash: 0x3c,
    scriptHash: 0x55,
    cryptoconditionHash: 0x1c,
    wif: 0xbc,
    consensusBranchId: {
      1: 0x00,
      2: 0x00,
      3: 0x5ba81b19,
      4: 0x76b809bb, // (old Sapling branch id - used in kmd)
      // 4: 0x2bb40e60
      // 4: 0xf5b9230b
    },
    coin: coins.ZEC,
    komodoAssetNet: true,
    magic: 0x902f7aae,
  },

  DIMXY24: {
    messagePrefix: '\x18DIMXY24 asset chain:\n',
    bech32: 'R',
    bip32: getDefaultBip32Mainnet(),
    pubKeyHash: 0x3c,
    scriptHash: 0x55,
    cryptoconditionHash: 0x1c,
    wif: 0xbc,
    consensusBranchId: {
      1: 0x00,
      2: 0x00,
      3: 0x5ba81b19,
      4: 0x76b809bb, // (old Sapling branch id - used in kmd)
      // 4: 0x2bb40e60
      // 4: 0xf5b9230b
    },
    coin: coins.ZEC,
    komodoAssetNet: true,
    protocolVersion: 170009,
    messages: kmdmessages.kmdMessages,
    magic:   0x0e4bef0d,
    //to connect over p2p:
    dnsSeeds: [],
    staticPeers: [ 
      'localhost:14722' 
      //'18.190.86.67:14722'
    ], 
    // to connect over websockets:
    webSeeds: [
      //'ws://18.189.25.123:8192'
      'wss://localhost:8192',
      //'ws://3.136.47.223:8192'
      // TODO: add more
    ],
  },

  dimxy25: {
    messagePrefix: '\x18DIMXY25 asset chain:\n',
    bech32: 'R',
    bip32: getDefaultBip32Mainnet(),
    pubKeyHash: 0x3c,
    scriptHash: 0x55,
    cryptoconditionHash: 0x1c,
    wif: 0xbc,
    consensusBranchId: {
      1: 0x00,
      2: 0x00,
      3: 0x5ba81b19,
      4: 0x76b809bb, // (old Sapling branch id - used in kmd)
      // 4: 0x2bb40e60
      // 4: 0xf5b9230b
    },
    coin: coins.ZEC,
    komodoAssetNet: true,
    protocolVersion: 170009,
    messages: kmdmessages.kmdMessages,
    magic: 0x794cdf9b,
    //to connect over p2p:
    dnsSeeds: [],
    staticPeers: ['3.136.47.223:14722'],
    // to connect over websockets:
    webSeeds: [
      //'wss://localhost:8192'
    ],
  },

  dimxy28: {
    messagePrefix: '\x18DIMXY28 asset chain:\n',
    bech32: 'R',
    bip32: getDefaultBip32Mainnet(),
    pubKeyHash: 0x3c,
    scriptHash: 0x55,
    cryptoconditionHash: 0x1c,
    wif: 0xbc,
    consensusBranchId: {
      1: 0x00,
      2: 0x00,
      3: 0x5ba81b19,
      4: 0x76b809bb, // (old Sapling branch id - used in kmd)
      // 4: 0x2bb40e60
      // 4: 0xf5b9230b
    },
    coin: coins.ZEC,
    komodoAssetNet: true,
    protocolVersion: 170009,
    messages: kmdmessages.kmdMessages,
    magic:  0xd866b57e,
    //to connect over p2p:
    dnsSeeds: [],
    staticPeers: [
    //  '3.136.47.223:14722'
    //  'localhost:14722'
      '18.189.25.123:14722'
    ],
    // to connect over websockets:
    webSeeds: [
      //'wss://localhost:8192'
    ],
  },

  TKLTEST: {
    messagePrefix: '\x18TKLTEST asset chain:\n',
    bech32: 'R',
    bip32: getDefaultBip32Mainnet(),
    pubKeyHash: 0x3c,
    scriptHash: 0x55,
    cryptoconditionHash: 0x1c,
    wif: 0xbc,
    consensusBranchId: {
      1: 0x00,
      2: 0x00,
      3: 0x5ba81b19,
      4: 0x76b809bb, // (old Sapling branch id - used in kmd)
      // 4: 0x2bb40e60
      // 4: 0xf5b9230b
    },
    coin: coins.ZEC,
    komodoAssetNet: true,
    protocolVersion: 170009,
    messages: kmdmessages.kmdMessages,
    magic:  0xf6475548,
    // to connect over p2p:
    dnsSeeds: [ 
      //'ec2-18-189-25-123.us-east-2.compute.amazonaws.com:22024'
    ],
    staticPeers: [
      '164.132.225.134:22024',
      // '167.99.114.240:22024',
      //'18.190.86.67:22024'
      //'localhost:22024'
      //'18.189.25.123:22024'
      //'tcp://164.132.225.134:22024',
      '167.99.114.240:22024',
    ],
    // to connect over websockets:
    webSeeds: [
      //'ws://18.189.25.123:8192'
    ],
  },

  TOKEL: {
    messagePrefix: '\x18TOKEL chain:\n',
    bech32: 'R',
    bip32: getDefaultBip32Mainnet(),
    pubKeyHash: 0x3c,
    scriptHash: 0x55,
    cryptoconditionHash: 0x1c,
    wif: 0xbc,
    consensusBranchId: {
      1: 0x00,
      2: 0x00,
      3: 0x5ba81b19,
      4: 0x76b809bb, // (old Sapling branch id - used in kmd)
      // 4: 0x2bb40e60
      // 4: 0xf5b9230b
    },
    coin: coins.ZEC,
    komodoAssetNet: true,
    protocolVersion: 170009,
    messages: kmdmessages.kmdMessages,
    magic:  0x86c2fdd0,
  
    //to connect over p2p:
    dnsSeeds: [
      //'ec2-18-189-25-123.us-east-2.compute.amazonaws.com:29404'
    ],
    staticPeers: [
      '192.99.71.125:29404',
      '135.125.204.169:29404',
      ////'18.190.86.67:29404'
      // 'localhost:29404',
      //'18.189.25.123:29404'
      //'51.38.124.215:29404'
    ],

    // to connect over websockets:
    webSeeds: [
      // 'wss://localhost:8192'
      // TODO: add more
    ],
  }, 
};

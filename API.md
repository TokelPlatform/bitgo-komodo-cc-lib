# nSPV API

## Basic API

First you need to connect to peers to start making requests.

```
try {
  const { nspvConnect, networks } = require('@tokel/nspv-js');  
  const network = networks.tkltest;
  const peers = await nspvConnect({ network }, {});
} catch (e) {
  // do something
}

```
## General

`general.keyToWif(String)` - Receives any string(WIF/seed phrase) and returns WIF.

    const { general, networks } = require('@tokel/nspv-js');
    const network = networks.tkltest;
    const wif = general.keyToWif(seed, network);


`general.getSeedPhrase(Number)` - Generates a bip39 mnemonic seed phrase, specify strength 128 or 256 as a parameter.

    const { general, networks } = require('@tokel/nspv-js');
    const network = networks.tkltest;
    const seed = general.getSeedPhrase(256);

`general.create_normaltx(wif, destaddress, amount, network, peers)` - creates and signs transaction locally, amount is in satoshi, peers parameter is returned from `nspvConnect`, see connection example above

    const { general, networks } = require('@tokel/nspv-js');
    const network = networks.tkltest;
    const txHex = await general.create_normaltx(
      'MySecretWif',
      'MyAddress',
      10000000,
      network,
      peers
    );

## Crypto Conditions Utilities

### `getNormalUtxos(peers, address, skipCount, maxrecords)`

Get unspent coin transactions (utxos) for the given address.


- **peers**: PeerGroup object, this object is returned by the `nspvConnect` function
  
- **address**: string, address you want to get transactions for
  
- **skipCount**: number, utxos are sorted descending, how many utxos you want to skip from the start

- **maxrecords**: number



This will return transactions of the assets chain, e.g. TKLTEST transactions if you connect to `networks.tkltest`

    const { ccutils, networks } = require('@tokel/nspv-js');
    const network = networks.tkltest;
    const response = await ccutils.getNormalUtxos(peers, 'myaddress', 0, 0);

<details>
  <summary>Response sample</summary>

```

{
  respCode: 3,
  requestId: 4,
  utxos: [
    {
      txid: 'e38d7f9a0d5093a17513a467a8e3cf49bf97aa51d662b0cccfb391377e3b22c2',
      satoshis: 299980000,
      extradata: 0,
      vout: 2,
      height: 99084,
      script: <Buffer 76 a9 14 09 a7 c4 8f 0d b7 e8 b5 4b f4 49 4c 01 ed 66 b9 9f 32 16 a6 88 ac>,
      asm: 'OP_DUP OP_HASH160 09a7c48f0db7e8b54bf4494c01ed66b99f3216a6 OP_EQUALVERIFY OP_CHECKSIG'
    },
    {
      txid: '96ff02df7a79f06a2bf42530e739dca3b3f32768e546412168e4117483ca56e7',
      satoshis: 99870000,
      extradata: 0,
      vout: 2,
      height: 100161,
      script: <Buffer 76 a9 14 09 a7 c4 8f 0d b7 e8 b5 4b f4 49 4c 01 ed 66 b9 9f 32 16 a6 88 ac>,
      asm: 'OP_DUP OP_HASH160 09a7c48f0db7e8b54bf4494c01ed66b99f3216a6 OP_EQUALVERIFY OP_CHECKSIG'
    },
    {
      txid: '13aaf798ba63ef2852a231d58376581c05ad164d40c6116f65469aa2c60dd8f6',
      satoshis: 99980000,
      extradata: 0,
      vout: 2,
      height: 99090,
      script: <Buffer 76 a9 14 09 a7 c4 8f 0d b7 e8 b5 4b f4 49 4c 01 ed 66 b9 9f 32 16 a6 88 ac>,
      asm: 'OP_DUP OP_HASH160 09a7c48f0db7e8b54bf4494c01ed66b99f3216a6 OP_EQUALVERIFY OP_CHECKSIG'
    },
    {
      txid: '3f9e7dea3b89b2619e709c60c6fea5890a0c0657b8dc699ed932dda411259bfe',
      satoshis: 9199870000,
      extradata: 0,
      vout: 1,
      height: 96018,
      script: <Buffer 76 a9 14 09 a7 c4 8f 0d b7 e8 b5 4b f4 49 4c 01 ed 66 b9 9f 32 16 a6 88 ac>,
      asm: 'OP_DUP OP_HASH160 09a7c48f0db7e8b54bf4494c01ed66b99f3216a6 OP_EQUALVERIFY OP_CHECKSIG'
    }
  ],
  total: 9699700000,
  interest: 0,
  nodeheight: 120994,
  filter: 32767,
  CCflag: 0,
  skipcount: 0,
  coinaddr: <Buffer>
}
```

</details>

### `getTxids(peers, address, isCC, skipCount, maxrecords)` 

Returns txos (tx outputs both spent and unspent) for the given address

- **peers**: PeerGroup object, this object is returned by the `nspvConnect` function
- **address**: string, address you want to get transactions for
- **isCC**: boolean, whether to include CC transactions or not
- **skipCount**: number, utxos are sorted descending, how many utxos you want to skip from the start
- **maxrecords**: number


    const { ccutils, networks } = require('@tokel/nspv-js');
    const network = networks.tkltest;
    const response = await ccutils.getTxids(peers, 'myaddress', 0, 0, 0);


<details>
  <summary>Response sample</summary>

</details>

### `pubkey2NormalAddressKmd(mypk)` 

Makes komodo normal address from a pubkey. Mypk - my public key.

    const { ccutils, networks } = require('@tokel/nspv-js');
    const network = networks.tkltest;
    const mynormaladdress = ccutils.pubkey2NormalAddressKmd('mypublickey');

### `getRawTransaction(peers, mypk, txid)` 

Get transaction both in hex and decoded 

### `getTransactionsMany(peers, mypk, args)` 

Get many transactions (in hex), args - JSON array of txids

### getTransactionsManyDecoded(peers, mypk, args)

Get many transactions decoded with extra info on inputs and outputs, args - JSON array of txids
 
e.g. 

```
const { ccutils } = require('@tokel/nspv-js');
const uniqueIds = [
  "69449770e102a1e1fd907900034f47146cbbf3a682a24fa7b088b9e408e951b9",
  "76b63ddd43419320d24662294a154bb5fde96b5b1c8ac6d148e47e72ba9165f8"
];

ccutils.getTransactionsManyDecoded(
    peers,
    network,
    pubkeyBuffer,
    uniqueIds
  );
```


<details>
  <summary>Response sample</summary>

```
{
    "txid": "69449770e102a1e1fd907900034f47146cbbf3a682a24fa7b088b9e408e951b9",
    "recipients": ["RAAF8xJ7Ya9hferR3ibtQDJHBFCXY4CSJE", "RH6VbDu9kzndwZBWR6PHAfntkBM3crKvKK"],
    "senders": ["RH6VbDu9kzndwZBWR6PHAfntkBM3crKvKK"],
    "value": 1000000000,
    "fees": "10000",
    "ins": [
        {
            "hash": Buffer,
            "index": 0,
            "script": Buffer,
            "sequence": 4294967295,
            "witness": [],
            "txid": "e932fdacaa16906e1ad70c4bfe52779094c565cec52c69b3182cbe081cf9f94b",
            "tx": {
                "value": 600000000,
                "script": Buffer,
                "address": "RH6VbDu9kzndwZBWR6PHAfntkBM3crKvKK",
                "asm": "OP_DUP OP_HASH160 55bb0c93f279e815f9b792861e2a21ad18a23fde OP_EQUALVERIFY OP_CHECKSIG"
            }
        },
        {
            "hash": Buffer,
            "index": 0,
            "script": Buffer,
            "sequence": 4294967295,
            "witness": [],
            "txid": "19f0ec147502bdd012d89f471d8a175ea7e689611faaefe26a9eba3d4375b70f",
            "tx": {
                "value": 300000000,
                "script": Buffer,
                "address": "RH6VbDu9kzndwZBWR6PHAfntkBM3crKvKK",
                "asm": "OP_DUP OP_HASH160 55bb0c93f279e815f9b792861e2a21ad18a23fde OP_EQUALVERIFY OP_CHECKSIG"
            }
        },
        {
            "hash": Buffer,
            "index": 0,
            "script": Buffer,
            "sequence": 4294967295,
            "witness": [],
            "txid": "2a145529738c82be0516b3dd6c4229d1a98b946dd6b80f0152da7dcbed0d9f21",
            "tx": {
                "value": 150000000,
                "script": Buffer,
                "address": "RH6VbDu9kzndwZBWR6PHAfntkBM3crKvKK",
                "asm": "OP_DUP OP_HASH160 55bb0c93f279e815f9b792861e2a21ad18a23fde OP_EQUALVERIFY OP_CHECKSIG"
            }
        }
    ],
    "outs": [
        {
            "value": 1000000000,
            "script": Buffer,
            "address": "RAAF8xJ7Ya9hferR3ibtQDJHBFCXY4CSJE",
            "asm": "OP_DUP OP_HASH160 09a7c48f0db7e8b54bf4494c01ed66b99f3216a6 OP_EQUALVERIFY OP_CHECKSIG"
        },
        {
            "value": 49990000,
            "script": Buffer,
            "address": "RH6VbDu9kzndwZBWR6PHAfntkBM3crKvKK",
            "asm": "OP_DUP OP_HASH160 55bb0c93f279e815f9b792861e2a21ad18a23fde OP_EQUALVERIFY OP_CHECKSIG"
        }
    ]
}
```
</details>

### CC Tokens

### CC Tokens Tokel

## Advanced API 

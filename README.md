# Client-side nSPV JavaScript library with Komodo CryptoConditions

A javascript nSPV library for node.js and browsers. Written in javascript with the cryptoconditions (cc) library written in rust and built as a wasm module.

This javascript library allows to develop nSPV clients using Antara (CC) technology.<br>
More info: [Antara Development Docs](http://developers.komodoplatform.com/basic-docs/antara/introduction-to-antara.html)<br>

Released under the terms of the [MIT LICENSE](https://github.com/dimxy/bitgo-komodo-cc-lib/blob/master/LICENSE).

## Why nSPV? 

- It allows easy and quick communication with notarized blockchains. 

- nSPV does not require downloading the whole blockchain in order for it to work.

- It is secure and all transactions are created and signed locally

- There is no 3d party involved. You run an nSPV node, you communicate with the blockchain, you receive data. No one else is involved.

## What is nSPV?

SPV clients are very useful for wallets that dont want the entire blockchain locally, however as the blockchains grow in length, the number of headers required grows linearly. With equihash coins, the header size is 2kb, so this effect becomes quite a large overhead, ie. 2GB per million blocks. Just for the headers!

If we are willing to use the notarizations as a verified blockhash, we can reduce the number of headers required to just the headers that are in the blocks near the utxo in a specific wallet. As little as 10 headers would be needed to get full confirmation on a specific utxo. [Continue reading...](https://medium.com/@jameslee777/nspv-a-simple-approach-to-superlight-clients-leveraging-notarizations-75d7ef5a37a9)

## What can you do with nspv-js?

- Communicate with any chain which supports notarizations to get information on addresses, tokens, transactions, trades, etc.
- Create tokens and nfts
- Send tokens and nfts
- Trade tokens and nfts

## What are use cases for nSPV?

- You are a ticket selling business and want to tokenize your tickets
- You are a game developer and want to have fast seamless and inexpensive transactions within your game where users trade tokenized items. 

### SPV technology

[SPV technology](https://hackernoon.com/spv-proofs-explained-qd1p3r1q)
[Bitcoin Wiki - SPV](https://en.bitcoin.it/wiki/Scalability#Simplified_payment_verification)

### Articles by Jl777 on nSPV

[nSPV a simple approach to superlight clients leveraging notarizations](https://medium.com/@jameslee777/nspv-a-simple-approach-to-superlight-clients-leveraging-notarizations-75d7ef5a37a9)

[nSPV reference cli client](https://medium.com/@jameslee777/nspv-reference-cli-client-cf1ffdc03631)

[libnspv: evolution of nSPV](https://medium.com/@jameslee777/libnspv-evolution-of-nspv-ed157f8b159d)

Komodo docs
[nSPV](https://developers.komodoplatform.com/basic-docs/smart-chains/smart-chain-setup/nspv.html)

## Prerequisites

You can use the library in your node server or in the browser only application.

### Node Server 

1. You need installed:
  - nodejs v.12+<br>

2. You'll need a komodo asset chain to run nspv-js against. Or you can use one of the pre-defined chains in the [networks file](https://github.com/TokelPlatform/nspv-js/blob/development/src/networks.js) of the library. 

  ```
  const { networks } = require('@tokel/nspv-js');  
  const network = networks.tkltest;
  ```

### Browser Only


1. You need installed:
  - nodejs v.12+<br>
  - browserify package<br> 
  - a webserver app (for example, webpack dev server)<br>
  - a wsproxy app (for example, webcoin-bridge)

2. You'll need a komodo asset chain to run bitgo lib against. Or you can use one of the pre-defined chains in the network file in the library. 

  ```
  const { networks } = require('@tokel/nspv-js');  
  const network = networks.tkltest;
  ```

## Installation

### Using npm

```
npm i @tokel/nspv-js
```

### Manual installation

Clone this git repository go to the new dir and checkout `development` branch.

Install the nspv-js dependency packages.

```
npm install
```


## Samples

In the samples folder are included a several examples of CC usage.
1. faucet.js - example of how to create cc faucet and get transactions.
2. normaltx.js - example of how to conduct chain transactions
3. tokens.js  - example of how to run tokensv2 cc functions
4. tokenstokel.js  - example of how to run tokensv2tokel cc functions

To test this you need a komodod chain with cc modules enabled (Note about the correct komodod repo with an nspv patch, see below)

## How to use the test app in the browser:

To run the test app in the browser you will need a webserver to host an html sample page and the test app ccfaucetpocbr.js.
Also you need a websocket proxy to convert websockets into nspv p2p protocol.

### Setting up a web server

I use the webpack dev server running in nodejs.<br>
To setup a webpack sample config make a dir like 'webpack' and create inside it two files with the following content:

package.json:
```
{
  "scripts": {
    "serve": "webpack-dev-server"
  },
  "dependencies": {
    "cryptoconditions-js": "@tokel/cryptoconditions"
  },
  "devDependencies": {
    "webpack": "^4.44.2",
    "webpack-cli": "^3.3.12",
    "webpack-dev-server": "^3.11.0"
  }
}
```

webpack.config.js:
```
const path = require('path');
module.exports = {
  entry: "./ccfaucetpocbr.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "ccfaucetpocbr-bundle.js",
    library: 'myLibrary'
  },
  mode: "development",
  //to serve from any external address (do not add this devServer config to serve only locally):
  devServer: {
    port: 8080,
    host: '0.0.0.0'
  }
};
```
(Both those package.json and webpack.config.js files may be found in webpack-test subdir of bitgo-komodo-cc-lib dir)
Inside the webpack dir run: 
```
npm install
``` 
(ignore printed errors)

Set again the nightly rust version for this repo:
```
rustup default nightly
```

Now go to nspv-js repo dir.<br>
Rebuild sources and build the test app for browser:
```
npm run build
browserify ./samples/ccfaucetpoc.js --standalone faucet -o ccfaucetpocbr.js
```
Copy created ccfaucetpocbr.js into your webpack dir.
Copy the example of an index.html page from the webpack-test dir to your webpack dir.
Inside your webpack dir run the web server with a command:
```
npm run serve
```
The web server should be available at http://localhost:8080 url (if you installed the webpack on the same PC).


### Use the correct komodod version

The last thing is to make sure you run a komodod version with an extension to nSPV getutxos call (it should additionally return script for each utxo).<br>
https://github.com/TokelPlatform/komodo tokel branch

I recommed to run komodod with -debug=net to easily discover wrong magic errors and observe communication dynamic. Basically komodod should print ver/verack and ping/pong exchanges in the debug.log, if connection is okay


## What should happen in the test

When you run the chain, webpack and webcoin-bridge, you might go to the test page url in browser (http://localhost:8080).<br>
It allows first to connect to a peer and then create cc faucet transactions. 


## Info about new and updated packages

Some dependent packages were modified to add support for komodo:
  * bitcoin-protocol

Links to these packages in package.json are updated to load them from forked github repositories (see package.json).  
  
Also added a new package cryptoconditions-js link that currently is loaded from a github repo.


## Original Bitgo-utxo-lib readme
Read the original readme [here](https://github.com/bitgo/bitgo-utxo-lib).

## LICENSE [MIT](https://github.com/dimxy/bitgo-komodo-cc-lib/blob/master/LICENSE)

# BitGo-utxo with Komodo Antara (Cryptoconditions) Support

A javascript Bitcoin library for node.js and browsers. Written in javascript with the cryptoconditions (cc) library written in rust and built as a wasm module.

This javascript library allows to develop nSPV clients using Antara (CC) technology.<br>
More info: [Antara Development Docs](http://developers.komodoplatform.com/basic-docs/antara/introduction-to-antara.html)<br>

Released under the terms of the [MIT LICENSE](https://github.com/dimxy/bitgo-komodo-cc-lib/blob/master/LICENSE).

## Prerequisites

1. You need installed:
  - nodejs v.12+<br>
  
2. If you are going to use this lib in browser you also need:
  - browserify package<br> 
  - a webserver app (for example, webpack dev server)<br>
  - a wsproxy app (for example, webcoin-bridge)

3. You'll need a komodo asset chain to run bitgo lib against.

## Installation

### Using npm

```
npm i @tokel/bitgo-komodo-cc-lib
```

### Manual installation

Clone this git repository go to the new dir and checkout `development` branch.

Install the bitgo-komodo-cc-lib dependency packages, inside the repo dir run:

```
npm install
```


## Basic API  (WIP)

### General

`general.keyToWif(String)` - Receives any string(WIF/seed phrase) and returns WIF.

`general.getSeedPhrase(Number)` - Generates a bip39 mnemonic seed phrase, specify strength 128 or 256 as a parameter.

`general.makeNormalTx(wif, destaddress, amount, network, peers)` - creates and signs transaction locally

### CC Utils

`getNormalUtxos(peers, address, skipCount, maxrecords)` - get normal (non-CC) utxos from an address

`getCCUtxos(peers, address, skipCount, maxrecords)` - get CC utxos  from an address

`getTxids(peers, address, isCC, skipCount, maxrecords)` - returns txos (tx outputs bith spent and unspent) for an address

`createTxAndAddNormalInputs(peers, mypk, amount)` - create a tx and adds normal inputs for equal or more than the amount param 

`pubkey2NormalAddressKmd(pk)` - makes komodo normal address from a pubkey

`getRawTransaction(peers, mypk, txid)` - Get transaction both in hex and decoded 

`getTransactionsMany(peers, mypk, ...args)` - Get many transactions (in hex)

### CC Tokens

### CC Tokens Tokel

## Advanced API 

## Samples

In the samples folder are included a several examples of CC usage.
1. faucet.js - example of how to create cc faucet and get transactions.
2. normaltx.js - example of how to conduct chain transactions
3. tokens.js  - example of how to run tokensv2 cc functions
4. tokenstokel.js  - example of how to run tokensv2tokel cc functions

To test this you need a komodod chain with cc modules enabled (Note about the correct komodod repo with an nspv patch, see below)

### Build test app to run in nodejs

Build the cryptoconditions wasm module:<br>
Setup the rust nightly build to build cryptoconditions:
```
rustup toolchain install nightly
rustup default nightly
```

Change to cryptoconditions-js directory and build the cryptoconditions wasm module for nodejs target:
```
cd ./node_modules/cryptoconditions-js
wasm-pack build -t nodejs
```

Run the testapp in nodejs:
```
node ./ccfaucetpoc.js
```

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
    "cryptoconditions-js": "git+https://github.com/dimxy/cryptoconditions-js.git#master"
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

Change to ./node_modules/cryptoconditions-js subdir and run the following command to build cryptconditions lib wasm for browserify.
```
cd ./node_modules/cryptoconditions-js
wasm-pack build
```

Now go to bitgo-komodo-cc-lib repo dir.<br>
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
Use this komodod branch for this:
https://github.com/dimxy/komodo/tree/nspv-utxo-ext

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

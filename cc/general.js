/** borrowed from https://github.com/pbca26/bitgo-utxo-lib/blob/57f1a95694bbc825d3b055bfec8e0311181b7d2e/samples/cctokenspoc.js#L479 */
const sha = require('sha.js');
const bs58check = require('bs58check');
const bigi = require('bigi');
const bip39 = require('bip39');
const ecpair = require('../src/ecpair');
const p2cryptoconditions = require('./ccbasic.js');
const TransactionBuilder = require('../src/transaction_builder');
const Transaction = require('../src/transaction');
const ccutils = require('./ccutils')
var ccimp = require('../cc/ccimp');   // you will need to do a call like:
                                      // ccbasic.cryptoconditions = await ccimp;
                                      // to init the cryptoconditions wasm lib before cc usage (this is due to wasm delayed loading specifics)
const types = require('../src/types');
const typeforce = require('typeforce');
const BN = require('bn.js')


/**
 * Receives any string(WIF/seed phrase) and returns WIF.
 * @param {string} key
 * @returns
 */
const keyToWif = (key, network) => {
  try {
    bs58check.decode(key);
    return key;
  } catch (e) {
    const hash = sha('sha256').update(key);
    const bytes = hash.digest();

    bytes[0] &= 248;
    bytes[31] &= 127;
    bytes[31] |= 64;

    const d = bigi.fromBuffer(bytes);
    const keyPair = new ecpair(d, null, { network });

    return keyPair.toWIF();
  }
};

const getSeedPhrase = (strength) => bip39.generateMnemonic(strength);

async function create_normaltx(_wif, _destaddress, _satoshi, _network, _peers) {
  let wif = _wif;
  let destaddress = _destaddress;
  let satoshi = _satoshi;
  let network = _network;
  let peers = _peers
  let tx = await makeNormalTx(wif, destaddress, satoshi, network, peers);

  return tx.toHex();
}

async function makeNormalTx(wif, destaddress, amount, network, peers) 
{
  typeforce(types.BN, amount);
  // init lib cryptoconditions
  //ccbasic.cryptoconditions = await ccimp;  // note we need cryptoconditions here bcz it is used in FinalizCCtx o check if a vin is normal or cc 

  const txbuilder = new TransactionBuilder(network);
  const txfee = 10000;
  const amountfee = amount.add(new BN(txfee));

  let mypair = ecpair.fromWIF(wif, network);
  let txwutxos = await ccutils.createTxAndAddNormalInputs(peers, mypair.getPublicKeyBuffer(), amountfee);

  let tx = Transaction.fromBuffer(Buffer.from(txwutxos.txhex, 'hex'), network);

  // zcash stuff:
  txbuilder.setVersion(tx.version);
  if (txbuilder.tx.version >= 3)
    txbuilder.setVersionGroupId(tx.versionGroupId);

  // parse txwutxos.previousTxns and add them as vins to the created tx
  let added = ccutils.addInputsFromPreviousTxns(txbuilder, tx, txwutxos.previousTxns, network);
  if (added.lt(amountfee))
    throw new Error("insufficient normal inputs (" + added.toString() + ")")

  txbuilder.addOutput(destaddress, amount);
  let myaddress = ccutils.pubkey2NormalAddressKmd(mypair.getPublicKeyBuffer());  // pk to kmd address
  const change = added.sub(amountfee);
  txbuilder.addOutput(myaddress, change);  // change

  if (txbuilder.tx.version >= 4)
    txbuilder.setExpiryHeight(tx.expiryHeight);

  ccutils.finalizeCCtx(mypair, txbuilder);  // sign inputs
  return txbuilder.build();
}

exports.keyToWif = keyToWif;
exports.getSeedPhrase = getSeedPhrase;
exports.create_normaltx = create_normaltx;

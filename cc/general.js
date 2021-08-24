/** borrowed from https://github.com/pbca26/bitgo-utxo-lib/blob/57f1a95694bbc825d3b055bfec8e0311181b7d2e/samples/cctokenspoc.js#L479 */
const sha = require('sha.js');
const bs58check = require('bs58check');
const bigi = require('bigi');
var bip39 = require('bip39')

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

const getSeedPhrase = () => bip39.generateMnemonic()

module.exports.keyToWif = keyToWif
module.exports.getSeedPhrase = getSeedPhrase

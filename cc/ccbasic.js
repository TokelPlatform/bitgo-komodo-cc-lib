"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//const networks_1 = require("../src/networks");
const bscript = require("../src/script");
//import * as lazy from './lazy';

const Debug = require('debug')
const logdebug = Debug('cc')

//const ccutils = require('../../cc/ccutils');

//const types = require('../src/types');
//var typeforce = require('typeforce');
//var typeforceNT = require('typeforce/nothrow');

const OPS = require('bitcoin-ops')
const CCOPS = {
    OP_CRYPTOCONDITIONS: 0xCC
};

exports.CCOPS = CCOPS;

/*
// a.input: ccinput
// a.output: cond OP_CRYPTOCONDITIONS
function p2cryptoconditions(a, opts) {
    if (!a.input && !a.output)
        throw new TypeError('Not enough data');
    opts = Object.assign({ validate: true }, opts || {});
    typef({
        network: typef.maybe(typef.Object),
        output: typef.maybe(typef.Buffer),
        input: typef.maybe(typef.Buffer),
    }, a);
    //if (cryptoconditions === undefined)
    //  throw new TypeError('cryptoconditions lib not available');
    /*const _outputChunks = lazy.value(() => {
      return bscript.decompile(a.output!);
    }) as StackFunction;*//*
    const network = a.network || networks_1.bitcoin;
    const o = { name: 'cryptoconditions', network };
    if (a.output) {
        //if (_outputChunks().length != 2 || _outputChunks()[1] != 0xcc)
        //  throw new TypeError('not a cryptoconditions output');
        if (!isSpkPayToCryptocondition(a.output))
            throw new TypeError('not a cryptoconditions output');
    }
    if (a.input) {
        throw new TypeError('check for cryptoconditions input not supported');
    }
    return Object.assign(o, a);
}
exports.p2cryptoconditions = p2cryptoconditions;
*/

/**
 * extracts serialised condition in a scriptPubKey
 * @param {*} spk scriptPubKey
 * @returns serialised condition
 */
function parseCCSpk(spk) {
    //console.log('IsPayToCryptocondition spk=', spk.toString('hex'));

    let condbin
    let opdropdata
    if (Buffer.isBuffer(spk) /*&& spk.length >= 46 && spk[spk.length-1] == 0xcc*/) {
        let chunks = bscript.decompile(spk);
        if (chunks && chunks.length >= 2) {
            if (Buffer.isBuffer(chunks[0]) && chunks[1] == CCOPS.OP_CRYPTOCONDITIONS) {
                condbin = chunks[0];
                //console.log("parseCCSpk condbin=", condbin.toString('hex'));
                if (chunks.length >= 4 && chunks[3] == OPS.OP_DROP)
                    opdropdata = chunks[2];
            }
        }
    }
    return { cc: condbin, opdrop: opdropdata};
}
exports.parseCCSpk = parseCCSpk;

/**
 * reads condition or mixed mode fulfillment from a scriptPubKey
 * @param {*} spk scriptPubKey
 * @returns anon condition or mixed mode fulfilment
 */
function readCCSpk(spk) {
    if (exports.cryptoconditions === undefined)
        throw new Error("cryptoconditions lib not available");
    let condbin = parseCCSpk(spk).cc;
    if (Buffer.isBuffer(condbin) && condbin.length > 0) {
        //logdebug("readCCSpk condbin=", condbin.toString('hex'));
        let cond;
        if (condbin[0] ==  'M'.charCodeAt(0)) { // mixed mode
            //logdebug("readCCSpk sliced=", condbin.slice(1, condbin.length));
            cond = exports.cryptoconditions.js_read_fulfillment_binary_mixed(condbin.slice(1, condbin.length));
        }
        else
            cond = exports.cryptoconditions.js_read_ccondition_binary(Uint8ClampedArray.from(condbin));
        if (cond !== undefined)
            return cond;
    }
    return undefined;
}
exports.readCCSpk = readCCSpk;

/**
 * checks if script is cc scriptPubKey
 * @param {*} script scriptPubKey
 * @returns true if script is cc scriptPubKey
 */
function isSpkPayToCryptocondition(script) {
    if (readCCSpk(script) !== undefined)
        return true;
    else
        return false;
}
exports.isSpkPayToCryptocondition = isSpkPayToCryptocondition;

/**
 * serialises cryptocondition to ASN.1 according to the cc standard
 * @param {*} cond cryptocondition in json
 * @returns serialised condition
 */
function ccConditionBinary(cond) {
    if (exports.cryptoconditions === undefined)
        throw new Error("cryptoconditions lib not available");
    let ccbin = exports.cryptoconditions.js_cc_condition_binary(cond);
    if (ccbin != null)
        return Buffer.from(ccbin);
    return Buffer.from([]);
}
exports.ccConditionBinary = ccConditionBinary;

/**
 * makes scriptPubKey from a cryptocondition and optional opdrop data
 * @param {*} cond cryptocondition
 * @param {*} opDropData script chunk to add as OP_DROP data
 * @returns scriptPubKey
 */
function makeCCSpk(cond, opDropData) {
    if (exports.cryptoconditions === undefined)
        throw new Error("cryptoconditions lib not available");
    let ccbin = exports.cryptoconditions.js_cc_condition_binary(cond);
    //logdebug("makeCCSpk ccbin=", ccbin);
    if (ccbin == null)
        return Buffer.from([]);
    let len = ccbin.length;
    //logdebug('makeCCSpk ccbin=', Buffer.from(ccbin.buffer).toString('hex'));
    if (len > 0) {
        //let spk = Buffer.alloc(len+2);
        //spk[0] = len;  // TODO: should be VARINT here
        //Buffer.from(ccbin.buffer).copy(spk, 1);
        //spk[1+len] = CCOPS.OP_CRYPTOCONDITIONS;
        let spk;
        if (opDropData === undefined)
            spk = bscript.compile([Buffer.from(ccbin), CCOPS.OP_CRYPTOCONDITIONS]);
        else
            spk = bscript.compile([Buffer.from(ccbin), CCOPS.OP_CRYPTOCONDITIONS, opDropData, OPS.OP_DROP]);
        return spk;
    }
    return Buffer.from([]);
}
exports.makeCCSpk = makeCCSpk;

/**
 * serialises condition as ASN.1 in the v2 mixed mode format
 * @param {*} cond condition
 * @returns serialised condition
 */
function ccConditionBinaryV2(cond) {
    if (exports.cryptoconditions === undefined)
        throw new Error("cryptoconditions lib not available");
    let anon = exports.cryptoconditions.js_cc_threshold_to_anon(cond);
    if (anon == null)
        return Buffer.from([]);

    let ccbin = exports.cryptoconditions.js_cc_fulfillment_binary_mixed(anon);
    if (ccbin != null)
        return Buffer.from(ccbin);
    return Buffer.from([]);
}
exports.ccConditionBinaryV2 = ccConditionBinaryV2;

/**
 * makes scriptPubKey from a cryptocondition and optional opdrop data in CC v2 mixed mode format
 * @param {*} cond cryptocondition
 * @param {*} opDropData script chunk to add as OP_DROP data
 * @returns scriptPubKey
 */
function makeCCSpkV2(cond, opDropData) {

    if (exports.cryptoconditions === undefined)
        throw new Error("cryptoconditions lib not available");

    let anon = exports.cryptoconditions.js_cc_threshold_to_anon(cond);
    if (anon == null)
        return Buffer.from([]);

    let ccbin = exports.cryptoconditions.js_cc_fulfillment_binary_mixed(anon);
    //logdebug("makeCCSpkV2 ccbin=", ccbin);
    if (ccbin == null)
        return Buffer.from([]);
    let len = ccbin.length;
    //logdebug('makeCCSpkV2 ccbin=', Buffer.from(ccbin.buffer).toString('hex'));
    if (len > 0) {
        //let spk = Buffer.alloc(len+2);
        //spk[0] = len;  // TODO: should be VARINT here
        //Buffer.from(ccbin.buffer).copy(spk, 1);
        //spk[1+len] = CCOPS.OP_CRYPTOCONDITIONS;
        let spk;
        if (opDropData === undefined)
            // 'M' - prefix indicating a cc version 2 ('mixed mode) follows
            spk = bscript.compile([Buffer.concat([Buffer.from('M'), Buffer.from(ccbin)]), CCOPS.OP_CRYPTOCONDITIONS]); 
        else
            spk = bscript.compile([Buffer.concat([Buffer.from('M'), Buffer.from(ccbin)]), CCOPS.OP_CRYPTOCONDITIONS, opDropData, OPS.OP_DROP]);
        return spk;
    }
    return Buffer.from([]);
}
exports.makeCCSpkV2 = makeCCSpkV2;

/**
 * makes opdrop data in Verus cc format
 * @param {*} evalCode 
 * @param {*} m required signatures to spend
 * @param {*} n total signatures
 * @param {*} vPubKeys pubkey list of signers (n)
 * @param {*} vData 
 * @returns 
 */
function makeOpDropData(evalCode, m, n, vPubKeys, vData) {
    let version = 2; // v2 means support pubkeys in verus data
    let vParams = bscript.compile([version, evalCode, m, n]);
    let opDropArr = [];
    opDropArr.push(vParams);
    if (vPubKeys) {
        vPubKeys.forEach(pk => opDropArr.push(pk));
    }
    if (vData)
        opDropArr.push(vData);
    let opDropData = bscript.compile(opDropArr); //([vParams, vData]);
    return opDropData;
}
exports.makeOpDropData = makeOpDropData;

/**
 * makes scriptSig from a cryptocondition
 * @param {*} cond cryptocondition
 * @returns scriptSig
 */
function makeCCScriptSig(cond) {
    if (exports.cryptoconditions === undefined)
        throw new Error("cryptoconditions lib not available");
    let ffilbin = exports.cryptoconditions.js_cc_fulfillment_binary(cond);
    //console.log("makeCCScriptSig ffilbin=", ffilbin);
    if (ffilbin == null)
        return Buffer.from([]);
    let len = ffilbin.length;
    //console.log('ffilbin=', Buffer.from(ffilbin).toString('hex'));
    if (len > 0) {
        let ffilbinWith01 = Buffer.concat([Buffer.from(ffilbin), Buffer.from([0x01])]);
        /*let scriptSig = Buffer.alloc(len+2);
        scriptSig[0] = len;  // TODO: should be VARINT here
        Buffer.from(ffilbin).copy(scriptSig, 1);
        scriptSig[1+len] = 0x01;*/
        let scriptSig = bscript.compile([ffilbinWith01]);
        //console.log('makeCCScriptSig ccScriptSig=', Buffer.from(scriptSig).toString('hex'));
        return scriptSig;
    }
    return Buffer.from([]);
}
exports.makeCCScriptSig = makeCCScriptSig;

/**
 * reads condition from a scriptSig
 * @param {*} script scripSig
 * @returns cryptocondition
 */
function readCCScriptSig(script) {
    if (Buffer.isBuffer(script)) {
        let chunks = bscript.decompile(script);
        if (chunks && chunks.length == 1) {
            if (Buffer.isBuffer(chunks[0])) {
                let condbin = chunks[0].slice(0, chunks[0].length-1);  // remove trailing 0x01
                let condjson = exports.cryptoconditions.js_read_fulfillment_binary(Uint8ClampedArray.from(condbin));
                return condjson;
            }
        }
    }
    return undefined;
}
exports.readCCScriptSig = readCCScriptSig;



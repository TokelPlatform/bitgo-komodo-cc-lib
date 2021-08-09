"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const networks_1 = require("../networks");
const bscript = require("../script");
//import * as lazy from './lazy';
const typef = require('typeforce');
const OPS = require('bitcoin-ops')
exports.CCOPS = {
    OP_CRYPTOCONDITIONS: 0xCC
};
//import('cryptoconditions-js/pkg/cryptoconditions.js').then((cc)=> cryptoconditions = cc );   // in browser, use 'wasm-pack build' (no any --target). Don't forget run browerify!
//else
//ccimp = require('cryptoconditions-js/pkg/cryptoconditions.js');  // in nodejs, use 'wasm-pack build -t nodejs'
//var ccimp = import('cryptoconditions-js/pkg/cryptoconditions.js'); 
// input: {signature}
// output: {pubKey} OP_CHECKSIG
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
    }) as StackFunction;*/
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
function parseSpkCryptocondition(spk) {
    //console.log('IsPayToCryptocondition spk=', spk.toString('hex'));
    if (Buffer.isBuffer(spk) /*&& spk.length >= 46 && spk[spk.length-1] == 0xcc*/) {
        let chunks = bscript.decompile(spk);
        if (chunks && chunks.length >= 2) {
            if (Buffer.isBuffer(chunks[0]) && chunks[1] == exports.CCOPS.OP_CRYPTOCONDITIONS) {
                let condbin = chunks[0];
                return condbin;
            }
        }
    }
    return Buffer.from([]);
}
exports.parseSpkCryptocondition = parseSpkCryptocondition;
function getSpkCryptocondition(spk) {
    //let cryptoconditions = ccimp;
    if (exports.cryptoconditions === undefined)
        throw new Error("cryptoconditions lib not available");
    let condbin = parseSpkCryptocondition(spk);
    if (Buffer.isBuffer(condbin) && condbin.length > 0) {
        console.log("getSpkCryptocondition condbin=", condbin.toString('hex'));
        let cond;
        if (condbin[0] ==  'M'.charCodeAt(0)) { // mixed mode
            console.log("sliced=", condbin.slice(1, condbin.length));
            cond = exports.cryptoconditions.js_read_fulfillment_binary_mixed(condbin.slice(1, condbin.length));
        }
        else
            cond = exports.cryptoconditions.js_read_ccondition_binary(Uint8ClampedArray.from(condbin));
        if (cond !== undefined)
            return cond;
    }
    return undefined;
}
exports.getSpkCryptocondition = getSpkCryptocondition;
function isSpkPayToCryptocondition(spk) {
    if (getSpkCryptocondition(spk) !== undefined)
        return true;
    else
        return false;
}
exports.isSpkPayToCryptocondition = isSpkPayToCryptocondition;

function ccConditionBinary(cond) {
    //let cryptoconditions = ccimp;
    if (exports.cryptoconditions === undefined)
        throw new Error("cryptoconditions lib not available");
    let ccbin = exports.cryptoconditions.js_cc_condition_binary(cond);
    if (ccbin != null)
        return Buffer.from(ccbin);
    return Buffer.from([]);
}
exports.ccConditionBinary = ccConditionBinary;

function makeCCSpk(cond, opDropData) {
    if (exports.cryptoconditions === undefined)
        throw new Error("cryptoconditions lib not available");
    let ccbin = exports.cryptoconditions.js_cc_condition_binary(cond);
    console.log("ccbin=", ccbin);
    if (ccbin == null)
        return Buffer.from([]);
    let len = ccbin.length;
    //console.log('ccbin=', Buffer.from(ccbin.buffer).toString('hex'));
    if (len > 0) {
        //let spk = Buffer.alloc(len+2);
        //spk[0] = len;  // TODO: should be VARINT here
        //Buffer.from(ccbin.buffer).copy(spk, 1);
        //spk[1+len] = CCOPS.OP_CRYPTOCONDITIONS;
        let spk;
        if (opDropData === undefined)
            spk = bscript.compile([Buffer.from(ccbin), exports.CCOPS.OP_CRYPTOCONDITIONS]);
        else
            spk = bscript.compile([Buffer.from(ccbin), exports.CCOPS.OP_CRYPTOCONDITIONS, opDropData, OPS.OP_DROP]);
        return spk;
    }
    return Buffer.from([]);
}
exports.makeCCSpk = makeCCSpk;

function ccConditionBinaryV2(cond) {
    //let cryptoconditions = ccimp;
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

function makeCCSpkV2(cond, opDropData) {
    if (exports.cryptoconditions === undefined)
        throw new Error("cryptoconditions lib not available");

    let anon = exports.cryptoconditions.js_cc_threshold_to_anon(cond);
    if (anon == null)
        return Buffer.from([]);

    let ccbin = exports.cryptoconditions.js_cc_fulfillment_binary_mixed(anon);
    console.log("ccbin=", ccbin);
    if (ccbin == null)
        return Buffer.from([]);
    let len = ccbin.length;
    //console.log('ccbin=', Buffer.from(ccbin.buffer).toString('hex'));
    if (len > 0) {
        //let spk = Buffer.alloc(len+2);
        //spk[0] = len;  // TODO: should be VARINT here
        //Buffer.from(ccbin.buffer).copy(spk, 1);
        //spk[1+len] = CCOPS.OP_CRYPTOCONDITIONS;
        let spk;
        if (opDropData === undefined)
            spk = bscript.compile([Buffer.concat([Buffer.from('M'), Buffer.from(ccbin)]), exports.CCOPS.OP_CRYPTOCONDITIONS]);
        else
            spk = bscript.compile([Buffer.concat([Buffer.from('M'), Buffer.from(ccbin)]), exports.CCOPS.OP_CRYPTOCONDITIONS, opDropData, OPS.OP_DROP]);
        return spk;
    }
    return Buffer.from([]);
}
exports.makeCCSpkV2 = makeCCSpkV2;

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
    /*let params = Buffer.allocUnsafe(4);
    let bufferWriter1 = new bufferUtils.BufferWriter(params);
  
    bufferWriter1.writeUInt8(version);
    bufferWriter1.writeUInt8(evalCode);
    bufferWriter1.writeUInt8(m);
    bufferWriter1.writeUInt8(n);
  
    let opdrop = Buffer.allocUnsafe(1+4 + varuint.encodingLength(vData.length) + vData.length )
    let bufferWriter2 = new bufferUtils.BufferWriter(opdrop);
    bufferWriter2.writeSlice(params);
    bufferWriter2.writeSlice(vData);*/
    return opDropData;
}
exports.makeOpDropData = makeOpDropData;

function makeCCScriptSig(cond) {
    if (exports.cryptoconditions === undefined)
        throw new Error("cryptoconditions lib not available");
    let ffilbin = exports.cryptoconditions.js_cc_fulfillment_binary(cond);
    //console.log("ffilbin=", ffilbin);
    if (ffilbin == null)
        return Buffer.from([]);
    let len = ffilbin.length;
    console.log('ffilbin=', Buffer.from(ffilbin).toString('hex'));
    if (len > 0) {
        let ffilbinWith01 = Buffer.concat([Buffer.from(ffilbin), Buffer.from([0x01])]);
        /*let scriptSig = Buffer.alloc(len+2);
        scriptSig[0] = len;  // TODO: should be VARINT here
        Buffer.from(ffilbin).copy(scriptSig, 1);
        scriptSig[1+len] = 0x01;*/
        let scriptSig = bscript.compile([ffilbinWith01]);
        console.log('ccScriptSig=', Buffer.from(scriptSig).toString('hex'));
        return scriptSig;
    }
    return Buffer.from([]);
}
exports.makeCCScriptSig = makeCCScriptSig;

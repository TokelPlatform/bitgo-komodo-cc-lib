'use strict'
const { URL } = require('url');
const { parseAddress } = require('./utils.js')

const ADDRSTATE = {
    FREE: 0,
    DISABLED: -1,
    INUSE: 1,
};

class AddrStates {
    constructor(addresses) {
        this.addresses = []
        addresses.forEach(addr => {
            this.addresses.push({ url: parseAddress(addr), lastConnectTime: 0, state: ADDRSTATE.FREE, retries: 0 })
        });
    }

    /**
     * 
     * @param {*} p 
     * @returns added or existing element
     */
    add(p) {
        let url = typeof p === 'string' ? parseAddress(p) : p;
        let found = this.addresses.find((elem) => { return elem.url.href === url.href })
        if (found === undefined) {
            this.addresses.push({ url: url, lastConnectTime: 0, state: ADDRSTATE.FREE, retries: 0 });
            return this.addresses[this.addresses.length - 1];
        }
        return found;
    }

    find(p) {
        let url = typeof p === 'string' ? parseAddress(p) : p;
        return this.addresses.find((elem) => { return elem.url.href === url.href });
    }

    setInUse(p) {
        let url = typeof p === 'string' ? parseAddress(p) : p;
        let elem;
        if ((elem = this.addresses.find((elem) => { return elem.url.href === url.href })) !== undefined) {
            elem.state = ADDRSTATE.INUSE;
            elem.lastConnectTime = Date.now();
            elem.retries = 0;
        }
    }

    setClear(p, err) {
        let url = typeof p === 'string' ? parseAddress(p) : p;
        let elem;
        if ((elem = this.addresses.find((elem) => { return elem.url.href === url.href })) !== undefined) {
            elem.state = ADDRSTATE.FREE;
            elem.failed = !!err;
            if (elem.failed)
                elem.retries++;
        }
    }

    setConnected(p) {
        let url = typeof p === 'string' ? parseAddress(p) : p;
        let elem;
        if ((elem = this.addresses.find((elem) => { return elem.url.href === url.href })) !== undefined) {
            elem.state = ADDRSTATE.INUSE;
            elem.lastConnectTime = Date.now();
            elem.retries = 0;
        }
    }

    setDisabled(p) {
        let url = typeof p === 'string' ? new URL(p) : p;
        let elem;
        if ((elem = this.addresses.find((elem) => { return elem.url.href === url.href })) !== undefined) {
            elem.state = ADDRSTATE.DISABLED;
        }
    }

    freeCount() {
        let freeCount = 0;
        this.addresses.forEach((elem) => {
            if (elem.state === ADDRSTATE.FREE) {
                freeCount++;
            }
        })
        return freeCount;
    }

    findBestAddr() {
        let selected;
        let currentTime = Date.now();
        let maxTimeAfter = 0;

        // first try ones successfully connected ever, less recently
        this.addresses.forEach((a) => {
            if (a.state === ADDRSTATE.FREE && a.lastConnectTime) {
                if (maxTimeAfter < currentTime - a.lastConnectTime) {
                    maxTimeAfter = currentTime - a.lastConnectTime;
                    selected = a.url;
                }
            }
        })
        if (selected === undefined) {
            // now try ones which were never connected (possibly fake ones)
            let minRetries = -1;
            this.addresses.forEach((a) => {
                // pick one with min retries count
                if (a.state === ADDRSTATE.FREE) {
                    if (minRetries < 0 || a.retries < minRetries) {
                        selected = a.url;
                        minRetries = a.retries;
                    }
                }
            })
        }
        return selected !== undefined ? selected.href : null;
    }

    static canUse(addrState) {
        return (addrState !== undefined && addrState.state !== undefined && addrState.state === ADDRSTATE.FREE);
    }
    static isInUse(addrState) {
        return (addrState && addrState.state && addrState.state === ADDRSTATE.INUSE);
    }
}

exports.AddrStates = AddrStates
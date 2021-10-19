
const ADDRSTATE = {
    FREE: 0,
    DISABLED: -1,
    INUSE: 1,
  };

class AddrStates {
    constructor(addresses) {
        this.addresses = []
        addresses.forEach(element => {
            this.addresses.push({ addr: element, lastConnectTime: 0, state: ADDRSTATE.FREE, retries: 0 }) 
        });
    }

    add(addr) {
        let found = this.addresses.find((elem)=>{ return elem.addr===addr }) 
        if (found === undefined)  {
            this.addresses.push({ addr: element, lastConnectTime: 0, state: ADDRSTATE.FREE, retries: 0 });
            return this.addresses[this.addresses.length - 1];
        }
    }

    find(addr) {
        return this.addresses.find((elem)=>{ return elem.addr===addr });
    }

    setInUse(addr)  {
        let elem;
        if ((elem = this.addresses.find((elem)=>{ return elem.addr===addr })) !== undefined)   {
            elem.state = ADDRSTATE.INUSE;
            elem.lastConnectTime = Date.now();
            elem.retries = 0;
        }
    }

    setClear(addr, err)  {
        let elem;
        if ((elem = this.addresses.find((elem)=>{ return elem.addr===addr })) !== undefined)  {
            elem.state = ADDRSTATE.FREE;
            elem.failed = !!err;
            if (elem.failed)
                elem.retries ++;
        }
    }

    setConnected(addr) {
        let elem;
        if ((elem = this.addresses.find((elem)=>{ return elem.addr===addr })) !== undefined)   {
            elem.state = ADDRSTATE.INUSE;
            elem.lastConnectTime = Date.now();
            elem.retries = 0;
        }
    }

    setDisabled(addr) {
        let elem;
        if ((elem = this.addresses.find((elem)=>{ return elem.addr===addr })) !== undefined)  {
            elem.state = ADDRSTATE.DISABLED;
        }
    }

    freeCount()  {
        let freeCount = 0;
        this.addresses.forEach((elem)=>{
          if (elem.state === ADDRSTATE.FREE) {
            freeCount++;
          }
        })
        return freeCount;
    }

    findBestAddr()  {
        let selected;
        let currentTime = Date.now();
        let maxTimeAfter = 0;

        // first try ones successfully connected ever, less recently
        this.addresses.forEach((a)=>{      
            if (a.state === ADDRSTATE.FREE && a.lastConnectTime) {
                if (maxTimeAfter < currentTime - a.lastConnectTime)  {
                    maxTimeAfter = currentTime - a.lastConnectTime;
                    selected = a.addr;
                }
            }
        })
        if (selected === undefined) {
            // now try ones which were never connected (possibly fake ones)
            let minRetries = -1;
            this.addresses.forEach((a)=>{
                // pick one with min retries count
                if (a.state === ADDRSTATE.FREE) {
                    if (minRetries < 0 || a.retries < minRetries)  {  
                    selected = a.addr;
                    minRetries = a.retries;
                    }
                }
            })
        }
        return selected;
    }
}

exports.AddrStates = AddrStates
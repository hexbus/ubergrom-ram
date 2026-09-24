// Shared assembled-code harness. Copyright (c) 2026 hexbus. SPDX-License-Identifier: Apache-2.0
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {createRequire} = require('node:module');
const root = path.resolve(__dirname, '../..');
const bundled = path.join(root, '.deps/js99er-angular');
const checkout = path.resolve(process.env.JS99ER_CHECKOUT || (fs.existsSync(bundled) ? bundled : path.join(root, '../js99er-angular')));
const req = createRequire(path.join(checkout, 'package.json'));
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({module:'commonjs', moduleResolution:'node', target:'es2020'});
require('ts-node/register/transpile-only');
// Replace only browser logging/dialogs. CPU and GROM implementations remain
// the unmodified external sources, and emulator errors still fail the test.
const logPath = req.resolve('./src/app/classes/log.ts');
const log = {info(){},debug(){},warn(){},error(message){throw Error(message);}};
require.cache[logPath] = {id:logPath,filename:logPath,loaded:true,exports:{Log:{getLog:()=>log}}};
const {TMS9900} = req('./src/app/emulator/classes/tms9900.ts');
const {GROMArray} = req('./src/app/emulator/classes/grom-array.ts');

function machine(backend, out, cases=[], options={}) {
    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json')));
    const ram = Buffer.alloc(65536, 0xA7);
    const gram = Buffer.alloc(15*1024, 0x99);
    const consoleGrom = new GROMArray();
    let gaddr = 0, half = false, transactions = [];
    function setAddress(w) {
        gaddr = ((gaddr << 8) | (w >>> 8)) & 65535;
        half = !half;
        consoleGrom.writeAddress(w);
    }
    function physical(port) {
        assert.equal(cpu.getWp(),0x8300,'GROM data transfer uses console scratchpad workspace');
        assert.equal((port & 0x3c) >>> 2, 13, 'Data port must use base 13');
        assert.ok(gaddr >= 0x7900 && gaddr <= 0x98ff, 'GROM data access outside owned buffer');
        const page = gaddr >>> 13;
        const at = (page - 3)*8192 + (gaddr & 8191);
        assert.ok(at >= 0x1900 && at < 0x3900);
        return at;
    }
    function advance() {
        // Mirror Tursi main.c's non-rollover arithmetic, even at >7FFF.
        gaddr = (gaddr & 0xe000) | ((gaddr + 1) & 0x3fff);
        half = false;
    }
    const memory = {
        readWord(addr) {
            addr &= 0xfffe;
            const intercepted = options.readWord?.(addr);
            if (intercepted !== undefined) return intercepted;
            if (addr >= 0x9800 && addr < 0x9840) {
                if (addr & 2) {
                    half = false;
                    // Address reads are destructive in both devices.
                    gaddr = ((gaddr & 255) << 8) | (gaddr & 255);
                    return consoleGrom.readAddress();
                }
                const at = physical(addr), value = gram[at];
                transactions.push(['read', at]);
                consoleGrom.readData(); advance();
                return value << 8;
            }
            // TMS9900 performs a read-before-write for MOVB destinations.
            if (addr >= 0x9c00 && addr < 0x9c40) return 0;
            return ram.readUInt16BE(addr);
        },
        writeWord(addr, word) {
            addr &= 0xfffe; word &= 65535;
            if (options.writeWord?.(addr,word)) return;
            if (addr >= 0x9c00 && addr < 0x9c40) {
                if (addr & 2) { setAddress(word); return; }
                const at = physical(addr);
                transactions.push(['write', at]); gram[at] = word >>> 8;
                consoleGrom.writeData(word); advance(); return;
            }
            assert.ok(!(addr >= 0x6000 && addr < 0x8000) || backend === 'supercart', 'Unexpected CPU cartridge write');
            ram.writeUInt16BE(word, addr);
        },
        getWord(addr) {return ram.readUInt16BE(addr & 0xfffe);}
    };
    const cpu = new TMS9900({getMemory:()=>memory, getCRU:()=>options.cru||({isVDPInterrupt:()=>false,isTimerInterrupt:()=>false})});
    cpu.reset();
    fs.readFileSync(path.join(out, backend, 'library.bin')).copy(ram, 0xa000);
    function call(name, r0, r1=0, r2=0, {status=0xa401, address=0x7123, error=0, workspace=0x8300}={}) {
        const symbols = manifest.backends[backend].symbols;
        ram.writeUInt16BE(0x06a0, 0x2000); // BL @entry
        ram.writeUInt16BE(symbols[name], 0x2002);
        ram.writeUInt16BE(0x10ff, 0x2004);
        for (let i=0;i<16;i++) ram.writeUInt16BE(0xC000+i, workspace+i*2);
        ram.writeUInt16BE(r0,workspace); ram.writeUInt16BE(r1,workspace+2); ram.writeUInt16BE(r2,workspace+4);
        // BL sets R11 before entry; include that expected change in the snapshot.
        ram.writeUInt16BE(0x2004,workspace+22);
        const scratchBefore=Buffer.from(ram.subarray(0x8300,0x8320));
        consoleGrom.readAddress(); setAddress(address & 0xff00); setAddress((address & 255)<<8);
        const savedGrom = consoleGrom.getState();
        transactions = [];
        cpu.restoreState({...cpu.getState(),wp:workspace,pc:0x2000,st:status});
        let steps=0;
        while (cpu.getPc() !== 0x2004 && steps++ < 250000) cpu.run(1);
        assert.equal(cpu.getPc(),0x2004, name+' return');
        assert.equal(cpu.getWp(),workspace, name+' caller workspace');
        assert.equal(cpu.getState().st,status, name+' saved status/interrupt mask');
        for(let i=12;i<16;i++) assert.equal(ram.readUInt16BE(workspace+i*2),0xC000+i,'preserved R'+i);
        assert.equal(ram.readUInt16BE(workspace+22),0x2004,'preserved BL link');
        assert.equal(ram.readUInt16BE(workspace+6),error,name+' status');
        for(let i=0;i<32;i++){
            const at=0x8300+i;
            if(at<workspace||at>=workspace+22)assert.equal(ram[at],scratchBefore[i],'borrowed scratchpad restored');
        }
        const now = consoleGrom.getState();
        assert.equal(now.address,savedGrom.address,name+' GROM address');
        assert.equal(now.prefetch,savedGrom.prefetch,name+' GROM prefetch');
        assert.ok(gram.subarray(0,0x1900).every(x=>x===0x99),'DSR private RAM untouched');
        assert.ok(gram.subarray(0x3900).every(x=>x===0x99),'spare RAM untouched');
        if (backend==='supercart' || error || (r2===0 && ['UGREAD','UGWRIT','UGFILL'].includes(name))) assert.equal(transactions.length,0);
        cases.push({backend,name,address:r0,length:r2,error,workspace});
        return ram.readUInt16BE(workspace+2);
    }
    const buffer = ()=> backend==='ubergrom'?gram.subarray(0x1900,0x3900):ram.subarray(0x6000,0x8000);
    return {call,ram,gram,cpu,buffer};
}


module.exports = {machine,req};

// Execute the assembled library in js99er's TMS9900, not a substitute ABI.
// UberGROM ports use a behavioral model; this is not AVR/electrical testing.
// Copyright (c) 2026 hexbus. SPDX-License-Identifier: Apache-2.0
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {createRequire} = require('node:module');
const root = path.resolve(__dirname, '..');
const out = path.resolve(process.argv[2] || path.join(root, 'build'));
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
const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json')));
const cases = [];

function machine(backend) {
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
    const cpu = new TMS9900({getMemory:()=>memory, getCRU:()=>({isVDPInterrupt:()=>false,isTimerInterrupt:()=>false})});
    cpu.reset();
    fs.readFileSync(path.join(out, backend, 'library.bin')).copy(ram, 0xa000);
    function call(name, r0, r1=0, r2=0, {status=0xa401, address=0x7123, error=0}={}) {
        const symbols = manifest.backends[backend].symbols;
        ram.writeUInt16BE(0x06a0, 0x2000); // BL @entry
        ram.writeUInt16BE(symbols[name], 0x2002);
        ram.writeUInt16BE(0x10ff, 0x2004);
        for (let i=0;i<16;i++) ram.writeUInt16BE(0xC000+i, 0x8300+i*2);
        ram.writeUInt16BE(r0,0x8300); ram.writeUInt16BE(r1,0x8302); ram.writeUInt16BE(r2,0x8304);
        consoleGrom.readAddress(); setAddress(address & 0xff00); setAddress((address & 255)<<8);
        const savedGrom = consoleGrom.getState();
        transactions = [];
        cpu.restoreState({...cpu.getState(),wp:0x8300,pc:0x2000,st:status});
        let steps=0;
        while (cpu.getPc() !== 0x2004 && steps++ < 250000) cpu.run(1);
        assert.equal(cpu.getPc(),0x2004, name+' return');
        assert.equal(cpu.getWp(),0x8300, name+' caller workspace');
        assert.equal(cpu.getState().st,status, name+' saved status/interrupt mask');
        for(let i=12;i<16;i++) assert.equal(ram.readUInt16BE(0x8300+i*2),0xC000+i,'preserved R'+i);
        assert.equal(ram.readUInt16BE(0x8306),error,name+' status');
        const now = consoleGrom.getState();
        assert.equal(now.address,savedGrom.address,name+' GROM address');
        assert.equal(now.prefetch,savedGrom.prefetch,name+' GROM prefetch');
        assert.ok(gram.subarray(0,0x1900).every(x=>x===0x99),'DSR private RAM untouched');
        assert.ok(gram.subarray(0x3900).every(x=>x===0x99),'spare RAM untouched');
        if (backend==='supercart' || error || (r2===0 && ['UGREAD','UGWRIT','UGFILL'].includes(name))) assert.equal(transactions.length,0);
        cases.push({backend,name,address:r0,length:r2,error});
        return ram.readUInt16BE(0x8302);
    }
    const buffer = ()=> backend==='ubergrom'?gram.subarray(0x1900,0x3900):ram.subarray(0x6000,0x8000);
    return {call,ram,gram,cpu,buffer};
}

for (const backend of ['ubergrom','supercart']) {
    const {call,ram,buffer} = machine(backend);
    // Scalar edges, byte convention, endianness and return-state preservation.
    for (const address of [0x6000,0x66ff,0x6700,0x7fff]) {
        call('UGPUTB',address,0x12e5);
        assert.equal(call('UGGETB',address),0xe5);
    }
    for (const status of [0,1,2,0xf40f]) for (const gaddr of [0,0x1fff,0x6000,0x7fff,0x8000,0xffff]) {
        call('UGPUTW',0x7ffe,0x1234,0,{status,address:gaddr});
        assert.equal(call('UGGETW',0x7ffe,0,0,{status,address:gaddr}),0x1234);
        assert.equal(buffer().readUInt16BE(8190),0x1234);
    }
    const pattern = Buffer.from(Array.from({length:8192},(_,i)=>(i*37+(i>>>8))&255));
    pattern.copy(ram,0xc000);
    call('UGWRIT',0x6000,0xc000,8192);
    assert.deepEqual(buffer(),pattern,'full buffer including page crossing');
    call('UGREAD',0x6000,0xe000,8192);
    assert.deepEqual(ram.subarray(0xe000),pattern,'CPU buffer ends at >FFFF');
    call('UGFILL',0x6000,0x55,8192);
    assert.ok(buffer().every(x=>x===0x55));
    for (const [at,ptr,count] of [[0x66fd,0xc001,7],[0x6000,0x3ffd,3],[0x7ffe,0xfffe,2]]) {
        pattern.subarray(0,count).copy(ram,ptr);
        call('UGWRIT',at,ptr,count);
        assert.deepEqual(buffer().subarray(at-0x6000,at-0x6000+count),pattern.subarray(0,count));
        ram.fill(0,ptr,ptr+count);
        call('UGREAD',at,ptr,count);
        assert.deepEqual(ram.subarray(ptr,ptr+count),pattern.subarray(0,count));
    }
    for (const op of ['UGREAD','UGWRIT','UGFILL']) for (const at of [0x6000,0x8000]) call(op,at,0,0);
    const bad = [
        ['UGGETB',0x5fff,0,0,1],['UGPUTB',0x8000,1,0,1],
        ['UGGETW',0x7fff,0,0,1],['UGPUTW',0x6001,0,0,2],
        ['UGREAD',0x7fff,0xc000,2,1],['UGWRIT',0x6000,0xc000,8193,1],
        ['UGFILL',0x8001,0,0,1],['UGFILL',0x6000,0,65535,1],
        ['UGREAD',0x6000,0x3fff,2,3],['UGWRIT',0x6000,0xffff,2,3],
        ['UGREAD',0x6000,0x6000,1,3],['UGWRIT',0x6000,0x9c34,1,3],
        ['UGREAD',0x6000,0x1fff,1,3],['UGWRIT',0x6000,0x83e0,1,3]
    ];
    for (const [name,at,ptr,len,error] of bad) {
        const before=Buffer.from(buffer());
        call(name,at,ptr,len,{error});
        assert.deepEqual(buffer(),before,'Rejected call must not modify buffer');
    }
    // Run the shipped example itself, including its own workspace and library.
    fs.readFileSync(path.join(out,backend,'example.bin')).copy(ram,0xa000);
    const exampleListing = fs.readFileSync(path.join(out,backend,'example.bin.lst'),'utf8');
    const sym = Object.fromEntries([...exampleListing.matchAll(/^\s+([a-z][a-z0-9_]*)\.+\s+>([0-9a-f]{4})\b/gm)].map(m=>[m[1],parseInt(m[2],16)]));
    const example = machine(backend);
    fs.readFileSync(path.join(out,backend,'example.bin')).copy(example.ram,0xa000);
    example.cpu.restoreState({...example.cpu.getState(),pc:0xa000,st:0});
    let steps=0;
    while(example.cpu.getPc()!==sym.done&&steps++<20000)example.cpu.run(1);
    assert.equal(example.cpu.getPc(),sym.done);
    assert.equal(example.ram.readUInt16BE(sym.status),0x600d);
    assert.equal(example.ram.subarray(sym.result,sym.result+sym.msglen).toString(),'HELLO FROM UBERGROM RAM');
    cases.push({backend,name:'shipped-example',error:0});
}
const report = {passed:true,hardware_tested:false,cases:cases.length,details:cases};
fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');
console.log('PASS: '+cases.length+' assembled CPU scenarios, both backends. Hardware not tested.');
process.exit(0);

// Execute the assembled library in js99er's TMS9900, not a substitute ABI.
// UberGROM ports use a behavioral model; this is not AVR/electrical testing.
// Copyright (c) 2026 hexbus. SPDX-License-Identifier: Apache-2.0
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const {machine:makeMachine}=require('./support/machine.cjs');
const out=path.resolve(process.argv[2]||path.join(__dirname,'../build'));
const cases=[];
const machine=backend=>makeMachine(backend,out,cases);

for (const backend of ['ubergrom','supercart']) {
    const {call,ram,buffer} = machine(backend);
    // Hardware regression: callers may keep registers in expansion RAM.
    // Also cover partial overlap with the temporarily borrowed scratchpad.
    for(const workspace of [0xbf00,0xa800,0x83e0,0x8300,0x8302,0x8310,0x82f0]){
        const opts={workspace};
        call('UGPUTW',0x6000,0xa55a,0,opts);
        assert.equal(call('UGGETW',0x6000,0,0,opts),0xa55a);
        call('UGPUTB',0x7fff,0x69,0,opts);
        assert.equal(call('UGGETB',0x7fff,0,0,opts),0x69);
        Buffer.from([0x12,0x34,0x56,0x78]).copy(ram,0xc000);
        call('UGWRIT',0x66fe,0xc000,4,opts);
        call('UGREAD',0x66fe,0xe000,4,opts);
        assert.deepEqual(ram.subarray(0xe000,0xe004),ram.subarray(0xc000,0xc004));
        call('UGFILL',0x6000,0x5a,8192,opts);
        assert.ok(buffer().every(x=>x===0x5a));
        call('UGREAD',0x6000,0xe000,8192,opts);
        assert.ok(ram.subarray(0xe000).every(x=>x===0x5a));
        call('UGREAD',0x8000,0,0,opts);
        call('UGGETW',0x6001,0,0,{workspace,error:2});
        call('UGREAD',0x6000,0x6000,1,{workspace,error:3});
    }
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
console.log('PASS: '+cases.length+' assembled CPU scenarios, both backends. This run uses modeled hardware.');
process.exit(0);

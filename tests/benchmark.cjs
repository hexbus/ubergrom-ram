// Run the actual benchmark with the pinned TMS9900, GROM and TMS9901 models.
// CPU instruction cycles only: no memory wait states or AVR timing are modeled.
// Copyright (c) 2026 hexbus. SPDX-License-Identifier: Apache-2.0
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {machine,req}=require('./support/machine.cjs');
const {Subject}=require('rxjs');
const {CRU}=req('./src/app/emulator/classes/cru.ts');
const out=path.resolve(process.argv[2]||path.join(__dirname,'../build'));
const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json')));
const reports=[];

function run(backend,{overflow=false,badRam=false}={}) {
    let m;
    const cycles=new Subject();
    const cru=new CRU({cyclesPassed:()=>cycles,getCPU:()=>m.cpu,
        getKeyboard:()=>({isKeyDown:()=>false,isAlphaLockDown:()=>false}),
        getTape:()=>({read:()=>0,setMotorOn(){},setAudioGate(){},write(){}})});
    const vram=Buffer.alloc(16384),regs=Buffer.alloc(8);
    let first=null,vaddr=0;
    const options={cru,
        readWord(addr){
            if(addr===0x8c00||addr===0x8c02)return 0;
            if(badRam&&addr===0x9834)return 0;
        },
        writeWord(addr,word){
            const byte=word>>>8;
            if(addr===0x8c02){
                if(first===null)first=byte;
                else{if(byte&0x80)regs[byte&7]=first;else vaddr=((byte&63)<<8)|first;first=null;}
                return true;
            }
            if(addr===0x8c00){vram[vaddr]=byte;vaddr=(vaddr+1)&16383;return true;}
        }
    };
    m=machine(backend==='ubergrom'?'ubergrom':'supercart',out,[],options);
    cru.reset();
    const sym=manifest.benchmarks[backend].symbols;
    fs.readFileSync(path.join(out,backend,'benchmark.bin')).copy(m.ram,0xa000);
    m.cpu.restoreState({...m.cpu.getState(),pc:0xa000,st:0});
    let steps=0,injected=false;
    const counts=Array(8).fill(0),kernelCycles=Array(8).fill(0);
    let startCycle=0;
    while(m.cpu.getPc()!==sym.DONE&&steps++<15000000){
        const pc=m.cpu.getPc();
        if(pc===sym.TBEGIN){
            startCycle=m.cpu.getCycles();
            counts[m.ram.readUInt16BE(sym.TESTNO)/2]++;
            if(overflow&&!injected){cycles.next(64*17000);injected=true;}
        }
        if(pc===sym.TEND)kernelCycles[m.ram.readUInt16BE(sym.TESTNO)/2]+=m.cpu.getCycles()-startCycle;
        const before=m.cpu.getCycles();m.cpu.run(1);cycles.next(m.cpu.getCycles()-before);
    }
    assert.equal(m.cpu.getPc(),sym.DONE,'benchmark must terminate');
    const status=m.ram.readUInt16BE(sym.STATUS);
    const screen=Array.from({length:24},(_,i)=>vram.subarray(i*40,i*40+40).toString('ascii')).join('\n');
    if(overflow){assert.equal(status,0xffff);assert.ok(screen.includes('TIMER OVERFLOW'));}
    else if(badRam){assert.equal(status,0xfffe);assert.ok(screen.includes('DATA CHECK: FAILED'));}
    else{
        assert.equal(status,0x600d);
        assert.ok(screen.includes('DATA CHECK: PASS'));
        assert.deepEqual(counts,Array(8).fill(256));
        for(let i=0;i<8;i++){
            const ticks=m.ram.readUInt32BE(sym.TICKS+i*4);
            assert.ok(ticks>0);
            const displayed=vram.subarray((7+i)*40+25,(7+i)*40+35).toString();
            assert.equal(displayed,String(ticks).padStart(10,' '),'decimal display matches stored total');
        }
        assert.ok(m.gram.subarray(0,0x1900).every(x=>x===0x99));
        assert.ok(m.gram.subarray(0x3900).every(x=>x===0x99));
        fs.writeFileSync(path.join(out,backend,'benchmark-screen.txt'),screen+'\n');
        fs.writeFileSync(path.join(out,backend,'benchmark-vdp.bin'),vram);
    }
    assert.equal(cru.getState().clockRegister,0,'timer stopped');
    assert.equal(cru.getState().timerMode,false,'timer left in I/O mode');
    assert.equal(cru.isTimerInterrupt(),false,'timer IRQ cleared');
    assert.equal(m.cpu.getState().illegalCount,0,'no illegal CPU instructions');
    return {backend,overflow,badRam,status,samples:counts,
        ticks:Array.from({length:8},(_,i)=>m.ram.readUInt32BE(sym.TICKS+i*4)),kernel_instruction_cycles:kernelCycles};
}
for(const backend of ['direct','direct-supercart','supercart','ubergrom'])reports.push(run(backend));
reports.push(run('ubergrom',{overflow:true}));
reports.push(run('ubergrom',{badRam:true}));
fs.writeFileSync(path.join(out,'benchmark-verification.json'),JSON.stringify({passed:true,hardware_tested:false,
    timing_model:'CPU instruction cycles only; excludes bus/GROM/AVR wait states. NOT hardware speed results.',reports},null,2)+'\n');
console.log('PASS: four complete benchmark builds (8192 timed samples), overflow and bad-RAM paths.');
process.exit(0);

// Optional integration with the separately supplied cartridge DSR project.
// Actual CPU + console GPL + unchanged UBE1/CF02 code; modeled ATmega hardware.
// Copyright (c) 2026 hexbus. SPDX-License-Identifier: Apache-2.0
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const [libArg,fixtureArg,repoArg]=process.argv.slice(2);
if(!repoArg)throw Error('Usage: node tests/dsr-coexistence.cjs LIBRARY_BUILD FIXTURE DSR_REPO');
const lib=path.resolve(libArg),out=path.resolve(fixtureArg),repo=path.resolve(repoArg);
const reportPath=path.join(out,'coexistence-verification.json');
if(fs.existsSync(reportPath))throw Error('Existing verification protected; make a new fixture.');
const {xdt99}=require(path.join(repo,'tests/support/repo-paths.cjs'));
const {ramMachine}=require(path.join(repo,'tests/support/eeprom-model.cjs'));
const fixture=JSON.parse(fs.readFileSync(path.join(out,'fixture.json')));
const library=JSON.parse(fs.readFileSync(path.join(lib,'manifest.json')));
const labels=library.backends.ubergrom.symbols;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const image=fs.readFileSync(path.join(out,'blank.eeprom-model.bin'));
const originalImage=Buffer.from(image);
const gram=Buffer.alloc(15360,0x99);
const grom=fs.readFileSync(path.join(out,fixture.grom_file));
const rom=fs.readFileSync(path.join(out,'rom512k.bin'));
const expectedROM=fs.readFileSync(path.join(out,'rom-pattern.bin'));
const expectedRecords=fs.readFileSync(path.join(out,'rom-records.bin'));
const binary=fs.readFileSync(path.join(lib,'ubergrom/library.bin'));
assert.equal(sha(binary),library.sha256['ubergrom/library.bin']);
const probe=`       GROM >6000
       AORG 0
       DATA >AA01,0,0,PROG,0,0,0,0
PROG   DATA 0,START
       STRI 'RAM DSR TEST'
START  ST >A5,V@>01F0
WAIT   CZ V@>01F1
       BS WAIT
       CLR V@>01F0
       CLR V@>01F1
       DST >0209,@>8356
       CALL >0010
       BYTE >08
       B START
       END
`;
fs.writeFileSync(path.join(out,'caller.gpl'),probe);
execFileSync('python',[path.join(xdt99,'xga99.py'),path.join(out,'caller.gpl'),'-o',path.join(out,'caller.bin'),'-E',path.join(out,'caller.equ')]);
const waitAddress=parseInt(fs.readFileSync(path.join(out,'caller.equ'),'utf8').match(/WAIT:\s+EQU\s+>([0-9a-f]+)/i)[1],16);
fs.readFileSync(path.join(out,'caller.bin')).copy(grom);
const m=ramMachine(grom,rom,image,{ubergromRam:gram,configuredFlash:true});
m.memory.settings.setRAM('32K');m.memory.reset(true);m.cpu.reset();m.cru.reset();
// js99er's memory dispatcher selects the device using the incremented GROM
// counter. At >7FFF the console counter has wrapped to >6000, so it wrongly
// discards the cartridge's final byte. Select DATA by the prefetched address;
// retain the original address-port behavior and both devices' side effects.
// This adapter correction does not replace the library or DSR read routines.
let pageEdgeReads=0,atWait=false;
m.memory.readGROM=function(addr,cpu){
    const counter=this.grom.getAddress(),data=(addr&2)===0;
    const address=data?((counter&0xe000)|((counter-1)&0x1fff)):counter;
    cpu.addCycles(17);
    if(data)cpu.addCycles(6);
    const consoleValue=data?this.grom.readData():this.grom.readAddress();
    const cartValue=this.cartridge.readGROM(addr);
    if(data&&address===waitAddress)atWait=true;
    if(data&&counter===0x6000)pageEdgeReads++;
    return (data?address>=0x6000:counter>=0x6001)?cartValue:consoleValue;
};
m.memory.buildMemoryMap();
m.frames(120);m.key('Space');m.frames(120);m.key('Digit2');
for(let i=0;i<2000&&m.vdp.ram[0x1f0]!==0xa5;i++)m.frames(1);
assert.equal(m.vdp.ram[0x1f0],0xa5,'Console GPL caller boot');
function pauseCaller(){
    // A frame can end between the two address-port bytes. Pause after the
    // caller's WAIT opcode fetch, where no GROM address transaction is partial.
    atWait=false;
    let steps=0;while(!atWait&&steps++<10000)m.cpu.run(1);
    assert.ok(atWait,'Reached GPL caller at a complete GROM transaction');
    assert.equal(m.memory.grom.getState().access,2);
}
pauseCaller();
const put=(addr,bytes)=>m.memory.loadRAM(addr,bytes);
const get=(addr,n)=>Buffer.from(Array.from({length:n},(_,i)=>m.memory.getByte(addr+i)));
put(0xa000,binary);
const cases=[];
let pattern=Buffer.alloc(8192,0x99),appHigh=0,dsrHigh=0;

// Enter the real CPU library between completed GPL operations. The harness
// saves only CPU execution state; it NEVER repairs scratchpad, GROM address,
// cartridge bank, DSR RAM, application RAM, or EEPROM after a library call.
function ramCall(name,address,value=0,length=0,error=0){
    const cpu=m.cpu.getState(),scratch=get(0x8300,256),privateRAM=Buffer.from(gram.subarray(0,6400));
    const beforeEEPROM=Buffer.from(image),bank=m.cart.getState().currentBank;
    const savedGrom=m.memory.grom.getState(),savedCart=m.cart.gromBases[0].getState();
    const eventStart=m.events.length;
    const stub=Buffer.alloc(6);stub.writeUInt16BE(0x06a0);stub.writeUInt16BE(labels[name],2);stub.writeUInt16BE(0x10ff,4);put(0x2000,stub);
    for(let r=0;r<16;r++)m.memory.writeWord(0x2200+r*2,0xC000+r,m.cpu);
    for(const [r,v] of [[0,address],[1,value],[2,length]])m.memory.writeWord(0x2200+r*2,v,m.cpu);
    m.cpu.restoreState({...cpu,pc:0x2000,wp:0x2200,st:0});
    let steps=0;while(m.cpu.getPc()!==0x2004&&steps++<250000)m.cpu.run(1);
    assert.equal(m.cpu.getPc(),0x2004,'Library returned');
    assert.equal(m.memory.getWord(0x2206),error,name+' result');
    const result=m.memory.getWord(0x2202);
    assert.equal(m.cpu.getWp(),0x2200);assert.equal(m.cpu.getState().st,0);
    for(let r=12;r<16;r++)assert.equal(m.memory.getWord(0x2200+r*2),0xC000+r);
    assert.equal(m.memory.grom.getAddress(),savedGrom.address,'Console GROM address restored by library');
    assert.equal(m.memory.grom.getState().prefetch,savedGrom.prefetch,'Console prefetch restored; state '+JSON.stringify({pc:cpu.pc,counter:savedGrom.address,access:savedGrom.access}));
    assert.equal(m.cart.gromBases[0].getAddress(),savedCart.address,'Cartridge GROM address restored');
    assert.equal(m.cart.gromBases[0].getState().prefetch,savedCart.prefetch,'Cartridge prefetch restored');
    assert.equal(m.cart.gromBases[0].getState().access,2,'No partial cartridge address transaction');
    assert.equal(m.cart.getState().currentBank,bank,'CPU ROM bank preserved');
    assert.deepEqual(get(0x8300,256),scratch,'Library did not alter GPL scratchpad');
    assert.deepEqual(gram.subarray(0,6400),privateRAM,'Library preserved live DSR buffer/handles');
    assert.deepEqual(image,beforeEEPROM,'Library never writes EEPROM');
    for(const e of m.events.slice(eventStart))if(e.kind==='ram-write'){
        assert.ok(e.address>=0x1900&&e.address<0x3900,'Library RAM ownership');appHigh=Math.max(appHigh,e.address);
    }
    assert.ok(gram.subarray(0x3900).every(x=>x===0x99),'Spare 768 bytes untouched');
    m.cpu.restoreState(cpu);
    cases.push({kind:'library',name,address,length,error});
    return result;
}
function verifyBuffer(){
    assert.deepEqual(gram.subarray(0x1900,0x3900),pattern,'Physical application buffer before read');
    ramCall('UGREAD',0x6000,0xc000,8192);
    const actual=get(0xc000,8192);
    const differences=Array.from(pattern.keys()).filter(i=>actual[i]!==pattern[i]);
    assert.equal(differences.length,0,'Full application buffer via ABI; mismatches: '+differences.slice(0,10).map(i=>i.toString(16)+':'+actual[i]+'/'+pattern[i]).join(','));
    assert.deepEqual(gram.subarray(0x1900,0x3900),pattern,'Physical application buffer');
}
function dsr(name,{op=0,flags=0,reclen=0,count=0,record=0,payload,expected,error=0,buffer=0x1000}={}){
    const eventStart=m.events.length;
    const pab=Buffer.alloc(64);pab[0]=op;pab[1]=flags;pab.writeUInt16BE(buffer,2);
    pab[4]=reclen;pab[5]=count;pab.writeUInt16BE(record,6);pab[9]=name.length;pab.write(name,10,'ascii');
    m.vdp.ram.set(pab,0x200);if(payload)m.vdp.ram.set(payload,buffer);
    m.vdp.ram[0x1f0]=0;m.vdp.ram[0x1f1]=1;
    let frames=0;while(m.vdp.ram[0x1f0]!==0xa5&&frames++<20000)m.frames(1);
    assert.equal(m.vdp.ram[0x1f0],0xa5,'DSR returned: '+name);
    pauseCaller();
    const result=Buffer.from(m.vdp.ram.subarray(0x200,0x240));
    assert.equal(result[1]>>>5,error,name+' opcode '+op);
    if(expected)assert.deepEqual(Buffer.from(m.vdp.ram.subarray(buffer,buffer+expected.length)),expected,name+' payload');
    assert.deepEqual(image.subarray(0,258),originalImage.subarray(0,258),'Configuration preserved');
    assert.equal(m.getLock(),1,'EEPROM relocked');
    assert.equal(m.memory.getWord(0x83fa),0x9800,'Caller base restored');
    for(const e of m.events.slice(eventStart))if(e.kind==='ram-write'){
        assert.ok(e.address<6400,'DSR did not write application allocation');dsrHigh=Math.max(dsrHigh,e.address);
    }
    cases.push({kind:'dsr',name,op,flags,error,frames});
    verifyBuffer();
    return result;
}
function newPattern(seed){
    pattern=Buffer.from(Array.from({length:8192},(_,i)=>(i*37+(i>>>8)*11+seed)&255));
    put(0xc000,pattern);ramCall('UGWRIT',0x6000,0xc000,8192);verifyBuffer();
}
function catalog(names){
    dsr('UBE1.',{op:11,buffer:0x3000});
    const bytes=Buffer.from(m.vdp.ram.subarray(0x3000,0x3220));
    assert.equal(bytes.subarray(0,4).toString(),'UBF1');
    assert.equal(bytes[9],names.length);
    for(const name of names)assert.ok(bytes.includes(Buffer.from(name)),name+' catalogued');
}

newPattern(7);
// Persistent sentinel represents a pre-existing save in this disposable image.
const sentinel=Buffer.from('PRESERVE THIS EXISTING SAVE');
dsr('UBE1.KEEP',{op:6,record:sentinel.length,payload:sentinel});
for(const seed of [19,173]){
    newPattern(seed);
    dsr('ROM1.PATTERN',{op:5,record:8192,expected:expectedROM});
    dsr('ROM1.RECORDS',{flags:4,reclen:80});
    dsr('UBE1.TEMP',{flags:0x12,reclen:80});
    // Four library operations through an open UBE1 output and CF02 input.
    for(let n=0;n<4;n++){
        const record=expectedRecords.subarray(n*80,(n+1)*80);
        dsr('ROM1.RECORDS',{op:2,flags:4,expected:record});
        put(0xe000,record);ramCall('UGWRIT',0x66f0,0xe000,80);
        record.copy(pattern,0x6f0);verifyBuffer();
        ramCall('UGREAD',0x66f0,0xe100,80);
        dsr('UBE1.TEMP',{op:3,flags:0x12,count:80,payload:get(0xe100,80)});
    }
    dsr('UBE1.TEMP',{op:1,flags:0x12});dsr('ROM1.RECORDS',{op:1,flags:4});
    dsr('UBE1.TEMP',{flags:0x14});
    for(let n=0;n<4;n++){
        ramCall('UGPUTW',0x7ffe,seed*257);pattern.writeUInt16BE(seed*257,8190);
        assert.equal(ramCall('UGGETW',0x7ffe),seed*257);
        dsr('UBE1.TEMP',{op:2,flags:0x14,expected:expectedRecords.subarray(n*80,(n+1)*80)});
    }
    dsr('UBE1.TEMP',{op:2,flags:0x14,error:5});dsr('UBE1.TEMP',{op:1,flags:0x14});
    // PROGRAM saves use payload bytes read back through the library.
    ramCall('UGREAD',0x6700,0xe000,256);const program=get(0xe000,256);
    dsr('UBE1.PROGRAM',{op:6,record:256,payload:program});
    dsr('UBE1.PROGRAM',{op:5,record:256,expected:program});
    catalog(['KEEP','TEMP','PROGRAM']);
    dsr('UBE1.KEEP',{op:5,record:sentinel.length,expected:sentinel});
    dsr('UBE1.TEMP',{op:7});dsr('UBE1.PROGRAM',{op:7});catalog(['KEEP']);
    dsr('ROM1.MISSING',{op:5,record:64,error:7});
    ramCall('UGPUTW',0x7fff,0x1234,0,1);verifyBuffer();
}
dsr('UBE1.KEEP',{op:5,record:sentinel.length,expected:sentinel});
catalog(['KEEP']);
assert.ok(pageEdgeReads>0,'Exercised the GROM page-edge dispatcher correction');
const report={passed:true,hardware_tested:false,
    evidence:'TMS9900 emulator executes the CPU library, console GPL and unchanged development DSR; ATmega RAM/EEPROM are modeled.',
    source_components:fixture.source_components,library_sha256:sha(binary),
    dsr_operations:cases.filter(x=>x.kind==='dsr').length,library_calls:cases.filter(x=>x.kind==='library').length,
    highest_dsr_ram_write:dsrHigh,highest_library_ram_write:appHigh,eeprom_writes:m.getWrites(),
    page_edge_reads:pageEdgeReads,
    emulator_revision:execFileSync('git',['-C',m.checkout,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    hardware_model_sha256:sha(fs.readFileSync(path.join(repo,'tests/support/eeprom-model.cjs'))),
    protected_configuration_unchanged:true,spare_bytes_unchanged:768,sentinel_preserved:true,cases};
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
console.log('PASS:',report.dsr_operations,'DSR operations and',report.library_calls,'library calls; same live RAM.');
process.exit(0);

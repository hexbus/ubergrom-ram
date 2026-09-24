// Boot the actual E/A cartridge and launch the kit programs through option 5.
// Copyright (c) 2026 hexbus. SPDX-License-Identifier: Apache-2.0
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const crypto=require('node:crypto');
const [kitArg,repoArg,libArg]=process.argv.slice(2);
if(!libArg)throw Error('Usage: node tests/hardware-kit.cjs KIT DSR_REPO LIBRARY_BUILD');
const kit=path.resolve(kitArg),repo=path.resolve(repoArg),lib=path.resolve(libArg);
const output=path.join(kit,'hardware-kit-verification.json');
if(fs.existsSync(output))throw Error('Existing report protected');
const {ramMachine}=require(path.join(repo,'tests/support/eeprom-model.cjs'));
const build=JSON.parse(fs.readFileSync(path.join(kit,'kit-build.json')));
const lm=JSON.parse(fs.readFileSync(path.join(lib,'manifest.json')));
const flash=fs.readFileSync(path.join(kit,'ea/ea-atmega1284p-flash.bin'));
const rom=fs.readFileSync(path.join(kit,'ea/ea-rom512k.bin'));
const blank=fs.readFileSync(path.join(kit,'ea/ea-atmega1284p-eeprom.bin'));
const results=[];
let savedVolume;
function run(name,{badRam=false,existing=false}={}){
    if(existing)assert.ok(savedVolume,'Captured a real UBE1 file before deletion');
    const original=Buffer.from(existing?savedVolume:blank);
    const image=Buffer.from(original),gram=Buffer.alloc(15360,0x99),calls=[];
    const m=ramMachine(flash.subarray(0,0x1e000),rom,image,{configuredFlash:true,ubergromRam:gram});
    m.memory.settings.setRAM('32K');m.memory.reset(true);m.cpu.reset();m.cru.reset();
    const sym=name==='RAMTEST'?build.ramtest_symbols:lm.benchmarks[name==='UGBENCH'?'ubergrom':'direct'].symbols;
    let libraryPortAccesses=0;
    let bridgeSnapshot=null,bridgeReturn=0,bridgeReturns=0;
    const progress=[];
    const scratch=()=>Buffer.from(Array.from({length:256},(_,i)=>{
        const word=m.memory.getWord(0x8300+(i&~1));
        return i&1?word&255:word>>>8;
    }));
    const execute=m.cpu.execute.bind(m.cpu);
    m.cpu.execute=function(instruction){
        const pc=(this.getPc()-2)&65535;
        if(name==='RAMTEST'){
            if(bridgeSnapshot&&pc===bridgeReturn){
                assert.deepEqual(scratch(),bridgeSnapshot,'Test bridge restores all console scratchpad');
                bridgeSnapshot=null;bridgeReturns++;
            }
            if(pc===sym.BRIDGE){
                bridgeSnapshot=scratch();bridgeReturn=m.memory.getWord(0xbe1c);
                const screen=m.screen();
                assert.ok(screen.includes('FILE CALL:'),'Live file operation displayed before bridge entry');
                assert.ok(screen.includes('STAGE:'),'Live stage displayed');
                progress.push({stage:m.memory.getWord(sym.STAGE),screen});
            }
        }
        return execute(instruction);
    };
    function checkBridgePort(port){
        const pc=m.cpu.getPc();
        if(name==='RAMTEST'&&pc>=sym.BRIDGE&&pc<0xbe00){
            assert.ok(port!==0x9838&&port!==0x9c38,'Test bridge must not transfer private GROM RAM');
            // Hardware-tested TEST 2 uses expansion registers for address-only
            // transactions. Its scratchpad backup uses CPU RAM, never GROM data.
        }
    }
    function checkLibraryWorkspace(){
        const pc=m.cpu.getPc();
        if(sym.UGGETB!==undefined&&pc>=sym.UGGETB&&pc<sym.UGEND){
            assert.equal(m.cpu.getWp(),0x8300,'Library GROM I/O uses scratchpad registers');
            libraryPortAccesses++;
        }
    }
    const cartridgeWrite=m.cart.writeGROM.bind(m.cart);
    m.cart.writeGROM=function(port,word){checkBridgePort(port);checkLibraryWorkspace();return cartridgeWrite(port,word);};
    // Same final-prefetched-byte dispatcher correction as dsr-coexistence.cjs.
    m.memory.readGROM=function(addr,cpu){
        checkBridgePort(addr);
        checkLibraryWorkspace();
        const counter=this.grom.getAddress(),data=(addr&2)===0;
        const address=data?((counter&0xe000)|((counter-1)&0x1fff)):counter;
        if(data&&address===0x10){
            const ptr=this.getWord(0x8356),pab=ptr-9;
            calls.push({op:m.vdp.ram[pab],name:Buffer.from(m.vdp.ram.subarray(ptr+1,ptr+1+m.vdp.ram[ptr])).toString()});
            if(name==='RAMTEST'&&!badRam&&!existing&&m.vdp.ram[pab]===7)savedVolume=Buffer.from(image);
        }
        cpu.addCycles(17);if(data)cpu.addCycles(6);
        const cv=data?this.grom.readData():this.grom.readAddress();
        const value=this.cartridge.readGROM(addr);
        if(badRam&&addr===0x9834)return 0;
        return(data?address>=0x6000:counter>=0x6001)?value:cv;
    };
    m.memory.buildMemoryMap();
    m.frames(120);m.key('Space');m.frames(120);m.key('Digit2');m.frames(180);
    assert.ok(m.screen().includes('EDITOR/ASSEMBLER'),'E/A menu boot');
    m.key('Digit5');m.type('ROM1.'+name+'\n');
    let frames=0;while(m.cpu.getPc()!==sym.DONE&&frames++<4000)m.frames(1);
    const screen=m.screen();
    fs.writeFileSync(path.join(kit,`screen-${name}${badRam?'-badram':existing?'-existing':''}.txt`),screen);
    assert.equal(m.cpu.getPc(),sym.DONE,screen+'\nCalls: '+JSON.stringify(calls));
    assert.deepEqual(image.subarray(0,258),blank.subarray(0,258),'Configuration unchanged');
    assert.equal(m.getLock(),1);
    assert.ok(gram.subarray(0x3900).every(x=>x===0x99),'Unused RAM intact');
    if(existing){
        assert.ok(screen.includes('STOP: CHECK'));
        assert.equal(m.getWrites(),0);assert.deepEqual(image,original);
        assert.ok(!calls.some(c=>[6,7].includes(c.op)));
    }else if(badRam){
        assert.ok(screen.includes('FAILED'));assert.equal(m.memory.getWord(sym.STAGE),2);
        assert.equal(m.getWrites(),0);
    }else{
        assert.equal(m.memory.getWord(sym.STATUS),0x600d,screen);
        assert.ok(screen.includes('PASS'),screen);
        if(name==='RAMTEST'){
            for(const op of [5,6,7])assert.ok(calls.some(c=>c.name==='UBE1.UGRAMT1'&&c.op===op));
            assert.ok(calls.some(c=>c.name==='ROM1.RAMDATA'&&c.op===5));
        }else assert.equal(m.getWrites(),0);
    }
    if(!existing&&name!=='CPUBENCH')assert.ok(libraryPortAccesses>0);
    if(name==='RAMTEST'){
        assert.ok(screen.includes('DSR TEST 2'),'Build the hardware-tested diagnostic');
        assert.ok(bridgeReturns>0);assert.equal(bridgeSnapshot,null);
        assert.ok(screen.includes('TEST FINISHED'));
    }
    results.push({name,badRam,existing,passed:true,libraryPortAccesses,bridgeReturns,progress,eeprom_writes:m.getWrites(),calls,screen});
    console.log('PASS',name,badRam?'bad RAM':existing?'existing-file guard':'normal');
}
run('RAMTEST');run('RAMTEST',{badRam:true});run('RAMTEST',{existing:true});
run('UGBENCH');run('CPUBENCH');
fs.writeFileSync(output,JSON.stringify({passed:true,hardware_tested:false,
    tested_images:Object.fromEntries(['ea/ea-atmega1284p-flash.bin','ea/ea-rom512k.bin',
        'ea/ea-atmega1284p-eeprom.bin'].map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(kit,name))).digest('hex')])),
    evidence:'Actual E/A option 5 launches with CPU/console GPL and modeled ATmega hardware. Timer values are not hardware measurements.',results},null,2)+'\n');
process.exit(0);

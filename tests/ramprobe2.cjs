// Exercise the diagnostic display and failure reporting through E/A option 5.
// Copyright (c) 2026 hexbus. SPDX-License-Identifier: Apache-2.0
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const [outArg,repoArg]=process.argv.slice(2),out=path.resolve(outArg),repo=path.resolve(repoArg);
const plan=JSON.parse(fs.readFileSync(path.join(out,'probe-build.json'))),sym=plan.symbols;
const kit=plan.source_kit;
const {ramMachine}=require(path.join(repo,'tests/support/eeprom-model.cjs'));
const flash=fs.readFileSync(path.join(kit,'ea/ea-atmega1284p-flash.bin'));
const blank=fs.readFileSync(path.join(kit,'ea/ea-atmega1284p-eeprom.bin'));
const rom=fs.readFileSync(path.join(out,plan.rom_file));
const report=path.join(out,'probe-verification.json');
if(fs.existsSync(report))throw Error('Existing report protected');
const results=[];
for(const fault of ['none','stored-byte','changing-read','external-workspace']){
    const badRam=fault!=='none';
    const ee=Buffer.from(blank),gram=Buffer.alloc(15360,0x99);
    const m=ramMachine(flash.subarray(0,0x1e000),rom,ee,{configuredFlash:true,ubergromRam:gram});
    m.memory.settings.setRAM('32K');m.memory.reset(true);m.cpu.reset();m.cru.reset();
    let changingHits=0;
    // Existing adapter correction: select the device by the prefetched byte's
    // address, including the final byte of an 8K page. AVR is still modeled.
    m.memory.readGROM=function(addr,cpu){
        const counter=this.grom.getAddress(),data=(addr&2)===0;
        const address=data?((counter&0xe000)|((counter-1)&0x1fff)):counter;
        cpu.addCycles(17);if(data)cpu.addCycles(6);
        const cv=data?this.grom.readData():this.grom.readAddress();
        const value=this.cartridge.readGROM(addr);
        if(addr===0x9834&&address===0x790d){
            if(fault==='changing-read'){
                changingHits++;
                if(changingHits%2===1)return value^0x8800;
            }
            if(fault==='external-workspace'&&m.cpu.getWp()===0xbf00)return value^0x8000;
        }
        return(data?address>=0x6000:counter>=0x6001)?value:cv;
    };
    let privateBefore,scratchBefore;
    const write=m.cart.writeGROM.bind(m.cart);
    m.cart.writeGROM=function(port,word){
        if(port===0x9c34){
            if(!privateBefore){
                privateBefore=Buffer.from(gram.subarray(0,0x1900));
                scratchBefore=Array.from({length:16},(_,i)=>m.memory.getWord(0x8300+i*2));
            }
            const counter=this.gromBases[0].getAddress();
            const address=(counter&0xe000)|((counter-1)&0x1fff);
            assert.ok(address>=0x7900&&address<=0x98ff,'Write confined to ABI allocation');
        }
        const result=write(port,word);
        if(port===0x9c34&&fault==='stored-byte')gram[0x190d]=0xb2;
        return result;
    };
    m.memory.buildMemoryMap();
    m.frames(120);m.key('Space');m.frames(120);m.key('Digit2');m.frames(180);
    assert.ok(m.screen().includes('EDITOR/ASSEMBLER'));
    m.key('Digit5');m.type('ROM1.RAMPROBE2\n');
    let frames=0;while(m.cpu.getPc()!==sym.DONE&&frames++<4000)m.frames(1);
    assert.equal(m.cpu.getPc(),sym.DONE);
    const screen=m.screen();
    console.log(screen);
    assert.deepEqual(ee,blank,'No EEPROM changes');assert.equal(m.getWrites(),0);
    assert.ok(gram.subarray(0x3900).every(x=>x===0x99),'Spare RAM intact');
    assert.ok(privateBefore);assert.deepEqual(gram.subarray(0,0x1900),privateBefore,'DSR private RAM intact');
    assert.deepEqual(Array.from({length:16},(_,i)=>m.memory.getWord(0x8300+i*2)),scratchBefore,'Scratchpad workspace restored');
    const records=[];
    for(let mode=0;mode<4;mode++){
        const r=Array.from({length:8},(_,i)=>m.memory.getWord(sym.RESULT+mode*16+i*2));
        records.push(r);
        const fail=fault!=='none'&&!(fault==='external-workspace'&&mode===1);
        assert.deepEqual(r.slice(0,4), fail?
            [1,fault==='changing-read'?0:1,fault==='changing-read'?1:0,0x600d]:[0,0,0,0xffff]);
        if(fail){assert.equal(r[4],0x3a);assert.equal(r[5],fault==='external-workspace'?0xba:0xb2);}
        assert.equal(r[6],0,'ABI status success');
    }
    assert.ok(screen.includes('DONE - PHOTOGRAPH'));
    assert.ok(!screen.includes('RUNNING'),'Completed rows cleared before results');
    assert.ok(!screen.includes('0000E'),'No leftover progress text between columns');
    fs.writeFileSync(path.join(out,`screen-${fault}.txt`),screen);
    fs.writeFileSync(path.join(out,`screen-${fault}.vram`),m.vdp.ram);
    results.push({fault,records,passed:true,screen,eeprom_writes:m.getWrites()});
}
fs.writeFileSync(report,JSON.stringify({passed:true,hardware_tested:false,
    tested_rom_sha256:require('node:crypto').createHash('sha256').update(rom).digest('hex'),
    evidence:'TMS9900 execution, console GPL, E/A option 5; ATmega ports modeled.',results},null,2)+'\n');
process.exit(0);

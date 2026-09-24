// Exercise the diagnostic display and failure reporting through E/A option 5.
// Copyright (c) 2026 hexbus. SPDX-License-Identifier: Apache-2.0
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const [outArg,repoArg]=process.argv.slice(2),out=path.resolve(outArg),repo=path.resolve(repoArg);
const plan=JSON.parse(fs.readFileSync(path.join(out,'probe-build.json'))),sym=plan.symbols;
const kit=plan.source_kit;
const {ramMachine}=require(path.join(repo,'tests/support/eeprom-model.cjs'));
const flash=fs.readFileSync(path.join(kit,'ea/ea-atmega1284p-flash.bin'));
const blank=fs.readFileSync(path.join(kit,'ea/ea-atmega1284p-eeprom.bin'));
const rom=fs.readFileSync(path.join(out,'ea-ramprobe-rom512k.bin'));
const report=path.join(out,'probe-verification.json');
if(fs.existsSync(report))throw Error('Existing report protected');
const results=[];
for(const fault of ['none','base13-read','page1-read']){
    const badRam=fault!=='none';
    const ee=Buffer.from(blank),gram=Buffer.alloc(15360,0x99);
    const m=ramMachine(flash.subarray(0,0x1e000),rom,ee,{configuredFlash:true,ubergromRam:gram});
    m.memory.settings.setRAM('32K');m.memory.reset(true);m.cpu.reset();m.cru.reset();
    // Existing adapter correction: select the device by the prefetched byte's
    // address, including the final byte of an 8K page. AVR is still modeled.
    m.memory.readGROM=function(addr,cpu){
        const counter=this.grom.getAddress(),data=(addr&2)===0;
        const address=data?((counter&0xe000)|((counter-1)&0x1fff)):counter;
        cpu.addCycles(17);if(data)cpu.addCycles(6);
        const cv=data?this.grom.readData():this.grom.readAddress();
        const value=this.cartridge.readGROM(addr);
        if(addr===0x9834&&(fault==='base13-read'||(fault==='page1-read'&&address===0x8000)))return 0;
        return(data?address>=0x6000:counter>=0x6001)?value:cv;
    };
    let privateBefore;
    const write=m.cart.writeGROM.bind(m.cart);
    m.cart.writeGROM=function(port,word){
        if(port===0x9c34){
            if(!privateBefore)privateBefore=Buffer.from(gram.subarray(0,0x1900));
            const counter=this.gromBases[0].getAddress();
            const address=(counter&0xe000)|((counter-1)&0x1fff);
            assert.ok(address>=0x7900&&address<=0x98ff,'Write confined to ABI allocation');
        }
        return write(port,word);
    };
    m.memory.buildMemoryMap();
    m.frames(120);m.key('Space');m.frames(120);m.key('Digit2');m.frames(180);
    assert.ok(m.screen().includes('EDITOR/ASSEMBLER'));
    m.key('Digit5');m.type('ROM1.RAMPROBE\n');
    let frames=0;while(m.cpu.getPc()!==sym.DONE&&frames++<4000)m.frames(1);
    assert.equal(m.cpu.getPc(),sym.DONE);
    const screen=m.screen();
    console.log(screen);
    assert.deepEqual(ee,blank,'No EEPROM changes');assert.equal(m.getWrites(),0);
    assert.ok(gram.subarray(0x3900).every(x=>x===0x99),'Spare RAM intact');
    assert.ok(privateBefore);assert.deepEqual(gram.subarray(0,0x1900),privateBefore,'DSR private RAM intact');
    assert.ok(screen.includes('05FA')&&screen.includes('00FF')&&screen.includes('01FE'));
    if(badRam){
        assert.ok(screen.includes('ABI FIRST BAD AT:'));
        assert.equal(m.memory.getWord(sym.BADADR),fault==='base13-read'?0x6000:0x6700);
        assert.equal(m.memory.getWord(sym.EXPECT),fault==='base13-read'?0x12:0x15);
        assert.equal(m.memory.getWord(sym.ACTUAL),0);
        assert.ok(screen.includes(fault==='base13-read'?'EXPECT 0012 READ 0000':'EXPECT 0015 READ 0000'));
    }else{
        assert.ok(screen.includes('ABI FULL 8K: PASS'));
        for(const [addr,word] of [['7900','A55A'],['7FFE','3CC3'],['8000','6996'],['98FE','5AA5']])
            assert.ok(screen.includes(`13   ${addr}      ${word}       ${word}`));
        assert.ok(screen.includes('14   7900      A55A       A55A'));
    }
    fs.writeFileSync(path.join(out,`screen-${fault}.txt`),screen);
    fs.writeFileSync(path.join(out,`screen-${fault}.vram`),m.vdp.ram);
    results.push({fault,passed:true,screen,eeprom_writes:m.getWrites()});
}
fs.writeFileSync(report,JSON.stringify({passed:true,hardware_tested:false,
    tested_rom_sha256:require('node:crypto').createHash('sha256').update(rom).digest('hex'),
    evidence:'TMS9900 execution, console GPL, E/A option 5; ATmega ports modeled.',results},null,2)+'\n');
process.exit(0);

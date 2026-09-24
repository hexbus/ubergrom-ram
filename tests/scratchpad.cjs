// Local preview test: actual assembled editor, console keyboard and GPL DSR.
// Copyright 2026 hexbus. SPDX-License-Identifier: Apache-2.0
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const [outArg,repoArg]=process.argv.slice(2),out=path.resolve(outArg),repo=path.resolve(repoArg);
const {ramMachine}=require(path.join(repo,'tests/support/eeprom-model.cjs'));
const manifest=JSON.parse(fs.readFileSync(path.join(out,'preview.json')));
const flash=fs.readFileSync(path.join(out,'ea/ea-atmega1284p-flash.bin'));
const rom=fs.readFileSync(path.join(out,'ea/ea-rom512k.bin'));
const blank=fs.readFileSync(path.join(out,'ea/ea-atmega1284p-eeprom.bin'));
const results=[];
function setup(backend='ubergrom',saved=blank){
    const image=Buffer.from(saved),gram=Buffer.alloc(15360,0x99);
    const m=ramMachine(flash.subarray(0,0x1e000),rom,image,{configuredFlash:true,ubergromRam:gram});
    m.memory.settings.setRAM('32K');m.memory.reset(true);m.cpu.reset();m.cru.reset();
    m.memory.readGROM=function(addr,cpu){
        const c=this.grom.getAddress(),data=(addr&2)===0;
        const a=data?((c&0xe000)|((c-1)&8191)):c;
        cpu.addCycles(17);if(data)cpu.addCycles(6);
        const cv=data?this.grom.readData():this.grom.readAddress(),v=this.cartridge.readGROM(addr);
        return(data?a>=0x6000:c>=0x6001)?v:cv;
    };
    m.memory.buildMemoryMap();
    m.frames(120);m.key('Space');m.frames(120);m.key('Digit2');m.frames(180);
    if(backend==='ubergrom'){
        m.key('Digit5');m.type('ROM1.SCRATCH\n');m.frames(100);
    }else{
        m.memory.setRAMAt6000(true);m.memory.setRAMAt7000(true);
        m.memory.buildMemoryMap();
        m.memory.loadRAM(0xa000,fs.readFileSync(path.join(out,backend,'scratchpad.bin')));
        m.cpu.restoreState({...m.cpu.getState(),pc:0xa000});m.frames(100);
    }
    const keycodes=[],bridges=[];
    const oldExecute=m.cpu.execute.bind(m.cpu);
    m.cpu.execute=function(instruction){
        if(this.getPc()-2===manifest.backends[backend].symbols.MAIN+4)keycodes.push(m.memory.getWord(0xf000));
        if(this.getPc()-2===manifest.backends[backend].symbols.BRIDGE)bridges.push({base:m.memory.getWord(0x83fa),stack:m.memory.getWord(0x8372),gaddr:m.memory.grom.getAddress(),pab:Buffer.from(m.vdp.ram.subarray(0x3000,0x3020)).toString('hex')});
        return oldExecute(instruction);
    };
    function expect(text){assert.ok(m.screen().includes(text),text+'\n'+m.screen()+'\nkeys '+keycodes+' cpu '+m.cpu.getPc().toString(16)+' wp '+m.cpu.getWp().toString(16)+' bridges '+JSON.stringify(bridges));}
    function key(k){const file=word('MODE')>=2&&['Enter','KeyY'].includes(k);m.key(k);m.frames(file?2400:10);}
    function type(s){m.type(s);m.frames(3);}
    function word(n){return m.memory.getWord(manifest.backends[backend].symbols[n]);}
    function buffer(){return backend==='ubergrom'?Buffer.from(gram.subarray(0x1900,0x3840)):Buffer.from(Array.from({length:8000},(_,i)=>m.memory.getByte(0x6000+i)));}
    function snap(name){fs.writeFileSync(path.join(out,name+'.txt'),m.screen());fs.writeFileSync(path.join(out,name+'.vram'),m.vdp.ram);}
    expect('SCRATCHPAD');expect('100 LINES OF SCRATCH SPACE');
    return {m,image,gram,expect,key,type,word,buffer,snap};
}
for(const backend of ['ubergrom','supercart']){
    const t=setup(backend);
    const {key,type,expect,word,buffer}=t;
    key('KeyE');expect('EDIT LINE');type('BUY SOME MORE EPROMS');key('Enter');
    expect('BUY SOME MORE EPROMS');assert.equal(word('NLINES'),1);
    key(['Fctn','KeyX']);key('KeyE');type('TEST MULTIPLAN SAVE AND RELOAD');key('Enter');
    key(['Fctn','KeyX']);key('KeyE');type('REMEMBER TO THANK TURSI');key('Enter');
    assert.equal(word('NLINES'),3);
    if(backend==='ubergrom')t.snap('01-document');
    key('KeyE');type('THANKS FRED');key(['Fctn','Digit9']);expect('REMEMBER TO THANK TURSI');
    key('KeyE');type('THANKS FRED');key('Enter');expect('THANKS FRED');
    key('KeyU');expect('REMEMBER TO THANK TURSI');
    key('KeyE');key(['Fctn','Digit2']);type('X');key('Enter');expect('XREMEMBER TO THANK TURSI');
    key('KeyU');expect('REMEMBER TO THANK TURSI');
    key('KeyE');key(['Fctn','Digit1']);key('Enter');expect('EMEMBER TO THANK TURSI');
    key('KeyU');expect('REMEMBER TO THANK TURSI');
    const before=buffer();
    // Horizontal views, 80-character line, cancel, and one-level undo.
    key(['Fctn','KeyD']);expect('COLS 36-70');key(['Fctn','KeyD']);expect('COLS 71-80');
    key(['Fctn','KeyS']);key(['Fctn','KeyS']);expect('COLS 01-35');
    assert.deepEqual(buffer(),before);
    if(backend==='ubergrom'){
        key('KeyW');expect('FILE NAME');key('Enter');expect('SAVED AS DIS/VAR 80');
        assert.equal(word('DIRTY'),0);t.snap('03-saved');
        const saved=Buffer.from(t.image);
        key('KeyW');key('Enter');expect('REPLACE THE EXISTING FILE');
        const writes=t.m.getWrites();key('KeyN');assert.equal(t.m.getWrites(),writes);
        key('KeyE');type('UNSAVED EDIT');key('Enter');
        key('KeyN');expect('DISCARD UNSAVED CHANGES');key('KeyN');
        // Choosing NO must return to the document, not leave confirmation UI.
        expect('SCRATCHPAD');expect('UNSAVED EDIT');
        key('KeyO');key('KeyY');type('UBE1.MISSING');key('Enter');expect('FILE ERROR 7');expect('UNSAVED EDIT');
        const cold=setup('ubergrom',saved);
        cold.key('KeyO');cold.key('Enter');cold.expect('DOCUMENT LOADED');
        assert.deepEqual(cold.buffer(),before);cold.snap('04-reloaded');
        cold.key('KeyE');cold.snap('02-edit');
        cold.key(['Fctn','Digit9']);
        cold.key('KeyO');cold.type('ROM1.LONGDEMO');cold.key('Enter');
        cold.expect('FILE ERROR 8');assert.deepEqual(cold.buffer(),before);
        // Record 23 straddles the physical page split; record 100 ends at
        // the application's 8,000-byte limit. Use real keyboard editing.
        for(let i=0;i<22;i++)cold.key(['Fctn','KeyX']);
        cold.key('KeyE');cold.type('A'.repeat(79)+'Z');cold.key('Enter');
        assert.equal(cold.buffer().subarray(22*80,23*80).toString(),'A'.repeat(79)+'Z');
        for(let i=22;i<99;i++)cold.key(['Fctn','KeyX']);
        cold.key('KeyE');cold.type('THE LAST LINE');cold.key('Enter');
        assert.equal(cold.word('SELECT'),99);assert.equal(cold.word('NLINES'),100);
        cold.key(['Fctn','KeyX']);assert.equal(cold.word('SELECT'),99);
        assert.equal(cold.buffer().subarray(99*80,99*80+13).toString(),'THE LAST LINE');
        cold.key('KeyU');assert.ok(cold.buffer().subarray(99*80).every(x=>x===32));
        assert.ok(cold.gram.subarray(0x3840,0x3900).every(x=>x===0x99),'192 unused application bytes');
        // Inject a full document as a test fixture; a failed save must retain
        // it in RAM. This is not a claim that the fixture was typed by the UI.
        cold.gram.fill(65,0x1900,0x3840);
        cold.m.memory.writeWord(manifest.backends.ubergrom.symbols.NLINES,100,cold.m.cpu);
        const full=cold.buffer();
        const fullImage=Buffer.from(cold.image);
        cold.key('KeyW');cold.type('UBE1.FULL');cold.key('Enter');
        cold.expect('FILE ERROR');assert.deepEqual(cold.buffer(),full);
        assert.deepEqual(cold.image,fullImage,'Failed UBE1 output aborted without committing a partial file');
        cold.key('KeyW');cold.key('Enter');cold.expect('REPLACE THE EXISTING FILE');cold.key('KeyY');
        cold.expect('FILE ERROR');assert.deepEqual(cold.image,fullImage,'Failed replacement keeps old UBE1 file');
        assert.deepEqual(t.image.subarray(0,258),blank.subarray(0,258));
        assert.equal(t.m.getLock(),1);assert.ok(t.gram.subarray(0x3900).every(x=>x===0x99));
        results.push({backend,editing:true,insert_delete:true,undo:true,save:true,cold_reload:true,existing_file_guard:true,failed_load_preserves_document:true,too_many_records_rejected:true,page_crossing_line:true,last_line:true,failed_save_preserves_document:true,failed_replacement_preserves_old_file:true});
    }else results.push({backend,editing:true,undo:true,save_tested:false});
    console.log('PASS',backend);
}
fs.writeFileSync(path.join(out,'scratchpad-verification.json'),JSON.stringify({passed:true,hardware_tested:false,results},null,2)+'\n');
process.exit(0);

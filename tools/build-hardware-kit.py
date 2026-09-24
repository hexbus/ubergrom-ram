"""Make a local hardware-test kit from verified module programmer files.
Original module/firmware inputs stay outside this library's repository.
Copyright (c) 2026 hexbus. SPDX-License-Identifier: Apache-2.0
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--dsr-repo', type=Path, required=True)
    p.add_argument('--module-pack', type=Path, required=True)
    p.add_argument('--library-build', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    a = p.parse_args()
    repo, source, lib, out = (v.resolve() for v in
                            (a.dsr_repo,a.module_pack,a.library_build,a.out))
    if out.exists() or not out.is_relative_to(repo/'output') or out.is_relative_to(ROOT):
        p.error('Use a fresh output directory in the separate DSR repository')
    index = json.loads((source/'index.json').read_text())
    for module, files in index['packages'].items():
        for name,digest in files.items():
            if sha((source/module/name).read_bytes()) != digest:
                p.error('Changed module input: '+module+'/'+name)
    for name in ('verification.json','catalog-verification.json'):
        if not json.loads((source/name).read_text())['passed']:
            p.error('Module tests did not pass')
    lm = json.loads((lib/'manifest.json').read_text())
    # RAMTEST assembles the current library; benchmarks come from lib. Reject
    # mixed revisions instead of calling the combination a verified build.
    for name in ('src/ugram.asm','examples/benchmark.asm','examples/font.asm'):
        if lm.get('source_sha256',{}).get(name) != sha((ROOT/name).read_bytes()):
            p.error('Rebuild and verify the library from current sources: '+name)
    for name,digest in lm['sha256'].items():
        if sha((lib/name).read_bytes()) != digest:
            p.error('Changed library input: '+name)
    for name in ('verification.json','benchmark-verification.json'):
        if not json.loads((lib/name).read_text())['passed']:
            p.error('Library tests did not pass')
    sys.path.insert(0,str(repo/'tools'))
    from cf02 import File,build,parse
    from build_ubergrom import encode_hex,decode_hex
    from block_store import mount
    xas=ROOT/'.deps/xdt99/xas99.py'
    if not xas.is_file():
        p.error('First run tools/fetch-deps.py')
    shutil.copytree(source,out)
    test=out/'test-programs'
    test.mkdir()
    ea=out/'ea'
    manifest=json.loads((ea/'SOURCE-MAP.json').read_text())
    bridge_source=ROOT/'examples/test-dsrlink.asm'
    subprocess.run([sys.executable,str(xas),str(bridge_source),
                    '-R','-b','-D','ENTRYBASE=>B800','WORKSPACE=>BE00',
                    f'GPLCALL=>{manifest["tail_labels"]["CPUCALL"]:04X}',
                    '-o',str(test/'bridge.bin')],check=True)
    symbols={}
    for fmt,name in [('-b','ramtest.bin'),('-i','RAMTEST')]:
        subprocess.run([sys.executable,str(xas),str(ROOT/'examples/coexist.asm'),
                        '-R',fmt,'--quiet-opts','--quiet-unused-syms',
                        '-I',str(ROOT/'src'),str(ROOT/'examples'),str(test),
                        '-o',str(test/name),'-L',str(test/(name+'.lst')),'-S'],check=True)
    listing=(test/'ramtest.bin.lst').read_text()
    symbols={name.upper():int(value,16) for name,value in
             re.findall(r'^\s+([a-z][a-z0-9_]*)\.+\s+>([0-9a-f]{4})\b',listing,re.M)}
    subprocess.run([sys.executable,str(xas),str(bridge_source),
                    '-R','-b','-D',f'ENTRYBASE=>{symbols["BRIDGE"]:04X}','WORKSPACE=>BE00',
                    f'GPLCALL=>{manifest["tail_labels"]["CPUCALL"]:04X}',
                    '-o',str(test/'bridge.bin')],check=True)
    for fmt,name in [('-b','ramtest.bin'),('-i','RAMTEST')]:
        subprocess.run([sys.executable,str(xas),str(ROOT/'examples/coexist.asm'),
                        '-R',fmt,'--quiet-opts','--quiet-unused-syms',
                        '-I',str(ROOT/'src'),str(ROOT/'examples'),str(test),
                        '-o',str(test/name),'-L',str(test/(name+'.lst')),'-S'],check=True)
    assert 0xa000+len((test/'ramtest.bin').read_bytes())<0xbe00
    assert (test/'RAMTEST').read_bytes()[:2]==b'\0\0','Unexpected multi-file E/A image'
    for backend,name in [('ubergrom','UGBENCH'),('direct','CPUBENCH'),
                         ('supercart','SCBENCH'),('direct-supercart','SCDIRECT')]:
        shutil.copyfile(lib/backend/'BENCH',test/name)
    original=(ea/'ea-rom512k.bin').read_bytes()
    entries=parse(original)
    added=[File.program(n,(test/n).read_bytes()) for n in ('RAMTEST','UGBENCH','CPUBENCH')]
    added.append(File.program('RAMDATA',b''.join((0x1234+i).to_bytes(2,'big') for i in range(128))))
    added.append(File.records('RAMSOURCE',0x80,80,[b'       DEF START',
                 b'START  LI 1,>1234',b'       B *11',b'       END START']))
    rom=build([e.file for e in entries]+added)
    current={e.file.name:e.file for e in parse(rom)}
    assert all(current[e.file.name]==e.file for e in entries)
    (ea/'ea-rom512k.bin').write_bytes(rom)
    ee=bytearray((ea/'ea-atmega1284p-eeprom.bin').read_bytes())
    before=bytes(ee)
    assert not any(mount(ee).slots)
    for slot,value in [(3,0),(4,1)]:
        at=13*16+slot+2
        assert ee[at]==255 and ee[at+8]==0,'Base 13 already occupied'
        ee[at],ee[at+8]=value,value^255
    assert ee[:208]==before[:208] and ee[226:]==before[226:]
    (ea/'ea-atmega1284p-eeprom.bin').write_bytes(ee)
    encoded=encode_hex(ee).encode('ascii')
    decoded=decode_hex(encoded)
    assert bytes(decoded[i] for i in range(4096))==ee
    (ea/'ea-atmega1284p-eeprom.hex').write_bytes(encoded)
    flash=(ea/'ea-atmega1284p-flash.bin').read_bytes()
    (ea/'ea-atmega1284p-combined132k.bin').write_bytes(flash+ee)
    # Keep the original index as provenance, and generate a new complete index
    # only after the separate emulator verification succeeds.
    (out/'index.json').rename(out/'original-module-index.json')
    plan={'hardware_tested':False,'status':'Awaiting kit emulator check',
          'diagnostic_revision':'TEST 2',
          'ea_added_files':[f.name for f in added],
          'ea_flash_unchanged':True,'ea_base13_added':True,
          'ramtest_symbols':symbols,'library_sha256':lm['sha256']['ubergrom/library.bin'],
          'ramtest_bridge':'CPU RAM scratchpad backup; no private GROM RAM transfers',
          'ramtest_bridge_source_sha256':sha(bridge_source.read_bytes()),
          'original_rom_sha256':sha(original),'test_rom_sha256':sha(rom)}
    (out/'kit-build.json').write_text(json.dumps(plan,indent=2)+'\n')
    (ea/'SOURCE-MAP.json').rename(ea/'ORIGINAL-SOURCE-MAP.json')
    for name in ('START-HERE.md','START-HERE.txt'):
        shutil.copyfile(ROOT/'docs/hardware-test-kit.md',out/name)
    # The original README is accurate for programming; append the kit change.
    with (ea/'README.txt').open('a') as f:
        f.write('\nHARDWARE TEST KIT: base 13 RAM is already mapped. ROM1 also contains\n'
                'RAMTEST, UGBENCH, CPUBENCH, RAMDATA and RAMSOURCE. Use E/A option 5 for the\n'
                'three test programs. Read START-HERE.md in the kit root first.\n')
    print(out)


if __name__=='__main__':
    main()

"""Build an unpublished local scratchpad preview. No network or programmer.
Copyright 2026 hexbus. SPDX-License-Identifier: Apache-2.0
"""
import argparse,hashlib,json,re,shutil,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--dsr-repo',type=Path,required=True)
    p.add_argument('--kit',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    a=p.parse_args()
    out=a.out.resolve();repo=a.dsr_repo.resolve();kit=a.kit.resolve()
    if out.exists() or not out.is_relative_to(repo/'output'):
        p.error('Use a new directory under the separate DSR repository output/')
    xas=ROOT/'.deps/xdt99/xas99.py'
    verification=json.loads((kit/'hardware-kit-verification.json').read_text())
    if verification.get('passed') is not True:
        p.error('Kit verification did not pass')
    expected=verification['tested_images']
    for name,digest in expected.items():
        assert hashlib.sha256((kit/name).read_bytes()).hexdigest()==digest,name
    module=json.loads((kit/'ea/ORIGINAL-SOURCE-MAP.json').read_text())
    if module['module']!='ea' or module['private_ram_reserved_bytes']!=6400:
        p.error('Expected the E/A profile with 6400 bytes reserved for the DSR')
    gplcall=module['tail_labels']['CPUCALL']
    out.mkdir(parents=True)
    sys.path.insert(0,str(repo/'tools'))
    from cf02 import File,build,parse
    shutil.copytree(kit/'ea',out/'ea')
    original=(out/'ea/ea-rom512k.bin').read_bytes()
    entries=[e.file for e in parse(original)]
    entries.append(File.records('DEMO',0x80,80,[b'BUY SOME MORE EPROMS',
        b'TEST MULTIPLAN SAVE AND RELOAD',b'REMEMBER TO THANK TURSI']))
    entries.append(File.records('LONGDEMO',0x80,80,[b'EXCESS ROW']*101))
    builds={}
    for backend in ('ubergrom','supercart'):
        dest=out/backend;dest.mkdir()
        defs=['-D','SUPERCART'] if backend=='supercart' else []
        bridge=dest/'bridge.bin'
        def assemble_bridge(address):
            subprocess.run([sys.executable,str(xas),str(repo/'sources/cpu/cart-dsrlink.asm'),'-R','-b',
                            '-D',f'ENTRYBASE=>{address:04X}','WORKSPACE=>F040',f'GPLCALL=>{gplcall:04X}',
                            '-o',str(bridge)],check=True)
        def assemble():
            for fmt,name in [('-b','scratchpad.bin'),('-i','SCRATCH')]:
                subprocess.run([sys.executable,str(xas),str(ROOT/'examples/scratchpad.asm'),'-R',fmt,
                    '--quiet-opts','--quiet-unused-syms','-I',str(ROOT/'src'),str(ROOT/'examples'),str(dest),
                    *defs,'-o',str(dest/name),'-L',str(dest/(name+'.lst')),'-S'],check=True)
            listing=(dest/'scratchpad.bin.lst').read_text()
            return {n.upper():int(v,16) for n,v in re.findall(r'^\s+([a-z][a-z0-9_]*)\.+\s+>([0-9a-f]{4})\b',listing,re.M)}
        assemble_bridge(0xb000)
        symbols=assemble()
        assemble_bridge(symbols['BRIDGE'])
        symbols=assemble()
        assert symbols['CODEEND']<0xd000
        names=[]
        # xas99 may split E/A images at AORG boundaries or the image size limit.
        for f in sorted(dest.iterdir()):
            if re.fullmatch('SCRATC[A-Z]',f.name):
                names.append(f.name)
        assert names and names[0]=='SCRATCH'
        builds[backend]={'symbols':symbols,'files':names,'bytes':(dest/'scratchpad.bin').stat().st_size}
        if backend=='ubergrom':entries += [File.program(n,(dest/n).read_bytes()) for n in names]
    (out/'ea/ea-rom512k.bin').write_bytes(build(entries))
    (out/'preview.json').write_text(json.dumps({'published':False,'hardware_tested':False,
        'gplcall':gplcall,'backends':builds},indent=2)+'\n')
    print(out)

if __name__=='__main__':main()

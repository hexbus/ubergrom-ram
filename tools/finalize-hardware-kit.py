"""Verify and copy a completed local kit; never overwrite a desktop delivery.
Copyright (c) 2026 hexbus. SPDX-License-Identifier: Apache-2.0
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import zipfile

ROOT=Path(__file__).resolve().parents[1]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('kit',type=Path)
    p.add_argument('delivery',type=Path)
    a=p.parse_args()
    kit,delivery=a.kit.resolve(),a.delivery.resolve()
    archive=delivery.with_suffix('.zip')
    if (delivery.exists() or archive.exists() or delivery.is_relative_to(ROOT)
            or kit.is_relative_to(delivery) or delivery.is_relative_to(kit)):
        p.error('Choose a fresh delivery directory outside the source repositories')
    report=json.loads((kit/'hardware-kit-verification.json').read_text())
    if not report.get('passed'):
        p.error('Kit verification did not pass')
    original=json.loads((kit/'original-module-index.json').read_text())
    changed={'ea-rom512k.bin','ea-atmega1284p-eeprom.bin',
             'ea-atmega1284p-eeprom.hex','ea-atmega1284p-combined132k.bin'}
    for module,files in original['packages'].items():
        for name,digest in files.items():
            if module=='ea' and name in changed:
                continue
            assert sha((kit/module/name).read_bytes())==digest,(module,name)
    # The test report ties verification to exactly the images being delivered.
    for name,digest in report['tested_images'].items():
        assert sha((kit/name).read_bytes())==digest,name
    for name in ('START-HERE.md','START-HERE.txt'):
        shutil.copyfile(ROOT/'docs/hardware-test-kit.md',kit/name)
    shutil.copyfile(ROOT/'output/pdf/docs/hardware-test-kit.pdf',kit/'START-HERE.pdf')
    build=json.loads((kit/'kit-build.json').read_text())
    build['status']='Emulator checks passed; ready for hardware qualification'
    (kit/'kit-build.json').write_text(json.dumps(build,indent=2)+'\n')
    files=sorted(f for f in kit.rglob('*') if f.is_file() and f.name!='SHA256SUMS.txt')
    checks=''.join(sha(f.read_bytes())+'  '+f.relative_to(kit).as_posix()+'\n' for f in files)
    (kit/'SHA256SUMS.txt').write_text(checks)
    shutil.copytree(kit,delivery)
    with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_DEFLATED) as z:
        for f in sorted(delivery.rglob('*')):
            if f.is_file():z.write(f,f.relative_to(delivery))
    with zipfile.ZipFile(archive) as z:
        for line in checks.splitlines():
            digest,name=line.split('  ',1)
            assert sha((delivery/name).read_bytes())==digest,name
            assert sha(z.read(name))==digest,name
    print('Verified delivery:',delivery)
    print('ZIP:',archive)
    print('SHA256:',sha(archive.read_bytes()))


if __name__=='__main__':
    main()

"""Create a disposable coexistence fixture from an existing E/A DSR build.
No OEM module/game data is copied. No existing EEPROM image is used.
Copyright (c) 2026 hexbus. SPDX-License-Identifier: Apache-2.0
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--dsr-repo', type=Path, required=True)
    p.add_argument('--dsr-build', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    a = p.parse_args()
    out = a.out.resolve()
    if out.exists() or not out.is_relative_to(ROOT/'output') or out == ROOT/'output':
        p.error('Use a new directory under this repository\'s output/')
    source = a.dsr_build.resolve()
    original = json.loads((source/'manifest.json').read_text())
    if original['module'] != 'ea' or original['private_ram_reserved_bytes'] != 6400:
        p.error('Expected the 6,400-byte E/A/CF02 development profile')
    service = (source/'service.bin').read_bytes()
    reader = (source/'reader.bin').read_bytes()
    if (len(service) != original['service_bytes'] or len(service)>8192
            or len(reader) != original['reader_bytes'] or len(reader)>0x720):
        p.error('Unexpected component sizes')
    if service[:2] != b'\xaa\x01' or reader[:2] != b'\xaa\x01':
        p.error('Missing GROM headers')
    sys.path.insert(0,str(a.dsr_repo.resolve()/'tools'))
    from block_store import initialize_blank
    from cf02 import File, build
    # Flash page 0 is filled by the GPL test caller. Page 1 carries the
    # unchanged reader tail at >F800 on base 14. Page 2 holds the service.
    grom = bytearray(b'\xff'*24576)
    grom[8192+0x1800:8192+0x1800+len(reader)] = reader
    grom[16384:16384+len(service)] = service
    config = bytearray(b'\xff'*258)
    config[:2] = b'\x05\xfa'  # Required by the existing DSR profile.
    for base in range(16):
        for slot in range(8):
            at=base*16+slot+2
            config[at],config[at+8]=255,0
    def mapping(base,slot,value):
        at=base*16+slot+2
        config[at],config[at+8]=value,value^255
    mapping(0,3,0x10); mapping(1,3,0x10)
    for base in (0,14,15):
        mapping(base,5,0x20);mapping(base,6,0x12)
    mapping(14,3,0);mapping(14,7,0x11)
    mapping(13,3,0);mapping(13,4,1)
    pattern=bytes((i*37+(i>>8)*11+7)&255 for i in range(8192))
    records=[bytes((n*13+i*7)&255 for i in range(80)) for n in range(8)]
    rom=build([File.program('PATTERN',pattern),File.records('RECORDS',0,80,records)])
    out.mkdir(parents=True)
    (out/'fixture-grom.bin').write_bytes(grom)
    (out/'rom512k.bin').write_bytes(rom)
    (out/'blank.eeprom-model.bin').write_bytes(initialize_blank(bytes(config)+b'\xff'*(4096-258)))
    (out/'rom-pattern.bin').write_bytes(pattern)
    (out/'rom-records.bin').write_bytes(b''.join(records))
    inputs={name:{'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
            for name,data in [('service.bin',service),('reader.bin',reader)]}
    manifest={'grom_file':'fixture-grom.bin','dsr_reserved_bytes':6400,
              'library_physical_start':0x1900,'library_bytes':8192,'spare_start':0x3900,
              'source_module':'ea','source_components':inputs,'hardware_tested':False}
    (out/'fixture.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('Created disposable synthetic DSR fixture:',out)


if __name__=='__main__':
    main()

"""Add a readback diagnostic to a copy of the user's E/A hardware-test ROM.
Copyright (c) 2026 hexbus. SPDX-License-Identifier: Apache-2.0
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--kit', type=Path, required=True)
    p.add_argument('--dsr-repo', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    p.add_argument('--version', type=int, choices=[1, 2], default=1)
    a = p.parse_args()
    kit, repo, out = a.kit.resolve(), a.dsr_repo.resolve(), a.out.resolve()
    if out.exists() or not out.is_relative_to(repo/'output'):
        p.error('Use a fresh directory under the separate DSR repository output/')
    sys.path.insert(0, str(repo/'tools'))
    from cf02 import File, build, parse
    original = (kit/'ea/ea-rom512k.bin').read_bytes()
    if hashlib.sha256(original).hexdigest() != '5efcebe383d9ab535c3f53f1737cdf3fbc07e194af7d208827ecc90b728e60d3':
        p.error('Expected the original 2026-09-23 E/A test-kit ROM')
    out.mkdir(parents=True)
    # These historical probes compare workspace placement in the ORIGINAL
    # failing library. Using today's auto-switching library would silently
    # turn ABI-EXT into another ABI-PAD test and invalidate the comparison.
    legacy = ROOT/'tests/fixtures/ugram-v0.2.1.asm'
    include = out/'historical-source'
    include.mkdir()
    (include/'ugram.asm').write_bytes(legacy.read_bytes())
    stem = 'ramprobe' if a.version == 1 else 'ramprobe2'
    program = stem.upper()
    for fmt, name in [('-b', stem+'.bin'), ('-i', program)]:
        subprocess.run([sys.executable, str(ROOT/'.deps/xdt99/xas99.py'),
                        str(ROOT/f'examples/{stem}.asm'), '-R', fmt,
                        '--quiet-opts', '--quiet-unused-syms', '-I',
                        str(ROOT/'examples'), str(include),
                        '-o', str(out/name), '-L', str(out/(name+'.lst')), '-S'], check=True)
    listing = (out/(stem+'.bin.lst')).read_text()
    symbols = {name.upper(): int(value, 16) for name, value in
               re.findall(r'^\s+([a-z][a-z0-9_]*)\.+\s+>([0-9a-f]{4})\b', listing, re.M)}
    assert 0xa000 + (out/(stem+'.bin')).stat().st_size < 0xbf00
    entries = parse(original)
    rom = build([e.file for e in entries] + [File.program(program, (out/program).read_bytes())])
    current = {e.file.name: e.file for e in parse(rom)}
    assert all(current[e.file.name] == e.file for e in entries)
    assert len(rom) == 524288
    rom_name = f'ea-{stem}-rom512k.bin'
    (out/rom_name).write_bytes(rom)
    hashes = {name: hashlib.sha256((kit/'ea'/name).read_bytes()).hexdigest() for name in
              ['ea-rom512k.bin', 'ea-atmega1284p-flash.bin', 'ea-atmega1284p-eeprom.bin']}
    (out/'probe-build.json').write_text(json.dumps({
        'source_kit': str(kit), 'source_images': hashes, 'symbols': symbols,
        'version': a.version, 'program': program, 'rom_file': rom_name,
        'new_rom_sha256': hashlib.sha256(rom).hexdigest(),
        'original_files_preserved': len(entries), 'hardware_tested': False,
        'library_revision': 'v0.2.1 historical failure-reproduction fixture',
        'library_source_sha256': hashlib.sha256(legacy.read_bytes()).hexdigest(),
        'purpose': 'Reproduce the original workspace comparison, not test the fixed library.'}, indent=2)+'\n')
    print(out)


if __name__ == '__main__':
    main()

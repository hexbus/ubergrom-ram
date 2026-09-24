"""Build the library and demonstration using an external xdt99 checkout.
Copyright (c) 2026 hexbus. SPDX-License-Identifier: Apache-2.0
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    bundled = ROOT / '.deps/xdt99'
    parser.add_argument('--xdt99', type=Path, default=os.environ.get('XDT99', bundled if bundled.exists() else ROOT.parent / 'xdt99'))
    parser.add_argument('--out', type=Path, default=ROOT / 'build')
    args = parser.parse_args()
    assembler = args.xdt99.resolve() / 'xas99.py'
    if not assembler.is_file():
        parser.error('Set --xdt99 to an xdt99 checkout containing xas99.py')
    out = args.out.resolve()
    # Builds only create a new directory, never overwrite a previous build.
    if out.exists() or out == ROOT or ROOT.is_relative_to(out):
        parser.error('Output must be a new directory')
    if out.is_relative_to(ROOT) and out.parts[len(ROOT.parts)] not in ('build', 'output'):
        parser.error('Inside the repository use build/ or output/')
    out.mkdir(parents=True)
    manifest = {'abi': 1, 'hardware_tested': False, 'backends': {}}
    for backend in ('ubergrom', 'supercart'):
        dest = out / backend
        dest.mkdir()
        wrapper = dest / 'library.asm'
        wrapper.write_text("       AORG >A000\n       COPY 'ugram.asm'\n       END\n", encoding='ascii')
        defs = ['-D', 'SUPERCART'] if backend == 'supercart' else []
        common = ['-R', '--quiet-opts', '--quiet-unused-syms', '-I', str(ROOT/'src'), *defs]
        def assemble(source, name, fmt):
            subprocess.run([sys.executable, str(assembler), str(source), *common, fmt, '-o', str(dest/name),
                            '-L', str(dest/(name+'.lst')), '-S'], check=True)
        assemble(wrapper, 'library.bin', '-b')
        assemble(ROOT/'examples/buffer.asm', 'example.bin', '-b')
        assemble(ROOT/'examples/buffer.asm', 'EXAMPLE', '-i')
        listing = (dest/'library.bin.lst').read_text()
        symbols = {name.upper(): int(value, 16) for name, value in
                   re.findall(r'^\s+([a-z][a-z0-9_]*)\.+\s+>([0-9a-f]{4})\b', listing, re.M)}
        if 'UGGETB' not in symbols:
            raise ValueError('Cannot read assembler symbol table')
        manifest['backends'][backend] = {'symbols': symbols, 'bytes': (dest/'library.bin').stat().st_size}
    manifest['sha256'] = {str(p.relative_to(out)).replace('\\', '/'): hashlib.sha256(p.read_bytes()).hexdigest()
                          for p in sorted(out.rglob('*')) if p.is_file() and p.suffix != '.lst' and p.suffix != '.asm'}
    (out/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf8')
    print('Built both backends in', out)


if __name__ == '__main__':
    main()

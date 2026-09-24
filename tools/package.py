"""Package a verified development build. Never overwrite an existing archive.
Copyright (c) 2026 hexbus. SPDX-License-Identifier: Apache-2.0
"""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('build', type=Path)
    parser.add_argument('archive', type=Path)
    args = parser.parse_args()
    build = args.build.resolve()
    archive = args.archive.resolve()
    report = json.loads((build/'verification.json').read_text())
    manifest = json.loads((build/'manifest.json').read_text())
    if report.get('passed') is not True:
        parser.error('Build has not passed verification')
    if manifest.get('benchmarks'):
        benchmark = json.loads((build/'benchmark-verification.json').read_text())
        if benchmark.get('passed') is not True:
            parser.error('Benchmarks have not passed verification')
    for name, digest in manifest['sha256'].items():
        if hashlib.sha256((build/name).read_bytes()).hexdigest() != digest:
            parser.error('Build file changed: '+name)
    if archive.exists():
        parser.error('Existing archive protected')
    archive.parent.mkdir(parents=True, exist_ok=True)
    files = {}
    for name in ['README.md','LICENSE-CODE.txt','LICENSE-DOCUMENTATION.md','NOTICE.txt','package.json','package-lock.json']:
        files[name] = ROOT/name
    for folder in ['src','examples','docs','tools','tests']:
        for p in (ROOT/folder).rglob('*'):
            if p.is_file() and '__pycache__' not in p.parts:
                files[p.relative_to(ROOT).as_posix()] = p
    for name in manifest['sha256']:
        files['build/'+name] = build/name
    for name in ['manifest.json','verification.json']:
        files['build/'+name] = build/name
    if manifest.get('benchmarks'):
        files['build/benchmark-verification.json'] = build/'benchmark-verification.json'
    for p in build.rglob('*.lst'):
        files['build/'+p.relative_to(build).as_posix()] = p
    checksums = ''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+name+'\n'
                        for name,p in sorted(files.items()))
    with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_DEFLATED) as z:
        for name,p in sorted(files.items()):
            z.writestr(name,p.read_bytes())
        z.writestr('SHA256SUMS.txt',checksums)
    print('Packaged',len(files),'files:',archive)


if __name__ == '__main__':
    main()

"""Reject mixed revisions and unverified kit inputs before making a delivery.
Copyright 2026 hexbus. SPDX-License-Identifier: Apache-2.0
"""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class BuildGuards(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def write(self, name, data):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data))
        return path

    def reject(self, tool, arguments, message, output):
        result = subprocess.run([sys.executable, str(ROOT / 'tools' / tool),
                                 *map(str, arguments)], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(message, result.stderr)
        self.assertFalse(output.exists())

    def test_package_rejects_old_manifest_without_source_hashes(self):
        self.write('build/verification.json', {'passed': True})
        self.write('build/manifest.json', {})
        out = self.root / 'release.zip'
        self.reject('package.py', [self.root / 'build', out],
                    'Rebuild with source hashes', out)

    def test_package_rejects_sources_changed_after_tests(self):
        self.write('build/verification.json', {'passed': True})
        self.write('build/manifest.json', {'source_sha256': {'src/ugram.asm': 'old'}})
        out = self.root / 'release.zip'
        self.reject('package.py', [self.root / 'build', out],
                    'Source changed since the verified build', out)

    def test_kit_rejects_mixed_library_revisions(self):
        self.write('modules/index.json', {'packages': {}})
        for name in ('verification', 'catalog-verification'):
            self.write(f'modules/{name}.json', {'passed': True})
        self.write('library/manifest.json', {'source_sha256': {'src/ugram.asm': 'old'}})
        out = self.root / 'dsr/output/kit'
        self.reject('build-hardware-kit.py', [
            '--dsr-repo', self.root / 'dsr', '--module-pack', self.root / 'modules',
            '--library-build', self.root / 'library', '--out', out],
            'Rebuild and verify the library from current sources', out)

    def test_preview_rejects_failed_kit_before_creating_output(self):
        self.write('kit/hardware-kit-verification.json', {'passed': False})
        out = self.root / 'dsr/output/preview'
        self.reject('build-scratchpad.py', [
            '--dsr-repo', self.root / 'dsr', '--kit', self.root / 'kit', '--out', out],
            'Kit verification did not pass', out)

    def test_preview_rejects_incompatible_ram_allocation(self):
        self.write('kit/hardware-kit-verification.json', {'passed': True, 'tested_images': {}})
        self.write('kit/ea/ORIGINAL-SOURCE-MAP.json',
                   {'module': 'ea', 'private_ram_reserved_bytes': 8192})
        out = self.root / 'dsr/output/preview'
        self.reject('build-scratchpad.py', [
            '--dsr-repo', self.root / 'dsr', '--kit', self.root / 'kit', '--out', out],
            'Expected the E/A profile with 6400 bytes', out)


if __name__ == '__main__':
    unittest.main()

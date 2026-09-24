"""Fetch pinned build/test tools into .deps without changing existing checkouts.
Copyright (c) 2026 hexbus. SPDX-License-Identifier: Apache-2.0
"""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
TOOLS = {
    'xdt99': ('https://github.com/endlos99/xdt99.git', 'a77bd3183ff64baacc490dc9cd80b6c7552037ec'),
    'js99er-angular': ('https://github.com/Rasmus-M/js99er-angular.git', '0740d008d366173a0ccc18a3f33c98b59131cfaf'),
}


def main():
    for name, (url, commit) in TOOLS.items():
        dest = ROOT / '.deps' / name
        if dest.exists():
            actual = subprocess.check_output(['git', '-C', str(dest), 'rev-parse', 'HEAD'], text=True).strip()
            dirty = subprocess.check_output(['git', '-C', str(dest), 'status', '--porcelain'], text=True).strip()
            if actual != commit or dirty:
                raise SystemExit(f'Existing {name} does not match the clean pinned checkout; left untouched.')
            print(name, 'already pinned')
            continue
        dest.mkdir(parents=True)
        def git(*args):
            subprocess.run(['git', '-C', str(dest), *args], check=True)
        git('init', '--quiet')
        git('remote', 'add', 'origin', url)
        git('fetch', '--quiet', '--depth=1', '--filter=blob:none', 'origin', commit)
        if name == 'js99er-angular':
            git('sparse-checkout', 'set', 'src/app/classes', 'src/app/emulator/classes', 'src/app/emulator/interfaces')
        git('checkout', '--quiet', '--detach', 'FETCH_HEAD')
        print(name, commit)


if __name__ == '__main__':
    main()

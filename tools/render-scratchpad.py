"""Render captured text-mode VDP memory from the local scratchpad tests.
These are program output, not an independently drawn UI mockup.
Copyright 2026 hexbus. SPDX-License-Identifier: Apache-2.0
"""
import argparse
from pathlib import Path
from PIL import Image

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('preview',type=Path)
a=p.parse_args()
for f in a.preview.glob('*.vram'):
    v=f.read_bytes()
    im=Image.new('RGB',(256,192),(54,85,250))
    pixels=im.load()
    for row in range(24):
        for col in range(40):
            ch=v[row*40+col]
            for y in range(8):
                bits=v[0x800+ch*8+y]
                for x in range(6):
                    if bits&(128>>x):
                        pixels[8+col*6+x,row*8+y]=(255,255,255)
    im.resize((1024,768),Image.Resampling.NEAREST).save(f.with_suffix('.png'))

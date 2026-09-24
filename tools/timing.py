"""Convert the eight hardware benchmark totals into useful times and rates.
Copyright (c) 2026 hexbus. SPDX-License-Identifier: Apache-2.0
"""
import argparse

NAMES = ['EMPTY SAMPLE','BYTE READ','BYTE WRITE','WORD READ','WORD WRITE','READ 256','WRITE 256','FILL 256']


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('ticks', nargs=8, type=int, help='Eight decimal totals in screen order, starting with EMPTY SAMPLE')
    p.add_argument('--mhz', type=float, default=3.0, help='Actual CPU clock in MHz (default 3)')
    a = p.parse_args()
    if not 0 < a.mhz < 100 or any(x < 0 or x > 0xffffffff for x in a.ticks):
        p.error('Use a positive CPU clock and unsigned 32-bit totals')
    scale = 64 / (a.mhz * 1_000_000)
    print('Name          Gross seconds  Less empty sample  Effective rate')
    for i, (name,ticks) in enumerate(zip(NAMES,a.ticks)):
        gross = ticks * scale
        adjusted = (ticks-a.ticks[0]) * scale
        if i == 0:
            print(f'{name:13} {gross:13.6f}  {"--":>17}  --')
        elif adjusted <= 0:
            print(f'{name:13} {gross:13.6f}  {"unresolved":>17}  increase workload')
        else:
            rate = f'{4096/adjusted:.0f} ops/s' if i < 5 else f'{64/adjusted:.2f} KiB/s'
            print(f'{name:13} {gross:13.6f}  {adjusted:17.6f}  {rate}')
    print('Baseline subtraction removes common sampling overhead, not loop/call/setup cost.')
    print('Results are hardware measurements only when the supplied totals came from hardware.')


if __name__ == '__main__':
    main()

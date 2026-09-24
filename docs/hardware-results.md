# Hardware results

I ran these on a real TI-99/4A with UberGROM. The current library passed
**UGBENCH** and all nine stages of **RAMTEST TEST 2** with the Corcomp 32K
sidecar. These results are from September 24, 2026.

## What changed

The original RAM code failed when its registers were in expansion RAM, on
both PicoPEB and Corcomp. Using console scratchpad registers passed the
comparison on both. The library now handles that switch and restoration
for you. Your program can keep its own workspace in expansion RAM.

We know the workaround works on the tested setup; the exact electrical cause
is still unconfirmed. TEST 2 also moved its separate scratchpad backup into
CPU RAM. Its address-only GROM accesses still use expansion registers.

## Confirmed scope

E/A also loads TOMB and TOMBA, and small documents save, reload and verify.
The separate DSR's disk-full recovery fix works much better. That doesn't
mean every file operation and error case has been tested on hardware.

Supercart and the Scratchpad editor preview have emulator tests but still
need hardware runs. Other module adaptations need their own tests too.

## Recorded speed screen

One UGBENCH run on the Corcomp setup, with **DATA CHECK: PASS**:

| Row | Total ticks |
| --- | ---: |
| Empty sample | 512 |
| Byte read, 4,096 operations | 349440 |
| Byte write, 4,096 operations | 353021 |
| Word read, 4,096 operations | 376064 |
| Word write, 4,096 operations | 379041 |
| Read 256, 65,536 bytes | 322979 |
| Write 256, 65,536 bytes | 363481 |
| Fill 256, 65,536 bytes | 354065 |

The 64K read took about 6.89 seconds at 3 MHz, including call and loop
costs. These are RAM-library timings, not ROM1 or EEPROM speeds.
[The benchmark guide](benchmarks.md) explains the rows.

Photo references, hashes and exact test scope are in the
[hardware record](../tests/results/hardware-20260924.json).
[Automated tests](verification.md) are kept separate from those hardware results.

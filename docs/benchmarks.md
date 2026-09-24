# Running the speed tests

These run the same work with ordinary CPU RAM, Supercart RAM and UberGROM RAM.
All need a normal 32K expansion for the test program.

| Build folder | Data access |
| --- | --- |
| direct | Native CPU instructions at >C000 |
| direct-supercart | Native instructions in real Supercart RAM at >6000 |
| supercart | Library calls using real Supercart RAM |
| ubergrom | Library calls using UberGROM RAM |

Select the writable RAM bank before running either Supercart build.
For UberGROM, use the [RAM mappings](mapping.md).

## Run it

Import **BENCH** from the chosen build as a PROGRAM file and load it through
E/A option 5. It has an E/A header, without a TIFILES wrapper. For a debugger,
load `benchmark.bin` at CPU `>A000` and start there.

The [E/A test kit](hardware-test-kit.md) already has **ROM1.UGBENCH** and
**ROM1.CPUBENCH**. Run each separately and photograph the results. Look for
**DATA CHECK: PASS**. Failed data checks or timer overflow invalidate timings.
Reset when done.

The test takes over the screen and timer and overwrites its RAM buffers.
It doesn't write EEPROM. Run it with no unsaved work in those buffers.

## What the numbers mean

Lower is faster. Each row totals 256 samples:

| Row | Total work |
| --- | --- |
| EMPTY SAMPLE | Timer and call overhead with no RAM work |
| BYTE READ / WRITE | 4,096 byte operations per row |
| WORD READ / WRITE | 4,096 word operations per row |
| READ 256 / WRITE 256 | 65,536 bytes per row |
| FILL 256 | 65,536 bytes filled |

At 3 MHz, **46,875 ticks = one second**. Convert your eight screen totals with:

```text
python tools/timing.py EMPTY BYTE_READ BYTE_WRITE WORD_READ WORD_WRITE READ256 WRITE256 FILL256
```

Use decimal numbers in that order. The tool shows seconds and rates, with
and without the empty-sample overhead. Call setup and loops still cost time.
Use `--mhz` for a different CPU clock.

Block calls start at `>66C0` and cross the RAM page boundary. Native copies
use MOVB loops; tuned word copies could be faster. Setup and library checks
are timed, while screen output and data checking are outside the timer.
The data pattern is `>5A`; the ABI tests cover changing patterns and bounds.

The TMS9901 timer keeps counting during GROM waits even with interrupts off.
Overflow is checked per sample. Compare repeated runs on the same setup;
emulator timings omit real bus and AVR delays. See the
[hardware totals](hardware-results.md#recorded-speed-screen) and the
[timer reference](https://www.unige.ch/medecine/nouspikel/ti99/tms9901.htm#Timer).

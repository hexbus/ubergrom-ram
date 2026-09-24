# Running the speed tests

The benchmark runs the same jobs four ways. Pick the builds that match your
hardware; you do not need a Supercart to compare UberGROM with ordinary CPU
RAM on the same console.

| Build folder | What it measures | Required buffer hardware |
| --- | --- | --- |
| direct | Native CPU instructions at >C000 | Normal 32K expansion |
| direct-supercart | Native CPU instructions at >6000 | Real writable Supercart RAM |
| supercart | Our ABI backed by CPU >6000 RAM | Real writable Supercart RAM |
| ubergrom | Our ABI backed by ATmega RAM | UberGROM with the documented mappings |

All builds also need 32K CPU expansion for the benchmark itself. The two
Supercart builds require the RAM bank to be selected before entry. They do
not select banks for you. They are not for the standard UberGROM ROM-only
CPU cartridge window.

## Load and run

Build using the [README directions](../README.md). Each folder above contains
`BENCH`, an E/A option 5 PROGRAM image, `benchmark.bin`, and listings.
Import BENCH as a PROGRAM file using your normal disk-image/transfer tool,
then load it with E/A option 5. BENCH has an E/A image header, not a TIFILES
wrapper. For a debugger, load benchmark.bin at CPU `>A000` and start there.

The program creates its own 40-column display, runs automatically, and shows
eight decimal tick totals followed by `DATA CHECK: PASS`. Reset the console
when finished. Record or photograph the screen before resetting.

This is a standalone test. It takes over the screen, CPU workspace and console
timer, and overwrites the selected volatile 8K buffer plus CPU test buffers.
Run it with no unsaved application data in that memory. It does not write
EEPROM or files. A reset is required afterward because it does not restore
the previous program's display, interrupt masks or timer setup.

For UberGROM, first follow the [mapping guide](mapping.md). A wrong mapping can
produce `DATA CHECK: FAILED`; do not treat those numbers as valid timings.

## What each row measures

Every row totals **256 separately timed samples**. Scalar samples perform 16
operations each; block samples transfer or fill 256 bytes each.

| Row | Total work |
| --- | --- |
| EMPTY SAMPLE | Sampling and indirect-call overhead, with an empty routine |
| BYTE READ / BYTE WRITE | 4,096 byte operations per row |
| WORD READ / WORD WRITE | 4,096 word operations per row |
| READ 256 / WRITE 256 | 65,536 bytes per row |
| FILL 256 | 65,536 bytes filled |

Scalar reads return the last value; this is not a checksum benchmark. All
data starts as `>5A`; byte and word writes use the same pattern. The data check
after each row confirms the scalar word and complete block can be read back.
The separate ABI tests exercise changing patterns and edge cases.

Block operations start at virtual `>66C0`, crossing the physical RAM page
boundary on each call. The direct 32K build uses the corresponding offset
within its CPU buffer. Direct copies use MOVB loops so the byte-oriented work
is comparable; a tuned native word-copy routine could be faster.

Setup, call, loop and library validation costs are included. Screen output
and data verification are outside the timed samples. Direct code does not
perform the library's checks or context preservation: the comparison shows
the real cost of choosing the API, not equal instruction counts.

## Convert ticks to time

On a standard 3 MHz TI-99/4A, one timer tick is 64 CPU clock periods:
**46,875 ticks per second**. This comes from the TMS9901 timer's divide-by-64
clock, described in the [hardware reference](https://www.unige.ch/medecine/nouspikel/ti99/tms9901.htm#Timer).

Enter the eight numbers from the screen in order:

```text
python tools/timing.py EMPTY BYTE_READ BYTE_WRITE WORD_READ WORD_WRITE READ256 WRITE256 FILL256
```

Replace those names with decimal numbers. The tool shows gross seconds,
seconds after subtracting EMPTY SAMPLE, and operations/second or KiB/second.
That subtraction removes common sampling overhead; loop and setup costs
remain. A result close to the empty sample is too coarse for a useful rate.
For a changed CPU clock, supply its actual frequency with `--mhz`.

Repeat runs and compare on the same console, RAM expansion and cartridge
configuration. Small differences include timer quantization: the timer has
about 21.33 microseconds per tick at 3 MHz.

## Why this timer

Library calls temporarily disable interrupts, so a clock maintained by the
console's interrupt routine could miss time. The benchmark polls the hardware
TMS9901 timer instead. It counts while the CPU waits on the GROM interface.

Each sample starts with the 14-bit maximum timer value. Only its interrupt
source is enabled in the TMS9901; CPU interrupts remain disabled. The finish
read includes the interrupt-pending bit. A timer wrap produces
`TIMER OVERFLOW - RESULT INVALID` rather than a falsely short measurement.
At 3 MHz, a sample must finish within roughly 0.35 seconds. The short samples
avoid timing a whole 8K transfer inside one timer period.

The program stops and acknowledges the timer afterward and leaves it in I/O
mode. It never writes the TMS9901 software-reset bit in timer mode.

## Emulator results are a separate kind of evidence

`node tests/benchmark.cjs BUILD_DIRECTORY` runs all four assembled programs
through the pinned CPU and TMS9901 models and verifies 8,192 timed samples,
the decimal display, buffer ownership, and the overflow and bad-RAM paths.
It writes `benchmark-verification.json` and text captures of the screens.

Those numbers omit CPU bus wait states and real GROM/AVR timing. They prove
the test programs run and report their modeled timer values; **they are not
hardware speed results**. No physical timing results have been recorded yet.

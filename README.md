# UberGROM RAM for the TI-99/4A

Have an UberGROM cartridge and need some extra room for data? This gives your
assembly program an **8K RAM buffer**, with calls to read, write, copy and fill
it. The library handles the GROM ports for you. It can also be built to use
real Supercart RAM with the same calls.

I wanted a simple way to use that RAM for scratch information, tables or a
small document. Your program still runs in CPU memory. The buffer holds data,
and its contents are lost when you turn the console off.

## What can I use it for?

- Keep a small document or source file while you edit it.
- Store maps, item lists, dialogue or lookup tables for a game.
- Hold temporary results or data you'll need again later.
- Keep data in the cartridge instead of using more of the console's VDP RAM.

Keep a working copy here to avoid loading the same data from disk or cassette
over and over. UberGROM RAM holds that working copy; UBE1 or another storage
device keeps the data after power-off. Save anything you want to keep.

Read the part you need into CPU RAM, work on it there, then write it back.
This works best for data you can move in chunks. Keep frequently updated
variables and time-critical work in CPU RAM. It doesn't add space for CPU
instructions or automatically give BASIC more memory.

**The current library and examples need writable CPU RAM; our examples use
the 32K expansion.** A bare-console cartridge could use the UberGROM RAM with
software written for that setup, but this isn't a ready-made bare-console
library. See the [memory requirements](docs/abi.md#cpu-buffers-and-ownership).

## How fast is it?

On my TI-99/4A with a Corcomp 32K sidecar, the library read about **9.5 KB/sec**
and wrote about **8.5 KB/sec**, using 256-byte blocks. That's roughly **27 ms
to read a block** or **30 ms to write one**, including the benchmark's call
and loop overhead. Here, KB means 1,000 bytes.

Individual byte calls managed about **550 reads or 544 writes per second**.
Each call does the setup and restoration again, so use block calls when you
can. These are speeds for the current RAM library, not ROM1 loads or EEPROM
saves. The [hardware results](docs/hardware-results.md#recorded-speed-screen)
have the measurements and the [benchmark guide](docs/benchmarks.md) explains
how to run it yourself.

The reason to use it is the extra room. We haven't measured VDP RAM alongside
it on hardware yet, so there's no measured hardware speed ratio to claim.
We haven't benchmarked it against mass-storage devices either; the benefit
is avoiding repeated storage access, not a claim that it beats every device.

## How to use it

Pass an address from `>6000` through `>7FFF` to the library. These are buffer
addresses; an ordinary `MOV` to CPU `>6000` will not reach the UberGROM RAM.

```asm
       LI   R0,>6000        * Where to put it in the buffer
       LI   R1,>1234        * Value to store
       BL   @UGPUTW
       MOV  R3,R3          * Zero means it worked
       JNE  ERROR

       LI   R0,>6000
       BL   @UGGETW        * Read it back into R1
       MOV  R3,R3
       JNE  ERROR
```

Start with the [RAM mapping](docs/mapping.md), then the
[complete example](examples/buffer.asm). The [call reference](docs/abi.md)
has the registers and error codes. There are also
[side-by-side Supercart examples](docs/comparisons.md) and
[speed tests](docs/benchmarks.md).

The UberGROM benchmark and all nine RAMTEST stages passed on my Corcomp 32K
setup. Supercart has emulator tests but still needs a hardware run.
See [hardware results](docs/hardware-results.md) for the details.

## Build it

You need Python 3.10+, Git and Node.js 20+.

```text
python tools/fetch-deps.py
npm ci --ignore-scripts
python tools/build.py
npm test
```

This builds both versions under `build/`. Import **EXAMPLE** as a TI PROGRAM
file and load it with E/A option 5. It has an E/A image header, without a
TIFILES wrapper. The example leaves `STATUS` at `>600D` when it succeeds and
loops at `DONE`; use the listing to find them. It has no screen display.
For a visible test, use [RAMTEST or BENCH](docs/hardware-test-kit.md).

The `.bin` files are CPU code at `>A000`, not GROM images.
[Build options and test commands](docs/verification.md) are listed separately.

## Credits

**2026 Hexbus (hexbus)** — [GitHub](https://github.com/hexbus) ·
[www.hexbus.com](https://www.hexbus.com)

Thanks to **Tursi (Mike Brent)** for UberGROM, its firmware and examples, and
**Fred** for the original cartridge storage discussions. We use Ralph
Benzinger's xdt99 and Rasmus Moustgaard's js99er to build and test the code.

Code and examples: [Apache 2.0](LICENSE-CODE.txt).
Documentation: [CC BY 4.0](LICENSE-DOCUMENTATION.md).
Please keep the `2026 Hexbus` signature and the applicable
[credits and notices](NOTICE.txt).

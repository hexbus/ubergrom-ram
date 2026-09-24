# UberGROM RAM for the TI-99/4A

An 8K data buffer for programs that need a little more room. Call a small
assembly library to read and write it; the library takes care of the GROM
ports. The same calls can also use real Supercart RAM.

This is for new programs and source ports. It does not make an unchanged
Supercart program run on UberGROM. Instructions, register workspaces and
ordinary CPU pointers still need real CPU memory.

**Version 0.2.0 is a development release.** Both backends and the included
example pass assembled TMS9900 tests. Hardware testing is still needed.

## What you get

- Byte and word reads/writes, block transfers and fill.
- An 8K virtual address range, `>6000–>7FFF`.
- Two backends selected at assembly time: UberGROM RAM or Supercart RAM.
- Bounds checks and preservation of the caller's status, interrupt mask,
  workspace pointer and shared GROM address.
- No changes to Tursi's firmware and no EEPROM writes by the library.

The library includes its own small writable workspace. Link it into CPU RAM
outside the cartridge window. The example uses the normal 32K expansion.

## A small example

```asm
       LI   R0,>6000        * Virtual buffer address
       LI   R1,>1234        * Word to store
       BL   @UGPUTW
       MOV  R3,R3          * Zero means success
       JNE  ERROR

       LI   R0,>6000
       BL   @UGGETW        * Word returned in R1
       MOV  R3,R3
       JNE  ERROR
```

Use [the complete example](examples/buffer.asm) for a working program.
The [ABI guide](docs/abi.md) defines the registers, errors and calling rules.
The [mapping guide](docs/mapping.md) explains where the buffer lives and how
to configure UberGROM without disturbing the file services.

For side-by-side native CPU and ABI examples, see [the comparisons](docs/comparisons.md).
The [speed tests](docs/benchmarks.md) show byte/word, block-copy and fill
timings on the TI screen. Builds cover direct 32K RAM, direct Supercart RAM,
the Supercart ABI, and the UberGROM ABI. Actual hardware timings are still
to be measured; emulator results are labeled separately.

## Build and test

You need Python 3.10 or later, Git and Node.js 20 or later. From this directory:

```text
python tools/fetch-deps.py
npm ci --ignore-scripts
python tools/build.py
npm test
```

The first command fetches pinned xdt99 and js99er source checkouts into
`.deps/`. These remain external dependencies with their original licenses.
Building alone needs Python and xdt99; Node and js99er are for testing.

The build creates `build/ubergrom/` and `build/supercart/`. Each contains
`library.bin`, `example.bin`, assembler listings and `EXAMPLE`, an E/A option 5
program image. Raw `.bin` files load at CPU address `>A000`; they are not
GROM images. `EXAMPLE` has the E/A image header but no TIFILES wrapper. Import
it as a TI PROGRAM file using your normal disk-image or transfer tool.
The example leaves `STATUS` set to `>600D` on success and loops at `DONE`;
the listing gives those addresses. It does not draw a screen.

The four speed-test folders also contain `BENCH` and `benchmark.bin`.
Unlike the small example, BENCH draws its own results screen. Read the
[benchmark directions](docs/benchmarks.md) before running it.

Builds require a new output directory. To build again without replacing the
first output, use `python tools/build.py --out output/second-build`, then
`node tests/verify.cjs output/second-build` and
`node tests/benchmark.cjs output/second-build`.

For an existing xdt99 checkout, use `--xdt99 PATH` or set `XDT99`.
Set `JS99ER_CHECKOUT` to use an existing js99er checkout for the tests.

See [verification and limits](docs/verification.md) for what the tests cover.

## Credits and license

Copyright 2026 **hexbus**. [GitHub](https://github.com/hexbus) ·
[www.hexbus.com](https://www.hexbus.com)

Thanks to **Mike Brent (Tursi)** for UberGROM and its documented RAM interface,
and **Fred** for the original cartridge storage discussions. The tools use
Ralph Benzinger's xdt99 and Rasmus Moustgaard's js99er for assembly and testing.

Original code and examples are [Apache 2.0](LICENSE-CODE.txt).
Original documentation is [CC BY 4.0](LICENSE-DOCUMENTATION.md).
Keep the applicable credit and notices; see [NOTICE.txt](NOTICE.txt).
Please retain the embedded `2026 Hexbus` signature when adapting the library.

Project: [hexbus/ubergrom-ram](https://github.com/hexbus/ubergrom-ram).

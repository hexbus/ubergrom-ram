# Building and testing

Use the [README build steps](../README.md) first. `fetch-deps.py` gets pinned
xdt99 and js99er revisions in `.deps/`. Building needs Python and xdt99;
Node.js and js99er are for the tests.

For an existing assembler checkout, use `--xdt99 PATH` or set `XDT99`.
Set `JS99ER_CHECKOUT` to use an existing emulator checkout.

Builds use a new output directory. For another build:

```text
python tools/build.py --out output/next-build
node tests/verify.cjs output/next-build
node tests/benchmark.cjs output/next-build
python -m unittest discover -s tests -p test_build_guards.py
```

## What's checked

Both RAM versions pass 326 assembled-code scenarios covering byte/word and
block operations, bounds, page crossings, workspace restoration and shared
GROM state. The four benchmarks check their displayed totals and error paths.
The build guards reject mixed source versions and incompatible kit inputs.
CI runs these checks on pushes and pull requests.

These tests model the ports; they don't reproduce electrical timing.
[Hardware results](hardware-results.md) are recorded separately.
Build hashes and full results are in each build directory.

## Cartridge DSR coexistence

The optional test alternates **59 file operations and 111 RAM calls**, checking
that the DSR and application buffer leave each other's RAM alone. It covers
PROGRAM and record files, save/reload, catalog, delete and error returns.

It needs the separate `adventure-ubergrom` checkout, its working console
emulator environment, and an E/A build containing `manifest.json`,
`service.bin` and `reader.bin`:

```text
python tools/build-dsr-fixture.py --dsr-repo DSR_REPO --dsr-build EA_BUILD --out output/dsr-test
node tests/dsr-coexistence.cjs build output/dsr-test DSR_REPO
```

The fixture uses synthetic files and disposable EEPROM under `output/`.
It isn't a cartridge image to program. The harness corrects the emulator's
prefetched-byte selection at an 8K page boundary; it doesn't repair RAM or
GROM state between calls. It tests shared-memory use, not an application's
CPU-to-GPL bridge.

The [full review record](../tests/results/hardware-review-20260924.json) also
covers RAMTEST, the editor preview and the historical fault probes. Keep the
full 6,400-byte DSR reservation even if a particular test uses less.

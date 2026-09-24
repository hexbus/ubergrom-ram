# Verification

The test suite executes the assembled library in js99er's TMS9900 CPU core.
It runs both the UberGROM backend and the real-RAM backend against the same
calling contract, then runs the shipped example with each backend.

The initial suite contains 172 scenarios covering:

- Byte values, word endianness and both ends of the virtual address range.
- Full 8K read, write and fill, including the physical RAM page crossing.
- Odd CPU byte-buffer addresses and buffers ending at `>3FFF` and `>FFFF`.
- Rejected virtual ranges, odd words, invalid CPU buffers and zero counts.
- Preservation of ST, interrupt mask, WP and R12–R15.
- Restoration of the shared GROM address, including page-edge addresses.
- No changes to the reserved DSR RAM or the unused 768 bytes.
- No CPU cartridge writes by the UberGROM backend and no GROM transactions
  by the Supercart backend.

The [benchmark suite](benchmarks.md) additionally runs four complete speed-test
programs, totaling 8,192 timed samples. It checks the displayed decimal totals
against stored values, exercises timer overflow and incorrect RAM data, and
verifies timer shutdown. These remain modeled runs, not hardware measurements.

`tools/fetch-deps.py` records the exact xdt99 and js99er revisions. The builder
records binary hashes and symbol addresses in `manifest.json`; the test
runner writes its cases and result to `verification.json` in the build folder.
The GitHub workflow rebuilds and tests on each push.

The GROM ports and ATmega RAM handler are modeled. This is **not** AVR firmware
execution, electrical timing validation, a full E/A cartridge integration
test, or a hardware speed measurement. The suite does not claim an existing
Supercart application has been ported.

Hardware qualification remains: configure base 13, run the example and buffer
edge tests, then alternate library calls with E/A ROM1 loads and UBE1 saves.
Confirm a live program's interrupt responsiveness with its chosen chunk size.
The development release must retain its untested-on-hardware label until
those checks have been completed.

## Cartridge DSR coexistence

The DSR is a useful independent user of the same physical RAM. It already
accesses its private RAM from GPL; there is no need to rewrite it around this
assembly ABI to test coexistence.

**Passed: 59 DSR operations interleaved with 111 library calls.** The test
uses the unchanged E/A development service and CF02 reader, a synthetic
ROM1 filesystem, and a fresh disposable UBF1 EEPROM image. All three share
one modeled ATmega RAM buffer, with the [allocation in the mapping guide](mapping.md#physical-allocation).

- Fill and compare all 8K using three address-dependent patterns.
- Load an 8K ROM1 PROGRAM file and read ROM1 DIS/FIX 80 records.
- Keep ROM1 input and UBE1 output files open while transferring records
  through the library, including across its physical RAM page boundary.
- Reopen the UBE1 DIS/VAR 80 file and compare every saved record.
- Save and reload a PROGRAM file staged through the library.
- Catalog and delete temporary files; check end-of-file and missing-file errors.
- Preserve a separate saved file, the protected configuration bytes, and
  the unused 768 RAM bytes throughout the run.

Every DSR operation is followed by a full 8K library-buffer comparison.
Every library call checks that the DSR's live RAM, GPL scratchpad, CPU ROM
bank and EEPROM are unchanged, and that the shared GROM address is restored.
Logged RAM writes also check ownership in both directions. The highest DSR
write observed was physical `>1755`; that does **not** shrink its `>1900`-byte
reservation, since this workload does not exercise every DSR path.

The [recorded result](../tests/results/dsr-coexistence.json) includes all
operations, component hashes and the emulator revision. The library binary
is unchanged from version 0.2.0. The frozen Adventure runtime is unchanged.

### Repeating the optional test

This needs the separate `adventure-ubergrom` development checkout and an
existing E/A/CF02 build containing `manifest.json`, `service.bin` and
`reader.bin`. Its full js99er test environment must already work; the minimal
CPU-only dependencies fetched by this library are not enough for console GPL.
Use your paths in place of `DSR_REPO` and `EA_BUILD`:

```text
python tools/build-dsr-fixture.py --dsr-repo DSR_REPO --dsr-build EA_BUILD --out output/dsr-test
node tests/dsr-coexistence.cjs build output/dsr-test DSR_REPO
```

Run the normal library build first. The fixture builder requires a new output
directory and reads the external build without changing it. It copies only
the service components into the local test fixture; no OEM cartridge or
adventure files are needed as inputs. The external emulator supplies its
console ROM/GROM. The fixture and EEPROM remain under ignored `output/` and
are not cartridge programming images or release contents.

### What this test does and does not prove

The CPU emulator executes our library, console GPL and actual DSR binaries.
The harness enters the CPU library between complete GROM transactions and
resumes the GPL caller afterward. It restores only CPU execution state; it
does not repair RAM, scratchpad, GROM state, EEPROM or ROM banking to make
the next operation succeed. This tests coexistence, not an application's
CPU-to-GPL calling bridge or the E/A editor itself.

The test adapter corrects a js99er device-selection edge case at `>7FFF`:
the console address counter has already wrapped when the final prefetched
cartridge byte is read. It selects the device by that byte's address. The
unmodified dispatcher returned one wrong byte in the initial full-buffer
comparison; the physical RAM write was correct. This is a model correction,
not a change to the library or DSR.

The EEPROM profile retains the DSR's required rollover setting. This model
does not independently validate the AVR firmware's rollover implementation,
electrical timing or EEPROM write delays. Hardware coexistence testing is
still needed. This optional suite is separate from public CI because it uses
the external development DSR build and full console emulator environment.

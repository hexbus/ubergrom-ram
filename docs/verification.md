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

## Next integration test: the cartridge DSR

The DSR is a useful independent user of the same physical RAM. It already
accesses its private RAM from GPL; there is no need to rewrite it around this
assembly ABI to test coexistence.

1. Fill all 8K of the application buffer through the library with an
   address-dependent pattern, including both sides of the physical page break.
2. Load a known file through ROM1, and verify its contents in a CPU/VDP buffer
   that does not overlap the library or the running program.
3. Create a new temporary UBE1 file with a small payload staged through the
   library, close it, reopen/load it, and compare the payload.
4. Read and compare all 8K of the library buffer after each DSR operation.
   Write/read a second pattern and repeat, so stale or aliased data is detected.
5. Check a catalog and another file operation still work. Remove only the
   temporary file created by this test; preserve existing saves and config.

This would test physical RAM ownership, shared GROM address restoration and
file-service coexistence in both directions. It is planned, **not yet run**.
Use a development cartridge/profile; no change to the frozen Adventure DSR
is required. Successful filesystem operations are the DSR-side check: its
private workspace is expected to change while it works.

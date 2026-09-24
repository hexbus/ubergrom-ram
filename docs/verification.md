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

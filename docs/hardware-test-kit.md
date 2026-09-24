# Try it on the TI

Use the E/A cartridge test kit and a normal 32K expansion. The three test
programs are on ROM1, so you don't need a disk to load them.

## Programming files

Use the matching E/A files supplied with your kit:

| Destination | File |
| --- | --- |
| External 512K ROM | ea-rom512k.bin |
| ATmega1284P Flash, 128K | ea-atmega1284p-flash.bin |
| ATmega EEPROM, 4K — initial setup | ea-atmega1284p-eeprom.bin |

Fuses: **low C2, high D8, extended FF**. HEX versions contain the same bytes.
The optional 132K file is Flash followed by EEPROM; it needs a programmer
that understands that layout.

Keep your existing EEPROM when updating the same module. Programming the
initial EEPROM replaces its configuration and saved files, so back it up
before changing modules. The test kit already includes the
[base 13 RAM mappings](mapping.md).

## RAMTEST

1. Choose **Editor/Assembler → 5, RUN PROGRAM FILE**.
2. Enter **ROM1.RAMTEST**.
3. Look for **TEST 2**, **RAM AND FILE CHECK: PASS**, and **STAGE: 9**.
4. Reset to leave.

The test writes patterns across all 8K and checks them between file operations.
It uses **UBE1.UGRAMT1** as a temporary save. If that file already exists,
it stops before writing. Back it up or remove it yourself before retrying.
An interrupted test may leave it behind. Don't erase EEPROM to rerun the test.

| Stage | Check |
| --- | --- |
| 1 | Temporary filename is unused |
| 2 | First 8K RAM pattern |
| 3 | ROM1.RAMDATA load; RAM still intact |
| 4 | UBE1 save; RAM still intact |
| 5 | Reload and compare |
| 6 | Second 8K RAM pattern |
| 7 | Saved file survives the changed pattern |
| 8 | Delete the temporary file |
| 9 | Confirm deletion and check RAM again |

This overwrites the application RAM buffer. Run it on its own, without
unsaved work. It tests PROGRAM files; record-file tests are separate.

## Speed tests

After resetting, load **ROM1.UGBENCH** through option 5. Then reset and run
**ROM1.CPUBENCH** for the ordinary CPU RAM comparison. Both should show
**DATA CHECK: PASS**. The [speed guide](benchmarks.md) explains the numbers.

If something fails, send the screen photo, program name and your 32K setup.
For RAMTEST, include the stage and operation shown.

## Building a kit

`tools/build-hardware-kit.py` takes `--dsr-repo`, `--module-pack`,
`--library-build` and a fresh `--out` under the DSR repository's `output/`.
Use verified module and library builds. Then run:

```text
node tests/hardware-kit.cjs KIT DSR_REPO LIBRARY_BUILD
```

The builder adds the tests and RAM mappings to a copy of the E/A cartridge.
Original module files and firmware come from the separate DSR project;
they aren't included in this library repo. Follow that project's directions
for the other cartridges.

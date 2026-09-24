# UberGROM hardware test kit

Start with **Editor/Assembler**. Its cartridge has the RAM test and speed tests
on ROM1, so you do not need a disk to load them. The other three cartridges
are for checking their module-specific load/save behavior afterward.

These are development images. The programs have passed emulator checks;
your hardware results are the next step. The working Adventure cartridge
is separate and has not been changed.

## What is in the kit

| Folder | Cartridge and purpose |
| --- | --- |
| ea | Editor/Assembler, both original support disks including TOMB, plus our RAM and speed tests |
| retpirat | Return to Pirate's Isle, with UBE1 save/restore |
| tiwriter | TI Writer editor, formatter and support files on ROM1 |
| multiplan | Multiplan support files, help and overlays on ROM1; small worksheets on UBE1 |
| test-programs | Separate E/A option 5 test images and RAMTEST listings |

Use one cartridge profile at a time. E/A, TI Writer and Multiplan need the
normal 32K expansion. The RAM tests also require it. Return's save/restore
does not require the 32K expansion.

## Program the E/A test cartridge first

Use these three matching files from `ea/`:

| Destination | File |
| --- | --- |
| External 512K U2 ROM | ea-rom512k.bin |
| ATmega1284P Flash, 128K | ea-atmega1284p-flash.hex |
| ATmega1284P EEPROM, 4K | ea-atmega1284p-eeprom.hex |

The Flash and EEPROM `.bin` files contain the same bytes as their HEX files.
The `combined132k.bin` is Flash followed by EEPROM for programmers that
explicitly support that layout. Do not write all 132K into Flash.

Use a development cartridge, or back up the existing EEPROM first.
**Programming the supplied EEPROM replaces its configuration and saved files.**
It contains an initialized empty UBF1 volume. The kit does not program
anything automatically.

Keep the known working ATmega1284P fuse settings: **low C2, high D8,
extended FF**. The original UberGROM firmware region is unchanged.

The E/A test EEPROM already adds RAM page 0 at `>6000` and page 1 at `>8000`
on base 13. Its existing DSR mappings and rollover setting are preserved.
There is no GROMCFG setup step when using these matching kit files.

## 1. RAM and file test

1. Select **EDITOR/ASSEMBLER**, then **5 — RUN PROGRAM FILE**.
2. Enter **ROM1.RAMTEST** and press Enter.
3. Wait for **RAM AND FILE CHECK: PASS**. A successful run ends at stage 9.
4. Photograph the result, then reset the console.

RAMTEST writes and verifies two patterns across the entire 8K application
buffer. Between checks it loads ROM1.RAMDATA and saves, reloads and deletes
the temporary PROGRAM file **UBE1.UGRAMT1**. It checks the file again after
changing the RAM pattern, so it cannot pass by merely reading stale buffer data.

If UGRAMT1 already exists, the test stops before writing. It does not erase
an existing file to make room. Inspect or back it up with FILES first. Delete
it only if you know it is leftover test data, then run RAMTEST again. An
interrupted or failed test may leave this file behind. Other errors during
the initial existence check also stop the test.

The test overwrites the library's volatile 8K buffer and its CPU/VDP work
areas. Run it on its own, with no unsaved application data. It requires a
reset afterward. It is built for this E/A development profile, not for an
arbitrary cartridge's GPL entry addresses.

If it fails, send the screen photo and stage:

| Stage | Check |
| --- | --- |
| 1 | Temporary filename is unused |
| 2 | First full 8K RAM pattern |
| 3 | ROM1 data load and RAM preservation |
| 4 | UBE1 save and RAM preservation |
| 5 | UBE1 reload and data comparison |
| 6 | Second full 8K RAM pattern |
| 7 | Original saved file survives the changed RAM pattern |
| 8 | Delete the test file and recheck RAM |
| 9 | Confirm the test file is gone and recheck RAM |

This hardware test uses PROGRAM files. The separate automated coexistence
suite also exercises open record handles; a RAMTEST pass alone does not
establish that every record or module workflow works on hardware.

## 2. Speed comparisons

After resetting, use E/A option 5 for each of these:

- **ROM1.CPUBENCH** — ordinary 32K CPU RAM, for the baseline.
- **ROM1.UGBENCH** — the same work through the UberGROM RAM library.

Each shows eight tick totals and **DATA CHECK: PASS**. Photograph both screens
on the same console. Reset between programs. A failed data check or timer
overflow makes the timing invalid. These tests do not write EEPROM.

The kit also includes `SCBENCH` and `SCDIRECT` in `test-programs/` for someone
with actual writable Supercart RAM. They are not for the standard UberGROM
ROM window. Import them as PROGRAM files and run with E/A option 5 on that
hardware, with its RAM bank selected. These files have E/A image headers;
they do not have TIFILES wrappers.

The [benchmark guide](https://github.com/hexbus/ubergrom-ram/blob/main/docs/benchmarks.md)
explains the rows and tick conversion. The RAM library buffers data; it does
not make the ATmega RAM executable CPU memory.

## 3. Check the modules

Keep the matching ROM, Flash and EEPROM files together when changing
cartridge profiles. Each folder has its own programming README. The three
non-E/A profiles are the previously tested development images, unchanged.

**Editor/Assembler:** choose EDIT, type a short document and save it as
`UBE1.EATEST`. Power off/on and reload it. Then choose ASSEMBLE, answer Y
to LOAD ASSEMBLER, use `ROM1.RAMSOURCE` as source and `UBE1.OBJECT` as object
output. Leave listing filename and options blank. This tiny source should
assemble with zero errors. For TOMB, select LOAD AND RUN (option 3), enter
`ROM1.TOMB`, leave the next filename blank, then enter `TOMB` as the program
name. It should reach the difficulty menu.

**Return to Pirate's Isle:** play far enough to change your position, then
save to `UBE1.PIRATE`. Power off/on, choose to reload a game, and use that
same name. Confirm the saved position. It has no support-file disk to load.

**TI Writer:** load the editor, enter HELLO WORLD and use File / SF to save
`UBE1.WRTEST`. Power off/on and use File / LF to reload it. Save another copy
as `UBE1.WRCOPY`. To check the formatter, give it `ROM1.PRACTICE` as input and
`UBE1.PRINT` as output; answer N to additional input, accept the default
formatting options, start at page 1 and answer N to pausing between pages.
This writes a file; TP/PIO printer interception is not part of this kit.

**Multiplan:** enter 123 in the first cell with Value, then use Transfer /
Save and name it `SMALL`. Names default to UBE1. Power off/on and use Transfer /
Load / SMALL. Confirm the cell still contains 123, then try Help to exercise
ROM1.MPHLP. Start with this small sheet; EEPROM capacity is limited.

On each profile, also try FILES and TI BASIC `CALL CAT("UBE1")`. On E/A,
TI Writer and Multiplan, try `CALL CAT("ROM1")`. BASIC can delete a disposable
test save with `DELETE "UBE1.EATEST"`, using a filename you actually created.
Do not reprogram the blank EEPROM between a save and its power-cycle reload.

## What to send back

Send the module name, console/32K setup, PASS or failure-stage photo, and
both benchmark screens. For a module failure, include the operation and
filename. The module tests are independent: a RAM benchmark passing does
not prove that a worksheet or document reload works.

Tunnels of Doom, TP/PIO redirection and cassette interception are not included.

## Build record

The local kit is prepared with `tools/build-hardware-kit.py` from verified
module programmer files and a verified library build. It preserves all
existing E/A ROM1 files, adds the five test files, and adds only the two base
13 RAM mappings. The E/A Flash/firmware is unchanged. `kit-build.json` records
the additions, and `SHA256SUMS.txt` covers the completed kit.

`tests/hardware-kit.cjs` boots E/A and loads RAMTEST, UGBENCH and CPUBENCH
through option 5. It also checks bad RAM and an existing temporary file.
Results are emulator/model evidence, not hardware certification.

The public RAM-library repository contains the test sources and builder.
This local cartridge kit also contains the supplied original modules and
UberGROM firmware; it is separate from the public library release ZIP.

2026 Hexbus — [GitHub](https://github.com/hexbus) — [www.hexbus.com](https://www.hexbus.com).
Thanks to Tursi and Fred. Original modules, support files and firmware retain
their original ownership and notices.

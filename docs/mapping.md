# Setting up the RAM

This layout gives the library 8K alongside the E/A/CF02/UBE1 file services.
It uses Tursi's existing RAM handler; there is no firmware change.

## GROMCFG settings

With bases enabled, add these mappings on **base 13**:

| GROM address | Device | RAM page |
| --- | --- | --- |
| >6000 | RAM | 0 |
| >8000 | RAM | 1 |

The read-data port is `>9834`. Keep the existing bases 0, 1, 14 and 15,
module header mirrors, firmware interface and EEPROM/Flash mappings.
The E/A/CF02 DSR needs **rollover ON** (`>05, >FA`). Leave that setting alone.
If base 13 is already used, this layout needs adapting first.

Use GROMCFG to add the mappings to your cartridge. Replacing its EEPROM
would also replace your saved files. The library itself never writes EEPROM.
The E/A test kit already has these mappings; see [running the tests](hardware-test-kit.md).

## Physical allocation

UberGROM exposes 15,360 bytes: an 8K page and a 7K page.

| RAM-buffer offset | Bytes | Use |
| --- | --- | --- |
| >0000–>18FF | 6,400 | Reserved for the file services |
| >1900–>38FF | 8,192 | Our application buffer |
| >3900–>3BFF | 768 | Unused by this library |

Base 13 and base 14 see the same physical RAM. The library skips the DSR's
reserved area; this is a shared layout, not hardware memory protection.
Check the reservation when pairing it with a different DSR. Only one
application can own the buffer at a time.

| Address passed to the library | GROM address on base 13 | RAM offset |
| --- | --- | --- |
| >6000–>66FF | >7900–>7FFF | >1900–>1FFF |
| >6700–>7FFF | >8000–>98FF | >2000–>38FF |

The library handles that page crossing for you. Clear the buffer with UGFILL
if you need zeros; don't assume power-up or reset clears it. Use UBE1 or
another file device when you want to keep the data after power-off.

Firmware reference: Tursi's [RAM handler](https://github.com/tursilion/ubergrom/blob/main/ram.c).

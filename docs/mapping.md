# Where the 8K buffer lives

This profile adds a data buffer alongside the current E/A/CF02/UBE1 module
services. It uses Tursi's existing RAM handler. No firmware modification,
EEPROM formatting or ROM1 bank switching is needed to access the buffer.

## GROMCFG settings

Keep bases enabled and preserve the cartridge's existing mappings. On
**base 13** (read-data port `>9834`), add these two mappings:

| GROM slot address | Handler | Physical RAM page |
| --- | --- | --- |
| >6000 | RAM | 0 |
| >8000 | RAM | 1 |

These are GROM addresses, not CPU RAM addresses. Preserve the existing
rollover setting: the E/A/CF02 development DSR requires global configuration
bytes `>05, >FA`, which have rollover **ON**. The library explicitly sets the
address at its RAM page crossing; it does not need rollover turned off.
Do not change bases 0, 1, 14 or 15, the module header mirrors, the
firmware interface, or existing EEPROM/Flash mappings. Base 13 must be
available for this use. If another device uses it, this fixed profile needs
adapting before it can be used there.

Use GROMCFG's normal configuration procedure to add these mappings to your
own cartridge. This project does not supply a replacement EEPROM image:
replacing EEPROM could erase saved files. The running library only accesses
RAM and GROM address ports; it never changes configuration or saved files.

## Physical allocation

Tursi's [ram.c](https://github.com/tursilion/ubergrom/blob/main/ram.c) exposes
15,360 bytes. Page 0 contains 8K; page 1 contains the remaining 7K. There is
not a second full 8K RAM page.

| Physical ATmega RAM-buffer offset | Bytes | Owner |
| --- | --- | --- |
| >0000–>18FF | 6,400 | Reserved for the current module file services |
| >1900–>38FF | 8,192 | This library's application buffer |
| >3900–>3BFF | 768 | Unused by this library |

The first reservation matches the E/A/CF02 development profile documented in
`adventure-ubergrom/docs/module-integrations.md`. It is a compatibility
allocation, not firmware-enforced memory protection. Confirm it if combining
this library with a different DSR version. Other applications must not use
this buffer at the same time.

Base 13's page 0 mapping aliases the same physical RAM used by the services
on base 14. This is deliberate; the library skips their reserved bytes.
It accesses only the following ranges:

| Virtual ABI address | GROM address, base 13 | Physical offset |
| --- | --- | --- |
| >6000–>66FF | >7900–>7FFF | >1900–>1FFF |
| >6700–>7FFF | >8000–>98FF | >2000–>38FF |

The library joins these pieces into a single 8K buffer. A transfer crossing
virtual `>66FF` explicitly sets the GROM address to `>8000` for the next byte.
Callers do not need to split transfers there.

RAM is volatile and starts with unspecified contents. Clear it with UGFILL
if your program needs zeros. A reset is not an initialization guarantee.
Saving persistent data remains a separate file operation through UBE1 or
another device.

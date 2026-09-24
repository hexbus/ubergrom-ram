# RAM calls — ABI 1

Include `src/ugram.asm` once in your assembly program and assemble with xdt99's
`-R` option. Put the library and its working storage in writable CPU RAM,
outside `>6000–>7FFF`. Define `SUPERCART` to use real cartridge RAM instead.

## Calls

Use `BL @name`. Save your incoming R11 first if your routine needs it to return.

| Routine | R0 | R1 | R2 |
| --- | --- | --- | --- |
| UGGETB | Buffer address | Returns byte, 0–255 | Ignored |
| UGPUTB | Buffer address | Low byte to store | Ignored |
| UGGETW | Even buffer address | Returns word | Ignored |
| UGPUTW | Even buffer address | Word to store | Ignored |
| UGREAD | Buffer address | CPU destination | Byte count |
| UGWRIT | Buffer address | CPU source | Byte count |
| UGFILL | Buffer address | Low byte to repeat | Byte count |

The buffer runs from `>6000` to `>7FFF`. Words must start at an even address,
ending at `>7FFE`. A word of `>1234` stores `>12`, then `>34`.
**Byte calls use the low byte of R1**, unlike native MOVB.

## Results

| R3 | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Buffer address or length out of range |
| 2 | Odd word address |
| 3 | CPU transfer buffer outside the allowed RAM range |

Check R3 with `MOV R3,R3` before testing EQ. The library restores your original
status register, so EQ by itself does not tell you whether the call worked.
A returned value in R1 is valid only on success.

R0–R10 may change. R11 is the BL return link. R12–R15, WP and the full status
register, including the interrupt mask, are preserved.

Invalid calls transfer no buffer data. Buffer bounds are checked before word
alignment or CPU-buffer bounds. Block calls and fill accept a zero count at
`>6000–>8000` as a no-op; R1 is ignored. These checks don't detect missing RAM
or incorrect GROM mappings.

## CPU buffers and ownership

A nonempty CPU buffer must fit entirely within `>2000–>3FFF` or `>A000–>FFFF`.
Odd byte-buffer addresses are fine. Keep buffers clear of your code, the
library's working storage and active register workspaces; overlaps aren't
checked. VDP transfers need an intermediate CPU buffer.

The Supercart version has the same rules. Select its writable RAM bank before
calling; the library doesn't switch Supercart banks for you.

## GROM and interrupt handling

The UberGROM version saves and borrows `>8300–>831F` for its registers, then
restores those bytes and returns R1/R3 to your workspace. Your workspace may
be in expansion RAM or overlap that scratchpad area. Keep executing code and
library storage out of the borrowed area. Calls aren't reentrant.

Private working storage is **78 bytes** for UberGROM and **36 bytes** for
Supercart. It needs no initialization. The Supercart version doesn't borrow
scratchpad. The reason for the switch is in the [hardware results](hardware-results.md).

The library preserves the shared GROM address through the console GROM and
base 0, including the prefetched byte and 8K page wrap. It leaves the console's
selected-base variable alone. Call it between complete GROM operations, never
halfway through an address read or write. This assumes the normal console
GROM address behavior. Keep the [required cartridge mappings](mapping.md).

Interrupts are disabled for the whole call and restored afterward. Use 128-
or 256-byte chunks if your program needs regular interrupt service.

## Porting a Supercart program

Replace accesses to cartridge data with these calls. Keep instructions,
register workspaces and ordinary CPU pointers in real CPU memory. Existing
Supercart programs need source changes; see the [comparison examples](comparisons.md).

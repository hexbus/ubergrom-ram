# RAM ABI 1

The library presents 8K of data at virtual addresses `>6000–>7FFF`. Those
numbers are buffer addresses passed to routines. They are not CPU pointers
when using the UberGROM backend.

Include `src/ugram.asm` once in your assembly program, with the xdt99 register
option `-R`. Link the library and its writable working storage into CPU RAM,
outside `>6000–>7FFF`. Do not execute this binary as GPL or burn it as a GROM.
Define `SUPERCART` at assembly time to use real cartridge CPU RAM instead.

## Calls

Use `BL @name`. The caller must save its own incoming R11 link if needed.
`UGWRIT` is the six-character spelling of the block-write routine.

| Routine | R0 | R1 | R2 |
| --- | --- | --- | --- |
| UGGETB | Virtual byte address | Returns byte, zero extended | Ignored |
| UGPUTB | Virtual byte address | Low byte to store | Ignored |
| UGGETW | Even virtual word address | Returns 16-bit word | Ignored |
| UGPUTW | Even virtual word address | Word to store | Ignored |
| UGREAD | Virtual starting address | CPU destination address | Byte count |
| UGWRIT | Virtual starting address | CPU source address | Byte count |
| UGFILL | Virtual starting address | Low byte to repeat | Byte count |

Words are big endian: putting `>1234` stores `>12` followed by `>34`.
The highest word address is `>7FFE`. Byte operations use the **low** byte of
R1 even though the TMS9900's native MOVB convention uses the high byte.

Every routine returns a result code in R3:

| R3 | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Virtual range invalid or transfer exceeds the 8K buffer |
| 2 | Odd word address |
| 3 | CPU block buffer is outside the supported RAM windows or crosses their end |

Virtual bounds are checked first, then word alignment or the CPU buffer.
An error transfers no buffer data. No rollover or truncation is permitted.
These are argument checks, not hardware detection: a success code does not
prove the RAM mappings are installed. Configure the hardware first.
For block calls and fill, a zero count is a successful no-op at any address
from `>6000` through the one-past-end address `>8000`; R1 is not inspected.

R0–R10 are volatile except for documented outputs. R11 is the BL return link.
R12–R15, the caller's workspace pointer, and the entire status register are
preserved. Consequently, **test R3 explicitly**; the returned EQ flag does not
describe success. A byte/word result in R1 is valid only after success.

## CPU buffers and ownership

Nonempty block transfers accept CPU buffers wholly within `>2000–>3FFF` or
`>A000–>FFFF`, the usual 32K expansion RAM regions. Odd byte-buffer addresses
are allowed. Hardware providing that RAM must be present. The routine checks
addresses, not whether the RAM is physically installed.

Keep the destination/source away from the running program, library, its
working storage and all active CPU workspaces. The library does not provide
a memory allocator or validate those application-specific overlaps. Never use
it to overwrite its own instructions or return context. There is no direct
VDP transfer call; copy through a CPU buffer if needed.

The Supercart backend uses the same restrictions and error codes. Its buffer
is actual RAM at CPU `>6000–>7FFF`; the caller must select that RAM before
calling. This library does not control a particular Supercart's bank switch.

## GROM and interrupt handling

Each entry saves ST in a register, disables maskable interrupts, and then
uses its private working storage. It restores the original ST through RTWP
before returning to the caller. The temporary workspace occupies 32 bytes;
the operation and scalar buffer add four bytes. There is no allocation and
no need to initialize this private storage.

The UberGROM backend saves the common address through the console GROM,
accounts for its prefetched byte, and restores the address through base 0.
The page-preserving decrement handles `>1FFF`, `>7FFF` and `>FFFF` boundaries.
It leaves the console's selected-base variable untouched. A real, functioning
console GROM is required for the saved-address read.

Call only between complete GROM operations: there must not be a half-written
address or half-read address in progress. The normal TI console 8K address
wrapping is assumed. The tested setup uses UberGROM rollover OFF. The routine
explicitly sets the next address when crossing its physical RAM page.

Calls are synchronous. Interrupts remain disabled for the whole transfer;
use small chunks (for example 128 or 256 bytes) when your program needs regular
interrupt service. CPU emulator cycle counts do not measure real GROM wait
states, so no hardware speed claim is made.

## Porting a Supercart program

Replace every access to its cartridge data with these calls. Centralized
buffer routines are the easiest starting point. Arithmetic on virtual
addresses is fine; dereferencing them with MOV/MOVB is not. Library macros
cannot automatically replace arbitrary indirect accesses or external routines
that expect CPU pointers.

Executable instructions, TMS9900 register workspaces and self-modifying code
must remain in real CPU RAM. There is no transparent instruction trap and no
CPU interpreter in this library. A program using all of Supercart RAM for
executable code needs a different porting strategy.

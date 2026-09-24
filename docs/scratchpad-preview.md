# Scratchpad editor example

This small assembly editor keeps its document in the UberGROM RAM buffer:
100 lines of 80 characters. CPU RAM holds the editing and undo buffers.
It has emulator tests; a hardware run is still needed.

## Try it

Build the preview against your matching E/A test kit with
`tools/build-scratchpad.py --dsr-repo DSR_REPO --kit KIT --out OUTPUT`.
Use a fresh output directory under the DSR repo's `output/`.

Program the generated `ea/ea-rom512k.bin` into the external ROM. Keep the
Flash and EEPROM from that same E/A kit. You need the normal 32K expansion.
Choose **E/A option 5** and enter **ROM1.SCRATCH**.

| Key | Action |
| --- | --- |
| E or Enter | Edit the selected line; Enter keeps it, FCTN 9 cancels |
| FCTN E/X | Move up/down the list |
| FCTN S/D in the list | View columns 1–35, 36–70 or 71–80 |
| FCTN S/D while editing | Move left/right |
| FCTN 1 / FCTN 2 | Delete a character / insert a space |
| U | Undo the last committed line edit |
| W / O | Save / open a file |
| N / Q | New document / return to title screen |

Typing replaces characters. A star marks unsaved edits; undo leaves it set.
The editor asks before discarding work or replacing a file. At a filename
prompt, Enter accepts the name, typing starts a new one, FCTN S backspaces,
and FCTN 9 cancels.

Try opening **ROM1.DEMO**, edit a line, and save as **UBE1.NOTES**. Reset,
run SCRATCH again, and open your saved copy.

## Files and space

Files are **DIS/VAR 80**. Saves trim trailing spaces and stop at the highest
line edited; blank records contain one space. There is no automatic wrapping
or line insertion/deletion. The list shows 12 lines; editing shows all 80
characters in two rows.

The full document will not fit in UBE1. Start with a few short lines.
Error 4 can mean out of space, 7 means file/device not found, and this editor
uses 8 for input longer than 100 records.

Failed loads leave the document alone. Failed UBE1 saves use the DSR's abort
operation to discard the unfinished output. Emulator tests confirm that the
RAM document and previous save survive oversized output. Other devices use
normal CLOSE/error handling and haven't been tested here.

## How it uses the library

[FETCH and STORE](../examples/scratchpad.asm) turn a line number into an
address and call UGREAD or UGWRIT for 80 bytes. The document uses 8,000 bytes;
the remaining 192 are unused. Incoming files are staged in VDP memory before
replacing it.

The source also builds with Supercart RAM for editing tests. Its file-call
bridge still belongs to the E/A UberGROM setup; a standalone Supercart/disk
version would need its own bridge. The builder gets the GPL entry address
from the kit rather than assuming a fixed address.

Run `node tests/scratchpad.cjs OUTPUT DSR_REPO` to check the preview.

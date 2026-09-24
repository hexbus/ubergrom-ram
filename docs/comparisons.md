# CPU RAM and UberGROM RAM: the same jobs

Here are the changes a programmer actually makes. These examples compare
ordinary CPU instructions with our ABI. The ABI column works with either
backend; only the assembly-time selection changes.

All snippets assume the program and its workspace are in real CPU RAM,
outside the buffer. `ERROR` is the application's error handler. See the
[ABI](abi.md) for the complete register contract.

## Read a word

With real Supercart RAM:

```asm
       MOV  @>6000,R1
```

With the library:

```asm
       LI   R0,>6000
       BL   @UGGETW
       MOV  R3,R3
       JNE  ERROR
```

Both leave the word in R1. The library also validates the address and, on
UberGROM, handles the GROM transaction. That extra work costs time. We do not
expect a library call to match one native memory instruction.

## Increase a score

With real Supercart RAM:

```asm
       INC  @>6000
```

With the library:

```asm
       LI   R0,>6000
       BL   @UGGETW
       MOV  R3,R3
       JNE  ERROR
       INC  R1
       LI   R0,>6000        * Reload: R0 is volatile across library calls
       BL   @UGPUTW
       MOV  R3,R3
       JNE  ERROR
```

For a score changed every frame, keep the live value in a CPU register or
CPU RAM and store it in the buffer when needed. There is no automatic
write-through cache. This example wraps at 65535 just like INC; overflow
policy belongs to the game. The buffer itself is volatile, not a saved file.

## Copy 256 bytes out

With real Supercart RAM, using a simple byte loop:

```asm
       LI   R0,>66C0
       LI   R1,>E100
       LI   R2,256
COPY   MOVB *R0+,*R1+
       DEC  R2
       JNE  COPY
```

With the library:

```asm
       LI   R0,>66C0
       LI   R1,>E100
       LI   R2,256
       BL   @UGREAD
       MOV  R3,R3
       JNE  ERROR
```

That address deliberately crosses the UberGROM buffer's physical page
boundary. The library handles it. The CPU buffer at `>E100` must be available
for the application; it must not overlap code or a workspace.

To copy in the other direction, point R1 at the CPU source and call UGWRIT.
For a table update, copy a useful chunk into CPU RAM, make several changes
there, and write it back once. This avoids one library call per byte.

## Byte values use different halves of the register

Native MOVB uses the **high** byte. Our API takes and returns a byte in the
**low** byte so a returned value is an ordinary number from 0 to 255.

```asm
* Native CPU store of byte >5A:
       LI   R1,>5A00
       MOVB R1,@>6000

* ABI store of the same byte:
       LI   R0,>6000
       LI   R1,>005A
       BL   @UGPUTB
       MOV  R3,R3
       JNE  ERROR
```

The [benchmark source](../examples/benchmark.asm) contains assembled versions
of byte/word reads and writes, block copies and fill for all four test builds.
See [running the speed tests](benchmarks.md) to compare them on your hardware.

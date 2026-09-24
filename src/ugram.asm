* UberGROM RAM ABI 1 - Copyright (c) 2026 hexbus.
* SPDX-License-Identifier: Apache-2.0
* Include once in CPU RAM. Define SUPERCART for the real CPU RAM backend.
* R0 virtual address; R1 value/pointer; R2 block length; R3 result (0=OK).
* R0-R10 are volatile. R11 is the BL link. R12-R15, WP and ST preserved.
* Byte values use the LOW byte of R1. Words are big endian, even address.
* All validation precedes buffer access. See docs/abi.md for full contract.

UGGETB STST R10
       LIMI 0
       LI   R4,0
       LI   R2,1
       B    @UGENT
UGPUTB STST R10
       LIMI 0
       LI   R4,1
       LI   R2,1
       B    @UGENT
UGGETW STST R10
       LIMI 0
       LI   R4,2
       LI   R2,2
       B    @UGENT
UGPUTW STST R10
       LIMI 0
       LI   R4,3
       LI   R2,2
       B    @UGENT
UGREAD STST R10
       LIMI 0
       LI   R4,4
       B    @UGENT
UGWRIT STST R10
       LIMI 0
       LI   R4,5
       B    @UGENT
UGFILL STST R10
       LIMI 0
       LI   R4,6

* Six significant bytes in this dedicated return workspace restore the
* caller's full ST (including interrupt mask) without self-modifying code.
UGENT  STWP R5
       MOV  R5,@UGRWP+26
       MOV  R11,@UGRWP+28
       MOV  R10,@UGRWP+30
       MOV  R4,@UGOP
       LI   R3,1
       CI   R0,>6000
       JL   UGFAIL
       CI   R0,>8000
       JH   UGFAIL
       LI   R5,>8000
       S    R0,R5
       C    R2,R5
       JH   UGFAIL
       MOV  R2,R2
       JEQ  UGOK
       CI   R4,2
       JL   UGPREP
       CI   R4,3
       JH   UGBLK
       LI   R3,2
       MOV  R0,R5
       ANDI R5,1
       JNE  UGFAIL
       JMP  UGPREP

* Block CPU buffers must be entirely in one 32K expansion RAM window.
* This also prevents accidental VDP/GROM I/O and cartridge bank writes.
UGBLK  CI   R4,6
       JEQ  UGPREP
       LI   R3,3
       CI   R1,>2000
       JL   UGFAIL
       CI   R1,>4000
       JL   UGLOW
       CI   R1,>A000
       JL   UGFAIL
       CLR  R5
       JMP  UGROOM
UGLOW  LI   R5,>4000
UGROOM S    R1,R5
       C    R2,R5
       JH   UGFAIL
       JMP  UGPREP
UGFAIL B    @UGEXIT
UGOK   CLR  R3
       B    @UGEXIT

* Normalize to three transfer modes: read, write, fill. Scalars use a
* two-byte CPU scratch buffer, so they share the same transfer engine.
UGPREP MOV  R1,R6
       CI   R4,4
       JHE  UGMODE
       LI   R6,UGBUF
       MOV  R1,@UGBUF
       CI   R4,1
       JNE  UGMODE
       SWPB @UGBUF
UGMODE MOV  R1,R9
       SWPB R9
       CI   R4,6
       JEQ  UGFMD
       ANDI R4,1
       JMP  UGGO
UGFMD  LI   R4,2
UGGO   MOV  R0,R5
       .IFNDEF SUPERCART
* Physical allocation >1900..>38FF; base 13 maps page 0 at >6000 and
* page 1 at >8000. Thus virtual >6000 becomes GROM >7900 on base 13.
       AI   R5,>1900
* Console GROM supplies the prefetched address. Undo the increment WITHIN
* its 8K page (a plain DEC would corrupt an address at the page boundary).
       MOVB @>9802,R8
       SWPB R8
       MOVB @>9802,R8
       SWPB R8
       MOV  R8,R7
       ANDI R7,>E000
       DEC  R8
       ANDI R8,>1FFF
       SOC  R7,R8
UGADDR MOV  R5,R7
       MOVB R7,@>9C36
       SWPB R7
       MOVB R7,@>9C36
       .ENDIF
UGLOOP CI   R4,0
       JEQ  UGRD
       CI   R4,2
       JEQ  UGFL
       .IFDEF SUPERCART
       MOVB *R6+,*R5
       .ELSE
       MOVB *R6+,@>9C34
       .ENDIF
       JMP  UGNEXT
UGFL   .IFDEF SUPERCART
       MOVB R9,*R5
       .ELSE
       MOVB R9,@>9C34
       .ENDIF
       JMP  UGNEXT
UGRD   .IFDEF SUPERCART
       MOVB *R5,*R6+
       .ELSE
       MOVB @>9834,*R6+
       .ENDIF
UGNEXT INC  R5
       DEC  R2
       JEQ  UGDONE
       .IFNDEF SUPERCART
* Explicitly reset at the physical page boundary; no rollover dependency.
       CI   R5,>8000
       JEQ  UGADDR
       .ENDIF
       JMP  UGLOOP
UGDONE .IFNDEF SUPERCART
* Restore the shared GROM address via base 0; no device data is written.
       MOVB R8,@>9C02
       SWPB R8
       MOVB R8,@>9C02
       .ENDIF
       MOV  @UGOP,R4
       CI   R4,0
       JNE  UGWRES
       MOV  @UGBUF,R1
       SRL  R1,8
       JMP  UGOK
UGWRES CI   R4,2
       JNE  UGOK
       MOV  @UGBUF,R1
       JMP  UGOK
UGEXIT LWPI UGRWP
       RTWP

* Writable private storage: 32-byte return workspace, opcode, scalar buffer.
       EVEN
UGRWP  BSS  32
UGOP   BSS  2
UGBUF  BSS  2
UGSIGN TEXT '2026 Hexbus'
       EVEN
UGEND  EQU  $

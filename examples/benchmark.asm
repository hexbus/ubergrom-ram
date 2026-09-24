* Copyright (c) 2026 hexbus. SPDX-License-Identifier: Apache-2.0
* Standalone E/A option 5 benchmark. Owns VDP and TMS9901; reset to leave.
* DIRECT: native CPU instructions at >C000. CART: direct at >6000 instead.
* Without DIRECT: use the ABI, with SUPERCART selecting its CPU RAM backend.
* No timing relies on CPU interrupts. Each short sample uses the 9901 timer.
       DEF  START
       AORG >A000
NREP   EQU  256
SCALAR EQU  16
INPUT  EQU  >E000
OUTPUT EQU  >E100
       .IFDEF CART
DADDR  EQU  >6000
       .ELSE
DADDR  EQU  >C000
       .ENDIF
START  LIMI 0
       LWPI WORK
       CLR  R12
       CLR  R0
       LDCR R0,0            * I/O mode and all interrupt masks off
       BL   @VIDEO
       LI   R0,40
       LI   R1,TITLE
       BL   @PRINT
       LI   R0,120
       LI   R1,BACKND
       BL   @PRINT
       LI   R0,200
       LI   R1,COLS
       BL   @PRINT
       LI   R0,840
       LI   R1,FOOT
       BL   @PRINT
       LI   R0,880
       LI   R1,RESET
       BL   @PRINT
* Initialize all test data before timing starts. Volatile RAM is overwritten.
       LI   R5,INPUT
       LI   R6,256
       LI   R7,>5A00
INITIN MOVB R7,*R5+
       DEC  R6
       JNE  INITIN
       .IFDEF DIRECT
       LI   R5,DADDR
       LI   R6,8192
INITDR MOVB R7,*R5+
       DEC  R6
       JNE  INITDR
       .ELSE
       LI   R0,>6000
       LI   R1,>5A
       LI   R2,8192
       BL   @UGFILL
       .ENDIF
       CLR  @TESTNO
NEXT   CLR  R14             * Total ticks: R14 high, R15 low
       CLR  R15
       LI   R0,NREP
       MOV  R0,@REPEAT
       MOV  @TESTNO,R0
       LI   R5,FUNCS
       A    R0,R5
       MOV  *R5,@FUNC
SAMPLE CLR  R12
       SBZ  0
       SBO  3              * Enable and acknowledge only timer interrupt
       SBO  0
       LI   R4,>7FFF       * Timer mode bit + 14-bit maximum count
       LDCR R4,15
       SBZ  0
TBEGIN MOV  @FUNC,R7
       BL   *R7
TEND   SBO  0              * Latch running timer; CPU IRQ remains disabled
       STCR R4,0           * Bits 1..14=count, bit 15=interrupt pending
       SBZ  0
       MOV  R4,R6
       ANDI R6,>8000
       JNE  TOOBIG
       SRL  R4,1
       ANDI R4,>3FFF
       LI   R5,>3FFF
       S    R4,R5
       A    R5,R15
       JNC  NOCARY
       INC  R14
NOCARY DEC  @REPEAT
       JNE  SAMPLE
       BL   @STOPTM
* Keep the record in CPU RAM as well as displaying it. Eight 32-bit totals.
       MOV  @TESTNO,R0
       SLA  R0,1
       LI   R5,TICKS
       A    R0,R5
       MOV  R14,*R5+
       MOV  R15,*R5
       BL   @CHECK
       MOV  R3,R3
       JEQ  GOOD
       B    @FAILED
GOOD   BL   @SHOW
       INCT @TESTNO
       MOV  @TESTNO,R0
       CI   R0,16
       JL   NEXT
       LI   R0,720
       LI   R1,PASS
       BL   @PRINT
       LI   R0,>600D
       MOV  R0,@STATUS
DONE   JMP  DONE
TOOBIG BL   @STOPTM
       LI   R3,>FFFF
       LI   R1,OVRFLO
       JMP  BADMSG
FAILED LI   R1,FAIL
BADMSG MOV  R3,@STATUS
       LI   R0,720
       BL   @PRINT
       JMP  DONE

* Timer shutdown. Do not write bit 15 in timer mode (that would reset I/O).
STOPTM CLR  R12
       SBO  0
       LI   R12,2
       CLR  R5
       LDCR R5,14
       CLR  R12
       SBZ  0
       SBZ  3
       B    *R11

* Timed kernels. Each scalar sample does 16 calls/instructions. Each block
* sample handles 256 bytes. R13 is preserved by the ABI and holds the loop.
EMPTY  B    *R11
GETB   MOV  R11,@LINK
       LI   R13,SCALAR
GBLOOP .IFDEF DIRECT
       MOVB @DADDR,R1
       SRL  R1,8
       .ELSE
       LI   R0,>6000
       BL   @UGGETB
       .ENDIF
       DEC  R13
       JNE  GBLOOP
       B    @RET
PUTB   MOV  R11,@LINK
       LI   R13,SCALAR
PBLOOP .IFDEF DIRECT
       LI   R1,>5A00
       MOVB R1,@DADDR
       .ELSE
       LI   R0,>6000
       LI   R1,>5A
       BL   @UGPUTB
       .ENDIF
       DEC  R13
       JNE  PBLOOP
       B    @RET
GETW   MOV  R11,@LINK
       LI   R13,SCALAR
GWLOOP .IFDEF DIRECT
       MOV  @DADDR,R1
       .ELSE
       LI   R0,>6000
       BL   @UGGETW
       .ENDIF
       DEC  R13
       JNE  GWLOOP
       B    @RET
PUTW   MOV  R11,@LINK
       LI   R13,SCALAR
PWLOOP .IFDEF DIRECT
       LI   R1,>5A5A
       MOV  R1,@DADDR
       .ELSE
       LI   R0,>6000
       LI   R1,>5A5A
       BL   @UGPUTW
       .ENDIF
       DEC  R13
       JNE  PWLOOP
       B    @RET
READ   MOV  R11,@LINK
       .IFDEF DIRECT
       LI   R5,DADDR+>6C0
       LI   R6,OUTPUT
       LI   R7,256
RDLOOP MOVB *R5+,*R6+
       DEC  R7
       JNE  RDLOOP
       .ELSE
       LI   R0,>66C0
       LI   R1,OUTPUT
       LI   R2,256
       BL   @UGREAD
       .ENDIF
       B    @RET
WRITE  MOV  R11,@LINK
       .IFDEF DIRECT
       LI   R5,INPUT
       LI   R6,DADDR+>6C0
       LI   R7,256
WRLOOP MOVB *R5+,*R6+
       DEC  R7
       JNE  WRLOOP
       .ELSE
       LI   R0,>66C0
       LI   R1,INPUT
       LI   R2,256
       BL   @UGWRIT
       .ENDIF
       B    @RET
FILL   MOV  R11,@LINK
       .IFDEF DIRECT
       LI   R5,DADDR+>6C0
       LI   R6,>5A00
       LI   R7,256
FLLOOP MOVB R6,*R5+
       DEC  R7
       JNE  FLLOOP
       .ELSE
       LI   R0,>66C0
       LI   R1,>5A
       LI   R2,256
       BL   @UGFILL
       .ENDIF
RET    MOV  @LINK,R11
       B    *R11

* Verification runs outside the measured samples. Both scalar bytes and the
* complete 256-byte block must contain >5A, and the ABI must return success.
CHECK  MOV  R11,@CKLINK
       .IFDEF DIRECT
       MOV  @DADDR,R1
       CLR  R3
       .ELSE
       LI   R0,>6000
       BL   @UGGETW
       .ENDIF
       MOV  R3,R3
       JNE  CKRET
       CI   R1,>5A5A
       JNE  CKFAIL
       BL   @READ
       .IFNDEF DIRECT
       MOV  R3,R3
       JNE  CKRET
       .ENDIF
       LI   R5,OUTPUT
       LI   R6,256
       LI   R7,>5A00
CKBYTE CB   *R5+,R7
       JNE  CKFAIL
       DEC  R6
       JNE  CKBYTE
       CLR  R3
       JMP  CKRET
CKFAIL LI   R3,>FFFE
CKRET  MOV  @CKLINK,R11
       B    *R11

* Decimal 32-bit tick total, ten digits. Printing is never timed.
SHOW   MOV  R11,@SHLINK
       MOV  @TESTNO,R0
       LI   R5,NAMES
       A    R0,R5
       MOV  *R5,R1
       SRL  R0,1
       LI   R5,40
       MPY  R5,R0
       MOV  R1,R0
       AI   R0,280
       MOV  R0,@ROW
       MOV  @TESTNO,R5
       AI   R5,NAMES
       MOV  *R5,R1
       BL   @PRINT
       MOV  R14,R4
       MOV  R15,R5
       LI   R7,NUMBER+10
       LI   R8,10
       LI   R6,10
DECOUT CLR  R0
       MOV  R4,R1
       DIV  R6,R0
       MOV  R5,R2
       DIV  R6,R1
       MOV  R0,R4
       MOV  R1,R5
       AI   R2,48
       SWPB R2
       DEC  R7
       MOVB R2,*R7
       DEC  R8
       JNE  DECOUT
       LI   R7,NUMBER
       LI   R8,9
       LI   R6,>3000
       LI   R5,>2000
PAD    CB   *R7,R6
       JNE  PADEND
       MOVB R5,*R7+
       DEC  R8
       JNE  PAD
PADEND
       MOV  @ROW,R0
       AI   R0,25
       LI   R1,NUMBER
       BL   @PRINT
       MOV  @SHLINK,R11
       B    *R11

* Own 40-column text display and a small original 5x7 font.
VIDEO  MOV  R11,@VLINK
       LI   R5,REGS
       LI   R6,8
VREG   MOVB *R5+,@>8C02
       MOVB *R5+,@>8C02
       DEC  R6
       JNE  VREG
       CLR  R0
       BL   @VADDR
       LI   R5,>2000
       LI   R6,960
VCLEAR MOVB R5,@>8C00
       DEC  R6
       JNE  VCLEAR
       LI   R0,>0900       * ASCII 32 starts at pattern base >0800 + 256
       BL   @VADDR
       LI   R5,FONT
       LI   R6,FONTEND-FONT
VFONT  MOVB *R5+,@>8C00
       DEC  R6
       JNE  VFONT
       MOV  @VLINK,R11
       B    *R11
VADDR  MOV  R0,R4
       SWPB R4
       MOVB R4,@>8C02
       SWPB R4
       ORI  R4,>4000
       MOVB R4,@>8C02
       B    *R11
PRINT  MOV  R11,@PLINK
       BL   @VADDR
PLOOP  MOVB *R1+,R4
       JEQ  PEND
       MOVB R4,@>8C00
       JMP  PLOOP
PEND   MOV  @PLINK,R11
       B    *R11

FUNCS  DATA EMPTY,GETB,PUTB,GETW,PUTW,READ,WRITE,FILL
NAMES  DATA LEMPTY,LGETB,LPUTB,LGETW,LPUTW,LREAD,LWRITE,LFILL
REGS   BYTE >00,>80,>D0,>81,>00,>82,>00,>83
       BYTE >01,>84,>00,>85,>00,>86,>F4,>87
TITLE  TEXT 'UBERGROM RAM SPEED TEST'
       BYTE 0
BACKND .IFDEF DIRECT
       .IFDEF CART
       TEXT 'DIRECT SUPERCART CPU RAM'
       .ELSE
       TEXT 'DIRECT 32K CPU RAM'
       .ENDIF
       .ELSE
       .IFDEF SUPERCART
       TEXT 'SUPERCART ABI'
       .ELSE
       TEXT 'UBERGROM ABI'
       .ENDIF
       .ENDIF
       BYTE 0
COLS   TEXT 'OPERATION                TOTAL TICKS'
       BYTE 0
LEMPTY TEXT 'EMPTY SAMPLE'
       BYTE 0
LGETB  TEXT 'BYTE READ   4096 OPS'
       BYTE 0
LPUTB  TEXT 'BYTE WRITE  4096 OPS'
       BYTE 0
LGETW  TEXT 'WORD READ   4096 OPS'
       BYTE 0
LPUTW  TEXT 'WORD WRITE  4096 OPS'
       BYTE 0
LREAD  TEXT 'READ 256    65536 BYTES'
       BYTE 0
LWRITE TEXT 'WRITE 256   65536 BYTES'
       BYTE 0
LFILL  TEXT 'FILL 256    65536 BYTES'
       BYTE 0
FOOT   TEXT '46875 TICKS = 1 SECOND AT 3MHZ'
       BYTE 0
RESET  TEXT 'RESET CONSOLE TO LEAVE'
       BYTE 0
PASS   TEXT 'DATA CHECK: PASS'
       BYTE 0
FAIL   TEXT 'DATA CHECK: FAILED'
       BYTE 0
OVRFLO TEXT 'TIMER OVERFLOW - RESULT INVALID'
       BYTE 0
NUMBER TEXT '0000000000'
       BYTE 0
       EVEN
WORK   BSS 32
LINK   BSS 2
CKLINK BSS 2
SHLINK BSS 2
VLINK  BSS 2
PLINK  BSS 2
ROW    BSS 2
TESTNO BSS 2
REPEAT BSS 2
FUNC   BSS 2
STATUS DATA 0
TICKS  BSS 32
       COPY 'font.asm'
       .IFNDEF DIRECT
       COPY 'ugram.asm'
       .ENDIF
       END START

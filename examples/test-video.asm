* Copyright (c) 2026 hexbus. SPDX-License-Identifier: Apache-2.0
* Small standalone test display, same font/layout as the benchmark.
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

REGS   BYTE >00,>80,>D0,>81,>00,>82,>00,>83
       BYTE >01,>84,>00,>85,>00,>86,>F4,>87
VLINK  BSS 2
PLINK  BSS 2

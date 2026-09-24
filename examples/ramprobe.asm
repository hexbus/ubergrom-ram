* Copyright (c) 2026 hexbus. SPDX-License-Identifier: Apache-2.0
* E/A option 5 diagnostic for the 2026-09-23 kit. No DSR calls or EEPROM
* writes. Overwrites only the library's volatile allocation >1900..>38FF.
* Raw port probes are deliberately independent of the library routines.
       DEF START
       AORG >A000
START  LIMI 0
       LWPI >BF00
       BL @VIDEO
       LI R0,40
       LI R1,TITLE
       BL @PRINT
       LI R0,120
       LI R1,CONFIG
       BL @PRINT
* Read configuration through the firmware's fixed base-15 window.
* Display pairs in value/complement order, even though stored separately.
       LI R5,>F800
       LI R6,>983C
       BL @RAWGET
       LI R0,125
       BL @HEX
       LI R5,>F8D5
       BL @PAIR
       LI R0,135
       BL @HEX
       LI R5,>F8D6
       BL @PAIR
       LI R0,145
       BL @HEX
       LI R0,200
       LI R1,COLS
       BL @PRINT
       LI R0,240
       LI R1,ROWS
       BL @PRINT
* Writes and reads here set the address explicitly for each two-byte pair.
       LI R5,>7900
       LI R7,>A55A
       BL @RAWWRT
       LI R6,>9834
       BL @RAWGET
       LI R0,266
       BL @HEX
       LI R6,>9838
       BL @RAWGET
       LI R0,306
       BL @HEX
       LI R5,>7FFE
       LI R7,>3CC3
       BL @RAWWRT
       LI R6,>9834
       BL @RAWGET
       LI R0,346
       BL @HEX
       LI R5,>8000
       LI R7,>6996
       BL @RAWWRT
       BL @RAWGET
       LI R0,386
       BL @HEX
       LI R5,>98FE
       LI R7,>5AA5
       BL @RAWWRT
       BL @RAWGET
       LI R0,426
       BL @HEX
* Use a byte-varying, address-dependent pattern, as in RAMTEST. Check every
* byte and report the first bad virtual address and expected/actual bytes.
       LI R5,>C000
       LI R6,4096
       LI R7,>1234
PATLP  MOV R7,*R5+
       INC R7
       DEC R6
       JNE PATLP
       LI R0,>6000
       LI R1,>C000
       LI R2,8192
       BL @UGWRIT
       MOV R3,@WRSTAT
       LI R0,>6000
       LI R1,>E000
       LI R2,8192
       BL @UGREAD
       MOV R3,@RDSTAT
       LI R0,520
       LI R1,STATXT
       BL @PRINT
       MOV @WRSTAT,R8
       LI R0,531
       BL @HEX
       MOV @RDSTAT,R8
       LI R0,542
       BL @HEX
       LI R5,>C000
       LI R6,>E000
       LI R7,>6000
CMP    CB *R5,*R6
       JNE BAD
       INC R5
       INC R6
       INC R7
       CI R7,>8000
       JL CMP
       LI R0,600
       LI R1,PASS
       BL @PRINT
       JMP FINISH
BAD    MOVB *R5,R8
       SRL R8,8
       MOV R8,@EXPECT
       MOVB *R6,R8
       SRL R8,8
       MOV R8,@ACTUAL
       MOV R7,@BADADR
       LI R0,600
       LI R1,FAIL
       BL @PRINT
       LI R0,619
       MOV @BADADR,R8
       BL @HEX
       LI R0,640
       LI R1,VALUES
       BL @PRINT
       LI R0,647
       MOV @EXPECT,R8
       BL @HEX
       LI R0,657
       MOV @ACTUAL,R8
       BL @HEX
FINISH LI R0,760
       LI R1,FOOT
       BL @PRINT
DONE   JMP DONE

* All three helpers leave R5 (GROM address) and R6 (read port) intact.
* RAWGET returns two sequential bytes as a word in R8.
RAWGET MOV R6,R9
       AI R9,>402
       MOV R5,R10
       MOVB R10,*R9
       SWPB R10
       MOVB R10,*R9
       MOVB *R6,R8
       SWPB R8
       MOVB *R6,R8
       SWPB R8
       B *R11
RAWWRT MOV R5,R10
       MOVB R10,@>9C36
       SWPB R10
       MOVB R10,@>9C36
       MOVB R7,@>9C34
       SWPB R7
       MOVB R7,@>9C34
       B *R11
PAIR   MOV R11,@PAIRLK
       LI R6,>983C
       BL @RAWGET
       MOV R8,@PAIRHI
       AI R5,8
       BL @RAWGET
       SRL R8,8
       MOV @PAIRHI,R9
       ANDI R9,>FF00
       SOC R9,R8
       MOV @PAIRLK,R11
       B *R11
* Four hex digits at screen R0, word R8. Does not change raw-probe inputs.
HEX    MOV R11,@HEXLK
       BL @VADDR
       MOV R8,R10
       LI R2,4
HEXL   MOV R10,R4
       SRL R4,12
       CI R4,10
       JL DIGIT
       AI R4,7
DIGIT  AI R4,>30
       SWPB R4
       MOVB R4,@>8C00
       SLA R10,4
       DEC R2
       JNE HEXL
       MOV @HEXLK,R11
       B *R11
       COPY 'test-video.asm'
TITLE  TEXT 'UBERGROM RAM PROBE 1'
       BYTE 0
CONFIG TEXT 'CFG: ....  P0: ....  P1: ....'
       BYTE 0
COLS   TEXT 'BASE ADDRESS   EXPECT    READ'
       BYTE 0
* Pad to 40 columns between rows so PRINT draws one compact table.
ROWS   TEXT '13   7900      A55A       ....          '
       TEXT '14   7900      A55A       ....          '
       TEXT '13   7FFE      3CC3       ....          '
       TEXT '13   8000      6996       ....          '
       TEXT '13   98FE      5AA5       ....'
       BYTE 0
STATXT TEXT 'ABI WRITE: .... READ: ....'
       BYTE 0
PASS   TEXT 'ABI FULL 8K: PASS'
       BYTE 0
FAIL   TEXT 'ABI FIRST BAD AT:  ....'
       BYTE 0
VALUES TEXT 'EXPECT .... READ ....'
       BYTE 0
FOOT   TEXT 'NO EEPROM WRITES. PHOTOGRAPH SCREEN.'
       BYTE 0
       EVEN
HEXLK  BSS 2
PAIRLK BSS 2
PAIRHI BSS 2
WRSTAT BSS 2
RDSTAT BSS 2
BADADR BSS 2
EXPECT BSS 2
ACTUAL BSS 2
       COPY 'font.asm'
       COPY 'ugram.asm'
       END START

* Copyright (c) 2026 hexbus. SPDX-License-Identifier: Apache-2.0
* Compare repeat reads and access sequences, without EEPROM/DSR writes.
* CPU buffers C000..DFFF, E000..FFFF, 2000..3FFF; volatile GRAM 1900..38FF.
       DEF START
       AORG >A000
START  LIMI 0
       LWPI >BF00
       BL @VIDEO
       LI R0,40
       LI R1,TITLE
       BL @PRINT
       LI R0,120
       LI R1,HELP
       BL @PRINT
       LI R0,240
       LI R1,COLS
       BL @PRINT
       LI R0,720
       LI R1,NOTE
       BL @PRINT
       LI R0,800
       LI R1,FOOT
       BL @PRINT
* Preserve the 16 scratchpad registers used in the PAD comparison.
       LI R5,>8300
       LI R6,SAVED
       LI R7,16
SAVLP  MOV *R5+,*R6+
       DEC R7
       JNE SAVLP
       LI R5,>C000
       LI R6,4096
       LI R7,>1234
PATLP  MOV R7,*R5+
       INC R7
       DEC R6
       JNE PATLP
       CLR @MODE
NEXT   BL @ROWPOS
       LI R1,RUNMSG
       BL @PRINT
       MOV @MODE,R0
       SLA R0,4
       AI R0,RESULT
       MOV R0,@CURRENT
       MOV R0,R5
       LI R6,8
CLEAR  CLR *R5+
       DEC R6
       JNE CLEAR
       MOV @CURRENT,R5
       SETO @6(R5)
       LI R0,>C000
       MOV R0,@BUFFER
       LI R0,UGWRIT
       MOV R0,@FUNC
       BL @TRANSFER
* Read twice with NO intervening write to GRAM. DIFFERENT counts bytes
* that change between these reads, independently of the expected pattern.
       LI R0,>E000
       MOV R0,@BUFFER
       LI R0,UGREAD
       MOV R0,@FUNC
       BL @TRANSFER
       LI R0,>2000
       MOV R0,@BUFFER
       BL @TRANSFER
       MOV @CURRENT,R8
       LI R5,>C000
       LI R6,>E000
       LI R7,>2000
       LI R9,>6000
CMP    CB *R5,*R6
       JEQ CMP2
       INC *R8
       MOV @6(R8),R10
       CI R10,>FFFF
       JNE CMP2
       MOV R9,@6(R8)
       MOVB *R5,R10
       SRL R10,8
       MOV R10,@8(R8)
       MOVB *R6,R10
       SRL R10,8
       MOV R10,@10(R8)
CMP2   CB *R5,*R7
       JEQ CMP3
       INC @2(R8)
CMP3   CB *R6,*R7
       JEQ ADV
       INC @4(R8)
ADV    INC R5
       INC R6
       INC R7
       INC R9
       CI R9,>8000
       JL CMP
       BL @SHOW
       INC @MODE
       MOV @MODE,R0
       CI R0,4
       JEQ FINISH
       B @NEXT
FINISH LI R5,SAVED
       LI R6,>8300
       LI R7,16
RESLP  MOV *R5+,*R6+
       DEC R7
       JNE RESLP
       LI R0,880
       LI R1,DONEM
       BL @PRINT
DONE   JMP DONE

* Modes 0 and 1 call exactly the same unchanged ABI, with only the caller
* register workspace changed. Preserve BF00's link in memory across LWPI.
TRANSFER MOV R11,@XFLINK
       MOV @MODE,R0
       CI R0,2
       JHE RAW
       CI R0,1
       JNE ABIGO
       LWPI >8300
ABIGO  LI R0,>6000
       MOV @BUFFER,R1
       LI R2,8192
       MOV @FUNC,R5
       BL *R5
       MOV R3,@CODE
       LWPI >BF00
       MOV @CURRENT,R5
       MOV @CODE,R6
       SOC R6,@12(R5)
       B @XFRET
* Both raw modes pause between GROM transactions. Mode 2 streams bytes;
* mode 3 additionally supplies the full address before EVERY byte.
RAW    LI R5,>7900
       MOV @BUFFER,R6
       LI R2,8192
       BL @SETADR
RAWLP  MOV @FUNC,R0
       CI R0,UGWRIT
       JNE RAWREAD
       MOVB *R6+,@>9C34
       JMP RAWNEXT
RAWREAD MOVB @>9834,*R6+
RAWNEXT BL @PAUSE
       INC R5
       DEC R2
       JEQ XFRET
       MOV @MODE,R0
       CI R0,3
       JEQ READDR
       CI R5,>8000
       JNE RAWLP
READDR BL @SETADR
       JMP RAWLP
XFRET  MOV @XFLINK,R11
       B *R11
SETADR MOV R11,@ADLINK
       MOV R5,R7
       MOVB R7,@>9C36
       BL @PAUSE
       SWPB R7
       MOVB R7,@>9C36
       BL @PAUSE
       MOV @ADLINK,R11
       B *R11
PAUSE  LI R4,32
WAITLP DEC R4
       JNE WAITLP
       B *R11

ROWPOS MOV @MODE,R0
       SLA R0,1
       LI R1,ROWTAB
       A R0,R1
       MOV *R1,R0
       B *R11
SHOW   MOV R11,@SHLINK
       BL @ROWPOS
       MOV R0,@ROW
       LI R1,BLANK
       BL @PRINT
       MOV @ROW,R0
       MOV @MODE,R1
       SLA R1,3
       AI R1,NAMES
       BL @PRINT
       MOV @CURRENT,R6
       LI R5,6
       MOV @ROW,R0
       AI R0,8
SHLOOP MOV *R6+,R8
       BL @HEX
       AI R0,5
       DEC R5
       JNE SHLOOP
       MOV @SHLINK,R11
       B *R11
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
TITLE  TEXT 'UBERGROM RAM PROBE 2'
       BYTE 0
HELP   TEXT '4 METHODS - TWO READS AFTER EACH WRITE'
       BYTE 0
COLS   TEXT 'METHOD  BAD1 BAD2 DIFF FIRST WANT GOT'
       BYTE 0
RUNMSG TEXT 'RUNNING - PLEASE WAIT'
       BYTE 0
BLANK  TEXT '                                        '
       BYTE 0
NAMES  TEXT 'ABI-EXT'
       BYTE 0
       TEXT 'ABI-PAD'
       BYTE 0
       TEXT 'PACED  '
       BYTE 0
       TEXT 'ADDR   '
       BYTE 0
NOTE   TEXT 'COUNTS/VALUES HEX. FFFF = NO FIRST ERROR'
       BYTE 0
FOOT   TEXT 'NO EEPROM WRITES. WAIT FOR DONE.'
       BYTE 0
DONEM  TEXT 'DONE - PHOTOGRAPH SCREEN. RESET TO LEAVE'
       BYTE 0
       EVEN
ROWTAB DATA 320,400,480,560
MODE   DATA 0
CURRENT BSS 2
BUFFER BSS 2
FUNC   BSS 2
CODE   BSS 2
XFLINK BSS 2
ADLINK BSS 2
SHLINK BSS 2
HEXLK  BSS 2
ROW    BSS 2
RESULT BSS 64
SAVED  BSS 32
       COPY 'font.asm'
       COPY 'ugram.asm'
       END START

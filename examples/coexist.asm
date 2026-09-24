* Copyright (c) 2026 hexbus. SPDX-License-Identifier: Apache-2.0
* Hardware qualification program for the E/A/CF02 development cartridge.
* Built by tools/build-hardware-kit.py with a CPU-backup GPL test bridge.
* Uses CPU >A000..>BFFF for code/workspaces; >C000..>FFFF for comparisons.
* Creates only UBE1.UGRAMT1, refusing to proceed if it already exists.
       DEF START
       AORG >A000
WORK   EQU >BF00
BRWORK EQU >BE00
PABVDP EQU >3000
DATAWD EQU >1000
START  LIMI 0
       LWPI WORK
       BL @SILENT
       BL @VIDEO
       LI R0,40
       LI R1,TITLE
       BL @PRINT
       LI R0,120
       LI R1,RUNMSG
       BL @PRINT
* A preliminary LOAD must report missing file. An existing file, including
* one of the wrong size or type, stops the test before any EEPROM write.
       LI R0,1
       MOV R0,@STAGE
       LI R1,RAMNAME
       BL @SETNAM
       LI R0,5
       BL @FILEIO
       CI R3,7
       JEQ UNUSED
       LI R1,EXISTS
       B @STOP
UNUSED LI R0,2
       MOV R0,@STAGE
       LI R7,>1234
       BL @PATTERN
       BL @COMPARE
* The ROM contains 128 words: >1234, >1235, ... >12B3.
       INC @STAGE
       LI R1,ROMNAME
       BL @SETNAM
       LI R0,5
       BL @FILEOK
       BL @PAYCHK
       BL @COMPARE
* Save bytes that have traveled through our library into CPU >E000.
       INC @STAGE
       LI R0,DATAWD
       BL @VADDR
       LI R5,>E000
       LI R6,256
SAVEDT MOVB *R5+,@>8C00
       DEC R6
       JNE SAVEDT
       LI R1,RAMNAME
       BL @SETNAM
       LI R0,6
       BL @FILEOK
       BL @COMPARE
       INC @STAGE
       BL @LOADCK
       BL @COMPARE
* Change the entire RAM pattern; the saved file must retain the first one.
       INC @STAGE
       LI R7,>ABCD
       BL @PATTERN
       BL @COMPARE
       INC @STAGE
       BL @LOADCK
       BL @COMPARE
       INC @STAGE
       LI R0,7
       BL @FILEOK
       BL @COMPARE
       INC @STAGE
       LI R0,5
       BL @FILEIO
       CI R3,7
       JEQ PASSED
       B @FAILED
PASSED BL @COMPARE
       LI R0,>600D
       MOV R0,@STATUS
       LI R1,PASS
       B @STOP
FAILED MOV R3,@ERRVAL
       LI R0,>FFFF
       MOV R0,@STATUS
       LI R1,FAIL
STOP   MOV R1,@ENDMSG
       BL @SILENT
       BL @VIDEO
       LI R0,40
       LI R1,TITLE
       BL @PRINT
       LI R0,160
       MOV @ENDMSG,R1
       BL @PRINT
       LI R0,240
       LI R1,STGTXT
       BL @PRINT
       MOV @STAGE,R5
       AI R5,>0030
       SWPB R5
       LI R0,247
       BL @VADDR
       MOVB R5,@>8C00
       LI R0,320
       LI R1,FOOT
       BL @PRINT
DONE   JMP DONE

PATTERN MOV R11,@PATLNK
       LI R1,WRMSG
       BL @TRACE
       LI R5,>C000
       LI R6,4096
PATLP  MOV R7,*R5+
       INC R7
       DEC R6
       JNE PATLP
       LI R0,>6000
       LI R1,>C000
       LI R2,8192
       BL @UGWRIT
       MOV R3,R3
       JNE FAILED
       MOV @PATLNK,R11
       B *R11
COMPARE MOV R11,@CMPLNK
       LI R1,RDMSG
       BL @TRACE
       LI R0,>6000
       LI R1,>E000
       LI R2,8192
       BL @UGREAD
       MOV R3,R3
       JNE FAILED
       LI R5,>C000
       LI R6,>E000
       LI R7,4096
CMPLP  C *R5+,*R6+
       JNE BADRAM
       DEC R7
       JNE CMPLP
       MOV @CMPLNK,R11
       B *R11
BADRAM LI R3,>FFFE
       B @FAILED

SETNAM LI R5,PAB+9
       LI R6,15
NAMLP  MOVB *R1+,*R5+
       DEC R6
       JNE NAMLP
       B *R11
FILEOK MOV R11,@OKLINK
       BL @FILEIO
       MOV R3,R3
       JNE FAILED
       MOV @OKLINK,R11
       B *R11
FILEIO MOV R11,@IOLINK
       LI R1,LOADTX
       CI R0,6
       JNE NOTSAV
       LI R1,SAVETX
NOTSAV CI R0,7
       JNE SHOWIO
       LI R1,DELTXT
SHOWIO BL @TRACE
       SWPB R0
       MOVB R0,@PAB
       CLR R0
       MOVB R0,@PAB+1
       LI R0,PABVDP
       BL @VADDR
       LI R5,PAB
       LI R6,24
PABLP  MOVB *R5+,@>8C00
       DEC R6
       JNE PABLP
       LI R0,PABVDP+9
       MOV R0,@>8356
       BLWP @DSRVEC
       LI R0,PABVDP+1
       BL @RDADDR
       MOVB @>8800,R3
       SRL R3,13
       LI R1,RETTXT
       BL @TRACE
       MOV @IOLINK,R11
       B *R11
LOADCK MOV R11,@LDLINK
       LI R0,DATAWD
       BL @VADDR
       CLR R5
       LI R6,256
ZERO   MOVB R5,@>8C00
       DEC R6
       JNE ZERO
       LI R0,5
       BL @FILEOK
       BL @PAYCHK
       MOV @LDLINK,R11
       B *R11
PAYCHK MOV R11,@PYLINK
       LI R0,DATAWD
       BL @RDADDR
       LI R6,128
       LI R7,>1234
PAYLP  MOVB @>8800,R5
       SWPB R5
       MOVB @>8800,R5
       SWPB R5
       C R5,R7
       JNE BADRAM
       INC R7
       DEC R6
       JNE PAYLP
       MOV @PYLINK,R11
       B *R11
RDADDR MOV R0,R4
       SWPB R4
       MOVB R4,@>8C02
       SWPB R4
       MOVB R4,@>8C02
       B *R11

* Show the operation before entering it. Preserve the operation's arguments;
* PRINT/VADDR use only R0, R1, R4, R11. TRACE does not touch GROM or EEPROM.
TRACE  MOV R11,@TRLINK
       MOV R0,@TRSAVE
       MOV R1,@TRSAVE+2
       MOV R4,@TRSAVE+4
       LI R0,200
       LI R1,STGTXT
       BL @PRINT
       LI R0,207
       BL @VADDR
       MOV @STAGE,R4
       AI R4,>0030
       SWPB R4
       MOVB R4,@>8C00
       LI R0,240
       MOV @TRSAVE+2,R1
       BL @PRINT
       MOV @TRSAVE,R0
       MOV @TRSAVE+2,R1
       MOV @TRSAVE+4,R4
       MOV @TRLINK,R11
       B *R11
* Interrupts stay disabled while testing. Explicitly silence all channels
* rather than depending on the console sound interrupt to end a tone.
SILENT MOVB @MUTE,@>8400
       MOVB @MUTE+1,@>8400
       MOVB @MUTE+2,@>8400
       MOVB @MUTE+3,@>8400
       B *R11

* Screen routines use an original font; file PAB/data use separate VDP areas.
       COPY 'test-video.asm'
TITLE  TEXT 'UBERGROM RAM AND DSR TEST 2'
       BYTE 0
RUNMSG TEXT 'RUNNING - PLEASE WAIT'
       BYTE 0
PASS   TEXT 'RAM AND FILE CHECK: PASS'
       BYTE 0
FAIL   TEXT 'RAM OR FILE CHECK: FAILED'
       BYTE 0
EXISTS TEXT 'STOP: CHECK UBE1.UGRAMT1 FIRST'
       BYTE 0
STGTXT TEXT 'STAGE:'
       BYTE 0
FOOT   TEXT 'TEST FINISHED - RESET TO LEAVE'
       BYTE 0
WRMSG  TEXT 'WRITING 8K RAM                  '
       BYTE 0
RDMSG  TEXT 'READING AND CHECKING 8K RAM     '
       BYTE 0
LOADTX TEXT 'FILE CALL: LOAD                '
       BYTE 0
SAVETX TEXT 'FILE CALL: SAVE                '
       BYTE 0
DELTXT TEXT 'FILE CALL: DELETE              '
       BYTE 0
RETTXT TEXT 'FILE CALL RETURNED             '
       BYTE 0
MUTE   BYTE >9F,>BF,>DF,>FF
RAMNAME BYTE 12
       TEXT 'UBE1.UGRAMT1'
       BYTE 0,0
ROMNAME BYTE 12
       TEXT 'ROM1.RAMDATA'
       BYTE 0,0
       EVEN
PAB    BYTE 0,0
       DATA DATAWD
       BYTE 0,0
       DATA 256
       BYTE 0
       BSS 15
DSRVEC DATA BRWORK,BRIDGE
STAGE  DATA 0
STATUS DATA 0
ERRVAL DATA 0
PATLNK BSS 2
CMPLNK BSS 2
OKLINK BSS 2
IOLINK BSS 2
LDLINK BSS 2
PYLINK BSS 2
ENDMSG BSS 2
TRLINK BSS 2
TRSAVE BSS 6
       COPY 'font.asm'
       COPY 'ugram.asm'
CODEEND EQU $
* The build links the bridge here, then verifies one complete E/A image.
BRIDGE BCOPY 'bridge.bin'
       END START

* Scratchpad: local, unpublished example. Copyright 2026 hexbus, Apache-2.0.
* 100 x 80-byte lines live ONLY in the selected cartridge-buffer backend.
* CPU RAM holds small line buffers; VDP stages incoming files before commit.
* GPL file bridge is linked by build-scratchpad.py for the E/A development cart.
       DEF START
       AORG >A000
WORK   EQU >F000
BRWORK EQU >F040
LINE   EQU >F100
UNDO   EQU >F150
ROWBUF EQU >F200
STAGED EQU >1000
PABVDP EQU >3000
DATVDP EQU >3C00
START  LIMI 0
       LWPI WORK
       CLR @SELECT
       CLR @VIEW
       CLR @DIRTY
       CLR @UVALID
       CLR @NLINES
       CLR @MODE
       LI R0,>FFFF
       MOV R0,@LASTKY
       LI R1,DEFAULT
       LI R2,FNAME
       LI R3,32
INITNM MOVB *R1+,*R2+
       DEC R3
       JNE INITNM
       BL @EMPTY
       BL @VIDEO
       LI R0,WELCOME
       MOV R0,@MESSAGE
REDRAW BL @DRAW
MAIN   BL @GETKEY
       CI R0,11
       JNE MDOWN
       MOV @SELECT,R1
       JEQ MAIN
       DEC @SELECT
       JMP REDRAW
MDOWN  CI R0,10
       JNE MLEFT
       MOV @SELECT,R0
       CI R0,99
       JHE MAIN
       INC @SELECT
       JMP REDRAW
MLEFT  CI R0,8
       JNE MRIGHT
       MOV @VIEW,R1
       JEQ MAIN
       AI R1,-35
       MOV R1,@VIEW
       JMP REDRAW
MRIGHT CI R0,9
       JNE MED
       MOV @VIEW,R0
       CI R0,70
       JHE MAIN
       LI R1,35
       A R1,@VIEW
       JMP REDRAW
MED    CI R0,69
       JEQ EDIT
       CI R0,13
       JEQ EDIT
       CI R0,85
       JNE MWRITE
       B @DOUNDO
MWRITE CI R0,87
       JNE MOPEN
       B @SAVE
MOPEN  CI R0,79
       JNE MNEW
       B @OPEN
MNEW   CI R0,78
       JNE MQUIT
       BL @DISCARD
       MOV R0,R0
       JNE $+6
       B @REDRAW
       BL @EMPTY
       CLR @SELECT
       CLR @NLINES
       CLR @UVALID
       CLR @DIRTY
       LI R0,NEWMSG
       MOV R0,@MESSAGE
       B @REDRAW
MQUIT  CI R0,81
       JNE MAIN
       BL @DISCARD
       MOV R0,R0
       JNE $+6
       B @REDRAW
       BLWP @>0000

* The application thinks in line numbers; FETCH/STORE hide address arithmetic.
* They leave status in R3. Calls use CPU RAM, never native MOV to virtual RAM.
FETCH  MOV R11,@FLINK
       MOV @SELECT,R0
       LI R1,80
       MPY R1,R0
       MOV R1,R0
       AI R0,>6000
       LI R1,LINE
       LI R2,80
       BL @UGREAD
       MOV @FLINK,R11
       B *R11
STORE  MOV R11,@SLINK
       MOV @SELECT,R0
       LI R1,80
       MPY R1,R0
       MOV R1,R0
       AI R0,>6000
       LI R1,LINE
       LI R2,80
       BL @UGWRIT
       MOV @SLINK,R11
       B *R11
EMPTY  MOV R11,@ELINK
       LI R0,>6000
       LI R1,32
       LI R2,8000
       BL @UGFILL
       MOV @ELINK,R11
       B *R11

EDIT   BL @FETCH
       CLR @CURSOR
       LI R0,1
       MOV R0,@MODE
       BL @VIDEO
       LI R0,40
       LI R1,EDITTTL
       BL @PRINT
       LI R0,120
       LI R1,EDITTIP
       BL @PRINT
       LI R0,840
       LI R1,EDITKEY
       BL @PRINT
       LI R0,880
       LI R1,EDITESC
       BL @PRINT
EDRAW  LI R0,240
       BL @VADDR
       LI R5,LINE
       LI R6,80
EDTEXT MOVB *R5+,@>8C00
       DEC R6
       JNE EDTEXT
* Invert the current glyph into character 127 so the cursor does not hide it.
       LI R5,LINE
       A @CURSOR,R5
       MOVB *R5,R5
       SRL R5,8
       CI R5,32
       JL CURBLK
       CI R5,126
       JLE CURCHR
CURBLK LI R5,32
CURCHR AI R5,-32
       SLA R5,3
       AI R5,FONT
       LI R0,>0BF8
       BL @VADDR
       LI R6,8
       LI R8,>F800
CURPAT MOVB *R5+,R7
       XOR R8,R7
       MOVB R7,@>8C00
       DEC R6
       JNE CURPAT
       MOV @CURSOR,R0
       AI R0,240
       BL @VADDR
       LI R4,>7F00
       MOVB R4,@>8C00
EWAIT  BL @GETKEY
       CI R0,13
       JEQ COMMIT
       CI R0,15
       JEQ CANCEL
       CI R0,8
       JNE ERIGHT
       MOV @CURSOR,R1
       JEQ EWAIT
       DEC @CURSOR
       JMP EDRAW
ERIGHT CI R0,9
       JNE EDEL
       MOV @CURSOR,R0
       CI R0,79
       JHE EWAIT
       INC @CURSOR
       JMP EDRAW
EDEL   CI R0,3
       JNE EINS
       LI R5,LINE
       A @CURSOR,R5
       MOV R5,R6
       INC R6
DELLOP CI R6,LINE+80
       JHE DELEND
       MOVB *R6+,*R5+
       JMP DELLOP
DELEND LI R6,>2000
       MOVB R6,*R5
       JMP EDRAW
EINS   CI R0,4
       JNE ECHAR
       LI R5,LINE+79
       LI R6,LINE
       A @CURSOR,R6
INSLOP C R5,R6
       JLE INSEND
       MOVB @-1(R5),*R5
       DEC R5
       JMP INSLOP
INSEND LI R6,>2000
       MOVB R6,*R5
       B @EDRAW
ECHAR  CI R0,32
       JL EWAIT
       CI R0,126
       JH EWAIT
       LI R5,LINE
       A @CURSOR,R5
       SWPB R0
       MOVB R0,*R5
       MOV @CURSOR,R0
       CI R0,79
       JHE ECHEND
       INC @CURSOR
ECHEND B @EDRAW
COMMIT LI R5,LINE
       LI R6,ROWBUF
       LI R7,80
EDITCP MOVB *R5+,*R6+
       DEC R7
       JNE EDITCP
       BL @FETCH
       LI R5,LINE
       LI R6,UNDO
       LI R7,ROWBUF
       LI R8,80
UNDCP  MOVB *R5,*R6+
       MOVB *R7+,*R5+
       DEC R8
       JNE UNDCP
       MOV @SELECT,@ULINE
       LI R0,1
       MOV R0,@UVALID
       BL @STORE
       LI R0,1
       MOV R0,@DIRTY
       MOV @SELECT,R0
       INC R0
       C R0,@NLINES
       JLE COMEND
       MOV R0,@NLINES
COMEND LI R0,CHANGED
       MOV R0,@MESSAGE
CANCEL CLR @MODE
       BL @VIDEO
       B @REDRAW
DOUNDO MOV @UVALID,R0
       JEQ NOUNDO
       MOV @ULINE,@SELECT
       LI R5,UNDO
       LI R6,LINE
       LI R7,80
UNDOCP MOVB *R5+,*R6+
       DEC R7
       JNE UNDOCP
       BL @STORE
       CLR @UVALID
       LI R0,1
       MOV R0,@DIRTY
       LI R0,UNDONE
       MOV R0,@MESSAGE
       B @REDRAW
NOUNDO LI R0,NOUMSG
       MOV R0,@MESSAGE
       B @REDRAW

* File I/O is DV80. LOAD stages at most 100 records before replacing RAM.
* Output trims trailing spaces; a wholly blank line is saved as one space.
SAVE   LI R0,2
       MOV R0,@MODE
       BL @ASKNAME
       MOV R0,R0
       JNE SAVPRE
       B @CANCEL
SAVPRE LI R0,>1400
       MOVB R0,@FLAGS
       BL @BUSY
       CLR R0
       BL @FILEIO
       MOV R3,R3
       JEQ EXIST
       CI R3,7
       JEQ SAVGO
       B @IOERROR
EXIST  LI R0,1
       BL @FILEIO
       MOV R3,R3
       JEQ $+6
       B @IOERROR
       LI R1,REPLACE
       BL @CONFIRM
       MOV R0,R0
       JNE SAVGO
       B @CANCEL
SAVGO  LI R0,>1200
       MOVB R0,@FLAGS
       CLR R0
       BL @FILEIO
       MOV R3,R3
       JEQ $+6
       B @IOERROR
       MOV @SELECT,@IOSEL
       CLR @SELECT
SAVELO C @SELECT,@NLINES
       JHE SAVEND
       BL @FETCH
       LI R5,LINE+79
       LI R6,80
       LI R7,>2000
TRIM   CB *R5,R7
       JNE TRIMED
       CI R6,1
       JEQ TRIMED
       DEC R5
       DEC R6
       JMP TRIM
TRIMED SWPB R6
       MOVB R6,@COUNT
       LI R0,DATVDP
       BL @VADDR
       LI R5,LINE
       LI R6,80
SAVCP  MOVB *R5+,@>8C00
       DEC R6
       JNE SAVCP
       LI R0,3
       BL @FILEIO
       MOV R3,R3
       JNE SAVERR
       INC @SELECT
       JMP SAVELO
SAVEND LI R0,1
       BL @FILEIO
       MOV @IOSEL,@SELECT
       MOV R3,R3
       JNE SAVERR
       CLR @DIRTY
       BL @KEEPNAME
       LI R0,SAVED
       MOV R0,@MESSAGE
       B @CANCEL
SAVERR MOV R3,@IOERR
* UBE1's private abort discards the unfinished output without committing it.
* Other devices retain their ordinary CLOSE convention.
       LI R0,1
       MOV @NEWNAM,R1
       CI R1,>5542
       JNE SAVCLOSE
       MOV @NEWNAM+2,R1
       CI R1,>4531
       JNE SAVCLOSE
       LI R1,>2E00
       CB @NEWNAM+4,R1
       JNE SAVCLOSE
       LI R0,10
SAVCLOSE
       BL @FILEIO
       MOV @IOSEL,@SELECT
       MOV @IOERR,R3
       B @IOERROR
OPEN   BL @DISCARD
       MOV R0,R0
       JNE OPNAME
       B @REDRAW
OPNAME LI R0,3
       MOV R0,@MODE
       BL @ASKNAME
       MOV R0,R0
       JNE OPGO
       B @CANCEL
OPGO   LI R0,>1400
       MOVB R0,@FLAGS
       BL @BUSY
       CLR R0
       BL @FILEIO
       MOV R3,R3
       JEQ $+6
       B @IOERROR
       CLR @RECCNT
       LI R0,STAGED
       BL @VADDR
       LI R6,8000
       LI R7,>2000
STGFIL MOVB R7,@>8C00
       DEC R6
       JNE STGFIL
LOADLO LI R0,2
       BL @FILEIO
       CI R3,5
       JEQ LOADEND
       MOV R3,R3
       JNE LOADERR
       MOV @RECCNT,R0
       CI R0,100
       JL LOADOK
       LI R3,8
       JMP LOADERR
LOADOK MOV @RECCNT,R0
       LI R1,80
       MPY R1,R0
       AI R1,STAGED
       MOV R1,@STGPTR
       LI R0,PABVDP+5
       BL @RDADDR
       MOVB @>8800,R6
       SRL R6,8
       CI R6,80
       JLE LENOK
       LI R3,3
       JMP LOADERR
LENOK  LI R0,DATVDP
       BL @RDADDR
       LI R5,LINE
       MOV R6,@STGLEN
       MOV R6,R6
       JEQ LOADNXT
LOADCP MOVB @>8800,*R5+
       DEC R6
       JNE LOADCP
       MOV @STGPTR,R0
       BL @VADDR
       LI R5,LINE
       MOV @STGLEN,R6
STGCOP MOVB *R5+,@>8C00
       DEC R6
       JNE STGCOP
LOADNXT INC @RECCNT
       JMP LOADLO
LOADEND LI R0,1
       BL @FILEIO
       MOV R3,R3
       JEQ $+6
       B @IOERROR
       CLR @COPYLN
LOADPUT MOV @COPYLN,R0
       LI R1,80
       MPY R1,R0
       MOV R1,@STGOFF
       MOV R1,R0
       AI R0,STAGED
       BL @RDADDR
       LI R5,LINE
       LI R6,80
PUTBUF MOVB @>8800,*R5+
       DEC R6
       JNE PUTBUF
       MOV @STGOFF,R0
       AI R0,>6000
       LI R1,LINE
       LI R2,80
       BL @UGWRIT
       MOV R3,R3
       JEQ $+6
       B @IOERROR
       INC @COPYLN
       MOV @COPYLN,R0
       CI R0,100
       JL LOADPUT
       MOV @RECCNT,@NLINES
       CLR @SELECT
       CLR @DIRTY
       CLR @UVALID
       BL @KEEPNAME
       LI R0,LOADED
       MOV R0,@MESSAGE
       B @CANCEL
LOADERR MOV R3,@IOERR
       LI R0,1
       BL @FILEIO
       MOV @IOERR,R3
IOERROR AI R3,48
       SWPB R3
       MOVB R3,@ERRTXT+11
       LI R0,ERRTXT
       MOV R0,@MESSAGE
       B @CANCEL

DISCARD MOV R11,@DLINK
       LI R0,1
       MOV @DIRTY,R1
       JEQ DISRET
       LI R1,DISMSG
       BL @CONFIRM
DISRET MOV @DLINK,R11
       B *R11
CONFIRM MOV R11,@CFLINK
       MOV R1,@PROMPT
       BL @VIDEO
       LI R0,120
       MOV @PROMPT,R1
       BL @PRINT
       LI R0,200
       LI R1,YESNO
       BL @PRINT
CONKEY BL @GETKEY
       CI R0,89
       JEQ CONYES
       CI R0,78
       JEQ CONNO
       CI R0,15
       JNE CONKEY
CONNO  CLR R0
       JMP CONRET
CONYES LI R0,1
CONRET MOV @CFLINK,R11
       B *R11

ASKNAME MOV R11,@ANLINK
       LI R5,FNAME
       LI R6,NEWNAM
       LI R7,32
CPNAME MOVB *R5+,*R6+
       DEC R7
       JNE CPNAME
* Start with the current name highlighted conceptually: first printable key
* replaces it; Enter accepts it. FCTN-S erases the final character.
       CLR @NAMEDIT
       BL @VIDEO
       LI R0,40
       LI R1,NAMETTL
       BL @PRINT
       LI R0,200
       LI R1,NAMETIP
       BL @PRINT
NAMDRAW LI R0,120
       BL @VADDR
       LI R5,>2000
       LI R6,40
NAMCLR MOVB R5,@>8C00
       DEC R6
       JNE NAMCLR
       LI R0,120
       LI R1,NEWNAM
       BL @PRINT
NAMKEY BL @GETKEY
       CI R0,13
       JEQ NAMYES
       CI R0,15
       JEQ NAMNO
       CI R0,8
       JEQ NAMBACK
       CI R0,33
       JL NAMKEY
       CI R0,90
       JH NAMKEY
       MOV @NAMEDIT,R1
       JNE NAMADD
       CLR @NEWNAM
       LI R1,1
       MOV R1,@NAMEDIT
NAMADD MOV R0,@CHAR
       BL @NAMELEN
       CI R2,31
       JHE NAMKEY
       MOV @CHAR,R0
       SWPB R0
       MOVB R0,*R1+
       CLR R0
       MOVB R0,*R1
       JMP NAMDRAW
NAMBACK BL @NAMELEN
       MOV R2,R2
       JEQ NAMKEY
       DEC R1
       CLR R0
       MOVB R0,*R1
       LI R1,1
       MOV R1,@NAMEDIT
       JMP NAMDRAW
NAMYES BL @NAMELEN
       MOV R2,R2
       JEQ NAMKEY
       LI R0,1
       JMP NAMRET
NAMNO  CLR R0
NAMRET MOV @ANLINK,R11
       B *R11
NAMELEN LI R1,NEWNAM
       CLR R2
NAMELP MOVB *R1,R0
       JEQ NAMELD
       INC R1
       INC R2
       JMP NAMELP
NAMELD B *R11
KEEPNAME LI R5,NEWNAM
       LI R6,FNAME
       LI R7,32
KEEPLO MOVB *R5+,*R6+
       DEC R7
       JNE KEEPLO
       B *R11
BUSY   MOV R11,@BSLINK
       BL @VIDEO
       LI R0,40
       LI R1,WORKTXT
       BL @PRINT
       LI R0,120
       LI R1,NEWNAM
       BL @PRINT
       MOV @BSLINK,R11
       B *R11

FILEIO MOV R11,@IOLINK
       SWPB R0
       MOVB R0,@PAB
       MOVB @FLAGS,@PAB+1
       MOVB @COUNT,@PAB+5
       BL @NAMELEN
       SWPB R2
       MOVB R2,@PAB+9
       LI R0,PABVDP
       BL @VADDR
       LI R5,PAB
       LI R6,10
PABCOP MOVB *R5+,@>8C00
       DEC R6
       JNE PABCOP
       LI R5,NEWNAM
       LI R6,32
PABNAM MOVB *R5+,@>8C00
       DEC R6
       JNE PABNAM
       LI R0,PABVDP+9
       MOV R0,@>8356
       BLWP @DSRVEC
       LI R0,PABVDP+1
       BL @RDADDR
       MOVB @>8800,R3
       SRL R3,13
       MOV @IOLINK,R11
       B *R11
RDADDR MOV R0,R4
       SWPB R4
       MOVB R4,@>8C02
       SWPB R4
       MOVB R4,@>8C02
       B *R11

* Menu repaint reads just the visible lines. It does not copy the document
* into CPU RAM: the cartridge allocation remains its authoritative home.
DRAW   MOV R11,@DRLINK
       BL @VIDEO
       LI R0,40
       LI R1,TITLE
       BL @PRINT
       LI R0,80
       LI R1,DOCTXT
       BL @PRINT
       LI R0,86
       LI R1,FNAME
       BL @PRINT
       LI R0,120
       LI R1,LINETXT
       BL @PRINT
       MOV @SELECT,R0
       INC R0
       BL @NUMBER
       LI R0,125
       LI R1,NUM
       BL @PRINT
       LI R0,130
       LI R1,OF100
       BL @PRINT
       LI R0,143
       LI R1,COLS1
       MOV @VIEW,R2
       JEQ COLSHOW
       LI R1,COLS2
       CI R2,35
       JEQ COLSHOW
       LI R1,COLS3
COLSHOW BL @PRINT
       MOV @DIRTY,R0
       JEQ CLEAN
       LI R0,159
       LI R1,STAR
       BL @PRINT
CLEAN  MOV @SELECT,@DRAWSEL
       CLR R4
       MOV @SELECT,R5
       LI R6,12
       DIV R6,R4
       MOV R4,R0
       MPY R6,R0
       MOV R1,@SELECT
       LI R0,200
       MOV R0,@ROWPOS
       LI R0,12
       MOV R0,@ROWS
DRAWLP MOV @SELECT,R0
       CI R0,100
       JHE DRAWEND
       BL @FETCH
       MOV @SELECT,R0
       INC R0
       BL @NUMBER
       MOV @ROWPOS,R0
       BL @VADDR
       LI R5,>2000
       C @SELECT,@DRAWSEL
       JNE NOSEL
       LI R5,>3E00
NOSEL  MOVB R5,@>8C00
       LI R5,NUM
       MOVB *R5+,@>8C00
       MOVB *R5+,@>8C00
       MOVB *R5,@>8C00
       LI R5,>2000
       MOVB R5,@>8C00
       LI R5,LINE
       A @VIEW,R5
       LI R6,35
ROWLO  CI R5,LINE+80
       JL ROWCHAR
       LI R7,>2000
       MOVB R7,@>8C00
       JMP ROWINC
ROWCHAR MOVB *R5+,@>8C00
ROWINC DEC R6
       JNE ROWLO
       INC @SELECT
       LI R0,40
       A R0,@ROWPOS
       DEC @ROWS
       JNE DRAWLP
DRAWEND MOV @DRAWSEL,@SELECT
       LI R0,720
       MOV @MESSAGE,R1
       BL @PRINT
       LI R0,800
       LI R1,MENU1
       BL @PRINT
       LI R0,840
       LI R1,MENU2
       BL @PRINT
       LI R0,880
       LI R1,CREDIT
       BL @PRINT
       MOV @DRLINK,R11
       B *R11
NUMBER CLR R4
       MOV R0,R5
       LI R6,100
       DIV R6,R4
       AI R4,48
       SWPB R4
       MOVB R4,@NUM
       CLR R4
       LI R6,10
       DIV R6,R4
       AI R4,48
       SWPB R4
       MOVB R4,@NUM+1
       AI R5,48
       SWPB R5
       MOVB R5,@NUM+2
       B *R11
GETKEY LI R0,>0500
       MOVB R0,@>8374
* Console SCAN is a BL entry using GPL workspace, not a BLWP vector.
       MOV @>83F6,@GSR11
       LWPI >83E0
       BL @>000E
       LWPI WORK
       MOV @GSR11,@>83F6
KAFTER CLR R0
       MOVB @>8375,R0
       SRL R0,8
       CI R0,255
       JNE GOTKEY
       MOV R0,@LASTKY
       JMP GETKEY
GOTKEY C R0,@LASTKY
       JEQ GETKEY
       MOV R0,@LASTKY
       B *R11
       COPY 'scratch-video.asm'
TITLE  TEXT 'SCRATCHPAD            '
       .IFDEF SUPERCART
       TEXT 'SUPERCART RAM'
       .ELSE
       TEXT 'UBERGROM RAM'
       .ENDIF
       BYTE 0
DOCTXT TEXT 'FILE:'
       BYTE 0
LINETXT TEXT 'LINE'
       BYTE 0
OF100 TEXT 'OF 100'
       BYTE 0
COLS1 TEXT 'COLS 01-35'
       BYTE 0
COLS2 TEXT 'COLS 36-70'
       BYTE 0
COLS3 TEXT 'COLS 71-80'
       BYTE 0
STAR TEXT '*'
       BYTE 0
MENU1 TEXT 'E EDIT  U UNDO  W SAVE  O OPEN  N NEW'
       BYTE 0
MENU2 TEXT 'ARROWS MOVE/VIEW   Q QUIT'
       BYTE 0
CREDIT TEXT '2026 HEXBUS              LOCAL PREVIEW'
       BYTE 0
WELCOME TEXT '100 LINES OF SCRATCH SPACE. E TO EDIT.'
       BYTE 0
CHANGED TEXT 'LINE STORED. U UNDOES THE LAST EDIT.'
       BYTE 0
UNDONE TEXT 'LAST EDIT UNDONE.'
       BYTE 0
NOUMSG TEXT 'NOTHING TO UNDO.'
       BYTE 0
NEWMSG TEXT 'NEW DOCUMENT.'
       BYTE 0
SAVED TEXT 'SAVED AS DIS/VAR 80.'
       BYTE 0
LOADED TEXT 'DOCUMENT LOADED.'
       BYTE 0
ERRTXT TEXT 'FILE ERROR 0. DOCUMENT KEPT.'
       BYTE 0
EDITTTL TEXT 'EDIT LINE - 80 CHARACTERS'
       BYTE 0
EDITTIP TEXT 'TYPE TO REPLACE. FCTN S/D MOVE.'
       BYTE 0
EDITKEY TEXT 'FCTN 1 DELETE   FCTN 2 INSERT'
       BYTE 0
EDITESC TEXT 'ENTER KEEP   FCTN 9 CANCEL'
       BYTE 0
DISMSG TEXT 'DISCARD UNSAVED CHANGES?'
       BYTE 0
REPLACE TEXT 'REPLACE THE EXISTING FILE?'
       BYTE 0
YESNO TEXT 'Y YES   N NO'
       BYTE 0
NAMETTL TEXT 'FILE NAME - FOR EXAMPLE UBE1.NOTES'
       BYTE 0
NAMETIP TEXT 'ENTER ACCEPT   FCTN S ERASE   FCTN 9 BACK'
       BYTE 0
WORKTXT TEXT 'WORKING - PLEASE WAIT'
       BYTE 0
DEFAULT TEXT 'UBE1.NOTES'
       BYTE 0
       BSS 21
       EVEN
PAB    BYTE 0,0
       DATA DATVDP
       BYTE 80,0
       DATA 0
       BYTE 0,0
DSRVEC DATA BRWORK,BRIDGE
NUM TEXT '000'
       BYTE 0
SELECT DATA 0
VIEW DATA 0
NLINES DATA 0
DIRTY DATA 0
UVALID DATA 0
ULINE DATA 0
MODE DATA 0
CURSOR DATA 0
LASTKY DATA 0
MESSAGE DATA 0
ROWS DATA 0
ROWPOS DATA 0
DRAWSEL DATA 0
IOSEL DATA 0
RECCNT DATA 0
STGPTR DATA 0
STGLEN DATA 0
STGOFF DATA 0
COPYLN DATA 0
IOERR DATA 0
CHAR DATA 0
NAMEDIT DATA 0
FLAGS BYTE 0
COUNT BYTE 0
PROMPT DATA 0
FLINK BSS 2
SLINK BSS 2
ELINK BSS 2
DRLINK BSS 2
DLINK BSS 2
CFLINK BSS 2
ANLINK BSS 2
IOLINK BSS 2
BSLINK BSS 2
GSR11 BSS 2
FNAME BSS 32
NEWNAM BSS 32
       COPY 'scratch-font.asm'
       COPY 'ugram.asm'
BRIDGE BCOPY 'bridge.bin'
CODEEND EQU $
       END START

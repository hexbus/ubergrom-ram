* Copyright (c) 2026 hexbus. SPDX-License-Identifier: Apache-2.0
* Standalone CPU entry at >A000. Load with E/A option 5 or a debugger.
* STATUS becomes >600D on success or an ABI error; DONE loops for inspection.
       DEF  START
       AORG >A000
START  LWPI WORK
       LI   R0,>6000
       LI   R1,>1234
       BL   @UGPUTW
       MOV  R3,R3
       JNE  FAILED
       LI   R0,>6000
       BL   @UGGETW
       MOV  R3,R3
       JNE  FAILED
       CI   R1,>1234
       JNE  BADVAL
* This transfer crosses the library's physical RAM page boundary.
       LI   R0,>66FC
       LI   R1,MESSAGE
       LI   R2,MSGLEN
       BL   @UGWRIT
       MOV  R3,R3
       JNE  FAILED
       LI   R0,>66FC
       LI   R1,RESULT
       LI   R2,MSGLEN
       BL   @UGREAD
       MOV  R3,R3
       JNE  FAILED
       LI   R3,>600D
       JMP  FAILED
BADVAL LI   R3,>FFFF
FAILED MOV  R3,@STATUS
DONE   JMP  DONE
STATUS DATA 0
WORK   BSS  32
MESSAGE TEXT 'HELLO FROM UBERGROM RAM'
MSGLEN EQU  $-MESSAGE
       EVEN
RESULT BSS  MSGLEN
       EVEN
       COPY 'ugram.asm'
       END  START

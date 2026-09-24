* Copyright (c) 2026 hexbus. SPDX-License-Identifier: Apache-2.0
* RAMTEST-only GPL file-call bridge. Derived from the module bridge in
* adventure-ubergrom/sources/cpu/cart-dsrlink.asm; not a module replacement.
* Save console scratchpad in ordinary CPU RAM, removing the diagnostic's
* independent GROM RAM transfer path. The library remains under test.
* ENTRYBASE, WORKSPACE, GPLCALL are supplied by build-hardware-kit.py.
       AORG ENTRYBASE
START  ANDI R15,>DFFF
       MOV @>8356,R6
       MOVB @>9802,R5
       SWPB R5
       MOVB @>9802,R5
       SWPB R5
       DEC R5
       LI R0,>8300
       LI R1,CPUSAV
       LI R2,128
SAVE   MOV *R0+,*R1+
       DEC R2
       JNE SAVE
       LI R0,RESUME
       MOV R0,@>8300
       LI R0,GPLCALL
       MOVB R0,@>9C02
       SWPB R0
       MOVB R0,@>9C02
       LWPI >83E0
       B @>006A
RESUME LWPI WORKSPACE
       MOV R6,R0
       AI R0,-8
       SWPB R0
       MOVB R0,@>8C02
       SWPB R0
       MOVB R0,@>8C02
       MOVB @>8800,R7
       ANDI R7,>E000
       JEQ RESTORE
       ORI R15,>2000
RESTORE LI R0,CPUSAV
       LI R1,>8300
       LI R2,128
BACK   MOV *R0+,*R1+
       DEC R2
       JNE BACK
       MOVB R5,@>9C02
       SWPB R5
       MOVB R5,@>9C02
       RTWP
CPUSAV BSS 256
       END

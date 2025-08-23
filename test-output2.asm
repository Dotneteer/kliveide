- Fully Commented Commodore 64 KERNAL ROM Disassembly (English, "CBM")
-
- The comments have been taken from
-    The original C64 KERNAL source by Commodore (901227-03)
-    https://github.com/mist64/cbmsrc
-    https://www.pagetable.com/?p=894
-
- The comments here are basically a complete copy of the original
- source code, lined up with the version in the C64 ROM.
- This way, even all variable names are intact.
-
- Converted and formatted by Michael Steil <mist64@mac.com>
-
- Corrections (formatting, lining up) welcome at:
- https://github.com/mist64/c64ref
-
------------------------------------------------------------
-
# This plain text file is formatted so that it can be automatically
# parsed in order to create cross-references etc.
# * Lines starting with "-" is top-level information. The first line
#   is the title. Lines starting with "--" are separators.
# * Lines starting with "#" are internal comments.
# * Lines starting with ".," indicate code to be disassembled.
# * Lines starting with ".:" indicate bytes to be dumped.
# * Comments start at the 33rd column.
# * 32 leading spaces and ".LIB" indicate a heading.
# * Otherwise, 32 leading spaces indicate an overflow comment.
# The encoding is UTF-8.

                                .LIB   DISCLAIMER
                                ;****************************************
                                ;*                                      *
                                ;* KK  K EEEEE RRRR  NN  N  AAA  LL     *
                                ;* KK KK EE    RR  R NNN N AA  A LL     *
                                ;* KKK   EE    RR  R NNN N AA  A LL     *
                                ;* KKK   EEEE  RRRR  NNNNN AAAAA LL     *
                                ;* KK K  EE    RR  R NN NN AA  A LL     *
                                ;* KK KK EE    RR  R NN NN AA  A LL     *
                                ;* KK KK EEEEE RR  R NN NN AA  A LLLLL  *
                                ;*                                      *
                                ;***************************************
                                ;
                                ;***************************************
                                ;* PET KERNAL                          *
                                ;*   MEMORY AND I/O DEPENDENT ROUTINES *
                                ;* DRIVING THE HARDWARE OF THE         *
                                ;* FOLLOWING CBM MODELS:               *
                                ;*   COMMODORE 64 OR MODIFED VIC-40    *
                                ;* COPYRIGHT (C) 1982 BY               *
                                ;* COMMODORE BUSINESS MACHINES (CBM)   *
                                ;***************************************
                                ;****LISTING DATE --1200 14 MAY 1982****
                                ;***************************************
                                ;* THIS SOFTWARE IS FURNISHED FOR USE  *
                                ;* USE IN THE VIC OR COMMODORE COMPUTER*
                                ;* SERIES ONLY.                        *
                                ;*                                     *
                                ;* COPIES THEREOF MAY NOT BE PROVIDED  *
                                ;* OR MADE AVAILABLE FOR USE ON ANY    *
                                ;* OTHER SYSTEM.                       *
                                ;*                                     *
                                ;* THE INFORMATION IN THIS DOCUMENT IS *
                                ;* SUBJECT TO CHANGE WITHOUT NOTICE.   *
                                ;*                                     *
                                ;* NO RESPONSIBILITY IS ASSUMED FOR    *
                                ;* RELIABILITY OF THIS SOFTWARE. RSR   *
                                ;*                                     *
                                ;***************************************
                                .END
                                .LIB   DECLARE
                                *=$0000                ;DECLARE 6510 PORTS
                                D6510  *=*+1           ;6510 DATA DIRECTION REGISTER
                                R6510  *=*+1           ;6510 DATA REGISTER
                                *=$0002                ;MISS 6510 REGS
                                ;VIRTUAL REGS FOR MACHINE LANGUAGE MONITOR
                                PCH    *=*+1
                                PCL    *=*+1
                                FLGS   *=*+1
                                ACC    *=*+1
                                XR     *=*+1
                                YR     *=*+1
                                SP     *=*+1
                                INVH   *=*+1           ;USER MODIFIABLE IRQ
                                INVL   *=*+1
                                *      =$90
                                STATUS *=*+1           ;I/O OPERATION STATUS BYTE
                                ; CRFAC *=*+2 ;CORRECTION FACTOR (UNUSED)
                                STKEY  *=*+1           ;STOP KEY FLAG
                                SVXT   *=*+1           ;TEMPORARY
                                VERCK  *=*+1           ;LOAD OR VERIFY FLAG
                                C3P0   *=*+1           ;IEEE BUFFERED CHAR FLAG
                                BSOUR  *=*+1           ;CHAR BUFFER FOR IEEE
                                SYNO   *=*+1           ;CASSETTE SYNC #
                                XSAV   *=*+1           ;TEMP FOR BASIN
                                LDTND  *=*+1           ;INDEX TO LOGICAL FILE
                                DFLTN  *=*+1           ;DEFAULT INPUT DEVICE #
                                DFLTO  *=*+1           ;DEFAULT OUTPUT DEVICE #
                                PRTY   *=*+1           ;CASSETTE PARITY
                                DPSW   *=*+1           ;CASSETTE DIPOLE SWITCH
                                MSGFLG *=*+1           ;OS MESSAGE FLAG
                                PTR1                   ;CASSETTE ERROR PASS1
                                T1     *=*+1           ;TEMPORARY 1
                                TMPC
                                PTR2                   ;CASSETTE ERROR PASS2
                                T2     *=*+1           ;TEMPORARY 2
                                TIME   *=*+3           ;24 HOUR CLOCK IN 1/60TH SECONDS
                                R2D2                   ;SERIAL BUS USAGE
                                PCNTR  *=*+1           ;CASSETTE STUFF
                                ; PTCH *=*+1  (UNUSED)
                                BSOUR1                 ;TEMP USED BY SERIAL ROUTINE
                                FIRT   *=*+1
                                COUNT                  ;TEMP USED BY SERIAL ROUTINE
                                CNTDN  *=*+1           ;CASSETTE SYNC COUNTDOWN
                                BUFPT  *=*+1           ;CASSETTE BUFFER POINTER
                                INBIT                  ;RS-232 RCVR INPUT BIT STORAGE
                                SHCNL  *=*+1           ;CASSETTE SHORT COUNT
                                BITCI                  ;RS-232 RCVR BIT COUNT IN
                                RER    *=*+1           ;CASSETTE READ ERROR
                                RINONE                 ;RS-232 RCVR FLAG FOR START BIT CHECK
                                REZ    *=*+1           ;CASSETE READING ZEROES
                                RIDATA                 ;RS-232 RCVR BYTE BUFFER
                                RDFLG  *=*+1           ;CASSETTE READ MODE
                                RIPRTY                 ;RS-232 RCVR PARITY STORAGE
                                SHCNH  *=*+1           ;CASSETTE SHORT CNT
                                SAL    *=*+1
                                SAH    *=*+1
                                EAL    *=*+1
                                EAH    *=*+1
                                CMP0   *=*+1
                                TEMP   *=*+1
                                TAPE1  *=*+2           ;ADDRESS OF TAPE BUFFER #1Y.
                                BITTS                  ;RS-232 TRNS BIT COUNT
                                SNSW1  *=*+1
                                NXTBIT                 ;RS-232 TRNS NEXT BIT TO BE SENT
                                DIFF   *=*+1
                                RODATA                 ;RS-232 TRNS BYTE BUFFER
                                PRP    *=*+1
                                FNLEN  *=*+1           ;LENGTH CURRENT FILE N STR
                                LA     *=*+1           ;CURRENT FILE LOGICAL ADDR
                                SA     *=*+1           ;CURRENT FILE 2ND ADDR
                                FA     *=*+1           ;CURRENT FILE PRIMARY ADDR
                                FNADR  *=*+2           ;ADDR CURRENT FILE NAME STR
                                ROPRTY                 ;RS-232 TRNS PARITY BUFFER
                                OCHAR  *=*+1
                                FSBLK  *=*+1           ;CASSETTE READ BLOCK COUNT
                                MYCH   *=*+1
                                CAS1   *=*+1           ;CASSETTE MANUAL/CONTROLLED SWITCH
                                TMP0
                                STAL   *=*+1
                                STAH   *=*+1
                                MEMUSS                 ;CASSETTE LOAD TEMPS (2 BYTES)
                                TMP2   *=*+2
                                ;
                                ;VARIABLES FOR SCREEN EDITOR
                                ;
                                LSTX   *=*+1           ;KEY SCAN INDEX
                                ; SFST *=*+1 ;KEYBOARD SHIFT FLAG (UNUSED)
                                NDX    *=*+1           ;INDEX TO KEYBOARD Q
                                RVS    *=*+1           ;RVS FIELD ON FLAG
                                INDX   *=*+1
                                LSXP   *=*+1           ;X POS AT START
                                LSTP   *=*+1
                                SFDX   *=*+1           ;SHIFT MODE ON PRINT
                                BLNSW  *=*+1           ;CURSOR BLINK ENAB
                                BLNCT  *=*+1           ;COUNT TO TOGGLE CUR
                                GDBLN  *=*+1           ;CHAR BEFORE CURSOR
                                BLNON  *=*+1           ;ON/OFF BLINK FLAG
                                CRSW   *=*+1           ;INPUT VS GET FLAG
                                PNT    *=*+2           ;POINTER TO ROW
                                ; POINT *=*+1   (UNUSED)
                                PNTR   *=*+1           ;POINTER TO COLUMN
                                QTSW   *=*+1           ;QUOTE SWITCH
                                LNMX   *=*+1           ;40/80 MAX POSITON
                                TBLX   *=*+1
                                DATA   *=*+1
                                INSRT  *=*+1           ;INSERT MODE FLAG
                                LDTB1  *=*+26          ;LINE FLAGS+ENDSPACE
                                USER   *=*+2           ;SCREEN EDITOR COLOR IP
                                KEYTAB *=*+2           ;KEYSCAN TABLE INDIRECT
                                ;RS-232 Z-PAGE
                                RIBUF  *=*+2           ;RS-232 INPUT BUFFER POINTER
                                ROBUF  *=*+2           ;RS-232 OUTPUT BUFFER POINTER
                                FREKZP *=*+4           ;FREE KERNAL ZERO PAGE 9/24/80
                                BASZPT *=*+1           ;LOCATION ($00FF) USED BY BASIC
                                *=$100 
                                BAD    *=*+1
                                *=$200
                                BUF    *=*+89          ;BASIC/MONITOR BUFFER
                                ; TABLES FOR OPEN FILES
                                ;
                                LAT    *=*+10          ;LOGICAL FILE NUMBERS
                                FAT    *=*+10          ;PRIMARY DEVICE NUMBERS
                                SAT    *=*+10          ;SECONDARY ADDRESSES
                                ; SYSTEM STORAGE
                                ;
                                KEYD   *=*+10          ;IRQ KEYBOARD BUFFER
                                MEMSTR *=*+2           ;START OF MEMORY
                                MEMSIZ *=*+2           ;TOP OF MEMORY
                                TIMOUT *=*+1           ;IEEE TIMEOUT FLAG
                                ; SCREEN EDITOR STORAGE
                                ;
                                COLOR  *=*+1           ;ACTIV COLOR NYBBLE
                                GDCOL  *=*+1           ;ORIGINAL COLOR BEFORE CURSOR
                                HIBASE *=*+1           ;BASE LOCATION OF SCREEN (TOP)
                                XMAX   *=*+1
                                RPTFLG *=*+1           ;KEY REPEAT FLAG
                                KOUNT  *=*+1
                                DELAY  *=*+1
                                SHFLAG *=*+1           ;SHIFT FLAG BYTE
                                LSTSHF *=*+1           ;LAST SHIFT PATTERN
                                KEYLOG *=*+2           ;INDIRECT FOR KEYBOARD TABLE SETUP
                                MODE   *=*+1           ;0-PET MODE, 1-CATTACANNA
                                AUTODN *=*+1           ;AUTO SCROLL DOWN FLAG(=0 ON,<>0 OFF)
                                ; RS-232 STORAGE
                                ;
                                M51CTR *=*+1           ;6551 CONTROL REGISTER
                                M51CDR *=*+1           ;6551 COMMAND REGISTER
                                M51AJB *=*+2           ;NON STANDARD (BITTIME/2-100)
                                RSSTAT *=*+1           ; RS-232 STATUS REGISTER
                                BITNUM *=*+1           ;NUMBER OF BITS TO SEND (FAST RESPONSE)
                                BAUDOF *=*+2           ;BAUD RATE FULL BIT TIME (CREATED BY OPEN)
                                ;
                                ; RECIEVER STORAGE
                                ;
                                ; INBIT *=*+1 ;INPUT BIT STORAGE
                                ; BITCI *=*+1 ;BIT COUNT IN
                                ; RINONE *=*+1 ;FLAG FOR START BIT CHECK
                                ; RIDATA *=*+1 ;BYTE IN BUFFER
                                ; RIPRTY *=*+1 ;BYTE IN PARITY STORAGE
                                RIDBE  *=*+1           ;INPUT BUFFER INDEX TO END
                                RIDBS  *=*+1           ;INPUT BUFFER POINTER TO START
                                ;
                                ; TRANSMITTER STORAGE
                                ;
                                ; BITTS *=*+1 ;# OF BITS TO BE SENT
                                ; NXTBIT *=*+1 ;NEXT BIT TO BE SENT
                                ; ROPRTY *=*+1 ;PARITY OF BYTE SENT
                                ; RODATA *=*+1 ;BYTE BUFFER OUT
                                RODBS  *=*+1           ;OUTPUT BUFFER INDEX TO START
                                RODBE  *=*+1           ;OUTPUT BUFFER INDEX TO END
                                ;
                                IRQTMP *=*+2           ;HOLDS IRQ DURING TAPE OPS
                                ;
                                ; TEMP SPACE FOR VIC-40 VARIABLES ****
                                ;
                                ENABL  *=*+1           ;RS-232 ENABLES (REPLACES IER)
                                CASTON *=*+1           ;TOD SENSE DURING CASSETTES
                                KIKA26 *=*+1           ;TEMP STORAGE FOR CASSETTE READ ROUTINE
                                STUPID *=*+1           ;TEMP D1IRQ INDICATOR FOR CASSETTE READ
                                LINTMP *=*+1           ;TEMPORARY FOR LINE INDEX
                                *=$0300                ;REM PROGRAM INDIRECTS(10)
                                *=$0300+20             ;REM KERNAL/OS INDIRECTS(20)
                                CINV   *=*+2           ;IRQ RAM VECTOR
                                CBINV  *=*+2           ;BRK INSTR RAM VECTOR
                                NMINV  *=*+2           ;NMI RAM VECTOR
                                IOPEN  *=*+2           ;INDIRECTS FOR CODE
                                ICLOSE *=*+2           ; CONFORMS TO KERNAL SPEC 8/19/80
                                ICHKIN *=*+2
                                ICKOUT *=*+2
                                ICLRCH *=*+2
                                IBASIN *=*+2
                                IBSOUT *=*+2
                                ISTOP  *=*+2
                                IGETIN *=*+2
                                ICLALL *=*+2
                                USRCMD *=*+2
                                ILOAD  *=*+2
                                ISAVE  *=*+2           ;SAVESP
                                *=$0300+60
                                TBUFFR *=*+192         ;CASSETTE DATA BUFFER
                                *      =$400
                                VICSCN *=*+1024
                                RAMLOC
                                ; I/O DEVICES
                                ;
                                *      =$D000
                                VICREG =*              ;VIC REGISTERS
                                *      =$D400
                                SIDREG =*              ;SID REGISTERS
                                *      =$D800
                                VICCOL *=*+1024        ;VIC COLOR NYBBLES
                                *      =$DC00          ;DEVICE1 6526 (PAGE1 IRQ)
                                COLM                   ;KEYBOARD MATRIX
                                D1PRA  *=*+1
                                ROWS                   ;KEYBOARD MATRIX
                                D1PRB  *=*+1
                                D1DDRA *=*+1
                                D1DDRB *=*+1
                                D1T1L  *=*+1
                                D1T1H  *=*+1
                                D1T2L  *=*+1
                                D1T2H  *=*+1
                                D1TOD1 *=*+1
                                D1TODS *=*+1
                                D1TODM *=*+1
                                D1TODH *=*+1
                                D1SDR  *=*+1
                                D1ICR  *=*+1
                                D1CRA  *=*+1
                                D1CRB  *=*+1
                                *      =$DD00          ;DEVICE2 6526 (PAGE2 NMI)
                                D2PRA  *=*+1
                                D2PRB  *=*+1
                                D2DDRA *=*+1
                                D2DDRB *=*+1
                                D2T1L  *=*+1
                                D2T1H  *=*+1
                                D2T2L  *=*+1
                                D2T2H  *=*+1
                                D2TOD1 *=*+1
                                D2TODS *=*+1
                                D2TODM *=*+1
                                D2TODH *=*+1
                                D2SDR  *=*+1
                                D2ICR  *=*+1
                                D2CRA  *=*+1
                                D2CRB  *=*+1
                                TIMRB  =$19            ;6526 CRB ENABLE ONE-SHOT TB
                                ;TAPE BLOCK TYPES
                                ;
                                EOT    =5              ;END OF TAPE
                                BLF    =1              ;BASIC LOAD FILE
                                BDF    =2              ;BASIC DATA FILE
                                PLF    =3              ;FIXED PROGRAM TYPE
                                BDFH   =4              ;BASIC DATA FILE HEADER
                                BUFSZ  =192            ;BUFFER SIZE
                                ;
                                ;SCREEN EDITOR CONSTANTS
                                ;
                                LLEN   =40             ;SINGLE LINE 40 COLUMNS
                                LLEN2  =80             ;DOUBLE LINE = 80 COLUMNS
                                NLINES =25             ;25 ROWS ON SCREEN
                                WHITE  =$01            ;WHITE SCREEN COLOR
                                BLUE   =$06            ;BLUE CHAR COLOR
                                CR     =$D             ;CARRIAGE RETURN
                                .END
                                *=$E500                ;START OF VIC-40 KERNAL

                                .LIB   EDITOR.1
                                MAXCHR=80
                                NWRAP=2                ;MAX NUMBER OF PHYSICAL LINES PER LOGICAL LINE
                                ;
                                ;UNDEFINED FUNCTION ENTRY
                                ;
                                ; UNDEFD LDX #0
                                ; UNDEF2 LDA UNMSG,X
                                ; JSR PRT
                                ; INX
                                ; CPX #UNMSG2-UNMSG
                                ; BNE UNDEF2
                                ; SEC
                                ; RTS
                                ;
                                ; UNMSG .BYT $D,'?ADVANCED FUNCTION NOT AVAILABLE',$D
                                ; UNMSG2
                                ;
                                ;RETURN ADDRESS OF 6526
                                ;
    ldx #                               ; $00        IOBASE LDX #<D1PRA
    ldy #                               ; $DC        LDY    #>D1PRA
RTS:                                    ; $E504
    rts
                                ;
                                ;RETURN MAX ROWS,COLS OF SCREEN
                                ;
    ldx #                               ; $28        SCRORG LDX #LLEN
    ldy #                               ; $19        LDY    #NLINES
RTS:                                    ; $E509
    rts
                                ;
                                ;READ/PLOT CURSOR POSITION
                                ;
E513:                                   ; $E50A
    bcs $                               ; PLOT   BCS PLOT10
D6:                                     ; $E50C
    stx $                               ; STX    TBLX
D3:                                     ; $E50E
    sty $                               ; STY    PNTR
.,E510 20 6C E5 JSR $E56C       JSR    STUPT
D6:                                     ; $E513
    ldx $                               ; PLOT10 LDX TBLX
D3:                                     ; $E515
    ldy $                               ; LDY    PNTR
RTS:                                    ; $E517
    rts
                                ;INITIALIZE I/O
                                ;
                                CINT
                                ;
                                ; ESTABLISH SCREEN MEMORY
                                ;
.,E518 20 A0 E5 JSR $E5A0              JSR PANIC       ;SET UP VIC
                                ;
    lda #                               ; $00               LDA #0          ;MAKE SURE WE'RE IN PET MODE
.,E51D 8D 91 02 STA $0291              STA MODE
CF:                                     ; $E520
    sta $                               ; STA BLNON       ;WE DONT HAVE A GOOD CHAR FROM THE SCREEN YET
    lda #                               ; $48               LDA #<SHFLOG    ;SET SHIFT LOGIC INDIRECTS
.,E524 8D 8F 02 STA $028F              STA KEYLOG
    lda #                               ; $EB               LDA #>SHFLOG
.,E529 8D 90 02 STA $0290              STA KEYLOG+1
    lda #                               ; $0A               LDA #10
.,E52E 8D 89 02 STA $0289              STA XMAX        ;MAXIMUM TYPE AHEAD BUFFER SIZE
.,E531 8D 8C 02 STA $028C              STA DELAY
    lda #                               ; $0E               LDA #$E         ;INIT COLOR TO LIGHT BLUE<<<<<<<<<<
.,E536 8D 86 02 STA $0286              STA COLOR
    lda #                               ; $04               LDA #4
.,E53B 8D 8B 02 STA $028B              STA KOUNT       ;DELAY BETWEEN KEY REPEATS
    lda #                               ; $0C               LDA #$C
CD:                                     ; $E540
    sta $                               ; STA BLNCT
CC:                                     ; $E542
    sta $                               ; STA BLNSW
.,E544 AD 88 02 LDA $0288              CLSR LDA HIBASE ;FILL HI BYTE PTR TABLE
    ora #                               ; $80               ORA #$80
TAY:                                    ; $E549
    tay
    lda #                               ; $00               LDA #0
TAX:                                    ; $E54C
    tax
D9:                                     ; $E54D
    sty $                               ; ,X              LPS1 STY LDTB1,X
CLC:                                    ; $E54F
    clc
    adc #                               ; $28               ADC #LLEN
E555:                                   ; $E552
    bcc $                               ; BCC LPS2
INY:                                    ; $E554
    iny                                 ; CARRY BUMP HI BYTE
LPS2:                                   ; $E555
    inx                                 ; INX
    cpx #                               ; $1A               CPX #NLINES+1   ;DONE # OF LINES?
E54D:                                   ; $E558
    bne $                               ; BNE LPS1        ;NO...
    lda #                               ; $FF               LDA #$FF        ;TAG END OF LINE TABLE
D9:                                     ; $E55C
    sta $                               ; ,X              STA LDTB1,X
    ldx #                               ; $18               LDX #NLINES-1   ;CLEAR FROM THE BOTTOM LINE UP
.,E560 20 FF E9 JSR $E9FF       CLEAR1 JSR CLRLN       ;SEE SCROLL ROUTINES
DEX:                                    ; $E563
    dex
E560:                                   ; $E564
    bpl $                               ; BPL CLEAR1
                                ;HOME FUNCTION
                                ;
    ldy #                               ; $00        NXTD   LDY #0
D3:                                     ; $E568
    sty $                               ; STY    PNTR            ;LEFT COLUMN
D6:                                     ; $E56A
    sty $                               ; STY    TBLX            ;TOP LINE
                                ;
                                ;MOVE CURSOR TO TBLX,PNTR
                                ;
                                STUPT
D6:                                     ; $E56C
    ldx $                               ; LDX TBLX        ;GET CURENT LINE INDEX
D3:                                     ; $E56E
    lda $                               ; LDA PNTR        ;GET CHARACTER POINTER
D9:                                     ; $E570
    ldy $                               ; ,X       FNDSTR LDY LDTB1,X     ;FIND BEGINING OF LINE
E57C:                                   ; $E572
    bmi $                               ; BMI STOK        ;BRANCH IF START FOUND
CLC:                                    ; $E574
    clc
    adc #                               ; $28               ADC #LLEN       ;ADJUST POINTER
D3:                                     ; $E577
    sta $                               ; STA PNTR
DEX:                                    ; $E579
    dex
E570:                                   ; $E57A
    bpl $                               ; BPL FNDSTR
                                ;
.,E57C 20 F0 E9 JSR $E9F0       STOK   JSR SETPNT      ;SET UP PNT INDIRECT 901227-03**********
                                ;
    lda #                               ; $27               LDA #LLEN-1
INX:                                    ; $E581
    inx
D9:                                     ; $E582
    ldy $                               ; ,X       FNDEND LDY LDTB1,X
E58C:                                   ; $E584
    bmi $                               ; BMI STDONE
CLC:                                    ; $E586
    clc
    adc #                               ; $28               ADC #LLEN
INX:                                    ; $E589
    inx
E582:                                   ; $E58A
    bpl $                               ; BPL FNDEND
                                STDONE
D5:                                     ; $E58C
    sta $                               ; STA LNMX
.,E58E 4C 24 EA JMP $EA24              JMP SCOLOR      ;MAKE COLOR POINTER FOLLOW 901227-03**********
                                ; THIS IS A PATCH FOR INPUT LOGIC 901227-03**********
                                ;   FIXES INPUT"XXXXXXX-40-XXXXX";A$ PROBLEM
                                ;
C9:                                     ; $E591
    cpx $                               ; FINPUT CPX LSXP        ;CHECK IF ON SAME LINE
E598:                                   ; $E593
    beq $                               ; BEQ FINPUX      ;YES..RETURN TO SEND
.,E595 4C ED E6 JMP $E6ED              JMP FINDST      ;CHECK IF WE WRAPPED DOWN...
FINPUX:                                 ; $E598
    rts                                 ; RTS
NOP:                                    ; $E599
    nop                                 ; KEEP THE SPACE THE SAME...
                                ;PANIC NMI ENTRY
                                ;
.,E59A 20 A0 E5 JSR $E5A0       VPAN   JSR PANIC       ;FIX VIC SCREEN
.,E59D 4C 66 E5 JMP $E566       JMP    NXTD            ;HOME CURSOR
    lda #                               ; $03        PANIC  LDA #3          ;RESET DEFAULT I/O
    sta $                               ; 9A         STA    DFLTO
    lda #                               ; $00        LDA    #0
    sta $                               ; 99         STA    DFLTN
                                ;INIT VIC
                                ;
    ldx #                               ; $2F        INITV  LDX #47         ;LOAD ALL VIC REGS ***
.,E5AA BD B8 EC LDA $ECB8,X     PX4    LDA TVIC-1,X
.,E5AD 9D FF CF STA $CFFF,X            STA VICREG-1,X
DEX:                                    ; $E5B0
    dex
E5AA:                                   ; $E5B1
    bne $                               ; BNE    PX4
RTS:                                    ; $E5B3
    rts
                                ;
                                ;REMOVE CHARACTER FROM QUEUE
                                ;
.,E5B4 AC 77 02 LDY $0277       LP2    LDY KEYD
    ldx #                               ; $00        LDX    #0
.,E5B9 BD 78 02 LDA $0278,X     LP1    LDA KEYD+1,X
.,E5BC 9D 77 02 STA $0277,X     STA    KEYD,X
INX:                                    ; $E5BF
    inx
C6:                                     ; $E5C0
    cpx $                               ; CPX    NDX
E5B9:                                   ; $E5C2
    bne $                               ; BNE    LP1
C6:                                     ; $E5C4
    dec $                               ; DEC    NDX
TYA:                                    ; $E5C6
    tya
CLI:                                    ; $E5C7
    cli
CLC:                                    ; $E5C8
    clc                                 ; GOOD RETURN
RTS:                                    ; $E5C9
    rts
                                ;
.,E5CA 20 16 E7 JSR $E716       LOOP4  JSR PRT
                                LOOP3
C6:                                     ; $E5CD
    lda $                               ; LDA    NDX
CC:                                     ; $E5CF
    sta $                               ; STA    BLNSW
.,E5D1 8D 92 02 STA $0292       STA    AUTODN          ;TURN ON AUTO SCROLL DOWN
E5CD:                                   ; $E5D4
    beq $                               ; BEQ    LOOP3
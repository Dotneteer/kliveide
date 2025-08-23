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
    ldx                                 ; #$00        IOBASE LDX #<D1PRA
    ldy                                 ; #$DC        LDY    #>D1PRA
    rts                                 ; RTS
                                ;
                                ;RETURN MAX ROWS,COLS OF SCREEN
                                ;
    ldx                                 ; #$28        SCRORG LDX #LLEN
    ldy                                 ; #$19        LDY    #NLINES
    rts                                 ; RTS
                                ;
                                ;READ/PLOT CURSOR POSITION
                                ;
    bcs                                 ; $E513       PLOT   BCS PLOT10
    stx                                 ; $D6         STX    TBLX
    sty                                 ; $D3         STY    PNTR
    jsr                                 ; $E56C       JSR    STUPT
    ldx                                 ; $D6         PLOT10 LDX TBLX
    ldy                                 ; $D3         LDY    PNTR
    rts                                 ; RTS
                                ;INITIALIZE I/O
                                ;
                                CINT
                                ;
                                ; ESTABLISH SCREEN MEMORY
                                ;
    jsr                                 ; $E5A0              JSR PANIC       ;SET UP VIC
                                ;
    lda                                 ; #$00               LDA #0          ;MAKE SURE WE'RE IN PET MODE
    sta                                 ; $0291              STA MODE
    sta                                 ; $CF                STA BLNON       ;WE DONT HAVE A GOOD CHAR FROM THE SCREEN YET
    lda                                 ; #$48               LDA #<SHFLOG    ;SET SHIFT LOGIC INDIRECTS
    sta                                 ; $028F              STA KEYLOG
    lda                                 ; #$EB               LDA #>SHFLOG
    sta                                 ; $0290              STA KEYLOG+1
    lda                                 ; #$0A               LDA #10
    sta                                 ; $0289              STA XMAX        ;MAXIMUM TYPE AHEAD BUFFER SIZE
    sta                                 ; $028C              STA DELAY
    lda                                 ; #$0E               LDA #$E         ;INIT COLOR TO LIGHT BLUE<<<<<<<<<<
    sta                                 ; $0286              STA COLOR
    lda                                 ; #$04               LDA #4
    sta                                 ; $028B              STA KOUNT       ;DELAY BETWEEN KEY REPEATS
    lda                                 ; #$0C               LDA #$C
    sta                                 ; $CD                STA BLNCT
    sta                                 ; $CC                STA BLNSW
    lda                                 ; $0288              CLSR LDA HIBASE ;FILL HI BYTE PTR TABLE
    ora                                 ; #$80               ORA #$80
    tay                                 ; TAY
    lda                                 ; #$00               LDA #0
    tax                                 ; TAX
    sty                                 ; $D9,X              LPS1 STY LDTB1,X
    clc                                 ; CLC
    adc                                 ; #$28               ADC #LLEN
    bcc                                 ; $E555              BCC LPS2
    iny                                 ; INY             ;CARRY BUMP HI BYTE
    inx                                 ; LPS2 INX
    cpx                                 ; #$1A               CPX #NLINES+1   ;DONE # OF LINES?
    bne                                 ; $E54D              BNE LPS1        ;NO...
    lda                                 ; #$FF               LDA #$FF        ;TAG END OF LINE TABLE
    sta                                 ; $D9,X              STA LDTB1,X
    ldx                                 ; #$18               LDX #NLINES-1   ;CLEAR FROM THE BOTTOM LINE UP
    jsr                                 ; $E9FF       CLEAR1 JSR CLRLN       ;SEE SCROLL ROUTINES
    dex                                 ; DEX
    bpl                                 ; $E560              BPL CLEAR1
                                ;HOME FUNCTION
                                ;
    ldy                                 ; #$00        NXTD   LDY #0
    sty                                 ; $D3         STY    PNTR            ;LEFT COLUMN
    sty                                 ; $D6         STY    TBLX            ;TOP LINE
                                ;
                                ;MOVE CURSOR TO TBLX,PNTR
                                ;
                                STUPT
    ldx                                 ; $D6                LDX TBLX        ;GET CURENT LINE INDEX
    lda                                 ; $D3                LDA PNTR        ;GET CHARACTER POINTER
    ldy                                 ; $D9,X       FNDSTR LDY LDTB1,X     ;FIND BEGINING OF LINE
    bmi                                 ; $E57C              BMI STOK        ;BRANCH IF START FOUND
    clc                                 ; CLC
    adc                                 ; #$28               ADC #LLEN       ;ADJUST POINTER
    sta                                 ; $D3                STA PNTR
    dex                                 ; DEX
    bpl                                 ; $E570              BPL FNDSTR
                                ;
    jsr                                 ; $E9F0       STOK   JSR SETPNT      ;SET UP PNT INDIRECT 901227-03**********
                                ;
    lda                                 ; #$27               LDA #LLEN-1
    inx                                 ; INX
    ldy                                 ; $D9,X       FNDEND LDY LDTB1,X
    bmi                                 ; $E58C              BMI STDONE
    clc                                 ; CLC
    adc                                 ; #$28               ADC #LLEN
    inx                                 ; INX
    bpl                                 ; $E582              BPL FNDEND
                                STDONE
    sta                                 ; $D5                STA LNMX
    jmp                                 ; $EA24              JMP SCOLOR      ;MAKE COLOR POINTER FOLLOW 901227-03**********
                                ; THIS IS A PATCH FOR INPUT LOGIC 901227-03**********
                                ;   FIXES INPUT"XXXXXXX-40-XXXXX";A$ PROBLEM
                                ;
    cpx                                 ; $C9         FINPUT CPX LSXP        ;CHECK IF ON SAME LINE
    beq                                 ; $E598              BEQ FINPUX      ;YES..RETURN TO SEND
    jmp                                 ; $E6ED              JMP FINDST      ;CHECK IF WE WRAPPED DOWN...
    rts                                 ; FINPUX RTS
    nop                                 ; NOP             ;KEEP THE SPACE THE SAME...
                                ;PANIC NMI ENTRY
                                ;
    jsr                                 ; $E5A0       VPAN   JSR PANIC       ;FIX VIC SCREEN
    jmp                                 ; $E566       JMP    NXTD            ;HOME CURSOR
    lda                                 ; #$03        PANIC  LDA #3          ;RESET DEFAULT I/O
    sta                                 ; $9A         STA    DFLTO
    lda                                 ; #$00        LDA    #0
    sta                                 ; $99         STA    DFLTN
                                ;INIT VIC
                                ;
    ldx                                 ; #$2F        INITV  LDX #47         ;LOAD ALL VIC REGS ***
    lda                                 ; $ECB8,X     PX4    LDA TVIC-1,X
    sta                                 ; $CFFF,X            STA VICREG-1,X
    dex                                 ; DEX
    bne                                 ; $E5AA       BNE    PX4
    rts                                 ; RTS
                                ;
                                ;REMOVE CHARACTER FROM QUEUE
                                ;
    ldy                                 ; $0277       LP2    LDY KEYD
    ldx                                 ; #$00        LDX    #0
    lda                                 ; $0278,X     LP1    LDA KEYD+1,X
    sta                                 ; $0277,X     STA    KEYD,X
    inx                                 ; INX
    cpx                                 ; $C6         CPX    NDX
    bne                                 ; $E5B9       BNE    LP1
    dec                                 ; $C6         DEC    NDX
    tya                                 ; TYA
    cli                                 ; CLI
    clc                                 ; CLC                    ;GOOD RETURN
    rts                                 ; RTS
                                ;
    jsr                                 ; $E716       LOOP4  JSR PRT
                                LOOP3
    lda                                 ; $C6         LDA    NDX
    sta                                 ; $CC         STA    BLNSW
    sta                                 ; $0292       STA    AUTODN          ;TURN ON AUTO SCROLL DOWN
    beq                                 ; $E5CD       BEQ    LOOP3
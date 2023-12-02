; *****************************************************
; *** SPECTRUM +3 ROM 0 DISASSEMBLY (48K BASIC ROM) ***
; *****************************************************

; The Spectrum ROMs are copyright Amstrad, who have kindly given permission
; to reverse engineer and publish Spectrum ROM disassemblies.


; =====
; NOTES
; =====

; ------------
; Release Date
; ------------
; 17th May 2010

; ------------------------
; Disassembly Contributors
; ------------------------
; Garry Lancaster
;
; The ROM disassembly was created with the aid of dZ80 V1.10, and incorporates work from
; "The Complete Spectrum ROM Disassembly" by Logan/O'Hara, and "The canonical list of +3
; oddities" by Ian Collier. 

; -----------------
; Assembler Details
; -----------------

; This file can be assembled to produce a binary image of the ROM
; with Interlogic's Z80ASM assembler (available for Z88, QL, DOS and Linux).
; Note that the defs directive is used and this causes a block of $00 bytes to be created.

        module  rom3

;**************************************************

;        include "sysvar48.def"

; System variable definitions for 48K Spectrum

        defc    KSTATE=$5c00
        defc    LAST_K=$5c08
        defc    REPDEL=$5c09
        defc    REPPER=$5c0a
        defc    DEFADD=$5c0b
        defc    K_DATA=$5c0d
        defc    TVDATA=$5c0e
        defc    STRMS=$5c10
        defc    CHARS=$5c36
        defc    RASP=$5c38
        defc    PIP=$5c39
        defc    ERR_NR=$5c3a
        defc    FLAGS=$5c3b
        defc    TV_FLAG=$5c3c
        defc    ERR_SP=$5c3d
        defc    LIST_SP=$5c3f
        defc    MODE=$5c41
        defc    NEWPPC=$5c42
        defc    NSPPC=$5c44 
        defc    PPC=$5c45
        defc    SUBPPC=$5c47
        defc    BORDCR=$5c48
        defc    E_PPC=$5c49
        defc    VARS=$5c4b
        defc    DEST=$5c4d
        defc    CHANS=$5c4f
        defc    CURCHL=$5c51
        defc    PROG=$5c53
        defc    NXTLIN=$5c55
        defc    DATADD=$5c57
        defc    E_LINE=$5c59
        defc    K_CUR=$5c5b
        defc    CH_ADD=$5c5d
        defc    X_PTR=$5c5f
        defc    WORKSP=$5c61
        defc    STKBOT=$5c63
        defc    STKEND=$5c65
        defc    BREG=$5c67
        defc    MEM=$5c68
        defc    FLAGS2=$5c6a
        defc    DF_SZ=$5c6b
        defc    S_TOP=$5c6c
        defc    OLDPPC=$5c6e
        defc    OSPCC=$5c70
        defc    FLAGX=$5c71
        defc    STRLEN=$5c72
        defc    T_ADDR=$5c74
        defc    SEED=$5c76
        defc    FRAMES=$5c78
        defc    UDG=$5c7b
        defc    COORDS=$5c7d
        defc    P_POSN=$5c7f
        defc    PR_CC=$5c80
        defc    ECHO_E=$5c82
        defc    DF_CC=$5c84
        defc    DF_CCL=$5c86
        defc    S_POSN=$5c88
        defc    SPOSNL=$5c8a
        defc    SCR_CT=$5c8c
        defc    ATTR_P=$5c8d
        defc    MASK_P=$5c8e
        defc    ATTR_T=$5c8f
        defc    MASK_T=$5c90
        defc    P_FLAG=$5c91
        defc    MEMBOT=$5c92
        defc    NMIADD=$5cb0            ; only used in +3
        defc    RAMTOP=$5cb2
        defc    P_RAMT=$5cb4

;**************************************************

;        include "sysvarp3.def"

; Additional system variables used in the +3

        defc    SWAP=$5b00
        defc    STOO=$5b10
        defc    YOUNGER=$5b21
        defc    REGNUOY=$5b2a
        defc    ONERR=$5b3a
        defc    OLDHL=$5b52
        defc    OLDBC=$5b54
        defc    OLDAF=$5b56
        defc    TARGET=$5b58
        defc    RETADDR=$5b5a
        defc    BANKM=$5b5c
        defc    RAMRST=$5b5d
        defc    RAMERR=$5b5e
        defc    BAUD=$5b5f
        defc    SERFL=$5b61
        defc    COL=$5b63
        defc    WIDTH=$5b64
        defc    TVPARS=$5b65
        defc    FLAGS3=$5b66
        defc    BANK678=$5b67
        defc    XLOC=$5b68
        defc    YLOC=$5b69
        defc    OLDSP=$5b6a
        defc    SYNRET=$5b6c
        defc    LASTV=$5b6e
        defc    RC_LINE=$5b73
        defc    RC_START=$5b75
        defc    RC_STEP=$5b77
        defc    LODDRV=$5b79
        defc    SAVDRV=$5b7a
        defc    DUMPLF=$5b7b
        defc    STRIP1=$5b7c
        defc    STRIP2=$5b84
        defc    TSTACK=$5bff

;**************************************************

;	include "fpcalc.def"

; The floating-point calculator commands

        defgroup
        {
        jump_true, exchange, delete, subtract, multiply, division,
        to_power, or, no_and_no, no_l_eql, no_gr_eq, nos_neql, no_grtr,
        no_less, nos_eql, addition, str_and_no, str_l_eql, str_gr_eq,
        strs_neql, str_grtr, str_less, strs_eql, strs_add, val_str, usr_str,
        read_in, negate, code, val, len, sin, cos, tan, asn, acs, atn,
        ln, exp, int, sqr, sgn, abs, peek, in, usr_no, str_str, chr_str,
        not, duplicate, n_mod_m, jump, stk_data, dec_jr_nz, less_0,
        greater_0, end_calc, get_argt, truncate, fp_calc_2, e_to_fp,
        re_stack
        }

        defc    series_06=$86
        defc    series_08=$88
        defc    series_0c=$8c
        defc    stk_zero=$a0
        defc    stk_one=$a1
        defc    stk_half=$a2
        defc    stk_pi_2=$a3
        defc    stk_ten=$a4
        defc    st_mem_0=$c0
        defc    st_mem_1=$c1
        defc    st_mem_2=$c2
        defc    st_mem_3=$c3
        defc    st_mem_4=$c4
        defc    st_mem_5=$c5
        defc    get_mem_0=$e0
        defc    get_mem_1=$e1
        defc    get_mem_2=$e2
        defc    get_mem_3=$e3
        defc    get_mem_4=$e4
        defc    get_mem_5=$e5

;**************************************************

        org     $0000

; The "START"

.l0000  di                      ; disable interrupts
        xor     a               ; A=00 for "start" ($ff for "NEW")
        ld      de,$ffff        ; DE=top of possible RAM
        jp      l11cb           ; jump forward

; The "Error" restart

.l0008  ld      hl,(CH_ADD)     
        ld      (X_PTR),hl      ; copy interpreter address to error pointer
        jr      l0053           ; move on

; The "Print a character" restart

.l0010  jp      l15f2           ; go to print it
        and     a               ; ?
        rst     $38             ; unused
        rst     $38
        rst     $38
        rst     $38

; The "Collect character" restart

.l0018  ld      hl,(CH_ADD)
        ld      a,(hl)          ; fetch value at CH_ADD

.l001c  call    l007d           ; is char printable?
        ret     nc              ; if so, return

; The "Collect next character" restart

.l0020  call    l0074           ; increment CH_ADD
        jr      l001c           ; jump back to test
        rst     $38             ; unused
        rst     $38
        rst     $38

; The "Calculator" restart

.l0028  jp      l335b           ; enter the calculator
        rst     $38             ; unused
        rst     $38
        rst     $38
        rst     $38
        rst     $38

; The "Make BC spaces" restart

.l0030  push    bc              ; save space to create
        ld      hl,(WORKSP)
        push    hl              ; and start of workspace
        jp      l169e           ; move on

; The "Maskable interrupt" routine

.l0038  push    af
        push    hl
        ld      hl,(FRAMES)
        inc     hl              ; increment FRAMES counter
        ld      (FRAMES),hl
        ld      a,h
        or      l
        jr      nz,l0048
        inc     (iy+$40)        ; increment high byte of FRAMES

.l0048  push    bc
        push    de
        call    l386e           ; scan the keyboard
        pop     de
        pop     bc
        pop     hl
        pop     af
        ei      
        ret     

; The "ERROR-2" routine

.l0053  pop     hl
        ld      l,(hl)          ; get error code
.l0055  ld      (iy+$00),l      ; save in ERR_NR
        ld      sp,(ERR_SP)     ; reset SP
        jp      l16c5           ; exit via SET-STK
        rst     $38             ; unused
        rst     $38
        rst     $38
        rst     $38
        rst     $38
        rst     $38
        rst     $38

; The "Non-maskable interrupt" routine

.l0066  push    af
        push    hl
        ld      hl,(NMIADD)     ; get NMI routine address
        ld      a,h
        or      l
        jr      z,l0070         ; skip if zero (fixed from original 48K ROM)
        jp      (hl)            ; execute routine
.l0070  pop     hl
        pop     af
        retn    

; The "CH_ADD+1" subroutine

.l0074  ld      hl,(CH_ADD)
.l0077  inc     hl              ; increment CH_ADD
.l0078  ld      (CH_ADD),hl
        ld      a,(hl)          ; get character
        ret     

; The "Skip-over" subroutine

.l007d  cp      $21
        ret     nc              ; return with carry reset if printable
        cp      $0d
        ret     z               ; return with carry reset if CR
        cp      $10
        ret     c               ; return with carry SET if $00-$0f
        cp      $18
        ccf     
        ret     c               ; return with carry SET if $18-$20
        inc     hl              ; skip one for INK to OVER
        cp      $16
        jr      c,l0090         
        inc     hl              ; skip again if AT or TAB
.l0090  scf
        ld      (CH_ADD),hl     ; update CH_ADD
        ret                     ; return with carry SET

; The Token table

.l0095  defb    '?'+$80
        defm    "RN"&('D'+$80)
        defm    "INKEY"&('$'+$80)
        defm    "P"&('I'+$80)
        defm    "F"&('N'+$80)
        defm    "POIN"&('T'+$80)
        defm    "SCREEN"&('$'+$80)
        defm    "ATT"&('R'+$80)
        defm    "A"&('T'+$80)
        defm    "TA"&('B'+$80)
        defm    "VAL"&('$'+$80)
        defm    "COD"&('E'+$80)
        defm    "VA"&('L'+$80)
        defm    "LE"&('N'+$80)
        defm    "SI"&('N'+$80)
        defm    "CO"&('S'+$80)
        defm    "TA"&('N'+$80)
        defm    "AS"&('N'+$80)
        defm    "AC"&('S'+$80)
        defm    "AT"&('N'+$80)
        defm    "L"&('N'+$80)
        defm    "EX"&('P'+$80)
        defm    "IN"&('T'+$80)
        defm    "SQ"&('R'+$80)
        defm    "SG"&('N'+$80)
        defm    "AB"&('S'+$80)
        defm    "PEE"&('K'+$80)
        defm    "I"&('N'+$80)
        defm    "US"&('R'+$80)
        defm    "STR"&('$'+$80)
        defm    "CHR"&('$'+$80)
        defm    "NO"&('T'+$80)
        defm    "BI"&('N'+$80)
        defm    "O"&('R'+$80)
        defm    "AN"&('D'+$80)
        defm    "<"&('='+$80)
        defm    ">"&('='+$80)
        defm    "<"&('>'+$80)
        defm    "LIN"&('E'+$80)
.l010f  defm    "THE"&('N'+$80)
        defm    "T"&('O'+$80)
        defm    "STE"&('P'+$80)
        defm    "DEF F"&('N'+$80)
        defm    "CA"&('T'+$80)
        defm    "FORMA"&('T'+$80)
        defm    "MOV"&('E'+$80)
        defm    "ERAS"&('E'+$80)
        defm    "OPEN "&('#'+$80)
        defm    "CLOSE "&('#'+$80)
        defm    "MERG"&('E'+$80)
        defm    "VERIF"&('Y'+$80)
        defm    "BEE"&('P'+$80)
        defm    "CIRCL"&('E'+$80)
        defm    "IN"&('K'+$80)
        defm    "PAPE"&('R'+$80)
        defm    "FLAS"&('H'+$80)
        defm    "BRIGH"&('T'+$80)
        defm    "INVERS"&('E'+$80)
        defm    "OVE"&('R'+$80)
        defm    "OU"&('T'+$80)
        defm    "LPRIN"&('T'+$80)
        defm    "LLIS"&('T'+$80)
        defm    "STO"&('P'+$80)
        defm    "REA"&('D'+$80)
        defm    "DAT"&('A'+$80)
        defm    "RESTOR"&('E'+$80)
        defm    "NE"&('W'+$80)
        defm    "BORDE"&('R'+$80)
        defm    "CONTINU"&('E'+$80)
        defm    "DI"&('M'+$80)
        defm    "RE"&('M'+$80)
        defm    "FO"&('R'+$80)
        defm    "GO T"&('O'+$80)
        defm    "GO SU"&('B'+$80)
        defm    "INPU"&('T'+$80)
        defm    "LOA"&('D'+$80)
        defm    "LIS"&('T'+$80)
        defm    "LE"&('T'+$80)
        defm    "PAUS"&('E'+$80)
        defm    "NEX"&('T'+$80)
        defm    "POK"&('E'+$80)
        defm    "PRIN"&('T'+$80)
        defm    "PLO"&('T'+$80)
        defm    "RU"&('N'+$80)
        defm    "SAV"&('E'+$80)
        defm    "RANDOMIZ"&('E'+$80)
        defm    "I"&('F'+$80)
        defm    "CL"&('S'+$80)
        defm    "DRA"&('W'+$80)
        defm    "CLEA"&('R'+$80)
        defm    "RETUR"&('N'+$80)
        defm    "COP"&('Y'+$80)

; The L-mode keytable with CAPS-SHIFT

.l0205  defm    "BHY65TGV"
        defm    "NJU74RFC"
        defm    "MKI83EDX"
        defm    $0e&"LO92WSZ"
        defm    " "&$0d&"P01QA"

; The extended-mode keytable (unshifted letters)

.l022c  defb    $e3,$c4,$e0,$e4
        defb    $b4,$bc,$bd,$bb
        defb    $af,$b0,$b1,$c0
        defb    $a7,$a6,$be,$ad
        defb    $b2,$ba,$e5,$a5
        defb    $c2,$e1,$b3,$b9
        defb    $c1,$b8
        
; The extended mode keytable (shifted letters)

.l0246  defb    $7e,$dc,$da,$5c
        defb    $b7,$7b,$7d,$d8
        defb    $bf,$ae,$aa,$ab
        defb    $dd,$de,$df,$7f
        defb    $b5,$d6,$7c,$d5
        defb    $5d,$db,$b6,$d9
        defb    $5b,$d7
        
; The control code keytable (CAPS-SHIFTed digits)

.l0260  defb    $0c,$07,$06,$04
        defb    $05,$08,$0a,$0b
        defb    $09,$0f
        
; The symbol code keytable (letters with symbol shift)

.l026a  defb    $e2,$2a,$3f,$cd
        defb    $c8,$cc,$cb,$5e
        defb    $ac,$2d,$2b,$3d
        defb    $2e,$2c,$3b,$22
        defb    $c7,$3c,$c3,$3e
        defb    $c5,$2f,$c9,$60
        defb    $c6,$3a

; The extended mode keytable (SYM-SHIFTed digits)

.l0284  defb    $d0,$ce,$a8,$ca
        defb    $d3,$d4,$d1,$d2
        defb    $a9,$cf

; The "keyboard scanning" subroutine
; On exit E contains keyvalue $00 to $27 (or $ff=no-key)
; D may contain a shift value
; Z is set unless more than two keys are pressed, or two keys are pressed
; and neither is a shift key

.l028e  ld      l,$2f           ; initial key value ($2f first line...$28)
        ld      de,$ffff        ; "no key"
        ld      bc,$fefe        ; C=port, B=counter
.l0296  in      a,(c)           ; get port value
        cpl     
        and     $1f             ; mask keyboard bits
        jr      z,l02ab         ; forward if none pressed this line
        ld      h,a             ; save keybits
        ld      a,l             ; get initial key value
.l029f  inc     d
        ret     nz              ; exit if 3 keys pressed
.l02a1  sub     $08
        srl     h
        jr      nc,l02a1        ; subtract 8 from value until a keybit found
        ld      d,e             ; D=earlier key value
        ld      e,a             ; E=key value
        jr      nz,l029f        ; back for more keys in this line
.l02ab  dec     l               ; reduce initial key value for next line
        rlc     b
        jr      c,l0296         ; loop back for further key lines
        ld      a,d
        inc     a
        ret     z               ; exit with E=keyval if only one key (or none)
        cp      $28
        ret     z               ; exit if D=caps shift
        cp      $19
        ret     z               ; or sym shift
        ld      a,e
        ld      e,d
        ld      d,a
        cp      $18             ; exit with Z set if 2nd key was sym shift
        ret     

; The "keyboard" subroutine
; This is called every maskable interrupt to scan the keyboard
; The keyboard state is held in two sets: KSTATE to KSTATE+3 and
; KSTATE+4 to KSTATE+7, to allow for detection of new key within
; repeat period of previous key
; KSTATE+0/4 = "main" keycode (free=$ff)
; KSTATE+1/5 = 5 call counter before becoming free
; KSTATE+2/6 = repeat delay period
; KSTATE+3/7 = decoded key value

.l02bf  call    l028e           ; get DE=key values
        ret     nz              ; exit if none/bad
        ld      hl,KSTATE       ; first set of keystates
.l02c6  bit     7,(hl)
        jr      nz,l02d1        ; move on if free
        inc     hl
        dec     (hl)            ; decrement 5-call counter
        dec     hl
        jr      nz,l02d1        
        ld      (hl),$ff        ; flag as free if 5 calls done
.l02d1  ld      a,l
        ld      hl,KSTATE+$04
        cp      l
        jr      nz,l02c6        ; loop back to consider second set
        call    l031e           ; make tests
        ret     nc              ; exit if no key
        ld      hl,KSTATE
        cp      (hl)
        jr      z,l0310         ; move on if repeat in first set
        ex      de,hl
        ld      hl,KSTATE+$04
        cp      (hl)
        jr      z,l0310         ; move on if repeat in second set
        bit     7,(hl)
        jr      nz,l02f1        ; use second set for new key if free
        ex      de,hl
        bit     7,(hl)
        ret     z               ; return if first set not free for new key
.l02f1  ld      e,a             ; E=keyvalue
        ld      (hl),a          ; store in KSTATE+0/4
        inc     hl
        ld      (hl),$05        ; initialise 5-call counter in KSTATE+1/5
        inc     hl
        ld      a,(REPDEL)
        ld      (hl),a          ; initialise KSTATE+2/6 to REPDEL
        inc     hl
        ld      c,(iy+$07)      ; get MODE
        ld      d,(iy+$01)      ; get FLAGS
        push    hl
        call    l0333           ; decode value
        pop     hl
        ld      (hl),a          ; store in KSTATE+3/7
.l0308  ld      (LAST_K),a      ; store deocoded value in LAST_K
        set     5,(iy+$01)      ; signal a "new key" in FLAGS
        ret     
.l0310  inc     hl              
        ld      (hl),$05        ; reset 5-call counter
        inc     hl
        dec     (hl)            ; decrement repeat delay period
        ret     nz              ; exit if time not up yet
        ld      a,(REPPER)
        ld      (hl),a          ; future repeat delay is REPPER
        inc     hl
        ld      a,(hl)          ; get decoded value
        jr      l0308           ; jump to store it

; The "K-test" subroutine
; exit with Carry reset if no key, else A="main" code, B=shift byte

.l031e  ld      b,d             ; B=shift byte
        ld      d,$00
        ld      a,e
        cp      $27             
        ret     nc              ; exit if key was "no key" or CAPS only
        cp      $18
        jr      nz,l032c        ; move on unless second key was SYM shift
        bit     7,b
        ret     nz              ; exit if SYM only
.l032c  ld      hl,l0205
        add     hl,de
        ld      a,(hl)          ; "main" code from L-mode keytable
        scf     
        ret     

; The "keyboard decoding" subroutine
; On entry, E="main" code, D=(FLAGS), C=(MODE) and B=shift byte
; On exit, A=decoded key code

.l0333  ld      a,e
        cp      $3a
        jr      c,l0367         ; jump on for non-letters
        dec     c               ; decrement mode value
        jp      m,l034f         ; move forward if "K","L" or "C"
        jr      z,l0341         ; move forward if "E" mode
        add     a,$4f           ; convert key to graphics character
        ret     
.l0341  ld      hl,l022c-'A'    ; get start of unshifted E-mode table
        inc     b
        jr      z,l034a         
        ld      hl,l0246-'A'    ; for a shift key, use shifted E-mode table
.l034a  ld      d,$00
        add     hl,de
        ld      a,(hl)          ; get decoded key from offset into tables
        ret     
.l034f  ld      hl,l026a-'A'    ; get start of symbol-shifted letter table
        bit     0,b
        jr      z,l034a         ; use if symbol shift pressed
        bit     3,d
        jr      z,l0364         ; move forward for "K" mode
        bit     3,(iy+$30)
        ret     nz              ; exit with main code if caps lock set
        inc     b
        ret     nz              ; or if caps shift pressed
        add     a,$20           ; else convert to lower-case
        ret     
.l0364  add     a,$a5           ; convert main letter code to keyword token
        ret     

.l0367  cp      '0'
        ret     c               ; exit with ENTER, SPACE or EXTEND
        dec     c               ; decrement mode value
        jp      m,l039d         ; move on if "K", "L" or "C"
        jr      nz,l0389        ; move on if "G", else we are in "E" mode
        ld      hl,l0284-'0'    ; get start of E-mode sym-shifted number table
        bit     5,b
        jr      z,l034a         ; use if symbol shift pressed
        cp      '8'
        jr      nc,l0382        ; move on if 8 or 9
        sub     $20             ; A=paper colour code $10-$17
        inc     b
        ret     z               ; exit if caps shift not pressed
        add     a,$08           ; else use A=ink colour code $18-$1f
        ret     
.l0382  sub     $36             ; convert '8' or '9' to BRIGHT codes $02,$03
        inc     b
        ret     z               ; exit if caps shift not pressed
        add     a,$fe           ; else use FLASH codes $00,$01
        ret     
.l0389  ld      hl,l0260-'0'    ; get start of caps-shifted number table
        cp      '9'
        jr      z,l034a         ; use for GRAPHICS
        cp      '0'
        jr      z,l034a         ; or DELETE
        and     $07
        add     a,$80           ; convert to unshifted block graphic $80-$87
        inc     b
        ret     z               ; exit for no shift key
        xor     $0f             ; else convert to shifted graphic $88-$8f
        ret     
.l039d  inc     b
        ret     z               ; exit with digit if no shifts
        bit     5,b
        ld      hl,l0260-'0'    ; get start of caps-shifted number table
        jr      nz,l034a        ; use if caps shift pressed
        sub     $10             ; else get symbol code $20 to $29
        cp      '"'
        jr      z,l03b2         ; move on if sym shift-2
        cp      ' '
        ret     nz              ; exit if not sym shift-0
        ld      a,'_'           ; use "_" for sym shift-0
        ret     
.l03b2  ld      a,'@'           ; use "@" for sym shift-2
        ret     

; The "Beeper" subroutine
; On entry, DE=freq*time, and HL=(Tstates in timing loop)/4

.l03b5  di                      ; disable interrupts for clean sound
        ld      a,l
        srl     l
        srl     l               ; L=counter for every 16 Tstates
        cpl     
        and     $03
        ld      c,a
        ld      b,$00           ; BC=4-remainder
.l03c1  ld      ix,l03d1
        add     ix,bc           ; IX=entry point in timing loop
        ld      a,(BORDCR)
        and     $38
        rrca    
        rrca    
        rrca    
        or      $08             ; A=border colour, with MIC off
.l03d1  nop                     ; 3x4-Tstates for "remainder" part of loop
        nop     
        nop     
        inc     b               ; the timing loop
        inc     c
.l03d6  dec     c
        jr      nz,l03d6
        ld      c,$3f
        dec     b
        jp      nz,l03d6
        xor     $10             ; flip loudspeaker bit
        out     ($fe),a
        ld      b,h             ; reset B counter
        ld      c,a             ; save A
        bit     4,a
        jr      nz,l03f2        ; jump if at half-cycle point
        ld      a,d
        or      e
        jr      z,l03f6         ; move on if finished
        ld      a,c
        ld      c,l             ; reset C counter
        dec     de              ; decrement pass counter
        jp      (ix)            ; back to timing loop
.l03f2  ld      c,l             ; reset C counter
        inc     c               ; compensate for shorter path
        jp      (ix)            ; back to timing loop
.l03f6  ei                      ; re-enable interrupts
        ret     

; The "BEEP" command routine

.l03f8  rst     $28             ; start FP calculator with stack: t,P
        defb    duplicate       ; t,P,P
        defb    int             ; t,P,i
        defb    st_mem_0        ; save i in mem0
        defb    subtract        ; t,p
        defb    stk_data        ; stack value K=0.0577622606
        defb    $ec,$6c,$98,$1f,$f5
        defb    multiply        ; t,pK
        defb    stk_one         ; t,pK,1
        defb    addition        ; t,pK+1
        defb    end_calc
        
        ld      hl,MEMBOT
        ld      a,(hl)          ; A=exponent of i (integer part of pitch)
        and     a
        jr      nz,l046c        ; give error B if not integral (short) form
        inc     hl
        ld      c,(hl)          ; C=sign byte
        inc     hl
        ld      b,(hl)
        ld      a,b             ; A=B=low byte
        rla     
        sbc     a,a
        cp      c
        jr      nz,l046c        ; give error B if not -128<=i<=127
        inc     hl
        cp      (hl)
        jr      nz,l046c        ; ditto
        ld      a,b
        add     a,$3c
        jp      p,l0425         
        jp      po,l046c        ; error B if i in range -128 to -61
.l0425  ld      b,$fa           ; start 6 octaves below middle C
.l0427  inc     b
        sub     $0c
        jr      nc,l0427        ; get to correct octave
        add     a,$0c
        push    bc              ; save octave number
        ld      hl,l046e        ; semitone table
        call    l3406           ; pass "Ath" value
        call    l33b4           ; to calculator stack (call it C)
        
        rst     $28             ; start FP calculator with: t,pK+1,C
        defb    multiply        ; t,C(pK+1)
        defb    end_calc

        pop     af              ; A=octave
        add     a,(hl)
        ld      (hl),a          ; add into exponent of C(pK+1)

        rst     $28             ; start FP calculator with: t,f
        defb    st_mem_0        ; save f in mem0
        defb    delete          ; t
        defb    duplicate       ; t,t
        defb    end_calc

        call    l1e94
        cp      $0b
        jr      nc,l046c        ; error if INT t > $0a

        rst     $28             ; start FP calculator with: t
        defb    get_mem_0       ; t,f
        defb    multiply        ; f*t
        defb    get_mem_0       ; f*t,f
        defb    stk_data        ; stack 3.5*10^6/8 (437,500)
        defb    $80,$43,$55,$9f,$80
        defb    exchange        ; f*t,437500,f
        defb    division        ; f*t,437500/f
        defb    stk_data        ; stack 30.125
        defb    $35,$71
        defb    subtract        ; f*t,437500/f-30.125
        defb    end_calc
        
        call    l1e99           ; get BC=timing loop value
        push    bc
        call    l1e99           ; get BC=f*t
        pop     hl              ; HL=timing loop value
        ld      d,b             ; DE=f*t
        ld      e,c
        ld      a,d
        or      e
        ret     z               ; exit if no time
        dec     de
        jp      l03b5           ; exit through Beeper subroutine

.l046c  rst     $8
        defb    $0a             ; error B - Integer out of range

; The semitone table

.l046e  defb    $89,$02,$d0,$12,$86     ; 261.63 C
        defb    $89,$0a,$97,$60,$75     ; 277.18 C#
        defb    $89,$12,$d5,$17,$1f     ; 293.66 D
        defb    $89,$1b,$90,$41,$02     ; 311.13 D#
        defb    $89,$24,$d0,$53,$ca     ; 329.63 E
        defb    $89,$2e,$9d,$36,$b1     ; 349.23 F
        defb    $89,$38,$ff,$49,$3e     ; 369.99 F#
        defb    $89,$43,$ff,$6a,$73     ; 392.00 G
        defb    $89,$4f,$a7,$00,$54     ; 415.30 G#
        defb    $89,$5c,$00,$00,$00     ; 440.00 A
        defb    $89,$69,$14,$f6,$24     ; 466.16 A#
        defb    $89,$76,$f1,$10,$05     ; 493.88 B

; The following is the "Program Name" subroutine, leftover from
; the ZX81 ROM but not used (24 bytes long)

.l04aa  call    $24fb
        ld      a,($5c3b)
        add     a,a
        jp      m,$1c8a
        pop     hl
        ret     nc
        push    hl
        call    $2bf1
        ld      h,d
        ld      l,e
        dec     c
        ret     m
        add     hl,bc
        set     7,(hl)
        ret     


.l04c2  ld      hl,$053f
        push    hl
        ld      hl,$1f80
        bit     7,a
        jr      z,l04d0             ; (3)
        ld      hl,$0c98

.l04d0  ex      af,af'
        inc     de
        dec     ix
        di      
        ld      a,$02
        ld      b,a

.l04d8  djnz    $04d8               ; (-2)
        out     ($fe),a
        xor     $0f
        ld      b,$a4
        dec     l
        jr      nz,l04d8            ; (-11)
        dec     b

.l04e4  dec     h

.l04e5  jp      p,$04d8
        ld      b,$2f

.l04ea  djnz    $04ea               ; (-2)
        out     ($fe),a
        ld      a,$0d
        ld      b,$37

.l04f2  djnz    $04f2               ; (-2)
        out     ($fe),a
        ld      bc,$3b0e
        ex      af,af'
        ld      l,a
        jp      $0507

.l04fe  ld      a,d
        or      e
        jr      z,l050e             ; (12)
        ld      l,(ix+$00)

.l0505  ld      a,h
        xor     l

.l0507  ld      h,a
        ld      a,$01
        scf     
        jp      $0525

.l050e  ld      l,h
        jr      l0505               ; (-12)

.l0511  ld      a,c
        bit     7,b

.l0514  djnz    $0514               ; (-2)
        jr      nc,l051c            ; (4)
        ld      b,$42

.l051a  djnz    $051a               ; (-2)

.l051c  out     ($fe),a
        ld      b,$3e
        jr      nz,l0511            ; (-17)
        dec     b
        xor     a
        inc     a

.l0525  rl      l
        jp      nz,$0514
        dec     de
        inc     ix
        ld      b,$31
        ld      a,$7f
        in      a,($fe)
        rra     
        ret     nc
        ld      a,d
        inc     a
        jp      nz,$04fe
        ld      b,$3b

.l053c  djnz    $053c               ; (-2)
        ret     
        push    af
        ld      a,(BORDCR)
        and     $38
        rrca    
        rrca    
        rrca    
        out     ($fe),a
        ld      a,$7f
        in      a,($fe)
        rra     
        ei      
        jr      c,l0554             ; (2)
        rst     $8
        inc     c

.l0554  pop     af
        ret     

.l0556  inc     d
        ex      af,af'
        dec     d
        di      
        ld      a,$0f
        out     ($fe),a
        ld      hl,$053f
        push    hl
        in      a,($fe)
        rra     
        and     $20
        or      $02
        ld      c,a
        cp      a

.l056b  ret     nz

.l056c  call    $05e7
        jr      nc,l056b            ; (-6)
        ld      hl,$0415

.l0574  djnz    $0574               ; (-2)
        dec     hl
        ld      a,h
        or      l
        jr      nz,l0574            ; (-7)
        call    $05e3
        jr      nc,l056b            ; (-21)

.l0580  ld      b,$9c
        call    $05e3
        jr      nc,l056b            ; (-28)
        ld      a,$c6
        cp      b
        jr      nc,l056c            ; (-32)
        inc     h
        jr      nz,l0580            ; (-15)

.l058f  ld      b,$c9
        call    $05e7
        jr      nc,l056b            ; (-43)
        ld      a,b
        cp      $d4
        jr      nc,l058f            ; (-12)
        call    $05e7
        ret     nc
        ld      a,c
        xor     $03
        ld      c,a
        ld      h,$00
        ld      b,$b0
        jr      l05c8               ; (31)

.l05a9  ex      af,af'
        jr      nz,l05b3            ; (7)
        jr      nc,l05bd            ; (15)
        ld      (ix+$00),l
        jr      l05c2               ; (15)

.l05b3  rl      c
        xor     l
        ret     nz
        ld      a,c
        rra     
        ld      c,a
        inc     de
        jr      l05c4               ; (7)

.l05bd  ld      a,(ix+$00)
        xor     l
        ret     nz

.l05c2  inc     ix

.l05c4  dec     de
        ex      af,af'
        ld      b,$b2

.l05c8  ld      l,$01

.l05ca  call    $05e3
        ret     nc
        ld      a,$cb
        cp      b
        rl      l
        ld      b,$b0
        jp      nc,$05ca
        ld      a,h
        xor     l
        ld      h,a
        ld      a,d
        or      e
        jr      nz,l05a9            ; (-54)
        ld      a,h
        cp      $01
        ret     

.l05e3  call    $05e7
        ret     nc

.l05e7  ld      a,$16

.l05e9  dec     a
        jr      nz,l05e9            ; (-3)
        and     a

.l05ed  inc     b
        ret     z
        ld      a,$7f
        in      a,($fe)
        rra     
        ret     nc
        xor     c
        and     $20
        jr      z,l05ed             ; (-13)
        ld      a,c
        cpl     
        ld      c,a
        and     $07
        or      $08
        out     ($fe),a
        scf     
        ret     

.l0605  pop     af
        ld      a,(T_ADDR)
        sub     $e0
        ld      (T_ADDR),a
        call    $1c8c
        call    $2530
        jr      z,l0652             ; (60)
        ld      bc,$0011
        ld      a,(T_ADDR)
        and     a
        jr      z,l0621             ; (2)
        ld      c,$22

.l0621  rst     $30

.l0622  push    de
        pop     ix
        ld      b,$0b
        ld      a,$20

.l0629  ld      (de),a
        inc     de
        djnz    $0629               ; (-4)
        ld      (ix+$01),$ff
        call    $2bf1
        ld      hl,$fff6
        dec     bc
        add     hl,bc
        inc     bc
        jr      nc,l064b            ; (15)
        ld      a,(T_ADDR)
        and     a
        defb    $20
        defb    2
        rst     $8
        ld      c,$78
        or      c
        jr      z,l0652             ; (10)
        ld      bc,$000a

.l064b  push    ix
        pop     hl
        inc     hl
        ex      de,hl
        ldir    

.l0652  rst     $18
        cp      $e4
        jr      nz,l06a0            ; (73)
        ld      a,(T_ADDR)
        cp      $03
        jp      z,$1c8a
        rst     $20
        call    $28b2
        set     7,c
        defb    $30
        defb    11
        ld      hl,$0000
        ld      a,(T_ADDR)
        dec     a
        jr      z,l0685             ; (21)
        rst     $8
        ld      bc,$8ac2
        inc     e
        call    $2530
        jr      z,l0692             ; (24)
        inc     hl
        ld      a,(hl)
        ld      (ix+$0b),a
        inc     hl
        ld      a,(hl)
        ld      (ix+$0c),a
        inc     hl

.l0685  ld      (ix+$0e),c
        ld      a,$01
        bit     6,c
        jr      z,l068f             ; (1)
        inc     a

.l068f  ld      (ix+$00),a

.l0692  ex      de,hl
        rst     $20
        cp      $29
        defb    $20
        defb    -38
        rst     $20
        call    $1bee
        ex      de,hl
        jp      $075a

.l06a0  cp      $aa
        jr      nz,l06c3            ; (31)
        ld      a,(T_ADDR)
        cp      $03
        jp      z,$1c8a
        rst     $20
        call    $1bee
        ld      (ix+$0b),$00
        ld      (ix+$0c),$1b
        ld      hl,$4000
        ld      (ix+$0d),l
        ld      (ix+$0e),h
        jr      l0710               ; (77)

.l06c3  cp      $af
        jr      nz,l0716            ; (79)
        ld      a,(T_ADDR)
        cp      $03
        jp      z,$1c8a
        rst     $20
        call    $2048
        jr      nz,l06e1            ; (12)
        ld      a,(T_ADDR)
        and     a
        jp      z,$1c8a
        call    $1ce6
        jr      l06f0               ; (15)

.l06e1  call    $1c82
        rst     $18
        cp      $2c
        jr      z,l06f5             ; (12)
        ld      a,(T_ADDR)
        and     a
        jp      z,$1c8a

.l06f0  call    $1ce6
        jr      l06f9               ; (4)

.l06f5  rst     $20
        call    $1c82

.l06f9  call    $1bee
        call    $1e99
        ld      (ix+$0b),c
        ld      (ix+$0c),b
        call    $1e99
        ld      (ix+$0d),c
        ld      (ix+$0e),b
        ld      h,b
        ld      l,c

.l0710  ld      (ix+$00),$03
        jr      l075a               ; (68)

.l0716  cp      $ca
        jr      z,l0723             ; (9)
        call    $1bee
        ld      (ix+$0e),$80
        jr      l073a               ; (23)

.l0723  ld      a,(T_ADDR)
        and     a
        jp      nz,$1c8a
        rst     $20
        call    $1c82
        call    $1bee
        call    $1e99
        ld      (ix+$0d),c
        ld      (ix+$0e),b

.l073a  ld      (ix+$00),$00
        ld      hl,(E_LINE)
        ld      de,(PROG)
        scf     
        sbc     hl,de
        ld      (ix+$0b),l
        ld      (ix+$0c),h
        ld      hl,(VARS)
        sbc     hl,de
        ld      (ix+$0f),l
        ld      (ix+$10),h
        ex      de,hl

.l075a  ld      a,(T_ADDR)
        and     a
        jp      z,$0970
        push    hl
        ld      bc,$0011
        add     ix,bc

.l0767  push    ix
        ld      de,$0011
        xor     a
        scf     
        call    $0556
        pop     ix
        jr      nc,l0767            ; (-14)
        ld      a,$fe
        call    $1601
        ld      (iy+$52),$03
        ld      c,$80
        ld      a,(ix+$00)
        cp      (ix-$11)
        jr      nz,l078a            ; (2)
        ld      c,$f6

.l078a  cp      $04
        jr      nc,l0767            ; (-39)
        ld      de,$09c0
        push    bc
        call    $0c0a
        pop     bc
        push    ix
        pop     de
        ld      hl,$fff0
        add     hl,de
        ld      b,$0a
        ld      a,(hl)
        inc     a
        jr      nz,l07a6            ; (3)
        ld      a,c
        add     a,b
        ld      c,a

.l07a6  inc     de
        ld      a,(de)
        cp      (hl)
        inc     hl
        jr      nz,l07ad            ; (1)
        inc     c

.l07ad  rst     $10
        djnz    $07a6               ; (-10)
        bit     7,c
        jr      nz,l0767            ; (-77)
        ld      a,$0d
        rst     $10
        pop     hl
        ld      a,(ix+$00)
        cp      $03
        jr      z,l07cb             ; (12)
        ld      a,(T_ADDR)
        dec     a
        jp      z,$0808
        cp      $02
        jp      z,$08b6

.l07cb  push    hl
        ld      l,(ix-$06)
        ld      h,(ix-$05)
        ld      e,(ix+$0b)
        ld      d,(ix+$0c)
        ld      a,h
        or      l
        jr      z,l07e9             ; (13)
        sbc     hl,de
        jr      c,l0806             ; (38)
        jr      z,l07e9             ; (7)
        ld      a,(ix+$00)
        cp      $03
        jr      nz,l0806            ; (29)

.l07e9  pop     hl
        ld      a,h
        or      l
        jr      nz,l07f4            ; (6)
        ld      l,(ix+$0d)
        ld      h,(ix+$0e)

.l07f4  push    hl
        pop     ix
        ld      a,(T_ADDR)
        cp      $02
        scf     
        jr      nz,l0800            ; (1)
        and     a

.l0800  ld      a,$ff

.l0802  call    $0556
        ret     c

.l0806  rst     $8
        ld      a,(de)

.l0808  ld      e,(ix+$0b)
        ld      d,(ix+$0c)
        push    hl
        ld      a,h
        or      l
        jr      nz,l0819            ; (6)
        inc     de
        inc     de
        inc     de
        ex      de,hl
        jr      l0825               ; (12)

.l0819  ld      l,(ix-$06)
        ld      h,(ix-$05)
        ex      de,hl
        scf     
        sbc     hl,de
        jr      c,l082e             ; (9)

.l0825  ld      de,$0005
        add     hl,de
        ld      b,h
        ld      c,l
        call    $1f05

.l082e  pop     hl
        ld      a,(ix+$00)
        and     a
        jr      z,l0873             ; (62)
        ld      a,h
        or      l
        jr      z,l084c             ; (19)
        dec     hl
        ld      b,(hl)
        dec     hl
        ld      c,(hl)
        dec     hl
        inc     bc
        inc     bc
        inc     bc
        ld      (X_PTR),ix
        call    $19e8
        ld      ix,(X_PTR)

.l084c  ld      hl,(E_LINE)
        dec     hl
        ld      c,(ix+$0b)
        ld      b,(ix+$0c)
        push    bc
        inc     bc
        inc     bc
        inc     bc
        ld      a,(ix-$03)
        push    af
        call    $1655
        inc     hl
        pop     af
        ld      (hl),a
        pop     de
        inc     hl
        ld      (hl),e
        inc     hl
        ld      (hl),d
        inc     hl
        push    hl
        pop     ix
        scf     
        ld      a,$ff
        jp      $0802

.l0873  ex      de,hl
        ld      hl,(E_LINE)
        dec     hl
        ld      (X_PTR),ix
        ld      c,(ix+$0b)
        ld      b,(ix+$0c)
        push    bc
        call    $19e5
        pop     bc
        push    hl
        push    bc
        call    $1655
        ld      ix,(X_PTR)
        inc     hl
        ld      c,(ix+$0f)
        ld      b,(ix+$10)
        add     hl,bc
        ld      (VARS),hl
        ld      h,(ix+$0e)
        ld      a,h
        and     $c0
        jr      nz,l08ad            ; (10)
        ld      l,(ix+$0d)
        ld      (NEWPPC),hl
        ld      (iy+$0a),$00

.l08ad  pop     de
        pop     ix
        scf     
        ld      a,$ff
        jp      $0802

.l08b6  ld      c,(ix+$0b)
        ld      b,(ix+$0c)
        push    bc
        inc     bc
        rst     $30
        ld      (hl),$80
        ex      de,hl
        pop     de
        push    hl
        push    hl
        pop     ix
        scf     
        ld      a,$ff
        call    $0802
        pop     hl
        ld      de,(PROG)

.l08d2  ld      a,(hl)
        and     $c0
        jr      nz,l08f0            ; (25)

.l08d7  ld      a,(de)
        inc     de
        cp      (hl)
        inc     hl
        jr      nz,l08df            ; (2)
        ld      a,(de)
        cp      (hl)

.l08df  dec     de
        dec     hl
        jr      nc,l08eb            ; (8)
        push    hl
        ex      de,hl
        call    $19b8
        pop     hl
        jr      l08d7               ; (-20)

.l08eb  call    $092c
        jr      l08d2               ; (-30)

.l08f0  ld      a,(hl)
        ld      c,a
        cp      $80
        ret     z
        push    hl
        ld      hl,(VARS)

.l08f9  ld      a,(hl)
        cp      $80
        jr      z,l0923             ; (37)
        cp      c
        jr      z,l0909             ; (8)

.l0901  push    bc
        call    $19b8
        pop     bc
        ex      de,hl
        jr      l08f9               ; (-16)

.l0909  and     $e0
        cp      $a0
        jr      nz,l0921            ; (18)
        pop     de
        push    de
        push    hl

.l0912  inc     hl
        inc     de
        ld      a,(de)
        cp      (hl)
        jr      nz,l091e            ; (6)
        rla     
        jr      nc,l0912            ; (-9)
        pop     hl
        jr      l0921               ; (3)

.l091e  pop     hl
        jr      l0901               ; (-32)

.l0921  ld      a,$ff

.l0923  pop     de
        ex      de,hl
        inc     a
        scf     
        call    $092c
        jr      l08f0               ; (-60)

.l092c  jr      nz,l093e            ; (16)
        ex      af,af'
        ld      (X_PTR),hl
        ex      de,hl
        call    $19b8
        call    $19e8
        ex      de,hl
        ld      hl,(X_PTR)
        ex      af,af'

.l093e  ex      af,af'
        push    de
        call    $19b8
        ld      (X_PTR),hl
        ld      hl,(PROG)
        ex      (sp),hl
        push    bc
        ex      af,af'
        jr      c,l0955             ; (7)
        dec     hl
        call    $1655
        inc     hl
        jr      l0958               ; (3)

.l0955  call    $1655

.l0958  inc     hl
        pop     bc
        pop     de
        ld      (PROG),de
        ld      de,(X_PTR)
        push    bc
        push    de
        ex      de,hl
        ldir    
        pop     hl
        pop     bc
        push    de
        call    $19e8
        pop     de
        ret     

.l0970  push    hl
        ld      a,$fd
        call    $1601
        xor     a
        ld      de,$09a1
        call    $0c0a
        set     5,(iy+$02)
        call    $15d4
        push    ix
        ld      de,$0011
        xor     a
        call    $04c2
        pop     ix
        ld      b,$32

.l0991  halt
        djnz    l0991
        ld      e,(ix+$0b)
        ld      d,(ix+$0c)
        ld      a,$ff
        pop     ix
        jp      l04c2


.l09a1  defb    $80
        defm    "Press REC & PLAY, then any key"&$ae
        defm    $0d&"Program:"&$a0
        defm    $0d&"Number array:"&$a0
        defm    $0d&"Character array:"&$a0
        defm    $0d&"Bytes:"&$a0

.l09f4  defb    $cd
        inc     bc
        dec     bc
        cp      $20
        jp      nc,$0ad9
        cp      $06
        jr      c,l0a69             ; (105)
        cp      $18
        jr      nc,l0a69            ; (101)
        ld      hl,$0a0b
        ld      e,a
        ld      d,$00
        add     hl,de
        ld      e,(hl)
        add     hl,de
        push    hl
        jp      $0b03
        ld      c,(hl)
        ld      d,a
        djnz    $0a3e               ; (41)
        ld      d,h
        ld      d,e
        ld      d,d
        scf     
        ld      d,b
        ld      c,a

.l0a1b  ld      e,a
        ld      e,(hl)
        ld      e,l
        ld      e,h
        ld      e,e
        ld      e,d
        ld      d,h
        ld      d,e
        inc     c
        ld      a,$22
        cp      c
        jr      nz,l0a3a            ; (17)

.l0a29  bit     1,(iy+$01)
        jr      nz,l0a38            ; (9)
        inc     b
        ld      c,$02
        ld      a,$18
        cp      b

.l0a35  jr      nz,l0a3a            ; (3)
        dec     b

.l0a38  ld      c,$21

.l0a3a  jp      $0dd9
        ld      a,(P_FLAG)
        push    af
        ld      (iy+$57),$01
        ld      a,$20

.l0a47  call    $0b65
        pop     af
        ld      (P_FLAG),a
        ret     
        bit     1,(iy+$01)
        jp      nz,$0ecd
        ld      c,$21
        call    $0c55
        dec     b
        jp      $0dd9
        call    $0b03
        ld      a,c
        dec     a
        dec     a
        and     $10
        jr      l0ac3               ; (90)

.l0a69  ld      a,$3f
        defb    $18
        defb    108
        ld      de,$0a87
        ld      (TVDATA+1),a
        jr      l0a80               ; (11)
        ld      de,$0a6d
        jr      l0a7d               ; (3)
        ld      de,$0a87

.l0a7d  ld      (TVDATA),a

.l0a80  ld      hl,(CURCHL)
        ld      (hl),e
        inc     hl
        ld      (hl),d
        ret     
        ld      de,$09f4
        call    $0a80
        ld      hl,(TVDATA)
        ld      d,a
        ld      a,l
        cp      $16
        jp      c,$2211
        jr      nz,l0ac2            ; (41)
        ld      b,h
        ld      c,d
        ld      a,$1f
        sub     c
        jr      c,l0aac             ; (12)
        add     a,$02
        ld      c,a
        bit     1,(iy+$01)
        jr      nz,l0abf            ; (22)
        ld      a,$16
        sub     b

.l0aac  jp      c,$1e9f
        inc     a
        ld      b,a
        inc     b
        bit     0,(iy+$02)
        jp      nz,$0c55
        cp      (iy+$31)
        jp      c,$0c86

.l0abf  jp      $0dd9

.l0ac2  ld      a,h

.l0ac3  call    $0b03
        add     a,c
        dec     a
        and     $1f
        ret     z
        ld      d,a
        set     0,(iy+$01)

.l0ad0  ld      a,$20
        call    $0c3b
        dec     d
        jr      nz,l0ad0            ; (-8)
        ret     

.l0ad9  call    $0b24

.l0adc  bit     1,(iy+$01)
        jr      nz,l0afc            ; (26)
        bit     0,(iy+$02)
        jr      nz,l0af0            ; (8)
        ld      (S_POSN),bc
        ld      (DF_CC),hl
        ret     

.l0af0  ld      (SPOSNL),bc
        ld      (ECHO_E),bc
        ld      (DF_CCL),hl
        ret     

.l0afc  ld      (iy+$45),c
        ld      (PR_CC),hl
        ret     

.l0b03  bit     1,(iy+$01)
        jr      nz,l0b1d            ; (20)
        ld      bc,(S_POSN)
        ld      hl,(DF_CC)
        bit     0,(iy+$02)
        ret     z
        ld      bc,(SPOSNL)
        ld      hl,(DF_CCL)
        ret     

.l0b1d  ld      c,(iy+$45)
        ld      hl,(PR_CC)
        ret     

.l0b24  cp      $80
        jr      c,l0b65             ; (61)
        cp      $90
        jr      nc,l0b52            ; (38)
        ld      b,a
        call    $0b38
        call    $0b03
        ld      de,MEMBOT
        jr      l0b7f               ; (71)

.l0b38  ld      hl,MEMBOT
        call    $0b3e

.l0b3e  rr      b
        sbc     a,a
        and     $0f
        ld      c,a
        rr      b
        sbc     a,a
        and     $f0
        or      c
        ld      c,$04

.l0b4c  ld      (hl),a
        inc     hl
        dec     c
        jr      nz,l0b4c            ; (-5)
        ret     

.l0b52  jp      $3a7e
        nop     

.l0b56  add     a,$15
        push    bc
        ld      bc,(UDG)
        jr      l0b6a               ; (11)

.l0b5f  call    $0c10
        jp      $0b03

.l0b65  push    bc
        ld      bc,(CHARS)

.l0b6a  ex      de,hl
        ld      hl,FLAGS
        res     0,(hl)
        cp      $20
        jr      nz,l0b76            ; (2)
        set     0,(hl)

.l0b76  ld      h,$00
        ld      l,a
        add     hl,hl
        add     hl,hl
        add     hl,hl
        add     hl,bc
        pop     bc
        ex      de,hl

.l0b7f  ld      a,c
        dec     a
        ld      a,$21
        jr      nz,l0b93            ; (14)
        dec     b
        ld      c,a
        bit     1,(iy+$01)
        jr      z,l0b93             ; (6)
        push    de
        call    $0ecd
        pop     de
        ld      a,c

.l0b93  cp      c
        push    de
        call    z,$0c55
        pop     de
        push    bc
        push    hl
        ld      a,(P_FLAG)
        ld      b,$ff
        rra     
        jr      c,l0ba4             ; (1)
        inc     b

.l0ba4  rra
        rra     
        sbc     a,a
        ld      c,a
        ld      a,$08
        and     a
        bit     1,(iy+$01)
        jr      z,l0bb6             ; (5)
        set     1,(iy+$30)
        scf     

.l0bb6  ex      de,hl

.l0bb7  ex      af,af'
        ld      a,(de)
        and     b
        xor     (hl)
        xor     c
        ld      (de),a
        ex      af,af'
        jr      c,l0bd3             ; (19)
        inc     d

.l0bc1  inc     hl
        dec     a
        jr      nz,l0bb7            ; (-14)
        ex      de,hl
        dec     h
        bit     1,(iy+$01)
        call    z,$0bdb
        pop     hl
        pop     bc
        dec     c
        inc     hl
        ret     

.l0bd3  ex      af,af'
        ld      a,$20
        add     a,e
        ld      e,a
        ex      af,af'
        jr      l0bc1               ; (-26)

.l0bdb  ld      a,h
        rrca    
        rrca    
        rrca    
        and     $03
        or      $58
        ld      h,a
        ld      de,(ATTR_T)
        ld      a,(hl)
        xor     e
        and     d
        xor     e
        bit     6,(iy+$57)
        jr      z,l0bfa             ; (8)
        and     $c7
        bit     2,a
        jr      nz,l0bfa            ; (2)
        xor     $38

.l0bfa  bit     4,(iy+$57)
        jr      z,l0c08             ; (8)
        and     $f8
        bit     5,a
        jr      nz,l0c08            ; (2)
        xor     $07

.l0c08  ld      (hl),a
        ret     

.l0c0a  push    hl
        ld      h,$00
        ex      (sp),hl
        jr      l0c14               ; (4)

.l0c10  ld      de,$0095
        push    af

.l0c14  call    $0c41

.l0c17  jr      c,l0c22             ; (9)
        ld      a,$20
        bit     0,(iy+$01)
        call    z,$0c3b

.l0c22  ld      a,(de)
        and     $7f
        call    $0c3b
        ld      a,(de)
        inc     de
        add     a,a
        jr      nc,l0c22            ; (-11)
        pop     de
        cp      $48
        jr      z,l0c35             ; (3)
        cp      $82
        ret     c

.l0c35  ld      a,d
        cp      $03
        ret     c
        ld      a,$20

.l0c3b  push    de
        exx     
        rst     $10
        exx     
        pop     de
        ret     

.l0c41  push    af
        ex      de,hl
        inc     a

.l0c44  bit     7,(hl)
        inc     hl
        jr      z,l0c44             ; (-5)
        dec     a
        jr      nz,l0c44            ; (-8)
        ex      de,hl
        pop     af
        cp      $20
        ret     c
        ld      a,(de)
        sub     $41
        ret     

.l0c55  bit     1,(iy+$01)
        ret     nz
        ld      de,$0dd9
        push    de
        ld      a,b
        bit     0,(iy+$02)
        jp      nz,$0d02
        cp      (iy+$31)
        jr      c,l0c86             ; (27)
        ret     nz
        bit     4,(iy+$02)
        jr      z,l0c88             ; (22)
        ld      e,(iy+$2d)
        dec     e
        jr      z,l0cd2             ; (90)
        ld      a,$00
        call    $1601
        ld      sp,(LIST_SP)
        res     4,(iy+$02)
        ret     

.l0c86  rst     $8
        inc     b

.l0c88  dec     (iy+$52)
        jr      nz,l0cd2            ; (69)
        ld      a,$18
        sub     b
        ld      (SCR_CT),a
        ld      hl,(ATTR_T)
        push    hl
        ld      a,(P_FLAG)
        push    af
        ld      a,$fd
        call    $1601
        xor     a
        ld      de,$0cf8
        call    $0c0a
        set     5,(iy+$02)
        ld      hl,FLAGS
        set     3,(hl)
        res     5,(hl)
        exx     
        call    $15d4
        exx     
        cp      $20
        jr      z,l0d00             ; (69)
        cp      $e2
        jr      z,l0d00             ; (65)
        or      $20
        cp      $6e
        jr      z,l0d00             ; (59)
        ld      a,$fe
        call    $1601
        pop     af
        ld      (P_FLAG),a
        pop     hl
        ld      (ATTR_T),hl

.l0cd2  call    $0dfe
        ld      b,(iy+$31)
        inc     b
        ld      c,$21
        push    bc
        call    $0e9b
        ld      a,h
        rrca    
        rrca    
        rrca    
        and     $03
        or      $58
        ld      h,a
        ld      de,$5ae0
        ld      a,(de)
        ld      c,(hl)
        ld      b,$20
        ex      de,hl

.l0cf0  ld      (de),a
        ld      (hl),c
        inc     de
        inc     hl
        djnz    $0cf0               ; (-6)
        pop     bc
        ret     
        add     a,b
        ld      (hl),e
        ld      h,e
        ld      (hl),d
        ld      l,a
        ld      l,h
        ld      l,h
        cp      a

.l0d00  rst     $8
        inc     c

.l0d02  cp      $02
        jr      c,l0c86             ; (-128)
        add     a,(iy+$31)
        sub     $19
        ret     nc
        neg     
        push    bc
        ld      b,a
        ld      hl,(ATTR_T)
        push    hl
        ld      hl,(P_FLAG)
        push    hl
        call    $0d4d
        ld      a,b

.l0d1c  push    af
        ld      hl,DF_SZ
        ld      b,(hl)
        ld      a,b
        inc     a
        ld      (hl),a
        ld      hl,S_POSN+1
        cp      (hl)
        jr      c,l0d2d             ; (3)
        inc     (hl)
        ld      b,$18

.l0d2d  call    $0e00
        pop     af
        dec     a
        jr      nz,l0d1c            ; (-24)
        pop     hl
        ld      (iy+$57),l
        pop     hl
        ld      (ATTR_T),hl
        ld      bc,(S_POSN)
        res     0,(iy+$02)
        call    $0dd9
        set     0,(iy+$02)
        pop     bc
        ret     

.l0d4d  xor     a
        ld      hl,(ATTR_P)
        bit     0,(iy+$02)
        jr      z,l0d5b             ; (4)
        ld      h,a
        ld      l,(iy+$0e)

.l0d5b  ld      (ATTR_T),hl
        ld      hl,P_FLAG
        jr      nz,l0d65            ; (2)
        ld      a,(hl)
        rrca    

.l0d65  xor     (hl)
        and     $55
        xor     (hl)
        ld      (hl),a
        ret     

.l0d6b  call    $0daf

.l0d6e  ld      hl,TV_FLAG
        res     5,(hl)
        set     0,(hl)
        call    $0d4d
        ld      b,(iy+$31)
        call    $0e44
        ld      hl,$5ac0
        ld      a,(ATTR_P)
        dec     b
        jr      l0d8e               ; (7)

.l0d87  ld      c,$20

.l0d89  dec     hl
        ld      (hl),a
        dec     c
        jr      nz,l0d89            ; (-5)

.l0d8e  djnz    $0d87               ; (-9)
        ld      (iy+$31),$02

.l0d94  ld      a,$fd
        call    $1601
        ld      hl,(CURCHL)
        ld      de,$09f4
        and     a

.l0da0  ld      (hl),e
        inc     hl
        ld      (hl),d
        inc     hl
        ld      de,$10a8
        ccf     
        jr      c,l0da0             ; (-10)
        ld      bc,$1721
        jr      l0dd9               ; (42)

.l0daf  ld      hl,$0000
        ld      (COORDS),hl
        res     0,(iy+$30)
        call    $0d94
        ld      a,$fe
        call    $1601
        call    $0d4d
        ld      b,$18
        call    $0e44
        ld      hl,(CURCHL)
        ld      de,$09f4
        ld      (hl),e
        inc     hl
        ld      (hl),d
        ld      (iy+$52),$01
        ld      bc,$1821

.l0dd9  ld      hl,$5b00
        bit     1,(iy+$01)
        jr      nz,l0df4            ; (18)
        ld      a,b
        bit     0,(iy+$02)
        jr      z,l0dee             ; (5)
        add     a,(iy+$31)
        sub     $18

.l0dee  push    bc
        ld      b,a
        call    $0e9b
        pop     bc

.l0df4  ld      a,$21
        sub     c
        ld      e,a
        ld      d,$00
        add     hl,de
        jp      $0adc

.l0dfe  ld      b,$17

.l0e00  call    $0e9b
        ld      c,$08

.l0e05  push    bc
        push    hl
        ld      a,b
        and     $07
        ld      a,b
        jr      nz,l0e19            ; (12)

.l0e0d  ex      de,hl
        ld      hl,$f8e0
        add     hl,de
        ex      de,hl
        ld      bc,$0020
        dec     a
        ldir    

.l0e19  ex      de,hl
        ld      hl,$ffe0
        add     hl,de
        ex      de,hl
        ld      b,a
        and     $07
        rrca    
        rrca    
        rrca    
        ld      c,a
        ld      a,b
        ld      b,$00
        ldir    
        ld      b,$07
        add     hl,bc
        and     $f8
        jr      nz,l0e0d            ; (-37)
        pop     hl
        inc     h
        pop     bc
        dec     c
        jr      nz,l0e05            ; (-51)
        call    $0e88
        ld      hl,$ffe0
        add     hl,de
        ex      de,hl
        ldir    
        ld      b,$01

.l0e44  push    bc
        call    $0e9b
        ld      c,$08

.l0e4a  push    bc
        push    hl
        ld      a,b

.l0e4d  and     $07
        rrca    
        rrca    
        rrca    
        ld      c,a
        ld      a,b
        ld      b,$00
        dec     c
        ld      d,h
        ld      e,l
        ld      (hl),$00
        inc     de
        ldir    
        ld      de,$0701
        add     hl,de
        dec     a
        and     $f8
        ld      b,a
        jr      nz,l0e4d            ; (-27)
        pop     hl
        inc     h
        pop     bc
        dec     c
        jr      nz,l0e4a            ; (-36)
        call    $0e88
        ld      h,d
        ld      l,e
        inc     de
        ld      a,(ATTR_P)
        bit     0,(iy+$02)
        jr      z,l0e80             ; (3)
        ld      a,(BORDCR)

.l0e80  ld      (hl),a
        dec     bc
        ldir    
        pop     bc
        ld      c,$21
        ret     

.l0e88  ld      a,h
        rrca    
        rrca    
        rrca    
        dec     a
        or      $50
        ld      h,a
        ex      de,hl
        ld      h,c
        ld      l,b
        add     hl,hl
        add     hl,hl
        add     hl,hl
        add     hl,hl
        add     hl,hl
        ld      b,h
        ld      c,l
        ret     

.l0e9b  ld      a,$18
        sub     b
        ld      d,a
        rrca    
        rrca    
        rrca    
        and     $e0
        ld      l,a
        ld      a,d
        and     $18
        or      $40
        ld      h,a
        ret     
        di      
        ld      b,$b0
        ld      hl,$4000

.l0eb2  push    hl
        push    bc
        call    $0ef4
        pop     bc
        pop     hl
        inc     h
        ld      a,h
        and     $07
        jr      nz,l0ec9            ; (10)
        ld      a,l
        add     a,$20
        ld      l,a
        ccf     
        sbc     a,a
        and     $f8
        add     a,h
        ld      h,a

.l0ec9  djnz    $0eb2               ; (-25)
        jr      l0eda               ; (13)

.l0ecd  di
        ld      hl,$5b00
        ld      b,$08

.l0ed3  push    bc
        call    $0ef4
        pop     bc
        djnz    $0ed3               ; (-7)

.l0eda  ld      a,$04
        out     ($fb),a
        ei      

.l0edf  ld      hl,$5b00
        ld      (iy+$46),l
        xor     a
        ld      b,a

.l0ee7  ld      (hl),a
        inc     hl
        djnz    $0ee7               ; (-4)
        res     1,(iy+$30)
        ld      c,$21
        jp      $0dd9

.l0ef4  ld      a,b
        cp      $03
        sbc     a,a
        and     $02
        out     ($fb),a
        ld      d,a

.l0efd  call    $1f54
        jr      c,l0f0c             ; (10)
        ld      a,$04

.l0f04  out     ($fb),a
        ei      
        call    $0edf
        rst     $8
        inc     c

.l0f0c  in      a,($fb)
        add     a,a
        ret     m
        jr      nc,l0efd            ; (-21)
        ld      c,$20

.l0f14  ld      e,(hl)
        inc     hl
        ld      b,$08

.l0f18  rl      d
        rl      e
        rr      d

.l0f1e  in      a,($fb)
        rra     
        jr      nc,l0f1e            ; (-5)
        ld      a,d
        out     ($fb),a
        djnz    $0f18               ; (-16)
        dec     c
        jr      nz,l0f14            ; (-23)
        ret     

.l0f2c  ld      hl,(ERR_SP)
        push    hl

.l0f30  ld      hl,$107f
        push    hl
        ld      (ERR_SP),sp
        call    $15d4
        push    af
        ld      d,$00
        ld      e,(iy-$01)
        ld      hl,$00c8
        call    $03b5
        pop     af
        ld      hl,$0f38
        push    hl
        cp      $18
        jr      nc,l0f81            ; (49)
        cp      $07
        jr      c,l0f81             ; (45)
        cp      $10
        jr      c,l0f92             ; (58)
        ld      bc,$0002
        ld      d,a
        cp      $16
        jr      c,l0f6c             ; (12)
        inc     bc
        bit     7,(iy+$37)
        jp      z,$101e
        call    $15d4
        ld      e,a

.l0f6c  call    $15d4
        push    de
        ld      hl,(K_CUR)
        res     0,(iy+$07)
        call    $1655
        pop     bc
        inc     hl
        ld      (hl),b
        inc     hl
        ld      (hl),c
        jr      l0f8b               ; (10)

.l0f81  res     0,(iy+$07)
        ld      hl,(K_CUR)
        call    $1652

.l0f8b  ld      (de),a
        inc     de
        ld      (K_CUR),de
        ret     

.l0f92  ld      e,a
        ld      d,$00
        ld      hl,$0f99
        add     hl,de
        ld      e,(hl)
        add     hl,de
        push    hl
        ld      hl,(K_CUR)
        ret     
        add     hl,bc
        ld      h,(hl)
        ld      l,d
        ld      d,b
        or      l
        ld      (hl),b
        ld      a,(hl)
        rst     $8
        call    nc,$492a
        ld      e,h
        bit     5,(iy+$37)
        jp      nz,$1097
        call    $196e
        call    $1695
        ld      a,d
        or      e
        jp      z,$1097
        push    hl
        inc     hl
        ld      c,(hl)
        inc     hl
        ld      b,(hl)
        ld      hl,$000a
        add     hl,bc
        ld      b,h
        ld      c,l
        call    $1f05
        call    $1097
        ld      hl,(CURCHL)
        ex      (sp),hl
        push    hl
        ld      a,$ff
        call    $1601
        pop     hl
        dec     hl
        dec     (iy+$0f)
        call    $1855
        inc     (iy+$0f)
        ld      hl,(E_LINE)
        inc     hl
        inc     hl
        inc     hl
        inc     hl
        ld      (K_CUR),hl
        pop     hl
        call    $1615
        ret     
        bit     5,(iy+$37)
        jr      nz,l1001            ; (8)
        ld      hl,E_PPC
        call    $190f
        jr      l106e               ; (109)

.l1001  ld      (iy+$00),$10
        jr      l1024               ; (29)
        call    $1031
        jr      l1011               ; (5)
        ld      a,(hl)
        cp      $0d
        ret     z
        inc     hl

.l1011  ld      (K_CUR),hl
        ret     
        call    $1031
        ld      bc,$0001
        jp      $19e8

.l101e  call    $15d4
        call    $15d4

.l1024  pop     hl
        pop     hl

.l1026  pop     hl
        ld      (ERR_SP),hl
        bit     7,(iy+$00)
        ret     nz
        ld      sp,hl
        ret     

.l1031  scf
        call    $1195
        sbc     hl,de
        add     hl,de
        inc     hl
        pop     bc
        ret     c
        push    bc
        ld      b,h
        ld      c,l

.l103e  ld      h,d
        ld      l,e
        inc     hl
        ld      a,(de)
        and     $f0
        cp      $10
        jr      nz,l1051            ; (9)
        inc     hl
        ld      a,(de)
        sub     $17
        adc     a,$00
        jr      nz,l1051            ; (1)
        inc     hl

.l1051  and     a
        sbc     hl,bc
        add     hl,bc
        ex      de,hl
        jr      c,l103e             ; (-26)
        ret     
        bit     5,(iy+$37)
        ret     nz
        ld      hl,(E_PPC)
        call    $196e
        ex      de,hl
        call    $1695
        ld      hl,E_PPC+1
        call    $191c

.l106e  call    $1795
        ld      a,$00
        jp      $1601
        bit     7,(iy+$37)
        jr      z,l1024             ; (-88)
        jp      $0f81
        bit     4,(iy+$30)
        jr      z,l1026             ; (-95)
        ld      (iy+$00),$ff
        ld      d,$00
        ld      e,(iy-$02)
        ld      hl,$1a90
        call    $03b5
        jp      $0f30

.l1097  push    hl
        call    $1190
        dec     hl
        call    $19e5
        ld      (K_CUR),hl
        ld      (iy+$07),$00
        pop     hl
        ret     
        bit     3,(iy+$02)
        call    nz,$111d
        and     a
        bit     5,(iy+$01)
        ret     z
        ld      a,(LAST_K)
        res     5,(iy+$01)
        push    af
        bit     5,(iy+$02)
        call    nz,$0d6e
        pop     af
        cp      $20
        jr      nc,l111b            ; (82)
        cp      $10
        jr      nc,l10fa            ; (45)
        cp      $06
        jr      nc,l10db            ; (10)
        ld      b,a
        and     $01
        ld      c,a
        ld      a,b
        rra     
        add     a,$12
        jr      l1105               ; (42)

.l10db  jr      nz,l10e6            ; (9)
        ld      hl,FLAGS2
        ld      a,$08
        xor     (hl)
        ld      (hl),a
        jr      l10f4               ; (14)

.l10e6  cp      $0e
        ret     c
        sub     $0d
        ld      hl,MODE
        cp      (hl)
        ld      (hl),a
        jr      nz,l10f4            ; (2)
        ld      (hl),$00

.l10f4  set     3,(iy+$02)
        cp      a
        ret     

.l10fa  ld      b,a
        and     $07
        ld      c,a
        ld      a,$10
        bit     3,b
        jr      nz,l1105            ; (1)
        inc     a

.l1105  ld      (iy-$2d),c
        ld      de,$110d
        jr      l1113               ; (6)
        ld      a,(K_DATA)
        ld      de,$10a8

.l1113  ld      hl,(CHANS)
        inc     hl
        inc     hl
        ld      (hl),e
        inc     hl
        ld      (hl),d

.l111b  scf
        ret     

.l111d  call    $0d4d
        res     3,(iy+$02)
        res     5,(iy+$02)
        ld      hl,(SPOSNL)
        push    hl
        ld      hl,(ERR_SP)
        push    hl
        ld      hl,$1167
        push    hl
        ld      (ERR_SP),sp
        ld      hl,(ECHO_E)
        push    hl
        scf     
        call    $1195
        ex      de,hl
        call    $187d
        ex      de,hl
        call    $18e1
        ld      hl,(SPOSNL)
        ex      (sp),hl
        ex      de,hl
        call    $0d4d

.l1150  ld      a,(SPOSNL+1)
        sub     d
        jr      c,l117c             ; (38)
        jr      nz,l115e            ; (6)
        ld      a,e
        sub     (iy+$50)
        jr      nc,l117c            ; (30)

.l115e  ld      a,$20
        push    de
        call    $09f4
        pop     de
        jr      l1150               ; (-23)
        ld      d,$00
        ld      e,(iy-$02)
        ld      hl,$1a90
        call    $03b5
        ld      (iy+$00),$ff
        ld      de,(SPOSNL)
        jr      l117e               ; (2)

.l117c  pop     de
        pop     hl

.l117e  pop     hl
        ld      (ERR_SP),hl
        pop     bc
        push    de
        call    $0dd9
        pop     hl
        ld      (ECHO_E),hl
        ld      (iy+$26),$00
        ret     

.l1190  ld      hl,(WORKSP)
        dec     hl
        and     a

.l1195  ld      de,(E_LINE)
        bit     5,(iy+$37)
        ret     z
        ld      de,(WORKSP)
        ret     c
        ld      hl,(STKBOT)
        ret     

.l11a7  ld      a,(hl)
        cp      $0e
        ld      bc,$0006
        call    z,$19e8
        ld      a,(hl)
        inc     hl
        cp      $0d
        jr      nz,l11a7            ; (-15)
        ret     
        di      
        ld      a,$ff
        ld      de,(RAMTOP)
        exx     
        ld      bc,(P_RAMT)
        ld      de,(RASP)
        ld      hl,(UDG)
        exx     

.l11cb  ld      b,a
        ld      a,$07
        out     ($fe),a
        ld      a,$3f
        ld      i,a
        nop     
        nop     
        nop     
        nop     
        nop     
        nop     
        ld      h,d
        ld      l,e

.l11dc  ld      (hl),$02
        dec     hl
        cp      h
        jr      nz,l11dc            ; (-6)

.l11e2  and     a
        sbc     hl,de
        add     hl,de
        inc     hl
        jr      nc,l11ef            ; (6)
        dec     (hl)
        jr      z,l11ef             ; (3)
        dec     (hl)
        jr      z,l11e2             ; (-13)

.l11ef  dec     hl
        exx     
        ld      (P_RAMT),bc
        ld      (RASP),de
        ld      (UDG),hl
        exx     
        inc     b
        jr      z,l1219             ; (25)
        ld      (P_RAMT),hl
        ld      de,$3eaf
        ld      bc,$00a8
        ex      de,hl
        lddr    
        ex      de,hl
        inc     hl
        ld      (UDG),hl
        dec     hl
        ld      bc,$0040
        ld      (RASP),bc

.l1219  ld      (RAMTOP),hl
        ld      hl,$3c00
        ld      (CHARS),hl
        ld      hl,(RAMTOP)
        ld      (hl),$3e
        dec     hl
        ld      sp,hl
        dec     hl
        dec     hl
        ld      (ERR_SP),hl
        im      1
        ld      iy,ERR_NR
        ei      
        ld      hl,$5cb6
        ld      (CHANS),hl
        ld      de,$15af
        ld      bc,$0015
        ex      de,hl
        ldir    
        ex      de,hl
        dec     hl
        ld      (DATADD),hl
        inc     hl
        ld      (PROG),hl
        ld      (VARS),hl
        ld      (hl),$80
        inc     hl
        ld      (E_LINE),hl
        ld      (hl),$0d
        inc     hl
        ld      (hl),$80
        inc     hl
        ld      (WORKSP),hl
        ld      (STKBOT),hl
        ld      (STKEND),hl
        ld      a,$38
        ld      (ATTR_P),a
        ld      (ATTR_T),a
        ld      (BORDCR),a
        ld      hl,$0523
        ld      (REPDEL),hl
        dec     (iy-$3a)
        dec     (iy-$36)
        ld      hl,$15c6
        ld      de,STRMS
        ld      bc,$000e
        ldir    
        set     1,(iy+$01)
        call    $0edf
        ld      (iy+$31),$02
        call    $0d6b
        xor     a
        ld      de,$1538
        call    $0c0a
        set     5,(iy+$02)
        jr      l12a9               ; (7)

.l12a2  ld      (iy+$31),$02
        call    $1795

.l12a9  call    $16b0

.l12ac  ld      a,$00
        call    $1601
        call    $0f2c
        call    $1b17
        bit     7,(iy+$00)
        jr      nz,l12cf            ; (18)
        bit     4,(iy+$30)
        jr      z,l1303             ; (64)
        ld      hl,(E_LINE)
        call    $11a7
        ld      (iy+$00),$ff
        jr      l12ac               ; (-35)

.l12cf  ld      hl,(E_LINE)
        ld      (CH_ADD),hl
        call    $19fb
        ld      a,b
        or      c
        jp      nz,$155d
        rst     $18
        cp      $0d
        jr      z,l12a2             ; (-64)
        bit     0,(iy+$30)
        call    nz,$0daf
        call    $0d6e
        ld      a,$19
        sub     (iy+$4f)
        ld      (SCR_CT),a
        set     7,(iy+$01)
        ld      (iy+$00),$ff
        ld      (iy+$0a),$01
        call    $1b8a

.l1303  halt
        res     5,(iy+$01)
        bit     1,(iy+$30)
        call    nz,$0ecd
        ld      a,(ERR_NR)
        inc     a

.l1313  push    af
        ld      hl,$0000
        ld      (iy+$37),h
        ld      (iy+$26),h
        ld      (DEFADD),hl
        ld      hl,$0001
        ld      (STRMS+$06),hl
        call    $16b0
        res     5,(iy+$37)
        call    $0d6e
        set     5,(iy+$02)
        pop     af
        ld      b,a
        cp      $0a
        jr      c,l133c             ; (2)
        add     a,$07

.l133c  call    $15ef
        ld      a,$20
        rst     $10
        ld      a,b
        ld      de,$1391
        call    $0c0a
        call    $3a29
        nop     
        call    $0c0a
        ld      bc,(PPC)
        call    $1a1b
        ld      a,$3a
        rst     $10
        ld      c,(iy+$0d)
        ld      b,$00
        call    $1a1b
        call    $1097
        ld      a,(ERR_NR)
        inc     a
        jr      z,l1386             ; (27)
        cp      $09
        jr      z,l1373             ; (4)
        cp      $15
        jr      nz,l1376            ; (3)

.l1373  inc     (iy+$0d)

.l1376  ld      bc,$0003
        ld      de,OSPCC
        ld      hl,NSPPC
        bit     7,(hl)
        jr      z,l1384             ; (1)
        add     hl,bc

.l1384  lddr

.l1386  ld      (iy+$0a),$ff
        res     3,(iy+$01)
        jp      $12ac

.l1391  defb    $80
        defm    "O"&('K'+$80)
        defm    "NEXT without FO"&('R'+$80)
        defm    "Variable not foun"&('d'+$80)
        defm    "Subscript wron"&('g'+$80)
        defm    "Out of memor"&('y'+$80)
        defm    "Out of scree"&('n'+$80)
        defm    "Number too bi"&('g'+$80)
        defm    "RETURN without GOSU"&('B'+$80)
        defm    "End of fil"&('e'+$80)
        defm    "STOP statemen"&('t'+$80)
        defm    "Invalid argumen"&('t'+$80)
        defm    "Integer out of rang"&('e'+$80)
        defm    "Nonsense in BASI"&('C'+$80)
        defm    "BREAK - CONT repeat"&('s'+$80)
        defm    "Out of DAT"&('A'+$80)
        defm    "Invalid file nam"&('e'+$80)
        defm    "No room for lin"&('e'+$80)
        defm    "STOP in INPU"&('T'+$80)
        defm    "FOR without NEX"&('T'+$80)
        defm    "Invalid I/O devic"&('e'+$80)
        defm    "Invalid colou"&('r'+$80)
        defm    "BREAK into progra"&('m'+$80)
        defm    "RAMTOP no goo"&('d'+$80)
        defm    "Statement los"&('t'+$80)
        defm    "Invalid strea"&('m'+$80)
        defm    "FN without DE"&('F'+$80)
        defm    "Parameter erro"&('r'+$80)
        defm    "Tape loading erro"&('r'+$80)
        defm    ","&$a0
        defm    $7f&" 1982 Amstrad             "&$a0


.l1555  ld      a,$10
        ld      bc,$0000
        jp      $1313

.l155d  ld      (E_PPC),bc
        ld      hl,(CH_ADD)
        ex      de,hl
        ld      hl,$1555
        push    hl

.l1569  ld      hl,(WORKSP)
        scf     

.l156d  sbc     hl,de

.l156f  push    hl
        ld      h,b

.l1571  ld      l,c
        call    $196e
        jr      nz,l157d            ; (6)
        call    $19b8
        call    $19e8

.l157d  pop     bc
        ld      a,c
        dec     a
        or      b
        jr      z,l15ab             ; (40)

.l1583  push    bc
        inc     bc
        inc     bc

.l1586  inc     bc
        inc     bc
        dec     hl
        ld      de,(PROG)
        push    de
        call    $1655
        pop     hl
        ld      (PROG),hl
        pop     bc
        push    bc

.l1597  inc     de

.l1598  ld      hl,(WORKSP)
        dec     hl
        dec     hl
        lddr    
        ld      hl,(E_PPC)
        ex      de,hl
        pop     bc
        ld      (hl),b
        dec     hl
        ld      (hl),c
        dec     hl
        ld      (hl),e
        dec     hl
        ld      (hl),d

.l15ab  pop     af
        jp      $12a2
        call    p,$a809
        djnz    $15ff               ; (75)
        call    p,$c409
        dec     d
        ld      d,e
        add     a,c
        rrca    
        call    nz,$5215
        call    p,$c409
        dec     d
        ld      d,b
        add     a,b
        rst     $8
        ld      (de),a
        ld      bc,$0600
        nop     
        dec     bc
        nop     
        ld      bc,$0100
        nop     
        ld      b,$00
        djnz    $15d4               ; (0)

.l15d4  bit     5,(iy+$02)
        jr      nz,l15de            ; (4)
        set     3,(iy+$02)

.l15de  call    $15e6
        ret     c
        jr      z,l15de             ; (-6)
        rst     $8
        rlca    

.l15e6  exx
        push    hl
        ld      hl,(CURCHL)
        inc     hl
        inc     hl
        jr      l15f7               ; (8)

.l15ef  ld      e,$30
        add     a,e

.l15f2  exx
        push    hl
        ld      hl,(CURCHL)

.l15f7  ld      e,(hl)
        inc     hl
        ld      d,(hl)
        ex      de,hl
        call    $162c
        pop     hl

.l15ff  exx
        ret     

.l1601  add     a,a
        add     a,$16
        ld      l,a
        ld      h,$5c
        ld      e,(hl)
        inc     hl
        ld      d,(hl)
        ld      a,d
        or      e
        jr      nz,l1610            ; (2)

.l160e  rst     $8
        rla     

.l1610  dec     de
        ld      hl,(CHANS)
        add     hl,de

.l1615  ld      (CURCHL),hl
        res     4,(iy+$30)
        inc     hl
        inc     hl
        inc     hl
        inc     hl
        ld      c,(hl)
        ld      hl,$162d
        call    $16dc
        ret     nc
        ld      d,$00
        ld      e,(hl)
        add     hl,de

.l162c  jp      (hl)
        ld      c,e
        ld      b,$53
        ld      (de),a
        ld      d,b
        dec     de
        nop     
        set     0,(iy+$02)
        res     5,(iy+$01)
        set     4,(iy+$30)
        jr      l1646               ; (4)
        res     0,(iy+$02)

.l1646  res     1,(iy+$01)
        jp      $0d4d
        set     1,(iy+$01)
        ret     

.l1652  ld      bc,$0001

.l1655  push    hl
        call    $1f05
        pop     hl
        call    $1664
        ld      hl,(STKEND)
        ex      de,hl
        lddr    
        ret     

.l1664  push    af
        push    hl
        ld      hl,VARS
        ld      a,$0e

.l166b  ld      e,(hl)
        inc     hl
        ld      d,(hl)
        ex      (sp),hl
        and     a
        sbc     hl,de
        add     hl,de
        ex      (sp),hl
        jr      nc,l167f            ; (9)
        push    de
        ex      de,hl
        add     hl,bc
        ex      de,hl
        ld      (hl),d
        dec     hl
        ld      (hl),e
        inc     hl
        pop     de

.l167f  inc     hl
        dec     a
        jr      nz,l166b            ; (-24)
        ex      de,hl
        pop     de
        pop     af
        and     a
        sbc     hl,de
        ld      b,h
        ld      c,l
        inc     bc
        add     hl,de
        ex      de,hl
        ret     
        nop     
        nop     

.l1691  ex      de,hl
        ld      de,$168f

.l1695  ld      a,(hl)
        and     $c0
        jr      nz,l1691            ; (-9)
        ld      d,(hl)
        inc     hl
        ld      e,(hl)
        ret     

.l169e  ld      hl,(STKBOT)
        dec     hl
        call    $1655
        inc     hl
        inc     hl
        pop     bc
        ld      (WORKSP),bc
        pop     bc
        ex      de,hl
        inc     hl
        ret     

.l16b0  ld      hl,(E_LINE)
        ld      (hl),$0d
        ld      (K_CUR),hl
        inc     hl
        ld      (hl),$80
        inc     hl
        ld      (WORKSP),hl

.l16bf  ld      hl,(WORKSP)
        ld      (STKBOT),hl

.l16c5  ld      hl,(STKBOT)
        ld      (STKEND),hl
        push    hl
        ld      hl,MEMBOT
        ld      (MEM),hl
        pop     hl
        ret     
        ld      de,(E_LINE)
        jp      $19e5

.l16db  inc     hl

.l16dc  ld      a,(hl)
        and     a
        ret     z
        cp      c
        inc     hl
        jr      nz,l16db            ; (-8)
        scf     
        ret     
        call    $171e
        call    $1701
        ld      bc,$0000
        ld      de,$a3e2
        ex      de,hl
        add     hl,de
        jr      c,l16fc             ; (7)
        ld      bc,$15d4
        add     hl,bc
        ld      c,(hl)
        inc     hl
        ld      b,(hl)

.l16fc  ex      de,hl
        ld      (hl),c
        inc     hl
        ld      (hl),b
        ret     

.l1701  push    hl
        ld      hl,(CHANS)
        add     hl,bc
        inc     hl
        inc     hl
        inc     hl
        ld      c,(hl)
        ex      de,hl
        ld      hl,$1716
        call    $16dc
        ld      c,(hl)
        ld      b,$00
        add     hl,bc
        jp      (hl)
        ld      c,e
        dec     b
        ld      d,e
        inc     bc
        ld      d,b
        ld      bc,$c9e1

.l171e  call    $1e94
        cp      $10
        jr      c,l1727             ; (2)

.l1725  rst     $8
        rla     

.l1727  add     a,$03
        rlca    
        ld      hl,STRMS
        ld      c,a
        ld      b,$00
        add     hl,bc
        ld      c,(hl)
        inc     hl
        ld      b,(hl)
        dec     hl
        ret     
        rst     $28
        ld      bc,$cd38
        ld      e,$17
        ld      a,b
        or      c
        jr      z,l1756             ; (22)
        ex      de,hl
        ld      hl,(CHANS)
        add     hl,bc
        inc     hl
        inc     hl
        inc     hl
        ld      a,(hl)
        ex      de,hl
        cp      $4b
        jr      z,l1756             ; (8)
        cp      $53
        jr      z,l1756             ; (4)
        cp      $50
        jr      nz,l1725            ; (-49)

.l1756  call    $175d
        ld      (hl),e
        inc     hl
        ld      (hl),d
        ret     

.l175d  push    hl
        call    $2bf1
        ld      a,b
        or      c
        defb    $20
        defb    2

.l1765  rst     $8
        ld      c,$c5
        ld      a,(de)
        and     $df
        ld      c,a
        ld      hl,$177a
        call    $16dc
        jr      nc,l1765            ; (-15)
        ld      c,(hl)
        ld      b,$00
        add     hl,bc
        pop     bc
        jp      (hl)
        ld      c,e
        ld      b,$53
        ex      af,af'
        ld      d,b
        ld      a,(bc)
        nop     
        ld      e,$01
        jr      l178b               ; (6)
        ld      e,$06
        jr      l178b               ; (2)
        ld      e,$10

.l178b  dec     bc
        ld      a,b
        or      c
        jr      nz,l1765            ; (-43)
        ld      d,a
        pop     hl
        ret     
        jr      l1725               ; (-112)

.l1795  ld      (LIST_SP),sp
        ld      (iy+$02),$10
        call    $0daf
        set     0,(iy+$02)
        ld      b,(iy+$31)
        call    $0e44
        res     0,(iy+$02)
        set     0,(iy+$30)
        ld      hl,(E_PPC)
        ld      de,(S_TOP)
        and     a
        sbc     hl,de
        add     hl,de
        jr      c,l17e1             ; (34)
        push    de
        call    $196e
        ld      de,$02c0
        ex      de,hl
        sbc     hl,de
        ex      (sp),hl
        call    $196e
        pop     bc

.l17ce  push    bc
        call    $19b8
        pop     bc
        add     hl,bc
        jr      c,l17e4             ; (14)
        ex      de,hl
        ld      d,(hl)
        inc     hl
        ld      e,(hl)
        dec     hl
        ld      (S_TOP),de
        jr      l17ce               ; (-19)

.l17e1  ld      (S_TOP),hl

.l17e4  ld      hl,(S_TOP)
        call    $196e
        jr      z,l17ed             ; (1)
        ex      de,hl

.l17ed  call    $1833
        res     4,(iy+$02)
        ret     
        ld      a,$03
        jr      l17fb               ; (2)
        ld      a,$02

.l17fb  ld      (iy+$02),$00
        call    $2530
        call    nz,$1601
        rst     $18
        call    $2070
        jr      c,l181f             ; (20)
        rst     $18
        cp      $3b
        jr      z,l1814             ; (4)
        cp      $2c
        jr      nz,l181a            ; (6)

.l1814  rst     $20
        call    $1c82
        jr      l1822               ; (8)

.l181a  call    $1ce6
        jr      l1822               ; (3)

.l181f  call    $1cde

.l1822  call    $1bee
        call    $1e99
        ld      a,b
        and     $3f
        ld      h,a
        ld      l,c
        ld      (E_PPC),hl
        call    $196e

.l1833  ld      e,$01

.l1835  call    $1855
        rst     $10
        bit     4,(iy+$02)
        jr      z,l1835             ; (-10)
        ld      a,(DF_SZ)
        sub     (iy+$4f)
        jr      nz,l1835            ; (-18)
        xor     e
        ret     z
        push    hl
        push    de
        ld      hl,S_TOP
        call    $190f
        pop     de
        pop     hl
        jr      l1835               ; (-32)

.l1855  ld      bc,(E_PPC)
        call    $1980
        ld      d,$3e
        jr      z,l1865             ; (5)
        ld      de,$0000
        rl      e

.l1865  ld      (iy+$2d),e
        ld      a,(hl)
        cp      $40
        pop     bc
        ret     nc
        push    bc
        call    $1a28
        inc     hl
        inc     hl
        inc     hl
        res     0,(iy+$01)
        ld      a,d
        and     a
        jr      z,l1881             ; (5)
        rst     $10

.l187d  set     0,(iy+$01)

.l1881  push    de
        ex      de,hl
        res     2,(iy+$30)
        ld      hl,FLAGS
        res     2,(hl)
        bit     5,(iy+$37)
        jr      z,l1894             ; (2)
        set     2,(hl)

.l1894  ld      hl,(X_PTR)
        and     a
        sbc     hl,de
        jr      nz,l18a1            ; (5)
        ld      a,$3f
        call    $18c1

.l18a1  call    $18e1
        ex      de,hl
        ld      a,(hl)
        call    $18b6
        inc     hl
        cp      $0d
        jr      z,l18b4             ; (6)
        ex      de,hl
        call    $1937
        jr      l1894               ; (-32)

.l18b4  pop     de
        ret     

.l18b6  cp      $0e
        ret     nz
        inc     hl
        inc     hl
        inc     hl
        inc     hl
        inc     hl
        inc     hl
        ld      a,(hl)
        ret     

.l18c1  exx
        ld      hl,(ATTR_T)
        push    hl
        res     7,h
        set     7,l
        ld      (ATTR_T),hl
        ld      hl,P_FLAG
        ld      d,(hl)
        push    de
        ld      (hl),$00
        call    $09f4
        pop     hl
        ld      (iy+$57),h
        pop     hl
        ld      (ATTR_T),hl
        exx     
        ret     

.l18e1  ld      hl,(K_CUR)
        and     a
        sbc     hl,de
        ret     nz
        ld      a,(MODE)
        rlc     a
        jr      z,l18f3             ; (4)
        add     a,$43
        jr      l1909               ; (22)

.l18f3  ld      hl,FLAGS
        res     3,(hl)
        ld      a,$4b
        bit     2,(hl)
        jr      z,l1909             ; (11)
        set     3,(hl)
        inc     a
        bit     3,(iy+$30)
        jr      z,l1909             ; (2)
        ld      a,$43

.l1909  push    de
        call    $18c1
        pop     de
        ret     

.l190f  ld      e,(hl)
        inc     hl
        ld      d,(hl)
        push    hl
        ex      de,hl
        inc     hl
        call    $196e
        call    $1695
        pop     hl

.l191c  bit     5,(iy+$37)
        ret     nz
        ld      (hl),d
        dec     hl
        ld      (hl),e
        ret     

.l1925  ld      a,e
        and     a
        ret     m
        jr      l1937               ; (13)

.l192a  xor     a

.l192b  add     hl,bc
        inc     a
        jr      c,l192b             ; (-4)
        sbc     hl,bc
        dec     a
        jr      z,l1925             ; (-15)
        jp      $15ef

.l1937  call    $2d1b
        jr      nc,l196c            ; (48)
        cp      $21
        jr      c,l196c             ; (44)
        res     2,(iy+$01)
        cp      $cb
        jr      z,l196c             ; (36)
        cp      $3a
        jr      nz,l195a            ; (14)
        bit     5,(iy+$37)
        jr      nz,l1968            ; (22)
        bit     2,(iy+$30)
        jr      z,l196c             ; (20)
        jr      l1968               ; (14)

.l195a  cp      $22
        jr      nz,l1968            ; (10)
        push    af
        ld      a,(FLAGS2)
        xor     $04
        ld      (FLAGS2),a
        pop     af

.l1968  set     2,(iy+$01)

.l196c  rst     $10
        ret     

.l196e  push    hl
        ld      hl,(PROG)
        ld      d,h
        ld      e,l

.l1974  pop     bc
        call    $1980
        ret     nc
        push    bc
        call    $19b8
        ex      de,hl
        jr      l1974               ; (-12)

.l1980  ld      a,(hl)
        cp      b
        ret     nz
        inc     hl
        ld      a,(hl)
        dec     hl
        cp      c
        ret     
        inc     hl
        inc     hl
        inc     hl

.l198b  ld      (CH_ADD),hl
        ld      c,$00

.l1990  dec     d
        ret     z
        rst     $20
        cp      e
        jr      nz,l199a            ; (4)
        and     a
        ret     

.l1998  inc     hl
        ld      a,(hl)

.l199a  call    $18b6
        ld      (CH_ADD),hl
        cp      $22
        jr      nz,l19a5            ; (1)
        dec     c

.l19a5  cp      $3a
        jr      z,l19ad             ; (4)
        cp      $cb
        jr      nz,l19b1            ; (4)

.l19ad  bit     0,c
        jr      z,l1990             ; (-33)

.l19b1  cp      $0d
        jr      nz,l1998            ; (-29)
        dec     d
        scf     
        ret     

.l19b8  push    hl
        ld      a,(hl)
        cp      $40
        jr      c,l19d5             ; (23)
        bit     5,a
        jr      z,l19d6             ; (20)
        add     a,a
        jp      m,$19c7
        ccf     

.l19c7  ld      bc,$0005
        jr      nc,l19ce            ; (2)
        ld      c,$12

.l19ce  rla
        inc     hl
        ld      a,(hl)
        jr      nc,l19ce            ; (-5)
        jr      l19db               ; (6)

.l19d5  inc     hl

.l19d6  inc     hl
        ld      c,(hl)
        inc     hl
        ld      b,(hl)
        inc     hl

.l19db  add     hl,bc
        pop     de

.l19dd  and     a
        sbc     hl,de
        ld      b,h
        ld      c,l
        add     hl,de
        ex      de,hl
        ret     

.l19e5  call    $19dd

.l19e8  push    bc
        ld      a,b
        cpl     
        ld      b,a
        ld      a,c
        cpl     
        ld      c,a
        inc     bc
        call    $1664
        ex      de,hl
        pop     hl
        add     hl,de
        push    de
        ldir    
        pop     hl
        ret     

.l19fb  ld      hl,(E_LINE)
        dec     hl
        ld      (CH_ADD),hl
        rst     $20
        ld      hl,MEMBOT
        ld      (STKEND),hl
        call    $2d3b
        call    $2da2
        jr      c,l1a15             ; (4)
        ld      hl,$d8f0
        add     hl,bc

.l1a15  jp      c,$1c8a
        jp      $16c5

.l1a1b  push    de
        push    hl
        xor     a
        bit     7,b
        jr      nz,l1a42            ; (32)
        ld      h,b
        ld      l,c
        ld      e,$ff
        jr      l1a30               ; (8)

.l1a28  push    de
        ld      d,(hl)
        inc     hl
        ld      e,(hl)
        push    hl
        ex      de,hl
        ld      e,$20

.l1a30  ld      bc,$fc18
        call    $192a
        ld      bc,$ff9c
        call    $192a
        ld      c,$f6
        call    $192a
        ld      a,l

.l1a42  call    $15ef
        pop     hl
        pop     de
        ret     
        or      c
        res     7,h
        cp      a
        call    nz,$b4af
        sub     e
        sub     c
        sub     d
        sub     l
        sbc     a,b
        sbc     a,b
        sbc     a,b
        sbc     a,b
        sbc     a,b
        sbc     a,b
        sbc     a,b
        ld      a,a
        add     a,c
        ld      l,$6c
        ld      l,(hl)
        ld      (hl),b
        ld      c,b
        sub     h
        ld      d,(hl)
        ccf     
        ld      b,c
        dec     hl
        rla     
        rra     
        scf     
        ld      (hl),a
        ld      b,h
        rrca    
        ld      e,c
        dec     hl
        ld      b,e
        dec     l
        ld      d,c
        ld      a,($426d)
        dec     c
        ld      c,c
        ld      e,h
        ld      b,h
        dec     d
        ld      e,l
        ld      bc,$023d
        ld      b,$00
        ld      h,a
        ld      e,$06
        rlc     l
        ret     p
        inc     e
        ld      b,$00
        defb    $ed
        defb    $1e            ; Undocumented 8 T-State NOP
        nop     
        xor     $1c
        nop     
        inc     hl
        rra     
        inc     b
        dec     a
        ld      b,$cc
        ld      b,$05
        inc     bc
        dec     e
        inc     b
        nop     
        xor     e
        dec     e
        dec     b
        call    $051f
        adc     a,c
        jr      nz,l1aa8            ; (5)
        ld      (bc),a
        inc     l
        dec     b
        or      d
        dec     de

.l1aa8  nop
        or      a
        ld      de,$a103
        ld      e,$05
        ld      sp,hl
        rla     
        ex      af,af'
        nop     
        add     a,b
        ld      e,$03
        ld      c,a
        ld      e,$00
        ld      e,a
        ld      e,$03
        xor     h
        ld      e,$00
        ld      l,e
        dec     c
        add     hl,bc
        nop     
        call    c,$0622
        nop     
        ld      a,($051f)
        defb    $ed
        defb    $1d            ; Undocumented 8 T-State NOP
        dec     b
        daa     
        ld      e,$03
        ld      b,d
        ld      e,$09
        dec     b
        add     a,d
        inc     hl
        nop     
        xor     h
        ld      c,$05
        ret     
        rra     
        dec     b
        push    af
        rla     
        dec     bc
        dec     bc
        dec     bc
        dec     bc
        ex      af,af'
        nop     
        ret     m
        inc     bc
        add     hl,bc
        dec     b
        jr      nz,l1b0e            ; (35)
        rlca    
        rlca    
        rlca    
        rlca    
        rlca    
        rlca    
        ex      af,af'
        nop     
        ld      a,d
        ld      e,$06
        nop     
        sub     h
        ld      ($6005),hl
        rra     
        ld      b,$2c
        ld      a,(bc)
        nop     
        ld      (hl),$17
        ld      b,$00
        push    hl
        ld      d,$0a
        nop     
        sub     e
        rla     
        ld      a,(bc)
        inc     l
        ld      a,(bc)
        nop     

.l1b0e  sub     e
        rla     
        ld      a,(bc)
        nop     
        sub     e
        rla     
        nop     
        sub     e
        rla     

.l1b17  res     7,(iy+$01)
        call    $19fb
        xor     a
        ld      (SUBPPC),a
        dec     a
        ld      (ERR_NR),a
        jr      l1b29               ; (1)

.l1b28  rst     $20

.l1b29  call    $16bf
        inc     (iy+$0d)
        jp      m,$1c8a
        rst     $18
        ld      b,$00
        cp      $0d
        jr      z,l1bb3             ; (122)
        cp      $3a
        jr      z,l1b28             ; (-21)
        ld      hl,$1b76
        push    hl
        ld      c,a
        rst     $20
        ld      a,c
        sub     $ce
        jp      c,$1c8a
        ld      c,a
        ld      hl,$1a48
        add     hl,bc
        ld      c,(hl)
        add     hl,bc
        jr      l1b55               ; (3)
        ld      hl,(T_ADDR)

.l1b55  ld      a,(hl)
        inc     hl
        ld      (T_ADDR),hl
        ld      bc,$1b52
        push    bc
        ld      c,a
        cp      $20
        jr      nc,l1b6f            ; (12)
        ld      hl,$1c01
        ld      b,$00
        add     hl,bc
        ld      c,(hl)
        add     hl,bc
        push    hl
        rst     $18
        dec     b
        ret     

.l1b6f  rst     $18
        cp      c
        jp      nz,$1c8a
        rst     $20
        ret     
        call    $1f54
        jr      c,l1b7d             ; (2)
        rst     $8
        inc     d

.l1b7d  call    $3a3b
        nop     
        jr      nz,l1bf4            ; (113)
        ld      hl,(NEWPPC)
        bit     7,h
        jr      z,l1b9e             ; (20)

.l1b8a  ld      hl,$fffe
        ld      (PPC),hl
        ld      hl,(WORKSP)
        dec     hl
        ld      de,(E_LINE)
        dec     de
        ld      a,(NSPPC)
        jr      l1bd1               ; (51)

.l1b9e  call    $196e
        ld      a,(NSPPC)
        jr      z,l1bbf             ; (25)
        and     a
        jr      nz,l1bec            ; (67)
        ld      b,a
        ld      a,(hl)
        and     $c0
        ld      a,b
        jr      z,l1bbf             ; (15)
        rst     $8
        rst     $38
        pop     bc

.l1bb3  call    $2530
        ret     z
        ld      hl,(NXTLIN)
        ld      a,$c0
        and     (hl)
        ret     nz
        xor     a

.l1bbf  cp      $01
        adc     a,$00
        ld      d,(hl)
        inc     hl
        ld      e,(hl)
        ld      (PPC),de
        inc     hl
        ld      e,(hl)
        inc     hl
        ld      d,(hl)
        ex      de,hl
        add     hl,de
        inc     hl

.l1bd1  ld      (NXTLIN),hl
        ex      de,hl
        ld      (CH_ADD),hl
        ld      d,a
        ld      e,$00
        ld      (iy+$0a),$ff
        dec     d
        ld      (iy+$0d),d
        jp      z,$1b28
        inc     d
        call    $198b

.l1bea  jr      z,l1bf4             ; (8)

.l1bec  rst     $8
        ld      d,$cd
        jr      nc,l1c16            ; (37)
        ret     nz
        pop     bc
        pop     bc

.l1bf4  call    $3a4b
        jr      z,l1bb3             ; (-70)
        cp      $3a
        jp      z,$1b28
        jp      $1c8a
        rrca    
        dec     e
        ld      c,e
        add     hl,bc
        ld      h,a
        dec     bc
        ld      a,e
        adc     a,(hl)
        ld      (hl),c
        or      h
        add     a,c
        rst     $8
        call    $1cde
        cp      a
        pop     bc
        call    z,$1bee
        ex      de,hl

.l1c16  ld      hl,(T_ADDR)
        ld      c,(hl)
        inc     hl
        ld      b,(hl)
        ex      de,hl
        push    bc
        ret     

.l1c1f  call    $28b2

.l1c22  ld      (iy+$37),$00
        defb    $30
        defb    8
        set     1,(iy+$37)
        jr      nz,l1c46            ; (24)

.l1c2e  rst     $8
        ld      bc,$96cc
        add     hl,hl
        bit     6,(iy+$01)
        jr      nz,l1c46            ; (13)
        xor     a
        call    $2530
        call    nz,$2bf1
        ld      hl,FLAGX
        or      (hl)
        ld      (hl),a
        ex      de,hl

.l1c46  ld      (STRLEN),bc
        ld      (DEST),hl
        ret     
        pop     bc
        call    $1c56
        call    $1bee
        ret     

.l1c56  ld      a,(FLAGS)

.l1c59  push    af
        call    $24fb
        pop     af
        ld      d,(iy+$01)
        xor     d
        and     $40
        jr      nz,l1c8a            ; (36)
        bit     7,d
        jp      nz,$2aff
        ret     
        call    $28b2
        push    af
        ld      a,c
        or      $9f
        inc     a
        jr      nz,l1c8a            ; (20)
        pop     af
        jr      l1c22               ; (-87)

.l1c79  rst     $20

.l1c7a  call    $1c82
        cp      $2c
        jr      nz,l1c8a            ; (9)
        rst     $20

.l1c82  call    $24fb
        bit     6,(iy+$01)
        ret     nz

.l1c8a  rst     $8
        dec     bc

.l1c8c  call    $24fb
        bit     6,(iy+$01)
        ret     z
        jr      l1c8a               ; (-12)
        bit     7,(iy+$01)
        res     0,(iy+$02)
        call    nz,$0d4d
        pop     af
        ld      a,(T_ADDR)
        sub     $13
        call    $21fc
        call    $1bee
        ld      hl,(ATTR_T)
        ld      (ATTR_P),hl
        ld      hl,P_FLAG
        ld      a,(hl)

.l1cb7  rlca
        xor     (hl)
        and     $aa
        xor     (hl)
        ld      (hl),a
        ret     
        call    $2530
        jr      z,l1cd6             ; (19)
        res     0,(iy+$02)
        call    $0d4d
        ld      hl,MASK_T
        ld      a,(hl)
        or      $f8
        ld      (hl),a
        res     6,(iy+$57)
        rst     $18

.l1cd6  call    $21e2
        jr      l1c7a               ; (-97)
        jp      $0605

.l1cde  cp      $0d
        jr      z,l1ce6             ; (4)
        cp      $3a
        jr      nz,l1c82            ; (-100)

.l1ce6  call    $2530
        ret     z
        rst     $28

.l1ceb  and     b
        jr      c,l1cb7             ; (-55)
        rst     $8
        ex      af,af'
        pop     bc
        call    $2530
        jr      z,l1d00             ; (10)
        rst     $28
        ld      (bc),a
        defb    $38
        defb    -21
        call    $34e9
        jp      c,$1bb3

.l1d00  jp      $1b29
        cp      $cd
        jr      nz,l1d10            ; (9)
        rst     $20
        call    $1c82
        call    $1bee
        defb    $18
        defb    6

.l1d10  call    $1bee
        rst     $28
        and     c
        defb    $38
        defb    -17
        ret     nz
        ld      (bc),a
        ld      bc,$01e0
        jr      c,l1ceb             ; (-51)
        rst     $38
        ld      hl,($6822)
        ld      e,h
        dec     hl
        ld      a,(hl)
        set     7,(hl)
        ld      bc,$0006
        add     hl,bc
        rlca    
        jr      c,l1d34             ; (6)
        ld      c,$0d
        call    $1655
        inc     hl

.l1d34  push    hl
        rst     $28
        ld      (bc),a
        ld      (bc),a
        defb    $38
        defb    -31
        ex      de,hl
        ld      c,$0a
        ldir    
        ld      hl,(PPC)
        ex      de,hl
        ld      (hl),e
        inc     hl
        ld      (hl),d
        ld      d,(iy+$0d)
        inc     d
        inc     hl
        ld      (hl),d
        call    $1dda
        ret     nc
        ld      b,(iy+$38)
        ld      hl,(PPC)
        ld      (NEWPPC),hl
        ld      a,(SUBPPC)
        neg     
        ld      d,a
        ld      hl,(CH_ADD)
        ld      e,$f3

.l1d64  push    bc
        ld      bc,(NXTLIN)
        call    $1d86
        ld      (NXTLIN),bc
        pop     bc
        jr      c,l1d84             ; (17)
        rst     $20
        or      $20
        cp      b
        jr      z,l1d7c             ; (3)
        rst     $20
        jr      l1d64               ; (-24)

.l1d7c  rst     $20
        ld      a,$01
        sub     d
        ld      (NSPPC),a
        ret     

.l1d84  rst     $8
        ld      de,$fe7e
        ld      a,($1828)

.l1d8b  inc     hl
        ld      a,(hl)
        and     $c0

.l1d8f  scf
        ret     nz
        ld      b,(hl)

.l1d92  inc     hl
        ld      c,(hl)
        ld      (NEWPPC),bc
        inc     hl
        ld      c,(hl)
        inc     hl
        ld      b,(hl)
        push    hl
        add     hl,bc
        ld      b,h
        ld      c,l
        pop     hl
        ld      d,$00
        push    bc
        call    $198b
        pop     bc
        ret     nc
        jr      l1d8b               ; (-32)
        bit     1,(iy+$37)
        jp      nz,$1c2e
        ld      hl,(DEST)
        bit     7,(hl)
        jr      z,l1dd8             ; (31)
        inc     hl
        ld      (MEM),hl
        rst     $28
        ret     po
        jp      po,$c00f
        ld      (bc),a
        jr      c,l1d92             ; (-51)
        jp      c,$d81d
        ld      hl,(MEM)
        ld      de,$000f
        add     hl,de
        ld      e,(hl)
        inc     hl
        ld      d,(hl)
        inc     hl
        ld      h,(hl)
        ex      de,hl
        jp      $1e73

.l1dd8  rst     $8
        nop     

.l1dda  rst     $28
        pop     hl
        ret     po
        jp      po,$0036
        ld      (bc),a
        ld      bc,$3703
        nop     
        inc     b
        jr      c,l1d8f             ; (-89)
        ret
        defb    $38
        defb    55
        ret     

.l1dec  rst     $20
        call    $1c1f
        call    $2530
        jr      z,l1e1e             ; (41)
        rst     $18
        ld      (X_PTR),hl
        ld      hl,(DATADD)
        ld      a,(hl)
        cp      $2c
        jr      z,l1e0a             ; (9)
        ld      e,$e4
        call    $1d86
        jr      nc,l1e0a            ; (2)
        rst     $8
        dec     c

.l1e0a  call    $0077
        call    $1c56
        rst     $18
        ld      (DATADD),hl
        ld      hl,(X_PTR)
        ld      (iy+$26),$00
        call    $0078

.l1e1e  rst     $18
        cp      $2c
        jr      z,l1dec             ; (-55)
        call    $1bee
        ret     
        call    $2530
        jr      nz,l1e37            ; (11)

.l1e2c  call    $24fb
        cp      $2c
        call    nz,$1bee
        rst     $20
        jr      l1e2c               ; (-11)

.l1e37  ld      a,$e4

.l1e39  ld      b,a
        cpdr    
        ld      de,$0200
        jp      $198b
        call    $1e99

.l1e45  ld      h,b
        ld      l,c
        call    $196e
        dec     hl
        ld      (DATADD),hl
        ret     
        call    $1e99
        ld      a,b
        or      c
        jr      nz,l1e5a            ; (4)
        ld      bc,(FRAMES)

.l1e5a  ld      (SEED),bc
        ret     
        ld      hl,(OLDPPC)
        ld      d,(iy+$36)
        jr      l1e73               ; (12)

.l1e67  call    $1e99
        ld      h,b
        ld      l,c
        ld      d,$00
        ld      a,h
        cp      $f0
        jr      nc,l1e9f            ; (44)

.l1e73  ld      (NEWPPC),hl
        ld      (iy+$0a),d
        ret     
        call    $1e85
        out     (c),a
        ret     
        call    $1e85
        ld      (bc),a
        ret     

.l1e85  call    $2dd5
        jr      c,l1e9f             ; (21)
        jr      z,l1e8e             ; (2)
        neg     

.l1e8e  push    af
        call    $1e99
        pop     af
        ret     

.l1e94  call    $2dd5
        jr      l1e9c               ; (3)

.l1e99  call    $2da2

.l1e9c  jr      c,l1e9f             ; (1)
        ret     z

.l1e9f  rst     $8
        ld      a,(bc)
        call    $1e67
        ld      bc,$0000
        call    $1e45
        jr      l1eaf               ; (3)
        call    $1e99

.l1eaf  ld      a,b
        or      c
        jr      nz,l1eb7            ; (4)
        ld      bc,(RAMTOP)

.l1eb7  push    bc
        ld      de,(VARS)
        ld      hl,(E_LINE)
        dec     hl
        call    $19e5
        call    $0d6b
        ld      hl,(STKEND)
        ld      de,$0032
        add     hl,de
        pop     de
        sbc     hl,de
        jr      nc,l1eda            ; (8)
        ld      hl,(P_RAMT)
        and     a
        sbc     hl,de
        jr      nc,l1edc            ; (2)

.l1eda  rst     $8
        dec     d

.l1edc  ex      de,hl
        ld      (RAMTOP),hl
        pop     de
        pop     bc
        ld      (hl),$3e
        dec     hl
        ld      sp,hl
        push    bc
        ld      (ERR_SP),sp
        ex      de,hl
        jp      (hl)
        pop     de
        ld      h,(iy+$0d)
        inc     h
        ex      (sp),hl
        inc     sp
        ld      bc,(PPC)
        push    bc
        push    hl
        ld      (ERR_SP),sp
        push    de
        call    $1e67
        ld      bc,$0014

.l1f05  ld      hl,(STKEND)
        add     hl,bc
        jr      c,l1f15             ; (10)
        ex      de,hl
        ld      hl,$0050
        add     hl,de
        jr      c,l1f15             ; (3)
        sbc     hl,sp
        ret     c

.l1f15  ld      l,$03
        jp      $0055
        ld      bc,$0000
        call    $1f05
        ld      b,h
        ld      c,l
        ret     
        pop     bc
        pop     hl
        pop     de
        ld      a,d
        cp      $3e
        jr      z,l1f36             ; (11)
        dec     sp
        ex      (sp),hl
        ex      de,hl
        ld      (ERR_SP),sp
        push    bc
        jp      $1e73

.l1f36  push    de
        push    hl
        rst     $8
        ld      b,$cd
        sbc     a,c
        ld      e,$76
        dec     bc
        ld      a,b
        or      c
        jr      z,l1f4f             ; (12)
        ld      a,b
        and     c
        inc     a
        jr      nz,l1f49            ; (1)
        inc     bc

.l1f49  bit     5,(iy+$01)
        defb    $28
        defb    -18

.l1f4f  res     5,(iy+$01)
        ret     

.l1f54  ld      a,$7f
        in      a,($fe)
        rra     
        ret     c
        ld      a,$fe
        in      a,($fe)
        rra     
        ret     
        call    $2530
        jr      z,l1f6a             ; (5)
        ld      a,$ce
        jp      $1e39

.l1f6a  set     6,(iy+$01)
        call    $2c8d
        jr      nc,l1f89            ; (22)
        rst     $20
        cp      $24
        jr      nz,l1f7d            ; (5)
        res     6,(iy+$01)
        rst     $20

.l1f7d  cp      $28
        jr      nz,l1fbd            ; (60)
        rst     $20
        cp      $29
        jr      z,l1fa6             ; (32)

.l1f86  call    $2c8d

.l1f89  jp      nc,$1c8a
        ex      de,hl
        rst     $20
        cp      $24
        jr      nz,l1f94            ; (2)
        ex      de,hl
        rst     $20

.l1f94  ex      de,hl
        ld      bc,$0006
        call    $1655
        inc     hl
        inc     hl
        ld      (hl),$0e
        cp      $2c
        jr      nz,l1fa6            ; (3)
        rst     $20
        jr      l1f86               ; (-32)

.l1fa6  cp      $29
        jr      nz,l1fbd            ; (19)
        rst     $20
        cp      $3d
        jr      nz,l1fbd            ; (14)
        rst     $20
        ld      a,(FLAGS)
        push    af
        call    $24fb
        pop     af
        xor     (iy+$01)
        and     $40

.l1fbd  jp      nz,$1c8a
        call    $1bee

.l1fc3  call    $2530
        pop     hl
        ret     z
        jp      (hl)
        ld      a,$03
        jr      l1fcf               ; (2)
        ld      a,$02

.l1fcf  call    $2530
        call    nz,$1601
        call    $0d4d
        call    $1fdf
        call    $1bee
        ret     

.l1fdf  rst     $18
        call    $2045
        jr      z,l1ff2             ; (13)

.l1fe5  call    $204e
        jr      z,l1fe5             ; (-5)
        call    $1ffc
        call    $204e
        jr      z,l1fe5             ; (-13)

.l1ff2  cp      $29
        ret     z

.l1ff5  call    $1fc3
        ld      a,$0d
        rst     $10
        ret     

.l1ffc  rst     $18
        cp      $ac
        jr      nz,l200e            ; (13)
        call    $1c79
        call    $1fc3
        call    $2307
        ld      a,$16
        jr      l201e               ; (16)

.l200e  cp      $ad
        jr      nz,l2024            ; (18)
        rst     $20
        call    $1c82
        call    $1fc3
        call    $1e99
        ld      a,$17

.l201e  rst     $10
        ld      a,c
        rst     $10
        ld      a,b
        rst     $10
        ret     

.l2024  call    $21f2
        ret     nc
        call    $2070
        ret     nc
        call    $24fb
        call    $1fc3
        bit     6,(iy+$01)
        call    z,$2bf1
        jp      nz,$2de3

.l203c  ld      a,b
        or      c
        dec     bc
        ret     z
        ld      a,(de)
        inc     de
        rst     $10
        jr      l203c               ; (-9)

.l2045  cp      $29
        ret     z

.l2048  cp      $0d
        ret     z
        cp      $3a
        ret     

.l204e  rst     $18
        cp      $3b
        jr      z,l2067             ; (20)
        cp      $2c
        jr      nz,l2061            ; (10)
        call    $2530
        jr      z,l2067             ; (11)
        ld      a,$06
        rst     $10
        jr      l2067               ; (6)

.l2061  cp      $27
        ret     nz
        call    $1ff5

.l2067  rst     $20
        call    $2045
        jr      nz,l206e            ; (1)
        pop     bc

.l206e  cp      a
        ret     

.l2070  cp      $23
        scf     
        ret     nz
        rst     $20
        call    $1c82
        and     a
        call    $1fc3
        call    $1e94
        cp      $10
        jp      nc,$160e
        call    $1601
        and     a
        ret     
        call    $2530
        jr      z,l2096             ; (8)
        ld      a,$01
        call    $1601
        call    $0d6e

.l2096  ld      (iy+$02),$01
        call    $20c1
        call    $1bee
        ld      bc,(S_POSN)
        ld      a,(DF_SZ)
        cp      b
        jr      c,l20ad             ; (3)
        ld      c,$21
        ld      b,a

.l20ad  ld      (S_POSN),bc
        ld      a,$19
        sub     b
        ld      (SCR_CT),a
        res     0,(iy+$02)
        call    $0dd9
        jp      $0d6e

.l20c1  call    $204e
        jr      z,l20c1             ; (-5)
        cp      $28
        jr      nz,l20d8            ; (14)
        rst     $20
        call    $1fdf
        rst     $18
        cp      $29
        jp      nz,$1c8a
        rst     $20
        jp      $21b2

.l20d8  cp      $ca
        jr      nz,l20ed            ; (17)
        rst     $20
        call    $1c1f
        set     7,(iy+$37)
        bit     6,(iy+$01)
        jp      nz,$1c8a
        jr      l20fa               ; (13)

.l20ed  call    $2c8d
        jp      nc,$21af
        call    $1c1f
        res     7,(iy+$37)

.l20fa  call    $2530
        jp      z,$21b2
        call    $16bf
        ld      hl,FLAGX
        res     6,(hl)
        set     5,(hl)
        ld      bc,$0001
        bit     7,(hl)
        jr      nz,l211c            ; (11)
        ld      a,(FLAGS)
        and     $40
        jr      nz,l211a            ; (2)
        ld      c,$03

.l211a  or      (hl)
        ld      (hl),a

.l211c  rst     $30
        ld      (hl),$0d
        ld      a,c
        rrca    
        rrca    
        jr      nc,l2129            ; (5)
        ld      a,$22
        ld      (de),a
        dec     hl
        ld      (hl),a

.l2129  ld      (K_CUR),hl
        bit     7,(iy+$37)
        jr      nz,l215e            ; (44)
        ld      hl,(CH_ADD)
        push    hl
        ld      hl,(ERR_SP)
        push    hl
        ld      hl,$213a
        push    hl
        bit     4,(iy+$30)
        jr      z,l2148             ; (4)
        ld      (ERR_SP),sp

.l2148  ld      hl,(WORKSP)
        call    $11a7
        ld      (iy+$00),$ff
        call    $0f2c
        res     7,(iy+$01)
        call    $21b9
        jr      l2161               ; (3)

.l215e  call    $0f2c

.l2161  ld      (iy+$22),$00
        call    $21d6
        jr      nz,l2174            ; (10)
        call    $111d
        ld      bc,(ECHO_E)
        call    $0dd9

.l2174  ld      hl,FLAGX
        res     5,(hl)
        bit     7,(hl)
        res     7,(hl)
        jr      nz,l219b            ; (28)
        pop     hl
        pop     hl
        ld      (ERR_SP),hl
        pop     hl
        ld      (X_PTR),hl
        set     7,(iy+$01)
        call    $21b9
        ld      hl,(X_PTR)
        ld      (iy+$26),$00
        ld      (CH_ADD),hl
        jr      l21b2               ; (23)

.l219b  ld      hl,(STKBOT)
        ld      de,(WORKSP)
        scf     
        sbc     hl,de
        ld      b,h
        ld      c,l
        call    $2ab2
        call    $2aff
        jr      l21b2               ; (3)

.l21af  call    $1ffc

.l21b2  call    $204e
        jp      z,$20c1
        ret     

.l21b9  ld      hl,(WORKSP)
        ld      (CH_ADD),hl
        rst     $18
        cp      $e2
        jr      z,l21d0             ; (12)
        ld      a,(FLAGX)
        call    $1c59
        rst     $18
        cp      $0d
        ret     z
        rst     $8
        dec     bc

.l21d0  call    $2530
        ret     z
        rst     $8
        djnz    $2201               ; (42)
        ld      d,c
        ld      e,h
        inc     hl
        inc     hl
        inc     hl
        inc     hl
        ld      a,(hl)
        cp      $4b
        ret     

.l21e1  rst     $20

.l21e2  call    $21f2
        ret     c
        rst     $18
        cp      $2c
        jr      z,l21e1             ; (-10)
        cp      $3b
        jr      z,l21e1             ; (-14)
        jp      $1c8a

.l21f2  cp      $d9
        ret     c
        cp      $df
        ccf     
        ret     c
        push    af
        rst     $20
        pop     af

.l21fc  sub     $c9
        push    af
        call    $1c82
        pop     af
        and     a
        call    $1fc3
        push    af
        call    $1e94
        ld      d,a
        pop     af
        rst     $10
        ld      a,d
        rst     $10
        ret     

.l2211  sub     $11
        adc     a,$00
        jr      z,l2234             ; (29)
        sub     $02
        adc     a,$00
        jr      z,l2273             ; (86)
        cp      $01
        ld      a,d
        ld      b,$01
        jr      nz,l2228            ; (4)
        rlca    
        rlca    
        ld      b,$04

.l2228  ld      c,a
        ld      a,d
        cp      $02
        jr      nc,l2244            ; (22)
        ld      a,c
        ld      hl,P_FLAG
        jr      l226c               ; (56)

.l2234  ld      a,d
        ld      b,$07
        jr      c,l223e             ; (5)
        rlca    
        rlca    
        rlca    
        ld      b,$38

.l223e  ld      c,a
        ld      a,d
        cp      $0a
        jr      c,l2246             ; (2)

.l2244  rst     $8
        inc     de

.l2246  ld      hl,ATTR_T
        cp      $08
        jr      c,l2258             ; (11)
        ld      a,(hl)
        jr      z,l2257             ; (7)
        or      b
        cpl     
        and     $24
        jr      z,l2257             ; (1)
        ld      a,b

.l2257  ld      c,a

.l2258  ld      a,c
        call    $226c
        ld      a,$07
        cp      d
        sbc     a,a
        call    $226c
        rlca    
        rlca    
        and     $50
        ld      b,a
        ld      a,$08
        cp      d
        sbc     a,a

.l226c  xor     (hl)
        and     b
        xor     (hl)
        ld      (hl),a
        inc     hl
        ld      a,b
        ret     

.l2273  sbc     a,a
        ld      a,d
        rrca    
        ld      b,$80
        jr      nz,l227d            ; (3)
        rrca    
        ld      b,$40

.l227d  ld      c,a
        ld      a,d
        cp      $08
        jr      z,l2287             ; (4)
        cp      $02
        jr      nc,l2244            ; (-67)

.l2287  ld      a,c
        ld      hl,ATTR_T
        call    $226c
        ld      a,c
        rrca    
        rrca    
        rrca    
        jr      l226c               ; (-40)
        call    $1e94
        cp      $08
        jr      nc,l2244            ; (-87)
        out     ($fe),a
        rlca    
        rlca    
        rlca    
        bit     5,a
        jr      nz,l22a6            ; (2)
        xor     $07

.l22a6  ld      (BORDCR),a
        ret     

.l22aa  ld      a,$af
        sub     b
        jp      c,$24f9
        ld      b,a
        and     a
        rra     
        scf     
        rra     
        and     a
        rra     
        xor     b
        and     $f8
        xor     b
        ld      h,a
        ld      a,c
        rlca    
        rlca    
        rlca    
        xor     b
        and     $c7
        xor     b
        rlca    
        rlca    
        ld      l,a
        ld      a,c
        and     $07
        ret     

.l22cb  call    $2307
        call    $22aa
        ld      b,a
        inc     b
        ld      a,(hl)

.l22d4  rlca
        djnz    $22d4               ; (-3)
        and     $01
        jp      $2d28

.l22dc  call    $2307
        call    $22e5
        jp      $0d4d

.l22e5  ld      (COORDS),bc
        call    $22aa
        ld      b,a
        inc     b
        ld      a,$fe

.l22f0  rrca
        djnz    $22f0               ; (-3)
        ld      b,a
        ld      a,(hl)
        ld      c,(iy+$57)
        bit     0,c
        jr      nz,l22fd            ; (1)
        and     b

.l22fd  bit     2,c
        jr      nz,l2303            ; (2)
        xor     b
        cpl     

.l2303  ld      (hl),a
        jp      $0bdb

.l2307  call    $2314
        ld      b,a
        push    bc
        call    $2314
        ld      e,c
        pop     bc
        ld      d,c

.l2312  ld      c,a
        ret     

.l2314  call    $2dd5
        jp      c,$24f9
        ld      c,$01
        ret     z
        ld      c,$ff
        ret     
        rst     $18
        cp      $2c
        jp      nz,$1c8a
        rst     $20
        call    $1c82
        call    $1bee
        rst     $28
        ld      hl,($383d)
        ld      a,(hl)
        cp      $81
        jr      nc,l233b            ; (5)
        rst     $28
        ld      (bc),a
        jr      c,l2352             ; (24)
        and     c

.l233b  rst     $28
        and     e
        jr      c,l2375             ; (54)
        add     a,e
        rst     $28
        push    bc
        ld      (bc),a
        jr      c,l2312             ; (-51)
        ld      a,l
        inc     h
        push    bc
        rst     $28
        ld      sp,$04e1
        jr      c,l23cc             ; (126)
        cp      $80
        jr      nc,l235a            ; (8)

.l2352  rst     $28
        ld      (bc),a
        ld      (bc),a
        defb    $38
        defb    -63
        jp      $22dc

.l235a  rst     $28
        jp      nz,$c001
        ld      (bc),a
        inc     bc
        ld      bc,$0fe0
        ret     nz

.l2364  ld      bc,$e031
        ld      bc,$e031
        and     b
        pop     bc

.l236c  ld      (bc),a
        jr      c,l236c             ; (-3)
        inc     (hl)
        ld      h,d
        call    $1e94
        ld      l,a

.l2375  push    hl
        call    $1e94
        pop     hl
        ld      h,a
        ld      (COORDS),hl
        pop     bc
        jp      $2420

.l2382  rst     $18
        cp      $2c
        jr      z,l238d             ; (6)
        call    $1bee
        jp      $2477

.l238d  rst     $20
        call    $1c82
        call    $1bee
        rst     $28
        push    bc
        and     d
        inc     b
        rra     
        ld      sp,$3030
        nop     
        ld      b,$02
        jr      c,l2364             ; (-61)
        ld      (hl),a

.l23a2  inc     h
        ret     nz
        ld      (bc),a
        pop     bc
        ld      (bc),a
        ld      sp,$e12a
        ld      bc,$2ae1
        rrca    
        ret     po
        dec     b
        ld      hl,($01e0)
        dec     a
        jr      c,l2434             ; (126)
        cp      $81
        jr      nc,l23c1            ; (7)
        rst     $28
        ld      (bc),a
        ld      (bc),a
        jr      c,l2382             ; (-61)
        ld      (hl),a
        inc     h

.l23c1  call    $247d
        push    bc
        rst     $28
        ld      (bc),a
        pop     hl
        ld      bc,$c105
        ld      (bc),a

.l23cc  ld      bc,$e131
        inc     b
        jp      nz,$0102
        ld      sp,$04e1
        jp      po,$e0e5
        inc     bc
        and     d
        inc     b
        ld      sp,$c51f
        ld      (bc),a
        jr      nz,l23a2            ; (-64)
        ld      (bc),a
        jp      nz,$c102
        push    hl
        inc     b
        ret     po
        jp      po,$0f04
        pop     hl
        ld      bc,$02c1
        ret     po
        inc     b
        jp      po,$04e5
        inc     bc
        jp      nz,$e12a
        ld      hl,($020f)
        defb    $38
        defb    26
        cp      $81
        pop     bc
        jp      c,$2477
        push    bc
        rst     $28
        ld      bc,$3a38
        ld      a,l
        ld      e,h
        call    $2d28
        rst     $28
        ret     nz
        rrca    
        ld      bc,$3a38
        ld      a,(hl)
        ld      e,h
        call    $2d28
        rst     $28
        push    bc
        rrca    
        ret     po
        push    hl
        defb    $38
        defb    -63

.l2420  dec     b
        jr      z,l245f             ; (60)
        jr      l2439               ; (20)

.l2425  rst     $28
        pop     hl

.l2427  ld      sp,$04e3
        jp      po,$04e4
        inc     bc
        pop     bc
        ld      (bc),a
        call    po,$e204
        ex      (sp),hl

.l2434  inc     b
        rrca    
        jp      nz,$3802

.l2439  push    bc
        rst     $28
        ret     nz
        ld      (bc),a
        pop     hl
        rrca    
        ld      sp,$3a38
        ld      a,l
        ld      e,h
        call    $2d28
        rst     $28
        inc     bc
        ret     po
        jp      po,$c00f
        ld      bc,$38e0
        ld      a,(COORDS+1)
        call    $2d28
        rst     $28
        inc     bc

.l2458  jr      c,l2427             ; (-51)
        or      a
        inc     h
        pop     bc
        djnz    $2425               ; (-58)

.l245f  rst     $28
        ld      (bc),a
        ld      (bc),a
        ld      bc,$3a38
        ld      a,l
        ld      e,h
        call    $2d28
        rst     $28
        inc     bc
        ld      bc,$3a38
        ld      a,(hl)
        ld      e,h
        call    $2d28
        rst     $28
        inc     bc
        defb    $38
        defb    -51
        or      a
        inc     h
        jp      $0d4d

.l247d  rst     $28
        ld      sp,$3428
        ld      ($0100),a
        dec     b
        push    hl
        ld      bc,$2a05
        jr      c,l2458             ; (-51)
        push    de
        dec     l
        jr      c,l2495             ; (6)
        and     $fc
        add     a,$04
        jr      nc,l2497            ; (2)

.l2495  ld      a,$fc

.l2497  push    af
        call    $2d28
        rst     $28
        push    hl
        ld      bc,$3105
        rra     
        call    nz,$3102
        and     d
        inc     b
        rra     
        pop     bc
        ld      bc,$02c0
        ld      sp,$3104
        rrca    
        and     c
        inc     bc
        dec     de
        jp      $3802
        pop     bc
        ret     
        call    $2307
        ld      a,c
        cp      b
        jr      nc,l24c4            ; (6)
        ld      l,c
        push    de
        xor     a
        ld      e,a
        jr      l24cb               ; (7)

.l24c4  or      c
        ret     z
        ld      l,b
        ld      b,c
        push    de
        ld      d,$00

.l24cb  ld      h,b
        ld      a,b
        rra     

.l24ce  add     a,l
        jr      c,l24d4             ; (3)
        cp      h
        jr      c,l24db             ; (7)

.l24d4  sub     h
        ld      c,a
        exx     
        pop     bc
        push    bc
        jr      l24df               ; (4)

.l24db  ld      c,a
        push    de
        exx     
        pop     bc

.l24df  ld      hl,(COORDS)
        ld      a,b
        add     a,h
        ld      b,a
        ld      a,c
        inc     a
        add     a,l
        jr      c,l24f7             ; (13)
        jr      z,l24f9             ; (13)

.l24ec  dec     a
        ld      c,a
        call    $22e5
        exx     
        ld      a,c
        djnz    $24ce               ; (-39)
        pop     de
        ret     

.l24f7  jr      z,l24ec             ; (-13)

.l24f9  rst     $8
        ld      a,(bc)

.l24fb  rst     $18
        ld      b,$00
        push    bc

.l24ff  ld      c,a
        ld      hl,$2596
        call    $16dc
        ld      a,c
        jp      nc,$2684
        ld      b,$00
        ld      c,(hl)
        add     hl,bc
        jp      (hl)

.l250f  call    $0074
        inc     bc
        cp      $0d
        jp      z,$1c8a
        cp      $22
        jr      nz,l250f            ; (-13)
        call    $0074
        cp      $22
        ret     

.l2522  rst     $20
        cp      $28
        jr      nz,l252d            ; (6)
        call    $1c79
        rst     $18
        cp      $29

.l252d  jp      nz,$1c8a

.l2530  bit     7,(iy+$01)
        ret     

.l2535  call    $2307
        ld      hl,(CHARS)
        ld      de,$0100
        add     hl,de
        ld      a,c
        rrca    
        rrca    
        rrca    
        and     $e0
        xor     b
        ld      e,a
        ld      a,c
        and     $18
        xor     $40
        ld      d,a
        ld      b,$60

.l254f  push    bc
        push    de
        push    hl
        ld      a,(de)
        xor     (hl)
        jr      z,l255a             ; (4)
        inc     a
        jr      nz,l2573            ; (26)
        dec     a

.l255a  ld      c,a
        ld      b,$07

.l255d  inc     d
        inc     hl
        ld      a,(de)
        xor     (hl)
        xor     c
        jr      nz,l2573            ; (15)
        djnz    $255d               ; (-9)
        pop     bc
        pop     bc
        pop     bc
        ld      a,$80
        sub     b
        ld      bc,$0001
        rst     $30
        ld      (de),a
        jr      l257d               ; (10)

.l2573  pop     hl
        ld      de,$0008
        add     hl,de
        pop     de
        pop     bc
        djnz    $254f               ; (-45)
        ld      c,b

.l257d  jp      $2ab2

.l2580  call    $2307
        ld      a,c
        rrca    
        rrca    
        rrca    
        ld      c,a
        and     $e0
        xor     b
        ld      l,a
        ld      a,c
        and     $03
        xor     $58
        ld      h,a
        ld      a,(hl)
        jp      $2d28
        ld      ($281c),hl
        ld      c,a
        ld      l,$f2
        dec     hl
        ld      (de),a
        xor     b
        ld      d,(hl)
        and     l
        ld      d,a
        and     a
        add     a,h
        and     (hl)
        adc     a,a
        call    nz,$aae6
        cp      a
        xor     e
        rst     $0
        xor     c
        adc     a,$00
        rst     $20
        jp      $24ff
        rst     $18
        inc     hl
        push    hl
        ld      bc,$0000
        call    $250f
        jr      nz,l25d9            ; (27)

.l25be  call    $250f
        jr      z,l25be             ; (-5)
        call    $2530
        jr      z,l25d9             ; (17)
        rst     $30
        pop     hl
        push    de

.l25cb  ld      a,(hl)
        inc     hl
        ld      (de),a
        inc     de
        cp      $22
        jr      nz,l25cb            ; (-8)
        ld      a,(hl)
        inc     hl
        cp      $22
        jr      z,l25cb             ; (-14)

.l25d9  dec     bc
        pop     de

.l25db  ld      hl,FLAGS
        res     6,(hl)
        bit     7,(hl)
        call    nz,$2ab2
        jp      $2712
        rst     $20
        call    $24fb
        cp      $29
        jp      nz,$1c8a
        rst     $20
        jp      $2712
        jp      $27bd
        call    $2530
        jr      z,l2625             ; (40)
        ld      bc,(SEED)
        call    $2d2b
        rst     $28
        and     c
        rrca    
        inc     (hl)
        scf     
        ld      d,$04
        inc     (hl)
        add     a,b
        ld      b,c
        nop     
        nop     
        add     a,b
        ld      ($a102),a
        inc     bc
        ld      sp,$cd38
        and     d
        dec     l
        ld      (SEED),bc
        ld      a,(hl)
        and     a
        jr      z,l2625             ; (3)
        sub     $10
        ld      (hl),a

.l2625  jr      l2630               ; (9)
        call    $2530
        jr      z,l2630             ; (4)
        rst     $28
        and     e
        defb    $38
        defb    52

.l2630  rst     $20
        jp      $26c3
        ld      bc,$105a
        rst     $20
        cp      $23
        jp      z,$270d
        ld      hl,FLAGS
        res     6,(hl)
        bit     7,(hl)
        jr      z,l2665             ; (31)
        jp      $3a5a
        ld      c,$00
        jr      nz,l2660            ; (19)
        call    $031e
        jr      nc,l2660            ; (14)
        dec     d
        ld      e,a
        call    $0333

.l2657  push    af
        ld      bc,$0001
        rst     $30
        pop     af
        ld      (de),a
        ld      c,$01

.l2660  ld      b,$00
        call    $2ab2

.l2665  jp      $2712
        call    $2522
        call    nz,$2535
        rst     $20
        jp      $25db
        call    $2522
        call    nz,$2580
        rst     $20
        jr      l26c3               ; (72)
        call    $2522
        call    nz,$22cb
        rst     $20
        jr      l26c3               ; (63)

.l2684  call    $2c88
        jr      nc,l26df            ; (86)
        cp      $41
        jr      nc,l26c9            ; (60)
        call    $2530
        jr      nz,l26b5            ; (35)
        call    $2c9b
        rst     $18
        ld      bc,$0006
        call    $1655
        inc     hl
        ld      (hl),$0e
        inc     hl
        ex      de,hl
        ld      hl,(STKEND)
        ld      c,$05
        and     a
        sbc     hl,bc
        ld      (STKEND),hl
        ldir    
        ex      de,hl
        dec     hl
        call    $0077
        jr      l26c3               ; (14)

.l26b5  rst     $18

.l26b6  inc     hl
        ld      a,(hl)
        cp      $0e
        jr      nz,l26b6            ; (-6)
        inc     hl
        call    $33b4
        ld      (CH_ADD),hl

.l26c3  set     6,(iy+$01)
        jr      l26dd               ; (20)

.l26c9  call    $28b2
        jp      c,$1c2e
        call    z,$2996
        ld      a,(FLAGS)
        cp      $c0
        jr      c,l26dd             ; (4)
        inc     hl
        call    $33b4

.l26dd  jr      l2712               ; (51)

.l26df  ld      bc,$09db
        cp      $2d
        jr      z,l270d             ; (39)
        ld      bc,$1018
        cp      $ae
        jr      z,l270d             ; (32)
        sub     $af
        jp      c,$1c8a
        ld      bc,$04f0
        cp      $14
        jr      z,l270d             ; (20)
        jp      nc,$1c8a
        ld      b,$10
        add     a,$dc
        ld      c,a
        cp      $df
        jr      nc,l2707            ; (2)
        res     6,c

.l2707  cp      $ee
        jr      c,l270d             ; (2)
        res     7,c

.l270d  push    bc
        rst     $20
        jp      $24ff

.l2712  rst     $18

.l2713  cp      $28
        jr      nz,l2723            ; (12)
        bit     6,(iy+$01)
        jr      nz,l2734            ; (23)
        call    $2a52
        rst     $20
        jr      l2713               ; (-16)

.l2723  ld      b,$00
        ld      c,a
        ld      hl,$2795
        call    $16dc
        jr      nc,l2734            ; (6)
        ld      c,(hl)
        ld      hl,$26ed
        add     hl,bc
        ld      b,(hl)

.l2734  pop     de
        ld      a,d
        cp      b
        jr      c,l2773             ; (58)
        and     a
        jp      z,$0018
        push    bc
        ld      hl,FLAGS
        ld      a,e
        cp      $ed
        jr      nz,l274c            ; (6)
        bit     6,(hl)
        jr      nz,l274c            ; (2)
        ld      e,$99

.l274c  push    de
        call    $2530
        jr      z,l275b             ; (9)
        ld      a,e
        and     $3f
        ld      b,a
        rst     $28
        dec     sp
        defb    $38
        defb    24
        add     hl,bc

.l275b  ld      a,e
        xor     (iy+$01)
        and     $40

.l2761  jp      nz,$1c8a
        pop     de
        ld      hl,FLAGS
        set     6,(hl)
        bit     7,e
        jr      nz,l2770            ; (2)
        res     6,(hl)

.l2770  pop     bc
        jr      l2734               ; (-63)

.l2773  push    de
        ld      a,c
        bit     6,(iy+$01)
        jr      nz,l2790            ; (21)
        and     $3f
        add     a,$08
        ld      c,a
        cp      $10
        jr      nz,l2788            ; (4)
        set     6,c
        jr      l2790               ; (8)

.l2788  jr      c,l2761             ; (-41)
        cp      $17
        jr      z,l2790             ; (2)
        set     7,c

.l2790  push    bc
        rst     $20
        jp      $24ff
        dec     hl
        rst     $8
        dec     l
        jp      $c42a
        cpl     
        push    bc
        ld      e,(hl)
        add     a,$3d
        adc     a,$3e
        call    z,$cd3c
        rst     $0
        ret     
        ret     z
        jp      z,$cbc9
        push    bc
        rst     $0
        add     a,$c8
        nop     
        ld      b,$08
        ex      af,af'
        ld      a,(bc)
        ld      (bc),a
        inc     bc
        dec     b
        dec     b
        dec     b
        dec     b
        dec     b
        dec     b
        ld      b,$cd
        defb    $30
        defb    37
        jr      nz,l27f7            ; (53)
        rst     $20
        call    $2c8d
        jp      nc,$1c8a
        rst     $20
        cp      $24
        push    af
        jr      nz,l27d0            ; (1)
        rst     $20

.l27d0  cp      $28
        jr      nz,l27e6            ; (18)
        rst     $20
        cp      $29
        jr      z,l27e9             ; (16)

.l27d9  call    $24fb
        rst     $18
        cp      $2c
        jr      nz,l27e4            ; (3)
        rst     $20
        jr      l27d9               ; (-11)

.l27e4  cp      $29

.l27e6  jp      nz,$1c8a

.l27e9  rst     $20
        ld      hl,FLAGS
        res     6,(hl)
        pop     af
        jr      z,l27f4             ; (2)
        set     6,(hl)

.l27f4  jp      $2712

.l27f7  rst     $20
        and     $df

.l27fa  ld      b,a
        rst     $20
        sub     $24
        ld      c,a
        jr      nz,l2802            ; (1)
        rst     $20

.l2802  rst     $20
        push    hl
        ld      hl,(PROG)
        dec     hl

.l2808  ld      de,$00ce
        push    bc
        call    $1d86
        pop     bc
        defb    $30
        defb    2
        rst     $8
        jr      l27fa               ; (-27)
        call    $28ab
        and     $df
        cp      b
        jr      nz,l2825            ; (8)
        call    $28ab
        sub     $24
        cp      c
        jr      z,l2831             ; (12)

.l2825  pop     hl
        dec     hl
        ld      de,$0200
        push    bc
        call    $198b
        pop     bc
        jr      l2808               ; (-41)

.l2831  and     a
        call    z,$28ab
        pop     de
        pop     de
        ld      (CH_ADD),de
        call    $28ab
        push    hl
        cp      $29
        jr      z,l2885             ; (66)

.l2843  inc     hl
        ld      a,(hl)
        cp      $0e
        ld      d,$40
        jr      z,l2852             ; (7)
        dec     hl
        call    $28ab
        inc     hl
        ld      d,$00

.l2852  inc     hl
        push    hl
        push    de
        call    $24fb
        pop     af
        xor     (iy+$01)
        and     $40
        jr      nz,l288b            ; (43)
        pop     hl
        ex      de,hl
        ld      hl,(STKEND)
        ld      bc,$0005
        sbc     hl,bc
        ld      (STKEND),hl
        ldir    
        ex      de,hl
        dec     hl
        call    $28ab
        cp      $29
        jr      z,l2885             ; (13)
        push    hl
        rst     $18
        cp      $2c
        jr      nz,l288b            ; (13)
        rst     $20
        pop     hl
        call    $28ab
        jr      l2843               ; (-66)

.l2885  push    hl
        rst     $18
        cp      $29
        jr      z,l288d             ; (2)

.l288b  rst     $8
        add     hl,de

.l288d  pop     de
        ex      de,hl
        ld      (CH_ADD),hl
        ld      hl,(DEFADD)
        ex      (sp),hl
        ld      (DEFADD),hl
        push    de
        rst     $20
        rst     $20
        call    $24fb
        pop     hl
        ld      (CH_ADD),hl
        pop     hl
        ld      (DEFADD),hl
        rst     $20
        jp      $2712

.l28ab  inc     hl
        ld      a,(hl)
        cp      $21
        jr      c,l28ab             ; (-6)
        ret     

.l28b2  set     6,(iy+$01)
        rst     $18
        call    $2c8d
        jp      nc,$1c8a
        push    hl
        and     $1f
        ld      c,a
        rst     $20
        push    hl
        cp      $28
        jr      z,l28ef             ; (40)
        set     6,c
        cp      $24
        jr      z,l28de             ; (17)
        set     5,c
        call    $2c88
        jr      nc,l28e3            ; (15)

.l28d4  call    $2c88
        jr      nc,l28ef            ; (22)
        res     6,c
        rst     $20
        jr      l28d4               ; (-10)

.l28de  rst     $20
        res     6,(iy+$01)

.l28e3  ld      a,(DEFADD+1)
        and     a
        jr      z,l28ef             ; (6)
        call    $2530
        jp      nz,$2951

.l28ef  ld      b,c
        call    $2530
        jr      nz,l28fd            ; (8)
        ld      a,c
        and     $e0
        set     7,a
        ld      c,a
        jr      l2934               ; (55)

.l28fd  ld      hl,(VARS)

.l2900  ld      a,(hl)
        and     $7f
        jr      z,l2932             ; (45)
        cp      c
        jr      nz,l292a            ; (34)
        rla     
        add     a,a
        jp      p,$293f
        jr      c,l293f             ; (48)
        pop     de
        push    de
        push    hl

.l2912  inc     hl

.l2913  ld      a,(de)
        inc     de
        cp      $20
        jr      z,l2913             ; (-6)
        or      $20
        cp      (hl)
        jr      z,l2912             ; (-12)
        or      $80
        cp      (hl)
        jr      nz,l2929            ; (6)
        ld      a,(de)
        call    $2c88
        jr      nc,l293e            ; (21)

.l2929  pop     hl

.l292a  push    bc
        call    $19b8
        ex      de,hl
        pop     bc
        jr      l2900               ; (-50)

.l2932  set     7,b

.l2934  pop     de
        rst     $18
        cp      $28
        jr      z,l2943             ; (9)
        set     5,b
        jr      l294b               ; (13)

.l293e  pop     de

.l293f  pop     de
        pop     de
        push    hl
        rst     $18

.l2943  call    $2c88
        jr      nc,l294b            ; (3)
        rst     $20
        jr      l2943               ; (-8)

.l294b  pop     hl
        rl      b
        bit     6,b
        ret     

.l2951  ld      hl,(DEFADD)
        ld      a,(hl)
        cp      $29
        jp      z,$28ef

.l295a  ld      a,(hl)
        or      $60
        ld      b,a
        inc     hl
        ld      a,(hl)
        cp      $0e
        jr      z,l296b             ; (7)
        dec     hl
        call    $28ab
        inc     hl
        res     5,b

.l296b  ld      a,b
        cp      c
        jr      z,l2981             ; (18)
        inc     hl
        inc     hl
        inc     hl
        inc     hl
        inc     hl
        call    $28ab
        cp      $29
        jp      z,$28ef
        call    $28ab
        jr      l295a               ; (-39)

.l2981  bit     5,c
        jr      nz,l2991            ; (12)
        inc     hl
        ld      de,(STKEND)
        call    $33c0
        ex      de,hl
        ld      (STKEND),hl

.l2991  pop     de
        pop     de
        xor     a
        inc     a
        ret     

.l2996  xor     a
        ld      b,a
        bit     7,c
        jr      nz,l29e7            ; (75)
        bit     7,(hl)
        jr      nz,l29ae            ; (14)
        inc     a

.l29a1  inc     hl
        ld      c,(hl)
        inc     hl
        ld      b,(hl)
        inc     hl
        ex      de,hl
        call    $2ab2
        rst     $18
        jp      $2a49

.l29ae  inc     hl
        inc     hl
        inc     hl
        ld      b,(hl)
        bit     6,c
        jr      z,l29c0             ; (10)
        dec     b
        jr      z,l29a1             ; (-24)
        ex      de,hl
        rst     $18
        cp      $28
        jr      nz,l2a20            ; (97)
        ex      de,hl

.l29c0  ex      de,hl
        jr      l29e7               ; (36)

.l29c3  push    hl
        rst     $18
        pop     hl
        cp      $2c
        jr      z,l29ea             ; (32)
        bit     7,c
        jr      z,l2a20             ; (82)
        bit     6,c
        jr      nz,l29d8            ; (6)
        cp      $29
        jr      nz,l2a12            ; (60)
        rst     $20
        ret     

.l29d8  cp      $29
        jr      z,l2a48             ; (108)
        cp      $cc
        jr      nz,l2a12            ; (50)

.l29e0  rst     $18
        dec     hl
        ld      (CH_ADD),hl
        jr      l2a45               ; (94)

.l29e7  ld      hl,$0000

.l29ea  push    hl
        rst     $20
        pop     hl
        ld      a,c
        cp      $c0
        jr      nz,l29fb            ; (9)
        rst     $18
        cp      $29
        jr      z,l2a48             ; (81)
        cp      $cc
        jr      z,l29e0             ; (-27)

.l29fb  push    bc
        push    hl
        call    $2aee
        ex      (sp),hl
        ex      de,hl
        call    $2acc
        jr      c,l2a20             ; (25)
        dec     bc
        call    $2af4
        add     hl,bc
        pop     de
        pop     bc
        djnz    $29c3               ; (-77)
        bit     7,c

.l2a12  jr      nz,l2a7a            ; (102)
        push    hl
        bit     6,c
        jr      nz,l2a2c            ; (19)
        ld      b,d
        ld      c,e
        rst     $18
        cp      $29
        jr      z,l2a22             ; (2)

.l2a20  rst     $8
        ld      (bc),a

.l2a22  rst     $20
        pop     hl
        ld      de,$0005
        call    $2af4
        add     hl,bc
        ret     

.l2a2c  call    $2aee
        ex      (sp),hl
        call    $2af4
        pop     bc
        add     hl,bc
        inc     hl
        ld      b,d
        ld      c,e
        ex      de,hl
        call    $2ab1
        rst     $18
        cp      $29
        jr      z,l2a48             ; (7)
        cp      $2c
        jr      nz,l2a20            ; (-37)

.l2a45  call    $2a52

.l2a48  rst     $20

.l2a49  cp      $28
        jr      z,l2a45             ; (-8)
        res     6,(iy+$01)
        ret     

.l2a52  call    $2530
        call    nz,$2bf1
        rst     $20
        cp      $29
        jr      z,l2aad             ; (80)
        push    de
        xor     a
        push    af
        push    bc
        ld      de,$0001
        rst     $18
        pop     hl
        cp      $cc
        jr      z,l2a81             ; (23)
        pop     af
        call    $2acd
        push    af
        ld      d,b
        ld      e,c
        push    hl
        rst     $18
        pop     hl
        cp      $cc
        jr      z,l2a81             ; (9)
        cp      $29

.l2a7a  jp      nz,$1c8a
        ld      h,d
        ld      l,e
        jr      l2a94               ; (19)

.l2a81  push    hl
        rst     $20
        pop     hl
        cp      $29
        jr      z,l2a94             ; (12)
        pop     af
        call    $2acd
        push    af
        rst     $18
        ld      h,b
        ld      l,c
        cp      $29
        jr      nz,l2a7a            ; (-26)

.l2a94  pop     af
        ex      (sp),hl
        add     hl,de
        dec     hl
        ex      (sp),hl
        and     a
        sbc     hl,de
        ld      bc,$0000
        jr      c,l2aa8             ; (7)
        inc     hl
        and     a
        jp      m,$2a20
        ld      b,h
        ld      c,l

.l2aa8  pop     de
        res     6,(iy+$01)

.l2aad  call    $2530
        ret     z

.l2ab1  xor     a

.l2ab2  res     6,(iy+$01)

.l2ab6  push    bc
        call    $33a9
        pop     bc
        ld      hl,(STKEND)
        ld      (hl),a
        inc     hl
        ld      (hl),e
        inc     hl
        ld      (hl),d
        inc     hl
        ld      (hl),c
        inc     hl
        ld      (hl),b
        inc     hl
        ld      (STKEND),hl
        ret     

.l2acc  xor     a

.l2acd  push    de
        push    hl
        push    af
        call    $1c82
        pop     af
        call    $2530
        jr      z,l2aeb             ; (18)
        push    af
        call    $1e99
        pop     de
        ld      a,b
        or      c
        scf     
        jr      z,l2ae8             ; (5)
        pop     hl
        push    hl
        and     a
        sbc     hl,bc

.l2ae8  ld      a,d
        sbc     a,$00

.l2aeb  pop     hl
        pop     de
        ret     

.l2aee  ex      de,hl
        inc     hl
        ld      e,(hl)
        inc     hl
        ld      d,(hl)
        ret     

.l2af4  call    $2530
        ret     z
        call    $30a9
        jp      c,$1f15
        ret     

.l2aff  ld      hl,(DEST)
        bit     1,(iy+$37)
        jr      z,l2b66             ; (94)
        ld      bc,$0005

.l2b0b  inc     bc

.l2b0c  inc     hl
        ld      a,(hl)
        cp      $20
        jr      z,l2b0c             ; (-6)
        jr      nc,l2b1f            ; (11)
        cp      $10
        jr      c,l2b29             ; (17)
        cp      $16
        jr      nc,l2b29            ; (13)
        inc     hl
        jr      l2b0c               ; (-19)

.l2b1f  call    $2c88
        jr      c,l2b0b             ; (-25)
        cp      $24
        jp      z,$2bc0

.l2b29  ld      a,c
        ld      hl,(E_LINE)
        dec     hl
        call    $1655
        inc     hl
        inc     hl
        ex      de,hl
        push    de
        ld      hl,(DEST)
        dec     de
        sub     $06
        ld      b,a
        jr      z,l2b4f             ; (17)

.l2b3e  inc     hl

.l2b3f  ld      a,(hl)
        cp      $21
        jr      c,l2b3e             ; (-6)
        or      $20
        inc     de
        ld      (de),a
        djnz    $2b3e               ; (-12)
        or      $80
        ld      (de),a
        ld      a,$c0

.l2b4f  ld      hl,(DEST)
        xor     (hl)
        or      $20
        pop     hl
        call    $2bea

.l2b59  push    hl
        rst     $28
        ld      (bc),a
        jr      c,l2b3f             ; (-31)
        ld      bc,$0005
        and     a
        sbc     hl,bc
        jr      l2ba6               ; (64)

.l2b66  bit     6,(iy+$01)
        jr      z,l2b72             ; (6)
        ld      de,$0006
        add     hl,de
        jr      l2b59               ; (-25)

.l2b72  ld      hl,(DEST)
        ld      bc,(STRLEN)
        bit     0,(iy+$37)
        jr      nz,l2baf            ; (48)
        ld      a,b
        or      c
        ret     z
        push    hl
        rst     $30
        push    de
        push    bc
        ld      d,h
        ld      e,l
        inc     hl
        ld      (hl),$20
        lddr    
        push    hl
        call    $2bf1
        pop     hl
        ex      (sp),hl
        and     a
        sbc     hl,bc
        add     hl,bc
        jr      nc,l2b9b            ; (2)
        ld      b,h
        ld      c,l

.l2b9b  ex      (sp),hl
        ex      de,hl
        ld      a,b
        or      c
        jr      z,l2ba3             ; (2)
        ldir    

.l2ba3  pop     bc
        pop     de
        pop     hl

.l2ba6  ex      de,hl
        ld      a,b
        or      c
        ret     z
        push    de
        ldir    
        pop     hl
        ret     

.l2baf  dec     hl
        dec     hl
        dec     hl
        ld      a,(hl)
        push    hl
        push    bc
        call    $2bc6
        pop     bc
        pop     hl
        inc     bc
        inc     bc
        inc     bc
        jp      $19e8

.l2bc0  ld      a,$df
        ld      hl,(DEST)
        and     (hl)

.l2bc6  push    af
        call    $2bf1
        ex      de,hl
        add     hl,bc
        push    bc
        dec     hl
        ld      (DEST),hl
        inc     bc
        inc     bc
        inc     bc
        ld      hl,(E_LINE)
        dec     hl
        call    $1655
        ld      hl,(DEST)
        pop     bc
        push    bc
        inc     bc
        lddr    
        ex      de,hl
        inc     hl
        pop     bc
        ld      (hl),b
        dec     hl
        ld      (hl),c
        pop     af

.l2bea  dec     hl
        ld      (hl),a
        ld      hl,(E_LINE)
        dec     hl
        ret     

.l2bf1  ld      hl,(STKEND)
        dec     hl
        ld      b,(hl)
        dec     hl
        ld      c,(hl)
        dec     hl
        ld      d,(hl)
        dec     hl
        ld      e,(hl)
        dec     hl
        ld      a,(hl)
        ld      (STKEND),hl
        ret     
        call    $28b2

.l2c05  jp      nz,$1c8a
        call    $2530
        jr      nz,l2c15            ; (8)
        res     6,c
        call    $2996
        call    $1bee

.l2c15  jr      c,l2c1f             ; (8)
        push    bc
        call    $19b8
        call    $19e8
        pop     bc

.l2c1f  set     7,c
        ld      b,$00
        push    bc
        ld      hl,$0001
        bit     6,c
        jr      nz,l2c2d            ; (2)
        ld      l,$05

.l2c2d  ex      de,hl

.l2c2e  rst     $20
        ld      h,$ff
        call    $2acc
        jp      c,$2a20
        pop     hl
        push    bc
        inc     h
        push    hl
        ld      h,b
        ld      l,c
        call    $2af4
        ex      de,hl
        rst     $18
        cp      $2c
        jr      z,l2c2e             ; (-24)
        cp      $29
        jr      nz,l2c05            ; (-69)
        rst     $20
        pop     bc
        ld      a,c
        ld      l,b
        ld      h,$00
        inc     hl
        inc     hl
        add     hl,hl
        add     hl,de
        jp      c,$1f15
        push    de
        push    bc
        push    hl
        ld      b,h
        ld      c,l
        ld      hl,(E_LINE)
        dec     hl
        call    $1655
        inc     hl
        ld      (hl),a
        pop     bc
        dec     bc
        dec     bc
        dec     bc
        inc     hl
        ld      (hl),c
        inc     hl
        ld      (hl),b
        pop     bc
        ld      a,b
        inc     hl
        ld      (hl),a
        ld      h,d
        ld      l,e
        dec     de
        ld      (hl),$00
        bit     6,c
        jr      z,l2c7c             ; (2)
        ld      (hl),$20

.l2c7c  pop     bc
        lddr    

.l2c7f  pop     bc
        ld      (hl),b
        dec     hl
        ld      (hl),c
        dec     hl
        dec     a
        jr      nz,l2c7f            ; (-8)
        ret     

.l2c88  call    $2d1b
        ccf     
        ret     c

.l2c8d  cp      $41
        ccf     
        ret     nc
        cp      $5b
        ret     c
        cp      $61
        ccf     
        ret     nc
        cp      $7b
        ret     

.l2c9b  cp      $c4
        jr      nz,l2cb8            ; (25)
        ld      de,$0000

.l2ca2  rst     $20
        sub     $31
        adc     a,$00
        jr      nz,l2cb3            ; (10)
        ex      de,hl
        ccf     
        adc     hl,hl
        jp      c,$31ad
        ex      de,hl
        jr      l2ca2               ; (-17)

.l2cb3  ld      b,d
        ld      c,e
        jp      $2d2b

.l2cb8  cp      $2e

.l2cba  jr      z,l2ccb             ; (15)
        call    $2d3b
        cp      $2e
        jr      nz,l2ceb            ; (40)
        rst     $20
        call    $2d1b
        jr      c,l2ceb             ; (34)
        defb    $18
        defb    10

.l2ccb  rst     $20
        call    $2d1b

.l2ccf  jp      c,$1c8a
        rst     $28
        and     b
        defb    $38
        defb    -17
        and     c
        ret     nz
        ld      (bc),a
        jr      c,l2cba             ; (-33)
        call    $2d22
        jr      c,l2ceb             ; (11)
        rst     $28

.l2ce1  ret     po
        and     h
        dec     b
        ret     nz
        inc     b
        rrca
        defb    $38
        defb    -25
        defb    $18
        defb    -17

.l2ceb  cp      $45
        jr      z,l2cf2             ; (3)
        cp      $65
        ret     nz

.l2cf2  ld      b,$ff
        rst     $20
        cp      $2b
        jr      z,l2cfe             ; (5)
        cp      $2d
        jr      nz,l2cff            ; (2)
        inc     b

.l2cfe  rst     $20

.l2cff  call    $2d1b
        jr      c,l2ccf             ; (-53)
        push    bc
        call    $2d3b
        call    $2dd5
        pop     bc
        jp      c,$31ad
        and     a
        jp      m,$31ad
        inc     b
        jr      z,l2d18             ; (2)
        neg     

.l2d18  jp      $2d4f

.l2d1b  cp      $30
        ret     c
        cp      $3a
        ccf     
        ret     

.l2d22  call    $2d1b
        ret     c
        sub     $30

.l2d28  ld      c,a
        ld      b,$00

.l2d2b  ld      iy,ERR_NR
        xor     a
        ld      e,a

.l2d31  ld      d,c
        ld      c,b
        ld      b,a
        call    $2ab6
        rst     $28
        jr      c,l2ce1             ; (-89)
        ret     

.l2d3b  push    af
        rst     $28
        and     b
        jr      c,l2d31             ; (-15)

.l2d40  call    $2d22
        ret     c
        rst     $28
        ld      bc,$04a4

.l2d48  rrca
        jr      c,l2d18             ; (-51)
        ld      (hl),h
        nop     
        jr      l2d40               ; (-15)

.l2d4f  rlca
        rrca    

.l2d51  jr      nc,l2d55            ; (2)
        cpl     
        inc     a

.l2d55  push    af
        ld      hl,MEMBOT
        call    $350b
        rst     $28
        and     h
        jr      c,l2d51             ; (-15)

.l2d60  srl     a

.l2d62  jr      nc,l2d71            ; (13)
        push    af
        rst     $28
        pop     bc
        ret     po
        nop     
        inc     b
        inc     b

.l2d6b  inc     sp
        ld      (bc),a
        dec     b
        pop     hl
        jr      c,l2d62             ; (-15)

.l2d71  jr      z,l2d7b             ; (8)
        push    af
        rst     $28
        ld      sp,$3804
        pop     af
        jr      l2d60               ; (-27)

.l2d7b  rst     $28
        ld      (bc),a
        jr      c,l2d48             ; (-55)

.l2d7f  inc     hl
        ld      c,(hl)
        inc     hl
        ld      a,(hl)
        xor     c
        sub     c
        ld      e,a
        inc     hl
        ld      a,(hl)
        adc     a,c
        xor     c
        ld      d,a
        ret     
        ld      c,$00

.l2d8e  push    hl
        ld      (hl),$00
        inc     hl
        ld      (hl),c
        inc     hl
        ld      a,e
        xor     c

.l2d96  sub     c
        ld      (hl),a
        inc     hl
        ld      a,d
        adc     a,c
        xor     c
        ld      (hl),a

.l2d9d  inc     hl
        ld      (hl),$00
        pop     hl
        ret     

.l2da2  rst     $28

.l2da3  defb    $38
        defb    126
        and     a
        defb    $28
        defb    5
        rst     $28
        and     d
        rrca    
        daa     
        jr      c,l2d9d             ; (-17)
        ld      (bc),a
        jr      c,l2d96             ; (-27)
        push    de
        ex      de,hl
        ld      b,(hl)
        call    $2d7f
        xor     a
        sub     b
        bit     7,c
        ld      b,d
        ld      c,e
        ld      a,e
        pop     de
        pop     hl
        ret     

.l2dc1  ld      d,a
        rla     
        sbc     a,a
        ld      e,a
        ld      c,a
        xor     a
        ld      b,a

.l2dc8  call    $2ab6
        rst     $28
        inc     (hl)
        rst     $28
        ld      a,(de)
        jr      nz,l2d6b            ; (-102)
        add     a,l
        inc     b
        daa     
        jr      c,l2da3             ; (-51)
        and     d
        dec     l

.l2dd8  ret     c
        push    af
        dec     b
        inc     b
        jr      z,l2de1             ; (3)
        pop     af
        scf     
        ret     

.l2de1  pop     af
        ret     

.l2de3  rst     $28
        ld      sp,$0036
        dec     bc
        ld      sp,$0037
        dec     c
        ld      (bc),a
        jr      c,l2e2d             ; (62)
        jr      nc,l2dc8            ; (-41)
        ret     
        ld      hl,($3e38)
        dec     l
        rst     $10
        rst     $28
        and     b
        jp      $c5c4
        ld      (bc),a
        jr      c,l2dd8             ; (-39)
        push    hl
        exx     

.l2e01  rst     $28
        ld      sp,$c227
        inc     bc
        jp      po,$c201
        ld      (bc),a
        jr      c,l2e8a             ; (126)
        and     a
        jr      nz,l2e56            ; (71)
        call    $2d7f
        ld      b,$10
        ld      a,d
        and     a
        jr      nz,l2e1e            ; (6)
        or      e
        jr      z,l2e24             ; (9)
        ld      d,e
        ld      b,$08

.l2e1e  push    de
        exx     
        pop     de
        exx     
        jr      l2e7b               ; (87)

.l2e24  rst     $28
        jp      po,$7e38
        sub     $7e
        call    $2dc1

.l2e2d  ld      d,a
        ld      a,(MEMBOT+$1a)
        sub     d
        ld      (MEMBOT+$1a),a
        ld      a,d
        call    $2d4f
        rst     $28
        ld      sp,$c127
        inc     bc
        pop     hl
        defb    $38
        defb    -51
        push    de
        dec     l
        push    hl
        ld      (MEMBOT+$0f),a
        dec     a
        rla     
        sbc     a,a
        inc     a
        ld      hl,MEMBOT+$19
        ld      (hl),a
        inc     hl
        add     a,(hl)
        ld      (hl),a
        pop     hl
        jp      $2ecf

.l2e56  sub     $80
        cp      $1c
        jr      c,l2e6f             ; (19)
        call    $2dc1
        sub     $07
        ld      b,a
        ld      hl,MEMBOT+$1a
        add     a,(hl)
        ld      (hl),a
        ld      a,b
        neg     
        call    $2d4f
        jr      l2e01               ; (-110)

.l2e6f  ex      de,hl
        call    $2fba
        exx     
        set     7,d
        ld      a,l
        exx     
        sub     $80
        ld      b,a

.l2e7b  sla     e
        rl      d
        exx     
        rl      e
        rl      d
        exx     
        ld      hl,MEMBOT+$18
        ld      c,$05

.l2e8a  ld      a,(hl)
        adc     a,a
        daa     
        ld      (hl),a
        dec     hl
        dec     c
        jr      nz,l2e8a            ; (-8)
        djnz    $2e7b               ; (-25)
        xor     a
        ld      hl,MEMBOT+$14
        ld      de,MEMBOT+$0f
        ld      b,$09
        rld     
        ld      c,$ff

.l2ea1  rld
        jr      nz,l2ea9            ; (4)
        dec     c
        inc     c
        jr      nz,l2eb3            ; (10)

.l2ea9  ld      (de),a
        inc     de
        inc     (iy+$71)
        inc     (iy+$72)
        ld      c,$00

.l2eb3  bit     0,b
        jr      z,l2eb8             ; (1)
        inc     hl

.l2eb8  djnz    $2ea1               ; (-25)
        ld      a,(MEMBOT+$19)
        sub     $09
        jr      c,l2ecb             ; (10)
        dec     (iy+$71)
        ld      a,$04
        cp      (iy+$6f)
        jr      l2f0c               ; (65)

.l2ecb  rst     $28
        ld      (bc),a
        jp      po,$eb38
        call    $2fba
        exx     
        ld      a,$80
        sub     l
        ld      l,$00
        set     7,d
        exx     
        call    $2fdd

.l2edf  ld      a,(iy+$71)
        cp      $08
        jr      c,l2eec             ; (6)
        exx     
        rl      d
        exx     
        jr      l2f0c               ; (32)

.l2eec  ld      bc,$0200

.l2eef  ld      a,e
        call    $2f8b
        ld      e,a
        ld      a,d
        call    $2f8b
        ld      d,a
        push    bc
        exx     
        pop     bc
        djnz    $2eef               ; (-15)
        ld      hl,MEMBOT+$0f
        ld      a,c
        ld      c,(iy+$71)
        add     hl,bc
        ld      (hl),a
        inc     (iy+$71)
        jr      l2edf               ; (-45)

.l2f0c  push    af

.l2f0d  ld      hl,MEMBOT+$0f
        ld      c,(iy+$71)
        ld      b,$00
        add     hl,bc
        ld      b,c
        pop     af

.l2f18  dec     hl
        ld      a,(hl)
        adc     a,$00
        ld      (hl),a
        and     a
        jr      z,l2f25             ; (5)
        cp      $0a
        ccf     
        jr      nc,l2f2d            ; (8)

.l2f25  djnz    $2f18               ; (-15)
        ld      (hl),$01
        inc     b
        inc     (iy+$72)

.l2f2d  ld      (iy+$71),b
        rst     $28
        ld      (bc),a
        jr      c,l2f0d             ; (-39)
        pop     hl
        exx     
        ld      bc,(MEMBOT+$19)
        ld      hl,MEMBOT+$0f
        ld      a,b
        cp      $09
        jr      c,l2f46             ; (4)
        cp      $fc
        jr      c,l2f6c             ; (38)

.l2f46  and     a
        call    z,$15ef

.l2f4a  xor     a
        sub     b
        jp      m,$2f52
        ld      b,a
        jr      l2f5e               ; (12)

.l2f52  ld      a,c
        and     a
        jr      z,l2f59             ; (3)
        ld      a,(hl)
        inc     hl
        dec     c

.l2f59  call    $15ef
        djnz    $2f52               ; (-12)

.l2f5e  ld      a,c
        and     a
        ret     z
        inc     b
        ld      a,$2e

.l2f64  rst     $10
        ld      a,$30
        djnz    $2f64               ; (-5)
        ld      b,c
        jr      l2f52               ; (-26)

.l2f6c  ld      d,b
        dec     d
        ld      b,$01
        call    $2f4a
        ld      a,$45
        rst     $10
        ld      c,d
        ld      a,c
        and     a
        jp      p,$2f83
        neg     
        ld      c,a
        ld      a,$2d
        jr      l2f85               ; (2)

.l2f83  ld      a,$2b

.l2f85  rst     $10
        ld      b,$00
        jp      $1a1b

.l2f8b  push    de
        ld      l,a
        ld      h,$00
        ld      e,l
        ld      d,h
        add     hl,hl
        add     hl,hl
        add     hl,de
        add     hl,hl
        ld      e,c
        add     hl,de
        ld      c,h
        ld      a,l
        pop     de
        ret     

.l2f9b  ld      a,(hl)
        ld      (hl),$00
        and     a
        ret     z
        inc     hl
        bit     7,(hl)
        set     7,(hl)
        dec     hl
        ret     z
        push    bc
        ld      bc,$0005
        add     hl,bc
        ld      b,c
        ld      c,a
        scf     

.l2faf  dec     hl
        ld      a,(hl)
        cpl     
        adc     a,$00
        ld      (hl),a
        djnz    $2faf               ; (-8)
        ld      a,c
        pop     bc
        ret     

.l2fba  push    hl
        push    af
        ld      c,(hl)
        inc     hl
        ld      b,(hl)
        ld      (hl),a
        inc     hl
        ld      a,c
        ld      c,(hl)
        push    bc
        inc     hl
        ld      c,(hl)
        inc     hl
        ld      b,(hl)
        ex      de,hl
        ld      d,a
        ld      e,(hl)
        push    de
        inc     hl
        ld      d,(hl)
        inc     hl
        ld      e,(hl)
        push    de
        exx     
        pop     de
        pop     hl
        pop     bc
        exx     
        inc     hl
        ld      d,(hl)
        inc     hl
        ld      e,(hl)
        pop     af
        pop     hl
        ret     

.l2fdd  and     a
        ret     z
        cp      $21
        jr      nc,l2ff9            ; (22)
        push    bc
        ld      b,a

.l2fe5  exx
        sra     l
        rr      d
        rr      e
        exx     
        rr      d
        rr      e
        djnz    $2fe5               ; (-14)
        pop     bc
        ret     nc
        call    $3004
        ret     nz

.l2ff9  exx
        xor     a

.l2ffb  ld      l,$00
        ld      d,a
        ld      e,l
        exx     
        ld      de,$0000
        ret     

.l3004  inc     e
        ret     nz
        inc     d
        ret     nz
        exx     
        inc     e
        jr      nz,l300d            ; (1)
        inc     d

.l300d  exx
        ret     

.l300f  ex      de,hl
        call    $346e
        ex      de,hl
        ld      a,(de)
        or      (hl)
        jr      nz,l303e            ; (38)
        push    de
        inc     hl
        push    hl
        inc     hl
        ld      e,(hl)
        inc     hl
        ld      d,(hl)
        inc     hl
        inc     hl
        inc     hl
        ld      a,(hl)
        inc     hl
        ld      c,(hl)
        inc     hl
        ld      b,(hl)
        pop     hl
        ex      de,hl
        add     hl,bc
        ex      de,hl
        adc     a,(hl)
        rrca    
        adc     a,$00
        jr      nz,l303c            ; (11)
        sbc     a,a
        ld      (hl),a
        inc     hl
        ld      (hl),e
        inc     hl
        ld      (hl),d
        dec     hl
        dec     hl
        dec     hl
        pop     de
        ret     

.l303c  dec     hl
        pop     de

.l303e  call    $3293
        exx     
        push    hl
        exx     
        push    de
        push    hl
        call    $2f9b
        ld      b,a
        ex      de,hl
        call    $2f9b
        ld      c,a
        cp      b
        jr      nc,l3055            ; (3)
        ld      a,b
        ld      b,c
        ex      de,hl

.l3055  push    af
        sub     b
        call    $2fba
        call    $2fdd
        pop     af
        pop     hl
        ld      (hl),a
        push    hl
        ld      l,b
        ld      h,c
        add     hl,de
        exx     
        ex      de,hl
        adc     hl,bc
        ex      de,hl
        ld      a,h
        adc     a,l
        ld      l,a
        rra     
        xor     l
        exx     
        ex      de,hl
        pop     hl
        rra     
        jr      nc,l307c            ; (8)
        ld      a,$01
        call    $2fdd
        inc     (hl)
        jr      z,l309f             ; (35)

.l307c  exx
        ld      a,l
        and     $80
        exx     
        inc     hl
        ld      (hl),a
        dec     hl
        jr      z,l30a5             ; (31)
        ld      a,e
        neg     
        ccf     
        ld      e,a
        ld      a,d
        cpl     
        adc     a,$00
        ld      d,a
        exx     
        ld      a,e
        cpl     
        adc     a,$00
        ld      e,a
        ld      a,d
        cpl     
        adc     a,$00
        jr      nc,l30a3            ; (7)
        rra     
        exx     
        inc     (hl)

.l309f  jp      z,$31ad
        exx     

.l30a3  ld      d,a
        exx     

.l30a5  xor     a
        jp      $3155

.l30a9  push    bc
        ld      b,$10
        ld      a,h
        ld      c,l
        ld      hl,$0000

.l30b1  add     hl,hl
        jr      c,l30be             ; (10)
        rl      c
        rla     
        jr      nc,l30bc            ; (3)
        add     hl,de
        jr      c,l30be             ; (2)

.l30bc  djnz    $30b1               ; (-13)

.l30be  pop     bc
        ret     

.l30c0  call    $34e9
        ret     c
        inc     hl
        xor     (hl)
        set     7,(hl)
        dec     hl
        ret     
        ld      a,(de)
        or      (hl)
        jr      nz,l30f0            ; (34)
        push    de
        push    hl
        push    de
        call    $2d7f
        ex      de,hl
        ex      (sp),hl
        ld      b,c
        call    $2d7f
        ld      a,b
        xor     c
        ld      c,a
        pop     hl
        call    $30a9
        ex      de,hl
        pop     hl
        jr      c,l30ef             ; (10)
        ld      a,d
        or      e
        jr      nz,l30ea            ; (1)
        ld      c,a

.l30ea  call    $2d8e
        pop     de
        ret     

.l30ef  pop     de

.l30f0  call    $3293
        xor     a
        call    $30c0
        ret     c
        exx     
        push    hl
        exx     
        push    de
        ex      de,hl
        call    $30c0
        ex      de,hl
        jr      c,l315d             ; (90)
        push    hl
        call    $2fba
        ld      a,b
        and     a
        sbc     hl,hl
        exx     
        push    hl
        sbc     hl,hl
        exx     
        ld      b,$21
        jr      l3125               ; (17)

.l3114  jr      nc,l311b            ; (5)
        add     hl,de
        exx     
        adc     hl,de
        exx     

.l311b  exx
        rr      h
        rr      l
        exx     
        rr      h
        rr      l

.l3125  exx
        rr      b
        rr      c
        exx     
        rr      c
        rra     
        djnz    $3114               ; (-28)
        ex      de,hl
        exx     
        ex      de,hl
        exx     
        pop     bc
        pop     hl
        ld      a,b
        add     a,c
        jr      nz,l313b            ; (1)
        and     a

.l313b  dec     a
        ccf     

.l313d  rla
        ccf     
        rra     
        jp      p,$3146
        jr      nc,l31ad            ; (104)
        and     a

.l3146  inc     a
        jr      nz,l3151            ; (8)
        jr      c,l3151             ; (6)
        exx     
        bit     7,d
        exx     
        jr      nz,l31ad            ; (92)

.l3151  ld      (hl),a
        exx     
        ld      a,b
        exx     

.l3155  jr      nc,l316c            ; (21)
        ld      a,(hl)
        and     a

.l3159  ld      a,$80
        jr      z,l315e             ; (1)

.l315d  xor     a

.l315e  exx
        and     d
        call    $2ffb
        rlca    
        ld      (hl),a
        jr      c,l3195             ; (46)
        inc     hl
        ld      (hl),a
        dec     hl
        jr      l3195               ; (41)

.l316c  ld      b,$20

.l316e  exx
        bit     7,d
        exx     
        jr      nz,l3186            ; (18)
        rlca    
        rl      e
        rl      d
        exx     
        rl      e
        rl      d
        exx     
        dec     (hl)
        jr      z,l3159             ; (-41)
        djnz    $316e               ; (-22)
        jr      l315d               ; (-41)

.l3186  rla
        jr      nc,l3195            ; (12)
        call    $3004
        jr      nz,l3195            ; (7)
        exx     
        ld      d,$80
        exx     
        inc     (hl)
        jr      z,l31ad             ; (24)

.l3195  push    hl
        inc     hl
        exx     
        push    de
        exx     
        pop     bc
        ld      a,b
        rla     
        rl      (hl)
        rra     
        ld      (hl),a
        inc     hl
        ld      (hl),c
        inc     hl
        ld      (hl),d
        inc     hl
        ld      (hl),e
        pop     hl
        pop     de
        exx     
        pop     hl
        exx     
        ret     

.l31ad  rst     $8
        dec     b
        call    $3293
        ex      de,hl
        xor     a
        call    $30c0
        jr      c,l31ad             ; (-12)
        ex      de,hl
        call    $30c0
        ret     c
        exx     
        push    hl
        exx     
        push    de
        push    hl
        call    $2fba
        exx     
        push    hl
        ld      h,b
        ld      l,c
        exx     
        ld      h,c
        ld      l,b
        xor     a
        ld      b,$df
        jr      l31e2               ; (16)

.l31d2  rla
        rl      c
        exx     
        rl      c
        rl      b
        exx     
        add     hl,hl
        exx     
        adc     hl,hl
        exx     
        jr      c,l31f2             ; (16)

.l31e2  sbc     hl,de
        exx     
        sbc     hl,de
        exx     
        jr      nc,l31f9            ; (15)
        add     hl,de
        exx     
        adc     hl,de
        exx     
        and     a
        jr      l31fa               ; (8)

.l31f2  and     a
        sbc     hl,de
        exx     
        sbc     hl,de
        exx     

.l31f9  scf

.l31fa  inc     b
        jp      m,$31d2
        push    af
        jr      z,l31e2             ; (-31)
        ld      e,a
        ld      d,c
        exx     
        ld      e,c
        ld      d,b
        pop     af
        rr      b
        pop     af
        rr      b
        exx     
        pop     bc
        pop     hl
        ld      a,b
        sub     c
        jp      $313d
        ld      a,(hl)
        and     a
        ret     z
        cp      $81
        jr      nc,l3221            ; (6)
        ld      (hl),$00
        ld      a,$20
        jr      l3272               ; (81)

.l3221  cp      $91
        jr      nz,l323f            ; (26)
        inc     hl
        inc     hl
        inc     hl
        ld      a,$80
        and     (hl)
        dec     hl
        or      (hl)
        dec     hl
        jr      nz,l3233            ; (3)
        ld      a,$80
        xor     (hl)

.l3233  dec     hl
        jr      nz,l326c            ; (54)
        ld      (hl),a
        inc     hl
        ld      (hl),$ff
        dec     hl
        ld      a,$18
        jr      l3272               ; (51)

.l323f  jr      nc,l326d            ; (44)
        push    de
        cpl     
        add     a,$91
        inc     hl
        ld      d,(hl)
        inc     hl
        ld      e,(hl)
        dec     hl
        dec     hl
        ld      c,$00
        bit     7,d
        jr      z,l3252             ; (1)
        dec     c

.l3252  set     7,d
        ld      b,$08
        sub     b
        add     a,b
        jr      c,l325e             ; (4)
        ld      e,d
        ld      d,$00
        sub     b

.l325e  jr      z,l3267             ; (7)
        ld      b,a

.l3261  srl     d
        rr      e
        djnz    $3261               ; (-6)

.l3267  call    $2d8e
        pop     de
        ret     

.l326c  ld      a,(hl)

.l326d  sub     $a0
        ret     p
        neg     

.l3272  push    de
        ex      de,hl
        dec     hl
        ld      b,a
        srl     b
        srl     b
        srl     b
        jr      z,l3283             ; (5)

.l327e  ld      (hl),$00
        dec     hl
        djnz    $327e               ; (-5)

.l3283  and     $07
        jr      z,l3290             ; (9)
        ld      b,a
        ld      a,$ff

.l328a  sla     a
        djnz    $328a               ; (-4)
        and     (hl)
        ld      (hl),a

.l3290  ex      de,hl

.l3291  pop     de
        ret     

.l3293  call    $3296

.l3296  ex      de,hl

.l3297  ld      a,(hl)
        and     a
        ret     nz
        push    de
        call    $2d7f
        xor     a
        inc     hl
        ld      (hl),a
        dec     hl
        ld      (hl),a
        ld      b,$91
        ld      a,d
        and     a
        jr      nz,l32b1            ; (8)
        or      e

.l32aa  ld      b,d
        jr      z,l32bd             ; (16)
        ld      d,e
        ld      e,b
        ld      b,$89

.l32b1  ex      de,hl

.l32b2  dec     b
        add     hl,hl
        jr      nc,l32b2            ; (-4)
        rrc     c
        rr      h
        rr      l

.l32bc  ex      de,hl

.l32bd  dec     hl
        ld      (hl),e
        dec     hl
        ld      (hl),d
        dec     hl
        ld      (hl),b
        pop     de
        ret     
        nop     
        or      b
        nop     
        ld      b,b
        or      b
        nop     
        ld      bc,$0030
        pop     af
        ld      c,c
        rrca    
        jp      c,$40a2
        or      b
        nop     
        ld      a,(bc)
        adc     a,a
        ld      (hl),$3c
        inc     (hl)
        and     c
        inc     sp
        rrca    
        jr      nc,l32aa            ; (-54)
        jr      nc,l3291            ; (-81)
        ld      sp,$3851
        dec     de
        dec     (hl)
        inc     h
        dec     (hl)
        dec     sp
        dec     (hl)
        dec     sp
        dec     (hl)
        dec     sp
        dec     (hl)
        dec     sp
        dec     (hl)
        dec     sp
        dec     (hl)
        dec     sp
        dec     (hl)
        inc     d
        defb    $30
        defb    45
        dec     (hl)
        dec     sp
        dec     (hl)
        dec     sp
        dec     (hl)
        dec     sp
        dec     (hl)
        dec     sp
        dec     (hl)
        dec     sp

.l3302  dec     (hl)
        dec     sp
        dec     (hl)
        sbc     a,h
        dec     (hl)
        sbc     a,$35
        cp      h
        inc     (hl)
        ld      b,l
        ld      (hl),$6e
        inc     (hl)
        ld      l,c
        ld      (hl),$de
        dec     (hl)
        ld      (hl),h
        ld      (hl),$b5
        scf     
        xor     d
        scf     
        jp      c,$3337
        defb    $38
        defb    67
        jr      c,l3302             ; (-30)
        scf     
        inc     de
        scf     
        call    nz,$af36
        ld      (hl),$4a
        jr      c,l32bc             ; (-110)
        inc     (hl)
        ld      l,d
        inc     (hl)
        xor     h
        inc     (hl)
        and     l
        inc     (hl)
        or      e
        inc     (hl)
        rra     
        ld      (hl),$c9
        dec     (hl)

.l3337  ld      bc,$c035
        inc     sp
        and     b
        ld      (hl),$86
        ld      (hl),$c6
        inc     sp
        ld      a,d
        ld      (hl),$06
        dec     (hl)
        ld      sp,hl
        inc     (hl)
        sbc     a,e
        ld      (hl),$83
        scf     
        inc     d
        ld      ($33a2),a
        ld      c,a
        dec     l
        sub     a
        ld      ($3449),a
        dec     de
        inc     (hl)
        dec     l
        inc     (hl)
        rrca    
        inc     (hl)

.l335b  call    $35bf

.l335e  ld      a,b
        ld      (BREG),a

.l3362  exx
        ex      (sp),hl
        exx     
        ld      (STKEND),de
        exx     
        ld      a,(hl)
        inc     hl

.l336c  push    hl
        and     a
        jp      p,$3380
        ld      d,a
        and     $60
        rrca    
        rrca    
        rrca    
        rrca    
        add     a,$7c
        ld      l,a
        ld      a,d
        and     $1f
        jr      l338e               ; (14)

.l3380  cp      $18
        jr      nc,l338c            ; (8)
        exx     
        ld      bc,$fffb
        ld      d,h
        ld      e,l
        add     hl,bc
        exx     

.l338c  rlca
        ld      l,a

.l338e  ld      de,$32d7
        ld      h,$00
        add     hl,de
        ld      e,(hl)
        inc     hl
        ld      d,(hl)
        ld      hl,$3365
        ex      (sp),hl
        push    de
        exx     
        ld      bc,(STKEND+1)
        ret     
        pop     af
        ld      a,(BREG)
        exx     
        jr      l336c               ; (-61)

.l33a9  push    de
        push    hl
        ld      bc,$0005
        call    $1f05
        pop     hl
        pop     de
        ret     

.l33b4  ld      de,(STKEND)
        call    $33c0
        ld      (STKEND),de
        ret     

.l33c0  call    $33a9
        ldir    
        ret     
        ld      h,d
        ld      l,e

.l33c8  call    $33a9
        exx     
        push    hl
        exx     
        ex      (sp),hl
        push    bc
        ld      a,(hl)
        and     $c0
        rlca    
        rlca    
        ld      c,a
        inc     c
        ld      a,(hl)
        and     $3f
        jr      nz,l33de            ; (2)
        inc     hl
        ld      a,(hl)

.l33de  add     a,$50
        ld      (de),a
        ld      a,$05
        sub     c
        inc     hl
        inc     de
        ld      b,$00
        ldir    
        pop     bc
        ex      (sp),hl
        exx     
        pop     hl
        exx     
        ld      b,a
        xor     a

.l33f1  dec     b
        ret     z
        ld      (de),a
        inc     de
        jr      l33f1               ; (-6)

.l33f7  and     a

.l33f8  ret     z
        push    af
        push    de
        ld      de,$0000
        call    $33c8
        pop     de
        pop     af
        dec     a
        jr      l33f8               ; (-14)

.l3406  ld      c,a
        rlca    
        rlca    
        add     a,c
        ld      c,a
        ld      b,$00
        add     hl,bc
        ret     
        push    de
        ld      hl,(MEM)
        call    $3406
        call    $33c0
        pop     hl
        ret     
        ld      h,d
        ld      l,e
        exx     
        push    hl
        ld      hl,$32c5
        exx     
        call    $33f7
        call    $33c8
        exx     
        pop     hl
        exx     
        ret     
        push    hl
        ex      de,hl
        ld      hl,(MEM)
        call    $3406
        ex      de,hl
        call    $33c0
        ex      de,hl
        pop     hl
        ret     

.l343c  ld      b,$05

.l343e  ld      a,(de)
        ld      c,(hl)
        ex      de,hl
        ld      (de),a
        ld      (hl),c
        inc     hl
        inc     de
        djnz    $343e               ; (-9)
        ex      de,hl
        ret     
        ld      b,a
        call    $335e
        ld      sp,$c00f
        ld      (bc),a
        and     b
        jp      nz,$e031
        inc     b
        jp      po,$03c1
        defb    $38
        defb    -51
        add     a,$33
        call    $3362
        rrca    
        ld      bc,$02c2
        dec     (hl)
        xor     $e1
        inc     bc
        defb    $38
        defb    -55
        ld      b,$ff
        jr      l3474               ; (6)

.l346e  call    $34e9
        ret     c
        ld      b,$00

.l3474  ld      a,(hl)
        and     a
        jr      z,l3483             ; (11)
        inc     hl
        ld      a,b
        and     $80
        or      (hl)
        rla     
        ccf     
        rra     
        ld      (hl),a
        dec     hl
        ret     

.l3483  push    de
        push    hl
        call    $2d7f
        pop     hl
        ld      a,b
        or      c
        cpl     
        ld      c,a
        call    $2d8e
        pop     de
        ret     
        call    $34e9
        ret     c
        push    de
        ld      de,$0001
        inc     hl
        rl      (hl)
        dec     hl
        sbc     a,a
        ld      c,a
        call    $2d8e
        pop     de
        ret     
        call    $1e99
        in      a,(c)
        jr      l34b0               ; (4)
        call    $1e99
        ld      a,(bc)

.l34b0  jp      $2d28
        call    $1e99
        ld      hl,$2d2b
        push    hl
        push    bc
        ret     
        call    $2bf1
        dec     bc
        ld      a,b
        or      c
        jr      nz,l34e7            ; (35)
        ld      a,(de)
        call    $2c8d
        jr      c,l34d3             ; (9)
        sub     $90
        jr      c,l34e7             ; (25)
        cp      $15
        jr      nc,l34e7            ; (21)
        inc     a

.l34d3  dec     a
        add     a,a
        add     a,a
        add     a,a
        cp      $a8
        jr      nc,l34e7            ; (12)
        ld      bc,(UDG)
        add     a,c
        ld      c,a
        jr      nc,l34e4            ; (1)
        inc     b

.l34e4  jp      $2d2b

.l34e7  rst     $8
        add     hl,bc

.l34e9  push    hl
        push    bc
        ld      b,a
        ld      a,(hl)
        inc     hl
        or      (hl)
        inc     hl
        or      (hl)
        inc     hl
        or      (hl)
        ld      a,b
        pop     bc
        pop     hl
        ret     nz
        scf     
        ret     

.l34f9  call    $34e9
        ret     c
        ld      a,$ff
        jr      l3507               ; (6)

.l3501  call    $34e9
        jr      l350b               ; (5)
        xor     a

.l3507  inc     hl
        xor     (hl)
        dec     hl
        rlca    

.l350b  push    hl
        ld      a,$00
        ld      (hl),a
        inc     hl
        ld      (hl),a
        inc     hl
        rla     
        ld      (hl),a
        rra     
        inc     hl
        ld      (hl),a
        inc     hl
        ld      (hl),a
        pop     hl
        ret     
        ex      de,hl
        call    $34e9
        ex      de,hl
        ret     c
        scf     
        jr      l350b               ; (-25)
        ex      de,hl
        call    $34e9
        ex      de,hl
        ret     nc
        and     a
        jr      l350b               ; (-34)
        ex      de,hl
        call    $34e9
        ex      de,hl
        ret     nc
        push    de
        dec     de
        xor     a
        ld      (de),a
        dec     de
        ld      (de),a
        pop     de
        ret     
        ld      a,b
        sub     $08
        bit     2,a
        jr      nz,l3543            ; (1)
        dec     a

.l3543  rrca
        jr      nc,l354e            ; (8)
        push    af
        push    hl
        call    $343c
        pop     de
        ex      de,hl
        pop     af

.l354e  bit     2,a
        jr      nz,l3559            ; (7)
        rrca    
        push    af
        call    $300f
        defb    $18
        defb    51

.l3559  rrca
        push    af
        call    $2bf1
        push    de
        push    bc
        call    $2bf1
        pop     hl

.l3564  ld      a,h
        or      l
        ex      (sp),hl
        ld      a,b
        jr      nz,l3575            ; (11)
        or      c

.l356b  pop     bc
        jr      z,l3572             ; (4)
        pop     af
        ccf     
        jr      l3588               ; (22)

.l3572  pop     af
        jr      l3588               ; (19)

.l3575  or      c
        jr      z,l3585             ; (13)
        ld      a,(de)
        sub     (hl)
        jr      c,l3585             ; (9)
        jr      nz,l356b            ; (-19)

.l357e  dec     bc
        inc     de
        inc     hl
        ex      (sp),hl
        dec     hl
        jr      l3564               ; (-33)

.l3585  pop     bc
        pop     af
        and     a

.l3588  push    af
        rst     $28
        and     b
        jr      c,l357e             ; (-15)
        push    af
        call    c,$3501
        pop     af
        push    af
        call    nc,$34f9
        pop     af
        rrca    
        call    nc,$3501
        ret     
        call    $2bf1
        push    de
        push    bc
        call    $2bf1
        pop     hl
        push    hl
        push    de
        push    bc
        add     hl,bc
        ld      b,h
        ld      c,l
        rst     $30
        call    $2ab2
        pop     bc
        pop     hl
        ld      a,b
        or      c
        jr      z,l35b7             ; (2)
        ldir    

.l35b7  pop     bc
        pop     hl
        ld      a,b
        or      c
        jr      z,l35bf             ; (2)
        ldir    

.l35bf  ld      hl,(STKEND)
        ld      de,$fffb
        push    hl
        add     hl,de
        pop     de
        ret     
        call    $2dd5
        jr      c,l35dc             ; (14)
        jr      nz,l35dc            ; (12)
        push    af
        ld      bc,$0001
        rst     $30
        pop     af
        ld      (de),a
        call    $2ab2
        ex      de,hl
        ret     

.l35dc  rst     $8
        ld      a,(bc)
        ld      hl,(CH_ADD)
        push    hl
        ld      a,b
        add     a,$e3
        sbc     a,a
        push    af
        call    $2bf1
        push    de
        inc     bc
        rst     $30
        pop     hl
        ld      (CH_ADD),de
        push    de
        ldir    
        ex      de,hl
        dec     hl
        ld      (hl),$0d
        res     7,(iy+$01)
        call    $24fb
        rst     $18
        cp      $0d
        jr      nz,l360c            ; (7)
        pop     hl
        pop     af
        xor     (iy+$01)
        and     $40

.l360c  jp      nz,$1c8a
        ld      (CH_ADD),hl
        set     7,(iy+$01)
        call    $24fb
        pop     hl
        ld      (CH_ADD),hl
        jr      l35bf               ; (-96)
        ld      bc,$0001
        rst     $30
        ld      (K_CUR),hl
        push    hl
        ld      hl,(CURCHL)
        push    hl
        ld      a,$ff
        call    $1601
        call    $2de3
        pop     hl
        call    $1615
        pop     de
        ld      hl,(K_CUR)
        and     a
        sbc     hl,de
        ld      b,h
        ld      c,l
        call    $2ab2
        ex      de,hl
        ret     
        call    $1e94
        cp      $10
        jp      nc,$1e9f
        ld      hl,(CURCHL)
        push    hl
        call    $1601
        call    $15e6
        ld      bc,$0000
        jr      nc,l365f            ; (3)
        inc     c
        rst     $30
        ld      (de),a

.l365f  call    $2ab2
        pop     hl
        call    $1615
        jp      $35bf
        call    $2bf1
        ld      a,b
        or      c
        jr      z,l3671             ; (1)
        ld      a,(de)

.l3671  jp      $2d28

.l3674  call    $2bf1
        jp      $2d2b
        exx     
        push    hl
        ld      hl,BREG
        dec     (hl)
        pop     hl
        jr      nz,l3687            ; (4)
        inc     hl
        exx     
        ret     

.l3686  exx

.l3687  ld      e,(hl)
        ld      a,e
        rla     
        sbc     a,a
        ld      d,a
        add     hl,de

.l368d  exx
        ret     
        inc     de
        inc     de
        ld      a,(de)
        dec     de
        dec     de
        and     a
        jr      nz,l3686            ; (-17)
        exx     
        inc     hl
        exx     
        ret     
        pop     af
        exx     
        ex      (sp),hl
        exx     
        ret     
        rst     $28
        ret     nz
        ld      (bc),a
        ld      sp,$05e0
        daa     
        ret     po
        ld      bc,$04c0
        inc     bc
        ret     po
        defb    $38
        defb    -55
        rst     $28
        ld      sp,$0036
        inc     b
        ld      a,($c938)
        ld      sp,$c03a
        inc     bc
        ret     po
        ld      bc,$0030
        inc     bc
        and     c
        inc     bc
        jr      c,l368d             ; (-55)
        rst     $28
        dec     a
        inc     (hl)

.l36c7  pop     af
        jr      c,l3674             ; (-86)
        dec     sp
        add     hl,hl
        inc     b
        ld      sp,$c327
        inc     bc
        ld      sp,$a10f
        inc     bc
        adc     a,b
        inc     de
        ld      (hl),$58
        ld      h,l
        ld      h,(hl)
        sbc     a,l

.l36dc  ld      a,b
        ld      h,l
        ld      b,b
        and     d
        ld      h,b
        ld      ($e7c9),a
        ld      hl,$aff7
        inc     h
        ex      de,hl
        cpl     

.l36ea  or      b
        or      b
        inc     d
        xor     $7e
        cp      e
        sub     h
        ld      e,b
        pop     af
        ld      a,($f87e)
        rst     $8
        ex      (sp),hl
        jr      c,l36c7             ; (-51)
        push    de
        dec     l
        jr      nz,l3705            ; (7)
        jr      c,l3703             ; (3)
        add     a,(hl)
        jr      nc,l370c            ; (9)

.l3703  rst     $8
        dec     b

.l3705  jr      c,l370e             ; (7)
        sub     (hl)
        jr      nc,l370e            ; (4)
        neg     

.l370c  ld      (hl),a
        ret     

.l370e  rst     $28
        ld      (bc),a
        and     b
        jr      c,l36dc             ; (-55)
        rst     $28
        dec     a
        ld      sp,$0037
        inc     b
        jr      c,l36ea             ; (-49)
        add     hl,bc
        and     b
        ld      (bc),a
        jr      c,l379e             ; (126)
        ld      (hl),$80
        call    $2d28
        rst     $28
        inc     (hl)
        jr      c,l3729             ; (0)

.l3729  inc     bc
        ld      bc,$3431
        ret     p
        ld      c,h
        call    z,$cdcc
        inc     bc
        scf     
        nop     
        ex      af,af'
        ld      bc,$03a1
        ld      bc,$3438
        rst     $28
        ld      bc,$f034
        ld      sp,$1772
        ret     m
        inc     b
        ld      bc,$03a2
        and     d
        inc     bc
        ld      sp,$3234
        defb    $20
        defb    4
        and     d
        inc     bc
        adc     a,h
        ld      de,$14ac
        add     hl,bc
        ld      d,(hl)
        jp      c,$59a5
        defb    $30
        defb    -59
        ld      e,h
        sub     b
        xor     d
        sbc     a,(hl)
        ld      (hl),b
        ld      l,a
        ld      h,c
        and     c
        set     3,d
        sub     (hl)
        and     h
        ld      sp,$b49f
        rst     $20
        and     b
        cp      $5c
        call    m,$1bea
        ld      b,e

.l3773  jp      z,$ed36
        and     a
        sbc     a,h
        ld      a,(hl)
        ld      e,(hl)
        ret     p
        ld      l,(hl)
        inc     hl
        add     a,b
        sub     e
        inc     b
        rrca
        defb    $38
        defb    -55
        rst     $28
        dec     a
        inc     (hl)
        xor     $22
        ld      sp,hl
        add     a,e
        ld      l,(hl)
        inc     b
        ld      sp,$0fa2
        daa     
        inc     bc
        ld      sp,$310f
        rrca    
        ld      sp,$a12a
        inc     bc
        ld      sp,$c037
        nop     
        inc     b

.l379e  ld      (bc),a
        defb    $38
        defb    -55
        and     c
        inc     bc
        ld      bc,$0036
        ld      (bc),a
        dec     de
        jr      c,l3773             ; (-55)
        rst     $28

.l37ab  add     hl,sp
        ld      hl,($03a1)
        ret     po
        nop     
        ld      b,$1b
        inc     sp
        inc     bc
        rst     $28

.l37b6  add     hl,sp

.l37b7  ld      sp,$0431
        ld      sp,$a10f
        inc     bc
        add     a,(hl)
        inc     d
        and     $5c
        rra     
        dec     bc
        and     e
        adc     a,a
        jr      c,l37b6             ; (-18)
        jp      (hl)
        dec     d
        ld      h,e
        cp      e
        inc     hl
        xor     $92
        dec     c
        call    $f1ed
        inc     hl
        ld      e,l
        dec     de
        jp      pe,$3804
        ret     
        rst     $28
        ld      sp,$011f
        jr      nz,l37e5            ; (5)
        jr      c,l37ab             ; (-55)
        call    $3297

.l37e5  ld      a,(hl)
        cp      $81
        jr      c,l37f8             ; (14)
        rst     $28
        and     c
        dec     de
        ld      bc,$3105
        ld      (hl),$a3
        ld      bc,$0600
        dec     de
        inc     sp
        inc     bc

.l37f8  rst     $28
        and     b
        ld      bc,$3131
        inc     b
        ld      sp,$a10f
        inc     bc

.l3802  adc     a,h
        djnz    $37b7               ; (-78)
        inc     de
        ld      c,$55
        call    po,$588d
        add     hl,sp
        cp      h
        ld      e,e
        sbc     a,b
        sbc     a,(iy+$00)
        ld      (hl),$75
        and     b
        in      a,($e8)
        or      h
        ld      h,e
        ld      b,d
        call    nz,$b5e6
        add     hl,bc

.l381e  ld      (hl),$be
        jp      (hl)
        ld      (hl),$73
        dec     de
        ld      e,l
        call    pe,$ded8
        ld      h,e
        cp      (hl)
        ret     p
        ld      h,c
        and     c
        or      e
        inc     c
        inc     b
        rrca
        defb    $38
        defb    -55
        rst     $28
        ld      sp,$0431

.l3837  and     c
        inc     bc
        dec     de
        defb    $28
        defb    -95
        rrca    
        dec     b
        inc     h
        ld      sp,$380f
        ret     
        rst     $28
        ld      ($03a3),hl
        dec     de
        defb    $38
        defb    -55
        rst     $28
        ld      sp,$0030
        ld      e,$a2
        defb    $38
        defb    -17
        ld      bc,$3031
        nop     
        rlca    
        dec     h
        inc     b
        jr      c,l381e             ; (-61)
        call    nz,$0236
        ld      sp,$0030
        add     hl,bc
        and     b
        ld      bc,$0037
        ld      b,$a1
        ld      bc,$0205
        and     c
        jr      c,l3837             ; (-55)


; In the original 48K ROM, locations $386e to $3cff are "spare" and
; contain $ff

; This routine is a patch to the maskable interrupt routine.
; It scans the keyboard as normal, and then checks for disk motor timeout

.l386e  push    ix              ; save IX (why?)
        call    l02bf           ; scan keyboard as with 48K ROM
        bit     4,(iy+$01)
        jr      z,l387c         ; check bit 4 of FLAGS
        call    l387f           ; check disk motor if true
.l387c  pop     ix
        ret     

; Subroutine to check disk motor timeout

.l387f  ld      bc,$7ffd
        ld      a,(BANKM)
        or      $07
        out     (c),a           ; page in page 7
        ld      a,($e600)
        or      a
        jr      z,l38ac         ; move on if motor already off
        ld      a,(FRAMES)
        bit     0,a
        jr      nz,l38ac        ; only decrement timeout every other time
        ld      a,($e600)
        dec     a               ; decrement timeout
        ld      ($e600),a
        jr      nz,l38ac        ; move on if not yet zero
        ld      bc,$1ffd
        ld      a,(BANK678)
        and     $f7
        ld      (BANK678),a
        out     (c),a           ; switch motor off
.l38ac  ld      bc,$7ffd
        ld      a,(BANKM)
        out     (c),a           ; page back page 0
        ret

        defs    331

; The printer input (l3a00) and output (l3a05) routines
; Channel information for "P" channel points here

.l3a00  ld      hl,$3d03        ; input routine in ROM 1
        jr      l3a08
.l3a05  ld      hl,$3d06        ; output routine in ROM 1
.l3a08  ex      af,af'
        ld      bc,$1ffd
        ld      a,(BANK678)
        push    af
        and     $fb             ; select ROM 1
        di      
        ld      (BANK678),a
        out     (c),a           ; at this point, routine continues in ROM 1
        jp      $3d00
.l3a1b  ex      af,af'
        pop     af
        ld      bc,$1ffd
        di      
        ld      (BANK678),a
        out     (c),a
        ei                      ; control returns to this ROM here
        ex      af,af'
        ret     

; Patch to print error message routine

.l3a29  bit     4,(iy+$01)      ; check bit 4 of FLAGS
        jr      nz,l3a34        ; move on if in +3 BASIC
        xor     a
        ld      de,$1536        ; else exit to do standard "comma" message
        ret     
.l3a34  ld      hl,$010f
.l3a37  ex      (sp),hl
        jp      SWAP            ; call routine in ROM 0
                                ; note that all these routines seem to enter
                                ; during the reset routine! Or am I missing
                                ; something...


; Patch to "STMT-RET" routine

.l3a3b  bit     4,(iy+$01)      ; check bit 4 of FLAGS
        jr      nz,l3a46        ; move on if in +3 BASIC
        bit     7,(iy+$0a)      ; else exit with normal 48K ROM check done
        ret     
.l3a46  ld      hl,$0112
        jr      l3a37           ; go to call routine in ROM 0


; Patch to "STMT-NEXT" routine

.l3a4b  bit     4,(iy+$01)      ; check bit 4 of FLAGS
        jr      nz,l3a55        ; move on if in +3 BASIC
        rst     $18
        cp      $0d             ; else exit with normal 48K ROM check done
        ret     
.l3a55  ld      hl,$0115
        jr      l3a37           ; go to call routine in ROM 0


; Patch to INKEY$ function routine
; Presumably, in earlier 128K spectrums this was used to read the
; external keypad, but it effectively does nothing different to the
; usual routine on the +3.

.l3a5a  call    l028e           ; do normal call to get key-value in DE
        ld      c,$00
        jr      nz,l3a6e        ; move on if too many keys pressed
        call    l031e           ; test key value
        jr      nc,l3a6e        ; move on if unsatisfactory
        dec     d               ; D=$ff (L-mode)
        ld      e,a             ; E=key value
        call    l0333           ; decode
        jp      l2657           ; jump back into INKEY$ routine with keycode
.l3a6e  bit     4,(iy+$01)      ; check bit 4 of FLAGS
        jp      z,l2660         ; jump back into INKEY$ if in 48K BASIC
        di
        ei      
        jr      l3a79
.l3a79  ld      c,$00
        jp      l2660           ; jump back into INKEY$ routine


; Patch to "print a character" routine

.l3a7e  cp      $a3
        jr      z,l3a8e         ; move on for "SPECTRUM"
        cp      $a4
        jr      z,l3a8e         ; move on for "PLAY"
.l3a86  sub     $a5
        jp      nc,l0b5f        ; else rejoin print character routine
        jp      l0b56           ; with normal test done
.l3a8e  bit     4,(iy+$01)      ; check bit 4 of FLAGS
        jr      z,l3a86         ; move back if in 48K mode
        ld      de,l3aa8
        push    de              ; stack address to return to in this routine
        sub     $a3
        ld      de,l3ab1        ; address of "SPECTRUM"
        jr      z,l3aa2         ; move on if SPECTRUM
        ld      de,l3ab9        ; address of "PLAY"
.l3aa2  ld      a,$04
        push    af              ; stack $04 to get a trailing space
        jp      l0c17           ; output the token & return to next instruction
.l3aa8  scf                     
        bit     1,(iy+$01)
        ret     nz              ; exit if handling the printer
        jp      l0b03           ; else jump back into print routine

.l3ab1  defm    "SPECTRU"&('M'+$80)
.l3ab9  defm    "PLA"&('Y'+$80)
        

        jp      $3c01           ; what's this for???

        defs    319

        rst     $38
        rst     $38

.l3c01  defm    $13&$00&"19"&$13&$01&"87"       ; testcard message
                                                ; why is it here???

        defs    247

; -------------------------------
; THE 'ZX SPECTRUM CHARACTER SET'
; -------------------------------

.l3d00

; $20 - Character: ' '          CHR$(32)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000

; $21 - Character: '!'          CHR$(33)

           defb    $00        ; 00000000
           defb    $10        ; 00010000
           defb    $10        ; 00010000
           defb    $10        ; 00010000
           defb    $10        ; 00010000
           defb    $00        ; 00000000
           defb    $10        ; 00010000
           defb    $00        ; 00000000

; $22 - Character: '"'          CHR$(34)

           defb    $00        ; 00000000
           defb    $24        ; 00100100
           defb    $24        ; 00100100
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000

; $23 - Character: '#'          CHR$(35)

           defb    $00        ; 00000000
           defb    $24        ; 00100100
           defb    $7E        ; 10000010
           defb    $24        ; 00100100
           defb    $24        ; 00100100
           defb    $7E        ; 10000010
           defb    $24        ; 00100100
           defb    $00        ; 00000000

; $24 - Character: '$'          CHR$(36)

           defb    $00        ; 00000000
           defb    $08        ; 00001000
           defb    $3E        ; 01000010
           defb    $28        ; 00101000
           defb    $3E        ; 01000010
           defb    $0A        ; 00001010
           defb    $3E        ; 01000010
           defb    $08        ; 00001000

; $25 - Character: '%'          CHR$(37)

           defb    $00        ; 00000000
           defb    $62        ; 10100010
           defb    $64        ; 10100100
           defb    $08        ; 00001000
           defb    $10        ; 00010000
           defb    $26        ; 00101010
           defb    $46        ; 01001010
           defb    $00        ; 00000000

; $26 - Character: '&'          CHR$(38)

           defb    $00        ; 00000000
           defb    $10        ; 00010000
           defb    $28        ; 00101000
           defb    $10        ; 00010000
           defb    $2A        ; 00101010
           defb    $44        ; 01000100
           defb    $3A        ; 01001010
           defb    $00        ; 00000000

; $27 - Character: '''          CHR$(39)

           defb    $00        ; 00000000
           defb    $08        ; 00001000
           defb    $10        ; 00010000
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000

; $28 - Character: '('          CHR$(40)

           defb    $00        ; 00000000
           defb    $04        ; 00000100
           defb    $08        ; 00001000
           defb    $08        ; 00001000
           defb    $08        ; 00001000
           defb    $08        ; 00001000
           defb    $04        ; 00000100
           defb    $00        ; 00000000

; $29 - Character: ')'          CHR$(41)

           defb    $00        ; 00000000
           defb    $20        ; 00100000
           defb    $10        ; 00010000
           defb    $10        ; 00010000
           defb    $10        ; 00010000
           defb    $10        ; 00010000
           defb    $20        ; 00100000
           defb    $00        ; 00000000

; $2A - Character: '*'          CHR$(42)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $14        ; 00010100
           defb    $08        ; 00001000
           defb    $3E        ; 01000010
           defb    $08        ; 00001000
           defb    $14        ; 00010100
           defb    $00        ; 00000000

; $2B - Character: '+'          CHR$(43)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $08        ; 00001000
           defb    $08        ; 00001000
           defb    $3E        ; 01000010
           defb    $08        ; 00001000
           defb    $08        ; 00001000
           defb    $00        ; 00000000

; $2C - Character: ','          CHR$(44)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $08        ; 00001000
           defb    $08        ; 00001000
           defb    $10        ; 00010000

; $2D - Character: '-'          CHR$(45)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $3E        ; 01000010
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000

; $2E - Character: '.'          CHR$(46)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $18        ; 00101000
           defb    $18        ; 00101000
           defb    $00        ; 00000000

; $2F - Character: '/'          CHR$(47)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $02        ; 00000010
           defb    $04        ; 00000100
           defb    $08        ; 00001000
           defb    $10        ; 00010000
           defb    $20        ; 00100000
           defb    $00        ; 00000000

; $30 - Character: '0'          CHR$(48)

           defb    $00        ; 00000000
           defb    $3C        ; 01000100
           defb    $46        ; 01001010
           defb    $4A        ; 01001010
           defb    $52        ; 01010010
           defb    $62        ; 10100010
           defb    $3C        ; 01000100
           defb    $00        ; 00000000

; $31 - Character: '1'          CHR$(49)

           defb    $00        ; 00000000
           defb    $18        ; 00101000
           defb    $28        ; 00101000
           defb    $08        ; 00001000
           defb    $08        ; 00001000
           defb    $08        ; 00001000
           defb    $3E        ; 01000010
           defb    $00        ; 00000000

; $32 - Character: '2'          CHR$(50)

           defb    $00        ; 00000000
           defb    $3C        ; 01000100
           defb    $42        ; 01000010
           defb    $02        ; 00000010
           defb    $3C        ; 01000100
           defb    $40        ; 01000000
           defb    $7E        ; 10000010
           defb    $00        ; 00000000

; $33 - Character: '3'          CHR$(51)

           defb    $00        ; 00000000
           defb    $3C        ; 01000100
           defb    $42        ; 01000010
           defb    $0C        ; 00010100
           defb    $02        ; 00000010
           defb    $42        ; 01000010
           defb    $3C        ; 01000100
           defb    $00        ; 00000000

; $34 - Character: '4'          CHR$(52)

           defb    $00        ; 00000000
           defb    $08        ; 00001000
           defb    $18        ; 00101000
           defb    $28        ; 00101000
           defb    $48        ; 01001000
           defb    $7E        ; 10000010
           defb    $08        ; 00001000
           defb    $00        ; 00000000

; $35 - Character: '5'          CHR$(53)

           defb    $00        ; 00000000
           defb    $7E        ; 10000010
           defb    $40        ; 01000000
           defb    $7C        ; 10000100
           defb    $02        ; 00000010
           defb    $42        ; 01000010
           defb    $3C        ; 01000100
           defb    $00        ; 00000000

; $36 - Character: '6'          CHR$(54)

           defb    $00        ; 00000000
           defb    $3C        ; 01000100
           defb    $40        ; 01000000
           defb    $7C        ; 10000100
           defb    $42        ; 01000010
           defb    $42        ; 01000010
           defb    $3C        ; 01000100
           defb    $00        ; 00000000

; $37 - Character: '7'          CHR$(55)

           defb    $00        ; 00000000
           defb    $7E        ; 10000010
           defb    $02        ; 00000010
           defb    $04        ; 00000100
           defb    $08        ; 00001000
           defb    $10        ; 00010000
           defb    $10        ; 00010000
           defb    $00        ; 00000000

; $38 - Character: '8'          CHR$(56)

           defb    $00        ; 00000000
           defb    $3C        ; 01000100
           defb    $42        ; 01000010
           defb    $3C        ; 01000100
           defb    $42        ; 01000010
           defb    $42        ; 01000010
           defb    $3C        ; 01000100
           defb    $00        ; 00000000

; $39 - Character: '9'          CHR$(57)

           defb    $00        ; 00000000
           defb    $3C        ; 01000100
           defb    $42        ; 01000010
           defb    $42        ; 01000010
           defb    $3E        ; 01000010
           defb    $02        ; 00000010
           defb    $3C        ; 01000100
           defb    $00        ; 00000000

; $3A - Character: ':'          CHR$(58)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $10        ; 00010000
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $10        ; 00010000
           defb    $00        ; 00000000

; $3B - Character: ';'          CHR$(59)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $10        ; 00010000
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $10        ; 00010000
           defb    $10        ; 00010000
           defb    $20        ; 00100000

; $3C - Character: '<'          CHR$(60)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $04        ; 00000100
           defb    $08        ; 00001000
           defb    $10        ; 00010000
           defb    $08        ; 00001000
           defb    $04        ; 00000100
           defb    $00        ; 00000000

; $3D - Character: '='          CHR$(61)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $3E        ; 01000010
           defb    $00        ; 00000000
           defb    $3E        ; 01000010
           defb    $00        ; 00000000
           defb    $00        ; 00000000

; $3E - Character: '>'          CHR$(62)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $10        ; 00010000
           defb    $08        ; 00001000
           defb    $04        ; 00000100
           defb    $08        ; 00001000
           defb    $10        ; 00010000
           defb    $00        ; 00000000

; $3F - Character: '?'          CHR$(63)

           defb    $00        ; 00000000
           defb    $3C        ; 01000100
           defb    $42        ; 01000010
           defb    $04        ; 00000100
           defb    $08        ; 00001000
           defb    $00        ; 00000000
           defb    $08        ; 00001000
           defb    $00        ; 00000000

; $40 - Character: '@'          CHR$(64)

           defb    $00        ; 00000000
           defb    $3C        ; 01000100
           defb    $4A        ; 01001010
           defb    $56        ; 10101010
           defb    $5E        ; 10100010
           defb    $40        ; 01000000
           defb    $3C        ; 01000100
           defb    $00        ; 00000000

; $41 - Character: 'A'          CHR$(65)

           defb    $00        ; 00000000
           defb    $3C        ; 01000100
           defb    $42        ; 01000010
           defb    $42        ; 01000010
           defb    $7E        ; 10000010
           defb    $42        ; 01000010
           defb    $42        ; 01000010
           defb    $00        ; 00000000

; $42 - Character: 'B'          CHR$(66)

           defb    $00        ; 00000000
           defb    $7C        ; 10000100
           defb    $42        ; 01000010
           defb    $7C        ; 10000100
           defb    $42        ; 01000010
           defb    $42        ; 01000010
           defb    $7C        ; 10000100
           defb    $00        ; 00000000

; $43 - Character: 'C'          CHR$(67)

           defb    $00        ; 00000000
           defb    $3C        ; 01000100
           defb    $42        ; 01000010
           defb    $40        ; 01000000
           defb    $40        ; 01000000
           defb    $42        ; 01000010
           defb    $3C        ; 01000100
           defb    $00        ; 00000000

; $44 - Character: 'D'          CHR$(68)

           defb    $00        ; 00000000
           defb    $78        ; 10001000
           defb    $44        ; 01000100
           defb    $42        ; 01000010
           defb    $42        ; 01000010
           defb    $44        ; 01000100
           defb    $78        ; 10001000
           defb    $00        ; 00000000

; $45 - Character: 'E'          CHR$(69)

           defb    $00        ; 00000000
           defb    $7E        ; 10000010
           defb    $40        ; 01000000
           defb    $7C        ; 10000100
           defb    $40        ; 01000000
           defb    $40        ; 01000000
           defb    $7E        ; 10000010
           defb    $00        ; 00000000

; $46 - Character: 'F'          CHR$(70)

           defb    $00        ; 00000000
           defb    $7E        ; 10000010
           defb    $40        ; 01000000
           defb    $7C        ; 10000100
           defb    $40        ; 01000000
           defb    $40        ; 01000000
           defb    $40        ; 01000000
           defb    $00        ; 00000000

; $47 - Character: 'G'          CHR$(71)

           defb    $00        ; 00000000
           defb    $3C        ; 01000100
           defb    $42        ; 01000010
           defb    $40        ; 01000000
           defb    $4E        ; 01010010
           defb    $42        ; 01000010
           defb    $3C        ; 01000100
           defb    $00        ; 00000000

; $48 - Character: 'H'          CHR$(72)

           defb    $00        ; 00000000
           defb    $42        ; 01000010
           defb    $42        ; 01000010
           defb    $7E        ; 10000010
           defb    $42        ; 01000010
           defb    $42        ; 01000010
           defb    $42        ; 01000010
           defb    $00        ; 00000000

; $49 - Character: 'I'          CHR$(73)

           defb    $00        ; 00000000
           defb    $3E        ; 01000010
           defb    $08        ; 00001000
           defb    $08        ; 00001000
           defb    $08        ; 00001000
           defb    $08        ; 00001000
           defb    $3E        ; 01000010
           defb    $00        ; 00000000

; $4A - Character: 'J'          CHR$(74)

           defb    $00        ; 00000000
           defb    $02        ; 00000010
           defb    $02        ; 00000010
           defb    $02        ; 00000010
           defb    $42        ; 01000010
           defb    $42        ; 01000010
           defb    $3C        ; 01000100
           defb    $00        ; 00000000

; $4B - Character: 'K'          CHR$(75)

           defb    $00        ; 00000000
           defb    $44        ; 01000100
           defb    $48        ; 01001000
           defb    $70        ; 10010000
           defb    $48        ; 01001000
           defb    $44        ; 01000100
           defb    $42        ; 01000010
           defb    $00        ; 00000000

; $4C - Character: 'L'          CHR$(76)

           defb    $00        ; 00000000
           defb    $40        ; 01000000
           defb    $40        ; 01000000
           defb    $40        ; 01000000
           defb    $40        ; 01000000
           defb    $40        ; 01000000
           defb    $7E        ; 10000010
           defb    $00        ; 00000000

; $4D - Character: 'M'          CHR$(77)

           defb    $00        ; 00000000
           defb    $42        ; 01000010
           defb    $66        ; 10101010
           defb    $5A        ; 10101010
           defb    $42        ; 01000010
           defb    $42        ; 01000010
           defb    $42        ; 01000010
           defb    $00        ; 00000000

; $4E - Character: 'N'          CHR$(78)

           defb    $00        ; 00000000
           defb    $42        ; 01000010
           defb    $62        ; 10100010
           defb    $52        ; 01010010
           defb    $4A        ; 01001010
           defb    $46        ; 01001010
           defb    $42        ; 01000010
           defb    $00        ; 00000000

; $4F - Character: 'O'          CHR$(79)

           defb    $00        ; 00000000
           defb    $3C        ; 01000100
           defb    $42        ; 01000010
           defb    $42        ; 01000010
           defb    $42        ; 01000010
           defb    $42        ; 01000010
           defb    $3C        ; 01000100
           defb    $00        ; 00000000

; $50 - Character: 'P'          CHR$(80)

           defb    $00        ; 00000000
           defb    $7C        ; 10000100
           defb    $42        ; 01000010
           defb    $42        ; 01000010
           defb    $7C        ; 10000100
           defb    $40        ; 01000000
           defb    $40        ; 01000000
           defb    $00        ; 00000000

; $51 - Character: 'Q'          CHR$(81)

           defb    $00        ; 00000000
           defb    $3C        ; 01000100
           defb    $42        ; 01000010
           defb    $42        ; 01000010
           defb    $52        ; 01010010
           defb    $4A        ; 01001010
           defb    $3C        ; 01000100
           defb    $00        ; 00000000

; $52 - Character: 'R'          CHR$(82)

           defb    $00        ; 00000000
           defb    $7C        ; 10000100
           defb    $42        ; 01000010
           defb    $42        ; 01000010
           defb    $7C        ; 10000100
           defb    $44        ; 01000100
           defb    $42        ; 01000010
           defb    $00        ; 00000000

; $53 - Character: 'S'          CHR$(83)

           defb    $00        ; 00000000
           defb    $3C        ; 01000100
           defb    $40        ; 01000000
           defb    $3C        ; 01000100
           defb    $02        ; 00000010
           defb    $42        ; 01000010
           defb    $3C        ; 01000100
           defb    $00        ; 00000000

; $54 - Character: 'T'          CHR$(84)

           defb    $00        ; 00000000
           defb    $FE        ; 00000010
           defb    $10        ; 00010000
           defb    $10        ; 00010000
           defb    $10        ; 00010000
           defb    $10        ; 00010000
           defb    $10        ; 00010000
           defb    $00        ; 00000000

; $55 - Character: 'U'          CHR$(85)

           defb    $00        ; 00000000
           defb    $42        ; 01000010
           defb    $42        ; 01000010
           defb    $42        ; 01000010
           defb    $42        ; 01000010
           defb    $42        ; 01000010
           defb    $3C        ; 01000100
           defb    $00        ; 00000000

; $56 - Character: 'V'          CHR$(86)

           defb    $00        ; 00000000
           defb    $42        ; 01000010
           defb    $42        ; 01000010
           defb    $42        ; 01000010
           defb    $42        ; 01000010
           defb    $24        ; 00100100
           defb    $18        ; 00101000
           defb    $00        ; 00000000

; $57 - Character: 'W'          CHR$(87)

           defb    $00        ; 00000000
           defb    $42        ; 01000010
           defb    $42        ; 01000010
           defb    $42        ; 01000010
           defb    $42        ; 01000010
           defb    $5A        ; 10101010
           defb    $24        ; 00100100
           defb    $00        ; 00000000

; $58 - Character: 'X'          CHR$(88)

           defb    $00        ; 00000000
           defb    $42        ; 01000010
           defb    $24        ; 00100100
           defb    $18        ; 00101000
           defb    $18        ; 00101000
           defb    $24        ; 00100100
           defb    $42        ; 01000010
           defb    $00        ; 00000000

; $59 - Character: 'Y'          CHR$(89)

           defb    $00        ; 00000000
           defb    $82        ; 10000010
           defb    $44        ; 01000100
           defb    $28        ; 00101000
           defb    $10        ; 00010000
           defb    $10        ; 00010000
           defb    $10        ; 00010000
           defb    $00        ; 00000000

; $5A - Character: 'Z'          CHR$(90)

           defb    $00        ; 00000000
           defb    $7E        ; 10000010
           defb    $04        ; 00000100
           defb    $08        ; 00001000
           defb    $10        ; 00010000
           defb    $20        ; 00100000
           defb    $7E        ; 10000010
           defb    $00        ; 00000000

; $5B - Character: '['          CHR$(91)

           defb    $00        ; 00000000
           defb    $0E        ; 00010010
           defb    $08        ; 00001000
           defb    $08        ; 00001000
           defb    $08        ; 00001000
           defb    $08        ; 00001000
           defb    $0E        ; 00010010
           defb    $00        ; 00000000

; $5C - Character: '\'          CHR$(92)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $40        ; 01000000
           defb    $20        ; 00100000
           defb    $10        ; 00010000
           defb    $08        ; 00001000
           defb    $04        ; 00000100
           defb    $00        ; 00000000

; $5D - Character: ']'          CHR$(93)

           defb    $00        ; 00000000
           defb    $70        ; 10010000
           defb    $10        ; 00010000
           defb    $10        ; 00010000
           defb    $10        ; 00010000
           defb    $10        ; 00010000
           defb    $70        ; 10010000
           defb    $00        ; 00000000

; $5E - Character: '^'          CHR$(94)

           defb    $00        ; 00000000
           defb    $10        ; 00010000
           defb    $38        ; 01001000
           defb    $54        ; 01010100
           defb    $10        ; 00010000
           defb    $10        ; 00010000
           defb    $10        ; 00010000
           defb    $00        ; 00000000

; $5F - Character: '_'          CHR$(95)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $FF        ; 00000001

; $60 - Character: '`'          CHR$(96)

           defb    $00        ; 00000000
           defb    $1C        ; 00100100
           defb    $22        ; 00100010
           defb    $78        ; 10001000
           defb    $20        ; 00100000
           defb    $20        ; 00100000
           defb    $7E        ; 10000010
           defb    $00        ; 00000000

; $61 - Character: 'a'          CHR$(97)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $38        ; 01001000
           defb    $04        ; 00000100
           defb    $3C        ; 01000100
           defb    $44        ; 01000100
           defb    $3C        ; 01000100
           defb    $00        ; 00000000

; $62 - Character: 'b'          CHR$(98)

           defb    $00        ; 00000000
           defb    $20        ; 00100000
           defb    $20        ; 00100000
           defb    $3C        ; 01000100
           defb    $22        ; 00100010
           defb    $22        ; 00100010
           defb    $3C        ; 01000100
           defb    $00        ; 00000000

; $63 - Character: 'c'          CHR$(99)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $1C        ; 00100100
           defb    $20        ; 00100000
           defb    $20        ; 00100000
           defb    $20        ; 00100000
           defb    $1C        ; 00100100
           defb    $00        ; 00000000

; $64 - Character: 'd'          CHR$(100)

           defb    $00        ; 00000000
           defb    $04        ; 00000100
           defb    $04        ; 00000100
           defb    $3C        ; 01000100
           defb    $44        ; 01000100
           defb    $44        ; 01000100
           defb    $3C        ; 01000100
           defb    $00        ; 00000000

; $65 - Character: 'e'          CHR$(101)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $38        ; 01001000
           defb    $44        ; 01000100
           defb    $78        ; 10001000
           defb    $40        ; 01000000
           defb    $3C        ; 01000100
           defb    $00        ; 00000000

; $66 - Character: 'f'          CHR$(102)

           defb    $00        ; 00000000
           defb    $0C        ; 00010100
           defb    $10        ; 00010000
           defb    $18        ; 00101000
           defb    $10        ; 00010000
           defb    $10        ; 00010000
           defb    $10        ; 00010000
           defb    $00        ; 00000000

; $67 - Character: 'g'          CHR$(103)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $3C        ; 01000100
           defb    $44        ; 01000100
           defb    $44        ; 01000100
           defb    $3C        ; 01000100
           defb    $04        ; 00000100
           defb    $38        ; 01001000

; $68 - Character: 'h'          CHR$(104)

           defb    $00        ; 00000000
           defb    $40        ; 01000000
           defb    $40        ; 01000000
           defb    $78        ; 10001000
           defb    $44        ; 01000100
           defb    $44        ; 01000100
           defb    $44        ; 01000100
           defb    $00        ; 00000000

; $69 - Character: 'i'          CHR$(105)

           defb    $00        ; 00000000
           defb    $10        ; 00010000
           defb    $00        ; 00000000
           defb    $30        ; 01010000
           defb    $10        ; 00010000
           defb    $10        ; 00010000
           defb    $38        ; 01001000
           defb    $00        ; 00000000

; $6A - Character: 'j'          CHR$(106)

           defb    $00        ; 00000000
           defb    $04        ; 00000100
           defb    $00        ; 00000000
           defb    $04        ; 00000100
           defb    $04        ; 00000100
           defb    $04        ; 00000100
           defb    $24        ; 00100100
           defb    $18        ; 00101000

; $6B - Character: 'k'          CHR$(107)

           defb    $00        ; 00000000
           defb    $20        ; 00100000
           defb    $28        ; 00101000
           defb    $30        ; 01010000
           defb    $30        ; 01010000
           defb    $28        ; 00101000
           defb    $24        ; 00100100
           defb    $00        ; 00000000

; $6C - Character: 'l'          CHR$(108)

           defb    $00        ; 00000000
           defb    $10        ; 00010000
           defb    $10        ; 00010000
           defb    $10        ; 00010000
           defb    $10        ; 00010000
           defb    $10        ; 00010000
           defb    $0C        ; 00010100
           defb    $00        ; 00000000

; $6D - Character: 'm'          CHR$(109)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $68        ; 10101000
           defb    $54        ; 01010100
           defb    $54        ; 01010100
           defb    $54        ; 01010100
           defb    $54        ; 01010100
           defb    $00        ; 00000000

; $6E - Character: 'n'          CHR$(110)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $78        ; 10001000
           defb    $44        ; 01000100
           defb    $44        ; 01000100
           defb    $44        ; 01000100
           defb    $44        ; 01000100
           defb    $00        ; 00000000

; $6F - Character: 'o'          CHR$(111)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $38        ; 01001000
           defb    $44        ; 01000100
           defb    $44        ; 01000100
           defb    $44        ; 01000100
           defb    $38        ; 01001000
           defb    $00        ; 00000000

; $70 - Character: 'p'          CHR$(112)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $78        ; 10001000
           defb    $44        ; 01000100
           defb    $44        ; 01000100
           defb    $78        ; 10001000
           defb    $40        ; 01000000
           defb    $40        ; 01000000

; $71 - Character: 'q'          CHR$(113)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $3C        ; 01000100
           defb    $44        ; 01000100
           defb    $44        ; 01000100
           defb    $3C        ; 01000100
           defb    $04        ; 00000100
           defb    $06        ; 00001010

; $72 - Character: 'r'          CHR$(114)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $1C        ; 00100100
           defb    $20        ; 00100000
           defb    $20        ; 00100000
           defb    $20        ; 00100000
           defb    $20        ; 00100000
           defb    $00        ; 00000000

; $73 - Character: 's'          CHR$(115)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $38        ; 01001000
           defb    $40        ; 01000000
           defb    $38        ; 01001000
           defb    $04        ; 00000100
           defb    $78        ; 10001000
           defb    $00        ; 00000000

; $74 - Character: 't'          CHR$(116)

           defb    $00        ; 00000000
           defb    $10        ; 00010000
           defb    $38        ; 01001000
           defb    $10        ; 00010000
           defb    $10        ; 00010000
           defb    $10        ; 00010000
           defb    $0C        ; 00010100
           defb    $00        ; 00000000

; $75 - Character: 'u'          CHR$(117)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $44        ; 01000100
           defb    $44        ; 01000100
           defb    $44        ; 01000100
           defb    $44        ; 01000100
           defb    $38        ; 01001000
           defb    $00        ; 00000000

; $76 - Character: 'v'          CHR$(118)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $44        ; 01000100
           defb    $44        ; 01000100
           defb    $28        ; 00101000
           defb    $28        ; 00101000
           defb    $10        ; 00010000
           defb    $00        ; 00000000

; $77 - Character: 'w'          CHR$(119)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $44        ; 01000100
           defb    $54        ; 01010100
           defb    $54        ; 01010100
           defb    $54        ; 01010100
           defb    $28        ; 00101000
           defb    $00        ; 00000000

; $78 - Character: 'x'          CHR$(120)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $44        ; 01000100
           defb    $28        ; 00101000
           defb    $10        ; 00010000
           defb    $28        ; 00101000
           defb    $44        ; 01000100
           defb    $00        ; 00000000

; $79 - Character: 'y'          CHR$(121)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $44        ; 01000100
           defb    $44        ; 01000100
           defb    $44        ; 01000100
           defb    $3C        ; 01000100
           defb    $04        ; 00000100
           defb    $38        ; 01001000

; $7A - Character: 'z'          CHR$(122)

           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $7C        ; 10000100
           defb    $08        ; 00001000
           defb    $10        ; 00010000
           defb    $20        ; 00100000
           defb    $7C        ; 10000100
           defb    $00        ; 00000000

; $7B - Character: '{'          CHR$(123)

           defb    $00        ; 00000000
           defb    $0E        ; 00010010
           defb    $08        ; 00001000
           defb    $30        ; 01010000
           defb    $08        ; 00001000
           defb    $08        ; 00001000
           defb    $0E        ; 00010010
           defb    $00        ; 00000000

; $7C - Character: '|'          CHR$(124)

           defb    $00        ; 00000000
           defb    $08        ; 00001000
           defb    $08        ; 00001000
           defb    $08        ; 00001000
           defb    $08        ; 00001000
           defb    $08        ; 00001000
           defb    $08        ; 00001000
           defb    $00        ; 00000000

; $7D - Character: '}'          CHR$(125)

           defb    $00        ; 00000000
           defb    $70        ; 10010000
           defb    $10        ; 00010000
           defb    $0C        ; 00010100
           defb    $10        ; 00010000
           defb    $10        ; 00010000
           defb    $70        ; 10010000
           defb    $00        ; 00000000

; $7E - Character: '~'          CHR$(126)

           defb    $00        ; 00000000
           defb    $14        ; 00010100
           defb    $28        ; 00101000
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000
           defb    $00        ; 00000000

; $7F - Character: '(c)'        CHR$(127)

           defb    $3C        ; 01000100
           defb    $42        ; 01000010
           defb    $99        ; 10101001
           defb    $A1        ; 10100001
           defb    $A1        ; 10100001
           defb    $99        ; 10101001
           defb    $42        ; 01000010
           defb    $3C        ; 01000100

; ----------------------------------------------------------------------------------------------------

; =========================
; 48K BASIC ROM differences
; =========================
;
; The 48K BASIC ROM in the +3 differs from the original 48K ROM in the
; following respects:
; 
; $0013	Filler byte changed from $ff to $a7 (reason unknown)
; $004b	Maskable interrupt routine now calls new code at $386e
; $006d	NMI routine bug fixed
; $09a2	Tape message changed to "Press REC & PLAY, then any key."
; $0b52	Token-checking code replaced with jump to new code at $3a7e
; $1349	Error-message code replaced with jump to new code at $3a29
; $1540	Copyright message changed to "(c) 1982 Amstrad"
; $1b7d	STMT-R-1 code replaced with call to new code at $3a3b
; $1bf4	STMT-NEXT code replaced with call to new code at $3a4b
; $2646	Call to KEY-SCAN replaced with jump to new code at $3a5a
; $386e	Patch to maskable interrupt routine, with disk motor timeout check
; $3a00	Printer i/o channel routines
; 
; ; The following routines all seem to enter routines in ROM 0 within
; ; the reset code; presumably these are left over from 128K and can
; ; be removed?
; 
; $3a29	Patch to error message routine
; $3a3b	Patch to STMT-RET routine
; $3a4b	Patch to STMT-NEXT routine
; $3a5a	Patch to INKEY$ function (definitely redundant on +3)
; $3a7e	Patch to print character routine, providing SPECTRUM & PLAY
; $3c01	Testcard message "1987"
; 
; Remaining bytes between $386e and $3cff are set to zero; in the original
; 48K ROM, they were all set to $ff.


; @module   float
; @summary  Float arithmetic, comparison, maths and text through the ROM calculator; integer conversions.
; @exports  FBinary, FMod, FCompare, FUnary, FFromU32, FFromI32, FToI32, FToText, FStr, PrintFloat, FVal
; @exports  FText, FTextLen, FNormalise, FFromFixed, FToFixed, FStack, FFetch
; @requires rom, strings, print
;
; A Float is the ROM's five-byte number (runtime-abi.md §2.1), in registers as A = exponent, E, D, C,
; B = the mantissa (the sign in bit 7 of E). On the Z80 stack it takes six bytes: `push bc`,
; `push de`, `push af` leave [pad][A][E][D][C][B] at ascending addresses.
;
; FBinary and FCompare take their left operand on the stack under the return address and remove it,
; the right one in A-E-D-C-B, and the calculator operation in L: that is where the compiler's
; stack machine has a binary operator's operands. The calculator is reached with `rst $28` from a
; small stub whose operation byte is written before each use, so the routines are not re-entrant:
; an interrupt handler must not use Float. The calculator's errors ("6 Number too big", "A Invalid
; argument") are the ROM's own reports.
;
; The ROM entry points used, all documented 48K ROM routines: STK-STORE $2AB6 (stacks A-E-D-C-B),
; STK-FETCH $2BF1 (unstacks them), PRINT-FP $2DE3 (prints the top of the stack through the current
; channel), DEC-TO-FP $2C9B (reads a decimal number at CH_ADD).

; ------------------------------------------------------------------------------------------------
; left <op> right. In: L = the calculator operation ($0F addition, $03 subtract, $04 multiply,
; $05 division, $06 to-power, $32 n-mod-m). Out: A-E-D-C-B. Changes F, HL.
FBinary:
    call FTwoOperands
    call FCalc
    jp FFetch

; left MOD right: left - TRUNCATE(left / right) * right, so the result takes the dividend's sign
; (the semantics annex's mod-sign; the ROM's n-mod-m rounds the quotient down instead). In: the left
; operand on the stack, the right one in A-E-D-C-B. Out: A-E-D-C-B. Changes F, HL.
FMod:
    call FTwoOperands
    push iy
    ld iy,$5c3a
    rst $28
    .defb $01               ; exchange                 [b][a]
    .defb $c1               ; st-mem-1: a
    .defb $01               ; exchange                 [a][b]
    .defb $c0               ; st-mem-0: b
    .defb $05               ; division                 [a/b]
    .defb $3a               ; truncate
    .defb $e0               ; get-mem-0                [t][b]
    .defb $04               ; multiply                 [t*b]
    .defb $e1               ; get-mem-1                [t*b][a]
    .defb $01               ; exchange                 [a][t*b]
    .defb $03               ; subtract
    .defb $38               ; end-calc
    pop iy
    jp FFetch

; left <op> right, a comparison. In: L = the calculator operation ($09 <=, $0A >=, $0B <>, $0C >,
; $0D <, $0E =). Out: A = 1 when it holds, else 0. Changes F, BC, DE, HL.
FCompare:
    call FTwoOperands
    call FCalc
    call FFetch             ; the calculator gives 1 or 0 in the small-integer form: D is it
    ld a,d
    ret

; <op> x. In: A-E-D-C-B = x, L = the calculator operation ($1B negate, $2A abs, $29 sgn, $27 int,
; $28 sqr, $1F sin, $20 cos, $21 tan, $22 asn, $23 acs, $24 atn, $25 ln, $26 exp). Out: A-E-D-C-B.
; Changes F, HL.
FUnary:
    push af
    ld a,l
    ld (FCalcOp),a
    pop af
    call FStack
    call FCalc
    jp FFetch

; Stacks the left operand (from under the caller's return address), then the right one (A-E-D-C-B),
; and sets the stub's operation to L.
FTwoOperands:
    push af
    ld a,l
    ld (FCalcOp),a
    pop af
    ld (FRight),a
    ld (FRight+1),de
    ld (FRight+3),bc        ; the right operand waits in memory
    pop hl                  ; HL = the return address into FBinary/FCompare
    ld (FReturn),hl
    pop hl                  ; HL = their caller's return address
    pop af
    pop de
    pop bc                  ; A-E-D-C-B = the left operand
    push hl
    ld hl,(FReturn)
    push hl
    call FStack
    ld a,(FRight)
    ld de,(FRight+1)
    ld bc,(FRight+3)
    jp FStack

; The calculator on what is stacked: FCalcOp, end-calc. B is the operation too, for the comparisons,
; which take it from BREG.
FCalc:
    push iy
    ld iy,$5c3a
    ld a,(FCalcOp)
    ld b,a
    rst $28
FCalcOp:
    .defb $0f
    .defb $38               ; end-calc
    pop iy
    ret

; Stacks A-E-D-C-B on the calculator stack (FStack), or unstacks it (FFetch).
FStack:
    call RomCall
    .defw $2ab6             ; STK-STORE
    ret

FFetch:
    call RomCall
    .defw $2bf1             ; STK-FETCH
    ret

FReturn:
    .defw 0
FRight:
    .defs 5

; ------------------------------------------------------------------------------------------------
; An unsigned (FFromU32) or signed (FFromI32) 32-bit integer DE:HL as a Float, exactly (a Float has
; 32 mantissa bits). Values that fit use the small-integer form, as the ROM does. Out: A-E-D-C-B.
; Changes F, HL.
FFromI32:
    bit 7,d
    jr z,FFromU32
    ld a,d
    and e
    inc a
    jr nz,FFromI32Big       ; DE is not $FFFF: below -65536
    ld a,h
    or l
    jr z,FFromI32Big        ; -65536 has no small-integer form
    ld d,l                  ; -65535..-1: the small-integer form holds the 16-bit two's complement
    ld c,h
    ld e,$ff
    xor a
    ld b,a
    ret
FFromI32Big:
    xor a                   ; DE:HL = -DE:HL
    sub l
    ld l,a
    ld a,0
    sbc a,h
    ld h,a
    ld a,0
    sbc a,e
    ld e,a
    ld a,0
    sbc a,d
    ld d,a
    call FFromU32
    set 7,e                 ; the sign
    ret
FFromU32:
    ld a,d
    or e
    jr nz,FFromU32Big
    ld d,l                  ; 0..65535: the small-integer form
    ld c,h
    ld e,a
    ld b,a
    ret
FFromU32Big:
    ld a,160                ; the exponent of a value with bit 31 set
; A Float from a non-zero DE:HL whose bit 31 would have exponent A (160 for the integer itself).
; Out: A-E-D-C-B, positive. Changes F, HL.
FNormalise:
    bit 7,d
    jr nz,FFromU32Done
    add hl,hl
    rl e
    rl d
    dec a
    jr FNormalise
FFromU32Done:
    res 7,d                 ; the implicit 1 gives way to the sign (positive)
    ld b,l
    ld c,h
    ld l,e
    ld e,d
    ld d,l
    ret

; ------------------------------------------------------------------------------------------------
; A Fixed (16.16 in DE:HL) as a Float, exactly. Out: A-E-D-C-B. Changes F, HL.
FFromFixed:
    ld a,d
    or e
    or h
    or l
    jr z,FZero
    bit 7,d
    jr z,FFromFixedPositive
    xor a                   ; the magnitude
    sub l
    ld l,a
    ld a,0
    sbc a,h
    ld h,a
    ld a,0
    sbc a,e
    ld e,a
    ld a,0
    sbc a,d
    ld d,a
    ld a,144                ; bit 31 of the raw value is worth 2^15
    call FNormalise
    set 7,e
    ret
FFromFixedPositive:
    ld a,144
    jp FNormalise
FZero:
    xor a
    ld e,a
    ld d,a
    ld c,a
    ld b,a
    ret

; A Float as a Fixed: the value times 65536, rounded towards minus infinity and taken modulo 2^32
; (types.conversions). In: A-E-D-C-B. Out: DE:HL. Changes AF, BC.
FToFixed:
    or a
    jr nz,FToFixedFull
    call FToI32             ; the small-integer form: a whole number, the integer part
    ex de,hl
    ld hl,0
    ret
FToFixedFull:
    add a,16                ; times 65536
    jr nc,FToI32            ; (FToI32 rounds down and keeps the low 32 bits)
    ld hl,0                 ; 2^111 or more: no bits below 2^32 are left
    ld d,h
    ld e,l
    ret

; ------------------------------------------------------------------------------------------------
; A Float as a 32-bit integer: rounded towards minus infinity (the ROM's INT), then taken modulo
; 2^32, as a conversion to an integer type does (types.conversions). In: A-E-D-C-B. Out: DE:HL.
; Changes AF, BC.
FToI32:
    ld l,$27                ; int
    call FUnary
    or a
    jr nz,FToI32Full
    ld l,d                  ; the small-integer form: E = the sign, D-C = the value
    ld h,c
    ld d,e
    ret
FToI32Full:                 ; an integer of magnitude 2^(A-129) or more
    ld h,c
    ld l,b                  ; HL = the mantissa's low word
    ld b,e                  ; B bit 7 = the sign
    ld c,d
    ld d,e
    set 7,d
    ld e,c                  ; DE = the mantissa's high word, with the implicit 1
    ld c,a
    ld a,160
    sub c                   ; A = the right shift that leaves the integer
    jr c,FToI32Left
    jr z,FToI32Sign
FToI32Right:
    srl d
    rr e
    rr h
    rr l
    dec a
    jr nz,FToI32Right
    jr FToI32Sign
FToI32Left:                 ; 2^32 or more: only the bits below 2^32 are kept
    neg
    cp 32
    jr c,FToI32LeftLoop
    ld hl,0
    ld d,h
    ld e,l
    ret
FToI32LeftLoop:
    add hl,hl
    rl e
    rl d
    dec a
    jr nz,FToI32LeftLoop
FToI32Sign:
    bit 7,b
    ret z
    xor a
    sub l
    ld l,a
    ld a,0
    sbc a,h
    ld h,a
    ld a,0
    sbc a,e
    ld e,a
    ld a,0
    sbc a,d
    ld d,a
    ret

; ------------------------------------------------------------------------------------------------
; A Float as the ROM prints it, into FText (FTextLen characters): PRINT-FP writes through a channel
; of Klive's own whose output routine collects the characters. In: A-E-D-C-B. Changes AF, BC, DE,
; HL.
FToText:
    call FStack
    xor a
    ld (FTextLen),a
    ld hl,($5c51)           ; CURCHL
    push hl
    ld hl,FChannel
    ld ($5c51),hl
    call RomCall
    .defw $2de3             ; PRINT-FP
    pop hl
    ld ($5c51),hl
    ret

; The channel PRINT-FP writes to: the output and input routines, then the channel letter.
FChannel:
    .defw FTextOut
    .defw FTextOut
    .defb 'F'

; The channel's output routine: A = the character. Changes nothing.
FTextOut:
    push af
    push de
    push hl
    ld hl,FTextLen
    ld e,(hl)
    inc (hl)
    ld d,0
    ld hl,FText
    add hl,de
    ld (hl),a
    pop hl
    pop de
    pop af
    ret

FTextLen:
    .defb 0
FText:
    .defs 24

; ------------------------------------------------------------------------------------------------
; STR: a Float as a String. In: A-E-D-C-B. Out: HL (0 when the heap is full). Changes AF, BC, DE.
FStr:
    call FToText
    ld a,(FTextLen)
    ld c,a
    ld b,0
    call StrAlloc
    ld a,h
    or l
    ret z
    push hl
    inc hl
    inc hl
    ex de,hl
    ld hl,FText
    ld a,(FTextLen)
    ld c,a
    ld b,0
    ldir
    pop hl
    ret

; PRINT of a Float. In: A-E-D-C-B. Changes AF, BC, DE, HL.
PrintFloat:
    call FToText
    ld hl,FText
    ld a,(FTextLen)
    ld b,a
PrintFloatLoop:
    ld a,(hl)
    push hl
    push bc
    call PrintChar
    pop bc
    pop hl
    inc hl
    djnz PrintFloatLoop
    ret

; ------------------------------------------------------------------------------------------------
; VAL: the number a String holds (spaces, an optional sign, then a decimal number as BASIC writes
; it, then spaces). A String that holds anything else gives 0 and sets ERR_NR to 11 ("C Nonsense in
; BASIC") without stopping the program. In: HL = the String, A = free flags (bit 0 frees it).
; Out: A-E-D-C-B. Changes F, HL.
FVal:
    push af                 ; S: [flags]
    push hl                 ; S: [string][flags]
    call StrLen             ; BC = the length
    ld de,FText
    ld a,b
    or a
    jr nz,FValTooLong
    ld a,c
    cp 22
    jr nc,FValTooLong       ; FText holds 22 characters and the terminator
    or a
    jr z,FValCopied
    inc hl
    inc hl
    ldir
FValCopied:
    ld a,$0d
    ld (de),a
    pop hl                  ; S: [flags]
    pop af                  ; S: []
    rra
    call c,Free
    ; --- Skip spaces and the sign
    ld hl,FText
    ld c,0                  ; C = 1 for a minus sign
FValSpaces:
    ld a,(hl)
    cp ' '
    jr nz,FValSign
    inc hl
    jr FValSpaces
FValSign:
    cp '+'
    jr z,FValSigned
    cp '-'
    jr nz,FValNumber
    inc c
FValSigned:
    inc hl
    ld a,(hl)
FValNumber:
    cp '.'
    jr z,FValParse
    cp '0'
    jr c,FValBad
    cp '9'+1
    jr nc,FValBad
FValParse:
    push bc                 ; S: [sign]
    ld de,($5c5d)           ; CH_ADD: BASIC's own place in its running line
    push de                 ; S: [CH_ADD][sign]
    ld ($5c5d),hl
    call RomCall
    .defw $2c9b             ; DEC-TO-FP: A = the first character, CH_ADD at it
    ld hl,($5c5d)
    pop de                  ; S: [sign]
    ld ($5c5d),de
    ; --- Only spaces may follow the number
FValTail:
    ld a,(hl)
    cp ' '
    jr nz,FValEnd
    inc hl
    jr FValTail
FValEnd:
    cp $0d
    call FFetch
    pop hl                  ; L = the sign                          S: []
    jr nz,FValDrop
    dec l
    ret nz
    ld l,$1b                ; negate
    jp FUnary
FValDrop:
    ld (iy+0),11
    jr FValZero
FValTooLong:
    pop hl
    pop af
    rra
    call c,Free
FValBad:
    ld (iy+0),11            ; ERR_NR: "C Nonsense in BASIC"
FValZero:
    xor a
    ld e,a
    ld d,a
    ld c,a
    ld b,a
    ret

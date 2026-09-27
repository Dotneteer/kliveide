; @module   arith16
; @summary  8- and 16-bit multiply, divide and modulo.
; @exports  Mul8, DivModU8, DivModI8, Mul16, DivModU16, DivModI16
; @exports  AbsI8, AbsI16, SgnI8, SgnI16
;
; Operands follow runtime-abi.md §7: 8-bit in A and H, 16-bit in HL and DE. A product keeps its low
; 8 or 16 bits, the same for signed and unsigned operands. Signed division truncates towards zero
; and the remainder takes the dividend's sign. Division by zero gives the dividend as the remainder
; and a quotient of the magnitudes with every bit set, then given the quotient's sign: -7 / 0 is 1,
; as upstream gives (the semantics annex's integer-division-by-zero and mod-sign).

; ------------------------------------------------------------------------------------------------
; A * H. Out: A. Changes F, B, H, L.
#ifmod Next
; --- The Next: the Z80N's 8x8 multiply (DE kept, as the contract promises)
Mul8:
    push de
    ld d,a
    ld e,h
    mul d,e
    ld a,e
    pop de
    ret
#else
Mul8:
    ld l,a
    xor a
    ld b,8
Mul8Loop:
    add a,a
    sla h
    jr nc,Mul8Next
    add a,l
Mul8Next:
    djnz Mul8Loop
    ret
#endif

; ------------------------------------------------------------------------------------------------
; A / H, unsigned. Out: A = quotient, L = remainder. Changes F, B, C.
DivModU8:
    ld c,a                  ; C = dividend, becomes the quotient
    xor a                   ; A = remainder
    ld b,8
DivModU8Loop:
    sla c
    rla
    jr c,DivModU8Sub        ; nine bits: certainly not less than the divisor
    cp h
    jr c,DivModU8Next
DivModU8Sub:
    sub h
    inc c
DivModU8Next:
    djnz DivModU8Loop
    ld l,a
    ld a,c
    ret

; ------------------------------------------------------------------------------------------------
; A / H, signed. Out: A = quotient, L = remainder. Changes F, B, C, H.
DivModI8:
    ld b,a                  ; B = dividend
    xor h
    ld c,a                  ; bit 7 of C: the quotient's sign
    ld a,h
    or a
    jp p,DivModI8Pos
    neg
    ld h,a                  ; H = |divisor|
DivModI8Pos:
    ld a,b
    or a
    push af                 ; S: [dividend's sign]
    jp p,DivModI8Div
    neg                     ; A = |dividend|
DivModI8Div:
    push bc                 ; S: [C][sign]
    call DivModU8
    pop bc                  ; C = quotient sign                    S: [sign]
    bit 7,c
    jr z,DivModI8Rem
    neg
DivModI8Rem:
    ld h,a                  ; H = quotient
    pop af                  ; S: []
    ld a,l
    jp p,DivModI8Done
    neg
    ld l,a
DivModI8Done:
    ld a,h
    ret

; ------------------------------------------------------------------------------------------------
; HL * DE. Out: HL. Changes AF, BC, DE.
#ifmod Next
; --- The Next: the low 16 bits of the product from three 8x8 multiplies,
; --- aL*bL + ((aH*bL + aL*bH) << 8)
Mul16:
    ld b,h                  ; B = aH
    ld c,l                  ; C = aL
    ld h,d                  ; H = bH
    ld l,e                  ; L = bL
    ld d,c                  ; DE = aL, bL
    mul d,e                 ; DE = aL*bL
    push de
    ld d,b
    ld e,l
    mul d,e                 ; E = low(aH*bL)
    ld a,e
    ld d,c
    ld e,h
    mul d,e                 ; E = low(aL*bH)
    add a,e
    pop hl                  ; HL = aL*bL
    add a,h
    ld h,a
    ret
#else
Mul16:
    ld b,h
    ld c,l                  ; BC = multiplicand
    ld hl,0
    ld a,16
Mul16Loop:
    add hl,hl
    ex de,hl
    add hl,hl               ; carry = the multiplier's next bit
    ex de,hl
    jr nc,Mul16Next
    add hl,bc
Mul16Next:
    dec a
    jr nz,Mul16Loop
    ret
#endif

; ------------------------------------------------------------------------------------------------
; HL / DE, unsigned. Out: HL = quotient, DE = remainder. Changes AF, BC.
DivModU16:
    ld a,h
    ld c,l                  ; AC = dividend, becomes the quotient
    ld hl,0                 ; HL = remainder
    ld b,16
DivModU16Loop:
    sla c
    rla
    adc hl,hl
    jr c,DivModU16Sub       ; seventeen bits: certainly not less than the divisor
    sbc hl,de
    jr nc,DivModU16Set
    add hl,de
    djnz DivModU16Loop
    jr DivModU16Done
DivModU16Sub:
    or a
    sbc hl,de
DivModU16Set:
    inc c
    djnz DivModU16Loop
DivModU16Done:
    ex de,hl
    ld h,a
    ld l,c
    ret

; ------------------------------------------------------------------------------------------------
; HL / DE, signed. Out: HL = quotient, DE = remainder. Changes AF, BC.
DivModI16:
    ld a,h
    xor d
    push af                 ; S: [quotient sign]
    ld a,h
    push af                 ; S: [dividend sign][quotient sign]
    or a
    call m,DivModNegHL
    ex de,hl
    ld a,h
    or a
    call m,DivModNegHL
    ex de,hl
    call DivModU16
    pop af                  ; S: [quotient sign]
    ex de,hl
    or a
    call m,DivModNegHL      ; the remainder takes the dividend's sign
    ex de,hl
    pop af                  ; S: []
    or a
    ret p
    ; fall through: negate the quotient

; HL = -HL. Changes AF.
DivModNegHL:
    xor a
    sub l
    ld l,a
    sbc a,a
    sub h
    ld h,a
    ret

; ------------------------------------------------------------------------------------------------
; ABS of a signed byte A (-128 stays -128, as its negation wraps). Out: A. Changes F.
AbsI8:
    or a
    ret p
    neg
    ret

; ABS of a signed word HL (-32768 stays). Out: HL. Changes AF.
AbsI16:
    bit 7,h
    ret z
    jp DivModNegHL

; SGN of a signed byte A: -1, 0 or 1. Out: A. Changes F.
SgnI8:
    or a
    ret z
    ld a,1
    ret p
    ld a,$ff
    ret

; SGN of a signed word HL: -1, 0 or 1. Out: A. Changes F.
SgnI16:
    ld a,h
    or a
    ld a,$ff
    ret m
    ld a,h
    or l
    ret z
    ld a,1
    ret

; @module   arith32
; @summary  32-bit multiply, divide and modulo (Long and ULong).
; @exports  Mul32, DivU32, ModU32, DivI32, ModI32
;
; Every routine takes its left operand on the stack under the return address (pushed high word
; first, so the low word is on top) and its right operand in DE:HL (DE = the high word); it removes
; the left operand and gives the result in DE:HL. That is where the compiler's stack machine has
; the operands of a binary operator. Division truncates towards zero; a remainder takes the
; dividend's sign. Dividing by zero gives a quotient with every bit set and the dividend as the
; remainder (the semantics annex's integer-division-by-zero).
;
; The routines keep their operands in memory, so they are not re-entrant: an interrupt handler must
; not use 32-bit multiply or divide while the program it interrupted is in one.

; ------------------------------------------------------------------------------------------------
; The low 32 bits of left * right (the same for signed and unsigned). Changes AF, BC.
Mul32:
    call Arith32Operands
    ld hl,0
    ld de,0                 ; DE:HL = the product so far
    ld b,32
Mul32Loop:
    add hl,hl
    ex de,hl
    adc hl,hl
    ex de,hl                ; product <<= 1
    push hl
    ld hl,Arith32B
    sla (hl)
    inc hl
    rl (hl)
    inc hl
    rl (hl)
    inc hl
    rl (hl)                 ; carry = the multiplier's next bit, from the top
    pop hl
    jr nc,Mul32Next
    push bc
    ld bc,(Arith32A)
    add hl,bc
    ex de,hl
    ld bc,(Arith32A+2)
    adc hl,bc
    ex de,hl                ; product += multiplicand
    pop bc
Mul32Next:
    djnz Mul32Loop
    ret

; ------------------------------------------------------------------------------------------------
; left / right and left MOD right. Change AF, BC.
DivU32:
    call Arith32Operands
    call DivMod32
Arith32Quotient:
    ld hl,(Arith32A)
    ld de,(Arith32A+2)
    ret

ModU32:
    call Arith32Operands
    call DivMod32
Arith32Remainder:
    ld hl,(Arith32R)
    ld de,(Arith32R+2)
    ret

DivI32:
    call Arith32Operands
    call DivModSigned32
    ld a,(Arith32QSign)
    or a
    ld hl,Arith32A
    call m,Neg32Mem
    jr Arith32Quotient

ModI32:
    call Arith32Operands
    call DivModSigned32
    ld a,(Arith32RSign)
    or a
    ld hl,Arith32R
    call m,Neg32Mem
    jr Arith32Remainder

; ------------------------------------------------------------------------------------------------
; Moves the right operand (DE:HL) to Arith32B and the left one (under the caller's return address)
; to Arith32A, removing it from the stack. Changes BC, DE, HL.
Arith32Operands:
    ld (Arith32B),hl
    ld (Arith32B+2),de
    pop bc                  ; BC = the return address into the routine
    pop de                  ; DE = the caller's return address
    pop hl
    ld (Arith32A),hl
    pop hl
    ld (Arith32A+2),hl
    push de
    push bc
    ret

; Arith32A / Arith32B, unsigned, by restoring division: the quotient replaces Arith32A, the
; remainder is in Arith32R. Changes AF, BC, DE, HL.
DivMod32:
    ld hl,0
    ld (Arith32R),hl
    ld (Arith32R+2),hl
    ld b,32
DivMod32Loop:
    ld hl,Arith32A          ; Arith32R follows it: shift the 64 bits R:A left by one
    sla (hl)
    inc hl
    rl (hl)
    inc hl
    rl (hl)
    inc hl
    rl (hl)
    inc hl
    rl (hl)
    inc hl
    rl (hl)
    inc hl
    rl (hl)
    inc hl
    rl (hl)
    sbc a,a
    ld c,a                  ; C = $FF: the remainder has 33 bits, so it is not less than the divisor
    ld hl,(Arith32R)
    ld de,(Arith32B)
    or a
    sbc hl,de
    push hl
    ld hl,(Arith32R+2)
    ld de,(Arith32B+2)
    sbc hl,de
    pop de                  ; HL:DE = remainder - divisor; carry = it went below zero
    jr nc,DivMod32Take
    inc c
    jr nz,DivMod32Next      ; C was 0: the remainder is less than the divisor
DivMod32Take:
    ld (Arith32R),de
    ld (Arith32R+2),hl
    ld hl,Arith32A
    inc (hl)                ; the quotient bit (the shift left bit 0 clear)
DivMod32Next:
    djnz DivMod32Loop
    ret

; DivMod32 of the operands' magnitudes, noting the signs the results take. Changes AF, BC, DE, HL.
DivModSigned32:
    ld a,(Arith32A+3)
    ld (Arith32RSign),a
    ld hl,Arith32B+3
    xor (hl)
    ld (Arith32QSign),a
    ld a,(Arith32A+3)
    or a
    ld hl,Arith32A
    call m,Neg32Mem
    ld a,(Arith32B+3)
    or a
    ld hl,Arith32B
    call m,Neg32Mem
    jr DivMod32

; Negates the 32-bit value at HL. Changes AF, HL.
Neg32Mem:
    xor a
    sub (hl)
    ld (hl),a
    inc hl
    ld a,0
    sbc a,(hl)
    ld (hl),a
    inc hl
    ld a,0
    sbc a,(hl)
    ld (hl),a
    inc hl
    ld a,0
    sbc a,(hl)
    ld (hl),a
    ret

Arith32A:
    .defs 4
Arith32R:                   ; must follow Arith32A (DivMod32 shifts them as one)
    .defs 4
Arith32B:
    .defs 4
Arith32QSign:
    .defb 0
Arith32RSign:
    .defb 0

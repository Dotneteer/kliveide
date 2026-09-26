; @module   fixed
; @summary  Fixed (16.16) multiply and divide.
; @exports  FixMul, FixDiv
; @requires errors
;
; A Fixed is a 32-bit two's complement number of 65536ths, in DE:HL (DE = the integer part, HL = the
; fraction). Addition, subtraction, comparison and MOD are those of the 32-bit integers (MOD of the
; raw values is the Fixed MOD, with the dividend's sign). Like the arith32 routines these take the
; left operand on the stack under the return address (high word pushed first) and the right one in
; DE:HL, remove the left one and give the result in DE:HL. They keep their work in memory, so they
; are not re-entrant.

; ------------------------------------------------------------------------------------------------
; left * right: the 64-bit product shifted right by 16, rounded towards minus infinity, as the
; compiler folds it. Changes AF, BC.
FixMul:
    call FixOperands
    ld hl,FixP
    ld b,8
    xor a
FixMulClear:
    ld (hl),a
    inc hl
    djnz FixMulClear
    ld b,32
FixMulLoop:
    ld hl,FixP              ; P <<= 1
    sla (hl)
    ld c,7
FixMulShift:
    inc hl
    rl (hl)
    dec c
    jr nz,FixMulShift
    ld hl,FixB              ; carry = the multiplier's next bit, from the top
    sla (hl)
    inc hl
    rl (hl)
    inc hl
    rl (hl)
    inc hl
    rl (hl)
    jr nc,FixMulNext
    ld hl,FixP              ; P += the multiplicand
    ld de,FixA
    ld c,4
    or a
FixMulAdd:
    ld a,(de)
    adc a,(hl)
    ld (hl),a
    inc hl
    inc de
    dec c
    jr nz,FixMulAdd
    ld c,4
FixMulCarry:
    ld a,(hl)
    adc a,0
    ld (hl),a
    inc hl
    dec c
    jr nz,FixMulCarry
FixMulNext:
    djnz FixMulLoop
    ld hl,FixP
    ld b,8
    call FixSigned          ; the signed product, whose bits 16-47 are the floor of it / 65536
    ld hl,(FixP+2)
    ld de,(FixP+4)
    ret

; ------------------------------------------------------------------------------------------------
; left / right: (left * 65536) / right, the quotient truncated towards zero and taken modulo 2^32,
; as the compiler folds it. Division by zero stops with "6 Number too big". Changes AF, BC.
FixDiv:
    call FixOperands
    ld hl,(FixB)
    ld a,h
    or l
    ld hl,(FixB+2)
    or h
    or l
    ld a,5                  ; ERR_NR 5: "6 Number too big"
    jp z,RaiseError
    ld hl,0
    ld (FixN),hl            ; N = the dividend's magnitude * 65536 (48 bits)
    ld (FixR),hl
    ld (FixR+2),hl          ; R = 0
    ld hl,(FixA)
    ld (FixN+2),hl
    ld hl,(FixA+2)
    ld (FixN+4),hl
    ld b,48
FixDivLoop:
    ld hl,FixN              ; FixR follows FixN: shift the 80 bits R:N left by one
    sla (hl)
    ld c,9
FixDivShift:
    inc hl
    rl (hl)
    dec c
    jr nz,FixDivShift
    sbc a,a
    ld c,a                  ; C = $FF: R has 33 bits, so it is not less than the divisor
    ld hl,(FixR)
    ld de,(FixB)
    or a
    sbc hl,de
    push hl
    ld hl,(FixR+2)
    ld de,(FixB+2)
    sbc hl,de
    pop de                  ; HL:DE = R - divisor
    jr nc,FixDivTake
    inc c
    jr nz,FixDivNext
FixDivTake:
    ld (FixR),de
    ld (FixR+2),hl
    ld hl,FixN
    inc (hl)                ; the quotient bit
FixDivNext:
    djnz FixDivLoop
    ld hl,FixN
    ld b,4
    call FixSigned
    ld hl,(FixN)
    ld de,(FixN+2)
    ret

; ------------------------------------------------------------------------------------------------
; Moves the right operand (DE:HL) to FixB and the left one (under the caller's return address) to
; FixA, removing it, as magnitudes; FixSign bit 7 is set when exactly one was negative.
FixOperands:
    ld (FixB),hl
    ld (FixB+2),de
    pop bc                  ; the return address into FixMul/FixDiv
    pop de                  ; their caller's return address
    pop hl
    ld (FixA),hl
    pop hl
    ld (FixA+2),hl
    push de
    push bc
    ld a,(FixA+3)
    ld hl,FixB+3
    xor (hl)
    ld (FixSign),a
    ld hl,FixA
    call FixMagnitude
    ld hl,FixB
FixMagnitude:               ; negates the four bytes at HL when they are negative
    push hl
    inc hl
    inc hl
    inc hl
    bit 7,(hl)
    pop hl
    ret z
    ld b,4
    jr FixNegate

; Negates the B-byte number at HL when FixSign says the result is negative. Changes AF, B, HL.
FixSigned:
    ld a,(FixSign)
    rla
    ret nc
FixNegate:                  ; negates the B-byte number at HL
    or a
FixNegateLoop:
    ld a,0
    sbc a,(hl)
    ld (hl),a
    inc hl
    djnz FixNegateLoop
    ret

FixA:
    .defs 4
FixB:
    .defs 4
FixSign:
    .defb 0
FixP:
    .defs 8
FixN:
    .defs 6
FixR:                       ; must follow FixN (FixDiv shifts them as one)
    .defs 4

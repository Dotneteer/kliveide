; @module   random
; @summary  RND and RANDOMIZE: a 32-bit linear congruential generator.
; @exports  Rnd, Randomize, RandomizeFrames, RndSeed
; @requires float, arith32
;
; The state steps as state * 1664525 + 1013904223 (mod 2^32), which visits every 32-bit value once
; per period of 2^32 (the spec's RND). RND is the new state divided by 2^32: a Float in [0, 1).

; ------------------------------------------------------------------------------------------------
; RND. Out: A-E-D-C-B. Changes F, HL.
Rnd:
    ld hl,(RndSeed+2)
    push hl
    ld hl,(RndSeed)
    push hl                 ; the left operand of Mul32: the state
    ld hl,$660d
    ld de,$0019             ; 1664525
    call Mul32
    ld bc,$f35f
    add hl,bc
    ex de,hl
    ld bc,$3c6e             ; + 1013904223
    adc hl,bc
    ex de,hl
    ld (RndSeed),hl
    ld (RndSeed+2),de
    ld a,d
    or e
    or h
    or l
    jr z,RndZero
    ld a,128                ; bit 31 is worth 2^-1
    jp FNormalise
RndZero:
    xor a
    ld e,a
    ld d,a
    ld c,a
    ld b,a
    ret

; RANDOMIZE n: the state becomes DE:HL. Changes nothing.
Randomize:
    ld (RndSeed),hl
    ld (RndSeed+2),de
    ret

; RANDOMIZE: the state becomes the FRAMES counter. Changes AF, DE, HL.
RandomizeFrames:
    ld hl,($5c78)
    ld a,($5c7a)
    ld e,a
    ld d,0
    jr Randomize

RndSeed:
    .defw 0, 0

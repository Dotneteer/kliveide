; SAM Coupé SAA 1099 listening demo (dev/scripts/sam-parity/listen.cjs). Plays each part for a few
; seconds, with the border showing its number, then a black-border pause, and loops:
;   1 (blue)    tone: middle C on channel 0, both sides, no envelope
;   2 (red)     envelope alone: repeating triangle on channel 2 (no tone or noise), stepped by tone 1
;   3 (magenta) envelope gated by the tone: channel 2's tone on, under the same triangle
;   4 (green)   noise on channel 3: 31.25 kHz, then 15.6 kHz, then 7.8 kHz
;   5 (cyan)    plucked notes: single decay (shape 2) on channel 2's tone, retriggered every half second
;   6 (yellow)  stereo: the same tone on the left, then the right, then mirrored envelope on both
    .model SAMCOUPE

Start:
    di
    ld sp,$BFFF
Loop:
    ld hl,Part1
    ld a,1
    call Play
    ld b,9
    call Wait

    ld hl,Part2
    ld a,2
    call Play
    ld b,9
    call Wait

    ld hl,Part3
    ld a,3
    call Play
    ld b,9
    call Wait

    ld hl,Part4a
    ld a,4
    call Play
    ld b,4
    call Wait
    ld hl,Part4b
    ld a,4
    call Play
    ld b,4
    call Wait
    ld hl,Part4c
    ld a,4
    call Play
    ld b,4
    call Wait

    ld hl,Part5
    ld a,5
    call Play
    ld d,8
Pluck:
    ld hl,Retrigger
    ld a,5
    call Play
    ld b,2
    call Wait
    dec d
    jr nz,Pluck

    ld hl,Part6a
    ld a,6
    call Play
    ld b,4
    call Wait
    ld hl,Part6b
    ld a,6
    call Play
    ld b,4
    call Wait
    ld hl,Part6c
    ld a,6
    call Play
    ld b,6
    call Wait

    ld hl,Silence
    xor a
    call Play
    ld b,6
    call Wait
    jp Loop

; Writes the border (A), then the (register, value) pairs at HL until a register of $FF
Play:
    out ($FE),a
PlayNext:
    ld a,(hl)
    cp $FF
    ret z
    inc hl
    ld bc,$01FF
    out (c),a           ; the SAA's address
    ld a,(hl)
    inc hl
    ld bc,$00FF
    out (c),a           ; the SAA's data
    jr PlayNext

; Waits about B x 0.33 seconds
Wait:
    push de
WaitOuter:
    ld de,0
WaitInner:
    dec de
    ld a,d
    or e
    jr nz,WaitInner
    djnz WaitOuter
    pop de
    ret

; --- Every part starts from the same state: synced, all off, then released with sound on
Part1:
    .defb 28,2, 20,0, 21,0, 24,0, 25,0
    .defb 0,0, 1,0, 2,0, 3,0, 4,0, 5,0
    .defb 0,$FF, 8,33, 16,$03, 20,$01, 28,1
    .defb $FF
Part2:
    .defb 28,2, 20,0, 21,0, 0,0
    .defb 2,$FF, 9,200, 16,$70, 24,$80|(5<<1), 28,1
    .defb $FF
Part3:
    .defb 10,100, 17,$04, 20,$04
    .defb $FF
Part4a:
    .defb 28,2, 20,0, 24,0, 2,0
    .defb 3,$FF, 21,$08, 22,$00, 28,1
    .defb $FF
Part4b:
    .defb 22,$10
    .defb $FF
Part4c:
    .defb 22,$20
    .defb $FF
Part5:
    .defb 28,2, 21,0, 3,0
    .defb 2,$FF, 10,33, 17,$03, 9,0, 16,$00, 20,$04, 28,1
    .defb $FF
Retrigger:
    .defb 24,$80|(2<<1)
    .defb $FF
Part6a:
    .defb 28,2, 20,0, 24,0, 2,0
    .defb 0,$0F, 8,33, 16,$03, 20,$01, 28,1
    .defb $FF
Part6b:
    .defb 0,$F0
    .defb $FF
Part6c:
    .defb 0,0, 2,$FF, 10,33, 17,$03, 9,200, 16,$60, 24,$80|(5<<1)|1, 20,$00
    .defb $FF
Silence:
    .defb 28,0
    .defb $FF

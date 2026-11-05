; A small sprite scene for the Sprite Inspector screenshots: three patterns, a unified anchor with a
; relative, 4- and 8-bit sprites, a hidden one, one off screen and one with a stale attr4.
    .model Next
    .org $8000
Start:
    di
    ld bc,$303B
    xor a
    out (c),a           ; pattern slot 0, sprite 0
    ld bc,$005B
    ld d,0
Pat0:                   ; pattern 0: a gradient, every byte its own index
    out (c),d
    inc d
    jr nz,Pat0
    ld e,0
Pat1:                   ; pattern 1: a red frame, transparent inside
    ld a,e
    and $0F
    jr z,Edge
    cp $0F
    jr z,Edge
    ld a,e
    and $F0
    jr z,Edge
    cp $F0
    jr z,Edge
    ld a,$E3
    jr Put1
Edge:
    ld a,$E0
Put1:
    out (c),a
    inc e
    jr nz,Pat1
    ld e,0
Pat2:                   ; pattern 2: 4-bit stripes, two halves
    ld a,e
    and $10
    ld a,$12
    jr z,Put2
    ld a,$45
Put2:
    out (c),a
    inc e
    jr nz,Pat2
    ld bc,$303B
    xor a
    out (c),a           ; back to sprite 0
    ld hl,Attrs
    ld bc,$0057
    ld d,AttrsEnd-Attrs
Attr:
    ld a,(hl)
    out (c),a
    inc hl
    dec d
    jr nz,Attr
    nextreg $15,%00000011   ; sprites on, over the border
Park:
    jr Park
Attrs:
    .db 100, 80, $00, $C0, $2A  ; #0 anchor, unified, 2x, pattern 0
    .db 16, 0, $00, $C1, $40    ; #1 relative, pattern 1
    .db 200, 60, $2A, $81       ; #2 4-byte, palette 2, X mirror, rotated, pattern 1
    .db 40, 150, $50, $C2, $80  ; #3 4-bit, pattern 2 low half, palette 5
    .db 70, 150, $50, $C2, $C0  ; #4 4-bit, pattern 2 high half (N6)
    .db 10, 10, $00, $01        ; #5 visible bit clear
    .db 74, 120, $01, $80       ; #6 X = 330: off screen
    .db $36, 100, $01, $80      ; #7 X = 310: partly off screen
    .db 120, 180, $00, $82      ; #8 8-bit on pattern 2: read both ways
AttrsEnd:

; A small tilemap scene for the Tilemap Inspector screenshots: eight framed 4-bit tiles (tile 0
; blank), one asymmetric tile shown in all eight orientations along row 10, palette offsets by
; column band, a scroll and a clip window. Definitions at $6000, the 40x32 map at $6800.
    .model Next
    .org $8000
Start:
    di
    ld hl,$6000         ; tile 0: transparent (nibble 0 = $4C)
    ld b,32
T0:
    ld (hl),0
    inc hl
    djnz T0
    ld c,1              ; tiles 1-7: colour c framed in colour 15
Tiles:
    ld e,0
TB:
    ld a,e
    and $1C
    jr z,Border         ; row 0
    cp $1C
    jr z,Border         ; row 7
    ld a,e
    and $03
    jr z,Left
    cp $03
    jr z,Right
    ld a,c
    rlca
    rlca
    rlca
    rlca
    or c
    jr Put
Left:
    ld a,$F0
    or c
    jr Put
Right:
    ld a,c
    rlca
    rlca
    rlca
    rlca
    or $0F
    jr Put
Border:
    ld a,$FF
Put:
    ld (hl),a
    inc hl
    inc e
    ld a,e
    cp 32
    jr nz,TB
    inc c
    ld a,c
    cp 8
    jr nz,Tiles
    ld e,0              ; tile 8: top row colour 13, left half colour 14 (asymmetric)
T8:
    ld a,e
    and $1C
    ld a,$DD
    jr z,Put8
    ld a,e
    and $02
    ld a,$EE
    jr z,Put8
    xor a
Put8:
    ld (hl),a
    inc hl
    inc e
    ld a,e
    cp 32
    jr nz,T8

    ld hl,$6800         ; the map
    ld d,0              ; row
Row:
    ld e,0              ; column
Col:
    ld a,d
    cp 10
    jr nz,Normal
    ld (hl),8           ; row 10: tile 8, transform = (column & 7) << 1, palette offset 2
    inc hl
    ld a,e
    and 7
    add a,a
    or $20
    ld (hl),a
    jr Next
Normal:
    ld a,d              ; tile = (row / 4 + column / 4) & 7
    rrca
    rrca
    and $3F
    ld b,a
    ld a,e
    rrca
    rrca
    and $3F
    add a,b
    and 7
    ld (hl),a
    inc hl
    ld a,e              ; palette offset = (column / 8) & 3
    rrca
    rrca
    rrca
    and 3
    rlca
    rlca
    rlca
    rlca
    ld (hl),a
Next:
    inc hl
    inc e
    ld a,e
    cp 40
    jr nz,Col
    inc d
    ld a,d
    cp 32
    jr nz,Row

    nextreg $6E,$28     ; map at $6800
    nextreg $6F,$20     ; definitions at $6000
    nextreg $6C,$00
    nextreg $4C,$00     ; nibble 0 is transparent
    nextreg $2F,0
    nextreg $30,12      ; scroll X
    nextreg $31,8       ; scroll Y
    nextreg $1C,$08     ; reset the tilemap clip index
    nextreg $1B,8
    nextreg $1B,151
    nextreg $1B,8
    nextreg $1B,247
    nextreg $6B,$80     ; on, 40x32, 2-byte entries
    jr $

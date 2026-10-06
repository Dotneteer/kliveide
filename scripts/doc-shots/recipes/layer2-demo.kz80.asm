; A double-buffered Layer 2 scene for the Layer 2 Inspector screenshots: 320x256 from bank 9 ($12),
; a colour ramp by column with a transparent band (index $E3) across rows 96-127, a shadow layer from
; bank 14 ($13) whose first 16K is drawn green through the $123B window with bit 3 set, then a scroll
; of (40, 16). It leaves $123B mapping the shadow bank for writes, as a program mid-frame would.
    .model Next
    .org $8000
Start:
    di
    nextreg $07,3       ; 28 MHz: the fill takes a few frames, not seventy
    nextreg $70,$10     ; 320x256, palette offset 0
    nextreg $14,$E3     ; the global transparency colour: set it, the firmware may not leave $E3
    nextreg $12,9       ; displayed: banks 9-13
    nextreg $13,14      ; shadow: banks 14-18
    nextreg $1C,$01     ; reset the Layer 2 clip index
    nextreg $18,0
    nextreg $18,159
    nextreg $18,0
    nextreg $18,255
    ld e,0              ; the column at the start of this 8K page (low byte)
    ld d,18             ; 8K pages 18-27: banks 9-13
Page:
    ld a,d
    nextreg $56,a       ; the page at $C000
    ld hl,$C000
Fill:
    ld a,h              ; column-major: H - $C0 + E is the column, L the row
    sub $C0
    add a,e
    ld b,a
    ld a,l
    and $E0
    cp $60              ; rows 96-127: the transparent index
    ld a,b
    jr nz,Put
    ld a,$E3
Put:
    ld (hl),a
    inc hl
    ld a,h
    cp $E0
    jr nz,Fill
    ld a,e
    add a,32
    ld e,a
    inc d
    ld a,d
    cp 28
    jr nz,Page
    nextreg $56,0
    ld bc,$123B         ; shown, writes mapped, shadow bank, segment 0
    ld a,$0B
    out (c),a
    ld hl,$0000
Shadow:
    ld (hl),$1C         ; green, into bank 14
    inc hl
    ld a,h
    cp $40
    jr nz,Shadow
    nextreg $16,40      ; scroll X
    nextreg $17,16      ; scroll Y
    jr $

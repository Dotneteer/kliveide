; The beam position screenshots (`.plans/BEAM_POSITION_OVERLAY_PLAN.md` Phase 6): the Layers demo's
; scene (`layers-demo.kz80.asm`: blue paper, a Layer 2 ramp, four red sprites, and a Copper list that
; switches the layer order from SLU to LSU at line 96), ending in a loop that changes the border every
; ~20 lines instead of `jr $`. A breakpoint on `Mark` stops the machine somewhere mid-frame, with the
; border stripes drawn this frame above the beam and last frame's below it.
    .model Next
    .org $8000
Start:
    di
    nextreg $07,3       ; 28 MHz
    nextreg $14,$E3     ; the global transparency colour: set it, the firmware may not leave $E3
    nextreg $4A,$00     ; fallback: black
    ld hl,$5800         ; ULA: paper blue, ink white, an empty bitmap
    ld de,$5801
    ld bc,767
    ld (hl),$0F
    ldir
    ld hl,$4000
    ld de,$4001
    ld bc,$17FF
    ld (hl),0
    ldir
    ld a,1
    out ($FE),a         ; border blue
    nextreg $70,$00     ; Layer 2 256x192, palette offset 0
    nextreg $12,9       ; banks 9-11
    nextreg $1C,$01
    nextreg $18,0
    nextreg $18,255
    nextreg $18,0
    nextreg $18,191
    ld d,18             ; 8K pages 18-23: rows 0-191, 32 rows a page
Page:
    ld a,d
    nextreg $56,a
    ld hl,$C000
Fill:
    ld a,l              ; x
    cp 96
    ld a,$E3            ; the left 96 columns: transparent
    jr c,Put
    ld a,h              ; the row within the page, plus x: a diagonal ramp
    add a,l
Put:
    ld (hl),a
    inc hl
    ld a,h
    cp $E0
    jr nz,Fill
    inc d
    ld a,d
    cp 24
    jr nz,Page
    nextreg $56,0
    ld bc,$123B         ; Layer 2 shown
    ld a,$02
    out (c),a
    ld bc,$303B         ; sprite pattern 0: red, a transparent frame
    xor a
    out (c),a
    ld e,0
Pattern:
    ld a,e
    and $0F
    jr z,Clear
    cp $0F
    jr z,Clear
    ld a,e
    and $F0
    jr z,Clear
    cp $F0
    jr z,Clear
    ld a,$E0
    jr Pixel
Clear:
    ld a,$E3
Pixel:
    out ($5B),a
    inc e
    jr nz,Pattern
    ld bc,$303B         ; four sprites at y 112, 32x32
    xor a
    out (c),a
    ld b,4
    ld e,70
Sprite:
    ld a,e
    out ($57),a         ; X
    ld a,112
    out ($57),a         ; Y
    xor a
    out ($57),a         ; palette offset 0, no mirror, X8 0
    ld a,$C0
    out ($57),a         ; visible, pattern 0, a fifth byte
    ld a,$0A
    out ($57),a         ; scale x2, x2
    ld a,e
    add a,48
    ld e,a
    djnz Sprite
    nextreg $15,$03     ; sprites on, over the border, SLU
    nextreg $62,$00     ; the Copper list: SLU at the top, LSU from line 96
    nextreg $61,$00
    nextreg $60,$15     ; MOVE $15,$03
    nextreg $60,$03
    nextreg $60,$80     ; WAIT 96,0
    nextreg $60,$60
    nextreg $60,$15     ; MOVE $15,$07
    nextreg $60,$07
    nextreg $60,$FF     ; HALT
    nextreg $60,$FF
    nextreg $62,$C0     ; restart at every frame
    ld e,0
Loop:                   ; a new border colour every ~20 lines, so this frame differs from the last
    ld bc,1500
Delay:
    dec bc
    ld a,b
    or c
    jr nz,Delay
    ld a,e
    and 7
    out ($FE),a
    inc e
Mark:                   ; the recipe's breakpoint: a stop somewhere mid-frame
    nop
    jr Loop


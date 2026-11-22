; Demo: Copper Sky
; Chapter: Raster Effects (content/next-display/raster-effects.mdx), "A sky gradient from one
; palette entry" and "A status bar that stands still"
;
; The Copper rewrites ULA palette entry 16, PAPER 0 and border 0, before each of the frame's 311
; lines, behind a skyline in INK 0. Its list also sets the ULA X scroll, NextReg $26, to 0 for the
; status bar, lines 152-191, and back to the playfield's scroll after it. Once a frame the CPU
; changes that one value in the Copper's memory, so the skyline scrolls and the bar stands still.
; The list is written with .copper, in copper-sky-data.kz80.asm (bank 25).
; Changes NextRegs $26, $40, $43, $56 (for a moment), $60-$62, ULA palette 1's entry 16 and the
; border; puts all of them back.

CopperSkyTitle:
    .defn "Copper Sky"

CsBank:     .equ 25
CsValue:    .equ CsScrollMove - CsList + 1  ; the byte address of the scroll MOVE's value
CsInstrs:   .equ (CsListEnd - CsList) / 2   ; the list's length in instructions

CopperSky:
    call CsDraw
    ld de,$1300             ; row 19: the status bar
    ld c,$78
    ld hl,CopperSkyTitle
    call PrintText
    ld de,$1400             ; row 20
    ld c,$38
    ld hl,CsText1
    call PrintText
    ld de,$1500
    ld hl,CsText2
    call PrintText
    call ShowMenuFooter

    ; Keep entry 16 as it is, all nine bits
    nextreg $40,16
    ld a,$41
    call ReadNextRegA
    ld (CsSaved),a
    ld a,$44
    call ReadNextRegA
    ld (CsSaved + 1),a
    xor a
    out ($FE),a             ; border 0: entry 16 too

    ; Copy the list from bank 25 to the Copper, two bytes at a time through $63
    ld a,$56
    call ReadNextRegA
    push af                 ; slot 6's page
    nextreg $56,CsBank * 2  ; bank 25's first 8K at $C000
    nextreg $62,0           ; stop the Copper; the address's top bits are 0
    nextreg $61,0
    ld hl,CsList
    ld bc,CsInstrs
CsUpload:
    ld a,(hl)
    nextreg $63,a           ; the high byte...
    inc hl
    ld a,(hl)
    nextreg $63,a           ; ...and the low one: both are written now
    inc hl
    dec bc
    ld a,b
    or c
    jr nz,CsUpload
    pop af
    nextreg $56,a           ; slot 6 as it was
    nextreg $62,%11000000   ; mode 11: from instruction 0 at line 0 of every frame

    call WaitNoKey          ; the menu's key may still be down
    xor a
    ld (CsScroll),a
CsFrame:
    halt
    ld a,(CsScroll)
    inc a
    ld (CsScroll),a
    nextreg $61,CsValue & $FF
    nextreg $62,%11000000 | (CsValue >> 8)  ; the same mode: the Copper runs on
    nextreg $60,a           ; the new scroll, one byte
    call ScanKeys
    inc a                   ; $FF, no key, becomes 0
    jr z,CsFrame

    ; Put everything back
    nextreg $62,0           ; stop the Copper
    nextreg $26,0
    nextreg $43,0
    nextreg $40,16
    ld a,(CsSaved)
    nextreg $44,a
    ld a,(CsSaved + 1)
    nextreg $44,a
    nextreg $40,0
    ld a,7
    out ($FE),a
    jp WaitNoKey

; Draws the skyline in rows 0-18: PAPER 0, INK 0, a building in every column, with windows
CsDraw:
    ld hl,$5800
    ld de,$5801
    ld bc,19 * 32 - 1
    ld (hl),0               ; PAPER 0, INK 0: entry 16 and entry 0
    ldir
    ld e,0                  ; the column, 0-31
CsDrawColumn:
    ld hl,CsHeights
    ld a,e
    and 15
    add hl,a
    ld a,(hl)               ; the building's height in rows
    ld b,a
    ld a,19
    sub b
    add a,a
    add a,a
    add a,a
    ld d,a                  ; its top pixel line
CsDrawLine:
    push de
    ld a,e
    add a,a
    add a,a
    add a,a
    ld e,a
    pixelad
    pop de
    ld a,d
    and 7
    cp 3
    ld a,$FF
    jr c,CsDrawByte
    ld a,$99                ; lines 3-7 of a row: two windows
CsDrawByte:
    ld (hl),a
    inc d
    ld a,d
    cp 152
    jr nz,CsDrawLine
    inc e
    ld a,e
    cp 32
    jr nz,CsDrawColumn
    ret

CsHeights:
    .defb 6, 9, 4, 12, 7, 5, 10, 3, 8, 13, 6, 4, 9, 7, 11, 5
CsScroll:
    .defb 0
CsSaved:
    .defw 0
CsText1:
    .defn "Entry 16 gets a colour per line"
CsText2:
    .defn "$26 is 0 for lines 152-191"

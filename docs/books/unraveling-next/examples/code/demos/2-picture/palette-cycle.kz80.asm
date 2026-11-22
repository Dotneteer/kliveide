; Demo: Palette Cycle
; Chapter: Colours and Palettes (content/next-display/palettes.mdx), "What palettes make cheap"
;
; Fills sixteen rows of the ULA screen with diagonal stripes in BRIGHT INK 1-7, once. From then
; on it never touches the screen: every fourth frame it rotates the seven colours of the ULA
; palette's entries 9-15 (BRIGHT INK 1-7) by one, and the water flows.
; Changes ULA palette 1's entries 9-15 and NextReg $40; reads the entries first, all nine bits,
; and writes them back.

PaletteCycleTitle:
    .defn "Palette Cycle"

PcFirst:    .equ 9          ; the first entry: BRIGHT INK 1
PcCount:    .equ 7          ; entries 9-15

PaletteCycle:
    ld de,$0000
    ld c,$78
    ld hl,PaletteCycleTitle
    call PrintText
    ld de,$0200             ; row 2
    ld c,$38
    ld hl,PcText1
    call PrintText
    ld de,$0300
    ld hl,PcText2
    call PrintText
    call PcDraw
    call ShowMenuFooter
    call WaitNoKey          ; the menu's key may still be down

    ; Keep entries 9-15 as they are: the upper eight bits from $41, the ninth from $44
    ld hl,PcSaved
    ld e,PcFirst
PcSave:
    ld a,e
    nextreg $40,a           ; the index; reads never move it on
    ld a,$41
    call ReadNextRegA
    ld (hl),a
    inc hl
    ld a,$44
    call ReadNextRegA
    ld (hl),a
    inc hl
    inc e
    ld a,e
    cp PcFirst + PcCount
    jr nz,PcSave

PcFrame:
    halt
    ld a,(Frames)
    and 3
    jr nz,PcKey             ; one step every fourth frame
    ; Rotate the table of seven colours by one...
    ld hl,PcColours
    ld a,(hl)
    ld de,PcColours
    inc hl
    ld bc,PcCount - 1
    ldir
    ld (de),a
    ; ...and write it to entries 9-15: seven register writes, no pixels
    nextreg $43,%00000000   ; ULA palette 1, the index moves on
    nextreg $40,PcFirst
    ld hl,PcColours
    ld b,PcCount
PcWrite:
    ld a,(hl)
    nextreg $41,a           ; RRRGGGBB
    inc hl
    djnz PcWrite
PcKey:
    call ScanKeys
    inc a                   ; $FF, no key, becomes 0
    jr z,PcFrame

    ; Put the seven entries back, two writes each through $44
    nextreg $40,PcFirst
    ld hl,PcSaved
    ld b,PcCount * 2
PcRestore:
    ld a,(hl)
    nextreg $44,a
    inc hl
    djnz PcRestore
    nextreg $40,0
    jp WaitNoKey

; Rows 5-20, every pixel set; cell (row, column) gets BRIGHT INK 1 + (row + column) mod 7
PcDraw:
    ld d,5
PcDrawRow:
    ld e,0
PcDrawCell:
    push de
    ld a,d
    add a,a
    add a,a
    add a,a
    ld b,a
    ld a,e
    add a,a
    add a,a
    add a,a
    ld e,a
    ld d,b
    pixelad                 ; HL: the cell's top pixel byte
    ld b,8
PcDrawLine:
    ld (hl),$FF
    pixeldn
    djnz PcDrawLine
    pop de
    ld a,d
    add a,e
PcMod7:
    sub PcCount
    jr nc,PcMod7
    add a,PcCount + 1       ; 1-7
    or $40                  ; BRIGHT
    ld c,a
    ld l,d
    ld h,0
    add hl,hl
    add hl,hl
    add hl,hl
    add hl,hl
    add hl,hl               ; row * 32
    ld a,e
    add hl,a
    add hl,$5800
    ld (hl),c
    inc e
    ld a,e
    cp 32
    jr nz,PcDrawCell
    inc d
    ld a,d
    cp 21
    jr nz,PcDrawRow
    ret

; Seven blues, dark to light and back, in RRRGGGBB
PcColours:
    .defb $01, $02, $03, $13, $7F, $13, $03
PcSaved:
    .defs PcCount * 2
PcText1:
    .defn "Seven palette entries rotate"
PcText2:
    .defn "every 4th frame; no pixel moves"

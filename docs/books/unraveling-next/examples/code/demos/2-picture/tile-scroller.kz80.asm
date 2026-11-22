; Demo: Tile Scroller
; Chapter: The Tilemap (content/next-display/tilemap.mdx)
;
; Fills the tilemap with one tile, the ROM's letter F with a dot at its top-left corner, in its
; eight orientations: attribute bits 3-1 = 0-7 in eight columns, then two empty columns, across the
; whole map. Each row has its own palette offset. 4 and 8 switch between 40 and 80 columns
; (NextReg $6B bit 6). Q, A, O and P scroll the map with NextRegs $2F, $30 and $31; it wraps round
; at 320 dots across, or 640 half-width dots in 80 columns, and at 256 lines down. Any other key
; returns to the menu.
; The map is in bank 5 at $5B00 (NextReg $6E = $1B), the two tiles at $6F00 ($6F = $2F), beside
; the ULA's screen. The tiles' background, dot value $F, is transparent (NextReg $4C), so the ULA
; shows through: its paper and the border are black while the demo runs. The tilemap's clip window
; (NextReg $1B, its index reset through NextReg $1C) leaves the bottom three text rows to the ULA.
; Changes NextRegs $1B, $2F, $30, $31, $4C, $6B, $6E and $6F, and the border; puts them back.

TileScrollerTitle:
    .defn "Tile Scroller"

TsMap:      .equ $5B00      ; NextReg $6E = $1B: bank 5, 27 x 256 bytes in
TsTiles:    .equ $6F00      ; NextReg $6F = $2F: 47 x 256 bytes in
TsGlyph:    .equ $3D00 + ('F' - 32) * 8     ; the letter F in the ROM's font

TileScroller:
    ReadNextReg($6B)
    ld (TsOld6B),a
    ReadNextReg($6E)
    ld (TsOld6E),a
    ReadNextReg($6F)
    ld (TsOld6F),a
    ReadNextReg($4C)
    ld (TsOld4C),a

    ; Tile 0: 32 bytes of $FF, every dot transparent
    ld hl,TsTiles
    ld de,TsTiles + 1
    ld bc,31
    ld (hl),$FF
    ldir
    ; Tile 1: the ROM's F, a bit a dot, becomes 4-bit dots: ink 3, background $F
    ex de,hl                ; HL: tile 1
    ld de,TsGlyph
    ld c,8
TsTileRow:
    ld a,(de)
    inc de
    push de
    ld e,a                  ; the row's eight dots, bit 7 on the left
    ld b,4
TsTileByte:
    ld a,$FF
    sla e
    jr nc,TsTileLeft
    and $3F                 ; the left dot: 3
TsTileLeft:
    sla e
    jr nc,TsTileRight
    and $F3                 ; the right dot: 3
TsTileRight:
    ld (hl),a
    inc hl
    djnz TsTileByte
    pop de
    dec c
    jr nz,TsTileRow
    ld a,$CF
    ld (TsTiles + 32),a     ; the top-left dot: $C, to show the orientation

    nextreg $6E,$1B         ; the map at $5B00
    nextreg $6F,$2F         ; the tiles at $6F00
    nextreg $4C,$0F         ; dot value $F is transparent
    nextreg $1C,8           ; bit 3: reset the index of the tilemap's clip window
    nextreg $1B,0           ; X1
    nextreg $1B,159         ; X2, in units of two dots
    nextreg $1B,0           ; Y1
    nextreg $1B,199         ; Y2: the wide area's line 199, above text row 21
    xor a
    out ($FE),a             ; black border
    ld hl,$5800
    ld de,$5801
    ld bc,21 * 32 - 1
    ld (hl),a
    ldir                    ; text rows 0-20: black paper
    ld de,$1600             ; row 22
    ld c,$38
    ld hl,TsKeysText
    call PrintText
    call ShowMenuFooter
    ld a,40
    call TsSetColumns
    call WaitNoKey          ; the menu's key may still be down

TsFrame:
    halt
    call ScanKeys
    inc a
    jr z,TsFrame            ; no key
    dec a
    ld hl,KeyChars
    add hl,a
    ld a,(hl)
    or a
    jr z,TsFrame            ; a shift key alone
    ld hl,(TsX)
    ld de,(TsXWrap)
    cp 'O'
    jr z,TsLeft
    cp 'P'
    jr z,TsRight
    ld hl,TsY
    cp 'Q'
    jr z,TsUp
    cp 'A'
    jr z,TsDown
    ld b,40
    cp '4'
    jr z,TsNewColumns
    ld b,80
    cp '8'
    jr nz,TsExit            ; any other key: back to the menu
TsNewColumns:
    ld a,b
    call TsSetColumns
    call WaitNoKey
    jr TsFrame

TsLeft:
    ld a,h
    or l
    jr nz,TsLeft1
    ex de,hl                ; from 0 to the width
TsLeft1:
    dec hl
    jr TsSetX
TsRight:
    inc hl
    or a
    sbc hl,de
    jr z,TsSetX             ; at the width: back to 0
    add hl,de
TsSetX:
    ld (TsX),hl
    jr TsScrolled
TsUp:
    dec (hl)                ; 256 lines: a byte wraps by itself
    jr TsScrolled
TsDown:
    inc (hl)
TsScrolled:
    call TsScroll
    jr TsFrame

TsExit:
    ld a,(TsOld6B)
    nextreg $6B,a           ; the tilemap off again
    ld a,(TsOld6E)
    nextreg $6E,a
    ld a,(TsOld6F)
    nextreg $6F,a
    ld a,(TsOld4C)
    nextreg $4C,a
    nextreg $1C,8
    nextreg $1B,0
    nextreg $1B,159
    nextreg $1B,0
    nextreg $1B,255
    nextreg $2F,0
    nextreg $30,0
    nextreg $31,0
    ld a,7
    out ($FE),a             ; the white border back
    jp WaitNoKey

; Switches to A columns (40 or 80), fills the map and scrolls it back to 0, 0
TsSetColumns:
    ld (TsColumns),a
    ld hl,320
    ld b,%10000000          ; bit 7: tilemap on; 40 columns, attributes, 256 tiles
    cp 40
    jr z,TsSetColumns1
    ld hl,640
    ld b,%11000000          ; bit 6: 80 columns
TsSetColumns1:
    ld (TsXWrap),hl
    ld a,b
    nextreg $6B,a
    ; The map, row after row: two bytes a cell, the tile and its attribute
    ld hl,TsMap
    ld d,0                  ; the row
TsMapRow:
    ld a,d
    and 7
    ld bc,TsOffsets
    add bc,a
    ld a,(bc)
    ld c,a                  ; C: the row's palette offset, in bits 7-4
    ld e,0                  ; the column
    ld b,0                  ; the column within a group of ten
TsMapCell:
    ld a,b
    cp 8
    ld a,0
    jr nc,TsMapTile         ; columns 8 and 9 of a group: tile 0, empty
    inc a                   ; tile 1
TsMapTile:
    ld (hl),a
    inc hl
    ld a,b
    add a,a                 ; bits 3-1: X mirror, Y mirror, rotate
    or c
    ld (hl),a
    inc hl
    inc b
    ld a,b
    cp 10
    jr nz,TsMapNext
    ld b,0
TsMapNext:
    inc e
    ld a,(TsColumns)
    cp e
    jr nz,TsMapCell
    inc d
    bit 5,d
    jr z,TsMapRow           ; 32 rows
    ld de,$1500             ; row 21
    ld c,$38
    ld a,(TsColumns)
    call PrintDec8
    ld hl,TsColumnsText
    call PrintText
    ld hl,0
    ld (TsX),hl
    xor a
    ld (TsY),a
    ; fall through to TsScroll

; Writes the scroll offsets and prints them on row 21
TsScroll:
    ld hl,(TsX)
    ld a,h
    nextreg $2F,a           ; X, bits 9-8
    ld a,l
    nextreg $30,a           ; X, bits 7-0
    ld a,(TsY)
    nextreg $31,a           ; Y
    ld de,$150B             ; row 21, column 11
    ld c,$38
    ld a,'X'
    call PrintCharNext
    ld hl,(TsX)
    call PrintNum16
    inc e
    ld a,'Y'
    call PrintCharNext
    ld a,(TsY)
    ld l,a
    ld h,0
    jp PrintNum16

; Each row's palette offset, bits 7-4: with dot value 3, the colours $03, $13, $53, $93, $D3, $E3,
; $F3 and $33 of the identity palette
TsOffsets:
    .defb $00, $10, $50, $90, $D0, $E0, $F0, $30

TsColumns:  .defb 0
TsXWrap:    .defw 0
TsX:        .defw 0
TsY:        .defb 0
TsOld6B:    .defb 0
TsOld6E:    .defb 0
TsOld6F:    .defb 0
TsOld4C:    .defb 0
TsColumnsText:
    .defn " columns"
TsKeysText:
    .defn "4 8: columns   Q A O P: scroll"

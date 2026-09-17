; P02 - ULA/tilemap merge: tilemap over and under the ULA, a transparent ULA under an under-ULA tile,
; and stencil mode ($68 bit 0) switched on for one band by the copper.
;
; Tilemap 40x32, 4-bit tiles: tile 0 transparent (pixel 0 = $4C), tile 1 all pixel 1 (TM palette 1 = green).
; Tile rows 8-15 (paper rows 32-95) use tile 1:
;   R1 tile cols  4-13 (paper x   0- 79)  attribute bit 0 = 0: tilemap above the ULA
;   R2 tile cols 14-23 (paper x  80-159)  bit 0 = 1: below the ULA
;   R3 tile cols 24-35 (paper x 160-255)  bit 0 = 1: below the ULA
; ULA paper red (PAPER 2), except character rows 4-7, cols 20-31 (paper rows 32-63, x 160-255): PAPER 3,
; whose palette entry equals $14, i.e. transparent. Stencil mode on paper rows 64-95.
    .model Next
#include "../_include/copper-macros.z80asm"
    .savenex file "P02.nex"
    .savenex ram 768
    .savenex stackaddr $BFF0
    .org $8000
Start:
    di
    ld b,7
    ld c,$10                ; PAPER 2
    call ClearScreen
    nextreg $4A,$A2         ; fallback purple
    nextreg $40,18
    nextreg $41,$E0         ; PAPER 2 red
    nextreg $40,19
    nextreg $41,$E3         ; PAPER 3 = $14: transparent
    nextreg $43,$30         ; write the first tilemap palette
    nextreg $40,1
    nextreg $41,$1C         ; tile pixel 1 green
    nextreg $43,$00
    ; --- PAPER 3 cells: rows 4-7, cols 20-31
    ld hl,$5800 + 4*32 + 20
    ld d,4
Paper3Row:
    ld b,12
Paper3Col:
    ld (hl),$18
    inc hl
    djnz Paper3Col
    ld bc,32-12
    add hl,bc
    dec d
    jr nz,Paper3Row
    ; --- tile definitions at $7000 (clear of the 2560-byte tilemap at $6000): tile 0 = 32 x $00, tile 1 = 32 x $11
    ld hl,$7000
    ld de,$7001
    ld bc,31
    ld (hl),0
    ldir
    ld hl,$7020
    ld de,$7021
    ld bc,31
    ld (hl),$11
    ldir
    ; --- tilemap at $6000: all (tile 0, attr 0), then rows 8-15
    ld hl,$6000
    ld de,$6001
    ld bc,2*40*32-1
    ld (hl),0
    ldir
    ld hl,$6000 + 8*80      ; row 8, col 0 (2 bytes per tile)
    ld d,8
TileRow:
    push hl
    ld bc,4*2
    add hl,bc               ; col 4
    ld b,10
TilesAbove:
    ld (hl),1
    inc hl
    ld (hl),0
    inc hl
    djnz TilesAbove
    ld b,22
TilesBelow:
    ld (hl),1
    inc hl
    ld (hl),1               ; attribute bit 0: below the ULA
    inc hl
    djnz TilesBelow
    pop hl
    ld bc,80
    add hl,bc
    dec d
    jr nz,TileRow
    nextreg $4C,$00         ; tile transparency index 0
    nextreg $6E,$20         ; tilemap at $6000
    nextreg $6F,$30         ; tile definitions at $7000
    nextreg $6B,$80         ; tilemap on, 40x32, attributes, not forced on top
    ld hl,List
    ld bc,ListEnd-List
    call UploadCopper
    nextreg $62,$C0
    SignalReady()
Park:
    jr Park

List:
    CuMove($68, $00)
    CuWait(64, 0)
    CuMove($68, $01)        ; stencil mode on
    CuWait(96, 0)
    CuMove($68, $00)
    CuHalt()
ListEnd:

#include "../_include/copper-routines.z80asm"

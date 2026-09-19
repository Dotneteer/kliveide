; P01 - layer priorities ($15 bits 4-2), Layer 2 priority bit, blend modes 6 and 7.
;
; Three layers, paper-area columns (ULA x):
;   A   0- 39  ULA red only
;   B  40-119  ULA red + Layer 2 green
;   C 120-199  ULA red + Layer 2 green + sprite blue
;   D 200-231  ULA red + Layer 2 green WITH the Layer 2 priority bit + sprite blue
;   E 232-247  ULA red + sprite blue
; The copper changes $15 every 20 lines (paper rows 40-159: SLU LSU SUL LUS USL ULS), then blend mode 6
; on rows 160-163 and mode 7 on rows 164-167. Sprites stay visible ($15 bit 0).
    .model Next
#include "../_include/copper-macros.z80asm"
    .savenex file "P01.nex"
    .savenex ram 768
    .savenex stackaddr $BFF0
    .org $8000
Start:
    di
    ld b,7
    ld c,$10                ; PAPER 2 (red), INK 0
    call ClearScreen
    nextreg $4A,$A2         ; fallback: purple
    nextreg $4B,$E3         ; sprite transparency index
    ; --- ULA palette: PAPER 2 = entry 18 = pure red
    nextreg $40,18
    nextreg $41,$E0
    ; --- Layer 2 palette (write select 001)
    nextreg $43,$10
    nextreg $40,$E3
    nextreg $41,$E3         ; transparent (RGB = $14)
    nextreg $40,$1C
    nextreg $41,$1C         ; green
    nextreg $40,$1D
    nextreg $44,$1C         ; green ...
    nextreg $44,$80         ; ... with the Layer 2 priority bit
    ; --- Sprite palette (write select 010)
    nextreg $43,$20
    nextreg $40,$03
    nextreg $41,$03         ; blue
    nextreg $43,$00
    ; --- Layer 2 pixels, 16K bank 9 = 8K pages 18-23
    nextreg $12,9
    ld b,18
PageLoop:
    ld a,b
    nextreg $56,a
    ld hl,$C000
    ld c,32
RowLoop:
    ld e,40
    ld a,$E3
    call FillE
    ld e,160
    ld a,$1C
    call FillE
    ld e,32
    ld a,$1D
    call FillE
    ld e,24
    ld a,$E3
    call FillE
    dec c
    jr nz,RowLoop
    inc b
    ld a,b
    cp 24
    jr nz,PageLoop
    nextreg $56,0
    ; --- Sprite pattern 0: 256 x colour 3
    ld bc,$303B
    xor a
    out (c),a
    ld bc,$005B
    ld d,0
PatternLoop:
    ld a,$03
    out (c),a
    dec d
    jr nz,PatternLoop
    ; --- Sprite 0: X 152 (ULA x 120), Y 72 (ULA row 40), visible, pattern 0, scale x8 x8
    ld bc,$303B
    xor a
    out (c),a
    ld bc,$0057
    ld a,152
    out (c),a
    ld a,72
    out (c),a
    xor a
    out (c),a               ; attr 2: no offset, no mirror/rotate, X MSB 0
    ld a,$C0
    out (c),a               ; attr 3: visible, attr 4 follows, pattern 0
    ld a,$1E
    out (c),a               ; attr 4: 8-bit pattern, XX = YY = %11 (x8)
    ; --- Layer 2 visible, sprites visible, copper
    ld bc,$123B
    ld a,$02
    out (c),a
    nextreg $15,$01
    ld hl,List
    ld bc,ListEnd-List
    call UploadCopper
    nextreg $62,$C0
    SignalReady()
Park:
    jr Park

FillE:
    ld (hl),a
    inc hl
    dec e
    jr nz,FillE
    ret

List:
    CuMove($15, $01)        ; SLU at the restart
    CuWait(40, 0)
    CuMove($15, $01)        ; rows  40- 59: 000 SLU
    CuWait(60, 0)
    CuMove($15, $05)        ; rows  60- 79: 001 LSU
    CuWait(80, 0)
    CuMove($15, $09)        ; rows  80- 99: 010 SUL
    CuWait(100, 0)
    CuMove($15, $0D)        ; rows 100-119: 011 LUS
    CuWait(120, 0)
    CuMove($15, $11)        ; rows 120-139: 100 USL
    CuWait(140, 0)
    CuMove($15, $15)        ; rows 140-159: 101 ULS
    CuWait(160, 0)
    CuMove($15, $19)        ; rows 160-163: 110 blend (add, clamp)
    CuWait(164, 0)
    CuMove($15, $1D)        ; rows 164-167: 111 blend (add - 5)
    CuWait(168, 0)
    CuMove($15, $01)
    CuHalt()
ListEnd:

#include "../_include/copper-routines.z80asm"

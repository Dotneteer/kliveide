; L01 - Layer 2 transparency compares Layer 2's RGB with $14, not its palette index, and ignores $4B.
;
; Layer 2 (256x192) over blue ULA paper, three vertical bands:
;   A  x   0-79   pixel $10, Layer 2 palette entry $10 set to RGB $E3 (= $14)  -> transparent: ULA blue
;   B  x  80-159  pixel $E3, Layer 2 palette entry $E3 set to RGB $1C (green)   -> opaque green
;   C  x 160-255  pixel $05, entry $05 set to RGB $05; $4B (sprite index) = $05  -> opaque $05
    .model Next
#include "../_include/copper-macros.z80asm"
    .savenex file "L01.nex"
    .savenex ram 768
    .savenex stackaddr $BFF0
    .org $8000
Start:
    di
    ld b,7
    ld c,$08                ; PAPER 1 (blue), INK 0
    call ClearScreen
    ; --- Layer 2 palette: $43 bits 6-4 = 001 writes the first Layer 2 palette
    nextreg $43,$10
    nextreg $40,$10
    nextreg $41,$E3         ; entry $10: RGB equal to the global transparency colour
    nextreg $40,$E3
    nextreg $41,$1C         ; entry $E3: green
    nextreg $40,$05
    nextreg $41,$05         ; entry $05: RGB $05, written (palette RAM has no hardware reset contents)
    nextreg $43,$00
    nextreg $4B,$05         ; sprite transparency index - must not affect Layer 2
    ; --- Layer 2 pixels: 16K bank 9 = 8K pages 18-23, 32 rows each, paged in at $C000
    nextreg $12,9
    ld b,18
PageLoop:
    ld a,b
    nextreg $56,a
    ld hl,$C000
    ld c,32
RowLoop:
    ld e,80
    ld a,$10
    call FillE
    ld e,80
    ld a,$E3
    call FillE
    ld e,96
    ld a,$05
    call FillE
    dec c
    jr nz,RowLoop
    inc b
    ld a,b
    cp 24
    jr nz,PageLoop
    nextreg $56,0
    ; --- Layer 2 visible (port $123B bit 1)
    ld bc,$123B
    ld a,$02
    out (c),a
    SignalReady()
Park:
    jr Park

FillE:
    ld (hl),a
    inc hl
    dec e
    jr nz,FillE
    ret

#include "../_include/copper-routines.z80asm"

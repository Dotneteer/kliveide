; C00 - calibration: one copper edge next to one ULA-drawn marker line.
;
; The ULA draws an ink line on paper row 96. The copper changes PAPER 0's
; palette entry (index 16) at WAIT(96, 0). On hardware both edges are on the
; same row, which pins the harness's copper-line -> buffer-row mapping.
    .model Next
#include "../_include/copper-macros.z80asm"
    .savenex file "C00.nex"
    .savenex ram 768
    .savenex stackaddr $BFF0
    .org $8000
Start:
    di
    ld b,7                  ; border white (index 16+7, untouched by the list)
    ld c,$00                ; PAPER 0, INK 0
    call ClearScreen
    ; marker: pixel row 96, the top line of character row 12. The display file is NOT linear:
    ; address = $4000 | third<<11 | scanline-in-char<<8 | char-row-in-third<<5 | column
    ; (ROM PIXEL-ADD; zxula.vhd addr_p_spc_12_5), so row 96 is $4880.
    ld hl,PixelRow96
    ld de,PixelRow96 + 1
    ld bc,31
    ld (hl),$FF
    ldir
    ; attributes of character row 12: INK 2 (red) on PAPER 0
    ld hl,$5800 + 12*32
    ld de,$5800 + 12*32 + 1
    ld bc,31
    ld (hl),$02
    ldir
    ld hl,List
    ld bc,ListEnd-List
    call UploadCopper
    nextreg $62,$C0         ; mode 11: restart at cvc 0 every frame
    SignalReady()
Park:
    jr Park

List:
    CuPalette(16, $00)      ; paper 0 = black from the top of the paper area
    CuWait(96, 0)
    CuPalette(16, $1C)      ; %00011100 green
    CuHalt()
ListEnd:

PixelRow96 .equ $4000 | ((96 & $C0) << 5) | ((96 & $07) << 8) | ((96 & $38) << 2)

#include "../_include/copper-routines.z80asm"

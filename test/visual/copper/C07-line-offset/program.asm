; C07 - NextReg $64 = 16: the C00 list, whose WAIT(96) now lands on paper row 80.
    .model Next
#include "../_include/copper-macros.z80asm"
    .savenex file "C07-line-offset.nex"
    .savenex ram 768
    .savenex stackaddr $BFF0
    .org $8000
Start:
    di
    ld b,7
    ld c,$00
    call ClearScreen
    ; marker at pixel row 96 as in C00
    ld hl,PixelRow96
    ld de,PixelRow96 + 1
    ld bc,31
    ld (hl),$FF
    ldir
    ld hl,$5800 + 12*32
    ld de,$5800 + 12*32 + 1
    ld bc,31
    ld (hl),$02
    ldir
    nextreg $64,16
    ld hl,List
    ld bc,ListEnd-List
    call UploadCopper
    nextreg $62,$C0
    SignalReady()
Park:
    jr Park

List:
    CuPalette(16, $00)
    CuWait(96, 0)
    CuPalette(16, $1C)
    CuHalt()
ListEnd:

#include "../_include/copper-routines.z80asm"
PixelRow96 .equ $4000 | ((96 & $C0) << 5) | ((96 & $07) << 8) | ((96 & $38) << 2)

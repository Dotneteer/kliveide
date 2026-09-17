; C05 - the C02 bands uploaded through NextReg $63 (16-bit writes) instead of $60.
    .model Next
#include "../_include/copper-macros.z80asm"
    .savenex file "C05-upload-16bit.nex"
    .savenex ram 768
    .savenex stackaddr $BFF0
    .org $8000
Start:
    di
    ld b,7
    ld c,$00
    call ClearScreen

    ld hl,List
    ld bc,ListEnd-List
    call UploadCopper16
    nextreg $62,$C0
    SignalReady()
Park:
    jr Park

List:
    CuPalette(16, $00)      ; band 0 black   lines   0-23
    CuWait(24, 0)
    CuPalette(16, $E0)      ; band 1 red     lines  24-47
    CuWait(48, 0)
    CuPalette(16, $1C)      ; band 2 green   lines  48-71
    CuWait(72, 0)
    CuPalette(16, $03)      ; band 3 blue    lines  72-95
    CuWait(96, 0)
    CuPalette(16, $FC)      ; band 4 yellow  lines  96-119
    CuWait(120, 0)
    CuPalette(16, $1F)      ; band 5 cyan    lines 120-143
    CuWait(144, 0)
    CuPalette(16, $A2)      ; band 6 purple  lines 144-167 (not $E3: that is the transparency colour)
    CuWait(168, 0)
    CuPalette(16, $FF)      ; band 7 white   lines 168-191
    CuHalt()
ListEnd:

#include "../_include/copper-routines.z80asm"

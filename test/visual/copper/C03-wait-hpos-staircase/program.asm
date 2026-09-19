; C03 - WAIT horizontal position: each colour change starts further right (paper x = 8*H).
    .model Next
#include "../_include/copper-macros.z80asm"
    .savenex file "C03-wait-hpos-staircase.nex"
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
    call UploadCopper
    nextreg $62,$C0
    SignalReady()
Park:
    jr Park

List:
    CuPalette(16, $00)      ; black from the top
    CuWait(96, 8)           ; paper x  64
    CuPalette(16, $1C)      ; green
    CuWait(104, 16)         ; paper x 128
    CuPalette(16, $E0)      ; red
    CuWait(112, 24)         ; paper x 192
    CuPalette(16, $03)      ; blue
    CuWait(120, 31)         ; paper x 248
    CuPalette(16, $FC)      ; yellow
    CuWait(128, 0)          ; paper x   0
    CuPalette(16, $00)      ; black again
    CuHalt()
ListEnd:

#include "../_include/copper-routines.z80asm"

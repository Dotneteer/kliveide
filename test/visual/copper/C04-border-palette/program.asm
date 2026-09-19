; C04 - copper palette writes reach the BORDER: border colour 0 uses palette entry 16 too.
    .model Next
#include "../_include/copper-macros.z80asm"
    .savenex file "C04-border-palette.nex"
    .savenex ram 768
    .savenex stackaddr $BFF0
    .org $8000
Start:
    di
    ld b,0
    ld c,$38
    call ClearScreen

    ld hl,List
    ld bc,ListEnd-List
    call UploadCopper
    nextreg $62,$C0
    SignalReady()
Park:
    jr Park

List:
    CuPalette(16, $00)      ; black at the restart (line 0, paper x -12)
    CuWait(48, 0)
    CuPalette(16, $E0)      ; red from line 48, paper x 0
    CuWait(144, 0)
    CuPalette(16, $03)      ; blue from line 144, paper x 0 - until the next restart
    CuHalt()
ListEnd:

#include "../_include/copper-routines.z80asm"

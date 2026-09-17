; C01 - a copper list that is uploaded but never started ( mode 00) changes nothing.
    .model Next
#include "../_include/copper-macros.z80asm"
    .savenex file "C01-stopped.nex"
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
    nextreg $62,$00
    SignalReady()
Park:
    jr Park

List:
    CuPalette(16, $1C)      ; would turn PAPER 0 green if the copper ran
    CuWait(96, 0)
    CuPalette(16, $E0)      ; would turn it red from line 96
    CuHalt()
ListEnd:

#include "../_include/copper-routines.z80asm"

; C06 - NOP MOVEs are skipped, and nothing after a HALT (WAIT 511) ever runs.
    .model Next
#include "../_include/copper-macros.z80asm"
    .savenex file "C06-nop-halt.nex"
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
    CuPalette(16, $00)
    CuNop()
    CuMove(0, $55)          ; MOVE to register 0 is a NOP whatever the value
    CuNop()
    CuWait(96, 0)
    CuNop()
    CuPalette(16, $1C)      ; green from line 96
    CuHalt()
    CuPalette(16, $E0)      ; never: the copper is parked on the HALT
ListEnd:

#include "../_include/copper-routines.z80asm"

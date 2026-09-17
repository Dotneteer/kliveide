; C08 - mode 01 runs the list once from 0 and does not restart each frame.
    .model Next
#include "../_include/copper-macros.z80asm"
    .savenex file "C08-mode01-once.nex"
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
    nextreg $62,$40
    SignalReady()
Park:
    jr Park

List:
    CuPalette(16, $E0)      ; red
    CuWait(144, 0)
    CuPalette(16, $03)      ; blue from line 144 - and forever after, since nothing restarts
    CuHalt()
ListEnd:

#include "../_include/copper-routines.z80asm"

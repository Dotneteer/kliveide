; C11 - per-line ULA disable ($68 bit 7): from line 96 the fallback colour replaces the whole ULA, border included.
    .model Next
#include "../_include/copper-macros.z80asm"
    .savenex file "C11-ula-disable-per-line.nex"
    .savenex ram 768
    .savenex stackaddr $BFF0
    .org $8000
Start:
    di
    ld b,7
    ld c,$00
    call ClearScreen
    nextreg $4A,$E0         ; fallback colour red
    ld hl,List
    ld bc,ListEnd-List
    call UploadCopper
    nextreg $62,$C0
    SignalReady()
Park:
    jr Park

List:
    CuMove($68, $00)        ; ULA on
    CuWait(96, 0)
    CuMove($68, $80)        ; ULA output disabled
    CuHalt()
ListEnd:

#include "../_include/copper-routines.z80asm"

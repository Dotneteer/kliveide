; C10 - per-line global transparency ($14): black paper becomes transparent from line 96 and the fallback colour ($4A) shows.
    .model Next
#include "../_include/copper-macros.z80asm"
    .savenex file "C10-transparency-per-line.nex"
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
    CuMove($14, $E3)        ; default transparency colour: nothing matches
    CuWait(96, 0)
    CuMove($14, $00)        ; black paper (palette 16 = $00) is now transparent
    CuHalt()
ListEnd:

#include "../_include/copper-routines.z80asm"

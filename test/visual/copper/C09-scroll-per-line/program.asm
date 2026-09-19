; C09 - per-line ULA X scroll ($26): a vertical bar steps left every 48 lines.
    .model Next
#include "../_include/copper-macros.z80asm"
    .savenex file "C09-scroll-per-line.nex"
    .savenex ram 768
    .savenex stackaddr $BFF0
    .org $8000
Start:
    di
    ld b,7
    ld c,$38
    call ClearScreen
    ; bar: column byte 0 of every pixel row = $FF. Column 0 addresses are $4000 |
    ; third<<11 | scanline<<8 | charrow<<5, i.e. every (H,L) with H in $40-$57, L in $00,$20..$E0.
    ld h,$40
BarRowH:
    ld l,$00
BarRowL:
    ld (hl),$FF
    ld a,l
    add a,$20
    ld l,a
    jr nz,BarRowL
    inc h
    ld a,h
    cp $58
    jr nz,BarRowH
    ld hl,List
    ld bc,ListEnd-List
    call UploadCopper
    nextreg $62,$C0
    SignalReady()
Park:
    jr Park

List:
    CuMove($26, 0)          ; no scroll at the restart
    CuWait(48, 0)
    CuMove($26, 8)
    CuWait(96, 0)
    CuMove($26, 16)
    CuWait(144, 0)
    CuMove($26, 24)
    CuHalt()
ListEnd:

#include "../_include/copper-routines.z80asm"

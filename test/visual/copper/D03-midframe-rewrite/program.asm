; D03 - rewriting the list mid-frame affects only what the copper has not executed yet.
;
; Two bands take their colour from two MOVEs: band A from WAIT(48), band B from WAIT(144). Every
; frame, while the beam is on copper line 96 - after band A's MOVE, before band B's WAIT - the CPU
; writes the same new colour into both MOVEs, alternating red and blue. Band B shows the new colour
; in this frame; band A only in the next one. So band A always shows what band B showed a frame ago.
    .model Next
#include "../_include/copper-macros.z80asm"
    .savenex file "D03.nex"
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
    ld d,$E0
Frame:
    push de
    ld a,96
    call WaitCvc
    pop de
    ld a,d
    xor $E0 ^ $03           ; alternate red <-> blue
    ld d,a
    nextreg $61,BandA - List + 3
    nextreg $60,a
    nextreg $61,BandB - List + 3
    nextreg $60,a
    jr Frame

List:
    CuPalette(16, $00)
    CuWait(48, 0)
BandA:
    CuPalette(16, $E0)
    CuWait(144, 0)
BandB:
    CuPalette(16, $E0)
    CuHalt()
ListEnd:

#include "../_include/copper-routines.z80asm"

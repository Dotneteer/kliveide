; D02 - colour cycle: the band below copper line 96 changes colour every frame.
;
; Once per frame (on line 250) the CPU writes the next of 8 colours into the value byte of the
; band's $41 MOVE. Above line 96 the paper must stay black.
    .model Next
#include "../_include/copper-macros.z80asm"
    .savenex file "D02.nex"
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
    ld d,0
Frame:
    push de
    ld a,250
    call WaitCvc
    pop de
    ld a,d
    inc a
    and 7
    ld d,a
    ld hl,Colours
    ld b,0
    ld c,a
    add hl,bc
    ld a,(hl)
    nextreg $61,BandColour - List + 3   ; the value byte of the $41 MOVE
    nextreg $60,a
    jr Frame

Colours:
    .defb $E0, $1C, $03, $FC, $1F, $A2, $FF, $92

List:
    CuPalette(16, $00)
    CuWait(96, 0)
BandColour:
    CuPalette(16, $E0)
    CuHalt()
ListEnd:

#include "../_include/copper-routines.z80asm"

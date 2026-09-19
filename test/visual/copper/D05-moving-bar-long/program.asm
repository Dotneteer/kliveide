; D05 - the D01 moving bar, sampled over thousands of frames (runs with --long only).
;
; The copper list is fixed except for two WAIT lines. Once per frame, while the beam is on copper
; line 250 (not displayed: between the bottom border and the top border), the CPU rewrites them
; through $61/$60. No interrupts: the CPU syncs by polling $1F (cvc).
    .model Next
#include "../_include/copper-macros.z80asm"
    .savenex file "D05.nex"
    .savenex ram 768
    .savenex stackaddr $BFF0
    .org $8000
Start:
    di
    ld b,7
    ld c,$00                ; PAPER 0 black
    call ClearScreen
    ld hl,List
    ld bc,ListEnd-List
    call UploadCopper
    nextreg $62,$C0         ; mode 11
    SignalReady()
    ld d,0                  ; bar top line 0-183
Frame:
    push de
    ld a,250
    call WaitCvc
    pop de
    inc d
    ld a,d
    cp 184
    jr c,SetLines
    ld d,0
SetLines:
    nextreg $61,BarTop - List + 1   ; low byte of the first WAIT
    ld a,d
    nextreg $60,a
    nextreg $61,BarBottom - List + 1
    add a,8
    nextreg $60,a
    jr Frame

List:
    CuPalette(16, $00)
BarTop:
    CuWait(0, 0)
    CuPalette(16, $E0)      ; red
BarBottom:
    CuWait(8, 0)
    CuPalette(16, $00)
    CuHalt()
ListEnd:

#include "../_include/copper-routines.z80asm"

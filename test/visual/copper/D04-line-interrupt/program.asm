; D04 - the copper and a line interrupt changing the same palette entry in one frame.
;
; Copper: PAPER 0 black at the restart, blue from WAIT(48,0).
; Line interrupt on line 144 (NextReg $22/$23, IM2 with a full vector table): the handler writes
; PAPER 0 = red. The ULA frame interrupt is disabled, so this is the only interrupt.
    .model Next
#include "../_include/copper-macros.z80asm"
    .savenex file "D04.nex"
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
    ; IM2 vector table $BD00-$BE00: 257 copies of $BA, so whichever byte pair the bus value
    ; selects, the vector is $BABA - where Handler is assembled.
    ld hl,$BD00
    ld de,$BD01
    ld bc,256
    ld (hl),$BA
    ldir
    ld a,$BD
    ld i,a
    im 2
    nextreg $23,144         ; line interrupt line (LSB)
    nextreg $22,%00000110   ; bit 2: ULA interrupt off, bit 1: line interrupt on, bit 0: line MSB 0
    nextreg $62,$C0
    ei
    SignalReady()
Park:
    jr Park

List:
    CuPalette(16, $00)
    CuWait(48, 0)
    CuPalette(16, $03)      ; blue
    CuHalt()
; `ListEnd .equ $`, not `ListEnd:` - a hanging label would bind to the .org below ($BABA)
ListEnd .equ $

    .org $BABA
Handler:
    push af
    nextreg $40,16
    nextreg $41,$E0         ; PAPER 0 red
    pop af
    ei
    reti

#include "../_include/copper-routines.z80asm"

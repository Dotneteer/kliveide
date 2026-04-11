; ==============================================================================
; ZX Spectrum Next book examples
; ==============================================================================

; Use ZX Spectrum Next with .NEX compilation
.model next
.savenex file "nbook.nex"
.savenex core "3.1.0"
.savenex stackaddr STACK_TOP

; Unbanked code in bank 2 at $8000
    jp Main

; Use the utility methods
#include "_helpers/display.asm"

; Include the examples
#include "01_intro/print.asm"
#include "02_z80n/extinstr.asm"
#include "03_nextreg/write.asm"
#include "04_zxndma/memcpy.asm"

; We keep 256 bytes for the stack
STACK
    .defs $100
STACK_TOP

; The start of the example
Main
    call _clearScreen
;
; Here are the examples. Uncomment the one you want to run
    // call PrintWelcome
    // call PrintValues
    // call SwapnibDemo
    // call MirrorDemo
    // call TestDemo
    // call BslaDemo
    // call BsraDemo
    // call BsrlDemo
    // call BsrfDemo
    // call BrlcDemo
    // call LdixDemo
    // call LddxDemo
    // call LdirxDemo
    // call LddrxDemo
    // call LdwsDemo
    // call LdpirxDemo
    // call PixeladDemo
    // call PixeldnDemo
    // call SetaeDemo
    call DmaSimpleMemCopyDemo
    // call WiteNextReg1

; When the example ends, we keep in infinite loop.
; You can reset or restart the machine.
trap
    ei
    call _waitForExit
    jp $


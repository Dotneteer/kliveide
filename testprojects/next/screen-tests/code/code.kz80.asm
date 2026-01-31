; ==============================================================================
; ZX Spectrum Next Screen Test Cases 
; ==============================================================================
.model next

.savenex file "screen-tests.nex"
.savenex core "3.1.0"
.savenex stackaddr STACK_TOP

; Unbanked code in bank 2 at $8000
    jp main

#include "display.kz80.asm"

main:
    ; 
    ; Save the current MMU 5 value ($A000-$BFFF)
    call ClearScreen

    PrintText2(WelcomeText)
    ei
    call WaitForKey
    ld a,4
    out ($fe),a
trap 
    jr $

WelcomeText
    .dm "\a\x02\x02" ; AT 2, 2
    .dm "Klive Screen Tests"
    .dm "\a\x04\x02" ; AT 4, 2
    .dm "\I\x01L\I\x00 List tests"
    .dm "\a\x06\x02" ; AT 6, 2
    .dm "\I\x01T\I\x00 Execute tests"
    TERM_TEXT()

;
; Keep $100 bytes for stack
.defs $100
STACK_TOP


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

    ;
    ;ld de,Hello_txt
    ;ld bc,Hello_txt_end - Hello_txt
    PrintText(Hello_txt, Hello_txt_end - Hello_txt)
    ld a,3
    out ($fe),a
trap 
    jr $

Hello_txt
    .defm "hello"
Hello_txt_end
.defs $100
STACK_TOP


; ==============================================================================
; ZX Spectrum Next Screen Test Cases 
; ==============================================================================
.model next

.savenex file "screen-tests.nex"
.savenex core "3.1.0"

; Unbanked code in bank 2 at $8000
main:
    ; 
    ; Save the current MMU 5 value ($A000-$BFFF)
    ld a,$55
    ld bc,$243b
    out (c),a
    inc b
    in a,(c)
    push af
    ;
    ; Page in the first 8K of 16K Bank $20 to $A000-$BFFF
    di
    nextreg $55,$40
    ;
    ; Invoke the subrouting in Bank $20
    call SetBorder
    ;
    ; Restore the old MMU 5 value
    pop af
    nextreg $55,a
    ei
trap 
    jr $


; Explicit bank $20 code
.bank $20
.org $0000
.disp $a000

SetBorder
    ld a,3
    out ($fe),a
    ret
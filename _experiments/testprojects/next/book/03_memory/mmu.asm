;==========================================================
; Use the MMU
;==========================================================
MmuRoundTripDemo
    ld hl,Title_MmuRoundTrip
    call _printTitle
    ld hl,Instr_MmuRoundTrip
    call _printText
 
    ; --- Save current MMU4 so we can restore it
    ld a,$54
    GetReg($54)          ; A := current value of MMU4
    ld (savedMmu4),a
 
    ; --- Map page $20 into slot 4 ($8000-$9FFF)
    nextreg $54,$20
 
    ; --- Write a marker pattern at the start of the page
    ld hl,$8000
    ld (hl),$DE
    inc hl
    ld (hl),$AD
    inc hl
    ld (hl),$BE
    inc hl
    ld (hl),$EF
 
    ; --- Map something else there (page 10, Bank 5 low) so we can prove
    ;     the marker isn't just sitting in slot 4 by accident
    nextreg $54,$0A
 
    ; --- Now map page $20 back in...
    nextreg $54,$20
    ld hl,$8000
    ld a,(hl)
    call _printAHexadecimal    ; should print DE
    inc hl
    ld a,(hl)
    call _printAHexadecimal    ; should print AD
    inc hl
    ld a,(hl)
    call _printAHexadecimal    ; should print BE
    inc hl
    ld a,(hl)
    call _printAHexadecimal    ; should print EF
 
    ; --- Restore MMU4
    ld a,(savedMmu4)
    nextreg $54,a                ; select MMU4
    ld bc,$253B
    out (c),a                  ; write back saved value
    ret
 
savedMmu4
    .defb 0
 
Title_MmuRoundTrip
    .defn "MMU #1: Map, write, re-map, read"
Instr_MmuRoundTrip
    .defm "Page $20 mapped into slot 4 at $8000.\x0D"
    .defn "Should read back: DE AD BE EF"
; Demos whose code lives in a bank of its own: the shell's memory is nearly full, so a demo keeps its
; code at the start of a bank, which is assembled for $C000 (MMU slot 6).

; Runs the demo whose code is at the start of bank A: pages the bank in at $C000 through slot 6,
; calls $C000, and puts slot 6's page back when the demo returns. Uses everything.
;   ld a,26
;   jp CallBank             ; the demo's entry in the demo table
CallBank:
    ld e,a
    ReadNextReg($56)
    push af                 ; slot 6's page, as it was
    ld a,e
    add a,a                 ; the bank's first 8K page
    nextreg $56,a
    call $C000
    pop af
    nextreg $56,a
    ret

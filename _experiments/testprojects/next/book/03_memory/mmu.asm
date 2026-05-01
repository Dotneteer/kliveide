.module MmuDemo

MMU6_REG    .equ $56
SLOT6_START .equ $c000

;==========================================================
; Use the MMU
;==========================================================
MmuRoundTrip
    Display.PrintTitle(@Title_MmuRoundTrip)
    Display.PrintText(@Instr_MmuRoundTrip)
    Display.PrintText(@Result_MmuRoundTrip)
    Display.Ink(Color.Blue)
 
    ; --- Save current MMU6 so we can restore it
    ld a,MMU6_reg
    GetNextReg(MMU6_REG)      ; A := current value of MMU6
    ld (@SavedMmu6),a
 
    ; --- Map page $20 into slot 6 ($C000-$DFFF)
    nextreg MMU6_REG,$20
 
    ; --- Write a marker pattern at the start of the page
    ld hl,SLOT6_START
    ld (hl),$DE
    inc hl
    ld (hl),$AD
    inc hl
    ld (hl),$BE
    inc hl
    ld (hl),$EF
 
    ; --- Map something else there (page 10, Bank 5 low) so we can prove
    ;     the marker isn't just sitting in slot 6 by accident
    nextreg MMU6_REG,$0A
 
    ; --- Now map page $20 back in...
    nextreg MMU6_REG,$20
    ld hl,SLOT6_START
    call PrintHLContentHexadecimal  ; should print DE
    inc hl
    call PrintHLContentHexadecimal  ; should print AD
    inc hl
    call PrintHLContentHexadecimal  ; should print BE
    inc hl
    call PrintHLContentHexadecimal  ; should print EF
 
    ; --- Restore MMU6
    ld a,(@SavedMmu6)
    nextreg MMU6_REG,a                ; select MMU6
    ret
 
PrintHLContentHexadecimal
    push hl
    ld a,(hl)
    Display.PrintAHexadecimal()
    ld a,' '
    rst $10
    pop hl
    ret
    
@SavedMmu6
    .defb 0
 
@Title_MmuRoundTrip
    .defn "MMU #1: Map, write, re-map, read"
@Instr_MmuRoundTrip
    .defm "Page $20 mapped into slot 6 at\x0D$C000.\x0D"
    .defn "Should read back: DE AD BE EF\x0D"
@Result_MmuRoundTrip
    .defn "Now, read back  : "

.endmodule
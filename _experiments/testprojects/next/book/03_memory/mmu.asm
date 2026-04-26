MMU5_REG    .equ $55
SLOT5_START .equ $a000

;==========================================================
; Use the MMU
;==========================================================
MmuRoundTripDemo
    Display.PrintTitle(Title_MmuRoundTrip)
    Display.PrintText(Instr_MmuRoundTrip)
    Display.PrintText(Result_MmuRoundTrip)
    Display.Ink(Color.Blue)
 
    ; --- Save current MMU5 so we can restore it
    ld a,MMU5_reg
    GetReg(MMU5_REG)          ; A := current value of MMU5
    ld (savedMmu5),a
 
    ; --- Map page $20 into slot 5 ($A000-$BFFF)
    nextreg MMU5_REG,$20
 
    ; --- Write a marker pattern at the start of the page
    ld hl,SLOT5_START
    ld (hl),$DE
    inc hl
    ld (hl),$AD
    inc hl
    ld (hl),$BE
    inc hl
    ld (hl),$EF
 
    ; --- Map something else there (page 10, Bank 5 low) so we can prove
    ;     the marker isn't just sitting in slot 5 by accident
    nextreg MMU5_REG,$0A
 
    ; --- Now map page $20 back in...
    nextreg MMU5_REG,$20
    ld hl,SLOT5_START
    call _printHLContentHexadecimal  ; should print DE
    inc hl
    call _printHLContentHexadecimal  ; should print AD
    inc hl
    call _printHLContentHexadecimal  ; should print BE
    inc hl
    call _printHLContentHexadecimal  ; should print EF
 
    ; --- Restore MMU5
    ld a,(savedMmu5)
    nextreg MMU5_REG,a                ; select MMU5
    ret
 
_printHLContentHexadecimal
    push hl
    ld a,(hl)
    Display.PrintAHexadecimal()
    ld a,' '
    rst $10
    pop hl
    ret
    
savedMmu5
    .defb 0
 
Title_MmuRoundTrip
    .defn "MMU #1: Map, write, re-map, read"
Instr_MmuRoundTrip
    .defm "Page $20 mapped into slot 5 at $A000.\x0D"
    .defn "Should read back: DE AD BE EF\x0D"
Result_MmuRoundTrip
    .defn "Now, read back  : "


;==========================================================
; Use the Shadow screen
;==========================================================
ShadowScreenDemo
    Display.PrintTitle(Title_ShadowScreen)
    Display.PrintText(Instr_ShadowScreen)

    Display.Ink(Color.Blue)
    GetReg($9f)         ; Get $7ffd status
    ld (last7ffd),a     ; Save it
    call _printABinary  ; Display it

    ; --- Save current MMU5 so we can restore it
    ld a,MMU5_reg
    GetReg(MMU5_REG)    ; A := current value of MMU5
    ld (savedMmu5),a

    ; --- Copy the screen to the shadow screen bank
    nextreg MMU5_REG,$0e
    ld hl,$4000         ; Start of the screen in bank 5
    ld de,$a000         ; Start of bank 7 (paged into slot 5)
    ld bc,$1b00         ; Lenght of screen (pixels + attrs)
    ldir

    ; --- Create an attribute stripe in the shadow screen
    ld hl,$b900
    ld de,$b901
    ld bc,$1f
    ld (hl),attr(Color.Green, Color.Green)
    ldir

    ; --- Restore slot 5 content
    ld a,(savedMmu5)
    nextreg MMU5_REG,a

    ; --- Turn on shadow screen
    ld bc,$7ffd
    ei
`swap
    ld a,(last7ffd)
    xor $08
    out (c),a
    ld (last7ffd),a
    halt
    ld a,$7F        ; 01111111 - bit 7 = 0 selects row 7 (Space row)
    in a,($FE)
    bit 0,a         ; Test bit 0 (Space key)
    jr nz,`swap

    ; Turn off shadow screen
    ld a,(last7ffd)
    res 3,a
    out (c),a
    ret

last7ffd
    .db 0

Title_ShadowScreen
    .defn "Memory #2: Shadow screen"
Instr_ShadowScreen
    .defm "Swaps normal and shadow screens\x0d"
    .defm "Press space to stop\x0d"
    .defn "Last $7ffd value: "

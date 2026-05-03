.module InterruptsDemo

NR_INT_CONTROL  .equ $c0
NR_INT_EN_0     .equ $c4
NR_INT_STATUS_0 .equ $c8
 
VECTOR_TOP_BITS .equ %01100000   ; $60
ULA_PRIORITY    .equ 11
ULA_VECTOR      .equ VECTOR_TOP_BITS | (ULA_PRIORITY << 1)  ; = $76
 
;==========================================================
; ULA frame interrupt counter, hardware IM2
;==========================================================
FrameCounter
    Display.PrintTitle(@Title_FrameCounter)
    Display.PrintText(@Instr_FrameCounter)
    
    di
    ; --- Point I at the high byte of the vector table.
    ;     The table is .align 256 (low byte = 0), so the CPU will fetch
    ;     the ISR address from (I:vector_byte) on every IM2 acknowledge.
    ld hl,@VectorTable
    ld a,h
    ld i,a
    im 2

    ; --- Enable hardware IM2 mode and program the vector top bits
    nextreg NR_INT_CONTROL,VECTOR_TOP_BITS | $01

    ; --- NR $C4 — Interrupt Enable 0:
    ;       bit 0 = ULA *disable* (1 = disabled, 0 = enabled — note inverted sense)
    ;       bit 1 = Line interrupt enable
    ;       bit 7 = Expansion bus /INT enable
    ;     Writing 0 keeps the ULA frame interrupt enabled (its default after reset)
    ;     and leaves the Line and ExpBus interrupts disabled.
    nextreg NR_INT_EN_0,%00000000

    ; --- Clear any ULA / Line status latched from before we set up IM2
    nextreg NR_INT_STATUS_0,%00000011
 
    xor a
    ld (@FrameCount),a
    ei
 
`waitLoop
    ; --- Print the current frame count, then wait for the user
    Display.PrintAt(10,0)
    ld a,(@FrameCount)
    Display.PrintAHexadecimal()
 
    ld a,$7F                ; Read row 7 (Space)
    in a,($FE)
    bit 0,a
    jr nz,`waitLoop
 
    di
    nextreg NR_INT_EN_0,0    ; Clear Line/ExpBus enables (ULA stays on — bit 0 is "disable")
    nextreg NR_INT_CONTROL,0 ; Leave HW IM2 mode → back to legacy pulse mode
    im 1                     ; Restore IM1 for the ROM's $0038 handler
    ei
    ret
 
;----------------------------------------------------------
; The ISR: just increment a counter
;----------------------------------------------------------
@UlaIsr
    push af
    ld a,(@FrameCount)
    inc a
    ld (@FrameCount),a
    ; --- In hardware IM2 mode the ULA status latch is cleared automatically
    ;     by the daisy-chain acknowledge, and RETI clears the InService flag.
    ;     Writing NR $C8 here is therefore redundant but harmless; we keep it
    ;     as a belt-and-braces clear that also works in legacy pulse mode.
    nextreg NR_INT_STATUS_0,%00000001
    pop af
    ei
    reti
 
@FrameCount
    .db 0
 
;----------------------------------------------------------
; IM2 vector table.
; .align 256 is essential: with I = high byte of @VectorTable,
; the CPU computes the ISR pointer as (I << 8) | vector_byte,
; which only matches @VectorTable + vector_byte when the low
; byte of @VectorTable is 0.
; Only the ULA slot ($76) is wired; the rest is zero-filled, so
; an unexpected source would dispatch via $0000 (still wrong,
; but at least deterministic and easy to spot in a trace).
;----------------------------------------------------------
    .align 256
@VectorTable
    .defs ULA_VECTOR              ; padding before the ULA slot
    .defw @UlaIsr                 ; offset $76 → @UlaIsr
    .defs $100 - ULA_VECTOR - 2   ; padding to end of page
 
@Title_FrameCounter
    .defn "Interrupts #1: ULA frame counter"
@Instr_FrameCounter
    .defm "Frame counter ticks at 50 Hz.\x0d"
    .defn "Press Space to stop.\x0d\x0d"

NR_LINE_CTRL      .equ $22
NR_LINE_VAL_LSB   .equ $23

LINE_VECTOR       .equ VECTOR_TOP_BITS | (0  << 1)  ; $60

LINE_TARGET       .equ 96          ; halfway down the visible screen

;==========================================================
; ULA + line interrupt demo
;==========================================================
TwoSources
    Display.PrintTitle(@Title_TwoSources)
    Display.PrintText(@Instr_TwoSources)

    di
    ld hl,@VectorTable2
    ld a,h
    ld i,a
    im 2

    ; --- Program the line target (9-bit value: $22 bit 0 + $23)
    ld a,LINE_TARGET >> 8
    nextreg NR_LINE_CTRL,a
    ld a,LINE_TARGET & $FF
    nextreg NR_LINE_VAL_LSB,a

    ; --- Enable hardware IM2 mode
    nextreg NR_INT_CONTROL,VECTOR_TOP_BITS | $01

    ; --- NR $C4: bit 0 is ULA *disable* (inverted sense), bit 1 is Line enable.
    ;     We want both sources active, so set bit 1 (Line on) and leave
    ;     bit 0 = 0 (ULA stays at its default-enabled state).
    nextreg NR_INT_EN_0,%00000010

    ; --- Clear any stale status
    nextreg NR_INT_STATUS_0,%00000011
    ei

`waitLoop
    ld a,$7F
    in a,($FE)
    bit 0,a
    jr nz,`waitLoop

    di
    nextreg NR_INT_EN_0,0
    nextreg NR_INT_CONTROL,0
    im 1
    ei
    ret

@LineIsr
    push af
    ld a,$02                  ; Red border
    out ($FE),a
    nextreg NR_INT_STATUS_0,%00000010
    pop af
    ei
    reti

@UlaIsr2
    push af
    xor a                     ; Black border at end of frame
    out ($FE),a
    nextreg NR_INT_STATUS_0,%00000001
    pop af
    ei
    reti

    .align 256
@VectorTable2
    .defs LINE_VECTOR
    .defw @LineIsr            ; $60 → LineIsr
    .defs ULA_VECTOR - LINE_VECTOR - 2
    .defw @UlaIsr2            ; $76 → UlaIsr2
    .defs $100 - ULA_VECTOR - 2

@Title_TwoSources
    .defn "Interrupts #2: ULA + line"
@Instr_TwoSources
    .defm "Red border bar at scanline 96.\x0d"
    .defn "Press Space to stop.\x0d\x0d"

.endmodule
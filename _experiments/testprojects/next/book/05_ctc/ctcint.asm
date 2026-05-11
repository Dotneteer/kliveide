.module CtcInterruptDemo

NR_INT_CONTROL  .equ $c0
NR_INT_EN_0     .equ $c4
NR_INT_EN_1     .equ $c5
NR_INT_STATUS_0 .equ $c8
NR_INT_STATUS_1 .equ $c9

CTC_CH0         .equ $183b
CTC_CH1         .equ $193b
CTC_CH2         .equ $1a3b

VECTOR_TOP_BITS .equ %01100000   ; $60
CTC2_PRIORITY   .equ 5
CTC2_VECTOR     .equ VECTOR_TOP_BITS | (CTC2_PRIORITY << 1) ; $6A

;==========================================================
; CTC interrupt demo: increment a 16-bit counter every 100 ms
;==========================================================
Every100MsCounter
    Display.PrintTitle(@Title)
    Display.PrintText(@Instr)

    di

    ; Keep unrelated interrupt sources quiet for this demo.
    nextreg NR_INT_EN_0,0
    nextreg NR_INT_EN_1,0
    nextreg NR_INT_STATUS_0,$ff
    nextreg NR_INT_STATUS_1,$ff

    call @ResetCtcChannels

    xor a
    ld (@Ticks100ms),a
    ld (@Ticks100ms+1),a

    ; Set up hardware IM2.
    ld a,high(@VectorTable)
    ld i,a
    im 2
    nextreg NR_INT_CONTROL,VECTOR_TOP_BITS | $01

    ; Enable CTC channel 2 in the Next interrupt controller.
    nextreg NR_INT_EN_1,%00000100
    nextreg NR_INT_STATUS_1,%00000100

    ; Downstream channels first, then start Channel 0.
    ;
    ; Nominal 28 MHz math:
    ; Ch0: 28 MHz / 16 / 250 = 7000 Hz       -> ~142.857 us
    ; Ch1: 7000 Hz / 28      = 250 Hz        -> 4 ms
    ; Ch2: 250 Hz / 25       = 10 Hz         -> 100 ms
    ;
    ; Only Channel 2 has its interrupt-enable bit set.

    ld bc,CTC_CH2
    ld a,%11000101          ; Interrupt on, counter mode, time constant follows
    out (c),a
    ld a,25
    out (c),a

    ld bc,CTC_CH1
    ld a,%01000101          ; Counter mode, time constant follows
    out (c),a
    ld a,28
    out (c),a

    ld bc,CTC_CH0
    ld a,%00000101          ; Timer mode, prescaler ÷16, time constant follows
    out (c),a
    ld a,250
    out (c),a

    ei

`mainLoop
    ; Show the 16-bit counter. Read it atomically because the ISR
    ; can update it between the low-byte and high-byte loads.
    di
    ld hl,(@Ticks100ms)
    ei

    Display.PrintAt(10,0)
    Display.Ink(Color.Blue)
    Display.PrintHLDecimal()

    ; Do something visible while the interrupt-driven counter runs.
    call @AnimateAttributes

    ld a,$7f                ; Read keyboard row 7: Space
    in a,($fe)
    bit 0,a
    jr nz,`mainLoop

    di
    nextreg NR_INT_EN_1,0
    nextreg NR_INT_STATUS_1,%00000100
    call @ResetCtcChannels

    nextreg NR_INT_EN_0,1   ; Leave ULA enabled for normal IM1/pulse-mode code
    nextreg NR_INT_CONTROL,0
    im 1
    ei
    ret

;----------------------------------------------------------
; CTC Channel 2 ISR: nominally once every 100 ms
;----------------------------------------------------------
@Ctc2Isr
    push af
    push hl

    ld hl,(@Ticks100ms)
    inc hl
    ld (@Ticks100ms),hl

    ; Clear CTC channel 2 readable status.
    ; RETI releases the hardware IM2 in-service state.
    nextreg NR_INT_STATUS_1,%00000100

    pop hl
    pop af
    ei
    reti

;----------------------------------------------------------
; Main-loop screen activity: move one attribute along row 8
;----------------------------------------------------------
@AnimateAttributes
    ; Slow the animation down so it is visible.
    ld hl,(@AnimDelay)
    dec hl
    ld (@AnimDelay),hl
    ld a,h
    or l
    ret nz

    ld hl,900
    ld (@AnimDelay),hl

    ; Clear the previous attribute cell.
    ld a,(@AttrCol)
    ld e,a
    ld d,0
    ld hl,$5800 + 8 * 32
    add hl,de
    ld (hl),%00111000       ; White paper, black ink

    ; Advance to the next column, wrapping after column 31.
    ld a,(@AttrCol)
    inc a
    and $1f
    ld (@AttrCol),a

    ; Paint the new cell.
    ld e,a
    ld d,0
    ld hl,$5800 + 8 * 32
    add hl,de
    ld (hl),%01000111       ; Bright black paper, white ink
    ret

@AnimDelay
    .defw 1

@AttrCol
    .db 31

;----------------------------------------------------------
; Put channels 0-2 into a known stopped/control-word state
;----------------------------------------------------------
@ResetCtcChannels
    ld a,%00000011          ; D1=1 soft reset, D0=1 control word

    ld bc,CTC_CH0
    out (c),a
    out (c),a

    ld b,high(CTC_CH1)
    out (c),a
    out (c),a

    ld b,high(CTC_CH2)
    out (c),a
    out (c),a
    ret

@Ticks100ms
    .defw 0

    .align 256
@VectorTable
    .defs CTC2_VECTOR
    .defw @Ctc2Isr
    .defs $100 - CTC2_VECTOR - 2

@Title
    .defn "CTC #4: Interrupt (100ms tick)"

@Instr
    .defm "A CTC interrupt increments\x0d"
    .defm "the counter every 100 ms. The\x0d"
    .defm "main loop keeps touching screen\x0d"
    .defm "attributes.\x0d"
    .defn "Press Space to stop."

.endmodule
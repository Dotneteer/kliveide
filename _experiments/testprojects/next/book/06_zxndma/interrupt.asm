.module DmaInterruptDemo

DMA_PORT        .equ $6b

NR_INT_CONTROL  .equ $c0
NR_INT_EN_0     .equ $c4
NR_INT_STATUS_0 .equ $c8
NR_DMA_INT_EN_0 .equ $cc

VECTOR_TOP_BITS .equ %01100000
ULA_PRIORITY    .equ 11
ULA_VECTOR      .equ VECTOR_TOP_BITS | (ULA_PRIORITY << 1)

DMA_DEST        .equ $5000
DMA_FILL_SIZE   .equ $0800       ; 2048 bytes
ISR_CTC_COST    .equ 12          ; Approximate ULA ISR cost in CTC ticks

;==========================================================
; DMA interrupt break-in demo
;==========================================================
DmaInterruptBreakIn
    Display.PrintTitle(@Title)
    Display.PrintText(@Instr)

    di
    call Timing.SetupCtc16

    ; --- Set up hardware IM2 for the ULA frame interrupt.
    ld a,high(@VectorTable)
    ld i,a
    im 2
    nextreg NR_INT_CONTROL,VECTOR_TOP_BITS | $01
    nextreg NR_INT_EN_0,%00000001        ; CPU may receive ULA frame INTs
    nextreg NR_INT_STATUS_0,%00000001

    ; --- Pass 1: DMA runs as one uninterrupted block.
    ;     Keep IFF disabled so the CTC measurement does not include
    ;     a frame ISR that was latched while DMA owned the bus.
    xor a
    ld (@FrameTicks),a
    ld (@BorderColour),a
    nextreg NR_DMA_INT_EN_0,%00000000    ; ULA may not interrupt DMA
    nextreg NR_INT_STATUS_0,%00000001
    call Timing.StartMeasure

    call @RunDmaFill

    ld a,(@FrameTicks)
    ld (@BlockedTicks),a
    call Timing.GetMeasuredCounter
    ld (@BlockedDmaTicks),de

    ; --- Pass 2: allow the ULA frame interrupt to break into DMA.
    xor a
    ld (@FrameTicks),a
    ld (@BorderColour),a
    nextreg NR_INT_STATUS_0,%00000001
    nextreg NR_DMA_INT_EN_0,%00000001    ; bit 0 mirrors ULA for DMA
    call Timing.StartMeasure
    ei

    call @RunDmaFill

    ld a,(@FrameTicks)
    ld (@BreakInTicks),a
    call Timing.GetMeasuredCounter
    ld a,(@BreakInTicks)
    call @SubtractIsrCost
    ld (@BreakInDmaTicks),de

    ; --- Restore the normal interrupt setup.
    nextreg NR_DMA_INT_EN_0,0
    nextreg NR_INT_STATUS_0,%00000001
    nextreg NR_INT_CONTROL,0
    im 1
    ei

    ; --- Show the two counters.
    Display.PrintAt(8,0)
    Display.Ink(Color.Black)
    Display.PrintText(@TextBlocked)
    ld a,(@BlockedTicks)
    Display.Ink(Color.Blue)
    Display.PrintAHexadecimal()

    Display.PrintAt(9,0)
    Display.Ink(Color.Black)
    Display.PrintText(@TextBreakIn)
    ld a,(@BreakInTicks)
    Display.Ink(Color.Blue)
    Display.PrintAHexadecimal()

    Display.PrintAt(10,0)
    Display.Ink(Color.Black)
    Display.PrintText(@TextBlockedTicks)
    ld hl,(@BlockedDmaTicks)
    Display.Ink(Color.Blue)
    Display.PrintHLDecimal()

    Display.PrintAt(11,0)
    Display.Ink(Color.Black)
    Display.PrintText(@TextBreakInTicks)
    ld hl,(@BreakInDmaTicks)
    Display.Ink(Color.Blue)
    Display.PrintHLDecimal()
    ret

;----------------------------------------------------------
; Start the prepared DMA fill and wait until the end-of-block
; status bit says it is finished.
;----------------------------------------------------------
@RunDmaFill
    ld hl,@DmaProgram
    ld b,@DmaProgramEnd - @DmaProgram
    ld c,DMA_PORT
    otir

@EnableDma
    ld bc,DMA_PORT
    ld a,$87                ; WR6: Enable DMA
    out (c),a

@WaitDmaStatus
    ld bc,DMA_PORT
    ld a,$bf                ; WR6: Read Status Byte
    out (c),a
    in a,(c)
    bit 5,a                 ; 0 = end of block reached
    jr nz,@WaitDmaStatus
    di
    ret

;----------------------------------------------------------
; The break-in pass intentionally lets frame ISRs run while
; DMA is active. Remove their handler cost from the displayed
; CTC value so the two CTC rows compare DMA time.
; A = number of serviced frame ISRs
; DE = measured CTC ticks
;----------------------------------------------------------
@SubtractIsrCost
    or a
    ret z
    ld b,a
`loop
    ld hl,-ISR_CTC_COST
    add hl,de
    ex de,hl
    djnz `loop
    ret

;----------------------------------------------------------
; ULA frame ISR: toggle the border and count frames.
;----------------------------------------------------------
@UlaIsr
    push af

    ld a,(@BorderColour)
    xor %00000010
    ld (@BorderColour),a
    out ($fe),a

    ld a,(@FrameTicks)
    inc a
    ld (@FrameTicks),a

    nextreg NR_INT_STATUS_0,%00000001
    pop af
    ei
    reti

@DmaProgram
    .dma reset
    .dma wr0 a_to_b, transfer, @FillByte, DMA_FILL_SIZE
    .dma wr1 memory, fixed
    .dma wr2 memory, increment
    .dma wr4 continuous, DMA_DEST
    .dma wr5
    .dma load
@DmaProgramEnd

@FillByte
    .db $00

@FrameTicks
    .db 0

@BlockedTicks
    .db 0

@BreakInTicks
    .db 0

@BlockedDmaTicks
    .defw 0

@BreakInDmaTicks
    .defw 0

@BorderColour
    .db 0

    .align 256
@VectorTable
    .defs ULA_VECTOR
    .defw @UlaIsr
    .defs $100 - ULA_VECTOR - 2

@Title
    .defn "DMA #3: Interrupt break-in"

@Instr
    .defm "The same 2 KB DMA fill runs\x0d"
    .defm "twice. First DMA blocks ULA\x0d"
    .defm "frame interrupts; then NR $CC\x0d"
    .defm "allows ULA to break in.\x0d"
    .defn "\x0d"

@TextBlocked
    .defn "Blocked frames: "

@TextBreakIn
    .defn "Break-in frames: "

@TextBlockedTicks
    .defn "Blocked CTC ticks: "

@TextBreakInTicks
    .defn "Break-in CTC ticks: "

.endmodule

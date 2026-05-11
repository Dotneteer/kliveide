.module DmaInterruptDemo

DMA_PORT        .equ $6b

NR_INT_CONTROL  .equ $c0
NR_INT_EN_0     .equ $c4
NR_INT_STATUS_0 .equ $c8
NR_DMA_INT_EN_0 .equ $cc
NR_INT_EN_1     .equ $c5
NR_INT_STATUS_1 .equ $c9

CTC_CH0         .equ $183b
CTC_CH1         .equ $193b
CTC_CH2         .equ $1a3b

VECTOR_TOP_BITS .equ %01100000
ULA_PRIORITY    .equ 11
ULA_VECTOR      .equ VECTOR_TOP_BITS | (ULA_PRIORITY << 1)
CTC2_PRIORITY   .equ 5
CTC2_VECTOR     .equ VECTOR_TOP_BITS | (CTC2_PRIORITY << 1)

DMA_DEST        .equ $5000
DMA_FILL_SIZE   .equ $0800       ; 2048 bytes
ISR_CTC_COST    .equ 12          ; Approximate ULA ISR cost in CTC ticks
HEARTBEAT_DMA_DEST .equ $57ff    ; Safe single-byte screen target
HEARTBEAT_DMA_SIZE .equ $8000    ; Long enough to watch the animation
BURST_PRESCALER .equ 255         ; Slowest paced burst transfer
ATTR_ROW7       .equ $5800 + 7 * 32

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

;==========================================================
; Burst DMA with CTC heartbeat demo
;==========================================================
DmaWithCtcHeartbeat
    Display.PrintTitle(@Title_Heartbeat)
    Display.PrintText(@Instr_Heartbeat)

    di

    ; Keep unrelated interrupt sources quiet for this demo.
    nextreg NR_INT_EN_0,0
    nextreg NR_INT_EN_1,0
    nextreg NR_INT_STATUS_0,$ff
    nextreg NR_INT_STATUS_1,$ff
    nextreg NR_DMA_INT_EN_0,0

    call @ResetCtcChannels

    xor a
    ld (@HeartbeatTicks),a
    ld (@HeartbeatTicks+1),a
    ld (@MainLoops),a
    ld (@MainLoops+1),a
    ld (@AttrCol2),a
    ld (@DmaDoneFlag),a

    ; --- Set up hardware IM2 for CTC channel 2.
    ld a,high(@VectorTable2)
    ld i,a
    im 2
    nextreg NR_INT_CONTROL,VECTOR_TOP_BITS | $01

    ; Enable CTC channel 2 in the Next interrupt controller.
    nextreg NR_INT_EN_1,%00000100
    nextreg NR_INT_STATUS_1,%00000100

    ; CTC cascade for a visible heartbeat:
    ; Ch0: 28 MHz / 16 / 250 = 7000 Hz
    ; Ch1: 7000 Hz / 28      = 250 Hz
    ; Ch2: 250 Hz / 5        = 50 Hz -> 20 ms
    ld bc,CTC_CH2
    ld a,%11000101          ; Interrupt on, counter mode, TC follows
    out (c),a
    ld a,5
    out (c),a

    ld bc,CTC_CH1
    ld a,%01000101          ; Counter mode, TC follows
    out (c),a
    ld a,28
    out (c),a

    ld bc,CTC_CH0
    ld a,%00000101          ; Timer mode, prescaler /16, TC follows
    out (c),a
    ld a,250
    out (c),a

    ; Upload and start a long paced burst DMA stream.
    ld hl,@BurstDmaProgram
    ld b,@BurstDmaProgramEnd - @BurstDmaProgram
    ld c,DMA_PORT
    otir

    ld bc,DMA_PORT
    ld a,$87                ; WR6: Enable DMA
    out (c),a

    ei

`mainLoop
    call @AnimateHeartbeat
    call @ShowHeartbeatCounters

    ld bc,DMA_PORT
    ld a,$bf                ; WR6: Read Status Byte
    out (c),a
    in a,(c)
    bit 5,a                 ; 0 = end of block reached
    jr nz,`mainLoop

    di
    ld a,1
    ld (@DmaDoneFlag),a
    call @ShowHeartbeatCounters

    ; --- Restore the normal interrupt setup.
    nextreg NR_INT_EN_1,0
    nextreg NR_INT_STATUS_1,%00000100
    call @ResetCtcChannels

    ld bc,DMA_PORT
    ld a,$83                ; WR6: Disable DMA
    out (c),a

    nextreg NR_INT_EN_0,1
    nextreg NR_INT_CONTROL,0
    im 1
    ei
    ret

;----------------------------------------------------------
; CTC Channel 2 ISR: heartbeat while burst DMA is active
;----------------------------------------------------------
@Ctc2Isr
    push af
    push hl

    ld hl,(@HeartbeatTicks)
    inc hl
    ld (@HeartbeatTicks),hl

    nextreg NR_INT_STATUS_1,%00000100

    pop hl
    pop af
    ei
    reti

;----------------------------------------------------------
; Main-loop activity while DMA is active
;----------------------------------------------------------
@AnimateHeartbeat
    ld hl,(@MainLoops)
    inc hl
    ld (@MainLoops),hl

    ld a,l
    and $0f
    ret nz

    ld a,(@AttrCol2)
    ld e,a
    ld d,0
    ld hl,ATTR_ROW7
    add hl,de
    ld (hl),%00111000       ; White paper, black ink

    ld a,(@AttrCol2)
    inc a
    and $1f
    ld (@AttrCol2),a

    ld e,a
    ld d,0
    ld hl,ATTR_ROW7
    add hl,de
    ld (hl),%01000111       ; Bright black paper, white ink
    ret

@ShowHeartbeatCounters
    Display.PrintAt(8,0)
    Display.Ink(Color.Black)
    Display.PrintText(@TextHeartbeat)
    ld hl,(@HeartbeatTicks)
    Display.Ink(Color.Blue)
    Display.PrintHLDecimal()

    Display.PrintAt(9,0)
    Display.Ink(Color.Black)
    Display.PrintText(@TextMainLoops)
    ld hl,(@MainLoops)
    Display.Ink(Color.Blue)
    Display.PrintHLDecimal()

    Display.PrintAt(10,0)
    Display.Ink(Color.Black)
    Display.PrintText(@TextDmaState)
    ld a,(@DmaDoneFlag)
    or a
    jr z,`active
    Display.Ink(Color.Blue)
    Display.PrintText(@TextDone)
    ret
`active
    Display.Ink(Color.Blue)
    Display.PrintText(@TextActive)
    ret

;----------------------------------------------------------
; Put CTC channels 0-2 into a known stopped state.
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

@BurstDmaProgram
    .dma reset
    .dma wr0 a_to_b, transfer, @FillByte2, HEARTBEAT_DMA_SIZE
    .dma wr1 memory, fixed
    .dma wr2 memory, fixed, 3t, BURST_PRESCALER
    .dma wr4 burst, HEARTBEAT_DMA_DEST
    .dma wr5
    .dma load
@BurstDmaProgramEnd

@FillByte2
    .db $00

@HeartbeatTicks
    .defw 0

@MainLoops
    .defw 0

@AttrCol2
    .db 0

@DmaDoneFlag
    .db 0

    .align 256
@VectorTable2
    .defs CTC2_VECTOR
    .defw @Ctc2Isr
    .defs $100 - CTC2_VECTOR - 2

@Title_Heartbeat
    .defn "DMA #4: Burst + CTC heartbeat"

@Instr_Heartbeat
    .defm "A slow burst DMA stream runs.\x0d"
    .defm "A CTC interrupt and the main\x0d"
    .defm "loop keep running meanwhile;\x0d"
    .defn "completion uses DMA status.\x0d\x0d"

@TextHeartbeat
    .defn "CTC ticks: "

@TextMainLoops
    .defn "Main loops: "

@TextDmaState
    .defn "DMA state:  "

@TextActive
    .defn "active"

@TextDone
    .defn "done  "

.endmodule

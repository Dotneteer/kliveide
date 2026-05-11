.module DmaCompareDemo
 
DMA_PORT  .equ $6b
COPY_SIZE .equ $0800       ; 2048 bytes
SRC_ADDR  .equ $4000
LDIR_DEST .equ $4800
DMA_DEST  .equ $5000
 
;==========================================================
; Compare LDIR and zxnDMA for the same 2 KB memory copy
;==========================================================
LdirAndDma
    ; Fill the source screen area with a visible pattern.
    ld hl,SRC_ADDR
    ld bc,COPY_SIZE
`fillSource
    ld (hl),$aa
    inc hl
    dec bc
    ld a,b
    or c
    jr nz,`fillSource

    ; --- Measure the LDIR version
    call Timing.SetupCtc16
    call Timing.StartMeasure

    ld hl,SRC_ADDR
    ld de,LDIR_DEST
    ld bc,COPY_SIZE
    ldir

    call Timing.GetMeasuredCounter
    ld (@LdirTicks),de

    ; Prepare the DMA transfer before starting the stopwatch.
    ; The program ends with LOAD, but not ENABLE.
    ld hl,@DmaCopyProgram
    ld b,@DmaCopyProgramEnd - @DmaCopyProgram
    ld c,DMA_PORT
    otir

    ; --- Measure the DMA version
    call Timing.SetupCtc16
    call Timing.StartMeasure

    ld bc,DMA_PORT
    ld a,$87                ; WR6: Enable DMA
    out (c),a

`waitDma
    ld bc,DMA_PORT
    ld a,$bf                ; WR6: Read Status Byte
    out (c),a
    in a,(c)
    bit 5,a                 ; 0 = end of block reached
    jr nz,`waitDma

    call Timing.GetMeasuredCounter
    ld (@DmaTicks),de

    ; The benchmark used visible screen memory as scratch space.
    ; Clear it before printing the result.
    call @ClearPixels
    Display.PrintTitle(@Title)
    Display.PrintText(@Instr)

    ; --- Show both tick counts
    Display.PrintAt(10,0)
    Display.Ink(Color.Black)
    Display.PrintText(@TextLdir)
    ld hl,(@LdirTicks)
    Display.Ink(Color.Blue)
    Display.PrintHLDecimal()

    Display.PrintAt(11,0)
    Display.Ink(Color.Black)
    Display.PrintText(@TextDma)
    ld hl,(@DmaTicks)
    Display.Ink(Color.Blue)
    Display.PrintHLDecimal()
    ret

;----------------------------------------------------------
; Clear the 6144-byte ULA pixel area without using DMA.
; We want the screen tidy before displaying the measured values.
;----------------------------------------------------------
@ClearPixels
    ld hl,$4000
    ld de,$4001
    ld bc,6143
    xor a
    ld (hl),a
    ldir
    ret

@DmaCopyProgram
    .dma reset
    .dma wr0 a_to_b, transfer, SRC_ADDR, COPY_SIZE
    .dma wr1 memory, increment
    .dma wr2 memory, increment
    .dma wr4 continuous, DMA_DEST
    .dma wr5
    .dma load
@DmaCopyProgramEnd

@LdirTicks
    .defw 0

@DmaTicks
    .defw 0

@Title
    .defn "DMA #2: LDIR vs zxnDMA"

@Instr
    .defm "Copies the same 2 KB screen\x0d"
    .defm "block twice: LDIR, then DMA.\x0d"
    .defm "The values are CTC ticks from\x0d"
    .defn "Chapter 5's timing helper.\x0d\x0d"

@TextLdir
    .defn "LDIR ticks: "

@TextDma
    .defn "DMA ticks:  "

.endmodule

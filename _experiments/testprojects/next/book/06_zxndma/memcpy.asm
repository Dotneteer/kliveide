;==========================================================
; Example: Simple memcopy
;==========================================================
DmaSimpleMemCopyDemo
    ld hl,Title_DmaSimpleMemCopy
    Display.PrintTitle(Title_DmaSimpleMemCopy)
    Display.Ink(Color.Black)
    Display.PrintText(Instr_DmaSimpleMemCopy)
    ; 
    ; Display a dotted line
    ld hl,$4080
    ld de,$4081
    ld bc,$1f
    ld (hl),$aa
    ldir

    ;
    ; Set attributes for the copied line
    ld hl,$58a0
    ld de,$58a1
    ld bc,$1f
    ld (hl),attr(Color.Black, Color.Green, 1)
    ldir
    
    ; Create the code to copy
    ld hl,DmaSimpleMemCopy_Code
    ld b,DmaSimpleMemCopy_Code_End - DmaSimpleMemCopy_Code
    ld c, $6B                   ; zxnDMA port
    otir                        ; upload and run the DMA program
    ret

Title_DmaSimpleMemCopy
    .defn "DMA #1: Simple memory copy"
Instr_DmaSimpleMemCopy
    .defn "Copies the dotted line"
DmaSimpleMemCopy_Code:
    .dma reset
    .dma wr0 a_to_b, transfer, $4080, 32
    .dma wr1 memory, increment
    .dma wr2 memory, increment
    .dma wr4 continuous, $43a0
    .dma wr5
    .dma load
    .dma enable
DmaSimpleMemCopy_Code_End

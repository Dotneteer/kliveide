;==========================================================
; Example: Simple memcopy
;==========================================================
DmaSimpleMemCopyDemo
    ld hl,Title_DmaSimpleMemCopy
    call _printTitle
    Ink(COLOR_BLACK)
    ld hl,Instr_DmaSimpleMemCopy
    call _printText
    ; 
    ; Display a dotted line
    ld hl,$4080
    ld de,$4081
    ld bc,$1f
    ld (hl),$aa
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
    .dma wr4 continuous, $40a0
    .dma wr5
    .dma load
    .dma enable
DmaSimpleMemCopy_Code_End




; Demo: DMA Versus LDIR
; Chapter: DMA (content/next-dma.mdx), "One byte, six T-states"
;
; Copies the same 1K three times a frame, at 3.5 MHz: by LDIR, by the DMA with three-clock cycles,
; and by the DMA with two-clock cycles. The border changes colour as each copy starts, so the
; height of each stripe is the time it took. The DMA programs are written with .dma.
; Changes NextReg $07, the border and the DMA's cycle lengths; puts back 28 MHz, the white
; border and the DMA's default cycles.

DmaVersusLdirTitle:
    .defn "DMA Versus LDIR"

DvlSource:  .equ $0000      ; the ROM
DvlDest:    .equ $C000      ; bank 0, not contended
DvlLength:  .equ 1024

DmaVersusLdir:
    ld de,$0000
    ld c,$78
    ld hl,DmaVersusLdirTitle
    call PrintText
    ld de,$0200             ; row 2
    ld c,$38
    ld hl,DvlText1
    call PrintText
    ld de,$0400             ; row 4
    ld c,$17                ; PAPER 2 (red), INK 7
    ld hl,DvlText2
    call PrintText
    ld de,$0500
    ld c,$20                ; PAPER 4 (green), INK 0
    ld hl,DvlText3
    call PrintText
    ld de,$0600
    ld c,$30                ; PAPER 6 (yellow), INK 0
    ld hl,DvlText4
    call PrintText
    call ShowMenuFooter
    call WaitNoKey          ; the menu's key may still be down

    nextreg $07,0           ; 3.5 MHz: the stripes are eight times taller
DvlFrame:
    halt                    ; start every frame at the same point of the beam
    ld e,3                  ; wait about 44 lines, so that every stripe is in view
DvlWait:
    djnz DvlWait            ; 256 x 13 T-states
    dec e
    jr nz,DvlWait
    ld a,2
    out ($FE),a             ; red: LDIR
    ld hl,DvlSource
    ld de,DvlDest
    ld bc,DvlLength
    ldir
    ld a,4
    out ($FE),a             ; green: the DMA, three clocks a cycle
    ld hl,DvlDma3
    ld b,DvlDma3End - DvlDma3
    ld c,$6B
    otir
    ld a,6
    out ($FE),a             ; yellow: the DMA, two clocks a cycle
    ld hl,DvlDma2
    ld b,DvlDma2End - DvlDma2
    ld c,$6B
    otir
    xor a
    out ($FE),a             ; black: done
    call ScanKeys
    inc a                   ; $FF, no key, becomes 0
    jr z,DvlFrame

    ; Put things back
    nextreg $07,3
    ld a,7
    out ($FE),a
    ld a,$C3                ; DMA reset: three-clock cycles again
    out ($6B),a
    jp WaitNoKey

; Three-clock cycles, as after a reset: six T-states a byte
DvlDma3:
    .dma disable
    .dma wr0 a_to_b, transfer, DvlSource, DvlLength
    .dma wr1 memory, increment, 3t
    .dma wr2 memory, increment, 3t
    .dma wr4 continuous, DvlDest
    .dma wr5
    .dma load
    .dma enable
DvlDma3End:

; Two-clock cycles: four T-states a byte
DvlDma2:
    .dma disable
    .dma wr0 a_to_b, transfer, DvlSource, DvlLength
    .dma wr1 memory, increment, 2t
    .dma wr2 memory, increment, 2t
    .dma wr4 continuous, DvlDest
    .dma wr5
    .dma load
    .dma enable
DvlDma2End:

DvlText1:
    .defn "1K copied 3 times a frame:"
DvlText2:
    .defn " LDIR                21 T/byte "
DvlText3:
    .defn " DMA, 3-clock cycles  6 T/byte "
DvlText4:
    .defn " DMA, 2-clock cycles  4 T/byte "

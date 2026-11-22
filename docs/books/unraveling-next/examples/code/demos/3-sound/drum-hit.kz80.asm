; Demo: Drum Hit
; Chapter: The 8-Bit DACs (content/next-audio/dacs.mdx), "Who times the writes?" and "A drum hit"
;
; Makes a drum hit at $C000: 2,048 bytes of noise that die away to the rest level, $80. Key 1
; plays it through Specdrum's port $DF, one byte per CTC channel 0 interrupt (prescaler 16, time
; constant 109: 16,055 a second); key 2 plays it with the DMA in burst mode, prescaler 55. While
; the drum plays, a loop counts how often it can go round in six frames, so the screen shows how
; much of the CPU each way leaves; the first row is the count with nothing playing. At 3.5 MHz.
; Changes NextRegs $07, $08 bit 3 (the DACs), $84 bit 7 (Specdrum's port), $C0, CTC channel 0,
; the DMA, one slot of the shell's vector table, the alternate registers and $C000-$C7FF (bank 0,
; free for demos); puts back all but the memory.

DrumHitTitle:
    .defn "Drum Hit"

DhSample:   .equ $C000      ; the drum, made at run time
DhLength:   .equ 2048
DhFrames:   .equ 6          ; the count's window: 120 ms, shorter than the drum
DhEndHigh:  .equ (DhSample + DhLength) >> 8   ; $C8: the high byte just past the drum

DrumHit:
    ld de,$0000
    ld c,$78
    ld hl,DrumHitTitle
    call PrintText
    ld de,$0200             ; row 2
    ld c,$38
    ld hl,DhText1
    call PrintText
    ld de,$0300
    ld hl,DhText2
    call PrintText
    ld de,$0500             ; row 5
    ld hl,DhHeader
    call PrintText
    ld de,$0600
    ld hl,DhRow0
    call PrintText
    ld de,$0700
    ld hl,DhRow1
    call PrintText
    ld de,$0800
    ld hl,DhRow2
    call PrintText
    ld de,$0A00             ; row 10
    ld hl,DhKeys
    call PrintText
    call ShowMenuFooter
    call DhMakeDrum

    ReadNextReg($08)
    ld (DhOld08),a
    or %00001000            ; the DACs on
    nextreg $08,a
    ReadNextReg($84)
    ld (DhOld84),a
    or %10000000            ; Specdrum's port $DF on
    nextreg $84,a
    nextreg $07,0           ; 3.5 MHz: the CPU's share shows best

    ; Nothing playing: the count to compare with
    call DhSync
    call DhCount
    ld d,6
    call DhShowCount

DhKey:
    call WaitKey            ; A: the key's character
    cp $31                  ; "1"
    jr z,DhKeyCtc
    cp $32                  ; "2"
    jr nz,DhDone
    call DhSync
    call DhPlayDma
    call DhCount
    ld d,8
    call DhShowCount
    jr DhKey
DhKeyCtc:
    call DhSync
    call DhPlayCtc
    call DhCount
    ld d,7
    call DhShowCount
    jr DhKey

DhDone:
    di
    ld bc,$183B
    ld a,$03                ; CTC channel 0: software reset, no interrupts
    out (c),a
    nextreg $C0,0           ; pulse mode again
    ld hl,$BFBF
    ld ($BEA6),hl           ; the vector table's slot as the shell left it
    ld a,$C3                ; DMA reset
    out ($6B),a
    ld a,$80
    out ($DF),a             ; channels A and D at rest
    ld a,(DhOld84)
    nextreg $84,a
    ld a,(DhOld08)
    nextreg $08,a
    nextreg $07,3
    ei
    jp WaitNoKey

; Plays the drum by the CTC: channel 0 interrupts 28,000,000 / 16 / 109 = 16,055 times a
; second, and the handler writes the next byte. The alternate registers belong to the handler:
; HL' points at the next byte, BC' is channel 0's port.
DhPlayCtc:
    di
    exx
    ld hl,DhSample
    ld bc,$183B
    exx
    ld hl,DhCtcIsr
    ld ($BEA6),hl           ; CTC channel 0: vector $A0 + 3 x 2
    nextreg $C0,$A1         ; hardware IM2, vectors from $A0
    ld bc,$183B
    ld a,%10000101          ; interrupt, timer, prescaler 16, time constant next
    out (c),a
    ld a,109
    out (c),a
    ei
    ret

DhCtcIsr:
    push af
    exx
    ld a,(hl)
    out ($DF),a             ; Specdrum: channels A and D
    inc hl
    ld a,h
    cp DhEndHigh
    jr nz,DhCtcIsrEnd
    ld a,$03                ; the last byte: stop channel 0
    out (c),a
DhCtcIsrEnd:
    exx
    pop af
    ei
    reti

; Plays the drum by the DMA: one program, and the DMA paces the bytes itself
DhPlayDma:
    ld hl,DhDma
    ld b,DhDmaEnd - DhDma
    ld c,$6B
    otir
    ret

DhDma:
    .dma disable
    .dma wr0 a_to_b, transfer, DhSample, DhLength
    .dma wr1 memory, increment
    .dma wr2 io, fixed, 3t, 55  ; a byte every 32 x 55 clocks
    .dma wr4 burst, $00DF       ; give the bus back between bytes
    .dma wr5                    ; once, no auto restart
    .dma load
    .dma enable
DhDmaEnd:

; Waits for the start of a frame. HALT would also wake for the CTC, so it watches Frames.
DhSync:
    ld a,(Frames)
    ld b,a
DhSyncLoop:
    ld a,(Frames)
    cp b
    jr z,DhSyncLoop
    ret

; Counts how often a short loop goes round in DhFrames frames; returns the count in HL
DhCount:
    ld a,(Frames)
    add a,DhFrames
    ld b,a
    ld hl,0
DhCountLoop:
    inc hl
    ld a,(Frames)
    cp b
    jr nz,DhCountLoop
    ret

; Prints the count in HL at row D, column 24
DhShowCount:
    ld e,24
    ld c,$38
    jp PrintNum16

; Makes the drum: noise whose amplitude falls a little every 16 bytes, centred on $80, so that
; the last bytes are $80. Each byte is $80 - amp / 2 + noise x amp / 256.
DhMakeDrum:
    ld ix,DhSample
    ld hl,$ACE1             ; the noise's state; never 0
    ld c,255                ; C: the amplitude
DhMakeBlock:
    ld b,16
DhMakeByte:
    ; xorshift: the next 16-bit noise in HL
    ld a,h
    rra
    ld a,l
    rra
    xor h
    ld h,a
    ld a,l
    rra
    ld a,h
    rra
    xor l
    ld l,a
    xor h
    ld h,a
    ld d,a
    ld e,c
    mul d,e                 ; DE: noise x amp
    ld a,c
    srl a
    neg
    add a,$80               ; $80 - amp / 2
    add a,d                 ; + noise x amp / 256
    ld (ix+0),a
    inc ix
    djnz DhMakeByte
    ld a,c                  ; amp - amp / 32 - 1, down to 0
    or a
    jr z,DhMakeNext
    rrca
    rrca
    rrca
    rrca
    rrca
    and $07
    inc a
    ld b,a
    ld a,c
    sub b
    jr nc,DhMakeAmp
    xor a
DhMakeAmp:
    ld c,a
DhMakeNext:
    push ix
    pop de
    ld a,d
    cp DhEndHigh
    jr nz,DhMakeBlock
    ret

DhOld08:
    .defb 0
DhOld84:
    .defb 0
DhText1:
    .defn "2,048 bytes of noise to port $DF"
DhText2:
    .defn "Loops the CPU runs in 6 frames:"
DhHeader:
    .defn "While the drum plays    count"
DhRow0:
    .defn "nothing plays"
DhRow1:
    .defn "1: CTC interrupts"
DhRow2:
    .defn "2: DMA, prescaler 55"
DhKeys:
    .defn "Other keys: the menu"

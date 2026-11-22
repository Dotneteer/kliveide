; The AY chips and the DACs: writing a register, and silencing everything. The demos of Part III
; use these; the shell's reset calls SilenceSound between demos.

; Writes E to register A of the selected AY chip. Uses BC.
AyWrite:
    ld bc,$FFFD
    out (c),a               ; select the register
    ld b,$BF                ; BC: $BFFD
    out (c),e               ; write its value
    ret

; Writes the register list at HL to the selected AY chip: pairs of register, value, ended by $FF.
; Uses A, BC, E, HL.
AyWriteList:
    ld a,(hl)
    cp $FF
    ret z
    inc hl
    ld e,(hl)
    inc hl
    call AyWrite
    jr AyWriteList

; Silences all three AY chips and every DAC channel. Leaves chip 0 selected, every chip's pan at
; both sides, and TurboSound, ABC/ACB and the DACs' switch as it found them. Uses A, BC, E, HL.
SilenceSound:
    ReadNextReg($08)
    push af
    or %00000010            ; TurboSound on for a moment, so that the chip selects count
    nextreg $08,a
    ld a,$FD                ; chip 2, both sides
    call SilenceAyChip
    ld a,$FE                ; chip 1, both sides
    call SilenceAyChip
    ld a,$FF                ; chip 0 last, so that it stays selected
    call SilenceAyChip
    pop af
    nextreg $08,a           ; TurboSound as it was
    nextreg $2C,$80         ; every DAC channel at its rest level (ignored while the DACs are off)
    nextreg $2D,$80
    nextreg $2E,$80
    ret

; Selects the chip whose select value is in A and silences it: volumes 0, tones and noise off
SilenceAyChip:
    ld bc,$FFFD
    out (c),a
    ld hl,SilenceAyRegs
    jr AyWriteList

SilenceAyRegs:
    .defb 8, 0, 9, 0, 10, 0     ; volume 0, no envelope
    .defb 7, $FF                ; tones and noise off, as after a reset
    .defb $FF

; The shell's safety net. Every demo restores what it changed, but this routine also switches off
; the big switches a demo might have left on, so one demo can never spoil the next.

; Puts the machine into the menu's state and enables interrupts
ResetMachine:
    di
    nextreg $07,3           ; CPU at 28 MHz
    nextreg $C0,0           ; pulse interrupt mode (not hardware IM2), stackless NMI off
    nextreg $C4,1           ; interrupt sources: the ULA's frame interrupt only
    nextreg $C5,0           ; no CTC interrupts
    nextreg $C6,0           ; no UART interrupts
    nextreg $22,0           ; ULA interrupt on, line interrupt off
    nextreg $15,0           ; sprites off, layer order S L U, LoRes off
    nextreg $69,0           ; Layer 2 off, ULA shadow screen off, standard Timex mode
    nextreg $6B,0           ; tilemap off
    nextreg $68,0           ; ULA output on, no blending, no ULA+
    nextreg $62,0           ; Copper stopped
    nextreg $43,0           ; palette control: first palettes active, writes go to the ULA's
    nextreg $14,$E3         ; global transparency colour back to its default
    nextreg $4A,$E3         ; fallback colour
    nextreg $4B,$E3         ; sprite transparency index
    nextreg $4C,$0F         ; tilemap transparency index
    nextreg $42,$07         ; ULANext ink mask
    nextreg $6A,0           ; LoRes: not Radastan, palette offset 0
    nextreg $70,0           ; Layer 2: 256 x 192, palette offset 0
    nextreg $12,8           ; Layer 2's picture in bank 8
    nextreg $6E,$2C         ; tilemap at $6C00
    nextreg $6F,$0C         ; tile definitions at $4C00
    nextreg $23,0           ; line interrupt at line 0
    nextreg $64,0           ; no vertical line count offset
    nextreg $16,0           ; scroll offsets: Layer 2 X, Y and X's high bit
    nextreg $17,0
    nextreg $71,0
    nextreg $26,0           ; ULA X, Y
    nextreg $27,0
    nextreg $32,0           ; LoRes X, Y
    nextreg $33,0
    nextreg $2F,0           ; tilemap X (high, low), Y
    nextreg $30,0
    nextreg $31,0
    nextreg $1C,$0F         ; clip windows: restart the index of all four
    nextreg $18,0           ; Layer 2: X 0-255, Y 0-191
    nextreg $18,255
    nextreg $18,0
    nextreg $18,191
    nextreg $19,0           ; sprites: the same
    nextreg $19,255
    nextreg $19,0
    nextreg $19,191
    nextreg $1A,0           ; ULA and LoRes: the same
    nextreg $1A,255
    nextreg $1A,0
    nextreg $1A,191
    nextreg $1B,0           ; tilemap: X 0-159 (in two-dot units), Y 0-255
    nextreg $1B,159
    nextreg $1B,0
    nextreg $1B,255
    ld bc,$123B
    xor a
    out (c),a               ; Layer 2: no write paging
    ld bc,$303B
    out (c),a               ; sprite 0's attributes next
    ld b,a                  ; 256 times two zero bytes: all 128 sprites hidden
ResetSprites:
    out ($57),a
    out ($57),a
    djnz ResetSprites
    ld a,$83
    out ($6B),a             ; DMA: disable, so no transfer is left running
    ld bc,$183B             ; CTC channel 0
    ld e,4
ResetCtc:
    ld a,$03                ; software reset, no time constant: the channel stops
    out (c),a
    out (c),a               ; twice, in case it was waiting for a time constant
    inc b                   ; the next channel: $193B, $1A3B, $1B3B
    dec e
    jr nz,ResetCtc
    call SilenceSound       ; the three AY chips and the DACs
    ld a,7
    out ($FE),a             ; white border, beeper and MIC off
    ld a,$FF
    out ($E7),a             ; deselect every SPI device (SD cards, flash, Pi)

    ; The 48K BASIC ROM (ROM 3) at $0000: lib/screen.kz80.asm prints with its font
    nextreg $50,$FF         ; MMU 0: ROM
    nextreg $51,$FF         ; MMU 1: ROM
    ld bc,$1FFD
    ld a,%00000100          ; bit 2: the high bit of the ROM number; normal paging
    out (c),a
    ld bc,$7FFD
    ld a,%00010000          ; bit 4: the low bit of the ROM number; RAM bank 0 at $C000
    out (c),a

    ; The IM2 vector table: whatever byte is on the bus, the vector is $BFBF
    ld hl,VectorPage * 256
    ld de,VectorPage * 256 + 1
    ld bc,256
    ld (hl),$BF
    ldir
    ld a,VectorPage
    ld i,a
    im 2
    ei
    ret

; The frame interrupt: counts frames, nothing else
FrameIsr:
    push af
    ld a,(Frames)
    inc a
    ld (Frames),a
    pop af
    ei
    reti

; Incremented once per frame by FrameIsr
Frames:
    .defb 0

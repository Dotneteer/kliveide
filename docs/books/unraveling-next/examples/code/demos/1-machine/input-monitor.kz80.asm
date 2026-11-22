; Demo: Input Monitor
; Chapter: Input (content/next-input.mdx)
;
; Shows every input the chapter describes, live, once a frame: the eight half-rows of the
; keyboard matrix from port $FE, the sixteen extra keys from NextRegs $B0 and $B1, Kempston
; joystick 1 from port $1F, and the mouse from ports $FBDF, $FFDF and $FADF. A key or button that
; is down is lit green. ENTER toggles bit 4 of NextReg $68: set, the extra keys stop entering their
; matrix pairs, and only $B0/$B1 report them. BREAK returns to the menu.
; Changes NextReg $68; puts it back.

InputMonitorTitle:
    .defn "Input Monitor"

ImOff:      .equ $38        ; PAPER 7, INK 0
ImOn:       .equ $60        ; BRIGHT 1, PAPER 4, INK 0

InputMonitor:
    ld de,$0000
    ld c,$78
    ld hl,InputMonitorTitle
    call PrintText
    ld c,$38
    ld hl,ImLabels          ; the fixed text: row, column, text; ends with row $FF
ImLabel:
    ld d,(hl)
    inc d
    jr z,ImLabelsDone
    dec d
    inc hl
    ld e,(hl)
    inc hl
    call PrintText
    inc hl                  ; past the terminating zero
    jr ImLabel
ImLabelsDone:
    ReadNextReg($68)
    ld (ImOld68),a          ; to put back at the end
    xor a
    ld (ImEnterWas),a
    call WaitNoKey          ; the menu's key may still be down

ImFrame:
    halt
    ; The keyboard: eight half-rows, five keys each, bit 0 first
    ld bc,$FEFE
    ld hl,$5800 + 2 * 32 + 7    ; row 2, column 7: the first key cell
ImRow:
    in a,(c)
    cpl                     ; a pressed key reads 0: make it 1
    and $1F
    push bc
    push hl
    ld b,5
    ld d,3                  ; three columns a key
    call ImLight
    pop hl
    pop bc
    ld de,32
    add hl,de               ; the next row on the screen
    rlc b                   ; the next half-row
    jr c,ImRow

    ; The sixteen extra keys
    ReadNextReg($B0)
    ld hl,$5800 + 12 * 32   ; row 12
    ld b,8
    ld d,4
    call ImLight
    ReadNextReg($B1)
    ld (ImB1),a             ; bit 5: the BREAK key
    ld hl,$5800 + 14 * 32   ; row 14
    ld b,8
    ld d,4
    call ImLight

    ; Kempston joystick 1: 1 for pressed
    in a,($1F)
    ld hl,$5800 + 17 * 32
    ld b,6
    ld d,2
    call ImLight

    ; The mouse: X and Y counters, then the buttons, 0 for pressed
    ld de,$1309             ; row 19, column 9
    ld bc,$FBDF
    in a,(c)
    ld c,ImOff
    call PrintHex8
    ld e,16
    ld bc,$FFDF
    in a,(c)
    ld c,ImOff
    call PrintHex8
    ld e,26
    ld bc,$FADF
    in a,(c)
    push af
    rrca
    rrca
    rrca
    rrca
    and $0F                 ; the wheel, bits 7-4
    ld c,ImOff
    call PrintHexDigit
    pop af
    cpl
    ld hl,$5800 + 20 * 32 + 8   ; row 20, column 8: R, L, M
    ld b,3
    ld d,2
    call ImLight

    ; ENTER (port $BFFE bit 0) toggles $68 bit 4, once per press
    ld a,$BF
    in a,($FE)
    cpl
    and 1                   ; 1: ENTER is down
    ld hl,ImEnterWas
    ld b,(hl)
    ld (hl),a
    cp b
    jr z,ImShow68           ; no change
    or a
    jr z,ImShow68           ; just released
    ReadNextReg($68)
    xor %00010000           ; bit 4: cancel the extra keys' matrix entries
    nextreg $68,a
ImShow68:
    ReadNextReg($68)
    and %00010000
    ld de,$0F13             ; row 15, column 19
    ld c,ImOff
    ld hl,ImPairsOn
    jr z,ImPrint68
    ld hl,ImPairsOff
ImPrint68:
    call PrintText

    ; BREAK: the Next's BREAK key ($B1 bit 5), or CAPS SHIFT and SPACE together. With $68 bit 4
    ; set, the BREAK key no longer enters CAPS SHIFT + SPACE, so look at both.
    ld a,(ImB1)
    bit 5,a
    jr nz,ImExit
    ld a,$FE
    in a,($FE)
    rrca
    jp c,ImFrame
    ld a,$7F
    in a,($FE)
    rrca
    jp c,ImFrame
ImExit:
    ld a,(ImOld68)
    nextreg $68,a
    jp WaitNoKey

; Colours B cells of D attribute bytes each, from HL: the cell for bit 0 of A first, lit when the
; bit is 1
ImLight:
    ld c,a
ImLightCell:
    ld a,ImOff
    rr c
    jr nc,ImLightFill
    ld a,ImOn
ImLightFill:
    ld e,d
ImLightByte:
    ld (hl),a
    inc hl
    dec e
    jr nz,ImLightByte
    djnz ImLightCell
    ret

ImOld68:
    .defb 0
ImEnterWas:
    .defb 0
ImB1:
    .defb 0
ImPairsOn:
    .defn "0 (pairs on) "
ImPairsOff:
    .defn "1 (pairs off)"

; The fixed text, cells in bit order: bit 0 first
ImLabels:
    .defb 1,0
    .defn "Port $FE, bit 0 first:"
    .defb 2,0
    .defn "$FEFE  CS Z  X  C  V"
    .defb 3,0
    .defn "$FDFE  A  S  D  F  G"
    .defb 4,0
    .defn "$FBFE  Q  W  E  R  T"
    .defb 5,0
    .defn "$F7FE  1  2  3  4  5"
    .defb 6,0
    .defn "$EFFE  0  9  8  7  6"
    .defb 7,0
    .defn "$DFFE  P  O  I  U  Y"
    .defb 8,0
    .defn "$BFFE  EN L  K  J  H"
    .defb 9,0
    .defn "$7FFE  SP SS M  N  B"
    .defb 11,0
    .defn "NextReg $B0, bit 0 first:"
    .defb 12,0
    .defm "RT  LF  DN  UP  .   ,   "
    .defb 34
    .defn "   ;"
    .defb 13,0
    .defn "NextReg $B1:"
    .defb 14,0
    .defn "EXT CAP GRA TRU INV BRK EDT DEL"
    .defb 15,0
    .defn "ENTER: $68 bit 4 ="
    .defb 16,0
    .defn "Kempston 1, port $1F:"
    .defb 17,0
    .defn "R L D U B C"
    .defb 19,0
    .defn "Mouse X $    Y $    wheel"
    .defb 20,0
    .defn "Buttons R L M"
    .defb 22,0
    .defn "BREAK: back to the menu"
    .defb $FF

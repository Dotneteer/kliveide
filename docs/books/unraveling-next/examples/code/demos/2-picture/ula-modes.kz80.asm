; Demo: ULA Modes
; Chapter: The ULA Layer (content/next-display/ula.mdx)
;
; One key for each way the ULA can show bank 5: 1 standard, 2 hi-colour, 3 hi-res, 4 ULANext and
; 5 ULA+. Standard and hi-colour show the same bitmap: the first takes one colour for each 8 x 8
; cell from $5800, the second one for each 8 x 1 dots from $6000. Hi-res prints 64 columns, the
; even ones at $4000 and the odd ones at $6000, in the one ink port $FF picks. ULANext, with the
; mask $0F, shows 16 inks and 16 papers; ULA+ shows its 64 colours. Both take their colours from
; the ULA's second palette, which the demo fills. Any other key returns to the menu.
; Changes port $FF, NextRegs $40-$44 and $68 and the ULA's second palette; puts them all back.
; UmSavePalette, UmRestorePalette and UmInks also serve Big Pixels.

UlaModesTitle:
    .defn "ULA Modes"

UmPalSave:  .equ $C000      ; 512 bytes in bank 0: the ULA's second palette while the demo runs

UlaModes:
    ReadNextReg($42)
    ld (UmOld42),a
    ReadNextReg($43)
    ld (UmOld43),a
    ReadNextReg($68)
    ld (UmOld68),a
    call UmSavePalette

    ; The ULA's second palette: 16 inks for ULANext at 0-15, 16 papers at 128-143
    nextreg $43,%01000000   ; write the ULA's second palette
    nextreg $40,0
    ld hl,UmInks
    ld b,16
UmInkLoop:
    ld a,(hl)
    nextreg $41,a
    inc hl
    djnz UmInkLoop
    nextreg $40,128
UmPaperLoop:                ; B counts 0-15: paper B is level B/2 of red and green, with blue
    ld a,b
    srl a
    ld c,a
    add a,a
    add a,a
    add a,a
    or c
    add a,a
    add a,a                 ; level << 5 | level << 2
    or 3
    nextreg $41,a
    inc b
    bit 4,b
    jr z,UmPaperLoop

    ; ULA+ at 192-255: index bits 5-4 the group, bit 3 paper, bits 2-0 the colour (G, R, B)
    nextreg $40,192
    ld b,0
UmPlusLoop:
    ld a,b
    rrca
    rrca
    rrca
    and 7                   ; group * 2 + paper
    ld hl,UmPlusLevels
    add hl,a
    ld c,(hl)               ; the level of this group's inks or papers
    xor a
    bit 1,b                 ; red
    jr z,UmPlusNoRed
    ld a,c
UmPlusNoRed:
    add a,a
    add a,a
    add a,a
    bit 2,b                 ; green
    jr z,UmPlusNoGreen
    or c
UmPlusNoGreen:
    add a,a
    add a,a
    bit 0,b                 ; blue: two bits
    jr z,UmPlusNoBlue
    ld d,a
    ld a,c
    srl a
    or d
UmPlusNoBlue:
    nextreg $41,a
    inc b
    bit 6,b
    jr z,UmPlusLoop

    xor a                   ; start with the standard screen
UmKey:
    call UmShow
    call WaitKey            ; A: the key's character
    sub $31                 ; "1"
    cp 5
    jr c,UmKey              ; 1-5: show that mode

    ; Put everything back
    xor a
    out ($FF),a             ; the standard Timex mode
    call UmRestorePalette
    ld a,(UmOld42)
    nextreg $42,a
    ld a,(UmOld43)
    nextreg $43,a
    ld a,(UmOld68)
    nextreg $68,a
    jp WaitNoKey

; Shows mode A (0-4): back to the standard screen while drawing, then the mode's own routine
UmShow:
    push af
    xor a
    out ($FF),a
    nextreg $43,0           ; ULANext off, the first palettes
    nextreg $68,0           ; ULA+ off
    call ClearScreen
    pop af
    add a,a
    ld hl,UmModes
    add hl,a
    ld a,(hl)
    inc hl
    ld h,(hl)
    ld l,a
    jp (hl)

UmModes:
    .defw UmStandard, UmHiColour, UmHiRes, UmUlaNext, UmUlaPlus

UmStandard:
    ld hl,UmStandardText
    jp UmStripes

UmHiColour:
    ld hl,UmHiColourText
    call UmStripes
    ld a,%00000010          ; port $FF bits 2-0 = 010: hi-colour
    out ($FF),a
    ret

UmHiRes:
    ld hl,$6000             ; the second file holds the odd columns: clear it
    ld de,$6001
    ld bc,$17FF
    ld (hl),0
    ldir
    ld hl,UmHiResTexts
UmHiResLine:
    ld a,(hl)               ; the row, or $FF at the end
    inc hl
    cp $FF
    jr z,UmHiResOn
    ld d,a
    ld e,0
    call UmHrText
    jr UmHiResLine
UmHiResOn:
    ld a,%00001110          ; bits 5-3 = 001: blue ink, yellow paper; bits 2-0 = 110: hi-res
    out ($FF),a
    ret

UmUlaNext:
    ld hl,UmUlaNextText
    call UmTexts
    ld hl,$5800             ; every cell: ink 0 (black), paper 15 (entry 143, white)
    ld de,$5801
    ld bc,767
    ld (hl),$F0
    ldir
    call UmBand
    ld hl,$5800 + 4 * 32    ; rows 4-19: the paper is the row, the ink the column pair
    ld d,0
UmUnRow:
    ld e,0
UmUnCol:
    ld a,d
    swapnib                 ; paper: bits 7-4
    ld b,a
    ld a,e
    srl a                   ; ink: bits 3-0
    or b
    ld (hl),a
    inc hl
    inc e
    bit 5,e
    jr z,UmUnCol
    inc d
    bit 4,d
    jr z,UmUnRow
    nextreg $42,$0F         ; the mask: bits 3-0 are the ink
    nextreg $43,%00000011   ; the ULA's second palette, ULANext on
    ret

UmUlaPlus:
    ld hl,UmUlaPlusText
    call UmTexts
    call UmBand
    ld hl,$5800 + 4 * 32    ; rows 4-19: four rows for each group, a paper for every 4 columns
    ld d,0
UmUpRow:
    ld e,0
UmUpCol:
    ld a,d
    and $0C
    rlca
    rlca
    rlca
    rlca                    ; the group, in bits 7-6 (FLASH and BRIGHT)
    ld b,a
    ld a,e
    and $1C
    add a,a                 ; the paper, in bits 5-3
    or b
    ld b,a
    ld a,e
    and 3
    or b
    bit 0,d
    jr z,UmUpInk
    or 4                    ; inks 4-7 on odd rows
UmUpInk:
    ld (hl),a
    inc hl
    inc e
    bit 5,e
    jr z,UmUpCol
    inc d
    bit 4,d
    jr z,UmUpRow
    nextreg $43,%00000010   ; the ULA's second palette
    nextreg $68,%00001000   ; bit 3: ULA+ on
    ret

; Standard and hi-colour: the texts, a colour byte at $6000 for every bitmap byte, and the band.
; HL: the mode's two lines.
UmStripes:
    call UmTexts
    ld de,$6000             ; outside the band, each colour byte copies its cell's attribute
UmCopyAttrs:
    ld a,d
    and $18                 ; the third of the screen
    rrca
    rrca
    rrca
    add a,$58
    ld h,a
    ld l,0
    ld bc,256
    ldir                    ; one line of a third: D moves on by one
    ld a,d
    cp $78
    jr nz,UmCopyAttrs
    call UmBand
    ld d,4                  ; rows 4-19: the attribute is the colour of the cell's top line
UmTopLine:
    ld a,d
    and $18
    or $60
    ld h,a
    ld a,d
    and 7
    rrca
    rrca
    rrca
    ld l,a                  ; HL: the colour bytes of pixel line 8 * D
    push de
    ld e,d
    ld d,32
    mul d,e
    add de,$5800            ; DE: the attributes of row D
    ld bc,32
    ldir
    pop de
    inc d
    ld a,d
    cp 20
    jr nz,UmTopLine
    ret

; Fills text rows 4-19 with the bitmap byte $F0, 4 dots of ink and 4 of paper, and gives every
; byte a colour byte at $6000: ink (line + line / 8 + column) AND 7, paper the opposite, BRIGHT.
UmBand:
    ld d,32                 ; the pixel line
UmBandLine:
    ld e,0
    pixelad                 ; HL: the first byte of line D
    ld a,d
    rrca
    rrca
    rrca
    and $1F
    add a,d
    ld c,a                  ; line + line / 8: each row of cells starts one colour on
    ld b,32
UmBandByte:
    ld (hl),$F0
    ld a,c
    and 7
    ld e,a                  ; the ink
    xor 7                   ; the paper
    add a,a
    add a,a
    add a,a
    or e
    or $40                  ; BRIGHT
    set 5,h                 ; the colour byte: 8K higher
    ld (hl),a
    res 5,h
    inc l
    inc c
    djnz UmBandByte
    inc d
    ld a,d
    cp 160
    jr nz,UmBandLine
    ret

; Prints the title, the two lines at HL (rows 2 and 3) and the keys
UmTexts:
    push hl
    ld de,$0000
    ld c,$78
    ld hl,UlaModesTitle
    call PrintText
    ld de,$1700
    ld c,$68
    ld hl,UmKeysText
    call PrintText
    pop hl
    ld de,$0200
    ld c,$38
    call PrintText
    inc hl
    ld de,$0300
    jp PrintText

; Prints the text at HL in hi-res, from column E (0-63) of row D. Returns HL after its zero.
UmHrText:
    ld a,(hl)
    inc hl
    or a
    ret z
    push hl
    push de
    ld l,a
    ld h,0
    add hl,hl
    add hl,hl
    add hl,hl
    add hl,$3C00            ; the character's 8 bytes in the ROM
    push hl
    ld a,d
    add a,a
    add a,a
    add a,a
    ld d,a                  ; the pixel line: row * 8
    ld b,e
    ld a,e
    and $3E
    add a,a
    add a,a
    ld e,a                  ; the pixel column of byte column / 2
    pixelad
    bit 0,b
    jr z,UmHrEven
    set 5,h                 ; an odd column: the same place in the file at $6000
UmHrEven:
    pop de
    ld b,8
UmHrLine:
    ld a,(de)
    ld (hl),a
    inc de
    inc h                   ; the next pixel line of the cell
    djnz UmHrLine
    pop de
    pop hl
    inc e
    jr UmHrText

; Copies the ULA's second palette to UmPalSave, two bytes an entry
UmSavePalette:
    nextreg $43,%01000000   ; the ULA's second palette
    ld hl,UmPalSave
    xor a
UmSaveEntry:
    nextreg $40,a
    push af
    ReadNextReg($41)
    ld (hl),a
    inc hl
    ReadNextReg($44)
    ld (hl),a
    inc hl
    pop af
    inc a
    jr nz,UmSaveEntry
    ret

; Writes UmPalSave back into the ULA's second palette
UmRestorePalette:
    nextreg $43,%01000000
    nextreg $40,0
    ld hl,UmPalSave
    ld b,0                  ; 256 entries
UmRestoreEntry:
    ld a,(hl)
    inc hl
    nextreg $44,a           ; two writes an entry: RRRGGGBB, then the lowest blue bit
    ld a,(hl)
    inc hl
    nextreg $44,a
    djnz UmRestoreEntry
    ret

; ULANext's 16 inks (and Radastan's 16 colours in Big Pixels), RRRGGGBB
UmInks:
    .defb $00, $02, $03, $17, $1F, $1C, $5C, $9C
    .defb $FC, $F4, $EC, $E0, $E2, $C3, $63, $FF
; ULA+ levels: the inks and papers of groups 0-3
UmPlusLevels:
    .defb 5, 7, 7, 5, 3, 6, 6, 2

UmOld42:
    .defb 0
UmOld43:
    .defb 0
UmOld68:
    .defb 0

UmKeysText:
    .defn "1-5: a mode    Other keys: menu"
UmStandardText:
    .defn "1 Standard: one ink and paper"
    .defn "  per 8 x 8 cell, from $5800"
UmHiColourText:
    .defn "2 Hi-colour: one ink and paper"
    .defn "  per 8 x 1 dots, from $6000"
UmUlaNextText:
    .defn "4 ULANext, mask $0F: 16 inks"
    .defn "  (0-15) and 16 papers (128-143)"
UmUlaPlusText:
    .defn "5 ULA+: 4 groups of 16 colours"
    .defn "  (192-255): FLASH, BRIGHT pick"
; Hi-res: the row, then the text, 64 columns at most; $FF ends the list
UmHiResTexts:
    .defb 0
    .defn "ULA Modes"
    .defb 2
    .defn "3 Hi-res: 512 dots across, 64 columns of 8 dots each."
    .defb 3
    .defn "  Even columns come from $4000, odd columns from $6000."
    .defb 5
    .defn "  Port $FF = $0E: bits 5-3 = 001, blue ink on yellow paper"
    .defb 6
    .defn "  for the whole screen. No attributes are read."
    .defb 23
    .defn "1-5: a mode    Other keys: menu"
    .defb $FF

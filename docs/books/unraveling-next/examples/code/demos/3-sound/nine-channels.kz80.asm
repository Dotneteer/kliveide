; Demo: Nine Channels
; Chapter: TurboSound (content/next-audio/turbosound.mdx), "Panning a whole chip"
;
; Switches TurboSound on and plays a C major chord on each of the three AY chips, an octave
; apart: nine channels at once. Chip 0 starts on the left, chip 1 on both sides, chip 2 on the
; right. Keys 1-3 move a chip's pan on (both, left, right, muted) by selecting the chip again
; with new pan bits; key 4 switches ABC and ACB. Any other key returns to the menu.
; Changes the three chips' registers and pans, and NextReg $08 bits 1 (TurboSound) and 5 (ACB);
; silences the chips, puts every pan back to both sides, and writes back the old $08.

NineChannelsTitle:
    .defn "Nine Channels"

NcFirstRow: .equ 5          ; chip 0's row

NineChannels:
    ld de,$0000
    ld c,$78
    ld hl,NineChannelsTitle
    call PrintText
    ld de,$0200             ; row 2
    ld c,$38
    ld hl,NcText1
    call PrintText
    ld de,$0400             ; row 4
    ld hl,NcHeader
    call PrintText
    ld de,$0C00             ; row 12
    ld hl,NcKeys1
    call PrintText
    ld de,$0D00
    ld hl,NcKeys2
    call PrintText
    ld de,$0E00
    ld hl,NcKeys3
    call PrintText
    call ShowMenuFooter

    ReadNextReg($08)
    ld (NcOld08),a
    or %00000010            ; TurboSound on: the chip selects count
    and %11011111           ; ABC
    nextreg $08,a
    ld hl,NcStartPans
    ld de,NcPans
    ld bc,3
    ldir

    ; Each chip: select it with its pan, then its registers
    xor a
NcSetUp:
    ld (NcChip),a
    call NcSelect
    ld a,(NcChip)
    ld hl,NcChord0
    ld e,a
    add a,a
    add a,a
    add a,a
    add a,e                 ; chip * 9: three periods of three bytes
    add hl,a
    ld b,3
    xor a                   ; R0, R2, R4: the low bytes
NcPeriods:
    push bc
    push af
    ld e,(hl)
    inc hl
    call AyWrite            ; the period's low byte
    pop af
    inc a
    push af
    ld e,(hl)
    inc hl
    call AyWrite            ; its high byte
    pop af
    inc a
    inc hl                  ; the note's name is for the screen
    pop bc
    djnz NcPeriods
    ld hl,NcVolumes
    call AyWriteList
    call NcShowChip
    ld a,(NcChip)
    inc a
    cp 3
    jr nz,NcSetUp
    call NcShowLayout

NcKey:
    call WaitKey            ; A: the key's character
    sub $31                 ; "1"
    cp 3
    jr c,NcPanKey           ; 1-3: the chip's next pan
    cp 3
    jr nz,NcDone            ; not 4: back to the menu
    ReadNextReg($08)
    xor %00100000           ; ABC <-> ACB
    nextreg $08,a
    call NcShowLayout
    jr NcKey
NcPanKey:
    ld (NcChip),a
    ld hl,NcPans
    add hl,a
    ld a,(hl)
    inc a
    and 3                   ; both, left, right, muted, both...
    ld (hl),a
    call NcSelect           ; selecting the chip sets its pan
    call NcShowChip
    jr NcKey

NcDone:
    call SilenceSound       ; also selects every chip with both pan bits set
    ld a,(NcOld08)
    nextreg $08,a
    jp WaitNoKey

; Selects chip NcChip with its pan from NcPans. The select value is %1 LR 111 cc: bit 7 set, the
; pan in bits 6-5, %111 in bits 4-2, the chip in bits 1-0 (%11 chip 0, %10 chip 1, %01 chip 2).
NcSelect:
    ld a,(NcChip)
    ld hl,NcPans
    add hl,a
    ld e,(hl)
    ld hl,NcPanBits
    ld a,e
    add hl,a
    ld e,(hl)               ; the pan's bits 6-5
    ld a,(NcChip)
    ld hl,NcChipBits
    add hl,a
    ld a,(hl)               ; %100111cc
    or e
    ld bc,$FFFD
    out (c),a
    ld (NcSelected),a
    ret

; Prints chip NcChip's row: its number, notes, select value and pan
NcShowChip:
    ld a,(NcChip)
    add a,NcFirstRow
    ld d,a
    ld e,1
    ld c,$38
    ld a,(NcChip)
    add a,$30
    call PrintCharNext
    ld e,6
    ld a,(NcChip)
    ld hl,NcChord0 + 2
    ld b,a
    add a,a
    add a,a
    add a,a
    add a,b
    add hl,a
    ld b,3
NcShowNote:
    push bc                 ; PrintText changes B
    push hl
    ld a,(hl)
    ld l,a
    ld h,0
    add hl,NcNames          ; each name is three bytes
    call PrintText
    inc e
    pop hl
    pop bc
    inc hl
    inc hl
    inc hl
    djnz NcShowNote
    ld e,17
    ld a,$24                ; "$"
    call PrintCharNext
    ld a,(NcSelected)
    call PrintHex8
    ld e,22
    ld a,(NcChip)
    ld hl,NcPans
    add hl,a
    ld a,(hl)
    add a,a
    ld hl,NcPanNames
    add hl,a
    ld a,(hl)
    inc hl
    ld h,(hl)
    ld l,a
    jp PrintText

; Prints which channel of each chip sits where: ABC or ACB, from NextReg $08 bit 5
NcShowLayout:
    ReadNextReg($08)
    ld hl,NcAbcText
    bit 5,a
    jr z,NcShowLayout1
    ld hl,NcAcbText
NcShowLayout1:
    ld de,$0900             ; row 9
    ld c,$38
    jp PrintText

; Each chip's chord: three notes of period low, period high, the offset of the name in NcNames
NcChord0:
    .defb 836 & $FF, 836 >> 8, 0        ; chip 0: C3, E3, G3
    .defb 664 & $FF, 664 >> 8, 3
    .defb 558 & $FF, 558 >> 8, 6
    .defb 418 & $FF, 418 >> 8, 9        ; chip 1: C4, E4, G4
    .defb 332 & $FF, 332 >> 8, 12
    .defb 279 & $FF, 279 >> 8, 15
    .defb 209, 0, 18                    ; chip 2: C5, E5, G5
    .defb 166, 0, 21
    .defb 140, 0, 24

NcNames:
    .defn "C3"
    .defn "E3"
    .defn "G3"
    .defn "C4"
    .defn "E4"
    .defn "G4"
    .defn "C5"
    .defn "E5"
    .defn "G5"

; Tones on, noise off, volume 12 on all three channels
NcVolumes:
    .defb 7, %00111000
    .defb 8, 12, 9, 12, 10, 12
    .defb $FF

NcChipBits:
    .defb %10011111, %10011110, %10011101    ; chips 0, 1, 2
NcPanBits:
    .defb %01100000, %01000000, %00100000, %00000000    ; both, left, right, muted
NcStartPans:
    .defb 1, 0, 2           ; chip 0 left, chip 1 both, chip 2 right
NcPanNames:
    .defw NcBoth, NcLeft, NcRight, NcMuted

NcPans:
    .defs 3
NcChip:
    .defb 0
NcSelected:
    .defb 0
NcOld08:
    .defb 0
NcText1:
    .defn "TurboSound on: 9 channels"
NcHeader:
    .defn "Chip Notes      Select Pan"
NcAbcText:
    .defn "ABC: C left, E middle, G right"
NcAcbText:
    .defn "ACB: C left, G middle, E right"
NcKeys1:
    .defn "1-3: the chip's next pan"
NcKeys2:
    .defn "4:   ABC or ACB"
NcKeys3:
    .defn "Other keys: the menu"
NcBoth:
    .defn "both "
NcLeft:
    .defn "left "
NcRight:
    .defn "right"
NcMuted:
    .defn "muted"

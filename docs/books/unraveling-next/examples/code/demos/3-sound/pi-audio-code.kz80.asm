; Code of Pi Audio (pi-audio.kz80.asm), kept at the start of bank 26, page 52, which CallBank pages in
; at $C000. Banked code: main.kz80.asm includes this file after all unbanked code.

    .bank 26                ; pages 52 and 53

PaReads:    .equ 500        ; reads of a NextReg in one measurement
PaLeftRow:  .equ 6          ; the left channel's numbers; its bar is the row below
PaRightRow: .equ 9

PaStart:                    ; $C000, where CallBank calls
    ld de,$0000
    ld c,$78
    ld hl,PiAudioTitle
    call PrintText
    ld de,$0200             ; rows 2-4: three texts, one after the other
    ld c,$38
    ld hl,PaText1
PaIntro:
    call PrintText          ; leaves HL on the text's end
    inc hl
    inc d
    ld e,0
    ld a,(hl)
    or a                    ; the list ends with an empty text
    jr nz,PaIntro
    call ShowMenuFooter

    nextreg $A2,$C2         ; both words on, to the mixer
    nextreg $07,0           ; 3.5 MHz
    call WaitNoKey          ; the menu's key may still be down

PaFrame:
    halt
    ld hl,PaLeftText
    ld b,PaLeftRow
    ld c,$2C
    call PaChannel
    ld hl,PaRightText
    ld b,PaRightRow
    ld c,$2E
    call PaChannel
    call ScanKeys
    inc a                   ; $FF, no key, becomes 0
    jr z,PaFrame

    nextreg $07,3
    nextreg $A2,0           ; the link off, as after a reset
    jp WaitNoKey

; Reads NextReg C for PaReads times and shows the lowest and the highest value on row B, and a
; bar on the row below, one cell for every 8 units between them
PaChannel:
    push hl
    push bc
    ld a,c
    ld hl,PaReads
    call ReadNextRegRange   ; D: the lowest value, E: the highest
    ld (PaHigh),de          ; E goes to PaHigh, D to PaLow just after it
    pop bc
    ld d,b                  ; the row
    ld e,0
    ld c,$38
    pop hl                  ; the label
    call PrintText
    ld a,(PaLow)
    call PrintHex8
    ld hl,PaHighText
    call PrintText
    ld a,(PaHigh)
    call PrintHex8
    ld a,(PaHigh)
    ld hl,PaLow
    sub (hl)                ; the difference, 0-255
    rrca
    rrca
    rrca
    and $1F                 ; 0-31 cells
    ld c,a
    inc d                   ; the bar's row
    ld e,32
    mul d,e                 ; DE: row x 32
    ld hl,$5800
    add hl,de               ; its first attribute
    ld b,32
PaBar:
    ld e,$38                ; PAPER 7
    ld a,c
    or a
    jr z,PaCell
    dec c
    ld e,$20                ; PAPER 4: green, one cell for every 8 units
PaCell:
    ld (hl),e
    inc hl
    djnz PaBar
    ret

PaHigh:
    .defb 0
PaLow:
    .defb 0
PaLeftText:
    .defn "Left  low $"
PaRightText:
    .defn "Right low $"
PaHighText:
    .defn " high $"
PaText1:
    .defn "Silent until a Pi plays."
    .defn "Start: pi-audio -tone 440"
    .defn "Stop: pi-audio -off"
    .defb 0

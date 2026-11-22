; Demo: Pattern Fill
; Chapter: The Z80N (content/next-cpu.mdx), "Block copies and an output"
;
; Paints the same six rows of colour twice on the ULA's attributes, then lays an 8-byte pattern
; over the second copy with one LDPIRX. The pattern repeats every 8 cells; its holes, the bytes
; equal to A, are not written, so the colours show through them.
; Changes only the screen, which the shell clears.

PatternFillTitle:
    .defn "Pattern Fill"

PfRows:     .equ 6                  ; rows in each picture
PfBefore:   .equ $5800 + 5 * 32     ; the first picture's attributes: rows 5 to 10
PfAfter:    .equ $5800 + 14 * 32    ; the second's: rows 14 to 19
PfHole:     .equ $E3                ; a byte LDPIRX skips; no colour of the pattern is $E3

PatternFill:
    ld de,$0000
    ld c,$78
    ld hl,PatternFillTitle
    call PrintText
    ld de,$0200             ; row 2
    ld c,$38
    ld hl,PfText1
    call PrintText
    ld de,$0400             ; row 4
    ld hl,PfText2
    call PrintText
    ld de,$0D00             ; row 13
    ld hl,PfText3
    call PrintText

    ld hl,PfBefore
    call PfPicture
    ld hl,PfAfter
    call PfPicture

    ld hl,PfPattern         ; the pattern; HL's low three bits do not count
    ld de,PfAfter           ; the cells to paint
    ld bc,PfRows * 32
    ld a,PfHole             ; never written: the holes in the pattern
    ldpirx

    call WaitForMenu
    ret

; Paints PfRows rows of 32 attribute cells from HL, each row in its own PAPER colour, 1 to 6
PfPicture:
    ld c,1                  ; PAPER 1, blue
PfPictureRow:
    ld a,c
    add a,a
    add a,a
    add a,a                 ; PAPER is bits 5-3
    ld b,32
PfPictureCell:
    ld (hl),a
    inc hl
    djnz PfPictureCell
    inc c
    ld a,c
    cp PfRows + 1
    jr nz,PfPictureRow
    ret

PfText1:
    .defn "One LDPIRX, 8-byte pattern:"
PfText2:
    .defn "Before:"
PfText3:
    .defn "After:"

    .align 8                ; the pattern's address ends in three 0 bits
PfPattern:
    .defb $00, $00, PfHole, PfHole, $78, $78, PfHole, PfHole  ; black, hole, bright white, hole

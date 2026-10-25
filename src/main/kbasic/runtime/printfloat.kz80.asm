; @module   printfloat
; @summary  PRINT of a Float: the ROM's text of the number, through PrintChar.
; @exports  PrintFloat
; @requires float, print
;
; Apart from the float module, so a program that never prints a Float links no printing with its
; Floats, and one that prints no Float links no Float arithmetic with its printing.

; ------------------------------------------------------------------------------------------------
; PRINT of a Float. In: A-E-D-C-B. Changes AF, BC, DE, HL.
PrintFloat:
    call FToText
    ld hl,FText
    ld a,(FTextLen)
    ld b,a
PrintFloatLoop:
    ld a,(hl)
    push hl
    push bc
    call PrintChar
    pop bc
    pop hl
    inc hl
    djnz PrintFloatLoop
    ret

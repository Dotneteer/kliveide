; @module   attributes
; @summary  Permanent colours (INK, PAPER, FLASH, BRIGHT, INVERSE, OVER as statements) and BORDER.
; @exports  ColourPermanent, Border
; @requires print, errors
;
; A colour statement changes the colours every later PRINT starts from; a colour item inside a PRINT
; (print.kz80.asm's PrintColour) lasts to the end of that PRINT. The permanent colours are also
; written to the ROM's ATTR_P, MASK_P and P_FLAG, so BASIC carries on with them after the program.

; ------------------------------------------------------------------------------------------------
; A permanent colour: C = the code (16 INK, 17 PAPER, 18 FLASH, 19 BRIGHT, 20 INVERSE, 21 OVER),
; A = the value. Stops with "K Invalid colour" for a value the code does not take. Changes AF, BC,
; HL.
ColourPermanent:
    call PrintColour        ; the current colours; between statements they equal the permanent ones
    ld hl,(PrintAttr)
    ld (PrintAttrP),hl
    ld ($5c8d),hl           ; ATTR_P, MASK_P
    ld a,(PrintFlags)
    ld (PrintFlagsP),a
    ; --- P_FLAG, temporary and permanent bit pairs: OVER 0-1, INVERSE 2-3, INK 9 4-5, PAPER 9 6-7
    ld c,a                  ; C = PrintFlags
    ld b,0
    bit 0,c
    jr z,ColourPermanentInverse
    ld b,$03
ColourPermanentInverse:
    bit 1,c
    jr z,ColourPermanentInk9
    ld a,b
    or $0c
    ld b,a
ColourPermanentInk9:
    bit 4,c
    jr z,ColourPermanentPaper9
    ld a,b
    or $30
    ld b,a
ColourPermanentPaper9:
    bit 5,c
    jr z,ColourPermanentFlags
    ld a,b
    or $c0
    ld b,a
ColourPermanentFlags:
    ld a,b
    ld ($5c91),a            ; P_FLAG
    ret

; ------------------------------------------------------------------------------------------------
; BORDER A: the border's colour, and BORDCR, the lower screen's attribute (PAPER the border's colour;
; INK white on the four dark colours, black on the light ones). Stops with "K Invalid colour" for a
; value above 7. Changes AF.
Border:
    cp 8
    jr nc,BorderBad
    out ($fe),a
    rlca
    rlca
    rlca                    ; A = the colour as PAPER
    cp $20
    jr nc,BorderLight
    or $07
BorderLight:
    ld ($5c48),a            ; BORDCR
    ret
BorderBad:
    ld a,19
    jp RaiseError

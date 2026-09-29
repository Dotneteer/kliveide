; @module   attributes
; @summary  Permanent colours (INK, PAPER, FLASH, BRIGHT, INVERSE, OVER as statements) and BORDER.
; @exports  ColourPermanent, Border
; @requires print
;
; A colour statement changes the colours every later PRINT starts from; a colour item inside a PRINT
; (print.kz80.asm's PrintColour) lasts to the end of that PRINT. The permanent colours are also
; written to the ROM's ATTR_P, MASK_P and P_FLAG, so BASIC carries on with them after the program.

; ------------------------------------------------------------------------------------------------
; A permanent colour: C = the code (16 INK, 17 PAPER, 18 FLASH, 19 BRIGHT, 20 INVERSE, 21 OVER),
; A = the value, taken as PrintColour takes it. Changes AF, BC, HL.
ColourPermanent:
    call PrintColour        ; the current colours; between statements they equal the permanent ones
    ld hl,(PrintAttr)
    ld (PrintAttrP),hl
    ld ($5c8d),hl           ; ATTR_P, MASK_P
    ld a,(PrintFlags)
    ld (PrintFlagsP),a
    ; --- P_FLAG, temporary and permanent bit pairs: OVER 0-1 (its bit 0), INVERSE 2-3
    ld c,a                  ; C = PrintFlags
    ld b,0
    bit 0,c
    jr z,ColourPermanentInverse
    ld b,$03
ColourPermanentInverse:
    bit 1,c
    jr z,ColourPermanentFlags
    ld a,b
    or $0c
    ld b,a
ColourPermanentFlags:
    ld a,b
    ld ($5c91),a            ; P_FLAG
    ret

; ------------------------------------------------------------------------------------------------
; BORDER A, as ZX BASIC does it (observed through the oracle, compatibility plan C3): the border takes
; A's bits 0-2, and BORDCR, the lower screen's attribute, becomes A * 8 (so BORDER 9 sets its BRIGHT
; bit too) with INK white on the four dark colours. No value stops the program. Changes AF, BC.
Border:
    ld b,a
    and 7
    out ($fe),a
    ld c,a                  ; C = the colour
    ld a,b
    rlca
    rlca
    rlca
    and $f8                 ; A * 8, as a byte
    ld b,a
    ld a,c
    cp 4                    ; carry: a dark colour
    ld a,b
    jr nc,BorderLight
    or $07
BorderLight:
    ld ($5c48),a            ; BORDCR
    ret

; @module   usr
; @summary  USR: calling machine code, and the UDG address of a character.
; @exports  Usr, UsrString
; @requires strings

; ------------------------------------------------------------------------------------------------
; USR address: calls the machine code at HL; its BC is the result. IX is kept for the caller.
; Out: HL. Changes everything else.
Usr:
    push ix
    call UsrJump
    pop ix
    ld h,b
    ld l,c
    ret
UsrJump:
    jp (hl)

; ------------------------------------------------------------------------------------------------
; USR "a": the address of the user-defined graphic of the String's first character, as ZX BASIC
; computes it (observed through the oracle, compatibility plan C3): the character lower-cased by
; setting bit 5, its place from "a" taken as a byte, UDG + 8 * that place as a word - so "a"-"u" in
; either case give their graphic, "v" 0, "1" 1496, and nothing stops the program. The empty String
; gives 0 and sets ERR_NR to 9 ("A Invalid argument"). In: HL = the String, A = free flags (bit 0
; frees it). Out: HL. Changes AF, BC, DE.
UsrString:
    push af                 ; S: [flags]
    call StrLen
    ld e,0
    ld a,b
    or c
    jr z,UsrStringFree
    inc hl
    inc hl
    ld e,(hl)
    dec hl
    dec hl
UsrStringFree:
    pop af                  ; S: []
    push bc                 ; S: [length]
    push de                 ; S: [character][length]
    rra
    call c,Free
    pop de                  ; S: [length]
    pop bc                  ; S: []
    ld a,b
    or c
    jr z,UsrStringEmpty
    ld a,e
    or $20                  ; lower case
    sub 'a'                 ; the place, as a byte
    ld l,a
    ld h,0
    add hl,hl
    add hl,hl
    add hl,hl
    ld de,($5c7b)           ; UDG
    add hl,de
    ret
UsrStringEmpty:
    ld a,9                  ; "A Invalid argument"
    ld ($5c3a),a            ; ERR_NR
    ld hl,0
    ret

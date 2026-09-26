; @module   usr
; @summary  USR: calling machine code, and the UDG address of a character.
; @exports  Usr, UsrString
; @requires strings, errors

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
; USR "a": the address of the user-defined graphic of the String's first character, a-u in either
; case (UDG + 8 * its place). Anything else stops with "A Invalid argument". In: HL = the String,
; A = free flags (bit 0 frees it). Out: HL. Changes AF, BC, DE.
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
    push de                 ; S: [character]
    rra
    call c,Free
    pop de                  ; S: []
    ld a,e
    or $20                  ; lower case
    sub 'a'
    jr c,UsrStringBad
    cp 21
    jr nc,UsrStringBad
    ld l,a
    ld h,0
    add hl,hl
    add hl,hl
    add hl,hl
    ld de,($5c7b)           ; UDG
    add hl,de
    ret
UsrStringBad:
    ld a,9                  ; "A Invalid argument"
    jp RaiseError

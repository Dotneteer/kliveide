; ------------------------------------------------------------------------------
; SP48 API Macros
; ------------------------------------------------------------------------------
OpenUpperScreen .macro()
    ld a,2
    call $1601
.endm

PrintChar .macro()
    push hl
    push bc
    rst $28
    .defw $0010
    pop bc
    pop hl
.endm

; ------------------------------------------------------------------------------
; Sign error
; ------------------------------------------------------------------------------
SIGN_ERR .macro()
    ld a,2
    out ($fe),a
.endm

; ------------------------------------------------------------------------------
; Clear Screen
; ------------------------------------------------------------------------------
ClearScreen
    push hl
    push de
    push bc
    ld hl,$4000
    ld de,$4001
    ld bc,$5fff
    ld (hl),0
    ldir
    ld hl,$5800
    ld de,$5801
    ld bc,$02ff
    ld (hl),$38
    ldir
    pop bc
    pop de
    pop hl
    ret

; ------------------------------------------------------------------------------
; Print the specified text to the screen
; IN:
;   DE = Start address
;   BC = Text length
; OUT(s):
;   F(c) = 0
; OUT(f):
;   F(c) = 1
; ------------------------------------------------------------------------------
PrintToScreen
`next
    ld a,(hl)
    PrintChar()
    inc hl
    dec bc
    ld a,b
    or c
    jr nz,`next
    ret


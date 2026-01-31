; ------------------------------------------------------------------------------
; ZX Spectrun Next system variables
; ------------------------------------------------------------------------------
LAST_K                    .equ $5c08

; ------------------------------------------------------------------------------
; ZX Spectrun Next ROM Addresses
; ------------------------------------------------------------------------------
ZXN_PRINT_TEXT            .equ $203c

; 256 byte buffer for conversions
TMP_BUFF .defs $100

; ------------------------------------------------------------------------------
; Sign error
; ------------------------------------------------------------------------------
SIGN_ERR .macro()
    ld a,2
    out ($fe),a
.endm

TERM_TEXT .macro()
    .defw $ffff
.endm

; ------------------------------------------------------------------------------
; Clear Screen
; IN: ---
; OUT:
;   AFBCDEHL/IX same
; ------------------------------------------------------------------------------
ClearScreen
    push hl
    push de
    push bc
    ld hl,$4000
    ld de,$4001
    ld bc,$17ff
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
; Prints text with a particular start address and length
; addr: Start address of the text
; length: Text length
; ------------------------------------------------------------------------------
PrintText .macro(addr, length)
    ld de,{{addr}}
    ld bc,{{length}}
    call ZXN_PRINT_TEXT
.endm

; ------------------------------------------------------------------------------
; Prints text with a particular start address. The text should be terminated
; with $FFFF word
; addr: Start address of the text
; ------------------------------------------------------------------------------
PrintText2 .macro(addr)
    ld de,{{addr}}
    call __findTerminationAndPrint
.endm

__findTerminationAndPrint
    ld bc,0
    push de
    ex de,hl
`testLoop
    ld a,h
    or l
    jr nz, `charTest
    ld bc,0
    jr `done
`chartest
    ld a,(hl)
    cp $ff
    inc hl
    inc bc
    jr nz,`testLoop
    ld a,(hl)
    cp $ff
    jr nz,`chartest
    dec bc
`done
    pop de
    jp ZXN_PRINT_TEXT

; ------------------------------------------------------------------------------
; Convert 16-bit value to decimal string
; IN:
;   HL=Input value
;   DE=Destination buffer (at least with 5 bytes)
; OUT:
;   ......../IX same
;   AFBCDEHL/.. different
; ------------------------------------------------------------------------------
ConvToDecimal
    ld bc,10000
    call `conv
    ld bc,1000
    call `conv
    ld bc,100
    call `conv
    ld bc,10
    call `conv
    ld a,l
    jr `conv3
`conv
    xor a
`conv1
    sbc hl,bc
    jr c,`conv2
    inc a
    jr `conv1
`conv2
    add hl,bc
`conv3
    add a,'0'
    ld (de),a
    inc de
    ret

; ------------------------------------------------------------------------------
; Convert 16-bit value to decimal string (keeps registers)
; IN:
;   HL=Input value
;   DE=Destination buffer (at least with 5 bytes)
; OUT:
;   AFBCDEHL/IX same
; ------------------------------------------------------------------------------
ConvToDecimalP
    push af
    push bc
    push de
    push hl
    call ConvToDecimal
    pop hl
    pop de
    pop bc
    pop af
    ret

; ------------------------------------------------------------------------------
; Prints the specified number or LSB digits of HL
; IN:
;   HL=Input value
;   A=number of digit (LSBs), 1-5. Default: 5
; OUT:
;   AFBCDEHL/IX same
; ------------------------------------------------------------------------------
PrintHL
    ld a,5
PrintHL2
    cp 0
    jr z,`print1
    cp 5
    jr c,`print2
`print1
    ld a,5
`print2
    push af
    ld de,TMP_BUFF
    call ConvToDecimal
    pop af
    ld hl,TMP_BUFF + 5
    ld b,0
    ld c,a
    and a
    sbc hl,bc
    ld b,a
`print3
    ld a,(hl)
    rst $10
    inc hl
    djnz `print3
    ret

; ------------------------------------------------------------------------------
; Wait for a keypress
; (Interrupt must be enabled)
; IN: ---
; OUT:
;   A=Pressed key
;
;   AFBCDEHL/IX same
;   AF....../.. different
; ------------------------------------------------------------------------------
WaitForKey
    xor a
    ld (LAST_K),a
`wait
    ld a,(LAST_K)
    or a
    jr z,`wait
    ret
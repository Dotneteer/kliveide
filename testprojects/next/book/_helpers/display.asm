;------------------------------------------------------------------------------
; ZX Spectrun Next system variables
;------------------------------------------------------------------------------
LAST_K                    .equ $5c08

; 256 byte buffer for conversions
TMP_BUFF .defs $100

; Store the last border color here
_lastBorder
    .db 0


Border .macro(color)
    push af
    ld a,{{color}}
    ld (LastBorder),a
    out ($fe),a
    pop af
.endm

Ink .macro(color)
    push af
    ld a,$10
    rst $10
    pop af
    push af
    ld a,{{color}}
    rst $10
    pop af
.endm

Paper .macro(color)
    push af
    ld a,$11
    rst $10
    pop af
    push af
    ld a,{{color}}
    rst $10
    pop af
.endm

Flash .macro(value)
    push af
    ld a,$12
    rst $10
    pop af
    push af
    ld a,{{value}}
    rst $10
    pop af
.endm

Bright .macro(value)
    push af
    ld a,$13
    rst $10
    pop af
    push af
    ld a,{{value}}
    rst $10
    pop af
.endm

PrintAt .macro(row, col)
    ld a,$16
    rst $10
    ld a,{{row}}
    rst $10
    ld a,{{col}}
    rst $10
.endm

NewLine .macro()
    ld a,$0d
    rst $10
.endm

; ------------------------------------------------------------------------------
; Reset screen attribute
; ------------------------------------------------------------------------------
_resetScreenAttributes
    Flash(0)
    Bright(0)
    Paper(7)
    Ink(0)
    ret

; ------------------------------------------------------------------------------
; Prints the specified text to the screen. The text should be
; terminated with 0. The bytes following control characters such as
; PAPER, INK, AT, etc. can be zeros; they do not terminate the text.
; IN:
;   HL=Start of the text
; ------------------------------------------------------------------------------
_printText
    ld a,(hl)                   ; Read the current character
    and a                       ; Check for terminating zero
    ret z                       ; Treminator found, done.

    ; Check for characters with argument bytes
    cp $10                      ; $00-$0f
    jr c,`singleChar            ; Print the character
    cp $17                      ; TAB or higher
    jr nc,`singleChar           ; Print the character
    cp $16                      ; Anything but AT
    jr nz,`oneArg               
    rst $10                     ; Print AT
    inc hl
    ld a,(hl)                   ; Get the next argument byte
`oneArg
    rst $10                     ; Print the character/argument byte
    inc hl
    ld a,(hl)                   ; Get the next argument byte
`singleChar
    rst $10;                    ; Print the character
    inc hl
    jr _printText               ; Continue the printing loop

; ------------------------------------------------------------------------------
; Converts HL to a five-digit decimal string
; IN:
;   HL=Input value
;   DE=Destination buffer (at least with 5 bytes)
; OUT:
;   ......../IX same
;   AFBCDEHL/.. different
; ------------------------------------------------------------------------------
_convHlToDecimal
    ld bc,10000
    call _convDecimalDigit
    ld bc,1000
    call _convDecimalDigit
    ld bc,100
    call _convDecimalDigit
    ld bc,10
    call _convDecimalDigit
    ld a,l
    jr _convLastDigit
_convDecimalDigit
    xor a
`conv1
    sbc hl,bc
    jr c,`conv2
    inc a
    jr `conv1
`conv2
    add hl,bc
_convLastDigit
    add a,'0'
    ld (de),a
    inc de
    ret

; ------------------------------------------------------------------------------
; Converts HL to a five-digit decimal string
; IN:
;   HL=Input value
;   DE=Destination buffer (at least with 5 bytes)
; OUT:
;   ......../IX same
;   AFBCDEHL/.. different
; ------------------------------------------------------------------------------
_convAToDecimal
    ld h,0
    ld l,a
    ld bc,100
    call _convDecimalDigit
    ld bc,10
    call _convDecimalDigit
    ld a,l
    jr _convLastDigit

; ------------------------------------------------------------------------------
; Converts HL to a four-digit hexadecimal string
; IN:
;   HL=Input value
;   DE=Destination buffer (at least with 4 bytes)
; OUT:
;   BCHL/IX same
;   AFDE/.. different
; ------------------------------------------------------------------------------
_convHlToHexadecimal
    ld a,h
    rra
    rra
    rra
    rra
    call _convHexaDigit
    ld a,h
    call _convHexaDigit
    ld a,l
    rra
    rra
    rra
    rra
    call _convHexaDigit
    ld a,l
_convHexaDigit
    and $0f
    cp 10
    jr c,`conv1
    add a,8
`conv1
    add a,'0'
    ld (de),a
    inc de
    ret

; ------------------------------------------------------------------------------
; Converts A to a two-digit hexadecimal string
; IN:
;   HL=Input value
;   DE=Destination buffer (at least with 4 bytes)
; OUT:
;   BCHL/IX same
;   AFDE/.. different
; ------------------------------------------------------------------------------
_convAToHexadecimal
    push af
    rra
    rra
    rra
    rra
    call _convHexaDigit
    pop af
    jr _convHexaDigit

; ------------------------------------------------------------------------------
; Prints the specified number or LSB digits of HL
; IN:
;   HL=Input value
;   A=number of digit (LSBs), 1-5. Default: 5
; ------------------------------------------------------------------------------
_printHLDecimal
    ld a,5
_printHLDecimal2
    cp 0
    jr z,`print1
    cp 5
    jr c,`print2
`print1
    ld a,5
`print2
    push af
    ld de,TMP_BUFF
    call _convHlToDecimal
    pop af
    ld hl,TMP_BUFF + 5
_printFromEnd
    ld b,0
    ld c,a
    and a
    sbc hl,bc
    ld b,a
_printBufferByB
    ld a,(hl)
    rst $10
    inc hl
    djnz _printBufferByB
    ret

; ------------------------------------------------------------------------------
; Prints the specified number or LSB digits of HL
; IN:
;   HL=Input value
;   A=number of digit (LSBs), 1-4. Default: 4
; ------------------------------------------------------------------------------
_printHLHexadecimal
    ld a,4
_printHLHexadecimal2
    cp 0
    jr z,`print1
    cp 4
    jr c,`print2
`print1
    ld a,4
`print2
    push af
    ld de,TMP_BUFF
    call _convHlToHexadecimal
    pop af
    ld hl,TMP_BUFF + 4
    jr _printFromEnd

; ------------------------------------------------------------------------------
; Prints the specified number or LSB digits of HL
; IN:
;   HL=Input value
;   A=number of digit (LSBs), 1-5. Default: 5
; ------------------------------------------------------------------------------
_printADecimal
    ld de,TMP_BUFF
    push de
    call _convAToDecimal
    pop hl
    ld b,3
    jr _printBufferByB

; ------------------------------------------------------------------------------
; Prints the specified number or LSB digits of HL
; IN:
;   HL=Input value
;   A=number of digit (LSBs), 1-5. Default: 5
; ------------------------------------------------------------------------------
_printAHexadecimal
    ld de,TMP_BUFF
    push de
    call _convAToHexadecimal
    pop hl
    ld b,2
    jr _printBufferByB

; ------------------------------------------------------------------------------
; Clears the ULA screen using white paper and black ink
; ------------------------------------------------------------------------------
_clearScreen
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
    PrintAt(0, 0)
    pop bc
    pop de
    pop hl
    ret

; ------------------------------------------------------------------------------
; Wait for a keypress
; (Interrupt must be enabled)
; ------------------------------------------------------------------------------
_waitForKey
    xor a
    ld (LAST_K),a
`wait
    ld a,(LAST_K)
    or a
    jr z,`wait
    ret

; ------------------------------------------------------------------------------
; Wait for an exit keypress
; (Interrupt must be enabled)
; ------------------------------------------------------------------------------
_waitForExit
    ld a,7
    out ($fe),a
    ld hl,Completed_Str
    jp _printText
    
Completed_Str
    .dm "\a\x0E\x07" ; AT 14, 6
    .dm "\p\x07"     ; PAPER 7
    .dm "\i\x01"     ; INK 1
    .dm "\b\x00"     ; BRIGH 0
    .dm "Example completed."
    .dm "\a\x0f\x08" ; AT 15, 8
    .dm "\i\x02"     ; INK 2
    .defn "Stop or restart!"

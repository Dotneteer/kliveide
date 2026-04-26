// --- COLOR Codes
.module Color
Black   .equ 0
Blue    .equ 1
Red     .equ 2
Magenta .equ 3
Green   .equ 4
Cyan    .equ 5
Yellow  .equ 6
White   .equ 7
.endmodule

;------------------------------------------------------------------------------
; ZX Spectrum Next system variables
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
; Resets screen attributes (Flash=0, Bright=0, Paper=7, Ink=0)
; OUT:
;   AF....../IX same
;   ..BCDEHL/.. different
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
;   HL=Start of the text (zero-terminated)
; OUT:
;   ..BCDE../IX same
;   AF....HL/.. different
; ------------------------------------------------------------------------------
_printText
    ld a,(hl)                   ; Read the current character
    and a                       ; Check for terminating zero
    ret z                       ; Terminator found, done.

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
    rst $10                     ; Print the character
    inc hl
    jr _printText               ; Continue the printing loop

; ------------------------------------------------------------------------------
; Prints text as a title (bright blue ink, followed by two newlines)
; IN:
;   HL=Start of the text (zero-terminated)
; OUT:
;   ..BCDE../IX same
;   AF....HL/.. different
; ------------------------------------------------------------------------------
_printTitle
    push hl
    Bright(1)
    Ink(COLOR_BLUE)
    pop hl
    call _printText

    Bright(0)
    Ink(COLOR_BLACK)
    NewLine()
    NewLine()
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
; Converts A to a three-digit decimal string
; IN:
;   A=Input value
;   DE=Destination buffer (at least with 3 bytes)
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
;   ..BC..HL/IX same
;   AF..DE../.. different
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
    add a,7
`conv1
    add a,'0'
    ld (de),a
    inc de
    ret

; ------------------------------------------------------------------------------
; Converts A to a two-digit hexadecimal string
; IN:
;   A=Input value
;   DE=Destination buffer (at least with 2 bytes)
; OUT:
;   ..BC..HL/IX same
;   AF..DE../.. different
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
; Prints HL as a decimal number, showing A least-significant digits
; IN:
;   HL=Input value
;   A=Number of digits to print (1-5), default: 5
; OUT:
;   ......../IX same
;   AFBCDEHL/.. different
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
; Prints HL as a hexadecimal number, showing A least-significant digits
; IN:
;   HL=Input value
;   A=Number of digits to print (1-4), default: 4
; OUT:
;   ......../IX same
;   AFBCDEHL/.. different
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
; Prints A as a three-digit decimal number
; IN:
;   A=Input value
; OUT:
;   ......../IX same
;   AFBCDEHL/.. different
; ------------------------------------------------------------------------------
_printADecimal
    ld de,TMP_BUFF
    push de
    call _convAToDecimal
    pop hl
    ld b,3
    jr _printBufferByB

; ------------------------------------------------------------------------------
; Prints A as a two-digit hexadecimal number
; IN:
;   A=Input value
; OUT:
;   ......../IX same
;   AFBCDEHL/.. different
; ------------------------------------------------------------------------------
_printAHexadecimal
    ld de,TMP_BUFF
    push de
    call _convAToHexadecimal
    pop hl
    ld b,2
    jr _printBufferByB

; ------------------------------------------------------------------------------
; Prints A as an eight-digit binary number
; IN:
;   A=Input value
; OUT:
;   ......../IX same
;   AFBCDEHL/.. different
; ------------------------------------------------------------------------------
_printABinary
    ld b,8
`printDigit
    rla
    ld d,a
    ld a,'0'
    jr nc,`printIt
    ld a,'1'
`printIt
    rst $10
    ld a,b
    cp 5
    jr nz,`next
    ld a,'_'
    rst $10
`next
    ld a,d
    djnz `printDigit
    ret

; ------------------------------------------------------------------------------
; Prints the value of the Z flag
; IN:
;   A=Input value
; OUT:
;   ......../IX same
;   AFBCDEHL/.. different
; ------------------------------------------------------------------------------
_printZFlag
    ld a,'0'
    jr nz,`printIt
    ld a,'1'
`printIt
    rst $10
    ret

; ------------------------------------------------------------------------------
; Clears the ULA screen (white paper, black ink) and resets the cursor to (0,0)
; OUT:
;   ......../IX same
;   AFBCDEHL/.. different
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
    jp _resetScreenAttributes

; ------------------------------------------------------------------------------
; Waits for a keypress (interrupt must be enabled)
; OUT:
;   A=ASCII code of the pressed key
;   ..BCDEHL/IX same
;   AF....../.. different
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
; Displays the 'Example completed' message and sets the border to white
; OUT:
;   ..BCDE../IX same
;   AF....HL/.. different
; ------------------------------------------------------------------------------
_waitForExit
    ld a,7
    out ($fe),a
    ld hl,Completed_Str
    jp _printText

    
Completed_Str
    .dm "\a\x0E\x06" ; AT 14, 6
    .dm "\p\x01"     ; PAPER 1
    .dm "\i\x07"     ; INK 7
    .dm "\b\x01"     ; BRIGHT 1
    .dm " Example completed. "
    .dm "\a\x0f\x06" ; AT 15, 6
    .dm "\i\x06"     ; INK 6
    .defn "  Stop or restart!  "

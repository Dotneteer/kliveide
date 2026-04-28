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

.module Display

; 256 byte buffer for conversions
TMP_BUFF .defs $20

; Store the last border color here
@lastBorder .db 0

@Border
    ld (@lastBorder),a
    out ($fe),a
    ret

Border .macro(color)
    ld a,{{color}}
    call @Border
.endm

@Ink
    push af
    ld a,$10
    rst $10
    pop af
    rst $10
    ret

Ink .macro(color)
    ld a,{{color}}
    call @Ink
.endm

@Paper
    push af
    ld a,$11
    rst $10
    pop af
    rst $10
    ret


Paper .macro(color)
    ld a,{{color}}
    call @Paper
.endm

@Flash
    push af
    ld a,$12
    rst $10
    pop af
    rst $10
    ret

Flash .macro(value)
    ld a,{{value}}
    call @Flash
.endm

@Bright
    push af
    ld a,$13
    rst $10
    pop af
    rst $10
    ret

Bright .macro(value)
    ld a,{{value}}
    call @Bright
.endm

@PrintAt
    push bc
    ld a,$16
    rst $10
    pop bc
    ld a,b
    rst $10
    ld a,c
    rst $10

PrintAt .macro(row, col)
    ld b,{{row}}
    ld c,{{col}}
    call @PrintAt
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
@resetScreenAttributes
    Flash(0)
    Bright(0)
    Paper(7)
    Display.Ink(0)
    ret

ResetAttributes .macro()
    call @resetScreenAttributes
.endm

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
@printText
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
    jr @printText               ; Continue the printing loop

PrintText .macro(addr)
    ld hl,{{addr}}
    call @printText
.endm

; ------------------------------------------------------------------------------
; Prints text as a title (bright blue ink, followed by two newlines)
; IN:
;   HL=Start of the text (zero-terminated)
; OUT:
;   ..BCDE../IX same
;   AF....HL/.. different
; ------------------------------------------------------------------------------
@printTitle
    push hl
    Bright(1)
    Display.Ink(Color.Blue)
    pop hl
    call @printText

    Bright(0)
    Display.Ink(Color.Black)
    NewLine()
    NewLine()
    ret

PrintTitle .macro(addr)
    ld hl,{{addr}}
    call @printTitle
.endm

; ------------------------------------------------------------------------------
; Converts HL to a five-digit decimal string
; IN:
;   HL=Input value
;   DE=Destination buffer (at least with 5 bytes)
; OUT:
;   ......../IX same
;   AFBCDEHL/.. different
; ------------------------------------------------------------------------------
@convHlToDecimal
    ld bc,10000
    call @convDecimalDigit
    ld bc,1000
    call @convDecimalDigit
    ld bc,100
    call @convDecimalDigit
    ld bc,10
    call @convDecimalDigit
    ld a,l
    jr @convLastDigit
@convDecimalDigit
    xor a
`conv1
    sbc hl,bc
    jr c,`conv2
    inc a
    jr `conv1
`conv2
    add hl,bc
@convLastDigit
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
@convAToDecimal
    ld h,0
    ld l,a
    ld bc,100
    call @convDecimalDigit
    ld bc,10
    call @convDecimalDigit
    ld a,l
    jr @convLastDigit

; ------------------------------------------------------------------------------
; Converts HL to a four-digit hexadecimal string
; IN:
;   HL=Input value
;   DE=Destination buffer (at least with 4 bytes)
; OUT:
;   ..BC..HL/IX same
;   AF..DE../.. different
; ------------------------------------------------------------------------------
@convHlToHexadecimal
    ld a,h
    rra
    rra
    rra
    rra
    call @convHexaDigit
    ld a,h
    call @convHexaDigit
    ld a,l
    rra
    rra
    rra
    rra
    call @convHexaDigit
    ld a,l
@convHexaDigit
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
@convAToHexadecimal
    push af
    rra
    rra
    rra
    rra
    call @convHexaDigit
    pop af
    jr @convHexaDigit

; ------------------------------------------------------------------------------
; Prints HL as a decimal number, showing A least-significant digits
; IN:
;   HL=Input value
;   A=Number of digits to print (1-5), default: 5
; OUT:
;   ......../IX same
;   AFBCDEHL/.. different
; ------------------------------------------------------------------------------
@printHLDecimal
    ld a,5
@printHLDecimal2
    cp 0
    jr z,`print1
    cp 5
    jr c,`print2
`print1
    ld a,5
`print2
    push af
    ld de,TMP_BUFF
    call @convHlToDecimal
    pop af
    ld hl,TMP_BUFF + 5
@printFromEnd
    ld b,0
    ld c,a
    and a
    sbc hl,bc
    ld b,a
@printBufferByB
    ld a,(hl)
    rst $10
    inc hl
    djnz @printBufferByB
    ret

PrintHlDecimal .macro()
    call @PrintHLDecimal
.endm

; ------------------------------------------------------------------------------
; Prints HL as a hexadecimal number, showing A least-significant digits
; IN:
;   HL=Input value
;   A=Number of digits to print (1-4), default: 4
; OUT:
;   ......../IX same
;   AFBCDEHL/.. different
; ------------------------------------------------------------------------------
@printHLHexadecimal
    ld a,4
@printHLHexadecimal2
    cp 0
    jr z,`print1
    cp 4
    jr c,`print2
`print1
    ld a,4
`print2
    push af
    ld de,TMP_BUFF
    call @convHlToHexadecimal
    pop af
    ld hl,TMP_BUFF + 4
    jr @printFromEnd

PrintHlHexadecimal .macro()
    call @PrintHLHexadecimal
.endm

; ------------------------------------------------------------------------------
; Prints A as a three-digit decimal number
; IN:
;   A=Input value
; OUT:
;   ......../IX same
;   AFBCDEHL/.. different
; ------------------------------------------------------------------------------
@PrintADecimal
    ld de,TMP_BUFF
    push de
    call @convAToDecimal
    pop hl
    ld b,3
    jr @printBufferByB

PrintADecimal .macro()
    call @PrintADecimal
.endm

; ------------------------------------------------------------------------------
; Prints A as a two-digit hexadecimal number
; IN:
;   A=Input value
; OUT:
;   ......../IX same
;   AFBCDEHL/.. different
; ------------------------------------------------------------------------------
@printAHexadecimal
    ld de,TMP_BUFF
    push de
    call @convAToHexadecimal
    pop hl
    ld b,2
    jr @printBufferByB

PrintAHexadecimal .macro()
    call @printAHexadecimal
.endm

; ------------------------------------------------------------------------------
; Prints A as an eight-digit binary number
; IN:
;   A=Input value
; OUT:
;   ......../IX same
;   AFBCDEHL/.. different
; ------------------------------------------------------------------------------
@printABinary
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

PrintABinary .macro()
    call @printAHexadecimal
.endm

; ------------------------------------------------------------------------------
; Prints the value of the Z flag
; IN:
;   A=Input value
; OUT:
;   ......../IX same
;   AFBCDEHL/.. different
; ------------------------------------------------------------------------------
@PrintZFlag
    ld a,'0'
    jr nz,`printIt
    ld a,'1'
`printIt
    rst $10
    ret

PrintZFlag .macro()
    call @PrintZFlag
.endm

; ------------------------------------------------------------------------------
; Clears the ULA screen (white paper, black ink) and resets the cursor to (0,0)
; OUT:
;   ......../IX same
;   AFBCDEHL/.. different
; ------------------------------------------------------------------------------
@clearScreen
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
    jp @ResetScreenAttributes

ClearScreen .macro()
    call @clearScreen
.endm

; ------------------------------------------------------------------------------
; Waits for a keypress (interrupt must be enabled)
; OUT:
;   A=ASCII code of the pressed key
;   ..BCDEHL/IX same
;   AF....../.. different
; ------------------------------------------------------------------------------
@waitForKey
    xor a
    ld (SysVars.LAST_K),a
`wait
    ld a,(SysVars.LAST_K)
    or a
    jr z,`wait
    ret

; ------------------------------------------------------------------------------
; Displays the 'Example completed' message and sets the border to white
; OUT:
;   ..BCDE../IX same
;   AF....HL/.. different
; ------------------------------------------------------------------------------
@waitForExit
    ld a,7
    out ($fe),a
    ld hl,Completed_Str
    jp @printText

WaitForExit .macro()
    call @waitForExit
.endm

    
Completed_Str
    .dm "\a\x0E\x06" ; AT 14, 6
    .dm "\p\x01"     ; PAPER 1
    .dm "\i\x07"     ; INK 7
    .dm "\b\x01"     ; BRIGHT 1
    .dm " Example completed. "
    .dm "\a\x0f\x06" ; AT 15, 6
    .dm "\i\x06"     ; INK 6
    .defn "  Stop or restart!  "

.endmodule

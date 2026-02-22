;==========================================================
; Example: Print welcome text to the screen
;==========================================================
PrintWelcome
    ld hl,Welcome_Str
    jp _printText
    
Welcome_Str
    .dm "\a\x06\x06" ; AT 6, 6
    .dm "\p\x04"     ; PAPER 4
    .dm "Welcome to Klive IDE"
    .dm "\a\x07\x07" ; AT 7, 7
    .dm "\p\x04"     ; PAPER 4
    .dm "\b\x01"     ; BRIGH 1
    .defn "(ZX Spectrum Next)"

;==========================================================
; Example: Print decimal and hexadecimal numbers to the
; screen
;==========================================================
PrintValues
    ld hl,Decimal8_Str
    call _printText
    ld a,210
    push af
    call _printADecimal
    NewLine()
    ld hl,Hexadecimal8_Str
    call _printText
    pop af
    call _printAHexadecimal
    NewLine()
    ld hl,Decimal16_Str
    call _printText
    ld hl,23456
    push hl
    call _printHLDecimal
    NewLine()
    ld hl,Hexadecimal16_Str
    call _printText
    pop hl
    jp _printHLHexadecimal

Decimal8_Str
    .dn "Decimal (8-bit):      "
Hexadecimal8_Str
    .dn "Hexadecimal (8-bit):  "
Decimal16_Str
    .dn "Decimal (16-bit):     "
Hexadecimal16_Str
    .dn "Hexadecimal (16-bit): "

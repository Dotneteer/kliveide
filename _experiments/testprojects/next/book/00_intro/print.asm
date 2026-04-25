;==========================================================
; Example: Print welcome text to the screen
;==========================================================
PrintWelcomeDemo
    ld hl,Title_Intro_1
    call _printTitle
    ld hl,Welcome_Str
    jp _printText
    
Title_Intro_1
    .defn "Intro #1: Welcome message"
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
PrintValuesDemo
    ld hl,Title_Intro_2
    call _printTitle
    ;
    ; Print decimal and hexadecimal values
    ;
    ld hl,Decimal8_Str
    call _printText
    ld a,210
    push af
    Ink(COLOR_BLUE)
    call _printADecimal
    NewLine()
    Ink(COLOR_BLACK)
    ld hl,Hexadecimal8_Str
    call _printText
    Ink(COLOR_BLUE)
    pop af
    call _printAHexadecimal
    Ink(COLOR_BLACK)
    NewLine()
    ld hl,Decimal16_Str
    call _printText
    Ink(COLOR_BLUE)
    ld hl,23456
    push hl
    call _printHLDecimal
    NewLine()
    Ink(COLOR_BLACK)
    ld hl,Hexadecimal16_Str
    call _printText
    Ink(COLOR_BLUE)
    pop hl
    jp _printHLHexadecimal

Title_Intro_2
    .defn "Intro #2: Printing values"
Decimal8_Str
    .defn "Decimal (8-bit):      "
Hexadecimal8_Str
    .defn "Hexadecimal (8-bit):  "
Decimal16_Str
    .defn "Decimal (16-bit):     "
Hexadecimal16_Str
    .defn "Hexadecimal (16-bit): "

.module PrintDemo

;==========================================================
; Example: Print welcome text to the screen
;==========================================================
Welcome
    Display.PrintTitle(@Title_Intro_1)
    Display.PrintText(@Welcome_Str)
    ret
    
@Title_Intro_1
    .defn "Intro #1: Welcome message"
@Welcome_Str
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
Values
    Display.PrintTitle(@Title_Intro_2)
    Display.PrintText(@Decimal8_Str)
    ld a,210
    push af
    Display.Ink(Color.Blue)
    Display.PrintADecimal()
    Display.NewLine()
    Display.Ink(Color.Black)
    Display.PrintText(Hexadecimal8_Str)
    Display.Ink(Color.Blue)
    pop af
    Display.PrintAHexadecimal()
    Display.Ink(Color.Black)
    Display.NewLine()
    Display.PrintText(Decimal16_Str)
    Display.Ink(Color.Blue)
    ld hl,23456
    push hl
    Display.PrintHLDecimal()
    Display.NewLine()
    Display.Ink(Color.Black)
    Display.PrintText(Hexadecimal16_Str)
    Display.Ink(Color.Blue)
    pop hl
    Display.PrintHLHexadecimal()
    ret

@Title_Intro_2
    .defn "Intro #2: Printing values"
@Decimal8_Str
    .defn "Decimal (8-bit):      "
Hexadecimal8_Str
    .defn "Hexadecimal (8-bit):  "
Decimal16_Str
    .defn "Decimal (16-bit):     "
Hexadecimal16_Str
    .defn "Hexadecimal (16-bit): "

.endmodule
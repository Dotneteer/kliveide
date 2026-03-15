Before_Str:
    .defn "Before: "
After_Str:
    .defn "After:  "

;==========================================================
; Example: SWAPNIB
;==========================================================
SwapnibDemo
    ld hl,Title_Swapnib
    call _printTitle
    ld hl,Before_Str
    call _printText

    ld a,$3e
    push af
    Ink(COLOR_BLUE)
    call _printAHexadecimal
    NewLine()
    Ink(COLOR_BLACK)
    ld hl,After_Str
    call _printText
    Ink(COLOR_BLUE)
    pop af
    ; *** Swaps the high and low nibbles of A
    swapnib
    
    jp _printAHexadecimal

Title_Swapnib
    .defn "Z80N #1: SWAPNIB"

;==========================================================
; Example: MIRROR A
;==========================================================
MirrorDemo
    ld hl,Title_Mirror
    call _printTitle
    ld hl,Before_Str
    call _printText

    ld a,%1011_0010
    push af
    Ink(COLOR_BLUE)
    call _printABinary
    NewLine()
    Ink(COLOR_BLACK)
    ld hl,After_Str
    call _printText
    Ink(COLOR_BLUE)
    pop af
    ; *** Reverses the bit order of A
    mirror a
    
    jp _printABinary

Title_Mirror
    .defn "Z80N #2: MIRROR A"


;==========================================================
; Example: TEST n
;==========================================================
TestDemo
    ld hl,Title_Test
    call _printTitle
    ld hl,Test_Value_Str
    call _printText

    ld a,%1000_0100
    push af
    Ink(COLOR_BLUE)
    call _printABinary
    NewLine()
    Ink(COLOR_BLACK)
    ld hl,Test_With_1_Str
    call _printText
    Ink(COLOR_BLUE)
    pop af
    ; *** Reverses the bit order of A
    push af
    
    test %1000_0000
    call _printZFlag
    Ink(COLOR_BLACK)
    NewLine()
    ld hl,Test_With_2_Str
    call _printText
    Ink(COLOR_BLUE)
    pop af

    test %0000_0010
    jp _printZFlag

Title_Test
    .defn "Z80N #3: TEST n"
Test_Value_Str
    .defn "Value of A: "
Test_With_1_Str
    .defn "Z flag after TEST %1000_0000: "
Test_With_2_Str
    .defn "Z flag after TEST %0000_0010: "


;==========================================================
; Write the value of a NextReg #1
;==========================================================
WiteNextReg1
    ld hl,Title_WNextReg_1
    call _printTitle2
    ld hl,PrintStep1_Str
    call _printText
    ;
    ; Write Nextreg value (User storage)
    ;
    ld bc,$243b    ; point to the register select port
    ld a,$7f       ; register number (User storage)
    out (c),a
    inc b          ; point to the value port
    ld a,162       ; value to write
    out (c),a
    ;
    ; Prepare displaying the result
    ;
    NewLine()
    ld hl,PrintStep2_Str
    call _printText
    Ink(COLOR_BLUE)
    ;
    ; Read NextReg value (User storage)
    ;
    ld bc,$243b    ; point to the register select port
    ld a,$7f       ; register number (User storage)
    out (c),a
    inc b          ; point to the value port
    in a,(c)       ; read the current value into A
    ;
    ; Display read value
    ;
    push af
    call _printAHexadecimal
    ld a,' '
    rst $10
    ld a,'('
    rst $10
    pop af
    call _printADecimal
    ld a,')'
    jp $10
    
    
Title_WNextReg_1
    .defn "NextReg #1: Write/Read (#1)"
PrintStep1_Str
    .defn "Write 162 to NextReg $7F (#1)"
PrintStep2_Str
    .defn "Value of NextReg $7F: "


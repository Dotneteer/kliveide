.module NextRegDemo

;==========================================================
; Write the value of a NextReg #1
;==========================================================
Write
    Display.PrintTitle(@Title_WNextReg)
    Display.PrintText(@PrintStep1_Str)
    ;
    ; Write Nextreg value (User storage)
    ;
    nextreg $7f,162  ; Simpler way to write the NextReg
    ; ld bc,$243b    ; point to the register select port
    ; ld a,$7f       ; register number (User storage)
    ; out (c),a
    ; inc b          ; point to the value port
    ; ld a,162       ; value to write
    ; out (c),a
    
    ;
    ; Prepare displaying the result
    ;
    Display.NewLine()
    Display.PrintText(@PrintStep2_Str)
    Display.Ink(Color.Blue)
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
    Display.PrintAHexadecimal()
    ld a,' '
    rst $10
    ld a,'('
    rst $10
    pop af
    Display.PrintADecimal()
    ld a,')'
    jp $10
    
    
@Title_WNextReg
    .defn "NextReg #1: Write/Read"
@PrintStep1_Str
    .defn "Write 162 to NextReg $7F"
@PrintStep2_Str
    .defn "Value of NextReg $7F: "

.endmodule
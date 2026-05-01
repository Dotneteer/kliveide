;==========================================================
; Measure a DJNZ loop (B=$C0)
;==========================================================
Measure1Demo
    Display.PrintTitle(Title_Measure1)
    Display.PrintText(Instr_Measure)

    ; Measure
    ld b,$00
    jp _measureDjnz

Title_Measure1
    .defn "CTC #1: DJNZ Loop (B=$00)"
Instr_Measure
    .defn "Counter value: "

;==========================================================
; Measure a DJNZ loop (B=$80)
;==========================================================
Measure2Demo
    Display.PrintTitle(Title_Measure2)
    Display.PrintText(Instr_Measure)

    ; Measure
    ld b,$80
    jp _measureDjnz

Title_Measure2
    .defn "CTC #2: DJNZ Loop (B=$80)"

;==========================================================
; Measure BC loop (BC=$1800)
;==========================================================
Measure3Demo
    Display.PrintTitle(Title_Measure3)
    Display.PrintText(Instr_Measure)

    call Timing.SetupCtc16
    call Timing.StartMeasure

    ; Start of code to measure
    Timing.Delay($1800)
    
    ; Measure ends here
    call Timing.GetMeasuredCounter
    ex de,hl
    Display.Ink(Color.Blue)
    Display.PrintHLDecimal()
    ret

Title_Measure3
    .defn "CTC #3: BC Loop (BC=$1800)"

;----------------------------------------------------------
; Measure a DJNZ loop with B set to the loop counter
;----------------------------------------------------------
_measureDjnz
    push bc
    call Timing.SetupCtc16
    call Timing.StartMeasure
    pop bc

    ; Start of code to measure
    ; B is already loaded
`loop
    djnz `loop
    
    ; Measure ends here
    call Timing.GetMeasuredCounter
    ex de,hl
    Display.Ink(Color.Blue)
    Display.PrintHLDecimal()
    ret
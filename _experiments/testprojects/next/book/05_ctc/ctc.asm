;==========================================================
; Measure a DJNZ loop (B=$C0)
;==========================================================
Measure1Demo
    ld hl,Title_Measure1
    call _printTitle
    ld hl,Instr_Measure
    call _printText

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
    ld hl,Title_Measure2
    call _printTitle
    ld hl,Instr_Measure
    call _printText

    ; Measure
    ld b,$80
    jp _measureDjnz

Title_Measure2
    .defn "CTC #2: DJNZ Loop (B=$80)"

;==========================================================
; Measure BC loop (BC=$1800)
;==========================================================
Measure3Demo
    ld hl,Title_Measure3
    call _printTitle
    ld hl,Instr_Measure
    call _printText

    call SetupCtc16
    call StartMeasure

    ; Start of code to measure
    ld bc,$1800
    call _delayWithBc
    
    ; Measure ends here
    call GetMeasuredCounter
    ex de,hl
    Display.Ink(Color.Blue)
    jp _printHLDecimal

Title_Measure3
    .defn "CTC #3: BC Loop (BC=$1800)"

;----------------------------------------------------------
; Measure a DJNZ loop with B set to the loop counter
;----------------------------------------------------------
_measureDjnz
    push bc
    call SetupCtc16
    call StartMeasure
    pop bc

    ; Start of code to measure
    ; B is already loaded
`loop
    djnz `loop
    
    ; Measure ends here
    call GetMeasuredCounter
    ex de,hl
    Display.Ink(Color.Blue)
    jp _printHLDecimal

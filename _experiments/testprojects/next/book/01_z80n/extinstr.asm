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

;==========================================================
; Example: BSLA DE,B
;==========================================================
BslaDemo
    ld hl,Title_Bsla
    call _printTitle
    Ink(COLOR_BLACK)
    NewLine()
    ld hl,Instr_Bsla
    call _printText
    NewLine()
    ld hl,Instr_Bsla_2
    call _printText

    ; Set the background attribute to represent the shift
    ld a,attr(Color.Black, Color.White, 1)
    ld ($5900),a
    ld a,attr(Color.Black, Color.Green, 1)
    ld ($5901),a
    ld de,$003f
    ld ix,$4900
    ld (ix),d
    ld (ix+1),e

    ld b,5
    bsla de,b
    ld ix,$4b00
    ld (ix),d
    ld (ix+1),e

    ret

Title_Bsla
    .defn "Z80N #4: BSLA DE,B"
Instr_Bsla
    .defn "Check the highlighted pattern"
Instr_Bsla_2
    .defn "DE=$003f, B=5 --> BSLA DE,B"

;==========================================================
; Example: BSRA DE,B
;==========================================================
BsraDemo
    ld hl,Title_Bsra
    call _printTitle
    Ink(COLOR_BLACK)
    NewLine()
    ld hl,Instr_Bsra
    call _printText
    NewLine()
    ld hl,Instr_Bsra_2
    call _printText

    ; Set the background attribute to represent the shift
    ld a,attr(Color.Black, Color.White, 1)
    ld ($5900),a
    ld a,attr(Color.Black, Color.Green, 1)
    ld ($5901),a
    ;
    ; BSRA with sign bit set
    ld de,$fc00
    ld ix,$4900
    ld (ix),d
    ld (ix+1),e

    ld b,5
    bsra de,b
    ld ix,$4b00
    ld (ix),d
    ld (ix+1),e

    ;
    ; BSRA with sign bit reset
    ld de,$7c00
    ld ix,$4d00
    ld (ix),d
    ld (ix+1),e

    ld b,5
    bsra de,b
    ld ix,$4f00
    ld (ix),d
    ld (ix+1),e
    ret

Title_Bsra
    .defn "Z80N #5: BSRA DE,B"
Instr_Bsra
    .defn "Check the highlighted pattern"
Instr_Bsra_2
    .defm "DE=$fc00, B=5 --> BSRA DE,B\x0d"
    .defn "DE=$7c00, B=5 --> BSRA DE,B"

;==========================================================
; Example: BSRL DE,B
;==========================================================
BsrlDemo
    ld hl,Title_Bsrl
    call _printTitle
    Ink(COLOR_BLACK)
    NewLine()
    ld hl,Instr_Bsrl
    call _printText
    NewLine()
    ld hl,Instr_Bsrl_2
    call _printText

    ; Set the background attribute to represent the shift
    ld a,attr(Color.Black, Color.White, 1)
    ld ($5900),a
    ld a,attr(Color.Black, Color.Green, 1)
    ld ($5901),a
    ;
    ; BSRL with sign bit set
    ld de,$fc00
    ld ix,$4900
    ld (ix),d
    ld (ix+1),e

    ld b,5
    bsrl de,b
    ld ix,$4b00
    ld (ix),d
    ld (ix+1),e

    ;
    ; BSRL with sign bit reset
    ld de,$7c00
    ld ix,$4d00
    ld (ix),d
    ld (ix+1),e

    ld b,5
    bsrl de,b
    ld ix,$4f00
    ld (ix),d
    ld (ix+1),e
    ret

Title_Bsrl
    .defn "Z80N #6: BSRL DE,B"
Instr_Bsrl
    .defn "Check the highlighted pattern"
Instr_Bsrl_2
    .defm "DE=$fc00, B=5 --> BSRL DE,B\x0d"
    .defn "DE=$7c00, B=5 --> BSRL DE,B"

;==========================================================
; Example: BSRF DE,B
;==========================================================
BsrfDemo
    ld hl,Title_Bsrf
    call _printTitle
    Ink(COLOR_BLACK)
    NewLine()
    ld hl,Instr_Bsrf
    call _printText
    NewLine()
    ld hl,Instr_Bsrf_2
    call _printText

    ; Set the background attribute to represent the shift
    ld a,attr(Color.Black, Color.White, 1)
    ld ($5900),a
    ld a,attr(Color.Black, Color.Green, 1)
    ld ($5901),a
    ;
    ; BSRF with sign bit set
    ld de,$fc00
    ld ix,$4900
    ld (ix),d
    ld (ix+1),e

    ld b,5
    bsrf de,b
    ld ix,$4b00
    ld (ix),d
    ld (ix+1),e

    ;
    ; BSRF with sign bit reset
    ld de,$7c00
    ld ix,$4d00
    ld (ix),d
    ld (ix+1),e

    ld b,5
    bsrf de,b
    ld ix,$4f00
    ld (ix),d
    ld (ix+1),e
    ret

Title_Bsrf
    .defn "Z80N #7: BSRF DE,B"
Instr_Bsrf
    .defn "Check the highlighted pattern"
Instr_Bsrf_2
    .defm "DE=$fc00, B=5 --> BSRF DE,B\x0d"
    .defn "DE=$7c00, B=5 --> BSRF DE,B"

;==========================================================
; Example: BSLC DE,B
;==========================================================
BrlcDemo
    ld hl,Title_Brlc
    call _printTitle
    Ink(COLOR_BLACK)
    NewLine()
    ld hl,Instr_Brlc
    call _printText
    NewLine()
    ld hl,Instr_Brlc_2
    call _printText

    ; Set the background attribute to represent the shift
    ld a,attr(Color.Black, Color.White, 1)
    ld ($5900),a
    ld a,attr(Color.Black, Color.Green, 1)
    ld ($5901),a
    ld de,$03fe
    ld ix,$4900
    ld (ix),d
    ld (ix+1),e

    ld b,5
    brlc de,b
    ld ix,$4b00
    ld (ix),d
    ld (ix+1),e
    ret

Title_Brlc
    .defn "Z80N #8: BRLC DE,B"
Instr_Brlc
    .defn "Check the highlighted pattern"
Instr_Brlc_2
    .defn "DE=$03fe, B=5 --> BRLC DE,B"

;==========================================================
; Example: LDIX
;==========================================================
LdixDemo
    ld hl,Title_Ldix
    call _printTitle
    Ink(COLOR_BLACK)
    NewLine()
    ld hl,Instr_Ldix
    call _printText
    NewLine()
    ld hl,Instr_Ldix_2
    call _printText

    ; Set the background attribute to represent the shift
    ld a,attr(Color.Black, Color.Cyan, 1)

    ld hl,Data_Ldix
    ld de,$5900
    ld bc,$00
    ldix
    ldix
    ldix
    ldix
    ldix
    ldix
    ldix
    ldix
    ret

Title_Ldix
    .defn "Z80N #9: LDIX"
Instr_Ldix
    .defn "A=$68 (Bright, cyan paper)"
Instr_Ldix_2
    .defn "LDIX keeps the 6th attribute"
Data_Ldix:
    .defb attr(Color.Black, Color.Black, 1)
    .defb attr(Color.Black, Color.Blue, 1)
    .defb attr(Color.Black, Color.Red, 1)
    .defb attr(Color.Black, Color.Magenta, 1)
    .defb attr(Color.Black, Color.Green, 1)
    .defb attr(Color.Black, Color.Cyan, 1)
    .defb attr(Color.Black, Color.Yellow, 1)
    .defb attr(Color.Black, Color.White, 1)

;==========================================================
; Example: LDDX
;==========================================================
LddxDemo
    ld hl,Title_Lddx
    call _printTitle
    Ink(COLOR_BLACK)
    NewLine()
    ld hl,Instr_Lddx
    call _printText
    NewLine()
    ld hl,Instr_Lddx_2
    call _printText

    ; Set the background attribute to represent the shift
    ld a,attr(Color.Black, Color.Cyan, 1)

    ld hl,Data_Lddx + 7
    ld de,$5900
    ld bc,$00
    lddx
    lddx
    lddx
    lddx
    lddx
    lddx
    lddx
    lddx
    ret

Title_Lddx
    .defn "Z80N #10: LDDX"
Instr_Lddx
    .defn "A=$68 (Bright, cyan paper)"
Instr_Lddx_2
    .defn "LDDX keeps the 6th attribute"
Data_Lddx:
    .defb attr(Color.Black, Color.Black, 1)
    .defb attr(Color.Black, Color.Blue, 1)
    .defb attr(Color.Black, Color.Red, 1)
    .defb attr(Color.Black, Color.Magenta, 1)
    .defb attr(Color.Black, Color.Green, 1)
    .defb attr(Color.Black, Color.Cyan, 1)
    .defb attr(Color.Black, Color.Yellow, 1)
    .defb attr(Color.Black, Color.White, 1)

;==========================================================
; Example: LDIRX
;==========================================================
LdirxDemo
    ld hl,Title_Ldirx
    call _printTitle
    Ink(Color.Black)
    NewLine()
    ld hl,Instr_Ldirx
    call _printText
    NewLine()
    ld hl,Instr_Ldirx_2
    call _printText

    ; Set the background attribute to represent the shift
    ld a,attr(Color.Black, Color.Cyan, 1)

    ld hl,Data_Ldirx
    ld de,$5900
    ld bc,$08
    ldirx
    ret

Title_Ldirx
    .defn "Z80N #11: LDIRX"
Instr_Ldirx
    .defn "A=$68 (Bright, cyan paper)"
Instr_Ldirx_2
    .defn "LDIRX keeps the 6th attribute"
Data_Ldirx:
    .defb attr(Color.Black, Color.Black, 1)
    .defb attr(Color.Black, Color.Blue, 1)
    .defb attr(Color.Black, Color.Red, 1)
    .defb attr(Color.Black, Color.Magenta, 1)
    .defb attr(Color.Black, Color.Green, 1)
    .defb attr(Color.Black, Color.Cyan, 1)
    .defb attr(Color.Black, Color.Yellow, 1)
    .defb attr(Color.Black, Color.White, 1)

;==========================================================
; Example: LDDRX
;==========================================================
LddrxDemo
    ld hl,Title_Lddrx
    call _printTitle
    Ink(COLOR_BLACK)
    NewLine()
    ld hl,Instr_Lddrx
    call _printText
    NewLine()
    ld hl,Instr_Lddrx_2
    call _printText

    ; Set the background attribute to represent the shift
    ld a,attr(Color.Black, Color.Cyan, 1)

    ld hl,Data_Lddrx + 7
    ld de,$5900
    ld bc,$08
    lddrx
    ret

Title_Lddrx
    .defn "Z80N #12: LDDRX"
Instr_Lddrx
    .defn "A=$68 (Bright, cyan paper)"
Instr_Lddrx_2
    .defn "LDDRX keeps the 6th attribute"
Data_Lddrx:
    .defb attr(Color.Black, Color.Black, 1)
    .defb attr(Color.Black, Color.Blue, 1)
    .defb attr(Color.Black, Color.Red, 1)
    .defb attr(Color.Black, Color.Magenta, 1)
    .defb attr(Color.Black, Color.Green, 1)
    .defb attr(Color.Black, Color.Cyan, 1)
    .defb attr(Color.Black, Color.Yellow, 1)
    .defb attr(Color.Black, Color.White, 1)

;==========================================================
; Example: LDWS
;==========================================================
LdwsDemo
    ld hl,Title_Ldws
    call _printTitle
    Ink(COLOR_BLACK)
    NewLine()
    ld hl,Instr_Ldws
    call _printText

    ; Set the background attribute to represent the shift
    ld a,attr(Color.Black, Color.Green, 1)
    ld ($5900),a

    ld hl,Data_Ldws
    ld de,$4800
    ldws
    ldws
    ldws
    ldws
    ldws
    ldws
    ldws
    ldws
    ret

Title_Ldws
    .defn "Z80N #13: LDWS"
Instr_Ldws
    .defn "8 LDWS copy a diamond"
Data_Ldws
    .defb $18, $3c, $7e, $ff
    .defb $ff, $7e, $3c, $18

;==========================================================
; Example: LDPIRX
;==========================================================
LdpirxDemo
    ld hl,Title_Ldpirx
    call _printTitle
    Ink(COLOR_BLACK)
    NewLine()
    ld hl,Instr_Ldpirx
    call _printText
    NewLine()
    ld hl,Instr_Ldpirx_2
    call _printText

    ld a,attr(Color.Black, Color.Green, 1)
    ld hl,Data_Ldpirx
    ld de,$5900
    ld bc,$20
    ldpirx
    ret

Title_Ldpirx
    .defn "Z80N #14: LDPIRX"
Instr_Ldpirx
    .defn "LDPIRX copies 32 attr bytes"
Instr_Ldpirx_2
    .defn "Green attributes are skipped"
.align 8
Data_Ldpirx
    .defb attr(Color.Black, Color.Black, 1)
    .defb attr(Color.Black, Color.Blue, 1)
    .defb attr(Color.Black, Color.Red, 1)
    .defb attr(Color.Black, Color.Magenta, 1)
    .defb attr(Color.Black, Color.Green, 1)
    .defb attr(Color.Black, Color.Cyan, 1)
    .defb attr(Color.Black, Color.Yellow, 1)
    .defb attr(Color.Black, Color.White, 1)

;==========================================================
; Example: PIXELAD
;==========================================================
PixeladDemo
    ld hl,Title_Pixelad
    call _printTitle
    Ink(COLOR_BLACK)
    NewLine()
    ld hl,Instr_Pixelad
    call _printText
    ld d,70
    ld e,130
    pixelad
    ld (hl),$ff
    ret

Title_Pixelad
    .defn "Z80N #15: PIXELAD"
Instr_Pixelad
    .defn "Set the byte of (70, 130) to $ff"

;==========================================================
; Example: PIXELDN
;==========================================================
PixeldnDemo
    ld hl,Title_Pixeldn
    call _printTitle
    Ink(COLOR_BLACK)
    NewLine()
    ld hl,Instr_Pixeldn
    call _printText
    ld d,70
    ld e,130
    pixelad
    ld b,8
    ld a,$ff
`loop
    ld (hl),a
    pixeldn
    sla a
    djnz `loop
    ret

Title_Pixeldn
    .defn "Z80N #16: PIXELDN"
Instr_Pixeldn
    .defn "Set 8 bytes below with PIXELDN"

;==========================================================
; Example: SETAE
;==========================================================
SetaeDemo
    ld hl,Title_Setae
    call _printTitle
    Ink(COLOR_BLACK)
    NewLine()
    ld hl,Instr_Setae
    call _printText
    ld d,70
    ld e,130
    pixelad
    ld e,7
    ld a,0
`loop
    setae
    ld (hl),a
    pixeldn
    dec e
    jp p,`loop
    ret

Title_Setae
    .defn "Z80N #17: SETAE"
Instr_Setae
    .defn "Set 8 bytes below with SETAE"

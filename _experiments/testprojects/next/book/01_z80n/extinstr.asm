.module Z80NDemo

@Before_Str:
    .defn "Before: "
@After_Str:
    .defn "After:  "

;==========================================================
; Example: SWAPNIB
;==========================================================
DoSwapnib
    Display.PrintTitle(@Title_Swapnib)
    Display.PrintText(@Before_Str)
    Display.Ink(Color.Blue)

    ld a,$3e
    push af
    Display.PrintAHexadecimal()
    Display.NewLine()
    Display.Ink(Color.Black)
    Display.PrintText(@After_Str)
    Display.Ink(Color.Blue)
    pop af

    ; *** Swaps the high and low nibbles of A
    swapnib
    
    Display.PrintAHexadecimal()
    ret

@Title_Swapnib
    .defn "Z80N #1: SWAPNIB"

;==========================================================
; Example: MIRROR A
;==========================================================
DoMirror
    Display.PrintTitle(@Title_Mirror)
    Display.PrintText(@Before_Str)

    ld a,%1011_0010
    push af
    Display.Ink(Color.Blue)
    Display.PrintABinary()
    Display.NewLine()
    Display.Ink(Color.Black)
    Display.PrintText(@After_Str)
    Display.Ink(Color.Blue)
    pop af
    ; *** Reverses the bit order of A
    mirror a
    
    Display.PrintABinary()
    ret

@Title_Mirror
    .defn "Z80N #2: MIRROR A"


;==========================================================
; Example: TEST n
;==========================================================
DoTest
    Display.PrintTitle(@Title_Test)
    Display.PrintText(@Test_Value_Str)
    Display.Ink(Color.Blue)

    ld a,%1000_0100
    push af
    Display.PrintABinary()
    Display.NewLine()
    Display.Ink(Color.Black)
    Display.PrintText(@Test_With_1_Str)
    Display.Ink(Color.Blue)
    pop af
    push af
    
    test %1000_0000
    Display.PrintZFlag()
    Display.Ink(Color.Black)
    Display.NewLine()
    Display.PrintText(@Test_With_2_Str)
    Display.Ink(Color.Blue)
    pop af

    test %0000_0010
    Display.PrintZFlag()
    ret

@Title_Test
    .defn "Z80N #3: TEST n"
@Test_Value_Str
    .defn "Value of A:        "
@Test_With_1_Str
    .defn "Z flag after TEST %1000_0000: "
@Test_With_2_Str
    .defn "Z flag after TEST %0000_0010: "

;==========================================================
; Example: BSLA DE,B
;==========================================================
DoBsla
    Display.PrintTitle(@Title_Bsla)
    Display.Ink(Color.Black)
    Display.NewLine()
    Display.PrintText(@Instr_Bsla)
    Display.NewLine()
    Display.PrintText(@Instr_Bsla_2)

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

@Title_Bsla
    .defn "Z80N #4: BSLA DE,B"
@Instr_Bsla
    .defn "Check the highlighted pattern"
@Instr_Bsla_2
    .defn "DE=$003f, B=5 --> BSLA DE,B"

;==========================================================
; Example: BSRA DE,B
;==========================================================
DoBsra
    Display.PrintTitle(@Title_Bsra)
    Display.Ink(Color.Black)
    Display.NewLine()
    Display.PrintText(@Instr_Bsra)
    Display.NewLine()
    Display.PrintText(@Instr_Bsra_2)

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

@Title_Bsra
    .defn "Z80N #5: BSRA DE,B"
@Instr_Bsra
    .defn "Check the highlighted pattern"
@Instr_Bsra_2
    .defm "DE=$fc00, B=5 --> BSRA DE,B\x0d"
    .defn "DE=$7c00, B=5 --> BSRA DE,B"

;==========================================================
; Example: BSRL DE,B
;==========================================================
DoBsrl
    Display.PrintTitle(@Title_Bsrl)
    Display.Ink(Color.Black)
    Display.NewLine()
    Display.PrintText(@Instr_Bsrl)
    Display.NewLine()
    Display.PrintText(@Instr_Bsrl_2)

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

@Title_Bsrl
    .defn "Z80N #6: BSRL DE,B"
@Instr_Bsrl
    .defn "Check the highlighted pattern"
@Instr_Bsrl_2
    .defm "DE=$fc00, B=5 --> BSRL DE,B\x0d"
    .defn "DE=$7c00, B=5 --> BSRL DE,B"

;==========================================================
; Example: BSRF DE,B
;==========================================================
DoBsrf
    Display.PrintTitle(@Title_Bsrf)
    Display.Ink(Color.Black)
    Display.NewLine()
    Display.PrintText(@Instr_Bsrf)
    Display.NewLine()
    Display.PrintText(@Instr_Bsrf_2)

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

@Title_Bsrf
    .defn "Z80N #7: BSRF DE,B"
@Instr_Bsrf
    .defn "Check the highlighted pattern"
@Instr_Bsrf_2
    .defm "DE=$fc00, B=5 --> BSRF DE,B\x0d"
    .defn "DE=$7c00, B=5 --> BSRF DE,B"

;==========================================================
; Example: BSLC DE,B
;==========================================================
DoBrlc
    Display.PrintTitle(@Title_Brlc)
    Display.Ink(Color.Black)
    Display.NewLine()
    Display.PrintText(@Instr_Brlc)
    Display.NewLine()
    Display.PrintText(@Instr_Brlc_2)

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

@Title_Brlc
    .defn "Z80N #8: BRLC DE,B"
@Instr_Brlc
    .defn "Check the highlighted pattern"
@Instr_Brlc_2
    .defn "DE=$03fe, B=5 --> BRLC DE,B"

;==========================================================
; Example: LDIX
;==========================================================
DoLdix
    Display.PrintTitle(@Title_Ldix)
    Display.Ink(Color.Black)
    Display.NewLine()
    Display.PrintText(@Instr_Ldix)
    Display.NewLine()
    Display.PrintText(@Instr_Ldix_2)

    ; Set the background attribute to represent the shift
    ld a,attr(Color.Black, Color.Cyan, 1)

    ld hl,@Data_Attrs
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

@Title_Ldix
    .defn "Z80N #9: LDIX"
@Instr_Ldix
    .defn "A=$68 (Bright, cyan paper)"
@Instr_Ldix_2
    .defn "LDIX keeps the 6th attribute"
@Data_Attrs:
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
DoLddx
    Display.PrintTitle(@Title_Lddx)
    Display.Ink(Color.Black)
    Display.NewLine()
    Display.PrintText(@Instr_Lddx)
    Display.NewLine()
    Display.PrintText(@Instr_Lddx_2)

    ; Set the background attribute to represent the shift
    ld a,attr(Color.Black, Color.Cyan, 1)

    ld hl,@Data_Attrs + 7
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

@Title_Lddx
    .defn "Z80N #10: LDDX"
@Instr_Lddx
    .defn "A=$68 (Bright, cyan paper)"
@Instr_Lddx_2
    .defn "LDDX keeps the 6th attribute"

;==========================================================
; Example: LDIRX
;==========================================================
DoLdirx
    Display.PrintTitle(@Title_Ldirx)
    Display.Ink(Color.Black)
    Display.NewLine()
    Display.PrintText(@Instr_Ldirx)
    Display.NewLine()
    Display.PrintText(@Instr_Ldirx_2)

    ; Set the background attribute to represent the shift
    ld a,attr(Color.Black, Color.Cyan, 1)

    ld hl,@Data_Attrs
    ld de,$5900
    ld bc,$08
    ldirx
    ret

@Title_Ldirx
    .defn "Z80N #11: LDIRX"
@Instr_Ldirx
    .defn "A=$68 (Bright, cyan paper)"
@Instr_Ldirx_2
    .defn "LDIRX keeps the 6th attribute"

;==========================================================
; Example: LDDRX
;==========================================================
DoLddrx
    Display.PrintTitle(@Title_Lddrx)
    Display.Ink(Color.Black)
    Display.NewLine()
    Display.PrintText(@Instr_Lddrx)
    Display.NewLine()
    Display.PrintText(@Instr_Lddrx_2)

    ; Set the background attribute to represent the shift
    ld a,attr(Color.Black, Color.Cyan, 1)

    ld hl,@Data_Attrs + 7
    ld de,$5900
    ld bc,$08
    lddrx
    ret

@Title_Lddrx
    .defn "Z80N #12: LDDRX"
@Instr_Lddrx
    .defn "A=$68 (Bright, cyan paper)"
@Instr_Lddrx_2
    .defn "LDDRX keeps the 6th attribute"

;==========================================================
; Example: LDWS
;==========================================================
DoLdws
    Display.PrintTitle(@Title_Ldws)
    Display.Ink(Color.Black)
    Display.NewLine()
    Display.PrintText(@Instr_Ldws)

    ; Set the background attribute to represent the shift
    ld a,attr(Color.Black, Color.Green, 1)
    ld ($5900),a

    ld hl,@Data_Ldws
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

@Title_Ldws
    .defn "Z80N #13: LDWS"
@Instr_Ldws
    .defn "8 LDWS copy a diamond"
@Data_Ldws
    .defb $18, $3c, $7e, $ff
    .defb $ff, $7e, $3c, $18

;==========================================================
; Example: LDPIRX
;==========================================================
DoLdpirx
    Display.PrintTitle(@Title_Ldpirx)
    Display.Ink(Color.Black)
    Display.NewLine()
    Display.PrintText(@Instr_Ldpirx)
    Display.NewLine()
    Display.PrintText(@Instr_Ldpirx_2)

    ld a,attr(Color.Black, Color.Green, 1)
    ld hl,@Data_Ldpirx
    ld de,$5900
    ld bc,$20
    ldpirx
    ret

@Title_Ldpirx
    .defn "Z80N #14: LDPIRX"
@Instr_Ldpirx
    .defn "LDPIRX copies 32 attr bytes"
@Instr_Ldpirx_2
    .defn "Green attributes are skipped"
.align 8
@Data_Ldpirx
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
DoPixelad
    Display.PrintTitle(@Title_Pixelad)
    Display.Ink(Color.Black)
    Display.NewLine()
    Display.PrintText(@Instr_Pixelad)
    ld d,70
    ld e,130
    pixelad
    ld (hl),$ff
    ret

@Title_Pixelad
    .defn "Z80N #15: PIXELAD"
@Instr_Pixelad
    .defn "Set the byte of (70, 130) to $ff"

;==========================================================
; Example: PIXELDN
;==========================================================
DoPixeldn
    Display.PrintTitle(@Title_Pixeldn)
    Display.Ink(Color.Black)
    Display.NewLine()
    Display.PrintText(@Instr_Pixeldn)
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

@Title_Pixeldn
    .defn "Z80N #16: PIXELDN"
@Instr_Pixeldn
    .defn "Set 8 bytes below with PIXELDN"

;==========================================================
; Example: SETAE
;==========================================================
DoSetae
    Display.PrintTitle(@Title_Setae)
    Display.Ink(Color.Black)
    Display.NewLine()
    Display.PrintText(@Instr_Setae)
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

@Title_Setae
    .defn "Z80N #17: SETAE"
@Instr_Setae
    .defn "Set 8 bytes below with SETAE"

.endmodule
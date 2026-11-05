.module UlaDemo

ULA_PORT        .equ $fe
TIMEX_PORT      .equ $00ff

SCREEN_PIXELS   .equ $4000
SCREEN_ATTRS    .equ $5800
TIMEX_FILE_2    .equ $6000

ATTR_BLACK_ON_WHITE .equ attr(Color.Black, Color.White)
ATTR_WHITE_ON_BLUE  .equ attr(Color.White, Color.Blue, true)
ATTR_YELLOW_ON_BLUE .equ attr(Color.Yellow, Color.Blue, true)
ATTR_CYAN_ON_BLACK  .equ attr(Color.Cyan, Color.Black, true)
ATTR_GREEN_ON_BLACK .equ attr(Color.Green, Color.Black, true)

;==========================================================
; ULA standard screen demo: pixels + attributes with Z80N
;==========================================================
StandardScreen
    call @ResetUlaMode
    call @ClearScreenMemory

    Display.PrintTitle(@Title_Standard)
    Display.PrintText(@Instr_Standard)

    call @PaintStandardAttributes
    call @DrawBox
    call @DrawDiagonal
    call @DrawBarsWithPixelDn

    call @WaitSpace
    ret

;==========================================================
; ULA HiColor demo
;==========================================================
HiColor
    call @ResetUlaMode
    call @ClearScreenMemory
    call @ClearTimexSecondFile

    Display.PrintTitle(@Title_HiColor)
    Display.PrintText(@Instr_HiColor)
    call @WaitH

    call @ClearScreenMemory
    call @ClearTimexSecondFile
    call @DrawHiColorPixels
    call @DrawHiColorAttributes

    ld a,%00000010              ; Timex HiColor mode
    call @SetTimexMode

    call @WaitS
    call @ResetUlaMode
    call @ClearScreenMemory
    Display.PrintTitle(@Title_HiColor)
    Display.PrintText(@BackToStandard)
    ret

;==========================================================
; ULA HiRes demo
;==========================================================
HiRes
    call @ResetUlaMode
    call @ClearScreenMemory
    call @ClearTimexSecondFile

    Display.PrintTitle(@Title_HiRes)
    Display.PrintText(@Instr_HiRes)
    call @WaitR

    call @ClearScreenMemory
    call @ClearTimexSecondFile
    call @DrawHiResPattern

    ld a,%00110110              ; ink colour in bits 5..3, mode 110
    call @SetTimexMode

    call @WaitS
    call @ResetUlaMode
    call @ClearScreenMemory
    Display.PrintTitle(@Title_HiRes)
    Display.PrintText(@BackToStandard)
    ret

;----------------------------------------------------------
; Standard ULA drawing helpers
;----------------------------------------------------------
@PaintStandardAttributes
    ld hl,SCREEN_ATTRS + 10 * 32 + 4
    ld b,12
`row
    ld c,24
`col
    ld (hl),ATTR_WHITE_ON_BLUE
    inc hl
    dec c
    jr nz,`col
    add hl,8
    djnz `row
    ret

@DrawBox
    ; Top and bottom horizontal edges.
    ld d,88
    ld e,48
    ld b,160
    call @DrawHorizontalLineZ80N

    ld d,168
    ld e,48
    ld b,160
    call @DrawHorizontalLineZ80N

    ; Left and right vertical edges.
    ld d,88
    ld e,48
    ld b,81
    call @DrawVerticalLineZ80N

    ld d,88
    ld e,208
    ld b,81
    call @DrawVerticalLineZ80N
    ret

@DrawDiagonal
    ld d,96
    ld e,72
    ld b,64
`loop
    call @PlotPixelZ80N
    inc d
    inc e
    djnz `loop
    ret

@DrawBarsWithPixelDn
    ld d,96
    ld e,72
    ld b,64
    call @DrawVerticalLineZ80N

    ld d,96
    ld e,96
    ld b,64
    call @DrawVerticalLineZ80N

    ld d,96
    ld e,120
    ld b,64
    call @DrawVerticalLineZ80N

    ld d,96
    ld e,144
    ld b,64
    call @DrawVerticalLineZ80N

    ld d,96
    ld e,168
    ld b,64
    call @DrawVerticalLineZ80N
    ret

@DrawHorizontalLineZ80N
    ; IN: D=y, E=x, B=length in pixels
`loop
    call @PlotPixelZ80N
    inc e
    djnz `loop
    ret

@DrawVerticalLineZ80N
    ; IN: D=y, E=x, B=height in pixels
    call @PixelAddressAndMask
    ld c,a
`loop
    ld a,c
    or (hl)
    ld (hl),a
    dec b
    ret z
    pixeldn
    jr `loop

@PlotPixelZ80N
    ; IN: D=y, E=x
    call @PixelAddressAndMask
    or (hl)
    ld (hl),a
    ret

@PixelAddressAndMask
    ; IN: D=y, E=x
    ; OUT: HL=ULA pixel byte address, A=pixel mask
    pixelad
    setae
    ret

;----------------------------------------------------------
; HiColor helpers
;----------------------------------------------------------
@DrawHiColorPixels
    ; Fill each 8-pixel row with a stripe pattern.
    ld hl,SCREEN_PIXELS
    ld de,SCREEN_PIXELS + 1
    ld bc,6143
    ld (hl),%11110000
    ldir

    ; Add a few byte-wide vertical features so the colour rows are obvious.
    ld d,24
    ld e,32
    ld b,144
    call @DrawVerticalLineZ80N
    ld d,24
    ld e,96
    ld b,144
    call @DrawVerticalLineZ80N
    ld d,24
    ld e,160
    ld b,144
    call @DrawVerticalLineZ80N
    ld d,24
    ld e,224
    ld b,144
    call @DrawVerticalLineZ80N
    ret

@DrawHiColorAttributes
    ; HiColor attributes live at $6000, one 32-byte row per pixel row.
    ld hl,TIMEX_FILE_2
    ld d,192
`row
    ld a,d
    and %00000111
    call @HiColorAttrForBand
    ld b,32
`col
    ld (hl),a
    inc hl
    djnz `col
    dec d
    jr nz,`row
    ret

@HiColorAttrForBand
    ; IN: A = band 0..7
    push de
    and %00000111
    ld e,a
    ld d,0
    ld hl,@HiColorAttrs
    add hl,de
    ld a,(hl)
    pop de
    ret

@HiColorAttrs
    .db attr(Color.White, Color.Blue, true)
    .db attr(Color.Yellow, Color.Red, true)
    .db attr(Color.Cyan, Color.Black, true)
    .db attr(Color.Green, Color.Magenta, true)
    .db attr(Color.Black, Color.Yellow, true)
    .db attr(Color.White, Color.Green, true)
    .db attr(Color.Red, Color.Cyan, true)
    .db attr(Color.Blue, Color.White, true)

;----------------------------------------------------------
; HiRes helpers
;----------------------------------------------------------
@DrawHiResPattern
    ; HiRes uses $4000 and $6000 as the two interleaved 256-pixel files.
    ld hl,SCREEN_PIXELS
    ld bc,6144
    ld a,%10101010
    call @FillBytes

    ld hl,TIMEX_FILE_2
    ld bc,6144
    ld a,%01010101
    call @FillBytes

    ; Draw contrasting bands in the two files. When HiRes is enabled, they
    ; interleave into a denser 512-pixel-wide pattern.
    ld hl,SCREEN_PIXELS + 16 * 32
    ld bc,32 * 32
    ld a,%11110000
    call @FillBytes

    ld hl,TIMEX_FILE_2 + 80 * 32
    ld bc,32 * 32
    ld a,%00001111
    call @FillBytes
    ret

;----------------------------------------------------------
; Shared screen/mode/key helpers
;----------------------------------------------------------
@ClearScreenMemory
    ld hl,SCREEN_PIXELS
    ld de,SCREEN_PIXELS + 1
    ld bc,6143
    xor a
    ld (hl),a
    ldir

    ld hl,SCREEN_ATTRS
    ld de,SCREEN_ATTRS + 1
    ld bc,767
    ld a,ATTR_BLACK_ON_WHITE
    ld (hl),a
    ldir
    ret

@ClearTimexSecondFile
    ld hl,TIMEX_FILE_2
    ld bc,6144
    xor a
    call @FillBytes
    ret

@FillBytes
    ; IN: HL=destination, BC=count, A=value
    ld (hl),a
    ld d,h
    ld e,l
    inc de
    dec bc
    ld a,b
    or c
    ret z
    ldir
    ret

@ResetUlaMode
    xor a
    ld (@TimexShadow),a
    ld bc,TIMEX_PORT
    out (c),a
    ret

@SetTimexMode
    ; IN: A = full value for port $FF
    ld (@TimexShadow),a
    ld bc,TIMEX_PORT
    out (c),a
    ret

@WaitSpace
    ld b,$7f
    ld d,%00000001
    jr @WaitKey

@WaitH
    ld b,$bf
    ld d,%00010000
    jr @WaitKey

@WaitR
    ld b,$fb
    ld d,%00001000
    jr @WaitKey

@WaitS
    ld b,$fd
    ld d,%00000010

@WaitKey
    ; IN: B=keyboard row selector, D=bit mask
    ld c,ULA_PORT
`release
    in a,(c)
    and d
    jr z,`release
`press
    in a,(c)
    and d
    jr nz,`press
`release2
    in a,(c)
    and d
    jr z,`release2
    ret

@TimexShadow
    .db 0

@Title_Standard
    .defn "ULA #1: Standard screen"

@Instr_Standard
    .defm "Standard ULA pixels plus\x0d"
    .defm "attribute cells. Uses Z80N:\x0d"
    .defm "PIXELAD, SETAE, PIXELDN.\x0d\x0d"
    .defn "Press Space to complete.\x0d\x0d"

@Title_HiColor
    .defn "ULA #2: HiColor mode"

@Instr_HiColor
    .defm "This demo prepares a Timex\x0d"
    .defm "HiColor screen: bitmap at $4000,\x0d"
    .defm "per-row attributes at $6000.\x0d\x0d"
    .defm "Press H to switch to HiColor.\x0d"
    .defn "Press S to return to standard ULA."

@Title_HiRes
    .defn "ULA #3: HiRes mode"

@Instr_HiRes
    .defm "This demo prepares a Timex\x0d"
    .defm "HiRes screen: even columns from\x0d"
    .defm "$4000, odd columns from $6000.\x0d\x0d"
    .defm "Press R to switch to HiRes.\x0d"
    .defn "Press S to return to standard ULA."

@BackToStandard
    .defn "Back in standard ULA mode."

.endmodule

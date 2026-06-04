.module LoResDemo

ULA_PORT        .equ $fe

LORES_TOP      .equ $4000
LORES_BOTTOM   .equ $6000

NR_TRANSPARENT  .equ $14
NR_PRIORITY     .equ $15
NR_LORES_X      .equ $32
NR_LORES_Y      .equ $33
NR_PALETTE_INDEX .equ $40
NR_PALETTE_VALUE .equ $41
NR_PALETTE_CTRL  .equ $43
NR_LORES_CTRL    .equ $6a

PAL_ULA_FIRST   .equ %00000000
LORES_ENABLE    .equ %10000000

;==========================================================
; Draw a 128x96 8-bit LoRes colour field
;==========================================================
ColourField
    call @ResetVideoState
    call @LoadLinearPalette
    call @DrawColourField
    call @EnableLoRes
    call @WaitSpace
    call @RestoreAfterLoRes
    ret

;==========================================================
; Draw a LoRes pattern and scroll it in hardware
;==========================================================
HardwareScroll
    call @ResetVideoState
    call @LoadLinearPalette
    call @DrawScrollPattern
    call @EnableLoRes

    xor a
    ld (@ScrollX),a
    ei
`loop
    halt
    ld a,(@ScrollX)
    inc a
    ld (@ScrollX),a
    nextreg NR_LORES_X,a
    ld a,$7f                    ; Space exits
    in a,(ULA_PORT)
    bit 0,a
    jr nz,`loop

    call @RestoreAfterLoRes
    ret

;----------------------------------------------------------
; Drawing helpers
;----------------------------------------------------------
@DrawColourField
    ld hl,LORES_TOP
    ld d,0
    ld b,48
    call @DrawGradientHalf

    ld hl,LORES_BOTTOM
    ld d,48
    ld b,48
    jp @DrawGradientHalf

@DrawGradientHalf
    ; IN: HL=destination, D=first LoRes row, B=row count
`row
    push bc
    ld e,0
    ld b,128
`col
    ld a,e
    add a,d
    ld (hl),a
    inc hl
    inc e
    djnz `col
    inc d
    pop bc
    djnz `row
    ret

@DrawScrollPattern
    ld hl,LORES_TOP
    ld d,0
    ld b,48
    call @DrawPatternHalf

    ld hl,LORES_BOTTOM
    ld d,48
    ld b,48
    jp @DrawPatternHalf

@DrawPatternHalf
    ; IN: HL=destination, D=first LoRes row, B=row count
`row
    push bc
    ld e,0
    ld b,128
`col
    ld a,e
    rrca
    rrca
    and %00111100
    ld c,a
    ld a,d
    rrca
    and %00001111
    add a,c
    add a,64
    ld (hl),a
    inc hl
    inc e
    djnz `col
    inc d
    pop bc
    djnz `row
    ret

;----------------------------------------------------------
; Palette and video-state helpers
;----------------------------------------------------------
@LoadLinearPalette
    nextreg NR_PALETTE_CTRL,PAL_ULA_FIRST
    nextreg NR_PALETTE_INDEX,0
    ld b,0
    xor a
`loop
    nextreg NR_PALETTE_VALUE,a
    inc a
    djnz `loop
    ret

@RestoreDefaultUlaPalette
    nextreg NR_PALETTE_CTRL,PAL_ULA_FIRST
    nextreg NR_PALETTE_INDEX,0
    ld d,16
`group
    ld hl,@DefaultUla16
    ld b,16
`entry
    ld a,(hl)
    nextreg NR_PALETTE_VALUE,a
    inc hl
    djnz `entry
    dec d
    jr nz,`group
    ret

@EnableLoRes
    nextreg NR_LORES_CTRL,0
    nextreg NR_LORES_X,0
    nextreg NR_LORES_Y,0
    nextreg NR_PRIORITY,LORES_ENABLE
    ret

@DisableLoRes
    nextreg NR_PRIORITY,0
    nextreg NR_LORES_X,0
    nextreg NR_LORES_Y,0
    nextreg NR_LORES_CTRL,0
    ret

@ResetVideoState
    call @DisableLoRes
    nextreg NR_TRANSPARENT,$e3
    nextreg NR_PALETTE_CTRL,PAL_ULA_FIRST
    ret

@RestoreAfterLoRes
    call @DisableLoRes
    call @RestoreDefaultUlaPalette
    Display.ClearScreen()
    Display.PrintTitle(@Title_Done)
    Display.PrintText(@Text_Done)
    ret

;----------------------------------------------------------
; Keyboard helpers
;----------------------------------------------------------
@WaitSpace
    ld b,$7f
    ld d,%00000001
    jr @WaitKey

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

;----------------------------------------------------------
; Data and strings
;----------------------------------------------------------
@ScrollX
    .db 0

@DefaultUla16
    .db $00,$02,$a0,$a2,$14,$16,$b4,$b6
    .db $00,$03,$e0,$e3,$1c,$1f,$fc,$ff

@Title_Done
    .defn "LoRes mode restored"

@Text_Done
    .defn "Back in standard ULA mode.\x0d"

.endmodule

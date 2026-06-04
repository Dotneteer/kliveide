.module Layer2Demo

LAYER2_PORT     .equ $123b
ULA_PORT        .equ $fe

NR_TRANSPARENT  .equ $14
NR_PRIORITY     .equ $15
NR_LAYER2_X     .equ $16
NR_LAYER2_Y     .equ $17
NR_CLIP_L2      .equ $18
NR_CLIP_CTRL    .equ $1c
NR_PALETTE_INDEX .equ $40
NR_PALETTE_VALUE .equ $41
NR_PALETTE_CTRL  .equ $43
NR_DISPLAY_CTRL1 .equ $69
NR_LAYER2_RES    .equ $70
NR_LAYER2_X_MSB  .equ $71
NR_LAYER2_ACTIVE .equ $12
NR_LAYER2_SHADOW .equ $13

PAL_LAYER2_FIRST .equ %00100000

L2_MAP_WRITE_0  .equ %00000001
L2_MAP_WRITE_1  .equ %01000001
L2_MAP_WRITE_2  .equ %10000001
L2_DISPLAY_ON   .equ %00000010

;==========================================================
; Draw a 256x192 Layer 2 gradient
;==========================================================
Gradient
    call @ResetLayer2State
    call @ClearUlaBehind
    call @LoadLinearLayer2Palette
    call @DrawGradient
    call @EnableLayer2
    call @WaitSpace
    call @RestoreAfterLayer2
    ret

;==========================================================
; Scroll a Layer 2 image in hardware
;==========================================================
HardwareScroll
    call @ResetLayer2State
    call @ClearUlaBehind
    call @LoadLinearLayer2Palette
    call @DrawScrollPattern
    call @EnableLayer2

    xor a
    ld (@ScrollX),a
    ei
`loop
    halt
    ld a,(@ScrollX)
    inc a
    ld (@ScrollX),a
    nextreg NR_LAYER2_X,a
    ld a,$7f                    ; Space exits
    in a,(ULA_PORT)
    bit 0,a
    jr nz,`loop

    call @RestoreAfterLayer2
    ret

;----------------------------------------------------------
; Layer 2 drawing helpers
;----------------------------------------------------------
@DrawGradient
    ld a,L2_MAP_WRITE_0
    ld d,0
    call @DrawGradientThird

    ld a,L2_MAP_WRITE_1
    ld d,64
    call @DrawGradientThird

    ld a,L2_MAP_WRITE_2
    ld d,128
    jp @DrawGradientThird

@DrawGradientThird
    ; IN: A=Layer 2 mapping value, D=first row in this 16K third
    ld bc,LAYER2_PORT
    out (c),a
    ld hl,0
    ld c,64
`row
    ld e,0
    ld b,0
`col
    ld a,e
    add a,d
    ld (hl),a
    inc hl
    inc e
    djnz `col
    inc d
    dec c
    jr nz,`row
    jp @UnmapLayer2

@DrawScrollPattern
    ld a,L2_MAP_WRITE_0
    ld d,0
    call @DrawPatternThird

    ld a,L2_MAP_WRITE_1
    ld d,64
    call @DrawPatternThird

    ld a,L2_MAP_WRITE_2
    ld d,128
    jp @DrawPatternThird

@DrawPatternThird
    ; IN: A=Layer 2 mapping value, D=first row in this 16K third
    ld bc,LAYER2_PORT
    out (c),a
    ld hl,0
    ld c,64
`row
    ld e,0
    ld b,0
`col
    ld a,e
    xor d
    add a,32
    ld (hl),a
    inc hl
    inc e
    djnz `col
    inc d
    dec c
    jr nz,`row
    jp @UnmapLayer2

;----------------------------------------------------------
; Palette and video-state helpers
;----------------------------------------------------------
@LoadLinearLayer2Palette
    nextreg NR_PALETTE_CTRL,PAL_LAYER2_FIRST
    nextreg NR_PALETTE_INDEX,0
    ld b,0
    xor a
`loop
    nextreg NR_PALETTE_VALUE,a
    inc a
    djnz `loop
    ret

@EnableLayer2
    nextreg NR_LAYER2_ACTIVE,8
    nextreg NR_LAYER2_SHADOW,11
    nextreg NR_LAYER2_RES,0
    nextreg NR_LAYER2_X,0
    nextreg NR_LAYER2_Y,0
    nextreg NR_LAYER2_X_MSB,0
    nextreg NR_TRANSPARENT,0
    nextreg NR_PRIORITY,0
    nextreg NR_DISPLAY_CTRL1,$80
    ld bc,LAYER2_PORT
    ld a,L2_DISPLAY_ON
    out (c),a
    ret

@DisableLayer2
    nextreg NR_DISPLAY_CTRL1,0
    nextreg NR_LAYER2_X,0
    nextreg NR_LAYER2_Y,0
    nextreg NR_LAYER2_X_MSB,0
    nextreg NR_LAYER2_RES,0
    ld bc,LAYER2_PORT
    xor a
    out (c),a
    ret

@UnmapLayer2
    ld bc,LAYER2_PORT
    xor a
    out (c),a
    ret

@ResetLayer2State
    call @DisableLayer2
    nextreg NR_LAYER2_ACTIVE,8
    nextreg NR_LAYER2_SHADOW,11
    nextreg NR_PALETTE_CTRL,PAL_LAYER2_FIRST
    nextreg NR_CLIP_CTRL,%00000001
    nextreg NR_CLIP_L2,0
    nextreg NR_CLIP_L2,255
    nextreg NR_CLIP_L2,0
    nextreg NR_CLIP_L2,191
    ret

@RestoreAfterLayer2
    call @DisableLayer2
    call @RestoreDefaultLayer2Palette
    Display.ClearScreen()
    Display.PrintTitle(@Title_Done)
    Display.PrintText(@Text_Done)
    ret

@RestoreDefaultLayer2Palette
    ; The reset palette is a useful RGB332 ramp.
    jp @LoadLinearLayer2Palette

@ClearUlaBehind
    ld hl,$4000
    ld de,$4001
    ld bc,6143
    xor a
    ld (hl),a
    ldir

    ld hl,$5800
    ld de,$5801
    ld bc,767
    ld (hl),0
    ldir
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

@Title_Done
    .defn "Layer 2 restored"

@Text_Done
    .defn "Layer 2 is off again.\x0d"

.endmodule

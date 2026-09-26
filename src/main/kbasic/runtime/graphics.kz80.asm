; @module   graphics
; @summary  PLOT, DRAW (straight lines) and CIRCLE: Klive's own pixel routines.
; @exports  Plot, DrawLine, Circle
; @requires print, errors
;
; The screen is 256 x 192 pixels with (0,0) at the bottom left; all 192 rows are usable (the ROM
; keeps the bottom 16 for its editor). A pixel follows the current colours: OVER flips it, INVERSE
; clears it, both leave it alone; its cell takes the colours as PRINT gives them (PrintApplyAttr).
; COORDS ($5C7D x, $5C7E y) is the last point plotted: DRAW starts there. A point off the screen
; stops the program with "B Integer out of range", as the ROM's statements do.

; ------------------------------------------------------------------------------------------------
; PLOT: C = x, B = y. Changes AF, BC, DE, HL.
Plot:
    ld a,b
    cp 192
    jr nc,GraphicsRange
    ld ($5c7d),bc           ; COORDS
    call PixelAddr          ; HL = the byte, A = the pixel's bit
    ld d,a
    ld a,(PrintFlags)
    ld e,a
    bit 1,e
    jr z,PlotNotInverse
    bit 0,e
    jr nz,PlotAttr          ; INVERSE and OVER: the pixel stays as it is
    ld a,d
    cpl
    and (hl)
    jr PlotStore
PlotNotInverse:
    ld a,d
    bit 0,e
    jr z,PlotSet
    xor (hl)
    jr PlotStore
PlotSet:
    or (hl)
PlotStore:
    ld (hl),a
PlotAttr:
    ld a,h                  ; the pixel byte's attribute: $5800 + (the third) * 256 + L
    rrca
    rrca
    rrca
    and $03
    or $58
    ld h,a
    jp PrintApplyAttr

GraphicsRange:
    ld a,10                 ; "B Integer out of range"
    jp RaiseError

; HL = the screen byte of pixel (C, B), y counted from the bottom (0-191); A = its bit. Keeps BC.
; Changes F, DE.
PixelAddr:
    ld a,191
    sub b
    ld d,a                  ; D = the row from the top: r7 r6 r5 r4 r3 r2 r1 r0
    and $07
    ld h,a
    ld a,d
    and $c0
    rrca
    rrca
    rrca
    or h
    or $40
    ld h,a                  ; H = 0 1 0 r7 r6 r2 r1 r0
    ld a,d
    and $38
    rlca
    rlca
    ld l,a
    ld a,c
    rrca
    rrca
    rrca
    and $1f
    or l
    ld l,a                  ; L = r5 r4 r3 x7 x6 x5 x4 x3
    ld a,c
    and $07
    ld e,a
    ld a,$80
    ret z
PixelMask:
    rrca
    dec e
    jr nz,PixelMask
    ret

; ------------------------------------------------------------------------------------------------
; DRAW dx, dy: a straight line from COORDS to COORDS + (DE, HL), every point but the first plotted
; (Bresenham). The end point is checked before anything is drawn. Changes AF, BC, DE, HL.
DrawLine:
    ld (DrawDx),de
    ld (DrawDy),hl
    ld a,($5c7e)
    ld c,a
    ld b,0
    add hl,bc               ; HL = the end's y
    ld a,h
    or a
    jr nz,GraphicsRange
    ld a,l
    cp 192
    jr nc,GraphicsRange
    ld a,($5c7d)
    ld l,a
    ld h,0
    add hl,de               ; HL = the end's x
    ld a,h
    or a
    jr nz,GraphicsRange
    ld hl,(DrawDx)
    call DrawAbs
    ld (DrawAx),a
    ld a,b
    ld (DrawSx),a
    ld hl,(DrawDy)
    call DrawAbs
    ld (DrawAy),a
    ld a,b
    ld (DrawSy),a
    ld bc,($5c7d)           ; C = x, B = y
    ld a,(DrawAy)
    ld d,a
    ld a,(DrawAx)
    cp d
    jr c,DrawSteep
    ; --- |dx| >= |dy|: a step in x every time, in y when the error runs out
    or a
    ret z
    ld (DrawCount),a
    srl a
    ld l,a
    ld h,0
    ld (DrawErr),hl
DrawShallow:
    ld a,(DrawSx)
    add a,c
    ld c,a
    ld hl,(DrawErr)
    ld a,(DrawAy)
    ld e,a
    ld d,0
    or a
    sbc hl,de
    bit 7,h
    jr z,DrawShallowPlot
    ld a,(DrawSy)
    add a,b
    ld b,a
    ld a,(DrawAx)
    ld e,a
    add hl,de
DrawShallowPlot:
    ld (DrawErr),hl
    push bc
    call Plot
    pop bc
    ld hl,DrawCount
    dec (hl)
    jr nz,DrawShallow
    ret
DrawSteep:                  ; |dy| > |dx|: a step in y every time
    ld a,d
    ld (DrawCount),a
    srl a
    ld l,a
    ld h,0
    ld (DrawErr),hl
DrawSteepLoop:
    ld a,(DrawSy)
    add a,b
    ld b,a
    ld hl,(DrawErr)
    ld a,(DrawAx)
    ld e,a
    ld d,0
    or a
    sbc hl,de
    bit 7,h
    jr z,DrawSteepPlot
    ld a,(DrawSx)
    add a,c
    ld c,a
    ld a,(DrawAy)
    ld e,a
    add hl,de
DrawSteepPlot:
    ld (DrawErr),hl
    push bc
    call Plot
    pop bc
    ld hl,DrawCount
    dec (hl)
    jr nz,DrawSteepLoop
    ret

; A = |HL| (at most 255 here), B = the step: 1, $FF (-1) or 0. Changes F.
DrawAbs:
    ld b,0
    ld a,h
    or l
    ret z
    ld b,1
    ld a,l
    bit 7,h
    ret z
    ld b,$ff
    neg
    ret

DrawDx:
    .defw 0
DrawDy:
    .defw 0
DrawAx:
    .defb 0
DrawAy:
    .defb 0
DrawSx:
    .defb 0
DrawSy:
    .defb 0
DrawErr:
    .defw 0
DrawCount:
    .defb 0

; ------------------------------------------------------------------------------------------------
; CIRCLE: D = the centre's x, E = its y, C = the radius (all 0-255). The midpoint method, every
; point plotted once, so that OVER 1 leaves no gaps. Changes AF, BC, DE, HL.
Circle:
    ld a,c
    ld (CircleR),a
    ld a,d
    ld (CircleCx),a
    ld a,e
    ld (CircleCy),a
    ld a,(CircleR)
    ld (CircleX),a
    xor a
    ld (CircleY),a
    ld a,(CircleR)
    ld e,a
    ld d,0
    ld hl,1
    or a
    sbc hl,de
    ld (CircleErr),hl       ; err = 1 - r
CircleLoop:
    ld a,(CircleY)
    ld b,a
    ld a,(CircleX)
    cp b
    ret c                   ; x < y: the octant is done
    ld (CircleA),a
    ld a,b
    ld (CircleB),a
    call CirclePlot4        ; (±x, ±y)
    ld a,(CircleX)
    ld b,a
    ld a,(CircleY)
    cp b
    jr z,CircleStep         ; x = y: (±y, ±x) are the same points
    ld (CircleA),a
    ld a,b
    ld (CircleB),a
    call CirclePlot4        ; (±y, ±x)
CircleStep:
    ld a,(CircleX)
    or a
    ret z                   ; radius 0: the centre alone
    ld hl,CircleY
    inc (hl)
    ld hl,(CircleErr)
    ld a,(CircleY)
    ld e,a
    ld d,0
    bit 7,h
    jr z,CircleInward
    add hl,de               ; err += 2y + 1
    add hl,de
    inc hl
    ld (CircleErr),hl
    jr CircleLoop
CircleInward:
    ld a,(CircleX)          ; x -= 1; err += 2(y - x) + 1
    dec a
    ld (CircleX),a
    add hl,de
    add hl,de
    ld e,a
    or a
    sbc hl,de
    or a
    sbc hl,de
    inc hl
    ld (CircleErr),hl
    jr CircleLoop

; Plots (cx ± a, cy ± b) for CircleA = a, CircleB = b, each distinct point once.
CirclePlot4:
    ld c,0
    call CirclePlotSigned   ; (+a, +b)
    ld a,(CircleA)
    or a
    jr z,CirclePlot4Lower
    ld c,1
    call CirclePlotSigned   ; (-a, +b)
CirclePlot4Lower:
    ld a,(CircleB)
    or a
    ret z
    ld c,2
    call CirclePlotSigned   ; (+a, -b)
    ld a,(CircleA)
    or a
    ret z
    ld c,3                  ; (-a, -b)
CirclePlotSigned:           ; C: bit 0 subtracts a, bit 1 subtracts b
    ld a,(CircleCx)
    ld l,a
    ld h,0
    ld a,(CircleA)
    ld e,a
    ld d,0
    bit 0,c
    jr nz,CircleLeft
    add hl,de
    jr CircleXDone
CircleLeft:
    or a
    sbc hl,de
CircleXDone:
    ld a,h
    or a
    jp nz,GraphicsRange
    ld a,l
    ld (CirclePx),a
    ld a,(CircleCy)
    ld l,a
    ld h,0
    ld a,(CircleB)
    ld e,a
    bit 1,c
    jr nz,CircleDown
    add hl,de
    jr CircleYDone
CircleDown:
    or a
    sbc hl,de
CircleYDone:
    ld a,h
    or a
    jp nz,GraphicsRange
    ld b,l
    ld a,(CirclePx)
    ld c,a
    jp Plot

CircleR:
    .defb 0
CircleCx:
    .defb 0
CircleCy:
    .defb 0
CircleX:
    .defb 0
CircleY:
    .defb 0
CircleA:
    .defb 0
CircleB:
    .defb 0
CirclePx:
    .defb 0
CircleErr:
    .defw 0

.module PaletteDemo

ULA_PORT        .equ $fe

SCREEN_PIXELS   .equ $4000
SCREEN_ATTRS    .equ $5800

NR_PALETTE_INDEX .equ $40
NR_PALETTE_VALUE .equ $41
NR_PALETTE_9BIT  .equ $44
NR_PALETTE_CTRL  .equ $43

PAL_ULA_FIRST   .equ %00000000
PAL_ULA_SECOND  .equ %00010000
PAL_USE_ULA_2ND .equ %00000010

ATTR_BLACK_ON_WHITE .equ attr(Color.Black, Color.White)

;==========================================================
; Animate the standard ULA PAPER colours by changing palette entries
;==========================================================
UlaPaperCycle
    call @ResetPaletteState
    call @ClearScreenMemory

    Display.PrintTitle(@Title_Cycle)
    Display.PrintText(@Instr_Cycle)
    call @PaintPaperBands
    call @LoadDefaultUlaFirst

    xor a
    ld (@CycleOffset),a
    ei
`loop
    halt
    call @RotatePaperPalette
    ld a,$7f                    ; Space exits
    in a,(ULA_PORT)
    bit 0,a
    jr nz,`loop

    call @RestoreDefaultPalettes
    ret

;==========================================================
; Load two ULA palettes and switch between them instantly
;==========================================================
UlaPaletteSwap
    call @ResetPaletteState
    call @ClearScreenMemory

    Display.PrintTitle(@Title_Swap)
    Display.PrintText(@Instr_Swap)
    call @PaintPaperBands
    call @LoadSwapPalettes

    call @WaitSpace
    nextreg NR_PALETTE_CTRL,PAL_USE_ULA_2ND

    call @WaitSpace
    nextreg NR_PALETTE_CTRL,PAL_ULA_FIRST

    call @WaitSpace
    call @RestoreDefaultPalettes
    ret

;----------------------------------------------------------
; Screen setup helpers
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

@PaintPaperBands
    ; Paint eight horizontal bands. The bitmap is clear, so PAPER is visible.
    ld hl,SCREEN_ATTRS + 8 * 32
    ld d,0
`band
    ld a,d
    rlca
    rlca
    rlca
    ld c,a                      ; PAPER = band number
    ld b,2
`row
    push bc
    push hl
    ld b,24
`col
    ld (hl),c
    inc hl
    djnz `col
    pop hl
    add hl,32
    pop bc
    djnz `row
    inc d
    ld a,d
    cp 8
    jr nz,`band
    ret

;----------------------------------------------------------
; Palette loading helpers
;----------------------------------------------------------
@ResetPaletteState
    nextreg NR_PALETTE_CTRL,PAL_ULA_FIRST
    ret

@LoadDefaultUlaFirst
    nextreg NR_PALETTE_CTRL,PAL_ULA_FIRST
    ld hl,@DefaultUla32
    jp @LoadUla32

@RestoreDefaultPalettes
    nextreg NR_PALETTE_CTRL,PAL_ULA_FIRST
    ld hl,@DefaultUla32
    call @LoadUla32

    nextreg NR_PALETTE_CTRL,PAL_ULA_SECOND
    ld hl,@DefaultUla32
    call @LoadUla32

    nextreg NR_PALETTE_CTRL,PAL_ULA_FIRST
    ret

@LoadSwapPalettes
    nextreg NR_PALETTE_CTRL,PAL_ULA_FIRST
    ld hl,@WarmUla32
    call @LoadUla32

    nextreg NR_PALETTE_CTRL,PAL_ULA_SECOND
    ld hl,@CoolUla32
    call @LoadUla32

    nextreg NR_PALETTE_CTRL,PAL_ULA_FIRST
    ret

@LoadUla32
    ; IN: HL = 32 RRRGGGBB bytes for ULA entries 0..31
    nextreg NR_PALETTE_INDEX,0
    ld b,32
`loop
    ld a,(hl)
    nextreg NR_PALETTE_VALUE,a
    inc hl
    djnz `loop
    ret

@RotatePaperPalette
    ; Rotate standard ULA PAPER entries 16..23.
    nextreg NR_PALETTE_CTRL,PAL_ULA_FIRST
    nextreg NR_PALETTE_INDEX,16

    ld a,(@CycleOffset)
    inc a
    and $0f
    ld (@CycleOffset),a
    ld e,a
    ld b,8
`loop
    push bc
    ld a,e
    and $0f
    ld c,a
    ld b,0
    ld hl,@CycleColours
    add hl,bc
    ld a,(hl)
    nextreg NR_PALETTE_VALUE,a
    inc e
    pop bc
    djnz `loop
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
; Palette data and strings
;----------------------------------------------------------
@CycleOffset
    .db 0

@DefaultUla32
    ; Normal INK, bright INK, normal PAPER, bright PAPER.
    .db $00,$02,$a0,$a2,$14,$16,$b4,$b6
    .db $00,$03,$e0,$e3,$1c,$1f,$fc,$ff
    .db $00,$02,$a0,$a2,$14,$16,$b4,$b6
    .db $00,$03,$e0,$e3,$1c,$1f,$fc,$ff

@WarmUla32
    .db $00,$02,$a0,$a2,$14,$16,$b4,$b6
    .db $00,$03,$e0,$e3,$1c,$1f,$fc,$ff
    .db $20,$60,$a0,$e0,$e8,$f0,$f8,$ff
    .db $20,$60,$a0,$e0,$e8,$f0,$f8,$ff

@CoolUla32
    .db $00,$02,$a0,$a2,$14,$16,$b4,$b6
    .db $00,$03,$e0,$e3,$1c,$1f,$fc,$ff
    .db $01,$03,$07,$0b,$0f,$17,$1f,$7f
    .db $01,$03,$07,$0b,$0f,$17,$1f,$7f

@CycleColours
    .db $e0,$e8,$f0,$f8,$fc,$bc,$7c,$3c
    .db $1c,$1f,$17,$0f,$07,$03,$43,$83

@Title_Cycle
    .defn "Palette #1: ULA cycle"

@Instr_Cycle
    .defm "The screen memory stays fixed.\x0d"
    .defm "Only ULA PAPER palette entries\x0d"
    .defn "16..23 change. Space exits.\x0d\x0d"

@Title_Swap
    .defn "Palette #2: ULA swap"

@Instr_Swap
    .defm "First and second ULA palettes\x0d"
    .defm "are preloaded. Press Space to\x0d"
    .defn "swap, Space again, then exit.\x0d\x0d"

.endmodule

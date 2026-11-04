; (C): copyright 2022 Peter Ped Helcmanovsky, license: MIT
; name: custom ZX Spectrum ROM to measure time until first /INT signal
; public gist somewhere at: https://gist.github.com/ped7g (search for it)
;
; to assemble (with z00m's sjasmplus https://github.com/z00m128/sjasmplus/ v1.20.1+)
; run: sjasmplus rom_first_int.asm
;
; history: 2022-08-23: v1.0 - initial version
;
; purpose:
;   measures time since power-on until first /INT signal
;   the measurable interval is 24 .. 1,048,584 T-states (with 16T granularity)
;   if the /INT happens sooner/later in the HW, the result wraps around into the expected range
;   the wrap around or earlier /INT is not detected,
;   so printed result is K*1048576 incorrect (K = -1,0,1,..+inf) (correct for K == 0)
;
;     DEFINE BUILD_DEBUG_NEX_FILE

    OPT --syntax=abf
    DEVICE ZXSPECTRUMNEXT
    MMU 0 1, 0, $0000   ; page 0+1 (bank 0 mapped to $C000 by default)
rst00:
    ; measure the time-diff since power-on until first /INT
    di
    im      1
    ld      e,l         ; DE = original HL
    ei                  ; enable interrupts after `ld d,h`
    ld      d,h
    ; 4+8+4+4+4 = 24T init before first /INT can be detected
.time_loop:
    inc     hl          ; 6 + 10 = 16 T main loop
    jp      rst00.time_loop     ; rst08 is like: ld b,0 : jp rst00.time_loop
    jp      rst00.time_loop
    jp      rst00.time_loop
rst10:  ASSERT $ == $10
    jp      rst00.time_loop
    jp      rst00.time_loop
    jr      rst00.time_loop
rst18:  ASSERT $ == $18
    jp      rst00.time_loop
    jp      rst00.time_loop
    jr      rst00.time_loop
rst20:  ASSERT $ == $20
    jp      rst00.time_loop
    jp      rst00.time_loop
    jr      rst00.time_loop
rst28:  ASSERT $ == $28
    jp      rst00.time_loop
    jp      rst00.time_loop
    jr      rst00.time_loop
rst30:  ASSERT $ == $30
    jp      rst00.time_loop
    jp      rst00.time_loop
    jr      rst00.time_loop
    ; IM1 interrupt handler, printing results of measurement
rst38:  ASSERT $ == $38
    di                          ; useless on real HW, but I need this for easy debug in CSpect
    or      a
    sbc     hl,de               ; HL = number of HL increments until first /INT
    ex      de,hl
    ld      iy,de               ; fake ; IY = preserve number of increments
    ; clear VRAM, setup stack
    ld      hl,$4000
    ld      de,$4001
    ld      bc,$1B00-1
    ld      (hl),l
    ldir
    ; set top third of VRAM with visible attributes
    ld      hl,$5800
    ld      sp,hl               ; set stack to bottom third of VRAM pixel data
    ld      de,$5801
    ld      c,$FF
    ld      (hl),%01'011'111    ; BRIGHT 1 : PAPER 3 : INK 7
    ldir
    ; print result
    ld      hl,txt_author
    ld      de,$40A1
    call    OutStringAtDe
    ; ld      hl,txt_welcome    ; HL already points there
    ld      de,$4021
    call    OutStringAtDe
    ; ld      hl,txt_result     ; HL already points there
    ld      de,$4061
    call    OutStringAtDe
    inc     e
    ; prepare value to print: IY * 16 + 24
    xor     a
    add     iy,iy
    adc     a,a
    add     iy,iy
    adc     a,a
    add     iy,iy
    adc     a,a
    add     iy,iy
    adc     a,a                 ; A:IY = increments * 16
    ld      bc,24
    add     iy,bc
    adc     a,0
    ld      ixl,a               ; IXL:IY = increments * 16 + 24
    call    Print24bIXLIY       ; print decimal 24b IXL:IY (expected values: 24..1,048,584)
    ; print expected range of result
    ld      de,$406C
    ld      hl,txt_expected
    call    OutStringAtDe

    ; keep stuck here forever
    jr      $

Print24bIXLIY:                  ; prints 24b positive integer (must be non-zero! zero prints nothing)
    ld      hl,tab_decimals
    ld      b,0                 ; all-zero digits so far
.pow10_loop:
    ld      a,(hl)
    or      a
    ret     z                   ; all printed
    ld      c,-1
    ; do { ++C, IXL:IY -= *HL } while (IXL:IY >= 0)
.divide_loop:
    inc     c
    ld      a,iyl
    add     a,(hl)
    ld      iyl,a
    inc     hl
    ld      a,iyh
    adc     a,(hl)
    ld      iyh,a
    inc     hl
    ld      a,ixl
    adc     a,(hl)
    ld      ixl,a
    dec     hl
    dec     hl
    jr      c,.divide_loop
    ; undo the last extra subtraction to restore IXL:IY, and HL += 3 to point to next decimal power
    ld      a,iyl
    sub     (hl)
    ld      iyl,a
    inc     hl
    ld      a,iyh
    sbc     a,(hl)
    ld      iyh,a
    inc     hl
    ld      a,ixl
    sbc     a,(hl)
    ld      ixl,a
    inc     hl
    ; print the digit, if it is not leading zero
    ld      a,b
    or      c
    ld      b,a
    ld      a,c
    call    nz,OutDigit
    jr      .pow10_loop

tab_decimals:
    D24     -10000000,-1000000,-100000,-10000,-1000,-100,-10,-1
    DB      0

; A = ASCII char (0..127), will calculate into HL address of char data ($0900 for space)
GetRomAddressOfChar:
    ASSERT 0 == low(font_data/8)
    ld      h,high(font_data/8)
    ld      l,a     ; hl = $100+A
    add     hl,hl
    add     hl,hl
    add     hl,hl   ; hl *= 8
    ret
.returnFullSquareForBellCharacter:
    ret
.FakeFullSquare:
    db      $FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF

; A = 0..9 to output, output is done by XOR (!) mode, to DE cell
OutDigit:
    or      '0'
; A = ASCII char to output, output is done by XOR (!) mode, to DE cell
OutChar:
    push    af
    push    hl
    push    de
    call    GetRomAddressOfChar     ; HL = font data
    ; output char to the VRAM
.CharLoop:
    ld      a,(de)
    xor     (hl)
    ld      (de),a
    inc     l
    inc     d
    bit     3,d
    jr      z,.CharLoop
    pop     de
    pop     hl
    pop     af
    ; increment char position by one to right
    inc     e
    ret

; output zero terminated string from HL address into VRAM at DE (HL points after zero)
; modifies: AF, HL, DE
OutStringAtDe:
    ld      a,(hl)
    inc     hl
    or      a
    ret     z
    call    OutChar
    jr      OutStringAtDe

        ;   |12345678901234567890123456789012| 32 char width
txt_author:
    DB       "2022-08-23 Ped / 7 Gods / src: "
    DZ      " https://gist.github.com/ped7g"
txt_welcome:
    DZ       "Test ROM - Time to first /INT:"
txt_result:
    DZ       "T:"
txt_expected:
    DZ      "+-16T (24..1048584)"

    ASSERT $ <= $800

    ORG     $800
font_data:
    DS      7 * 8, $18              ; middle-stripe for 0..6
    HEX     FF FF FF FF FF FF FF FF ; bell (7) as full square
    ; insert credit for font data directly into ROM in text-readable way
    DB      0,0,0," !!! font by DamienG from: https://damieng.com/typography/zx-origins/proforma/ !!! ",0,0,0
    DS      font_data + ' ' * 8 - $, $18    ; middle-stripe for remaining chars
    INCBIN  "Proforma.ch8"          ; DamienG font data from space char

    ; fill remaining ROM space with $FF
    DS      $4000-$, $FF
    ASSERT $4000 == $

    ; save the ROM binary
    SAVEBIN "1stint.rom",0,$

; -------------------- DEBUG .nex file for ZX Spectrum Next to debug the code in emulator ---------------
    IFDEF BUILD_DEBUG_NEX_FILE
    ORG     $8000
initmm0:
    nextreg $7,0
    nextreg $50,$$rst00
    nextreg $51,$$rst00 + 1
    jp      rst00

    SAVENEX OPEN "1stint.nex",initmm0,$9FF0
    SAVENEX AUTO
    SAVENEX CLOSE

    ENDIF

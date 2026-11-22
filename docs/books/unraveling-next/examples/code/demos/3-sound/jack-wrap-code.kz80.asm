; Code of Jack Wrap (jack-wrap.kz80.asm), kept at the start of bank 27, page 54, which CallBank pages in
; at $C000. Banked code: main.kz80.asm includes this file after all unbanked code.

    .bank 27                ; pages 54 and 55

JwStart:                    ; $C000, where CallBank calls
    ld de,$0000
    ld c,$78
    ld hl,JackWrapTitle
    call PrintText
    ld de,$0200             ; rows 2-11: the texts, one after the other
    ld c,$38
    ld hl,JwText1
JwIntro:
    call PrintText          ; leaves HL on the text's end
    inc hl
    inc d
    ld e,0
    ld a,(hl)
    or a                    ; the list ends with an empty text
    jr nz,JwIntro
    call ShowMenuFooter

    ReadNextReg($08)
    ld (JwOld08),a
    or %00001010            ; the DACs on, and TurboSound: the chip selects count
    and %11011111           ; ABC
    nextreg $08,a
    ReadNextReg($84)
    ld (JwOld84),a
    or %11000000            ; ports $B3 (B and C) and $DF (A and D) on
    nextreg $84,a
    nextreg $07,0           ; 3.5 MHz: the loop's pitch is set by T-states
    ld a,$FD                ; the three chips, both sides: all at full volume, tones and noise off
    call JwChip
    ld a,$FE
    call JwChip
    ld a,$FF
    call JwChip

    xor a
    ld (JwEar),a            ; quiet: EAR low
    call JwShowState
    call WaitNoKey          ; the menu's key may still be down
    di

JwPeriod:
    ld hl,JwSine
    ld b,16
    ld a,(JwEar)
    ld d,a                  ; EAR's level: port $FE bit 4
JwStep:
    ld a,(hl)
    out ($DF),a             ; channels A and D
    out ($B3),a             ; channels B and C
    ld a,d
    out ($FE),a
    inc hl
    ld c,9
JwDelay:
    dec c
    jr nz,JwDelay
    djnz JwStep
    call ScanKeys           ; once a period: the same few T-states every time
    cp $FF
    jr z,JwPeriod
    ld hl,KeyChars
    add hl,a
    ld a,(hl)
    cp $31                  ; "1"
    jr z,JwLoud
    cp $32                  ; "2"
    jr nz,JwDone
    xor a                   ; EAR low
    jr JwSet
JwLoud:
    ld a,$10                ; EAR high
JwSet:
    ld hl,JwEar
    cp (hl)
    jr z,JwPeriod           ; no change: nothing to redraw
    ld (hl),a
    call JwShowState
    jr JwPeriod

JwDone:
    call SilenceSound       ; the AY chips silent, the DAC channels at rest
    xor a
    out ($FE),a             ; EAR low
    ld a,(JwOld84)
    nextreg $84,a
    ld a,(JwOld08)
    nextreg $08,a
    nextreg $07,3
    ei
    jp WaitNoKey

; Selects the chip whose select value is in A and sets its three channels to volume 15
JwChip:
    ld bc,$FFFD
    out (c),a
    ld hl,JwAyRegs
    jp AyWriteList

; Prints which state is playing on row 13
JwShowState:
    ld de,$0D00
    ld c,$38
    ld hl,JwQuietText
    ld a,(JwEar)
    or a
    jr z,JwPrint
    ld hl,JwLoudText
    ld c,$3A                ; INK 2: red
JwPrint:
    jp PrintText

JwAyRegs:
    .defb 7, $3F            ; tones and noise off: every channel holds its volume
    .defb 8, 15, 9, 15, 10, 15
    .defb $FF
; One period of a sine, 0 to 255
JwSine:
    .defb 128, 176, 218, 245, 255, 245, 218, 176, 128, 79, 37, 10, 0, 10, 37, 79
JwEar:
    .defb 0
JwOld08:
    .defb 0
JwOld84:
    .defb 0
JwQuietText:
    .defn "Now: beeper off, jack clean"
JwLoudText:
    .defn "Now: beeper on, jack wraps "
JwText1:
    .defn "Three AY chips at full volume"
    .defn "and a 1 kHz DAC sine on top."
    .defn " "
    .defn "1: beeper bit on, sum to 4,594"
    .defn "2: beeper bit off, sum to 4,082"
    .defn " "
    .defn "The jack wraps above 4,095."
    .defn "Machine > Sound > Output:"
    .defn "switch to HDMI to hear the"
    .defn "same sum, never wrapped."
    .defb 0

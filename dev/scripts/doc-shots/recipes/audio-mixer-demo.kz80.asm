; The audio mixer's demo for the 128K (`guides-audio-mixer.cjs`): AY channel A a steady tone, B noise,
; C a tone shaped by the envelope, and the beeper toggling EAR at about 1.4 kHz, forever.
; Assembled at $8000 into PROGRAM in the recipe: re-assemble it after changing this file.
        .org $8000
        di
        ld hl,AyRegs
        ld d,0
AyLoop: ld bc,$fffd
        out (c),d
        ld a,(hl)
        ld b,$bf
        out (c),a
        inc hl
        inc d
        ld a,d
        cp 14
        jr nz,AyLoop
Beep:   ld a,$10
        out ($fe),a
        ld b,$60
Hi:     djnz Hi
        xor a
        out ($fe),a
        ld b,$60
Lo:     djnz Lo
        jr Beep
; R0-R13: A period $140, B unused, C period $028, noise $1F, mixer: tone A and C, noise B;
; volumes A $0F, B $0C, C the envelope; envelope period $0400 (a triangle of about 3.5 Hz), shape $0E
AyRegs: .defb $40, $01, $00, $00, $28, $00, $1f, $2a, $0f, $0c, $10, $00, $04, $0e

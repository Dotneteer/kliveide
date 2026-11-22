; Demo: Jack Wrap
; Chapter: The Mixer (content/next-audio/mixer.mdx), "Headroom"
;
; Builds a sum that the audio jack cannot hold, and lets you turn the overload on and off with one
; silent bit. All three AY chips sit at full volume with their tones off, a constant 3 x 510 = 1,530
; on a side; a 1 kHz sine of 16 steps swings all four DAC channels from 0 to 255, 2,040 units; the
; Pi, switched off, rests at 512. Key 2 leaves the beeper bit (EAR)
; low: the sum peaks at 4,082, and the jack plays it clean. Key 1 sets EAR, a constant 512 you
; cannot hear: the sum peaks at 4,594, and the jack, which takes only the lowest 12 bits, wraps the
; top of every wave round to the bottom: a crackle. HDMI carries all 13 bits and never wraps:
; switch Machine > Sound > Output to HDMI in Klive IDE, and both keys sound the same.
; The code is at the start of bank 27 (jack-wrap-code.kz80.asm). At 3.5 MHz, interrupts off while it
; plays. Changes NextRegs $07, $08 (DACs, TurboSound, ABC), $84 (ports $B3 and $DF), the AY chips,
; the DAC channels and port $FE; puts them back.

JackWrapTitle:
    .defn "Jack Wrap"

JackWrapBank: .equ 27

JackWrap:
    ld a,JackWrapBank
    jp CallBank

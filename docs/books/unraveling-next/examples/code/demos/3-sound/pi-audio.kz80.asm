; Demo: Pi Audio
; Chapter: Audio from the Raspberry Pi (content/next-audio/pi-audio.mdx), "One register: NextReg $A2"
; and "Reading the Pi's samples"
;
; Switches the Pi's I2S link on, both words to the mixer (NextReg $A2 = $C2), and reads the words it
; brings through NextRegs $2C (left) and $2E (right): 500 reads a time, the lowest and the highest
; value seen, and a bar as wide as the difference. With nothing connected both read $80, the rest
; word, and the bars are empty, and nothing is heard: the demo only listens. In Klive IDE,
; `pi-audio -tone 440` plays a sine into the link.
; At 3.5 MHz, so that the 500 reads span a few milliseconds whatever the machine's speed.
; Changes NextRegs $07 and $A2; puts $07 back and switches the link off again, as it is after a
; reset. Never touches $A0, the Pi's peripheral enable.

PiAudioTitle:
    .defn "Pi Audio"

; The code is at the start of bank 26 (pi-audio-code.kz80.asm), which CallBank pages in at $C000
PiAudioBank: .equ 26

PiAudio:
    ld a,PiAudioBank
    jp CallBank

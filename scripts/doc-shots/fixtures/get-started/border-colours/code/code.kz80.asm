; Border colours - the program of Get Started, steps 5 and 6.
; It shows the eight border colours, half a second each, forever.

        .model Spectrum48
        .org #8000

Start:
        ei              ; HALT needs interrupts to wake up
        ld b,8          ; eight colours: 7 (white) down to 0 (black)
NextColour:
        ld a,b
        dec a           ; B is 8..1, the colour is 7..0
        out (#fe),a     ; the border colour is bits 0-2 of port #FE
        ld e,25         ; wait 25 frames (half a second)
Wait:
        halt            ; wait for the next frame
        dec e
        jr nz,Wait
        djnz NextColour
        jr Start

; A sprite on the ZX Spectrum Next - the program of Get Started, step 8.
; It uploads one 16x16 sprite pattern and moves the sprite across the screen.

        .model Next
        .org #8000
        .savenex file "NextSprites.nex"   ; the name of the .nex file Klive builds

SPRITE_SLOT  .equ #303b     ; selects the sprite (and pattern) to write
SPRITE_ATTR  .equ #57       ; writes the selected sprite's attributes
SPRITE_PATT  .equ #5b       ; writes the selected pattern's bytes

Start:
        ei
        nextreg #15,%00000001       ; show sprites (on top of the other layers)

        ; Upload pattern 0: 256 bytes, one per pixel
        ld bc,SPRITE_SLOT
        xor a
        out (c),a                   ; pattern 0
        ld hl,Ball
        ld bc,SPRITE_PATT           ; B = 0, so OTIR sends 256 bytes
        otir

        ld d,32                     ; D is the sprite's X coordinate
Move:
        ld bc,SPRITE_SLOT
        xor a
        out (c),a                   ; select sprite 0
        ld a,d
        out (SPRITE_ATTR),a         ; attribute 0: X (low 8 bits)
        ld a,120
        out (SPRITE_ATTR),a         ; attribute 1: Y
        xor a
        out (SPRITE_ATTR),a         ; attribute 2: no palette offset, mirror or rotation
        ld a,%10000000
        out (SPRITE_ATTR),a         ; attribute 3: visible, pattern 0
        halt                        ; one step per frame
        inc d
        jr Move

; The ball: $E3 is the transparent colour, $E0 red, $FF white
Ball:
        .defb $E3,$E3,$E3,$E3,$E3,$E3,$E3,$E0,$E0,$E3,$E3,$E3,$E3,$E3,$E3,$E3
        .defb $E3,$E3,$E3,$E3,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E3,$E3,$E3,$E3
        .defb $E3,$E3,$E3,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E3,$E3,$E3
        .defb $E3,$E3,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E3,$E3
        .defb $E3,$E0,$E0,$E0,$FF,$FF,$FF,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E3
        .defb $E3,$E0,$E0,$E0,$FF,$FF,$FF,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E3
        .defb $E3,$E0,$E0,$E0,$FF,$FF,$FF,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E3
        .defb $E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0
        .defb $E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0
        .defb $E3,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E3
        .defb $E3,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E3
        .defb $E3,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E3
        .defb $E3,$E3,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E3,$E3
        .defb $E3,$E3,$E3,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E3,$E3,$E3
        .defb $E3,$E3,$E3,$E3,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E0,$E3,$E3,$E3,$E3
        .defb $E3,$E3,$E3,$E3,$E3,$E3,$E3,$E0,$E0,$E3,$E3,$E3,$E3,$E3,$E3,$E3

; Welcome to Klive IDE on the ZX Spectrum Next.
;
; With .model next, Klive builds this program into a .nex file; Run and Debug export it and
; NextZXOS starts it with .nexload. A .nex program has nowhere to return to, so it ends in a loop.

    .model next

Start:
    nextreg $07,3         ; run the CPU at 28 MHz
    call ClearScreen
    ld de,$0A06           ; row 10, column 6
    ld c,$20              ; PAPER 4, INK 0
    ld hl,Welcome
    call PrintText
    ld de,$0B07           ; row 11, column 7
    ld c,$60              ; BRIGHT 1, PAPER 4, INK 0
    ld hl,Machine
    call PrintText
Trap:
    jr Trap               ; stay here: there is no system to return to

; Clears the ULA screen: no pixels, PAPER 7 and INK 0 everywhere
ClearScreen:
    ld hl,$4000
    ld de,$4001
    ld bc,$1800
    ld (hl),0
    ldir                  ; the pixels; HL is $5800 now
    ld (hl),$38
    ld bc,$02FF
    ldir                  ; the attributes
    ret

; Prints the zero-terminated text at HL from row D, column E with the attribute in C
PrintText:
    ld a,(hl)
    or a
    ret z
    push hl
    call PrintChar
    pop hl
    inc hl
    inc e
    jr PrintText

; Prints the character in A at row D, column E with the attribute in C, using the font of the
; ROM that .nexload leaves paged in. Keeps C, D and E.
PrintChar:
    push de
    ld l,a
    ld h,0
    add hl,hl
    add hl,hl
    add hl,hl
    add hl,$3C00          ; the character's 8 bytes: $3D00 + (A - 32) * 8
    push hl
    ld a,d
    add a,a
    add a,a
    add a,a
    ld d,a                ; the pixel row: row * 8
    ld a,e
    add a,a
    add a,a
    add a,a
    ld e,a                ; the pixel column: column * 8
    pixelad               ; HL: the screen byte of pixel (E, D)
    pop de                ; DE: the character's bytes
    ld b,8
PrintLine:
    ld a,(de)
    ld (hl),a
    inc de
    pixeldn               ; HL: the same byte one pixel line down
    djnz PrintLine
    pop de
    ld l,d
    ld h,0
    add hl,hl
    add hl,hl
    add hl,hl
    add hl,hl
    add hl,hl             ; row * 32
    ld a,e
    add hl,a              ; + column
    add hl,$5800
    ld (hl),c             ; the character's attribute
    ret

Welcome:
    .defn "Welcome to Klive IDE"
Machine:
    .defn "(ZX Spectrum Next)"

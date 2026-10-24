; Guides debugging demo: paints the top attribute row in stripes, again and again
    .model Spectrum48
    .org #8000
Start:
    ld hl,#5800         ; the first attribute byte
    ld b,32             ; 32 columns
Fill:
    ld a,b
    and 7
    rlca
    rlca
    rlca                ; the paper colour
    ld (hl),a
    inc hl
    call Delay
    djnz Fill
    ld a,(Counter)
    inc a
    ld (Counter),a
    ld hl,(Total)
    inc hl
    ld (Total),hl
    jr Start

; Waits a little, so the stripes are visible
Delay:
    push bc
    ld bc,#0100
DelayLoop:
    dec bc
    ld a,b
    or c
    jr nz,DelayLoop
    pop bc
    ret

Counter:
    .defb 0
Total:
    .defw 0

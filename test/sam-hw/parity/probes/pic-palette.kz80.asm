; Parity probe "pic-palette" (Phase 3): the 128 colours in one picture (plan Q11). @use timing @picture
; Mode 4 on pages 30-31 shows 16 vertical stripes (stripe i: CLUT entry i); line interrupts at screen lines
; 0, 24, ... 168, entered from HALT, load CLUT entry i with colour band * 16 + i, so band b shows colours
; 16b to 16b + 15. The border is entry 5 while drawing and 4 at the end (both reloaded with each band).
ProbeMain:
    call TimingSetup
    ld a,$20 | 30       ; pages 30-31: mode 4, byte = (column / 8) * 11h
    out ($FA),a
    ld hl,$0000
    ld bc,$6000
PalFill:
    ld a,l
    and $78             ; column (0-127) / 8, times 8
    rrca
    rrca
    rrca                ; 0-15
    ld e,a
    add a,a
    add a,a
    add a,a
    add a,a
    or e                ; * 11h
    ld (hl),a
    inc hl
    dec bc
    ld a,b
    or c
    jr nz,PalFill
    ld a,$1F
    out ($FA),a
    ld a,$7E            ; VMPR: mode 4, page 30
    out ($FC),a
    ld a,5
    out ($FE),a
    ld hl,PalIsr
    ld (VECTOR),hl
    xor a
    ld (Band),a
    ld (Passes),a
    out (LINE_PORT),a
    ei
PalWait:
    halt
    ld a,(Passes)
    cp 3
    jr c,PalWait
    di
    ld hl,NameDrawn
    ld de,1
    ld bc,0
    call Record
    call WriteResult
    ld a,4
    jr z,PalSignal
    ld a,2
PalSignal:
    out ($FE),a
    ei
PalForever:
    halt
    jr PalForever

PalIsr:
    push af
    in a,(STATUS_PORT)
    rra
    jr c,PalIgnore
    push bc
    push de
    ld a,(Band)
    add a,a
    add a,a
    add a,a
    add a,a             ; the band's first colour
    ld d,a
    ld b,0
PalClut:
    ld c,$F8
    ld a,d
    out (c),a           ; entry B
    inc d
    inc b
    ld a,b
    cp 16
    jr c,PalClut
    ld a,(Band)
    inc a
    cp 8
    jr c,PalNext
    ld hl,Passes
    inc (hl)
    xor a
PalNext:
    ld (Band),a
    ld e,a
    add a,a
    add a,e             ; * 3
    add a,a
    add a,a
    add a,a             ; * 24: the next band's line
    out (LINE_PORT),a
    pop de
    pop bc
PalIgnore:
    pop af
    ei
    reti

Band:       .defb 0
Passes:     .defb 0
NameDrawn:  .defm "DRAWN   "

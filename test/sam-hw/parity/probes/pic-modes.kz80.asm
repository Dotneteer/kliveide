; Parity probe "pic-modes" (Phase 3): the four screen modes in one picture. @use timing @picture
; Line interrupts at screen lines 0, 48, 96 and 144 switch VMPR (and HMPR) from the handler, entered from
; HALT: mode 1 on page 20, mode 2 on page 22, mode 3 on pages 24-25 with HMPR bit 6 (the high CLUT index
; bits: entries 8-11), mode 4 on pages 26-27. The pages are filled with varied bytes (attributes with BRIGHT,
; without FLASH), the CLUT with 16 distinct colours, the border is entry 5 while drawing and 4 at the end.
; The program writes its result, then keeps the raster going for the picture.
ProbeMain:
    call TimingSetup
    ; --- Mode 1, page 20: pixels L XOR H, attributes from 1800h
    ld a,$20 | 20
    out ($FA),a
    ld hl,$0000
    ld bc,$1800
Fill1:
    ld a,l
    xor h
    ld (hl),a
    inc hl
    dec bc
    ld a,b
    or c
    jr nz,Fill1
    ld bc,$0300
Fill1a:
    ld a,l
    add a,a
    add a,l             ; L * 3
    and $3F
    bit 0,h
    jr z,Fill1b
    or $40              ; BRIGHT on every other 256 attributes
Fill1b:
    ld (hl),a
    inc hl
    dec bc
    ld a,b
    or c
    jr nz,Fill1a
    ; --- Mode 2, page 22: pixels L XOR H, attributes at 2000h (L + H) * 5
    ld a,$20 | 22
    out ($FA),a
    ld hl,$0000
    ld bc,$1800
Fill2:
    ld a,l
    xor h
    ld (hl),a
    inc hl
    dec bc
    ld a,b
    or c
    jr nz,Fill2
    ld hl,$2000
    ld bc,$1800
Fill2a:
    ld a,l
    add a,h
    ld e,a
    add a,a
    add a,a
    add a,e             ; * 5
    and $7F
    ld (hl),a
    inc hl
    dec bc
    ld a,b
    or c
    jr nz,Fill2a
    ; --- Mode 3, pages 24-25: (L * 3) XOR H
    ld a,$20 | 24
    out ($FA),a
    ld hl,$0000
    ld bc,$6000
Fill3:
    ld a,l
    add a,a
    add a,l
    xor h
    ld (hl),a
    inc hl
    dec bc
    ld a,b
    or c
    jr nz,Fill3
    ; --- Mode 4, pages 26-27: L + H
    ld a,$20 | 26
    out ($FA),a
    ld hl,$0000
    ld bc,$6000
Fill4:
    ld a,l
    add a,h
    ld (hl),a
    inc hl
    dec bc
    ld a,b
    or c
    jr nz,Fill4
    ld a,$1F
    out ($FA),a
    ; --- The CLUT: entry i = (i * 9 + 3) AND 7Fh
    ld e,0
ClutLoop:
    ld a,e
    add a,a
    add a,a
    add a,a
    add a,e
    add a,3
    and $7F
    ld b,e
    ld c,$F8
    out (c),a
    inc e
    ld a,e
    cp 16
    jr c,ClutLoop
    ld a,5
    out ($FE),a
    ; --- The raster: band 0 first
    ld a,$14
    out ($FC),a
    ld hl,ModesIsr
    ld (VECTOR),hl
    xor a
    ld (Band),a
    ld (Passes),a
    out (LINE_PORT),a
    ei
ModesWait:
    halt
    ld a,(Passes)
    cp 3
    jr c,ModesWait
    di
    ld hl,NameDrawn
    ld de,1
    ld bc,0
    call Record
    call WriteResult
    ld a,4
    jr z,ModesSignal
    ld a,2
ModesSignal:
    out ($FE),a
    ei
ModesForever:
    halt
    jr ModesForever

; --- At band b's line: its VMPR and HMPR, then the next band's line
ModesIsr:
    push af
    in a,(STATUS_PORT)
    rra
    jr c,ModesIgnore
    push hl
    push bc
    ld a,(Band)
    ld c,a
    add a,a
    add a,c             ; * 3
    ld c,a
    ld b,0
    ld hl,Bands
    add hl,bc
    inc hl              ; VMPR
    ld a,(hl)
    out ($FC),a
    inc hl
    ld a,(hl)
    out ($FB),a         ; HMPR
    inc hl              ; the next band's entry
    ld a,(Band)
    inc a
    cp 4
    jr c,ModesNext
    ld hl,Passes
    inc (hl)
    ld hl,Bands
    xor a
ModesNext:
    ld (Band),a
    ld a,(hl)
    out (LINE_PORT),a
    pop bc
    pop hl
ModesIgnore:
    pop af
    ei
    reti

; --- line, VMPR, HMPR
Bands:
    .defb 0, $14, $01
    .defb 48, $36, $01
    .defb 96, $58, $41
    .defb 144, $7A, $01
Band:       .defb 0
Passes:     .defb 0
NameDrawn:  .defm "DRAWN   "

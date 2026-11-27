; Parity probe "mem-ext" (Phase 4, plan Q8): the 1 MB external pack's pages. @extmem @use timing
; A routine in page 0 (4C00h) maps external page e into section C (LEPR, HMPR bit 7) or D (HEPR), so page 1's
; code never goes away. Each pack page e (0-63) gets the marker e XOR 3Ch at its offset 3C00h through C.
;   EXTCee   pages 0-71 read through C (LEPR = e): 64 and up are not fitted; four a record
;   EXTDee   pages 0-31 read through D (HEPR = e)
;   EXTROM1  with HMPR bit 7 and LMPR's ROM1 bit both on: byte 0 what D shows at FC00h (HEPR = 5), byte 1
;            ROM1's byte there (bit 7 off)
;   EXTREG   IN (80h) and IN (81h) after writing 12h and 34h (bytes 0 and 1)
ProbeMain:
    di
    ld hl,ExtCode
    ld de,$4C00
    ld bc,ExtCodeEnd - ExtCode
    ldir
    ; --- The markers
    ld b,0
ExtMark:
    ld a,b
    xor $3C
    ld c,a
    call ExtWriteC - ExtCode + $4C00
    inc b
    ld a,b
    cp 64
    jr c,ExtMark
    ; --- Through C: pages 0-71
    ld hl,ExtBuf
    ld b,0
ExtReadC:
    call ExtGetC - ExtCode + $4C00
    ld (hl),a
    inc hl
    inc b
    ld a,b
    cp 72
    jr c,ExtReadC
    ; --- Through D: pages 0-31
    ld b,0
ExtReadD:
    call ExtGetD - ExtCode + $4C00
    ld (hl),a
    inc hl
    inc b
    ld a,b
    cp 32
    jr c,ExtReadD
    ; --- ROM1 and the pack both asking for D
    ld a,$5F
    out ($FA),a
    ld b,5
    call ExtGetD - ExtCode + $4C00
    ld (ExtMisc),a
    ld b,1
    call ExtGetPlainD - ExtCode + $4C00
    ld (ExtMisc + 1),a
    ld a,$1F
    out ($FA),a
    ; --- The register reads
    ld a,$12
    out ($80),a
    ld a,$34
    out ($81),a
    in a,($80)
    ld (ExtMisc + 2),a
    in a,($81)
    ld (ExtMisc + 3),a
    ; --- Records: EXTC (72 bytes), EXTD (32)
    ld hl,NameExtC
    ld de,ExtBuf
    ld b,72
    call ExtRecords
    ld hl,NameExtD
    ld de,ExtBuf + 72
    ld b,32
    call ExtRecords
    ld hl,NameExtRom1
    ld de,(ExtMisc)
    ld bc,0
    call Record
    ld hl,NameExtReg
    ld de,(ExtMisc + 2)
    ld bc,0
    jp Record

; --- Copied to 4C00h. B = the external page; HMPR back to 1 before every RET (the stack is in page 1)
ExtCode:
ExtWriteC:              ; (BC00h) of page B = C
    ld a,b
    out ($80),a
    ld a,$81
    out ($FB),a
    ld a,c
    ld ($BC00),a
    ld a,1
    out ($FB),a
    ret
ExtGetC:                ; A = (BC00h) of page B through C
    ld a,b
    out ($80),a
    ld a,$81
    out ($FB),a
    ld a,($BC00)
    push af
    ld a,1
    out ($FB),a
    pop af
    ret
ExtGetD:                ; A = (FC00h) of page B through D
    ld a,b
    out ($81),a
    ld a,$81
    out ($FB),a
    ld a,($FC00)
    push af
    ld a,1
    out ($FB),a
    pop af
    ret
ExtGetPlainD:           ; A = (FC00h) with HMPR = B (no external pack)
    ld a,b
    out ($FB),a
    ld a,($FC00)
    push af
    ld a,1
    out ($FB),a
    pop af
    ret
ExtCodeEnd:

; --- B bytes from DE as records of 4, named by the 4 characters at HL plus "  " and the first index in hex
ExtRecords:
    push bc
    push de
    ld de,NameBuf
    ld bc,6
    ldir
    pop hl
    pop bc
    ld c,b
    ld b,0
ExtRecLoop:
    push bc
    ld a,b
    call HexPair
    ld e,(hl)
    inc hl
    ld d,(hl)
    inc hl
    ld c,(hl)
    inc hl
    ld a,(hl)
    inc hl
    push hl
    ld b,a
    ld hl,NameBuf
    call Record
    pop hl
    pop bc
    ld a,b
    add a,4
    ld b,a
    cp c
    jr c,ExtRecLoop
    ret

ExtBuf:         .defs 104
ExtMisc:        .defs 4
NameExtC:       .defm "EXTC  "
NameExtD:       .defm "EXTD  "
NameExtRom1:    .defm "EXTROM1 "
NameExtReg:     .defm "EXTREG  "

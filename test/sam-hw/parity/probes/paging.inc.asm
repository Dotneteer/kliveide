; =============================================================================
; Paging tests for the parity probes (Phase 4), appended after a probe that contains "@use paging".
; Klive's own code. PagingTests runs with interrupts off from page 1 (section C); it never pages C out.
;
;   LMPRpp   LMPR = 20h | p (RAM0, page p in A, p + 1 in B): the marker read at 3C00h (A) and 7C00h (B),
;            two pages a record (bytes A, B, A, B for p, p + 1)
;   HMPRpp   HMPR = h (page h in C, h + 1 in D), read from page 0 at 4C00h: the markers at BC00h, FC00h
;   ROMBITS  byte 0: ROM0 at 0000h (LMPR 1Fh); 1: ROM1's byte at FC00h (LMPR 5Fh, HMPR 1); 2: page 3 at
;            3C00h after writing 77h with LMPR A3h (write-protected); 3: the same with LMPR 23h
;   REGREAD  IN (FAh) after LMPR A3h, IN (FBh) after HMPR 61h, IN (80h), IN (81h)
; A page's marker is its number XOR 0A5h, written at its offset 3C00h through section A.
; =============================================================================

MARK_OFF        .equ $3C00

PagingTests:
    di
    ; --- The markers
    ld b,0
PgMark:
    ld a,b
    or $20
    out ($FA),a
    ld a,b
    xor $A5
    ld (MARK_OFF),a
    inc b
    ld a,b
    cp 32
    jr c,PgMark
    ; --- LMPR: A and B
    ld hl,PgBuf
    ld b,0
PgLmpr:
    ld a,b
    or $20
    out ($FA),a
    ld a,(MARK_OFF)
    ld (hl),a
    inc hl
    ld a,(MARK_OFF + $4000)
    ld (hl),a
    inc hl
    inc b
    ld a,b
    cp 32
    jr c,PgLmpr
    ld a,$1F
    out ($FA),a
    ; --- HMPR: C and D, through a routine in page 0 (section B)
    ld hl,HmprRead
    ld de,$4C00
    ld bc,HmprReadEnd - HmprRead
    ldir
    ld hl,PgBuf + 64
    ld b,0
PgHmpr:
    call $4C00
    ld (hl),d
    inc hl
    ld (hl),e
    inc hl
    inc b
    ld a,b
    cp 32
    jr c,PgHmpr
    ; --- The ROM bits and write protection
    ld a,($0000)
    ld (PgRom),a
    ld a,$5F
    out ($FA),a
    ld b,1
    call $4C00
    ld a,e
    ld (PgRom + 1),a
    ld a,$1F
    out ($FA),a
    ld a,$A3            ; write-protected RAM page 3 in A
    out ($FA),a
    ld a,$77
    ld (MARK_OFF),a
    ld a,(MARK_OFF)
    ld (PgRom + 2),a
    ld a,$23
    out ($FA),a
    ld a,$77
    ld (MARK_OFF),a
    ld a,(MARK_OFF)
    ld (PgRom + 3),a
    ld a,$A6            ; page 3's marker back (3 XOR 0A5h)
    ld (MARK_OFF),a
    ld a,$1F
    out ($FA),a
    ; --- Register reads
    ld a,$A3
    out ($FA),a
    in a,($FA)
    ld (PgReg),a
    ld a,$1F
    out ($FA),a
    ld a,$61
    out ($FB),a
    in a,($FB)
    ld (PgReg + 1),a
    ld a,$01
    out ($FB),a
    in a,($80)
    ld (PgReg + 2),a
    in a,($81)
    ld (PgReg + 3),a
    ; --- The records
    ld hl,NameLmpr
    ld de,PgBuf
    call PgRecords
    ld hl,NameHmpr
    ld de,PgBuf + 64
    call PgRecords
    ld hl,NameRomBits
    ld de,(PgRom)
    ld bc,(PgRom + 2)
    call Record
    ld hl,NameRegRead
    ld de,(PgReg)
    ld bc,(PgReg + 2)
    jp Record

; --- Copied to 4C00h (page 0): B = HMPR; D = (BC00h), E = (FC00h); HMPR 1 again before the RET (the
; --- stack is in page 1)
HmprRead:
    ld a,b
    out ($FB),a
    ld a,($BC00)
    ld d,a
    ld a,($FC00)
    ld e,a
    ld a,1
    out ($FB),a
    ret
HmprReadEnd:

; --- 16 records of 4 bytes from DE, named by the 6 characters at HL and two hex digits (2 pages each)
PgRecords:
    push de
    ld de,NameBuf
    ld bc,6
    ldir
    pop hl
    ld b,0
PgRecLoop:
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
    add a,2
    ld b,a
    cp 32
    jr c,PgRecLoop
    ret

PgBuf:          .defs 128
PgRom:          .defs 4
PgReg:          .defs 4
NameLmpr:       .defm "LMPR  "
NameHmpr:       .defm "HMPR  "
NameRomBits:    .defm "ROMBITS "
NameRegRead:    .defm "REGREAD "

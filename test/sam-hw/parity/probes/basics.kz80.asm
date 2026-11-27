; Parity probe "basics" (Phase 0): port reads with nothing pressed and the ROM's page allocation table.
;   FE_IDLE  IN FEh, high byte FFh: no key, SPEN low, EAR, SOFF
;   F9_STAT  IN F9h, high byte FFh: STATUS (no key rows selected)
;   FA_LMPR, FB_HMPR, FC_VMPR   the paging and video registers read back
;   ALLOCT0, ALLOCT4  ALLOCT's first 8 bytes (5100h, page 0); ALLOCSUM its 33 bytes summed
ProbeMain:
    ld bc,$FFFE
    in a,(c)
    ld hl,NameFe
    call RecordA
    ld bc,$FFF9
    in a,(c)
    ld hl,NameF9
    call RecordA
    in a,($FA)
    ld hl,NameFa
    call RecordA
    in a,($FB)
    ld hl,NameFb
    call RecordA
    in a,($FC)
    ld hl,NameFc
    call RecordA
    ld de,($5100)
    ld bc,($5102)
    ld hl,NameAlloc0
    call Record
    ld de,($5104)
    ld bc,($5106)
    ld hl,NameAlloc4
    call Record
    ld hl,$5100
    ld de,0
    ld b,33
Sum:
    ld a,(hl)
    add a,e
    ld e,a
    jr nc,NoCarry
    inc d
NoCarry:
    inc hl
    djnz Sum
    ld bc,0
    ld hl,NameSum
    call Record
    ret

NameFe:     .defm "FE_IDLE "
NameF9:     .defm "F9_STAT "
NameFa:     .defm "FA_LMPR "
NameFb:     .defm "FB_HMPR "
NameFc:     .defm "FC_VMPR "
NameAlloc0: .defm "ALLOCT0 "
NameAlloc4: .defm "ALLOCT4 "
NameSum:    .defm "ALLOCSUM"

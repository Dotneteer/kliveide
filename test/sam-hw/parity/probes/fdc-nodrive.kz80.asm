; Parity probe "fdc-nodrive" (Phase 5): drive 2's ports with no second drive fitted.
;   NODRIVE  IN of F0h-F3h (status, track, sector, data)    NOCMD  status after a RESTORE written to F0h
ProbeMain:
    ld c,$F0
    in e,(c)
    inc c
    in d,(c)
    inc c
    push de
    in e,(c)
    inc c
    in d,(c)
    ld b,d
    ld c,e
    pop de
    ld hl,NameNoDrive
    call Record
    ld a,$0A
    out ($F0),a
    nop
    nop
    nop
    nop
    in a,($F0)
    ld e,a
    ld d,0
    ld bc,0
    ld hl,NameNoCmd
    jp Record
NameNoDrive:    .defm "NODRIVE "
NameNoCmd:      .defm "NOCMD   "

; Parity probe "attr" (Phase 3): ATTR (port FFh) and an unmapped port (37h, the floating bus, plan Q14)
; read along a screen line. @use timing
; Mode 2 on page 30: pixel bytes (y * 32 + x) AND 0FFh, attribute bytes at 2000h: 80h + x + y (so the
; column shows). From the line interrupt at screen line 100 (entered from HALT), a fixed delay and k NOPs
; (k = 0-31: the position, 4 T a step in the border part, 8 in the screen part), one read of port FFh
; (ATTRnn: four values a record, k from the low byte) or of port 7Fh (FLOATnn). Also LPEN at each k
; (POSnn), so the positions can be compared.
ProbeMain:
    call TimingSetup
    ld a,$20 | 30
    out ($FA),a
    ld hl,$0000
    ld bc,$1800
AttrFill:
    ld a,l
    ld (hl),a
    inc hl
    dec bc
    ld a,b
    or c
    jr nz,AttrFill
    ld hl,$2000
    ld bc,$1800
AttrFill2:
    ld a,l
    and $1F             ; x
    ld e,a
    ld a,l
    rlca
    rlca
    rlca
    and $07
    ld d,a
    ld a,h
    and $1F
    rlca
    rlca
    rlca
    or d                ; y
    add a,e
    or $80
    ld (hl),a
    inc hl
    dec bc
    ld a,b
    or c
    jr nz,AttrFill2
    ld a,$1F
    out ($FA),a
    ld a,$3E            ; VMPR: mode 2, page 30
    out ($FC),a
    ld ix,Sweeps
SweepsNext:
    ld a,(ix+0)
    or a
    jr z,SweepsDone
    ld a,(ix+6)
    ld (AttrDelayN),a
    ld l,(ix+7)
    ld h,(ix+8)
    ld (ReadPort),hl
    push ix
    pop hl
    push ix
    call AttrSweep
    pop ix
    ld de,9
    add ix,de
    jr SweepsNext
SweepsDone:
    ld a,$7E
    out ($FC),a
    ret

; --- name (6), DJNZ rounds before the sled, port routine
Sweeps:
    .defm "ATTRA "
    .defb 4
    .defw ReadAttr
    .defm "ATTRB "
    .defb 12
    .defw ReadAttr
    .defm "FLOTA "
    .defb 4
    .defw ReadFloat
    .defm "FLOTB "
    .defb 12
    .defw ReadFloat
    .defm "POSB  "
    .defb 12
    .defw ReadPos
    .defb 0

ReadAttr:
    ld a,$FF
    in a,($FF)
    ret
ReadFloat:
    ld a,$FF
    in a,($37)
    ret
ReadPos:
    xor a
    in a,($F8)
    ret

; --- 32 reads (k = 0-31) of the port routine at (ReadPort), recorded four to a record under the
; --- six-character name at HL plus the first k in hex
AttrSweep:
    ld de,NameBuf
    ld bc,6
    ldir
    xor a
    ld (AttrK),a
    ld hl,AttrValues
    ld (AttrPtr),hl
    ; --- The sled: 32 NOPs, CALL (ReadPort) via JP AttrTail
    ld hl,LOOPBUF
    ld b,32
AttrNops:
    ld (hl),0
    inc hl
    djnz AttrNops
    ld (hl),$C3
    inc hl
    ld (hl),AttrTail & $FF
    inc hl
    ld (hl),AttrTail >> 8
AttrNext:
    ld a,100
    out (LINE_PORT),a
    call SyncFrame
    ld c,$01
    call WaitActive
    ld a,$FF
    out (LINE_PORT),a
    ld a,(AttrDelayN)
    ld b,a
AttrDelay:
    djnz AttrDelay
    ld a,(AttrK)
    ld e,a
    ld d,0
    ld hl,LOOPBUF + 32
    or a
    sbc hl,de
    jp (hl)
AttrTail:
    ld hl,(ReadPort)
    call JumpHlA
    ld hl,(AttrPtr)
    ld (hl),a
    inc hl
    ld (AttrPtr),hl
    ld a,(AttrK)
    inc a
    ld (AttrK),a
    cp 32
    jr c,AttrNext
    ld hl,AttrValues
    ld b,0
AttrRecords:
    push bc
    ld a,b
    call HexPair
    ld e,(hl)
    inc hl
    ld d,(hl)
    inc hl
    ld c,(hl)
    inc hl
    ld b,(hl)
    inc hl
    push hl
    ld hl,NameBuf
    call Record
    pop hl
    pop bc
    ld a,b
    add a,4
    ld b,a
    cp 32
    jr c,AttrRecords
    ret

JumpHlA:
    jp (hl)

AttrK:      .defb 0
AttrDelayN: .defb 4
AttrPtr:    .defw 0
ReadPort:   .defw 0
AttrValues: .defs 32

; Parity probe "pic-q15" (Phase 3, plan Q15): the cell where a mid-line mode switch shows. @use timing @picture
; Pages 26, 28, 30 and 31 hold pseudo-random bytes: a 16-bit Galois LFSR (taps 0B400h, seed 0ACE1h), 16
; steps a byte (so no bit of a byte equals one of its neighbours'), the byte its low half (dev/scripts/sam-parity/q15.cjs replays it). The CLUT holds 16
; distinct colours. The screen is mode 4 (page 30). Every 4th line the line interrupt (from HALT) waits 6
; DJNZ rounds and k NOPs (k = line / 4 AND 7), switches to a second mode, and back to mode 4 8 NOPs later:
; lines 0-95 mode 2 (page 28), lines 96-191 mode 1 (page 26).
ProbeMain:
    call TimingSetup
    ld hl,$ACE1
    ld (Lfsr),hl
    ld a,$20 | 26       ; pages 26-27: the first 16K random (page 26)
    call FillRandom
    ld a,$20 | 28
    call FillRandom
    ld a,$20 | 30       ; pages 30-31: 32K
    call FillRandom32
    ld a,$1F
    out ($FA),a
    ld e,0
QClut:
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
    jr c,QClut
    ld a,5
    out ($FE),a
    ; --- The sled: 8 NOPs, then JP QAfterSled
    ld hl,LOOPBUF
    ld b,8
QNops:
    ld (hl),0
    inc hl
    djnz QNops
    ld (hl),$C3
    inc hl
    ld (hl),QAfterSled & $FF
    inc hl
    ld (hl),QAfterSled >> 8
    ld hl,QIsr
    ld (VECTOR),hl
    xor a
    ld (QLine),a
    ld (Passes),a
    out (LINE_PORT),a
    ld a,$7E
    out ($FC),a
    ei
QWait:
    halt
    ld a,(Passes)
    cp 3
    jr c,QWait
    di
    ld hl,NameDrawn
    ld de,1
    ld bc,0
    call Record
    call WriteResult
    ld a,4
    jr z,QSignal
    ld a,2
QSignal:
    out ($FE),a
    ei
QForever:
    halt
    jr QForever

; --- 16K of random bytes into the page LMPR = A maps at 0000h (and 32K for FillRandom32)
FillRandom:
    out ($FA),a
    ld bc,$4000
    jr FillGo
FillRandom32:
    out ($FA),a
    ld bc,$8000
FillGo:
    ld de,$0000
FillLoop:
    push bc
    ld hl,(Lfsr)
    ld b,16
FillStep:
    srl h
    rr l
    jr nc,FillNoTap
    ld a,h
    xor $B4
    ld h,a
FillNoTap:
    djnz FillStep
    ld (Lfsr),hl
    ld a,l
    ld (de),a
    inc de
    pop bc
    dec bc
    ld a,b
    or c
    jr nz,FillLoop
    ret

QIsr:
    push af
    in a,(STATUS_PORT)
    rra
    jr c,QIgnore
    push bc
    push de
    push hl
    ld a,(QLine)
    ld b,a              ; this line
    add a,4
    cp 192
    jr c,QNext
    ld hl,Passes
    inc (hl)
    xor a
QNext:
    ld (QLine),a
    out (LINE_PORT),a
    ld c,$3C            ; lines 0-95: mode 2, page 28
    ld a,b
    cp 96
    jr c,QMode
    ld c,$1A            ; lines 96-191: mode 1, page 26
QMode:
    ld a,b
    rrca
    rrca
    and $07             ; k = line / 4 AND 7
    ld e,a
    ld d,0
    ld b,6
QDelay:
    djnz QDelay
    ld hl,LOOPBUF + 8
    or a
    sbc hl,de
    jp (hl)
QAfterSled:
    ld a,c
    out ($FC),a         ; the second mode
    nop
    nop
    nop
    nop
    nop
    nop
    nop
    nop
    ld a,$7E
    out ($FC),a         ; mode 4 again
    pop hl
    pop de
    pop bc
QIgnore:
    pop af
    ei
    reti

QLine:      .defb 0
Passes:     .defb 0
Lfsr:       .defw 0
NameDrawn:  .defm "DRAWN   "

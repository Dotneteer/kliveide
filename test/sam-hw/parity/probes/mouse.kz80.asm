; Parity probe "mouse" (Phase 6): the MGT mouse's read sequence and its timeout (plan Q18), with the
; mouse still (no movement, no button). All reads are IN A,(C) at FFFEh in the border, from HALT.
; @use timing
; @mouse
;   SEQ0-7    16 reads back to back (48 T apart): the low nibbles of reads 0-7, read 0 in bits 0-3
;   SEQ8-15   the same, reads 8-15
;   SEQRAW    the whole bytes of reads 0-3, read 0 in bits 0-7
;   GAPA      reads 0-2 back to back, then a CALL to k NOPs and read 3, for k = GAP_K0 + 0..31: bit k - GAP_K0
;             is 1 when read 3 gave Fh (the sequence started again at the strobe), 0 when it gave the Y
;             movement's top nibble (0, the sequence went on)
;   GAPB      the same for k = GAP_K0 + 32..63
;   CHAIN     12 reads with CHAIN_K NOPs between each (each gap below the timeout, the whole chain well
;             above it): the low nibbles of reads 0-7
;   CHAINB    the same, reads 8-11 (bits 0-15)

GAP_K0          .equ 32
CHAIN_K         .equ 15

ProbeMain:
    call TimingSetup

    ; --- The sequence, back to back
    call SyncFrame
    ld bc,$FFFE
    ld hl,SeqBuf
    ld e,16
SeqLoop:
    in a,(c)
    ld (hl),a
    inc hl
    dec e
    jr nz,SeqLoop
    ld hl,SeqBuf
    call Pack8
    ld hl,NameSeq0
    call Record
    ld hl,SeqBuf + 8
    call Pack8
    ld hl,NameSeq8
    call Record
    ld hl,(SeqBuf)
    ex de,hl
    ld hl,(SeqBuf + 2)
    ld b,h
    ld c,l
    ld hl,NameSeqRaw
    call Record

    ; --- The timeout: the gap before read 3, swept
    ld a,GAP_K0
    ld (GapK),a
    call GapSweep
    ld hl,NameGapA
    call Record
    call GapSweep
    ld hl,NameGapB
    call Record

    ; --- A chain of reads, each gap below the timeout
    ld a,CHAIN_K
    call BuildGap
    call SyncFrame
    ld bc,$FFFE
    ld hl,SeqBuf
    ld e,12
ChainLoop:
    push hl
    call LOOPBUF
    pop hl
    ld (hl),a
    inc hl
    dec e
    jr nz,ChainLoop
    ld hl,SeqBuf
    call Pack8
    ld hl,NameChain
    call Record
    ld hl,SeqBuf + 8
    call Pack4
    ld bc,0
    ld hl,NameChainB
    jp Record

; --- 32 trials from k = (GapK), each a frame; BC:DE the result bits, trial 0 in bit 0
GapSweep:
    ld hl,0
    ld (Mask),hl
    ld (Mask + 2),hl
    ld a,32
    ld (Trials),a
GapNext:
    ld a,(GapK)
    call BuildGap
    call SyncFrame
    ld bc,$FFFE
    in a,(c)            ; 0: strobe
    in a,(c)            ; 1: dummy
    in a,(c)            ; 2: buttons
    call LOOPBUF        ; k NOPs, then read 3
    and $0F
    cp $0F              ; Fh: started again (carry clear); 0: went on (carry set)
    ccf
    ld hl,Mask + 3
    rr (hl)
    dec hl
    rr (hl)
    dec hl
    rr (hl)
    dec hl
    rr (hl)
    ld hl,GapK
    inc (hl)
    ld hl,Trials
    dec (hl)
    jr nz,GapNext
    ld de,(Mask)
    ld bc,(Mask + 2)
    ret

; --- LOOPBUF = A NOPs, IN A,(C), RET
BuildGap:
    ld hl,LOOPBUF
    or a
    jr z,BuildTail
    ld b,a
BuildLoop:
    ld (hl),0
    inc hl
    djnz BuildLoop
BuildTail:
    ld (hl),$ED
    inc hl
    ld (hl),$78         ; IN A,(C)
    inc hl
    ld (hl),$C9         ; RET
    ret

; --- The low nibbles of the 8 bytes at HL into BC:DE, the first in bits 0-3
Pack8:
    call Pack4
    push de
    call Pack4
    ld b,d
    ld c,e
    pop de
    ret
; --- The low nibbles of the 4 bytes at HL into DE (HL advances)
Pack4:
    ld a,(hl)
    and $0F
    ld e,a
    inc hl
    ld a,(hl)
    inc hl
    add a,a
    add a,a
    add a,a
    add a,a
    or e
    ld e,a
    ld a,(hl)
    and $0F
    ld d,a
    inc hl
    ld a,(hl)
    inc hl
    add a,a
    add a,a
    add a,a
    add a,a
    or d
    ld d,a
    ret

GapK:           .defb 0
Trials:         .defb 0
Mask:           .defs 4
SeqBuf:         .defs 16
NameSeq0:       .defm "SEQ0-7  "
NameSeq8:       .defm "SEQ8-15 "
NameSeqRaw:     .defm "SEQRAW  "
NameGapA:       .defm "GAPA    "
NameGapB:       .defm "GAPB    "
NameChain:      .defm "CHAIN   "
NameChainB:     .defm "CHAINB  "

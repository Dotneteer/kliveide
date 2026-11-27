; Parity probe "tape-ear" (Phase 6): the tape "ear-tones" (test/sam-hw/parity/tapes.ts) timed edge by edge
; through ROM 3.0's own edge routine at 204Ch (ROM0), as its LOAD does: pure tones of 2000, 1000, 500 and
; 300 T (3.5 MHz) pulses.
; @tape ear-tones
; @typed LOAD "" CODE 81920: BOOT
; The tape starts with a CODE file, which the typed LOAD loads; the probe boots in the 4 s pause after it.
; SimCoupé plays a tape only while the ROM's loader runs, so the probe reads EAR only through the routine.
; The routine, as observed by running ROM 3.0 (not from its code): called with C = 0 and B = the last level
; (0Ah: EAR low, 6Dh: high), it returns at the next edge with carry set, C = the passes it counted (about 51 T
; each, after a fixed wait: a pulse of p T (3.5 MHz) counts about 0.035 p - 7.5 here) and B the other value;
; without an edge for 256 passes it returns with carry clear.
; Interrupts off. After the first edge (the end of the pause before the tones), each interval is counted
; until EDGES intervals or a timeout; the intervals are taken 60 a tone, in the tape's order:
;   S<len>    the tone's counts summed (a sum over consecutive intervals depends only on its first and last
;             edge: two emulators that play the same edges agree to about one pass)
;   M<len>    the smallest count (bits 0-15) and the largest (bits 16-31)
;   EDGESEEN  the intervals counted

ROM_EDGE        .equ $204C
EDGES           .equ 600

ProbeMain:
    di
    ; --- B as the routine wants it: the level now
    ld b,$0A
    in a,($FE)
    and $40
    jr z,EarLevel
    ld b,$6D
EarLevel:
    ; --- The first edge, however long the tape takes to start
EarWait:
    ld c,0
    call ROM_EDGE
    jr nc,EarWait
    ld ix,EarBuf
    ld hl,EDGES
    ld (EarLeft),hl
EarInterval:
    ld c,0
    call ROM_EDGE
    jr nc,EarDone       ; no edge in 256 passes: the tape has ended
    ld (ix+0),c
    ld (ix+1),0
    inc ix
    inc ix
    ld hl,(EarLeft)
    dec hl
    ld (EarLeft),hl
    ld a,h
    or l
    jr nz,EarInterval
EarDone:
    ; --- The intervals counted
    push ix
    pop hl
    ld de,EarBuf
    or a
    sbc hl,de
    srl h
    rr l
    ld (EarCount),hl
    xor a               ; border black (green and red are the frame's end signal)
    out ($FE),a
    ei
    ex de,hl
    ld bc,0
    ld hl,NameEdges
    call Record

    ; --- Per tone: 60 intervals each, in order
    ld ix,Tones
    ld hl,EarBuf
    ld (TonePtr),hl
EarTone:
    ld a,(ix+0)
    or a
    ret z
    ld hl,0
    ld (ToneSum),hl
    ld hl,$FFFF
    ld (ToneMin),hl
    ld hl,0
    ld (ToneMax),hl
    ld hl,(TonePtr)
    ld b,TONE_PULSES
EarToneScan:
    ld e,(hl)
    inc hl
    ld d,(hl)
    inc hl
    push hl
    ld hl,(ToneSum)
    add hl,de
    ld (ToneSum),hl
    ld hl,(ToneMin)
    or a
    sbc hl,de
    jr c,EarToneNotMin
    ld (ToneMin),de
EarToneNotMin:
    ld hl,(ToneMax)
    or a
    sbc hl,de
    jr nc,EarToneNotMax
    ld (ToneMax),de
EarToneNotMax:
    pop hl
    djnz EarToneScan
    ld (TonePtr),hl
    ; --- The names: "S" / "M" and the tone's four characters at ix+1
    push ix
    pop hl
    inc hl
    ld de,NameTone + 1
    ld bc,4
    ldir
    ld a,'S'
    ld (NameTone),a
    ld de,(ToneSum)
    ld bc,0
    ld hl,NameTone
    call Record
    ld a,'M'
    ld (NameTone),a
    ld de,(ToneMin)
    ld bc,(ToneMax)
    ld hl,NameTone
    call Record
    ld de,5
    add ix,de
    jp EarTone

TONE_PULSES     .equ 60

; --- The tones in the tape's order: a nonzero marker and the name; 0 ends
Tones:
    .defb 1
    .defm "2000"
    .defb 1
    .defm "1000"
    .defb 1
    .defm "800 "
    .defb 1
    .defm "600 "
    .defb 1
    .defm "500 "
    .defb 1
    .defm "450 "
    .defb 1
    .defm "400 "
    .defb 1
    .defm "350 "
    .defb 1
    .defm "300 "
    .defb 0

TonePtr:        .defw 0
ToneSum:        .defw 0
ToneMin:        .defw 0
ToneMax:        .defw 0
NameTone:       .defm "S2000   "
EarLeft:        .defw 0
EarCount:       .defw 0
NameEdges:      .defm "EDGESEEN"
EarBuf:         .defs EDGES * 2

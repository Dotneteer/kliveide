; Parity probe "status" (Phase 2): the interrupts as STATUS shows them, by polling with interrupts off.
; @use timing
;   FIRE<nnn>  LINE = nnn: when STATUS bit 0 goes active, HPEN (byte 0) and LPEN (byte 1); when it goes
;              inactive again, HPEN (byte 2) and LPEN (byte 3). FFFFFFFFh: no pulse in the frame
;   FRAMEPUL   the frame pulse: polls while STATUS bit 3 stays active (bytes 0-1), HPEN at its start (2)
;   LWSAME     LINE 100 written again during its pulse: STATUS just after (bit 0: 1 = the pulse ended)
;   LWOTHER    the same with LINE 101 written
;   LWAFTER    LINE 100's pulse over, LINE 100 written again in the same line: 1 if a pulse came
;   MISSED     the line pulse run out with interrupts off, then EI: interrupts taken (IM 2 counter)
;   MIDIWAIT   OUT (FDh): polls until STATUS bit 4 (MIDI OUT) goes active (0-1) and while active (2-3)
;   MIDITX     OUT (FDh): polls while LPEN bit 1 (TXFMST) stays high
;   SOFFPEN    SOFF on (border bit 7, mode 4) at LINE 100's pulse end + 64 NOPs: HPEN (0), LPEN (1);
;              SOFF off again: HPEN (2), LPEN (3)
;   CTRLPEN    the same with border 0 written instead of SOFF (a control)
; The IM 2 vector byte (FFh) is not probed here: every probe's handler is reached through 0A0FFh, which
; works in both emulators only with FFh on the bus.
ProbeMain:
    call TimingSetup
    ld hl,FireLines
FireNext:
    ld a,(hl)
    inc hl
    push hl
    push af
    call FireAt
    pop af
    push bc
    push de
    call NameDecimal    ; NameBuf = "FIRE" + three digits
    pop de
    pop bc
    ld hl,NameBuf
    call Record
    pop hl
    ld a,(FireCount)
    dec a
    ld (FireCount),a
    jr nz,FireNext

    ; --- The frame pulse
    ld a,$FF
    out (LINE_PORT),a
    ld c,$08
    call WaitInactive
    call WaitActive
    ld bc,$01F8
    in a,(c)            ; HPEN
    ld (Scratch),a
    ld de,0
    ld c,$08
FramePulse:
    in a,(STATUS_PORT)
    inc de
    and c
    jr z,FramePulse
    ld a,(Scratch)
    ld c,a
    ld b,0
    ld hl,NameFramePul
    call Record

    ; --- A LINE write during the pulse: the same line, then another
    ld a,100
    ld (LineValue),a
    call LineWriteDuring
    ld hl,NameLwSame
    call RecordA
    ld a,101
    ld (LineValue),a
    call LineWriteDuring
    ld hl,NameLwOther
    call RecordA

    ; --- LINE written again after its pulse, in the same line
    ld a,100
    out (LINE_PORT),a
    call SyncFrame
    ld c,$01
    call WaitActive
    call WaitInactive
    ld a,100
    out (LINE_PORT),a
    ld e,0
    ld b,40             ; about the rest of the line
LwAfterPoll:
    in a,(STATUS_PORT)
    rra
    jr c,LwAfterNext
    ld e,1
LwAfterNext:
    djnz LwAfterPoll
    ld a,e
    ld hl,NameLwAfter
    call RecordA

    ; --- A pulse missed with interrupts off
    ld hl,CountIsr
    ld (VECTOR),hl
    xor a
    ld (IrqCount),a
    ld a,100
    out (LINE_PORT),a
    call SyncFrame
    ld c,$01
    call WaitActive
    call WaitInactive
    ei
    nop
    nop
    nop
    nop
    di
    ld a,$FF
    out (LINE_PORT),a
    ld a,(IrqCount)
    ld hl,NameMissed
    call RecordA
    ld hl,Isr
    ld (VECTOR),hl

    ; --- MIDI OUT: the interrupt pulse and TXFMST
    call SyncFrame
    ld a,$55
    out ($FD),a
    ld de,0
    ld c,$10
MidiWait:
    in a,(STATUS_PORT)
    inc de
    and c
    jr nz,MidiWait
    push de
    ld de,0
MidiActive:
    in a,(STATUS_PORT)
    inc de
    and c
    jr z,MidiActive
    ld b,d
    ld c,e
    pop de
    ld hl,NameMidiWait
    call Record
    call SyncFrame
    ld a,$55
    out ($FD),a
    ld de,0
MidiTx:
    xor a
    in a,($F8)          ; LPEN, bit 1 TXFMST
    inc de
    and $02
    jr nz,MidiTx
    ld bc,0
    ld hl,NameMidiTx
    call Record

    ; --- The same with border 0 instead of SOFF (a control)
    ld a,100
    out (LINE_PORT),a
    call SyncFrame
    ld c,$01
    call WaitActive
    call WaitInactive
    ld b,64
CtrlDelay:
    nop
    djnz CtrlDelay
    ld a,$00            ; no SOFF
    out ($FE),a
    ld bc,$01F8
    in d,(c)            ; HPEN
    ld bc,$00F8
    in e,(c)            ; LPEN
    xor a
    out ($FE),a
    ld bc,$01F8
    in h,(c)
    ld bc,$00F8
    in l,(c)
    ld a,$FF
    out (LINE_PORT),a
    ld b,l
    ld c,h
    ld hl,NameCtrlPen
    call Record
    ; --- HPEN and LPEN with SOFF
    ld a,100
    out (LINE_PORT),a
    call SyncFrame
    ld c,$01
    call WaitActive
    call WaitInactive
    ld b,64
SoffDelay:
    nop
    djnz SoffDelay
    ld a,$80            ; SOFF, border 0
    out ($FE),a
    ld bc,$01F8
    in d,(c)            ; HPEN
    ld bc,$00F8
    in e,(c)            ; LPEN
    xor a
    out ($FE),a
    ld bc,$01F8
    in h,(c)
    ld bc,$00F8
    in l,(c)
    ld a,$FF
    out (LINE_PORT),a
    ld b,l
    ld c,h
    ld hl,NameSoffPen
    jp Record

; --- LINE = A: from the start of a frame, STATUS bit 0's start and end (HPEN, LPEN each); BC:DE
FireAt:
    out (LINE_PORT),a
    call SyncFrame
FirePoll:
    in a,(STATUS_PORT)
    bit 0,a
    jr z,FireHit
    bit 3,a
    jr nz,FirePoll
    ld de,$FFFF         ; the next frame came first: no pulse
    ld bc,$FFFF
    jr FireOff
FireHit:
    ld bc,$01F8
    in d,(c)            ; HPEN
    ld bc,$00F8
    in e,(c)            ; LPEN
FireEnd:
    in a,(STATUS_PORT)
    rra
    jr nc,FireEnd
    ld bc,$01F8
    in a,(c)
    ld bc,$00F8
    in c,(c)
    ld b,c
    ld c,a              ; B = LPEN, C = HPEN at the end
    ld a,d              ; E = HPEN, D = LPEN at the start
    ld d,e
    ld e,a
FireOff:
    ld a,$FF
    out (LINE_PORT),a
    ret

; --- LINE = (LineValue) is written while the pulse of LINE 100 is active; A = STATUS bit 0 just after
LineWriteDuring:
    ld a,100
    out (LINE_PORT),a
    call SyncFrame
    ld c,$01
    call WaitActive
    ld a,(LineValue)
    out (LINE_PORT),a
    in a,(STATUS_PORT)
    and $01
    push af
    ld a,$FF
    out (LINE_PORT),a
    pop af
    ret

CountIsr:
    push af
    ld a,(IrqCount)
    inc a
    ld (IrqCount),a
    pop af
    ret                 ; interrupts stay off

; --- NameBuf = "FIRE" and A as three decimal digits, then a space
NameDecimal:
    ld hl,NameFire
    ld de,NameBuf
    push af
    ld bc,4
    ldir
    pop af
    ld b,100
    call Digit
    ld b,10
    call Digit
    ld b,1
    call Digit
    ld a,' '
    ld (de),a
    ret
Digit:
    ld c,'0'
DigitLoop:
    cp b
    jr c,DigitDone
    sub b
    inc c
    jr DigitLoop
DigitDone:
    push af
    ld a,c
    ld (de),a
    inc de
    pop af
    ret

FireLines:      .defb 0, 1, 100, 191, 192, 255
FireCount:      .defb 6
LineValue:      .defb 0
IrqCount:       .defb 0
Scratch:        .defb 0
NameFire:       .defm "FIRE"
NameFramePul:   .defm "FRAMEPUL"
NameLwSame:     .defm "LWSAME  "
NameLwOther:    .defm "LWOTHER "
NameLwAfter:    .defm "LWAFTER "
NameMissed:     .defm "MISSED  "
NameMidiWait:   .defm "MIDIWAIT"
NameMidiTx:     .defm "MIDITX  "
NameSoffPen:    .defm "SOFFPEN "
NameCtrlPen:    .defm "CTRLPEN "

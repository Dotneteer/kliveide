; Parity probe "status-sweep" (Phase 2): interrupt edges to 4 T by sweeps (sweep.inc.asm). Each record
; holds 32 one-bit samples, k = 0 in bit 0, the sample point moving 4 T a step. @use timing @use sweep
;   MIDIINT   after OUT (FDh): STATUS bit 4 (MIDI OUT) active, around the byte's end
;   MIDITX    after OUT (FDh): LPEN bit 1 (TXFMST) set, around the byte's end
;   L0TOL1    LINE 0's pulse seen, LINE = 1 written at once: STATUS bit 0 active (line 1's pulse)
;   LWINTOa/b LINE 98's pulse seen, LINE off; around line 100's start LINE = 100 written: bit 0 active
;   HPEN0     LINE 191's pulse seen, about a frame later: HPEN < 192 (the next screen's top)
;   HPEN192   LINE 190's pulse seen, about two lines later: HPEN < 192 (line 191 before 192)
; The delays were chosen so that each window holds Klive's transition (the tuning is in Klive only).
ProbeMain:
    call TimingSetup
    ld ix,Sweeps
SweepsNext:
    ld a,(ix+0)
    or a
    ret z
    ld l,(ix+8)
    ld h,(ix+9)
    ld (SweepRef),hl
    ld l,(ix+10)
    ld h,(ix+11)
    ld (SweepAction),hl
    ld l,(ix+12)
    ld h,(ix+13)
    ld (SweepDelay),hl
    push ix
    pop hl
    push ix
    call Sweep
    pop ix
    ld de,14
    add ix,de
    jr SweepsNext

; --- Entries: name (8), reference, action, delay rounds
Sweeps:
    .defm "MIDIINT "
    .defw RefMidi, ActMidiInt, 62
    .defm "MIDITX  "
    .defw RefMidi, ActTx, 60
    .defm "L0TOL1  "
    .defw RefLine0, ActLine, 1
    .defm "LWINTOa "
    .defw RefLine98, ActLineInto, 10
    .defm "LWINTOb "
    .defw RefLine98, ActLineInto, 13
    .defm "HPEN0   "
    .defw RefLine191, ActHpen, 1648
    .defm "HPEN192 "
    .defw RefLine190, ActHpen, 10
    .defm "XMI56   "
    .defw RefMidi, ActMidiInt, 56
    .defm "XMI58   "
    .defw RefMidi, ActMidiInt, 58
    .defm "XTX63   "
    .defw RefMidi, ActTx, 63
    .defm "XTX64   "
    .defw RefMidi, ActTx, 64
    .defb 0

RefMidi:
    call SyncFrame
    ld a,$55
    out ($FD),a
    ret
RefLine0:
    xor a
    out (LINE_PORT),a
    call SyncFrame
    ld c,$01
    call WaitActive
    ld a,1
    out (LINE_PORT),a
    ret
RefLine99:
    ld a,99
    out (LINE_PORT),a
    call SyncFrame
    ld c,$01
    call WaitActive
    call WaitInactive
    ld a,$FF
    out (LINE_PORT),a
    ret
RefLine98:
    ld a,98
    out (LINE_PORT),a
    call SyncFrame
    ld c,$01
    call WaitActive
    ld a,$FF
    out (LINE_PORT),a
    ret
RefLine190:
    ld a,190
    out (LINE_PORT),a
    call SyncFrame
    ld c,$01
    call WaitActive
    ld a,$FF
    out (LINE_PORT),a
    ret
RefLine191Arm0:
    ld a,191
    out (LINE_PORT),a
    call SyncFrame
    ld c,$01
    call WaitActive
    xor a               ; ends 191's pulse, arms line 0
    out (LINE_PORT),a
    ret
RefLine191:
    ld a,191
    out (LINE_PORT),a
    call SyncFrame
    ld c,$01
    call WaitActive
    ld a,$FF
    out (LINE_PORT),a
    ret

; --- Actions: carry = the sample
ActMidiInt:
    in a,(STATUS_PORT)
    and $10
    sub 1               ; carry when active (0)
    ret
ActTx:
    xor a
    in a,($F8)
    and $02
    add a,$FE           ; carry when set
    ret
ActLine:
    in a,(STATUS_PORT)
    and $01
    sub 1
    ret
ActLineInto:
    ld a,100
    out (LINE_PORT),a
    in a,(STATUS_PORT)
    and $01
    sub 1
    ret
ActHpenNot0:
    ld bc,$01F8
    in a,(c)
    cp 1                ; carry while HPEN is 0
    ccf                 ; carry once it is not
    ret
ActHpen:
    ld bc,$01F8
    in a,(c)
    cp 192              ; carry when a screen line
    ret

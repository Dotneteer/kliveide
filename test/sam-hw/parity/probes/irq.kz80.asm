; Parity probe "irq" (Phase 1/2): the interrupt pulses, by polling STATUS from the handler. @use timing
;   PULSEF   frame interrupt: polls of STATUS bit 3 while it stays active (from HALT)
;   PULSEL   line interrupt (line 100): polls of STATUS bit 0 while it stays active (no LINE write)
;   PULSEL0  the same for the line interrupt at line 0
;   F2L0     from the frame interrupt (HALT) to the line interrupt at line 0: polls of STATUS bit 0
;   LPENIRQ  LPEN read first thing in the handler of the line interrupt at line 100 (hc in the border part:
;            reads the border bit; kept as a check that both agree)
; A poll is IN A,(F9h) / INC DE / AND m / JR Z (or JR NZ): one ASIC I/O cycle each.
ProbeMain:
    call TimingSetup
    ld a,$08
    ld (IrqWant),a
    ld a,$FF
    ld (IrqLine),a
    ld hl,PollActive
    call IrqRun
    ld hl,NamePulseF
    call RecordIrq

    ld a,$01
    ld (IrqWant),a
    ld a,100
    ld (IrqLine),a
    ld hl,PollActive
    call IrqRun
    ld hl,NamePulseL
    call RecordIrq

    ld a,$01
    ld (IrqWant),a
    xor a
    ld (IrqLine),a
    ld hl,PollActive
    call IrqRun
    ld hl,NamePulseL0
    call RecordIrq

    ; --- Frame interrupt, then poll until the line interrupt at line 0 shows (LINE set in the handler)
    ld a,$08
    ld (IrqWant),a
    ld a,$FF
    ld (IrqLine),a
    ld hl,PollToLine0
    call IrqRun
    ld hl,NameF2L0
    call RecordIrq
    ret

RecordIrq:
    ld bc,0
    jp Record

; --- Waits (HALT) for the interrupt whose STATUS bit is (IrqWant), with LINE = (IrqLine); then JP (HL)
; --- in the handler; the routine ends with DE = its count and returns here
IrqRun:
    ld (IrqRoutine),hl
    ld hl,IrqIsr
    ld (VECTOR),hl
    ld (SavedSp),sp
    ld a,(IrqLine)
    out (LINE_PORT),a
    ei
IrqWait:
    halt
    jr IrqWait

IrqIsr:
    push af
    in a,(STATUS_PORT)
    ld hl,IrqWant
    and (hl)
    jr nz,IrqIgnore
    ld sp,(SavedSp)
    ld hl,(IrqRoutine)
    ld de,0
    jp (hl)
IrqIgnore:
    pop af
    ei
    reti

; --- Counts polls while the wanted bit stays active (0)
PollActive:
    ld a,(IrqWant)
    ld c,a
PollActiveLoop:
    in a,(STATUS_PORT)
    inc de
    and c
    jr z,PollActiveLoop
IrqEnd:
    ld a,$FF
    out (LINE_PORT),a
    ld hl,Isr
    ld (VECTOR),hl
    ret

; --- From the frame interrupt: LINE = 0, then counts polls until STATUS bit 0 goes active
PollToLine0:
    xor a
    out (LINE_PORT),a
PollToLine0Loop:
    in a,(STATUS_PORT)
    inc de
    and $01
    jr nz,PollToLine0Loop
    jr IrqEnd

IrqWant:        .defb 0
IrqLine:        .defb 0
IrqRoutine:     .defw 0
NamePulseF:     .defm "PULSEF  "
NamePulseL:     .defm "PULSEL  "
NamePulseL0:    .defm "PULSEL0 "
NameF2L0:       .defm "F2L0    "

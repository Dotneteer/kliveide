; =============================================================================
; Sweeps for the parity probes (Phase 2), appended after a probe that contains "@use sweep" (with
; "@use timing"). Klive's own code.
;
; A sweep runs 32 times, k = 0-31: the reference routine at (SweepRef) returns at a fixed moment
; (interrupts off), a 16-bit delay loop runs (SweepDelay) rounds, the sled runs its last k NOPs (4 T each
; in the border, 8 T in the screen's contention), then the action at (SweepAction) returns one bit in
; carry. The 32 bits (k = 0 in bit 0) are recorded under the name at HL.
; =============================================================================

; --- One sweep; HL: the record's name
Sweep:
    ld (SweepName),hl
    ld hl,0
    ld (SweepBits),hl
    ld (SweepBits + 2),hl
    ; --- The sled: 32 NOPs, then JP SweepTail
    ld hl,LOOPBUF
    ld b,32
SweepNops:
    ld (hl),0
    inc hl
    djnz SweepNops
    ld (hl),$C3
    inc hl
    ld (hl),SweepTail & $FF
    inc hl
    ld (hl),SweepTail >> 8
    xor a
    ld (SweepK),a
SweepNext:
    ld hl,(SweepRef)
    call JumpHl
    ld bc,(SweepDelay)
SweepDelayLoop:
    dec bc
    ld a,b
    or c
    jr nz,SweepDelayLoop
    ld a,(SweepK)
    ld e,a
    ld d,0
    ld hl,LOOPBUF + 32
    or a
    sbc hl,de
    jp (hl)
SweepTail:
    ld hl,(SweepAction)
    call JumpHl
    ; --- The bit into SweepBits (k = 0 in bit 0): rotate the 32-bit value right, the bit into bit 31
    ld hl,SweepBits + 3
    rr (hl)
    dec hl
    rr (hl)
    dec hl
    rr (hl)
    dec hl
    rr (hl)
    ld a,(SweepK)
    inc a
    ld (SweepK),a
    cp 32
    jr c,SweepNext
    ld a,$FF
    out (LINE_PORT),a
    ld de,(SweepBits)
    ld bc,(SweepBits + 2)
    ld hl,(SweepName)
    jp Record

JumpHl:
    jp (hl)

SweepRef:       .defw 0
SweepAction:    .defw 0
SweepDelay:     .defw 1
SweepName:      .defw 0
SweepK:         .defb 0
SweepBits:      .defs 4

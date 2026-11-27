; Parity probe "stair-late" (Phase 1): staircases (timing.inc.asm) started later in the line, so that
; the block runs across the screen-to-border boundary (hc 380) and LPEN shows where it ends. @use timing
ProbeMain:
    call TimingSetup
    ld a,16
    ld (StairDelayN),a
    ld hl,Table16
    call StairTable
    ld a,22
    ld (StairDelayN),a
    ld hl,Table22
    jp StairTable

Table16:
    .defm "EMP16 "
    .defw L_empty
    .defb L_empty_end - L_empty
    .defm "PSH16 "
    .defw L_pushpop
    .defb L_pushpop_end - L_pushpop
    .defm "INC16 "
    .defw L_inchl
    .defb L_inchl_end - L_inchl
    .defb 0
Table22:
    .defm "EMP22 "
    .defw L_empty
    .defb L_empty_end - L_empty
    .defm "PSH22 "
    .defw L_pushpop
    .defb L_pushpop_end - L_pushpop
    .defb 0

L_empty:
L_empty_end:
L_pushpop:
    push bc
    pop bc
L_pushpop_end:
L_inchl:
    ld hl,DATA
    inc (hl)
L_inchl_end:

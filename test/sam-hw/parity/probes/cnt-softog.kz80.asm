; Parity probe "cnt-softog" (Phase 2): loop counts of blocks that switch SOFF on and off again (border
; bit 7, mode 4), with 0-8 NOPs between, in both windows (timing.inc.asm): when SOFF's change of the
; contention (the whole frame as border) takes effect. @use timing
ProbeMain:
    call TimingSetup
    ld hl,Table
    jp MeasureTable

Table:
    .defm "TOG0   "
    .defw T_0
    .defb T_0_end - T_0
    .defm "TOG1   "
    .defw T_1
    .defb T_1_end - T_1
    .defm "TOG2   "
    .defw T_2
    .defb T_2_end - T_2
    .defm "TOG4   "
    .defw T_4
    .defb T_4_end - T_4
    .defm "TOG8   "
    .defw T_8
    .defb T_8_end - T_8
    .defm "BORD0  "
    .defw T_b
    .defb T_b_end - T_b
    .defb 0

T_0:
    ld a,$80
    out ($FE),a
    xor a
    out ($FE),a
T_0_end:
T_1:
    ld a,$80
    out ($FE),a
    nop
    xor a
    out ($FE),a
T_1_end:
T_2:
    ld a,$80
    out ($FE),a
    nop
    nop
    xor a
    out ($FE),a
T_2_end:
T_4:
    ld a,$80
    out ($FE),a
    nop
    nop
    nop
    nop
    xor a
    out ($FE),a
T_4_end:
T_8:
    ld a,$80
    out ($FE),a
    nop
    nop
    nop
    nop
    nop
    nop
    nop
    nop
    xor a
    out ($FE),a
T_8_end:
T_b:
    ld a,$00            ; the same instructions with no SOFF (the control)
    out ($FE),a
    nop
    nop
    xor a
    out ($FE),a
T_b_end:

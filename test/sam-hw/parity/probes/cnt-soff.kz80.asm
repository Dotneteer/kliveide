; Parity probe "cnt-soff" (Phase 2): loop counts with SOFF on (border bit 7, mode 4: the screen off), in
; both windows (timing.inc.asm), to compare the contention while the screen is off. @use timing
ProbeMain:
    call TimingSetup
    ld a,$80            ; SOFF, border 0
    out ($FE),a
    ld hl,Table
    call MeasureTable
    xor a
    out ($FE),a
    ret

Table:
    .defm "EMPTY  "
    .defw O_empty
    .defb O_empty_end - O_empty
    .defm "NOP    "
    .defw O_nop
    .defb O_nop_end - O_nop
    .defm "LDAHL  "
    .defw O_ldahl
    .defb O_ldahl_end - O_ldahl
    .defm "PUSHPOP"
    .defw O_pushpop
    .defb O_pushpop_end - O_pushpop
    .defm "INSTAT "
    .defw O_instat
    .defb O_instat_end - O_instat
    .defm "INLPEN "
    .defw O_inlpen
    .defb O_inlpen_end - O_inlpen
    .defb 0

O_empty:
O_empty_end:
O_nop:
    nop
O_nop_end:
O_ldahl:
    ld a,(hl)
O_ldahl_end:
O_pushpop:
    push bc
    pop bc
O_pushpop_end:
O_instat:
    in a,($F9)
O_instat_end:
O_inlpen:
    xor a
    in a,($F8)
O_inlpen_end:

; Parity probe "cnt-mode1" (Phase 1): cnt-core's main blocks with the screen in mode 1 (64-T contention
; stripes every 128 T, the border included), in both windows (timing.inc.asm). @use timing
ProbeMain:
    call TimingSetup
    ld a,$1E            ; VMPR: mode 1, page 30
    out ($FC),a
    ld hl,Table
    call MeasureTable
    ld a,$7E            ; mode 4 again
    out ($FC),a
    ret

Table:
    .defm "EMPTY  "
    .defw M_empty
    .defb M_empty_end - M_empty
    .defm "NOP    "
    .defw M_nop
    .defb M_nop_end - M_nop
    .defm "LDAHL  "
    .defw M_ldahl
    .defb M_ldahl_end - M_ldahl
    .defm "INCHL  "
    .defw M_inchl
    .defb M_inchl_end - M_inchl
    .defm "PUSHPOP"
    .defw M_pushpop
    .defb M_pushpop_end - M_pushpop
    .defm "ADDHLBC"
    .defw M_addhl
    .defb M_addhl_end - M_addhl
    .defm "INSTAT "
    .defw M_instat
    .defb M_instat_end - M_instat
    .defm "OUTFE  "
    .defw M_outfe
    .defb M_outfe_end - M_outfe
    .defb 0

M_empty:
M_empty_end:
M_nop:
    nop
M_nop_end:
M_ldahl:
    ld a,(hl)
M_ldahl_end:
M_inchl:
    inc (hl)
M_inchl_end:
M_pushpop:
    push bc
    pop bc
M_pushpop_end:
M_addhl:
    add hl,bc
M_addhl_end:
M_instat:
    in a,($F9)
M_instat_end:
M_outfe:
    xor a
    out ($FE),a
M_outfe_end:

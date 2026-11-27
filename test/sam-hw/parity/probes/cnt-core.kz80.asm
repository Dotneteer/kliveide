; Parity probe "cnt-core" (Phase 1): loop counts of core instructions, code and data in page 1
; (internal RAM), in the border window and the screen window (timing.inc.asm). @use timing
ProbeMain:
    call TimingSetup
    ld hl,Table
    jp MeasureTable

Table:
    .defm "EMPTY  "
    .defw B_empty
    .defb B_empty_end - B_empty
    .defm "NOP    "
    .defw B_nop
    .defb B_nop_end - B_nop
    .defm "NOP4   "
    .defw B_nop4
    .defb B_nop4_end - B_nop4
    .defm "LDAN   "
    .defw B_ldan
    .defb B_ldan_end - B_ldan
    .defm "LDAHL  "
    .defw B_ldahl
    .defb B_ldahl_end - B_ldahl
    .defm "LDHLA  "
    .defw B_ldhla
    .defb B_ldhla_end - B_ldhla
    .defm "LDANN  "
    .defw B_ldann
    .defb B_ldann_end - B_ldann
    .defm "LDNNA  "
    .defw B_ldnna
    .defb B_ldnna_end - B_ldnna
    .defm "INCHL  "
    .defw B_inchl
    .defb B_inchl_end - B_inchl
    .defm "PUSHPOP"
    .defw B_pushpop
    .defb B_pushpop_end - B_pushpop
    .defm "EXSPHL "
    .defw B_exsphl
    .defb B_exsphl_end - B_exsphl
    .defm "CALLRET"
    .defw B_callret
    .defb B_callret_end - B_callret
    .defm "JRT    "
    .defw B_jrt
    .defb B_jrt_end - B_jrt
    .defm "JRNT   "
    .defw B_jrnt
    .defb B_jrnt_end - B_jrnt
    .defm "DJNZ   "
    .defw B_djnz
    .defb B_djnz_end - B_djnz
    .defm "ADDHLBC"
    .defw B_addhl
    .defb B_addhl_end - B_addhl
    .defm "LDHLNN "
    .defw B_ldhlnn
    .defb B_ldhlnn_end - B_ldhlnn
    .defm "LDNNHL "
    .defw B_ldnnhl
    .defb B_ldnnhl_end - B_ldnnhl
    .defm "EXX    "
    .defw B_exx
    .defb B_exx_end - B_exx
    .defm "DAA    "
    .defw B_daa
    .defb B_daa_end - B_daa
    .defb 0

; --- The blocks (copied to LOOPBUF; never run here)
B_empty:
B_empty_end:
B_nop:
    nop
B_nop_end:
B_nop4:
    nop
    nop
    nop
    nop
B_nop4_end:
B_ldan:
    ld a,$55
B_ldan_end:
B_ldahl:
    ld a,(hl)
B_ldahl_end:
B_ldhla:
    ld (hl),a
B_ldhla_end:
B_ldann:
    ld a,(DATA + 2)
B_ldann_end:
B_ldnna:
    ld (DATA + 2),a
B_ldnna_end:
B_inchl:
    inc (hl)
B_inchl_end:
B_pushpop:
    push bc
    pop bc
B_pushpop_end:
B_exsphl:
    ex (sp),hl
B_exsphl_end:
B_callret:
    call DATA + $10     ; the RET TimingSetup puts there
B_callret_end:
B_jrt:
    jr B_jrt_next
B_jrt_next:
B_jrt_end:
B_jrnt:
    or a
    jr c,B_jrnt_end
B_jrnt_end:
B_djnz:
    ld b,2
B_djnz_loop:
    djnz B_djnz_loop
B_djnz_end:
B_addhl:
    add hl,bc
B_addhl_end:
B_ldhlnn:
    ld hl,(DATA + 4)
B_ldhlnn_end:
B_ldnnhl:
    ld (DATA + 4),hl
B_ldnnhl_end:
B_exx:
    exx
B_exx_end:
B_daa:
    daa
B_daa_end:

; Parity probe "cnt-io" (Phase 1): loop counts of I/O instructions on ASIC ports (F8h-FFh, held 1 in 8)
; and an unmapped port (7Fh, never held), code in page 1, in both windows (timing.inc.asm). @use timing
; The writes go to ports with no effect here (7Fh) or write what is already there (border 0, LINE off).
ProbeMain:
    call TimingSetup
    ld hl,Table
    jp MeasureTable

Table:
    .defm "INSTAT "
    .defw B_instat
    .defb B_instat_end - B_instat
    .defm "INFE   "
    .defw B_infe
    .defb B_infe_end - B_infe
    .defm "IN7F   "
    .defw B_in7f
    .defb B_in7f_end - B_in7f
    .defm "INCFE  "
    .defw B_incfe
    .defb B_incfe_end - B_incfe
    .defm "INC7F  "
    .defw B_inc7f
    .defb B_inc7f_end - B_inc7f
    .defm "OUTFE  "
    .defw B_outfe
    .defb B_outfe_end - B_outfe
    .defm "OUT7F  "
    .defw B_out7f
    .defb B_out7f_end - B_out7f
    .defm "OUTCFE "
    .defw B_outcfe
    .defb B_outcfe_end - B_outcfe
    .defm "INLPEN "
    .defw B_inlpen
    .defb B_inlpen_end - B_inlpen
    .defm "POLL   "
    .defw B_poll
    .defb B_poll_end - B_poll
    .defm "INI7F  "
    .defw B_ini7f
    .defb B_ini7f_end - B_ini7f
    .defm "OUTI7F "
    .defw B_outi7f
    .defb B_outi7f_end - B_outi7f
    .defm "INIFE  "
    .defw B_inife
    .defb B_inife_end - B_inife
    .defb 0

B_instat:
    in a,($F9)
B_instat_end:
B_infe:
    ld a,$FF
    in a,($FE)
B_infe_end:
B_in7f:
    in a,($7F)
B_in7f_end:
B_incfe:
    ld bc,$FFFE
    in a,(c)
B_incfe_end:
B_inc7f:
    ld bc,$FF7F
    in a,(c)
B_inc7f_end:
B_outfe:
    xor a
    out ($FE),a
B_outfe_end:
B_out7f:
    out ($7F),a
B_out7f_end:
B_outcfe:
    ld bc,$00FE
    xor a
    out (c),a
B_outcfe_end:
B_inlpen:
    xor a
    in a,($F8)
B_inlpen_end:
B_poll:
    in a,($F9)
    inc de
    and $01
    jr nz,B_poll_end
B_poll_end:
B_ini7f:
    ld hl,DATA
    ld bc,$017F
    ini
B_ini7f_end:
B_outi7f:
    ld hl,DATA
    ld bc,$017F
    outi
B_outi7f_end:
B_inife:
    ld hl,DATA
    ld bc,$FFFE
    ini
B_inife_end:

; Parity probe "cnt-prefix" (Phase 1): loop counts of prefixed instructions (CB, ED, DD/FD, DDCB) and
; undocumented ones, code and data in page 1, in both windows (timing.inc.asm). @use timing
ProbeMain:
    call TimingSetup
    ld hl,Table
    jp MeasureTable

Table:
    .defm "LDAIX  "
    .defw B_ldaix
    .defb B_ldaix_end - B_ldaix
    .defm "LDIXA  "
    .defw B_ldixa
    .defb B_ldixa_end - B_ldixa
    .defm "INCIX  "
    .defw B_incix
    .defb B_incix_end - B_incix
    .defm "LDIXN  "
    .defw B_ldixn
    .defb B_ldixn_end - B_ldixn
    .defm "BITIX  "
    .defw B_bitix
    .defb B_bitix_end - B_bitix
    .defm "SETIX  "
    .defw B_setix
    .defb B_setix_end - B_setix
    .defm "RLCIXA "
    .defw B_rlcixa
    .defb B_rlcixa_end - B_rlcixa
    .defm "LDIXHA "
    .defw B_ldixha
    .defb B_ldixha_end - B_ldixha
    .defm "RLCA_CB"
    .defw B_rlc
    .defb B_rlc_end - B_rlc
    .defm "SLLA   "
    .defw B_sll
    .defb B_sll_end - B_sll
    .defm "BITHL  "
    .defw B_bithl
    .defb B_bithl_end - B_bithl
    .defm "SETHL  "
    .defw B_sethl
    .defb B_sethl_end - B_sethl
    .defm "RLD    "
    .defw B_rld
    .defb B_rld_end - B_rld
    .defm "NEG    "
    .defw B_neg
    .defb B_neg_end - B_neg
    .defm "LDAI   "
    .defw B_ldai
    .defb B_ldai_end - B_ldai
    .defm "ADCHL  "
    .defw B_adchl
    .defb B_adchl_end - B_adchl
    .defm "LDNNBC "
    .defw B_ldnnbc
    .defb B_ldnnbc_end - B_ldnnbc
    .defm "EDNOP  "
    .defw B_ednop
    .defb B_ednop_end - B_ednop
    .defm "INCIXR "
    .defw B_incixr
    .defb B_incixr_end - B_incixr
    .defm "DDNOP  "
    .defw B_ddnop
    .defb B_ddnop_end - B_ddnop
    .defb 0

B_ldaix:
    ld a,(ix+5)
B_ldaix_end:
B_ldixa:
    ld (ix+5),a
B_ldixa_end:
B_incix:
    inc (ix+5)
B_incix_end:
B_ldixn:
    ld (ix+5),$12
B_ldixn_end:
B_bitix:
    bit 3,(ix+5)
B_bitix_end:
B_setix:
    set 3,(ix+5)
B_setix_end:
B_rlcixa:
    .defb $DD, $CB, $05, $07    ; RLC (IX+5),A (undocumented)
B_rlcixa_end:
B_ldixha:
    .defb $DD, $67              ; LD IXH,A (undocumented)
B_ldixha_end:
B_rlc:
    rlc a
B_rlc_end:
B_sll:
    .defb $CB, $37              ; SLL A (undocumented)
B_sll_end:
B_bithl:
    bit 3,(hl)
B_bithl_end:
B_sethl:
    set 3,(hl)
B_sethl_end:
B_rld:
    rld
B_rld_end:
B_neg:
    neg
B_neg_end:
B_ldai:
    ld a,i
B_ldai_end:
B_adchl:
    adc hl,bc
B_adchl_end:
B_ldnnbc:
    ld (DATA + 6),bc
B_ldnnbc_end:
B_ednop:
    .defb $ED, $00              ; an undefined ED opcode (8 T, a NOP)
B_ednop_end:
B_incixr:
    inc ix
B_incixr_end:
B_ddnop:
    .defb $DD, $00              ; DD before NOP (8 T)
B_ddnop_end:

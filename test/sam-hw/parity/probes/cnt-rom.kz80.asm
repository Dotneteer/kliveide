; Parity probe "cnt-rom" (Phase 1): loop counts with an opcode fetch or data from ROM0 (never held),
; code in page 1, in both windows (timing.inc.asm). @use timing
;   CALLROM  CALL to a RET in ROM0 (the first C9h from 0000h: the same ROM in both emulators)
;   LDAROM   LD A,(0005h)        LDHLROM  LD HL,(0006h)        LDIROM  LDI from ROM to page 1
ProbeMain:
    call TimingSetup
    ld hl,0
    ld bc,$4000
    ld a,$C9
    cpir
    dec hl
    ld (B_callrom + 1),hl
    ld hl,Table
    jp MeasureTable

Table:
    .defm "CALLROM"
    .defw B_callrom
    .defb B_callrom_end - B_callrom
    .defm "LDAROM "
    .defw B_ldarom
    .defb B_ldarom_end - B_ldarom
    .defm "LDHLROM"
    .defw B_ldhlrom
    .defb B_ldhlrom_end - B_ldhlrom
    .defm "LDIROM "
    .defw B_ldirom
    .defb B_ldirom_end - B_ldirom
    .defm "LDIRAM "
    .defw B_ldiram
    .defb B_ldiram_end - B_ldiram
    .defb 0

B_callrom:
    call $0000          ; patched: a RET in ROM0
B_callrom_end:
B_ldarom:
    ld a,($0005)
B_ldarom_end:
B_ldhlrom:
    ld hl,($0006)
B_ldhlrom_end:
B_ldirom:
    ld hl,$0010
    ld de,DATA + $100
    ld bc,3
    ldi
B_ldirom_end:
B_ldiram:
    ld hl,DATA
    ld de,DATA + $100
    ld bc,3
    ldi
B_ldiram_end:

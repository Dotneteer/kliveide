; Parity probe "cnt-block" (Phase 1): loop counts of block instructions, code and data in page 1, in both
; windows (timing.inc.asm). Each block sets its own registers. @use timing
ProbeMain:
    call TimingSetup
    ld hl,Table
    jp MeasureTable

Table:
    .defm "SETUP  "
    .defw B_setup
    .defb B_setup_end - B_setup
    .defm "LDI    "
    .defw B_ldi
    .defb B_ldi_end - B_ldi
    .defm "LDD    "
    .defw B_ldd
    .defb B_ldd_end - B_ldd
    .defm "LDIR3  "
    .defw B_ldir
    .defb B_ldir_end - B_ldir
    .defm "LDDR3  "
    .defw B_lddr
    .defb B_lddr_end - B_lddr
    .defm "CPI    "
    .defw B_cpi
    .defb B_cpi_end - B_cpi
    .defm "CPIR3  "
    .defw B_cpir
    .defb B_cpir_end - B_cpir
    .defm "INIR2  "
    .defw B_inir
    .defb B_inir_end - B_inir
    .defm "OTIR2  "
    .defw B_otir
    .defb B_otir_end - B_otir
    .defm "INIRFE "
    .defw B_inirfe
    .defb B_inirfe_end - B_inirfe
    .defb 0

; --- The registers every block below loads (the baseline)
B_setup:
    ld hl,DATA
    ld de,DATA + $100
    ld bc,3
B_setup_end:
B_ldi:
    ld hl,DATA
    ld de,DATA + $100
    ld bc,3
    ldi
B_ldi_end:
B_ldd:
    ld hl,DATA
    ld de,DATA + $100
    ld bc,3
    ldd
B_ldd_end:
B_ldir:
    ld hl,DATA
    ld de,DATA + $100
    ld bc,3
    ldir
B_ldir_end:
B_lddr:
    ld hl,DATA
    ld de,DATA + $100
    ld bc,3
    lddr
B_lddr_end:
B_cpi:
    ld hl,DATA
    ld de,DATA + $100
    ld bc,3
    cpi
B_cpi_end:
B_cpir:
    ld hl,DATA
    ld de,DATA + $100
    ld bc,3
    ld a,$5A            ; not in DATA's first bytes: runs to BC = 0
    cpir
B_cpir_end:
B_inir:
    ld hl,DATA
    ld de,DATA + $100
    ld bc,$027F         ; port 7Fh (not the ASIC), 2 bytes
    inir
B_inir_end:
B_otir:
    ld hl,DATA
    ld de,DATA + $100
    ld bc,$027F
    otir
B_otir_end:
B_inirfe:
    ld hl,DATA
    ld de,DATA + $100
    ld bc,$02FE         ; port FEh (the ASIC), 2 bytes
    inir
B_inirfe_end:

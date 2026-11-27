; Parity probe "cnt-ext" (Phase 1): loop counts with the whole program in external RAM (never held), in
; both windows (timing.inc.asm). Needs a 1 MB external pack in both emulators. @use timing @extmem
;
; A position-independent copier, placed at 4B00h of page 0 and of page 2, pages page 1 into section A and
; page 2 into B (LMPR = RAM0 | 1: execution goes on in page 2's copy), maps external pages 0 and 1 into
; sections C and D (LEPR, HEPR, HMPR bit 7), copies pages 1 and 2 there, and puts LMPR back. The program
; then runs on from its external copy. DATA is external now; DATAI (4C00h, page 0) is internal RAM.
DATAI           .equ $4C00

ProbeMain:
    di
    ld hl,Copier
    ld de,$4B00
    ld bc,CopierEnd - Copier
    ldir
    ld hl,Copier
    ld de,$CB00         ; page 2 at 0B00h
    ld bc,CopierEnd - Copier
    ldir
    call $4B00
    call TimingSetup
    ld hl,Table
    jp MeasureTable

Copier:
    ld a,$21            ; LMPR: RAM0, page 1 in A, page 2 in B
    out ($FA),a
    xor a
    out ($80),a         ; LEPR: external page 0
    inc a
    out ($81),a         ; HEPR: external page 1
    in a,($FB)
    or $80
    out ($FB),a         ; HMPR bit 7: C and D from the external pack
    ld hl,$0000
    ld de,$8000
    ld bc,$8000
    ldir                ; pages 1 and 2 into external pages 0 and 1
    ld a,$1F            ; LMPR: ROM0, page 0 in B
    out ($FA),a
    ret
CopierEnd:

Table:
    .defm "EMPTY  "
    .defw X_empty
    .defb X_empty_end - X_empty
    .defm "NOP    "
    .defw X_nop
    .defb X_nop_end - X_nop
    .defm "LDAHL  "
    .defw X_ldahl
    .defb X_ldahl_end - X_ldahl
    .defm "LDAINT "
    .defw X_ldaint
    .defb X_ldaint_end - X_ldaint
    .defm "LDINTA "
    .defw X_ldinta
    .defb X_ldinta_end - X_ldinta
    .defm "LDINTN "
    .defw X_ldintn
    .defb X_ldintn_end - X_ldintn
    .defm "INCHL  "
    .defw X_inchl
    .defb X_inchl_end - X_inchl
    .defm "PUSHPOP"
    .defw X_pushpop
    .defb X_pushpop_end - X_pushpop
    .defm "EXSPHL "
    .defw X_exsphl
    .defb X_exsphl_end - X_exsphl
    .defm "LDIRINT"
    .defw X_ldirint
    .defb X_ldirint_end - X_ldirint
    .defm "INSTAT "
    .defw X_instat
    .defb X_instat_end - X_instat
    .defm "OUTFE  "
    .defw X_outfe
    .defb X_outfe_end - X_outfe
    .defb 0

X_empty:
X_empty_end:
X_nop:
    nop
X_nop_end:
X_ldahl:
    ld a,(hl)
X_ldahl_end:
X_ldaint:
    ld a,(DATAI)
X_ldaint_end:
X_ldinta:
    ld (DATAI),a
X_ldinta_end:
X_ldintn:
    ld hl,DATAI
    ld (hl),$12
X_ldintn_end:
X_inchl:
    inc (hl)
X_inchl_end:
X_pushpop:
    push bc
    pop bc
X_pushpop_end:
X_exsphl:
    ex (sp),hl
X_exsphl_end:
X_ldirint:
    ld hl,DATAI
    ld de,DATAI + $40
    ld bc,3
    ldir
X_ldirint_end:
X_instat:
    in a,($F9)
X_instat_end:
X_outfe:
    xor a
    out ($FE),a
X_outfe_end:

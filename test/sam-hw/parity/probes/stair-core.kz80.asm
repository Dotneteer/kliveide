; Parity probe "stair-core" (Phase 1): LPEN after the line interrupt at line 100, k NOPs (0-31) and a
; block (timing.inc.asm, StairTable). The blocks that differed in cnt-core's screen window. @use timing
; In a staircase HL is the sled's address: a block that uses (HL) sets HL itself.
ProbeMain:
    call TimingSetup
    ld hl,Table
    jp StairTable

Table:
    .defm "EMPTY "
    .defw S_empty
    .defb S_empty_end - S_empty
    .defm "ADDHL "
    .defw S_addhl
    .defb S_addhl_end - S_addhl
    .defm "PUSHPP"
    .defw S_pushpop
    .defb S_pushpop_end - S_pushpop
    .defm "LDHL  "
    .defw S_ldhl
    .defb S_ldhl_end - S_ldhl
    .defm "INCHL "
    .defw S_inchl
    .defb S_inchl_end - S_inchl
    .defb 0

S_empty:
S_empty_end:
S_addhl:
    add hl,bc
S_addhl_end:
S_pushpop:
    push bc
    pop bc
S_pushpop_end:
S_ldhl:
    ld hl,DATA
S_ldhl_end:
S_inchl:
    ld hl,DATA
    inc (hl)
S_inchl_end:

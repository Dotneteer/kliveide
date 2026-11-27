; =============================================================================
; The ROM's LOAD from tape (Phase 6). `parity.ts` appends this file after a probe that contains
; "@use taperom". The probe's "@typed" line is LOAD "" CODE 81920: BOOT, so this program runs only after
; ROM 3.0 loaded the tape's CODE file (100 bytes) into page 4. Klive's own code.
;   LOADSUM   the 100 bytes summed (16 bits)
;   LOADXOR   the 100 bytes XORed
;   LOAD0     bytes 0-3 (byte 0 in bits 0-7)
;   LOAD96    bytes 96-99
; =============================================================================

TAPE_LENGTH     .equ 100

ProbeMain:
    ; --- Page 4 into section B for the copy (the ROM's interrupt needs page 0 there: interrupts off)
    di
    in a,($FA)
    ld (TapeLmpr),a
    and $E0
    or 3                ; section A page 3, section B page 4
    out ($FA),a
    ld hl,$4000
    ld de,TapeBuf
    ld bc,TAPE_LENGTH
    ldir
    ld a,(TapeLmpr)
    out ($FA),a
    ei
    ; --- Sum and XOR
    ld hl,TapeBuf
    ld de,0
    ld c,0
    ld b,TAPE_LENGTH
TapeSum:
    ld a,(hl)
    xor c
    ld c,a
    ld a,(hl)
    add a,e
    ld e,a
    jr nc,TapeNoCarry
    inc d
TapeNoCarry:
    inc hl
    djnz TapeSum
    push bc
    ld bc,0
    ld hl,NameLoadSum
    call Record
    pop bc
    ld a,c
    ld hl,NameLoadXor
    call RecordA
    ld de,(TapeBuf)
    ld bc,(TapeBuf + 2)
    ld hl,NameLoad0
    call Record
    ld de,(TapeBuf + 96)
    ld bc,(TapeBuf + 98)
    ld hl,NameLoad96
    jp Record

TapeLmpr:       .defb 0
NameLoadSum:    .defm "LOADSUM "
NameLoadXor:    .defm "LOADXOR "
NameLoad0:      .defm "LOAD0   "
NameLoad96:     .defm "LOAD96  "
TapeBuf:        .defs TAPE_LENGTH

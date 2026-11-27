; =============================================================================
; The parity probes' shared frame (dev/plans/SAM_SIMCOUPE_PARITY_PLAN.md §1-§2). Klive's own code.
;
; `parity.ts` assembles this file followed by one probe. The probe defines `ProbeMain`, which records
; values with `Record` (HL: an 8-character name; DE: the low word, BC: the high word). This frame then
; writes the result block to the boot disk's last sector (track 79, side 2, sector 10) through drive 1's
; VL1772, and signals the end with a green border (failure: a red one) and an endless loop.
;
; The result block (512 bytes): "KLPR", version 1, the record count, ten zero bytes, then 12-byte records:
; the name (8 bytes) and the value (32 bits, little-endian). At most 41 records.
;
; Run's paging is in force: ROM0 and page 0 at 0000h-7FFFh, page 1 at 8000h, page 2 at C000h, IM 1 with
; SAM BASIC's frame handler, interrupts on.
; =============================================================================
    .model SAMCOUPE

FDC             .equ $E4            ; drive 1, side 2 (A2 = 1)
RESULT_TRACK    .equ 79
RESULT_SECTOR   .equ 10
MAX_RECORDS     .equ 41

Start:
    ld sp,$BFF0
    ld hl,Result
    ld de,Result + 1
    ld bc,511
    ld (hl),0
    ldir
    ld hl,Magic
    ld de,Result
    ld bc,5
    ldir
    ld hl,Result + 16
    ld (RecordPtr),hl
    call ProbeMain
    di
    call WriteResult
    ld a,4              ; green: done
    jr z,Signal
    ld a,2              ; red: the write failed
Signal:
    out ($FE),a
    ei
Halt:
    jr Halt

; --- Records HL's 8-byte name with the value BC:DE; ignored past MAX_RECORDS
Record:
    push hl
    ld a,(Result + 5)
    cp MAX_RECORDS
    jr nc,RecordFull
    inc a
    ld (Result + 5),a
    push de
    ld de,(RecordPtr)
    push bc
    ld bc,8
    ldir
    pop bc
    ex de,hl
    pop de
    ld (hl),e
    inc hl
    ld (hl),d
    inc hl
    ld (hl),c
    inc hl
    ld (hl),b
    inc hl
    ld (RecordPtr),hl
RecordFull:
    pop hl
    ret

; --- Records the byte in A under the name at HL
RecordA:
    ld e,a
    ld d,0
    ld bc,0
    jr Record

; --- Waits for the controller (C: its status port); A: the status
WaitReady:
    in a,(c)
    bit 0,a
    jr nz,WaitReady
    ret

; --- Writes the result block; Z on success
WriteResult:
    ld c,FDC
    ld a,RESULT_TRACK
    inc c
    inc c
    inc c
    out (c),a           ; data register: the cylinder
    dec c
    ld a,RESULT_SECTOR
    out (c),a           ; sector register
    dec c
    dec c
    ld a,$10
    out (c),a           ; SEEK, 6 ms steps, spin-up
    call WaitReady
    ld hl,Result
    ld a,$A0
    out (c),a           ; WRITE SECTOR
WriteLoop:
    in a,(c)
    bit 1,a
    jr nz,WriteByte
    bit 0,a
    jr nz,WriteLoop
    and $5C             ; write protect, record not found, CRC error, lost data
    ret
WriteByte:
    inc c
    inc c
    inc c
    outi
    dec c
    dec c
    dec c
    jr WriteLoop

Magic:
    .defm "KLPR"
    .defb 1
RecordPtr:
    .defw 0

    .org $9000
Result:
    .defs 512

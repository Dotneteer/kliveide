; =============================================================================
; Disk controller helpers for the parity probes (Phase 5), appended after a probe that contains
; "@use fdc" (with "@use timing"). Klive's own code. Interrupts off; every timed command starts from
; SyncFrame (a HALT-based moment). FdcBase is the controller's first port: E0h drive 1 side 1, E4h drive 1
; side 2, F0h drive 2 side 1.
;
; A timed result (FdcRecord): bytes 0-2 the status polls until BUSY cleared (24 bits), byte 3 the status.
; =============================================================================

FdcBase:        .defb $E0
FdcPolls:       .defs 3
FdcStatus:      .defb 0
FdcSum:         .defw 0
FdcCount:       .defw 0
FdcBuf:         .defs 512

; --- C = FdcBase + register (0 status/command, 1 track, 2 sector, 3 data)
FdcPort:
    ld a,(FdcBase)
    add a,c
    ld c,a
    ret

; --- Writes A to register E (1 track, 2 sector, 3 data)
FdcSetReg:
    ld b,a
    ld c,e
    call FdcPort
    out (c),b
    ret

; --- Waits for the controller with no timing (after an untimed command)
FdcIdle:
    ld c,0
    call FdcPort
FdcIdleLoop:
    in a,(c)
    rra
    jr c,FdcIdleLoop
    ret

; --- Issues command A untimed and waits
FdcDo:
    ld b,a
    ld c,0
    call FdcPort
    out (c),b
    nop
    nop
    nop
    nop
    jr FdcIdle

; --- From SyncFrame, issues command A and counts the status polls until BUSY clears; type II/III data
; --- moves through FdcBuf (reads summed into FdcSum, counted in FdcCount; writes from FdcBuf)
FdcTimed:
    push af
    call SyncFrame
    pop af
    ld b,a
    ld c,0
    call FdcPort
    ld hl,0
    ld (FdcSum),hl
    ld (FdcCount),hl
    ld ix,FdcBuf
    out (c),b
    ld a,b
    and $F0
    cp $A0              ; WRITE SECTOR: data goes out
    jr z,FdcTimedWrite
    nop
    nop
    nop
    nop
    ld de,0
    ld h,0
FdcTimedPoll:
    in a,(c)
    bit 1,a
    jr nz,FdcTimedData
FdcTimedNext:
    bit 0,a
    jr z,FdcTimedDone
    inc de
    ld a,d
    or e
    jr nz,FdcTimedPoll
    inc h
    jr FdcTimedPoll
FdcTimedData:
    ld a,(FdcBase)      ; DRQ on a type II/III command: a byte in
    add a,3
    push bc
    ld c,a
    in a,(c)
    pop bc
    push hl
    ld hl,(FdcCount)    ; only the first 512 bytes are kept (READ TRACK reads a whole track)
    push af
    ld a,h
    cp 2
    jr nc,FdcNoKeep
    pop af
    ld (ix+0),a
    inc ix
    jr FdcKept
FdcNoKeep:
    pop af
FdcKept:
    ld hl,(FdcSum)
    add a,l
    ld l,a
    jr nc,FdcSumOk
    inc h
FdcSumOk:
    ld (FdcSum),hl
    ld hl,(FdcCount)
    inc hl
    ld (FdcCount),hl
    pop hl
    in a,(c)
    jr FdcTimedNext
FdcTimedWrite:
    ld de,0
    ld h,0
FdcWritePoll:
    in a,(c)
    bit 1,a
    jr nz,FdcWriteData
    bit 0,a
    jr z,FdcTimedDone
    inc de
    ld a,d
    or e
    jr nz,FdcWritePoll
    inc h
    jr FdcWritePoll
FdcWriteData:
    ld a,(FdcBase)
    add a,3
    push bc
    ld c,a
    ld a,(ix+0)
    out (c),a
    pop bc
    inc ix
    push hl
    ld hl,(FdcCount)
    inc hl
    ld (FdcCount),hl
    pop hl
    jr FdcWritePoll
FdcTimedDone:
    ld (FdcPolls),de
    ld a,h
    ld (FdcPolls + 2),a
    in a,(c)
    ld (FdcStatus),a
    ret

; --- Records the last timed command under the name at HL
FdcRecord:
    ld de,(FdcPolls)
    ld a,(FdcPolls + 2)
    ld c,a
    ld a,(FdcStatus)
    ld b,a
    jp Record

; --- Records FdcSum (low word) and FdcCount (high word) under the name at HL
FdcRecordData:
    ld de,(FdcSum)
    ld bc,(FdcCount)
    jp Record

; --- Fast data transfers (well inside the 1772's 32 us a byte, screen contention included). From
; --- SyncFrame, command A; FdcReadStore keeps the bytes in FdcBuf (at most 512: sectors and IDs), then sums
; --- them; FdcReadCount only counts (READ TRACK). FdcCount the bytes, FdcSum their sum, FdcStatus the end.
FdcReadStore:
    push af
    call SyncFrame
    ld c,0
    call FdcPort
    pop af
    out (c),a
    ld hl,FdcBuf
RsLoop:
    in a,(c)
    bit 1,a
    jr z,RsNoDrq
    inc c
    inc c
    inc c
    ini
    dec c
    dec c
    dec c
    jr RsLoop
RsNoDrq:
    rra
    jr c,RsLoop
    in a,(c)
    ld (FdcStatus),a
    ld de,FdcBuf
    or a
    sbc hl,de
    ld (FdcCount),hl
    ld b,h
    ld c,l
    ex de,hl
    ld de,0
RsSum:
    ld a,b
    or c
    jr z,RsSumDone
    ld a,(hl)
    inc hl
    add a,e
    ld e,a
    jr nc,RsSumNext
    inc d
RsSumNext:
    dec bc
    jr RsSum
RsSumDone:
    ld (FdcSum),de
    ret

FdcReadCount:
    push af
    call SyncFrame
    ld c,0
    call FdcPort
    pop af
    out (c),a
    ld de,0
RcLoop:
    in a,(c)
    bit 1,a
    jr z,RcNoDrq
    inc c
    inc c
    inc c
    in a,(c)
    dec c
    dec c
    dec c
    inc de
    jr RcLoop
RcNoDrq:
    rra
    jr c,RcLoop
    in a,(c)
    ld (FdcStatus),a
    ld (FdcCount),de
    ld hl,0
    ld (FdcSum),hl
    ret

; --- From SyncFrame, WRITE command A with the 512 bytes of FdcBuf; FdcCount the bytes taken
FdcWriteFast:
    push af
    call SyncFrame
    ld c,0
    call FdcPort
    pop af
    out (c),a
    ld hl,FdcBuf
    ld de,0
WfLoop:
    in a,(c)
    rrca
    jr nc,WfDone
    rrca
    jr nc,WfLoop
    ld a,(hl)
    inc hl
    inc c
    inc c
    inc c
    out (c),a
    dec c
    dec c
    dec c
    inc de
    jr WfLoop
WfDone:
    ld (FdcCount),de
    in a,(c)
    ld (FdcStatus),a
    ret

; --- Records FdcStatus (byte 0) and FdcCount (bytes 2-3) under the name at HL
FdcRecordStatus:
    ld a,(FdcStatus)
    ld e,a
    ld d,0
    ld bc,(FdcCount)
    jp Record

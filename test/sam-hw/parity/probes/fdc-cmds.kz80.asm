; Parity probe "fdc-cmds" (Phase 5): drive 1's VL1772, command by command (fdc.inc.asm). @use timing @use fdc
; The probe's own disk is in drive 1; its writes go to cylinder 70, side 1, which the disk does not use.
;   RESTrR / SEEKrR  RESTORE from cylinder 40 / SEEK 40 -> 60, step rate r (0: 6 ms, 1: 12, 2: 2, 3: 3)
;   STEPIN           STEP IN with update, rate 0     VERIFY  SEEK 40 -> 41 with verify
;   RDADDR / RDADDRB READ ADDRESS on cylinder 70 (status, bytes; the 4 ID bytes before the CRC)
;   RDSEC / RDSECD   READ SECTOR 70/3 (status, bytes; the bytes summed, the count)
;   RDRNF            READ SECTOR 70/12 (no such sector: status, bytes)
;   WRSEC / WRBACK   WRITE SECTOR 70/4 (status, bytes taken), then READ SECTOR 70/4 (sum and count)
;   FORCEI           READ SECTOR 70/5, FORCE INTERRUPT (D0h) 40 polls in: polls, the status after
;   SIDE2            READ ADDRESS on side 2 (port E4h): ID bytes 0-3
;   RDTRK            READ TRACK on cylinder 70 (status, bytes)
; Data moves through tight loops (FdcReadStore and friends), so nothing is lost at the 1772's 32 us a byte;
; the type I commands are timed in status polls (SimCoupé's controller is not timed: see sam-coupe.md).
;   IDSEQa/b         six READ ADDRESSes in a row: the sector numbers
;   INDEX            polls from one index pulse (type I status bit 1) to the next
;   MOTOROFF         polls from then until the motor-on bit (7) clears
;   SPINUP           SEEK 70 -> 71 with the motor off and spin-up on (h = 0)
ProbeMain:
    call TimingSetup
    ld a,$02            ; RESTORE, rate 2, spin-up off (h = 1: 08h)
    or $08
    call FdcDo
    ; --- RESTORE and SEEK at each rate
    ld b,0
RateLoop:
    push bc
    ld a,40
    call SeekTo
    pop bc
    push bc
    ld a,b
    or $08              ; RESTORE, h = 1, rate b
    call FdcTimed
    pop bc
    push bc
    ld a,b
    add a,'0'
    ld (NameRest + 4),a
    ld hl,NameRest
    call FdcRecord
    ld a,40
    call SeekTo
    ld a,60
    ld e,3
    call FdcSetReg
    pop bc
    push bc
    ld a,b
    or $18              ; SEEK, h = 1, rate b
    call FdcTimed
    pop bc
    push bc
    ld a,b
    add a,'0'
    ld (NameSeek + 4),a
    ld hl,NameSeek
    call FdcRecord
    pop bc
    inc b
    ld a,b
    cp 4
    jr c,RateLoop
    ; --- STEP IN, VERIFY
    ld a,40
    call SeekTo
    ld a,$58            ; STEP IN, update, h = 1, rate 0
    call FdcTimed
    ld hl,NameStepIn
    call FdcRecord
    ld a,40
    call SeekTo
    ld a,41
    ld e,3
    call FdcSetReg
    ld a,$1C            ; SEEK with verify
    call FdcTimed
    ld hl,NameVerify
    call FdcRecord
    ; --- On cylinder 70
    ld a,70
    call SeekTo
    ld a,$C8            ; READ ADDRESS, h = 1
    call FdcReadStore
    ld hl,NameRdAddr
    call FdcRecordStatus
    ld de,(FdcBuf)
    ld bc,(FdcBuf + 2)
    ld hl,NameRdAddrB
    call Record
    ld a,3
    ld e,2
    call FdcSetReg
    ld a,$88            ; READ SECTOR, h = 1
    call FdcReadStore
    ld hl,NameRdSec
    call FdcRecordStatus
    ld hl,NameRdSecD
    call FdcRecordData
    ld a,12
    ld e,2
    call FdcSetReg
    ld a,$88
    call FdcReadStore
    ld hl,NameRdRnf
    call FdcRecordStatus
    ; --- WRITE SECTOR 4 with a pattern, then read it back
    ld hl,FdcBuf
    ld b,0
Pattern:
    ld a,b
    xor $5A
    ld (hl),a
    inc hl
    ld (hl),b
    inc hl
    djnz Pattern
    ld a,4
    ld e,2
    call FdcSetReg
    ld a,$A8            ; WRITE SECTOR, h = 1
    call FdcWriteFast
    ld hl,NameWrSec
    call FdcRecordStatus
    ld a,$88
    call FdcReadStore
    ld hl,NameWrBack
    call FdcRecordData
    ; --- FORCE INTERRUPT during a read
    ld a,5
    ld e,2
    call FdcSetReg
    call SyncFrame
    ld c,0
    call FdcPort
    ld a,$88
    out (c),a
    ld de,0
ForcePoll:
    in a,(c)
    inc de
    ld a,e
    cp 40
    jr c,ForcePoll
    ld a,$D0
    out (c),a
    nop
    nop
    nop
    nop
    in a,(c)
    ld b,a
    ld c,0
    ld hl,NameForceI
    call Record
    call FdcIdle
    ; --- Side 2
    ld a,$E4
    ld (FdcBase),a
    ld a,$C8
    call FdcReadStore
    ld de,(FdcBuf)
    ld bc,(FdcBuf + 2)
    ld hl,NameSide2
    call Record
    ld a,$E0
    ld (FdcBase),a
    ; --- READ TRACK
    ld a,$E8
    call FdcReadCount
    ld hl,NameRdTrk
    call FdcRecordStatus
    ; --- Six READ ADDRESSes: the sector numbers (byte 2 of each ID)
    call SyncFrame
    ld b,6
    ld hl,IdSeq
IdLoop:
    push bc
    push hl
    ld c,0
    call FdcPort
    ld a,$C8            ; READ ADDRESS (after FdcPort, which uses A)
    out (c),a
    ld ix,IdBytes
IdPoll:
    in a,(c)
    bit 1,a
    jr z,IdNoDrq
    ld a,(FdcBase)
    add a,3
    push bc
    ld c,a
    in a,(c)
    pop bc
    ld (ix+0),a
    inc ix
    jr IdPoll
IdNoDrq:
    rra
    jr c,IdPoll
    pop hl
    ld a,(IdBytes + 2)
    ld (hl),a
    inc hl
    pop bc
    djnz IdLoop
    ld de,(IdSeq)
    ld bc,(IdSeq + 2)
    ld hl,NameIdSeqA
    call Record
    ld de,(IdSeq + 4)
    ld bc,0
    ld hl,NameIdSeqB
    call Record
    ; --- The index period: a type I command (SEEK to the same cylinder) for the type I status
    ld a,70
    ld e,3
    call FdcSetReg
    ld a,$18
    call FdcDo
    ld c,0
    call FdcPort
IndexHigh1:             ; wait for the pulse to start
    in a,(c)
    bit 1,a
    jr z,IndexHigh1
IndexLow1:
    in a,(c)
    bit 1,a
    jr nz,IndexLow1
    ld de,0
    ld h,0
IndexWait:
    in a,(c)
    bit 1,a
    jr nz,IndexGot
    inc de
    ld a,d
    or e
    jr nz,IndexWait
    inc h
    jr IndexWait
IndexGot:
    ld b,0
    ld c,h
    ld hl,NameIndex
    call Record
    ; --- The motor-on timeout
    ld c,0
    call FdcPort
    ld de,0
    ld h,0
MotorWait:
    in a,(c)
    bit 7,a
    jr z,MotorGot
    inc de
    ld a,d
    or e
    jr nz,MotorWait
    inc h
    jr MotorWait
MotorGot:
    ld b,0
    ld c,h
    ld hl,NameMotorOff
    call Record
    ; --- Spin-up: SEEK with h = 0 and the motor off
    ld a,71
    ld e,3
    call FdcSetReg
    ld a,$10
    call FdcTimed
    ld hl,NameSpinUp
    call FdcRecord
    jp FdcIdle          ; the frame's own write must find the controller idle

; --- SEEK to cylinder A, untimed (rate 2, h = 1)
SeekTo:
    ld e,3
    call FdcSetReg
    ld a,$1A
    jp FdcDo

IdBytes:        .defs 6
IdSeq:          .defs 6
NameRest:       .defm "REST0R  "
NameSeek:       .defm "SEEK0R  "
NameStepIn:     .defm "STEPIN  "
NameVerify:     .defm "VERIFY  "
NameRdAddr:     .defm "RDADDR  "
NameRdAddrB:    .defm "RDADDRB "
NameRdSec:      .defm "RDSEC   "
NameRdSecD:     .defm "RDSECD  "
NameRdRnf:      .defm "RDRNF   "
NameWrSec:      .defm "WRSEC   "
NameWrBack:     .defm "WRBACK  "
NameForceI:     .defm "FORCEI  "
NameSide2:      .defm "SIDE2   "
NameRdTrk:      .defm "RDTRK   "
NameIdSeqA:     .defm "IDSEQa  "
NameIdSeqB:     .defm "IDSEQb  "
NameIndex:      .defm "INDEX   "
NameMotorOff:   .defm "MOTOROFF"
NameSpinUp:     .defm "SPINUP  "

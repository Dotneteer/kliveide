; =============================================================================
; Drive 2 tests (Phase 5), appended after a probe that contains "@use drive2" (with "@use timing" and
; "@use fdc"). Klive's own code. The disk in drive 2 has every sector filled with its own number (sector
; index AND 0FFh, the index cylinder-major with the sides interleaved): a read's sum shows which sector
; came back. Drive2Tests records:
;   D2REST   RESTORE: status (bit 6 write protect)          D2RDADDR  READ ADDRESS on cylinder 10: ID 0-3
;   D2RDSEC  READ SECTOR 10/3: status, bytes                D2RDSUM   its sum and count
;   D2WRSEC  WRITE SECTOR 10/4: status, bytes taken         D2WRBACK  READ SECTOR 10/4: sum and count
;   D2SIDE2  READ SECTOR 10/1 on side 2 (F4h): sum and count
; =============================================================================
Drive2Tests:
    call TimingSetup
    ld a,$F0
    ld (FdcBase),a
    ld a,$02 | $08      ; RESTORE, rate 2, h = 1
    call FdcTimed
    ld a,(FdcStatus)
    ld e,a
    ld d,0
    ld bc,0
    ld hl,NameD2Rest
    call Record
    ld a,10
    ld e,3
    call FdcSetReg
    ld a,$1A
    call FdcDo
    ld a,$C8
    call FdcReadStore
    ld de,(FdcBuf)
    ld bc,(FdcBuf + 2)
    ld hl,NameD2RdAddr
    call Record
    ld a,3
    ld e,2
    call FdcSetReg
    ld a,$88
    call FdcReadStore
    ld hl,NameD2RdSec
    call FdcRecordStatus
    ld hl,NameD2RdSum
    call FdcRecordData
    ; --- WRITE SECTOR 10/4 with a pattern, then read it back
    ld hl,FdcBuf
    ld b,0
D2Pattern:
    ld a,b
    xor $C3
    ld (hl),a
    inc hl
    ld (hl),b
    inc hl
    djnz D2Pattern
    ld a,4
    ld e,2
    call FdcSetReg
    ld a,$A8
    call FdcWriteFast
    ld hl,NameD2WrSec
    call FdcRecordStatus
    ld a,$88
    call FdcReadStore
    ld hl,NameD2WrBack
    call FdcRecordData
    ; --- Side 2
    ld a,$F4
    ld (FdcBase),a
    ld a,1
    ld e,2
    call FdcSetReg
    ld a,$88
    call FdcReadStore
    ld hl,NameD2Side2
    call FdcRecordData
    ld a,$E0
    ld (FdcBase),a
    ret

NameD2Rest:     .defm "D2REST  "
NameD2RdAddr:   .defm "D2RDADDR"
NameD2RdSec:    .defm "D2RDSEC "
NameD2RdSum:    .defm "D2RDSUM "
NameD2WrSec:    .defm "D2WRSEC "
NameD2WrBack:   .defm "D2WRBACK"
NameD2Side2:    .defm "D2SIDE2 "

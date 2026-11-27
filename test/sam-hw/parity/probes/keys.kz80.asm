; Parity probe "keys" (Phase 6): text typed into SAM BASIC, and the matrix read with several rows at once.
; @typed 10 REM Kliveq azAZ09 !@#$%&'()~ -+=/*_ ,.<>;:|{}^[]?`
; @hold Q
; Klive types the @typed line (and RETURN) into the editor before F9 boots the probe, and holds the @hold
; key from the probe's start; SimCoupé gets the same through -keyin (the line, then BOOT, then the key).
;   LINELEN   the stored line's length from "Kliveq" up to its 0Dh, at most 64 (FFh: not found)
;   LINE00..  the stored bytes from "Kliveq", four a record (the first in bits 0-7), zeros past the line
;   KEYWAIT   1 when a key was seen within about 5 s, else 0
;   ROWS0-3   with the key held: rows 0-3 read alone (A8-A11 low one at a time), FEh bits 0-4 and F9h bits 5-7
;   ROWS4-7   the same, rows 4-7
;   ROW8      FFFEh (no row selected: row 8)
;   ANDFAIL   of the 255 high bytes with at least one row selected, how many read other than the AND of
;             their rows read alone
;   TABSUM    the 256 values summed (16 bits)

ProbeMain:
    ; --- The typed line
    ld hl,$4000
Search:
    ld a,(hl)
    cp 'K'
    jr nz,SearchNext
    push hl
    ld de,Marker
    ld b,6
Compare:
    ld a,(de)
    cp (hl)
    jr nz,CompareFail
    inc hl
    inc de
    djnz Compare
    pop hl
    jr Found
CompareFail:
    pop hl
SearchNext:
    inc hl
    ld a,h
    cp $80
    jr nz,Search
    ld a,$FF
    ld hl,NameLineLen
    call RecordA
    jr Matrix
Found:
    ; --- The length up to 0Dh, at most 64
    push hl
    pop ix
    ld b,0
Length:
    ld a,(hl)
    cp $0D
    jr z,LengthDone
    inc hl
    inc b
    ld a,b
    cp 64
    jr nz,Length
LengthDone:
    ld a,b
    ld (LineLen),a
    ; --- The line into a zeroed buffer, so that nothing past its end is recorded
    or a
    jr z,Copied
    ld c,b
    ld b,0
    push ix
    pop hl
    ld de,LineBuf
    ldir
Copied:
    ld ix,LineBuf
    ld a,(LineLen)
    ld hl,NameLineLen
    call RecordA
    ld a,(LineLen)
    add a,3
    srl a
    srl a               ; records of four bytes
    or a
    jr z,Matrix
    ld b,a
LineRec:
    push bc
    ; --- The name: "LINE" and the record's index as two digits
    ld a,(LineIndex)
    ld c,'0'
Tens:
    cp 10
    jr c,TensDone
    sub 10
    inc c
    jr Tens
TensDone:
    add a,'0'
    ld (NameLine + 5),a
    ld a,c
    ld (NameLine + 4),a
    ld e,(ix+0)
    ld d,(ix+1)
    ld c,(ix+2)
    ld b,(ix+3)
    ld hl,NameLine
    call Record
    ld de,4
    add ix,de
    ld hl,LineIndex
    inc (hl)
    pop bc
    djnz LineRec

Matrix:
    ; --- Wait for a key, about 5 s (250 frames)
    ei
    ld e,250
KeyWait:
    xor a
    in a,($FE)          ; every row
    and $1F
    cp $1F
    jr nz,KeyDown
    ld bc,$00F9
    in a,(c)
    and $E0
    cp $E0
    jr nz,KeyDown
    halt
    dec e
    jr nz,KeyWait
    xor a
    jr KeyWaitDone
KeyDown:
    ld a,1
KeyWaitDone:
    di
    ld hl,NameKeyWait
    call RecordA

    ; --- The 256 high bytes, each read on FEh (bits 0-4) and F9h (bits 5-7)
    ld hl,Table
    ld b,0
Scan:
    ld c,$FE
    in a,(c)
    and $1F
    ld d,a
    ld c,$F9
    in a,(c)
    and $E0
    or d
    ld (hl),a
    inc hl
    inc b
    jr nz,Scan

    ; --- Rows alone: Table[FEh], [FDh], [FBh], ... [7Fh]
    ld hl,Single
    ld a,$FE
    ld b,8
SingleLoop:
    push hl
    ld hl,Table
    ld e,a
    ld d,0
    add hl,de
    ld e,(hl)
    pop hl
    ld (hl),e
    inc hl
    rlca
    djnz SingleLoop
    ld de,(Single)
    ld bc,(Single + 2)
    ld hl,NameRows0
    call Record
    ld de,(Single + 4)
    ld bc,(Single + 6)
    ld hl,NameRows4
    call Record
    ld a,(Table + $FF)
    ld hl,NameRow8
    call RecordA

    ; --- Every high byte with a row selected against the AND of its rows alone
    ld hl,0
    ld (Fails),hl
    ld (Sum),hl
    ld b,0              ; the high byte
AndLoop:
    push bc
    ld c,$FF            ; the AND
    ld e,b
    ld hl,Single
    ld d,8
AndRows:
    rr e
    jr c,AndSkip
    ld a,c
    and (hl)
    ld c,a
AndSkip:
    inc hl
    dec d
    jr nz,AndRows
    ld hl,Table
    ld e,b
    ld d,0
    add hl,de
    ld a,(hl)
    push hl
    ld hl,(Sum)
    ld e,a
    ld d,0
    add hl,de
    ld (Sum),hl
    pop hl
    ld a,b
    cp $FF
    jr z,AndNext        ; row 8, no row selected
    ld a,(hl)
    cp c
    jr z,AndNext
    ld hl,(Fails)
    inc hl
    ld (Fails),hl
AndNext:
    pop bc
    inc b
    jr nz,AndLoop
    ld de,(Fails)
    ld bc,0
    ld hl,NameAndFail
    call Record
    ld de,(Sum)
    ld bc,0
    ld hl,NameTabSum
    jp Record

Marker:         .defm "Kliveq"
LineLen:        .defb 0
LineIndex:      .defb 0
Fails:          .defw 0
Sum:            .defw 0
Single:         .defs 8
NameLineLen:    .defm "LINELEN "
NameLine:       .defm "LINE00  "
NameKeyWait:    .defm "KEYWAIT "
NameRows0:      .defm "ROWS0-3 "
NameRows4:      .defm "ROWS4-7 "
NameRow8:       .defm "ROW8    "
NameAndFail:    .defm "ANDFAIL "
NameTabSum:     .defm "TABSUM  "
LineBuf:        .defs 64
Table:          .defs 256

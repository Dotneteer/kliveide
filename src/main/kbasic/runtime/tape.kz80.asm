; @module   tape
; @summary  SAVE, LOAD and VERIFY of CODE (and SCREEN$) through the ROM's tape routines.
; @exports  TapeSave, TapeLoad
; @requires rom, strings
;
; A CODE block goes to tape as the ROM writes it: a 17-byte header (type 3, the name padded to ten
; characters, the length, the start address, 32768) and then the data. LOAD and VERIFY read headers
; until a CODE header with the name (any, for an empty name) comes (a block that is not a header is
; passed over, as the ROM's LOAD does); a failed read of the data sets ERR_NR to 26 ("R Tape loading
; error") and the program goes on (the spec's LOAD). BREAK stops the program with
; the ROM's report, as the ROM's own routines do. The ROM entry points: SA-BYTES $04C2 (A = the flag
; byte, IX = the start, DE = the length) and LD-BYTES $0556 (the same, carry set to load, clear to
; verify; carry set on success). IX is kept for the caller.

; ------------------------------------------------------------------------------------------------
; SAVE name CODE start, length. In: HL = the name, A = free flags (bit 0 frees it), DE = the start,
; BC = the length. Changes AF, BC, DE, HL.
TapeSave:
    ld (TapeAddr),de
    ld (TapeLen),bc
    call TapeName           ; TapeHeader's name, from HL (freed as A says)
    ld a,3
    ld (TapeHeader),a       ; CODE
    ld hl,(TapeLen)
    ld (TapeHeader+11),hl
    ld hl,(TapeAddr)
    ld (TapeHeader+13),hl
    ld hl,32768
    ld (TapeHeader+15),hl
    push ix
    ld ix,TapeHeader
    ld de,17
    xor a                   ; the flag byte of a header
    call RomCall
    .defw $04c2             ; SA-BYTES
    ld b,50                 ; a second between the blocks, as the ROM's SAVE leaves
TapeSaveGap:
    halt
    djnz TapeSaveGap
    ld ix,(TapeAddr)
    ld de,(TapeLen)
    ld a,$ff                ; the flag byte of data
    call RomCall
    .defw $04c2
    pop ix
    ret

; ------------------------------------------------------------------------------------------------
; LOAD and VERIFY name CODE [start [, length]]. In: HL = the name, A = flags: bit 0 frees the name,
; bit 1 verifies instead of loading, bit 2 means DE is the start, bit 3 that BC is the length (the
; header's own otherwise). Changes AF, BC, DE, HL.
TapeLoad:
    ld (TapeFlags),a
    ld (TapeAddr),de
    ld (TapeLen),bc
    call TapeName
    push ix
TapeLoadHeader:
    ld ix,TapeHeaderIn
    ld de,17
    xor a
    scf
    call RomCall
    .defw $0556             ; LD-BYTES: a header
    jr nc,TapeLoadHeader    ; not a header (or a bad one): keep looking, as the ROM's LOAD does
    ld a,(TapeHeaderIn)
    cp 3
    jr nz,TapeLoadHeader    ; not CODE
    ld a,(TapeNameLen)
    or a
    jr z,TapeLoadMatched    ; no name: the first CODE block
    ld hl,TapeHeader+1
    ld de,TapeHeaderIn+1
    ld b,10
TapeLoadName:
    ld a,(de)
    cp (hl)
    jr nz,TapeLoadHeader
    inc hl
    inc de
    djnz TapeLoadName
TapeLoadMatched:
    ld a,(TapeFlags)
    ld hl,(TapeHeaderIn+13) ; the header's start
    bit 2,a
    jr z,TapeLoadStart
    ld hl,(TapeAddr)
TapeLoadStart:
    push hl
    pop ix
    ld de,(TapeHeaderIn+11) ; the header's length
    bit 3,a
    jr z,TapeLoadLength
    ld de,(TapeLen)
TapeLoadLength:
    bit 1,a
    ld a,$ff
    scf                     ; load
    jr z,TapeLoadData
    and a                   ; verify: carry clear
TapeLoadData:
    call RomCall
    .defw $0556             ; LD-BYTES: the data
    jr c,TapeLoadDone
TapeLoadFailed:
    ld (iy+0),26            ; ERR_NR: "R Tape loading error"; the program goes on
TapeLoadDone:
    pop ix
    ret

; ------------------------------------------------------------------------------------------------
; TapeHeader's name field: String HL padded with spaces to ten characters (cut to ten); TapeNameLen
; its length. In: A = free flags (bit 0 frees HL). Changes AF, BC, DE, HL.
TapeName:
    push af                 ; S: [flags]
    push hl                 ; S: [string][flags]
    ld de,TapeHeader+1
    ld b,10
    ld a,' '
TapeNameClear:
    ld (de),a
    inc de
    djnz TapeNameClear
    call StrLen             ; BC = the length
    ld a,b
    or a
    jr z,TapeNameShort
    ld bc,10
TapeNameShort:
    ld a,c
    cp 11
    jr c,TapeNameFits
    ld c,10
TapeNameFits:
    ld a,c
    ld (TapeNameLen),a
    or a
    jr z,TapeNameCopied
    inc hl
    inc hl
    ld de,TapeHeader+1
    ldir
TapeNameCopied:
    pop hl                  ; S: [flags]
    pop af                  ; S: []
    rra
    ret nc
    jp Free

TapeFlags:
    .defb 0
TapeAddr:
    .defw 0
TapeLen:
    .defw 0
TapeNameLen:
    .defb 0
TapeHeader:
    .defs 17
TapeHeaderIn:
    .defs 17

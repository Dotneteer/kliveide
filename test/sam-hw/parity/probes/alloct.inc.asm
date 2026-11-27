; =============================================================================
; The ROM's page allocation table (ALLOCT, 33 bytes at 5100h in page 0) dumped as 9 records ("ALLOCT0" to
; "ALLOCT8", 4 bytes each, the last 1), plus LMPR, HMPR and VMPR as Run left them ("PAGING"). Appended
; after a probe that contains "@use alloct". Klive's own code.
; =============================================================================
AlloctDump:
    ld hl,AlloctName
    ld de,NameBuf
    ld bc,6
    ldir
    ld hl,$5100
    ld b,0
AlloctLoop:
    push bc
    ld a,b
    add a,'0'
    ld (NameBuf + 6),a
    ld a,' '
    ld (NameBuf + 7),a
    ld e,(hl)
    inc hl
    ld d,(hl)
    inc hl
    ld c,(hl)
    inc hl
    ld a,(hl)
    inc hl
    push hl
    ld b,a
    ld hl,NameBuf
    call Record
    pop hl
    pop bc
    inc b
    ld a,b
    cp 9
    jr c,AlloctLoop
    in a,($FA)
    ld e,a
    in a,($FB)
    ld d,a
    in a,($FC)
    ld c,a
    ld b,0
    ld hl,PagingName
    jp Record
AlloctName:     .defm "ALLOCT"
PagingName:     .defm "PAGING  "

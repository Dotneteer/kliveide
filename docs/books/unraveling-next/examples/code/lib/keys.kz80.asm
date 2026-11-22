; The keyboard, read straight from port $FE: no ROM, no interrupts needed.

; Returns the index (0-39) of the first key held down in A, or $FF when no key is down.
; The index counts the half-rows from $FEFE to $7FFE, five keys each, bit 0 first. Uses BC, E.
ScanKeys:
    ld bc,$FEFE             ; B selects the half-row: one bit low
    ld e,0                  ; the index of the half-row's first key
ScanKeysRow:
    in a,(c)
    cpl                     ; a pressed key reads 0: make it 1
    and $1F
    jr nz,ScanKeysFound
    ld a,e
    add a,5
    ld e,a
    rlc b                   ; the next half-row; after $7F, carry is 0
    jr c,ScanKeysRow
    ld a,$FF
    ret
ScanKeysFound:
    rrca
    jr c,ScanKeysDone
    inc e
    jr ScanKeysFound
ScanKeysDone:
    ld a,e
    ret

; Waits until no key is down
WaitNoKey:
    call ScanKeys
    inc a                   ; $FF becomes 0
    jr nz,WaitNoKey
    ret

; Waits for a new key press and returns its character in A (13 for ENTER, 32 for SPACE).
; CAPS SHIFT and SYMBOL SHIFT alone do not count.
WaitKey:
    call WaitNoKey
WaitKeyDown:
    call ScanKeys
    cp $FF
    jr z,WaitKeyDown
    ld hl,KeyChars
    add hl,a
    ld a,(hl)
    or a
    jr z,WaitKeyDown        ; a shift key
    ret

; The character of each key index; 0 marks CAPS SHIFT and SYMBOL SHIFT
KeyChars:
    .defb 0
    .defm "ZXCV"            ; $FEFE
    .defm "ASDFG"           ; $FDFE
    .defm "QWERT"           ; $FBFE
    .defm "12345"           ; $F7FE
    .defm "09876"           ; $EFFE
    .defm "POIUY"           ; $DFFE
    .defb 13
    .defm "LKJH"            ; $BFFE
    .defb 32, 0
    .defm "MNB"             ; $7FFE

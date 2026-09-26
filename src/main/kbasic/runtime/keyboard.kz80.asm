; @module   keyboard
; @summary  The keyboard: INKEY$ and PAUSE, reading the key matrix directly (no ROM calls).
; @exports  Inkey, KeyScan, Pause
; @requires strings
;
; The 40 keys are numbered as the matrix is read: half-row $FEFE first (CAPS SHIFT, Z, X, C, V), then
; $FDFE, $FBFE, ... $7FFE (SPACE, SYMBOL SHIFT, M, N, B), bit 0 first. A key gives the character
; printed on it in lower case; with CAPS SHIFT (or CAPS LOCK, bit 3 of FLAGS2) a letter is a capital
; and a digit its editing code; with SYMBOL SHIFT a key gives its red symbol or keyword token. CAPS
; SHIFT and SYMBOL SHIFT on their own give nothing, the two together give 14 (EXTEND).

; ------------------------------------------------------------------------------------------------
; INKEY$: the key being pressed as a one-character String, or the empty String. Out: HL. Changes AF,
; BC, DE.
Inkey:
    call KeyScan
    ld hl,0
    or a
    ret z
    jp StrChr

; ------------------------------------------------------------------------------------------------
; The character code of the key being pressed, or 0 for none. When several keys are down, the first
; in matrix order counts. Out: A. Changes F, BC, DE, HL.
KeyScan:
    ld de,$ff00             ; D = the key found ($FF: none), E = bit 0 CAPS SHIFT, bit 1 SYMBOL SHIFT
    ld hl,$fe00             ; H = the half-row's port high byte, L = the number of its first key
KeyScanRow:
    ld a,h
    in a,($fe)
    cpl
    and $1f
    ld c,a                  ; C = the half-row's keys that are down, bit 0 first
    ld b,5
KeyScanBit:
    srl c
    jr nc,KeyScanNext
    ld a,l
    or a
    jr nz,KeyScanSymbol
    set 0,e                 ; key 0: CAPS SHIFT
    jr KeyScanNext
KeyScanSymbol:
    cp 36
    jr nz,KeyScanKey
    set 1,e                 ; key 36: SYMBOL SHIFT
    jr KeyScanNext
KeyScanKey:
    ld a,d
    inc a
    jr nz,KeyScanNext       ; a key was found already
    ld d,l
KeyScanNext:
    inc l
    djnz KeyScanBit
    rlc h                   ; the next half-row: $FE, $FD, $FB, ... $7F
    ld a,l
    cp 40
    jr c,KeyScanRow
    ; --- Decode
    ld a,d
    inc a
    jr nz,KeyScanFound
    ld a,e
    cp 3
    ld a,14                 ; both shifts alone: EXTEND
    ret z
    xor a
    ret
KeyScanFound:
    ld c,d
    ld b,0
    ld hl,KeySymbols
    bit 1,e
    jr nz,KeyScanLook
    ld hl,KeyPlain
    add hl,bc
    ld a,(hl)
    bit 0,e
    jr nz,KeyScanCaps
    ld hl,$5c6a             ; FLAGS2: bit 3 is CAPS LOCK
    bit 3,(hl)
    ret z
    jr KeyScanCapital
KeyScanCaps:
    cp '0'
    jr c,KeyScanCapital
    cp '9'+1
    jr nc,KeyScanCapital
    sub '0'
    ld c,a
    ld hl,KeyEditing
KeyScanLook:
    add hl,bc
    ld a,(hl)
    ret
KeyScanCapital:
    cp 'a'
    ret c
    cp 'z'+1
    ret nc
    sub 32
    ret

; The characters of the keys in matrix order; 0 for the two shift keys.
KeyPlain:
    .defb 0, 122, 120, 99, 118          ; CAPS SHIFT z x c v
    .defb 97, 115, 100, 102, 103        ; a s d f g
    .defb 113, 119, 101, 114, 116       ; q w e r t
    .defb 49, 50, 51, 52, 53            ; 1 2 3 4 5
    .defb 48, 57, 56, 55, 54            ; 0 9 8 7 6
    .defb 112, 111, 105, 117, 121       ; p o i u y
    .defb 13, 108, 107, 106, 104        ; ENTER l k j h
    .defb 32, 0, 109, 110, 98           ; SPACE SYMBOL SHIFT m n b
; With SYMBOL SHIFT: the red symbols, and the keyword tokens of the 48K keyboard.
KeySymbols:
    .defb 0, 58, 96, 63, 47             ; : £ ? /
    .defb 226, 195, 205, 204, 203       ; STOP NOT STEP TO THEN
    .defb 199, 201, 200, 60, 62         ; <= <> >= < >
    .defb 33, 64, 35, 36, 37            ; ! @ # $ %
    .defb 95, 41, 40, 39, 38            ; _ ) ( ' &
    .defb 34, 59, 172, 197, 198         ; " ; AT OR AND
    .defb 13, 61, 43, 45, 94            ; ENTER = + - ^
    .defb 32, 0, 46, 44, 42             ; SPACE . , *
; With CAPS SHIFT, digits 0-9: DELETE, EDIT, CAPS LOCK, TRUE VIDEO, INV VIDEO, left, down, up, right,
; GRAPHICS.
KeyEditing:
    .defb 12, 7, 6, 4, 5, 8, 10, 11, 9, 15

; ------------------------------------------------------------------------------------------------
; PAUSE: waits HL frames, or until a key is pressed; PAUSE 0 waits for a key only. A key that is
; already down when PAUSE starts counts only after it has been released. Needs interrupts enabled
; (a frame is one HALT). Changes AF, C, HL.
Pause:
    xor a
    in a,($fe)
    cpl
    and $1f
    ld c,0                  ; C = 1 once every key is up: the next key then ends PAUSE
    jr nz,PauseLoop
    inc c
PauseLoop:
    halt
    ld a,h
    or l
    jr z,PauseKey           ; PAUSE 0: no count
    dec hl
    ld a,h
    or l
    ret z
PauseKey:
    xor a
    in a,($fe)
    cpl
    and $1f
    jr z,PauseUp
    dec c
    ret z                   ; C was 1: a new key
    inc c
    jr PauseLoop
PauseUp:
    ld c,1
    jr PauseLoop

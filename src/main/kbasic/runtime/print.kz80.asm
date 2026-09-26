; @module   print
; @summary  Text PRINT to the ULA screen: characters, control codes, numbers, AT, TAB, comma, CLS.
; @exports  PrintInit, PrintChar, PrintStr, PrintNewline, PrintComma, PrintAt, PrintTab, PrintReset
; @exports  PrintU8, PrintI8, PrintU16, PrintI16, PrintU32, PrintI32, Cls, PrintRow, PrintCol, PrintColour
; @requires heap, errors
; @init     PrintInit
;
; Klive's own printing (plan §6.3): no ROM calls, all 24 rows, the whole screen scrolls up when a
; line feed passes row 23. The cursor is PrintRow (0-23) and PrintCol (0-32; 32 means the line is
; full and the next character goes to the next line, so 32 characters followed by a line feed leave
; no empty line). Start-up takes the cursor and the permanent colours from the ROM's S_POSN, ATTR_P,
; MASK_P and P_FLAG, so a program's output continues where BASIC's left off.
;
; Characters 32-127 come from the font at CHARS, 128-143 are the block graphics, 144 and above come
; from UDG. Control codes: 6 comma, 8 left, 9 right, 13 new line, 16-21 INK, PAPER, FLASH, BRIGHT,
; INVERSE, OVER (one argument each), 22 AT (row, column), 23 TAB (column low, high); any other code
; below 32 prints "?". Colour codes are temporary: PrintReset, at the end of a PRINT, restores the
; permanent colours. INK 9 and PAPER 9 (contrast) are not supported yet and stop with "K Invalid
; colour".

; ------------------------------------------------------------------------------------------------
; Takes the cursor and the permanent colours from the ROM's system variables. Changes AF, BC, HL.
PrintInit:
    ld hl,($5c88)           ; S_POSN: L = 33 - column, H = 24 - row
    ld a,33
    sub l
    cp 33
    jr c,PrintInitCol
    xor a
PrintInitCol:
    ld (PrintCol),a
    ld a,24
    sub h
    cp 24
    jr c,PrintInitRow
    ld a,23
PrintInitRow:
    ld (PrintRow),a
    ld hl,($5c8d)           ; ATTR_P, MASK_P
    ld (PrintAttrP),hl
    ld a,($5c91)            ; P_FLAG: bit 1 permanent OVER, bit 3 permanent INVERSE
    ld c,0
    bit 1,a
    jr z,PrintInitInverse
    set 0,c
PrintInitInverse:
    bit 3,a
    jr z,PrintInitFlags
    set 1,c
PrintInitFlags:
    ld a,c
    ld (PrintFlagsP),a
    xor a
    ld (PrintCtl),a
    ; fall through

; ------------------------------------------------------------------------------------------------
; Makes the permanent colours current again: the end of a PRINT statement. Changes AF, HL.
PrintReset:
    ld hl,(PrintAttrP)
    ld (PrintAttr),hl
    ld a,(PrintFlagsP)
    ld (PrintFlags),a
    ret

; The print state. PrintAttr/PrintMask and PrintAttrP/PrintMaskP must stay adjacent (read as words).
PrintRow:
    .defb 0
PrintCol:
    .defb 0
PrintAttr:
    .defb $38               ; the attribute printed characters get
PrintMask:
    .defb 0                 ; attribute bits kept from the screen (INK 8, PAPER 8, ...)
PrintAttrP:
    .defb $38
PrintMaskP:
    .defb 0
PrintFlags:
    .defb 0                 ; bit 0 OVER, bit 1 INVERSE
PrintFlagsP:
    .defb 0
PrintCtl:
    .defb 0                 ; the control code waiting for arguments, or 0
PrintCtlArg:
    .defb 0                 ; its first argument
PrintBlockBuf:
    .defs 8                 ; the pixels of a block graphics character

; ------------------------------------------------------------------------------------------------
; Prints character or control code A. Changes AF, BC, DE, HL.
PrintChar:
    ld hl,PrintCtl
    ld c,(hl)
    inc c
    dec c
    jr nz,PrintCtlParam
    cp 32
    jr nc,PrintGlyph
    cp 13
    jp z,PrintNewline
    cp 6
    jp z,PrintComma
    cp 8
    jr z,PrintLeft
    cp 9
    jr z,PrintRight
    cp 16
    jr c,PrintQuestion
    cp 24
    jr nc,PrintQuestion
    ld (hl),a               ; 16-23: wait for the arguments
    ret
PrintQuestion:
    ld a,'?'
    jr PrintGlyph
PrintLeft:
    ld hl,PrintCol
    ld a,(hl)
    or a
    ret z
    dec (hl)
    ret
PrintRight:
    ld hl,PrintCol
    ld a,(hl)
    cp 32
    ret nc
    inc (hl)
    ret

; A = the argument, C = the waiting control code (bit 7 set once AT/TAB has its first), HL = PrintCtl
PrintCtlParam:
    ld b,a                  ; B = the argument
    ld a,c
    and $7f
    cp 22
    jr nc,PrintCtlTwo
    ld (hl),0               ; a colour code takes one argument
    ld a,b
    jp PrintColour
PrintCtlTwo:
    bit 7,c
    jr nz,PrintCtlSecond
    set 7,(hl)
    ld a,b
    ld (PrintCtlArg),a
    ret
PrintCtlSecond:
    ld (hl),0
    ld a,(PrintCtlArg)
    bit 0,c                 ; 22 AT, 23 TAB
    jr nz,PrintCtlTab
    ld c,b                  ; AT row, column
    ld b,a
    jp PrintAt
PrintCtlTab:
    jp PrintTab             ; A = the column's low byte; the high byte is ignored

; ------------------------------------------------------------------------------------------------
; Prints printable character A (32-255) at the cursor and moves the cursor right.
PrintGlyph:
    push af
    ld a,(PrintCol)
    cp 32
    call nc,PrintNewline    ; the line is full: continue on the next one
    pop af
    call PrintGlyphAddr     ; DE = the character's eight pixel rows
    ld a,(PrintRow)
    call PrintRowAddr       ; HL = the row's first pixel line
    ld a,(PrintCol)
    or l
    ld l,a                  ; HL = the cell's first pixel line
    ld a,(PrintFlags)
    ld c,a
    ld b,8
PrintGlyphLoop:
    ld a,(de)
    bit 1,c
    jr z,PrintGlyphOver
    cpl                     ; INVERSE
PrintGlyphOver:
    bit 0,c
    jr z,PrintGlyphPut
    xor (hl)                ; OVER
PrintGlyphPut:
    ld (hl),a
    inc de
    inc h
    djnz PrintGlyphLoop
    call PrintAttrAddr      ; HL = the cell's attribute
    ld de,(PrintAttr)       ; E = attribute, D = mask
    ld a,d
    and (hl)
    ld b,a                  ; the bits kept from the screen
    ld a,d
    cpl
    and e
    or b
    ld (hl),a
    ld hl,PrintCol
    inc (hl)
    ret

; DE = the pixel rows of printable character A. Changes AF, BC, HL.
PrintGlyphAddr:
    cp 128
    jr c,PrintGlyphFont
    cp 144
    jr c,PrintGlyphBlock
    sub 144
    ld hl,($5c7b)           ; UDG
    jr PrintGlyphIndex
PrintGlyphFont:
    ld hl,($5c36)           ; CHARS: 256 bytes below the font's space
PrintGlyphIndex:
    ex de,hl
    ld l,a
    ld h,0
    add hl,hl
    add hl,hl
    add hl,hl
    add hl,de
    ex de,hl
    ret
PrintGlyphBlock:
    sub 128
    ld b,a
    ld hl,PrintBlockBuf
    call PrintBlockHalf     ; bits 0 and 1: the upper half
    rrc b
    rrc b
    call PrintBlockHalf     ; bits 2 and 3: the lower half
    ld de,PrintBlockBuf
    ret
PrintBlockHalf:             ; four rows at HL: $0F if bit 0 of B, $F0 if bit 1
    xor a
    bit 0,b
    jr z,PrintBlockLeft
    or $0f
PrintBlockLeft:
    bit 1,b
    jr z,PrintBlockStore
    or $f0
PrintBlockStore:
    ld (hl),a
    inc hl
    ld (hl),a
    inc hl
    ld (hl),a
    inc hl
    ld (hl),a
    inc hl
    ret

; HL = the address of the first pixel line of character row A, column 0. Changes AF.
PrintRowAddr:
    ld l,a
    and $18
    or $40
    ld h,a
    ld a,l
    and 7
    rrca
    rrca
    rrca
    ld l,a
    ret

; HL = the attribute address of the cursor's cell. Changes AF.
PrintAttrAddr:
    ld a,(PrintRow)
    ld l,a
    ld h,0
    add hl,hl
    add hl,hl
    add hl,hl
    add hl,hl
    add hl,hl
    ld a,(PrintCol)
    or l
    ld l,a
    ld a,h
    or $58
    ld h,a
    ret

; ------------------------------------------------------------------------------------------------
; Moves the cursor to the start of the next line, scrolling the screen when it is on row 23.
; Changes AF, BC, DE, HL.
PrintNewline:
    xor a
    ld (PrintCol),a
    ld hl,PrintRow
    ld a,(hl)
    cp 23
    jr nc,PrintScroll
    inc (hl)
    ret

; Scrolls the whole screen up one character row and clears row 23 with the permanent attribute.
PrintScroll:
    ld c,0                  ; C = destination row
PrintScrollRow:
    ld a,c
    call PrintRowAddr
    ex de,hl                ; DE = destination
    ld a,c
    inc a
    call PrintRowAddr       ; HL = source
    ld b,8
PrintScrollLine:
    push bc
    push de
    push hl
    ld bc,32
    ldir
    pop hl
    pop de
    pop bc
    inc h
    inc d
    djnz PrintScrollLine
    inc c
    ld a,c
    cp 23
    jr c,PrintScrollRow
    ld hl,$5820
    ld de,$5800
    ld bc,23*32
    ldir
    ld a,23
    call PrintRowAddr
    ld b,8
PrintScrollClear:
    push bc
    push hl
    ld (hl),0
    ld d,h
    ld e,l
    inc de
    ld bc,31
    ldir
    pop hl
    pop bc
    inc h
    djnz PrintScrollClear
    ld hl,$5ae0
    ld de,$5ae1
    ld a,(PrintAttrP)
    ld (hl),a
    ld bc,31
    ldir
    ret

; ------------------------------------------------------------------------------------------------
; PRINT's comma: moves to column 16, or to the next line when the cursor is at or past it, by
; printing spaces. Changes AF, BC, DE, HL.
PrintComma:
    ld a,(PrintCol)
    cp 16
    ld a,16
    jr c,PrintSpacesTo
    ld a,32
    ; fall through

; Prints spaces until the cursor is at column A (16 or 32).
PrintSpacesTo:
    ld hl,PrintCol
    cp (hl)
    ret z
    ret c
    push af
    ld a,' '
    call PrintGlyph
    pop af
    jr PrintSpacesTo

; ------------------------------------------------------------------------------------------------
; TAB: moves to column A mod 32 by printing spaces, on the next line when the cursor is past it.
; Changes AF, BC, DE, HL.
PrintTab:
    and 31
    ld hl,PrintCol
    cp (hl)
    ret z
    jr nc,PrintSpacesTo
    push af
    ld a,32
    call PrintSpacesTo      ; to the end of the line
    call PrintNewline
    pop af
    jr PrintSpacesTo

; ------------------------------------------------------------------------------------------------
; AT: moves the cursor to row B, column C; stops with "5 Out of screen" when either is outside the
; 24 x 32 screen. Changes AF.
PrintAt:
    ld a,b
    cp 24
    jr nc,PrintAtOut
    ld a,c
    cp 32
    jr nc,PrintAtOut
    ld (PrintCol),a
    ld a,b
    ld (PrintRow),a
    ret
PrintAtOut:
    ld a,4
    jp RaiseError

; ------------------------------------------------------------------------------------------------
; A colour code's argument: C = the code (16 INK, 17 PAPER, 18 FLASH, 19 BRIGHT, 20 INVERSE, 21 OVER),
; A = the value. Stops with "K Invalid colour" for a value the code does not take. Changes AF, BC, HL.
PrintColour:
    ld b,a                  ; B = the value
    ld a,c
    ld hl,PrintFlags
    cp 20
    ld c,2                  ; INVERSE: bit 1
    jr z,PrintColourFlag
    cp 21
    ld c,1                  ; OVER: bit 0
    jr z,PrintColourFlag
    ld hl,PrintAttr
    cp 18
    ld c,$80                ; FLASH
    jr z,PrintColourBit
    cp 19
    ld c,$40                ; BRIGHT
    jr z,PrintColourBit
    cp 16
    ld c,$07                ; INK
    ld a,b
    jr z,PrintColourField
    ld c,$38                ; PAPER
    cp 8
    jr z,PrintColourKeep
    jr nc,PrintColourBad
    rlca
    rlca
    rlca
    jr PrintColourSet
PrintColourField:           ; A = the value
    cp 8
    jr z,PrintColourKeep
    jr nc,PrintColourBad
PrintColourSet:             ; A = the value in the field's position, C = the field, HL = PrintAttr
    ld b,a
    ld a,c
    cpl
    and (hl)
    or b
    ld (hl),a
    inc hl
    ld a,c
    cpl
    and (hl)
    ld (hl),a               ; the field is no longer kept from the screen
    ret
PrintColourKeep:            ; 8: keep the field from the screen
    inc hl
    ld a,(hl)
    or c
    ld (hl),a
    ret
PrintColourBit:             ; FLASH, BRIGHT: B = 0, 1 or 8
    ld a,b
    cp 8
    jr z,PrintColourKeep
    cp 2
    jr nc,PrintColourBad
    neg                     ; 0 -> 0, 1 -> $FF
    and c
    jr PrintColourSet
PrintColourFlag:            ; INVERSE, OVER: B = 0 or 1, C = the flag, HL = PrintFlags
    ld a,b
    cp 2
    jr nc,PrintColourBad
    neg
    and c
    ld b,a
    ld a,c
    cpl
    and (hl)
    or b
    ld (hl),a
    ret
PrintColourBad:
    ld a,19
    jp RaiseError

; ------------------------------------------------------------------------------------------------
; Prints String HL. In: A bit 0 set frees the String afterwards. Changes AF, BC, DE, HL.
PrintStr:
    push af                 ; S: [flag]
    push hl                 ; S: [string][flag]
    ld a,h
    or l
    jr z,PrintStrDone
    ld c,(hl)
    inc hl
    ld b,(hl)
    inc hl
PrintStrLoop:
    ld a,b
    or c
    jr z,PrintStrDone
    ld a,(hl)
    push hl
    push bc
    call PrintChar
    pop bc
    pop hl
    inc hl
    dec bc
    jr PrintStrLoop
PrintStrDone:
    pop hl                  ; S: [flag]
    pop af                  ; S: []
    rra
    ret nc
    jp Free

; ------------------------------------------------------------------------------------------------
; Prints A as an unsigned (PrintU8) or signed (PrintI8) decimal number. Changes AF, BC, DE, HL.
PrintU8:
    ld l,a
    ld h,0
    jr PrintU16
PrintI8:
    ld l,a
    rla
    sbc a,a
    ld h,a
    ; fall through

; Prints HL as a signed (PrintI16) or unsigned (PrintU16) decimal number. Changes AF, BC, DE, HL.
PrintI16:
    bit 7,h
    jr z,PrintU16
    push hl
    ld a,'-'
    call PrintChar
    pop hl
    xor a
    sub l
    ld l,a
    sbc a,a
    sub h
    ld h,a
PrintU16:
    ld b,0                  ; B = 1 once a digit has been printed
    ld de,-10000
    call PrintDigit
    ld de,-1000
    call PrintDigit
    ld de,-100
    call PrintDigit
    ld de,-10
    call PrintDigit
    ld a,l
    add a,'0'
    jp PrintChar

; Prints the digit of HL at the power of ten -DE, skipping a leading zero; HL keeps the rest.
PrintDigit:
    ld a,'0'-1
PrintDigitCount:
    inc a
    add hl,de
    jr c,PrintDigitCount
    sbc hl,de               ; carry is clear: undo the subtraction that went below zero
    cp '0'
    jr nz,PrintDigitOut
    inc b
    dec b
    ret z
PrintDigitOut:
    ld b,1
    push hl
    push bc
    call PrintChar
    pop bc
    pop hl
    ret

; ------------------------------------------------------------------------------------------------
; Prints DE:HL (DE = the high word) as a signed (PrintI32) or unsigned (PrintU32) decimal number.
; Changes AF, BC, DE, HL.
PrintI32:
    bit 7,d
    jr z,PrintU32
    push de
    push hl
    ld a,'-'
    call PrintChar
    pop hl
    pop de
    xor a
    sub l
    ld l,a
    ld a,0
    sbc a,h
    ld h,a
    ld a,0
    sbc a,e
    ld e,a
    ld a,0
    sbc a,d
    ld d,a
PrintU32:
    ld (Print32Value),hl
    ld (Print32Value+2),de
    ld b,0                  ; B = the number of digits
Print32Divide:              ; Print32Value /= 10, the byte-wise long division from the top byte
    push bc
    ld hl,Print32Value+3
    ld c,4
    xor a                   ; A = the remainder so far
Print32Byte:
    ld e,(hl)
    ld b,8
Print32Bit:                 ; A:E <<= 1; a quotient bit into E when A reaches 10
    sla e
    rla
    cp 10
    jr c,Print32Zero
    sub 10
    inc e
Print32Zero:
    djnz Print32Bit
    ld (hl),e
    dec hl
    dec c
    jr nz,Print32Byte
    pop bc
    add a,'0'
    push af                 ; the digits go on the stack, the last first
    inc b
    ld hl,(Print32Value)
    ld a,h
    or l
    ld hl,(Print32Value+2)
    or h
    or l
    jr nz,Print32Divide
Print32Out:
    pop af
    push bc
    call PrintChar
    pop bc
    djnz Print32Out
    ret

Print32Value:
    .defs 4

; ------------------------------------------------------------------------------------------------
; CLS: clears the screen to the permanent attribute and moves the cursor to the top left.
; Changes AF, BC, DE, HL.
Cls:
    ld hl,$4000
    ld de,$4001
    ld bc,$17ff
    ld (hl),0
    ldir
    ld a,(PrintAttrP)
    inc hl
    inc de
    ld (hl),a
    ld bc,$2ff
    ldir
    xor a
    ld (PrintRow),a
    ld (PrintCol),a
    ret

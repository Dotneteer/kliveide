; Text on the ULA screen, 32 columns by 24 rows, with the font of the ROM that .nexload leaves
; paged in. Every print routine takes the row in D, the column in E and the attribute in C, and
; leaves E on the column after the text.

; Clears the ULA screen: no pixels, PAPER 7 and INK 0 everywhere
ClearScreen:
    ld hl,$4000
    ld de,$4001
    ld bc,$1800
    ld (hl),0
    ldir                    ; the pixels; HL is $5800 now
    ld (hl),$38
    ld bc,$02FF
    ldir                    ; the attributes
    ret

; Prints the zero-terminated text at HL. Keeps C and D.
PrintText:
    ld a,(hl)
    or a
    ret z
    push hl
    call PrintChar
    pop hl
    inc hl
    inc e
    jr PrintText

; Prints the character in A and moves to the next column. Keeps C and D.
PrintCharNext:
    call PrintChar
    inc e
    ret

; Prints the character in A. Keeps C, D and E.
PrintChar:
    push de
    ld l,a
    ld h,0
    add hl,hl
    add hl,hl
    add hl,hl
    add hl,$3C00            ; the character's 8 bytes: $3D00 + (A - 32) * 8
    push hl
    ld a,d
    add a,a
    add a,a
    add a,a
    ld d,a                  ; the pixel row: row * 8
    ld a,e
    add a,a
    add a,a
    add a,a
    ld e,a                  ; the pixel column: column * 8
    pixelad                 ; HL: the screen byte of pixel (E, D)
    pop de                  ; DE: the character's bytes
    ld b,8
PrintCharLine:
    ld a,(de)
    ld (hl),a
    inc de
    pixeldn                 ; HL: the same byte one pixel line down
    djnz PrintCharLine
    pop de
    ld l,d
    ld h,0
    add hl,hl
    add hl,hl
    add hl,hl
    add hl,hl
    add hl,hl               ; row * 32
    ld a,e
    add hl,a                ; + column
    add hl,$5800
    ld (hl),c               ; the character's attribute
    ret

; Prints A as two hexadecimal digits. Keeps C and D.
PrintHex8:
    push af
    rrca
    rrca
    rrca
    rrca
    call PrintHexDigit
    pop af
PrintHexDigit:
    and $0F
    cp 10
    jr c,PrintHexDigit1
    add a,7                 ; A-F follow 9 with a gap of 7 characters
PrintHexDigit1:
    add a,$30               ; "0"
    jp PrintCharNext

; Prints A (0-99) as two decimal digits. Keeps C and D.
PrintDec8:
    ld b,$2F                ; one less than "0"
PrintDec8Tens:
    inc b
    sub 10
    jr nc,PrintDec8Tens
    add a,$3A               ; undo the last SUB and add "0"
    push af
    ld a,b
    call PrintCharNext
    pop af
    jp PrintCharNext

; Prints HL as five characters, with spaces in place of leading zeros. Keeps C and D.
PrintNum16:
    ld a,1
    jr PrintDec16Start

; Prints HL as five decimal digits. Keeps C and D.
PrintDec16:
    xor a
PrintDec16Start:
    ld (PrintDecLead),a     ; 1: print leading zeros as spaces
    ld a,c
    ld (PrintDecAttr),a
    ld bc,-10000
    call PrintDecDigit
    ld bc,-1000
    call PrintDecDigit
    ld bc,-100
    call PrintDecDigit
    ld bc,-10
    call PrintDecDigit
    xor a
    ld (PrintDecLead),a     ; the last digit is printed even when it is 0
    ld bc,-1
    call PrintDecDigit
    ld a,(PrintDecAttr)
    ld c,a
    ret

; Prints how many times -BC fits into HL, and leaves the remainder in HL
PrintDecDigit:
    ld a,$2F                ; one less than "0"
PrintDecDigitLoop:
    inc a
    add hl,bc
    jr c,PrintDecDigitLoop
    sbc hl,bc               ; one subtraction too many: add it back
    push hl
    cp $30
    jr nz,PrintDecNotZero
    ld b,a
    ld a,(PrintDecLead)
    or a
    ld a,b
    jr z,PrintDecPrint
    ld a,$20                ; a leading zero: a space instead
    jr PrintDecPrint
PrintDecNotZero:
    ld b,a
    xor a
    ld (PrintDecLead),a     ; the first non-zero digit ends the leading zeros
    ld a,b
PrintDecPrint:
    ld b,a
    ld a,(PrintDecAttr)
    ld c,a
    ld a,b
    call PrintCharNext
    pop hl
    ret

PrintDecAttr:
    .defb 0
PrintDecLead:
    .defb 0

; Prints the footer and waits for a key. Every demo ends with this, or, if it runs until a key
; is pressed, with ShowMenuFooter before its loop and WaitNoKey after it.
WaitForMenu:
    call ShowMenuFooter
    call WaitKey
    jp WaitNoKey            ; let go of the key before the menu reads one

; Prints "Press any key for the menu" on the bottom row
ShowMenuFooter:
    ld de,$1700             ; row 23, column 0
    ld c,$68                ; BRIGHT 1, PAPER 5, INK 0
    ld hl,WaitForMenuText
    jp PrintText

WaitForMenuText:
    .defn "Press any key for the menu"

; Demo: Bank Window
; Chapter: Memory, Ports and NextRegs (content/next-memory-io.mdx), "Eight slots of 8K"
;
; Looks at different 8K pages through one window, slot 7 ($E000-$FFFF). Three pages come from
; the NEX file (bank-window-data.kz80.asm); the fourth is page $0A, the ULA screen, so a write
; through the window appears on the screen. Writes NextReg $57 with NEXTREG and reads it back
; through ports $243B and $253B. Restores slot 7 before it returns.

BankWindowTitle:
    .defn "Bank Window"

BwWindow:   .equ $E000      ; slot 7
BwBarRow:   .equ 12         ; the text row the bar is drawn on

BankWindow:
    ld de,$0000
    ld c,$78
    ld hl,BankWindowTitle
    call PrintText

    ; Borrow slot 7 politely: remember which page it holds
    ReadNextReg($57)
    ld (BwOldPage),a
    ld de,$0200             ; row 2
    ld c,$38
    ld hl,BwSlotText
    call PrintText
    ld a,(BwOldPage)
    call PrintHex8

    ; Three pages loaded from the NEX file, each with a line of text at its start
    ld de,$0400             ; row 4
    ld hl,BwPages
BwPageLoop:
    ld a,(hl)
    or a
    jr z,BwScreen           ; a zero page ends the list
    push hl
    nextreg $57,a           ; page it into slot 7
    call BwShowPage         ; print the page number read back, then the text at $E000
    pop hl
    inc hl
    inc d                   ; the next row
    jr BwPageLoop

    ; Page $0A is the first half of bank 5: the ULA screen. Draw through the window.
BwScreen:
    inc d
    ld a,$0A
    nextreg $57,a
    call BwShowPage         ; the "text" is the screen's top pixel line: print our own instead
    ld e,5
    ld hl,BwScreenText
    call PrintText
    call BwDrawBar
    ld de,$0E00             ; row 14
    ld c,$38
    ld hl,BwBarText
    call PrintText

    ; Give slot 7 back
    ld a,(BwOldPage)
    nextreg $57,a
    ld de,$1000             ; row 16
    ld hl,BwBackText
    call PrintText
    ReadNextReg($57)
    ld c,$38
    call PrintHex8

    call WaitForMenu
    ret

; Prints "$nn:" at row D, column 0, where nn is NextReg $57 read back. For a page from the NEX
; file, also prints the zero-terminated text at $E000. Keeps D.
BwShowPage:
    ReadNextReg($57)        ; uses BC: set the attribute after it
    ld e,0
    ld c,$38
    push af
    ld a,$24                ; "$"
    call PrintCharNext
    pop af
    push af
    call PrintHex8
    ld a,$3A                ; ":"
    call PrintCharNext
    pop af
    cp $0A
    ret z                   ; the screen page holds pixels, not text
    ld e,5
    ld c,$3A                ; PAPER 7, INK 2: what the window shows is red
    ld hl,BwWindow
    jp PrintText

; Fills text row BwBarRow, all 32 columns, through the window: 8 pixel lines of a pattern, and red
; attributes. With page $0A in slot 7, screen address $4000 + n is BwWindow + n.
BwDrawBar:
    ld hl,BwWindow + $0800 + (BwBarRow - 8) * 32   ; row 12 is in the middle third
    ld c,%01010101          ; the pattern: a checkerboard, rotated every pixel line
    ld b,8
BwBarLine:
    push bc
    push hl
    ld b,32
BwBarByte:
    ld (hl),c
    inc hl
    djnz BwBarByte
    pop hl
    inc h                   ; one pixel line down: the next 256 bytes
    pop bc
    rrc c
    djnz BwBarLine

    ld hl,BwWindow + $1800 + BwBarRow * 32
    ld b,32
BwBarAttr:
    ld (hl),$3A             ; PAPER 7, INK 2
    inc hl
    djnz BwBarAttr
    ret

; The pages to look at, ending with 0. Bank n is pages 2n and 2n+1.
BwPages:
    .defb 40, 41, 42, 0     ; bank 20 (both halves), bank 21 (first half)

BwOldPage:
    .defb 0
BwSlotText:
    .defn "Slot 7 ($E000) holds page $"
BwScreenText:
    .defn "the ULA screen"
BwBarText:
    .defn "Written at $E880, seen at $4880"
BwBackText:
    .defn "Slot 7 back to page $"

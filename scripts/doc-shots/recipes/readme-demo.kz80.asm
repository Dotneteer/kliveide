; Rainbow - the program in the README's screenshot.
; Prints a greeting through the ROM, then sweeps diagonal colour bands
; across the screen's attributes, one step every other frame.

        .model Spectrum48
        .org #8000

Start:
        ei                      ; HALT needs interrupts to wake up
        ld a,1
        out (#fe),a             ; blue border
        ld a,2
        call #1601              ; open channel 2, the upper screen
        ld hl,Message
PrintNext:
        ld a,(hl)
        or a
        jr z,Animate
        rst #10                 ; print the character in A
        inc hl
        jr PrintNext

Animate:
        ld d,0                  ; frame counter
Frame:
        halt                    ; wait for the next frame
        inc d
        ld a,d
        rra
        ld e,a                  ; E = band offset, half the frame count
        ld hl,#5800             ; start of the attribute memory
        ld c,0                  ; C = row
Row:
        ld b,32                 ; B = column counter
        ld a,c
        cp MessageRow           ; leave the message's row alone
        jr nz,Cell
        ld a,l
        add a,32
        ld l,a
        jr nc,NextRow
        inc h
        jr NextRow
Cell:
        ld a,b
        add a,c
        add a,e                 ; column + row + offset: moving diagonals
        rra
        and 7                   ; a colour, 0-7
        rlca
        rlca
        rlca                    ; ... moved to the PAPER bits
        or #40                  ; BRIGHT
        ld (hl),a
        inc hl
        djnz Cell
NextRow:
        inc c
        ld a,c
        cp 24
        jr nz,Row
        jr Frame

MessageRow .equ 11

Message:
        .defb 22, MessageRow, 5             ; AT 11,5
        .defm "Hello from Klive IDE!"
        .defb 0

; A ZX80 machine-code program. Klive puts the code into a 1 REM line (its first byte at 16427,
; $402B) and adds 2 RANDOMISE USR(16427) to call it. Run types RUN; Export writes a .o file.
; A ZX80 REM line cannot hold a $76 byte (HALT, LD (HL),(HL), a NEWLINE in data): the ROM takes
; it for the line's end - so this code makes its NEWLINEs at run time.
    .model ZX80

; --- The ROM's print routine (RST $10) keeps its state in the alternate registers: DE' is where
; --- the next character goes in the display file, BC' counts the columns and lines left. PRINT
; --- loads them from these system variables and stores them back; code called by USR does the same.
DF_EA    .equ $400E     ; where the next character goes
DF_END   .equ $4010     ; the end of the display file
S_POSN   .equ $4024     ; the column (C) and line (B) counters

; --- Control codes in the message, outside the ZX80 character set
CTL_NL   .equ $70       ; followed by a count: that many NEWLINEs
CTL_INV  .equ $71       ; inverse video on/off
CTL_END  .equ $FF       ; end of the message

Start:
    exx                 ; take over the print position
    ld de,(DF_EA)
    ld bc,(S_POSN)
    exx
    ld hl,Message       ; HL points to the message
    ld e,0              ; E is OR-ed into each character: $80 prints it in inverse video
NextCh:
    ld a,(hl)           ; get the next code
    inc hl
    cp CTL_END
    jr z,Done
    cp CTL_NL
    jr z,NewLines
    cp CTL_INV
    jr z,Invert
    or e
    rst $10             ; display the character
    jr NextCh           ; next code

NewLines:
    ld b,(hl)           ; how many
    inc hl
NextLine:
    ld a,$75
    inc a               ; NEWLINE ($76), made here: the REM line cannot hold the byte
    rst $10
    djnz NextLine
    jr NextCh

Invert:
    ld a,e
    xor $80             ; toggle inverse video
    ld e,a
    jr NextCh

Done:
    exx                 ; hand the print position back to the ROM
    ex de,hl
    ld (S_POSN),bc
    ld (DF_EA),hl
    ld (DF_END),hl
    exx
    ret                 ; back to BASIC (report 0/2)

Message:
    .defb CTL_NL, 10                    ; down to line 10
    .defzx "      WELCOME TO KLIVE IDE"
    .defb CTL_NL, 1
    .defzx "        "
    .defb CTL_INV                       ; inverse video on
    .defzx "(SINCLAIR ZX80)"
    .defb CTL_INV                       ; inverse video off
    .defb CTL_END                       ; terminate

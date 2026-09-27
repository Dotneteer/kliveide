; @module   errors
; @summary  Runtime error reports: the program stops with the ROM's familiar report.
; @exports  RaiseError, ReportError
; @requires program, rom
;
; The report codes are the ROM's ERR_NR values, one less than the report's number or letter:
; 2 Subscript wrong, 3 Out of memory, 4 Out of screen, 5 Number too big, 9 Invalid argument,
; 10 Integer out of range, 11 Nonsense in BASIC, 14 Invalid file name, 19 Invalid colour,
; 20 BREAK into program, 26 Tape loading error.

; ------------------------------------------------------------------------------------------------
; Stops the program with a report. In: A = ERR_NR code. Does not return.
;
; Goes where the ROM's error restart (RST 8) goes after reading its code byte: $0055 stores L in
; ERR_NR, resets SP from ERR_SP and shows the report. X_PTR is set from CH_ADD as RST 8 does. HL'
; and IX are restored first, because the report returns to BASIC.
RaiseError:
#ifmod Next
    ld ($5c3a),a            ; ERR_NR, where ReportError reads it
    jp ReportError
#endif
    call RomIn              ; the report is the 48K BASIC ROM's (the program does not come back)
    ld iy,$5c3a
    ld ix,(SavedIX)
    exx
    ld hl,(SavedHL2)
    exx
    ld hl,($5c5d)           ; CH_ADD
    ld ($5c5f),hl           ; X_PTR
    ld l,a
    jp $0055

; ------------------------------------------------------------------------------------------------
; The Next: a report and the end of the program. NextZXOS's 48K BASIC ROM is not the original one
; (its main loop is elsewhere), and a NEX has no BASIC to return to, so the runtime prints the report
; itself - "<number or letter> <message>" on the bottom line - and ends the program. RaiseError comes
; here, and so do the ROM's own errors (RST 8, the calculator's "6 Number too big"): the start-up
; stub points ERR_SP at a word holding this address. In: ERR_NR ($5C3A) = the code. Uses the print
; module, which a Next program always links (print requires this module, so it cannot be required here).
ReportError:
#ifmod Next
    ld sp,(ProgramSP)
    ld iy,$5c3a
ReportErrorPaging:
    ld a,(RomDepth)         ; an error inside a ROM call left the ROM paged in: page it out
    or a
    jr z,ReportErrorPrint
    call RomOut
    jr ReportErrorPaging
ReportErrorPrint:
    ld bc,$1700             ; row 23, column 0
    call PrintAt
    ld a,($5c3a)
    inc a                   ; the report's number or letter: ERR_NR + 1
    cp 10
    jr c,ReportErrorDigit
    add a,7                 ; 10 and up are letters: "A" follows "9" by 8
ReportErrorDigit:
    add a,$30               ; "0"
    call PrintChar
    ld a,$20                ; " "
    call PrintChar
    ld a,($5c3a)
    inc a
    ld hl,ReportMessages
ReportErrorFind:            ; skip A messages (each ends with a byte with bit 7 set)
    or a
    jr z,ReportErrorText
    ld c,a
ReportErrorSkip:
    bit 7,(hl)
    inc hl
    jr z,ReportErrorSkip
    ld a,c
    dec a
    jr ReportErrorFind
ReportErrorText:
    ld a,(hl)
    push hl
    push af
    and $7f
    call PrintChar
    pop af
    pop hl
    inc hl
    bit 7,a
    jr z,ReportErrorText
    ld bc,0
    jp End

; The messages by report, the last character of each with bit 7 set (the ROM's 48K reports).
ReportMessages:
    .defm "O"
    .defb $cb
    .defm "NEXT without FO"
    .defb $d2
    .defm "Variable not foun"
    .defb $e4
    .defm "Subscript wron"
    .defb $e7
    .defm "Out of memor"
    .defb $f9
    .defm "Out of scree"
    .defb $ee
    .defm "Number too bi"
    .defb $e7
    .defm "RETURN without GOSU"
    .defb $c2
    .defm "End of fil"
    .defb $e5
    .defm "STOP statemen"
    .defb $f4
    .defm "Invalid argumen"
    .defb $f4
    .defm "Integer out of rang"
    .defb $e5
    .defm "Nonsense in BASI"
    .defb $c3
    .defm "BREAK - CONT repeat"
    .defb $f3
    .defm "Out of DAT"
    .defb $c1
    .defm "Invalid file nam"
    .defb $e5
    .defm "No room for lin"
    .defb $e5
    .defm "STOP in INPU"
    .defb $d4
    .defm "FOR without NEX"
    .defb $d4
    .defm "Invalid I/O devic"
    .defb $e5
    .defm "Invalid colou"
    .defb $f2
    .defm "BREAK into progra"
    .defb $ed
    .defm "RAMTOP no goo"
    .defb $e4
    .defm "Statement los"
    .defb $f4
    .defm "Invalid strea"
    .defb $ed
    .defm "FN without DE"
    .defb $c6
    .defm "Parameter erro"
    .defb $f2
    .defm "Tape loading erro"
    .defb $f2
#else
    ret
#endif

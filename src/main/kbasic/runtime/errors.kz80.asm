; @module   errors
; @summary  Runtime error reports: the program stops with the ROM's familiar report.
; @exports  RaiseError
; @requires program
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
    ld iy,$5c3a
    ld ix,(SavedIX)
    exx
    ld hl,(SavedHL2)
    exx
    ld hl,($5c5d)           ; CH_ADD
    ld ($5c5f),hl           ; X_PTR
    ld l,a
    jp $0055

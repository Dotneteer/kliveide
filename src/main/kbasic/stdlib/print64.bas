' Klive BASIC standard library - print64.bas: print64 and printat64.
' Klive's own code, written from the documented API (.ai/kbasic/stdlib-api.json), with Klive's own
' 3 x 7 font (scripts/kbasic-font64.cjs generates the table below).
#pragma once
#include <__kbase.bas>
#pragma push(case_insensitive)
#pragma case_insensitive = true

' The print64 cursor: row 0-23, column 0-63. It is print64's own, apart from PRINT's and print42's.
DIM __kbP64Row AS UByte
DIM __kbP64Col AS UByte

' Characters 32-127, two to eight bytes: each byte is one pixel row (the top one blank), the even
' character in bits 7-5 and the odd one in bits 3-1.
DIM __kbP64Font(0 TO 383) AS UByte => { _
    0, 4, 4, 4, 0, 4, 0, 0, 0, 170, 174, 10, 14, 10, 0, 0, _
    0, 104, 194, 68, 104, 194, 0, 0, 0, 68, 164, 64, 160, 96, 0, 0, _
    0, 40, 68, 68, 68, 40, 0, 0, 0, 0, 164, 78, 164, 0, 0, 0, _
    0, 0, 0, 14, 0, 64, 128, 0, 0, 2, 2, 4, 8, 72, 0, 0, _
    0, 228, 172, 164, 164, 238, 0, 0, 0, 204, 34, 68, 130, 236, 0, 0, _
    0, 174, 168, 236, 34, 44, 0, 0, 0, 110, 130, 228, 164, 228, 0, 0, _
    0, 238, 170, 238, 162, 236, 0, 0, 0, 0, 68, 0, 68, 8, 0, 0, _
    0, 32, 78, 128, 78, 32, 0, 0, 0, 140, 66, 36, 64, 132, 0, 0, _
    0, 68, 170, 238, 138, 106, 0, 0, 0, 198, 168, 200, 168, 198, 0, 0, _
    0, 206, 168, 172, 168, 206, 0, 0, 0, 230, 136, 202, 138, 134, 0, 0, _
    0, 174, 164, 228, 164, 174, 0, 0, 0, 42, 42, 44, 170, 74, 0, 0, _
    0, 138, 142, 142, 138, 234, 0, 0, 0, 196, 170, 170, 170, 164, 0, 0, _
    0, 196, 170, 202, 138, 132, 2, 0, 0, 198, 168, 196, 162, 172, 0, 0, _
    0, 234, 74, 74, 74, 78, 0, 0, 0, 170, 170, 174, 174, 74, 0, 0, _
    0, 170, 170, 68, 164, 164, 0, 0, 0, 230, 36, 68, 132, 230, 0, 0, _
    0, 140, 132, 68, 36, 44, 0, 0, 0, 64, 160, 0, 0, 0, 14, 0, _
    0, 192, 140, 194, 134, 238, 0, 0, 0, 128, 128, 198, 168, 198, 0, 0, _
    0, 32, 36, 110, 168, 102, 0, 0, 0, 32, 64, 230, 74, 70, 2, 12, _
    0, 132, 128, 204, 164, 174, 0, 0, 0, 40, 10, 44, 44, 42, 160, 64, _
    0, 192, 64, 78, 78, 234, 0, 0, 0, 0, 0, 196, 170, 164, 0, 0, _
    0, 0, 0, 198, 170, 198, 130, 130, 0, 0, 6, 108, 130, 140, 0, 0, _
    0, 64, 64, 234, 74, 38, 0, 0, 0, 0, 0, 170, 174, 78, 0, 0, _
    0, 0, 0, 170, 74, 166, 2, 12, 0, 2, 4, 236, 68, 226, 0, 0, _
    0, 72, 68, 70, 68, 72, 0, 0, 0, 4, 202, 46, 10, 4, 0, 0 _
}

' Moves the print64 cursor to row y (0-23), column x (0-63); others stop the program with
' "5 Out of screen".
SUB printat64(BYVAL y AS UByte, BYVAL x AS UByte)
    IF y > 23 OR x > 63 THEN
        ASM
            ld a,4
            jp core.RaiseError
        END ASM
    END IF
    __kbP64Row = y
    __kbP64Col = x
END SUB

' Prints s at the print64 cursor, four pixels a character, in the permanent colours (ATTR_P), and
' moves the cursor on. CHR$ 13 starts a new line; a character outside 32-127 prints as "?". Past
' the last column the text goes on at the next row, and past the last row at the top.
SUB print64(BYVAL s AS String)
    DIM i AS UInteger
    DIM ch AS UByte
    DIM glyph AS UInteger
    DIM address AS UInteger
    DIM r AS UByte
    DIM pattern AS UByte
    DIM keep AS UByte
    FOR i = 1 TO LEN(s)
        ch = CODE(s(i - 1 + __kbStringBase))
        IF ch = 13 THEN
            __kbP64Col = 64
        ELSE
            IF ch < 32 OR ch > 127 THEN ch = 63
            glyph = CAST(UInteger, (ch - 32) SHR 1) * 8
            address = 16384 + (CAST(UInteger, __kbP64Row BAND 24) SHL 8) + (CAST(UInteger, __kbP64Row BAND 7) SHL 5) + (__kbP64Col SHR 1)
            keep = 0Fh
            IF (__kbP64Col BAND 1) = 1 THEN keep = 0F0h
            FOR r = 0 TO 7
                pattern = __kbP64Font(glyph + r)
                IF (ch BAND 1) = 1 THEN pattern = pattern SHL 4
                pattern = pattern BAND 0F0h
                IF keep = 0F0h THEN pattern = pattern SHR 4
                POKE address, (PEEK(address) BAND keep) BOR pattern
                address = address + 256
            NEXT r
            POKE 22528 + CAST(UInteger, __kbP64Row) * 32 + (__kbP64Col SHR 1), PEEK(23693)
            __kbP64Col = __kbP64Col + 1
        END IF
        IF __kbP64Col > 63 THEN
            __kbP64Col = 0
            __kbP64Row = __kbP64Row + 1
            IF __kbP64Row > 23 THEN __kbP64Row = 0
        END IF
    NEXT i
END SUB

#pragma pop(case_insensitive)

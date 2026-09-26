' Klive BASIC standard library - print42.bas: print42 and printat42.
' Klive's own code, written from the documented API (.ai/kbasic/stdlib-api.json). The characters
' are the machine's own font (CHARS), squeezed to five pixels and a gap: its six columns keep their
' outer four, and the middle two are merged into one.
#pragma once
#include <__kbase.bas>
#pragma push(case_insensitive)
#pragma case_insensitive = true

' The print42 cursor: row 0-23, column 0-41. It is print42's own, apart from PRINT's.
DIM __kbP42Row AS UByte
DIM __kbP42Col AS UByte

' Moves the print42 cursor to row y (0-23), column x (0-41); others stop the program with
' "5 Out of screen".
SUB printat42(BYVAL y AS UByte, BYVAL x AS UByte)
    IF y > 23 OR x > 41 THEN
        ASM
            ld a,4
            jp core.RaiseError
        END ASM
    END IF
    __kbP42Row = y
    __kbP42Col = x
END SUB

' Prints s at the print42 cursor in the permanent colours (ATTR_P) and moves the cursor on. CHR$ 13
' starts a new line; a character outside 32-127 prints as "?". Past the last column the text goes
' on at the next row, and past the last row at the top.
SUB print42(BYVAL s AS String)
    DIM i AS UInteger
    DIM ch AS UByte
    DIM glyph AS UInteger
    DIM address AS UInteger
    DIM x AS UInteger
    DIM b AS UByte
    DIM shift AS UByte
    DIM r AS UByte
    DIM pattern AS UInteger
    DIM mask AS UInteger
    DIM g AS UByte
    DIM attribute AS UInteger
    FOR i = 1 TO LEN(s)
        ch = CODE(s(i - 1 + __kbStringBase))
        IF ch = 13 THEN
            __kbP42Col = 42
        ELSE
            IF ch < 32 OR ch > 127 THEN ch = 63
            glyph = PEEK(UInteger, 23606) + CAST(UInteger, ch) * 8
            x = CAST(UInteger, __kbP42Col) * 6
            b = x SHR 3
            shift = x BAND 7
            address = 16384 + (CAST(UInteger, __kbP42Row BAND 24) SHL 8) + (CAST(UInteger, __kbP42Row BAND 7) SHL 5) + b
            mask = 0FC00h SHR shift
            FOR r = 0 TO 7
                g = PEEK(glyph + r)
                pattern = (CAST(UInteger, ((g BAND 70h) SHL 1) BOR ((g BAND 0Eh) SHL 2)) SHL 8) SHR shift
                POKE address, (PEEK(address) BAND (CAST(UByte, (mask SHR 8)) BXOR 0FFh)) BOR CAST(UByte, pattern SHR 8)
                IF shift > 2 THEN POKE address + 1, (PEEK(address + 1) BAND (CAST(UByte, mask BAND 0FFh) BXOR 0FFh)) BOR CAST(UByte, pattern BAND 0FFh)
                address = address + 256
            NEXT r
            attribute = 22528 + CAST(UInteger, __kbP42Row) * 32 + b
            POKE attribute, PEEK(23693)
            IF shift > 2 THEN POKE attribute + 1, PEEK(23693)
            __kbP42Col = __kbP42Col + 1
        END IF
        IF __kbP42Col > 41 THEN
            __kbP42Col = 0
            __kbP42Row = __kbP42Row + 1
            IF __kbP42Row > 23 THEN __kbP42Row = 0
        END IF
    NEXT i
END SUB

#pragma pop(case_insensitive)

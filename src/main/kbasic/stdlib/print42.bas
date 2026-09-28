' Klive BASIC standard library - print42.bas: print42 and printat42.
' Klive's own code, written from the documented API (.ai/kbasic/stdlib-api.json). The characters
' are the machine's own font (CHARS), squeezed to five pixels and a gap: its six columns keep their
' outer four, and the middle two are merged into one.
#pragma once
#include <__kbase.bas>
#pragma push(case_insensitive)
#pragma case_insensitive = true
#pragma push(asm_dialect)
#pragma asm_dialect = klive

' The print42 cursor: row 0-23, column 0-41. It is print42's own, apart from PRINT's.
DIM __kbP42Row AS UByte
DIM __kbP42Col AS UByte

' Moves the print42 cursor to row y (0-23), column x (0-41). As zxbc's: a column past 41 is the start
' of the next row, and a row past 23 is row 0.
SUB printat42(BYVAL y AS UByte, BYVAL x AS UByte)
    IF x > 41 THEN
        x = 0
        y = y + 1
    END IF
    IF y > 23 THEN y = 0
    __kbP42Row = y
    __kbP42Col = x
END SUB

' Prints s at the print42 cursor in the permanent colours (ATTR_P) and moves the cursor on. Past the
' last column the text goes on at the next row, and past the last row at the top. The characters, as
' zxbc's print42 treats them: 31-127 from the font (CHARS), 144-164 from the UDGs; CHR$ 13 starts a
' new line, CHR$ 8 steps back (to the end of the row above from column 0), CHR$ 22 row, column
' moves the cursor as printat42; every other code is skipped.
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
    i = 1
    WHILE i <= LEN(s)
        ch = CODE(s(i - 1 + __kbStringBase))
        glyph = 0
        IF ch >= 31 AND ch <= 127 THEN
            glyph = PEEK(UInteger, 23606) + CAST(UInteger, ch) * 8
        ELSEIF ch >= 144 AND ch <= 164 THEN
            glyph = PEEK(UInteger, 23675) + CAST(UInteger, ch - 144) * 8
        ELSEIF ch = 13 THEN
            __kbP42Col = 42
        ELSEIF ch = 8 THEN
            IF __kbP42Col > 0 THEN
                __kbP42Col = __kbP42Col - 1
            ELSE
                __kbP42Col = 41
                IF __kbP42Row > 0 THEN __kbP42Row = __kbP42Row - 1 ELSE __kbP42Row = 23
            END IF
        ELSEIF ch = 22 THEN
            IF i + 2 <= LEN(s) THEN printat42(CODE(s(i + __kbStringBase)), CODE(s(i + 1 + __kbStringBase)))
            i = i + 2
        END IF
        IF glyph <> 0 THEN
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
        i = i + 1
    WEND
END SUB

#pragma pop(asm_dialect)
#pragma pop(case_insensitive)

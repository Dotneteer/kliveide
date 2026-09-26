' Klive BASIC standard library - screen.bas: SCREEN$.
' Klive's own code, written from the documented API (.ai/kbasic/stdlib-api.json).
#pragma once
#pragma push(case_insensitive)
#pragma case_insensitive = true

' The character shown at (row, col) when it is one of the font's (32-127, from CHARS), normal or
' inverse; otherwise an empty string. All 24 rows can be read.
FUNCTION SCREEN$(BYVAL row AS UByte, BYVAL col AS UByte) AS String
    DIM cell AS UInteger
    DIM glyph AS UInteger
    DIM ch AS UByte
    DIM r AS UByte
    DIM mask AS UByte
    DIM same AS UByte
    IF row > 23 OR col > 31 THEN RETURN ""
    cell = 16384 + (CAST(UInteger, row BAND 24) SHL 8) + (CAST(UInteger, row BAND 7) SHL 5) + col
    glyph = PEEK(UInteger, 23606) + 256
    FOR ch = 32 TO 127
        mask = PEEK(cell) BXOR PEEK(glyph)
        IF mask = 0 OR mask = 255 THEN
            same = 1
            r = 1
            WHILE same = 1 AND r < 8
                IF (PEEK(cell + (CAST(UInteger, r) SHL 8)) BXOR PEEK(glyph + r)) <> mask THEN same = 0
                r = r + 1
            WEND
            IF same = 1 THEN RETURN CHR$(ch)
        END IF
        glyph = glyph + 8
    NEXT ch
    RETURN ""
END FUNCTION

#pragma pop(case_insensitive)

' Klive BASIC standard library - attr.bas: ATTR.
' Klive's own code, written from the documented API (.ai/kbasic/stdlib-api.json).
#pragma once
#pragma push(case_insensitive)
#pragma case_insensitive = true

' The attribute byte of the character cell at (row, col); all 24 rows can be read. Like the rest of
' the library it does not check its arguments.
FUNCTION ATTR(BYVAL row AS UByte, BYVAL col AS UByte) AS UByte
    RETURN PEEK(22528 + CAST(UInteger, row) * 32 + col)
END FUNCTION

#pragma pop(case_insensitive)

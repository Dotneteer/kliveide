' Klive BASIC standard library - hex.bas: hex, hex16 and hex8.
' Klive's own code, written from the documented API (.ai/kbasic/stdlib-api.json).
#pragma once
#pragma push(case_insensitive)
#pragma case_insensitive = true

' The low `digits` hexadecimal digits of n, upper case, with leading zeros.
FUNCTION __kbHexDigits(BYVAL n AS ULong, BYVAL digits AS UByte) AS String
    DIM result AS String
    DIM d AS UByte
    result = ""
    WHILE digits > 0
        d = CAST(UByte, n BAND 15)
        IF d < 10 THEN
            result = CHR$(48 + d) + result
        ELSE
            result = CHR$(55 + d) + result
        END IF
        n = n SHR 4
        digits = digits - 1
    WEND
    RETURN result
END FUNCTION

' 8 hexadecimal digits of a 32-bit value.
FUNCTION hex(BYVAL n AS ULong) AS String
    RETURN __kbHexDigits(n, 8)
END FUNCTION

' 4 hexadecimal digits of a 16-bit value.
FUNCTION hex16(BYVAL n AS UInteger) AS String
    RETURN __kbHexDigits(n, 4)
END FUNCTION

' 2 hexadecimal digits of an 8-bit value.
FUNCTION hex8(BYVAL n AS UByte) AS String
    RETURN __kbHexDigits(n, 2)
END FUNCTION

#pragma pop(case_insensitive)

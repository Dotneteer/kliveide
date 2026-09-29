' Klive BASIC standard library - input.bas: INPUT.
' Klive's own code, written from the documented API (.ai/kbasic/stdlib-api.json).
#pragma once
#include <__kbase.bas>
#pragma push(case_insensitive)
#pragma case_insensitive = true

' Reads a line of at most maxLength characters at the PRINT position, with a flashing cursor, and
' gives it when ENTER is pressed. DELETE (CAPS SHIFT + 0) removes the last character. Each key is
' taken once: it must be let go before the next one counts.
FUNCTION INPUT(BYVAL maxLength AS UByte) AS String
    DIM result AS String
    DIM k AS String
    DIM c AS UByte
    result = ""
    DO
        PRINT FLASH 1; " "; CHR$(8);
        DO
        LOOP UNTIL INKEY$ = ""
        DO
            k = INKEY$
        LOOP WHILE k = ""
        c = CODE(k)
        IF c = 13 THEN EXIT DO
        IF c = 12 THEN
            IF LEN(result) > 0 THEN
                IF LEN(result) = 1 THEN
                    result = ""
                ELSE
                    result = result( TO __kbStringBase + LEN(result) - 2)
                END IF
                PRINT " "; CHR$(8); CHR$(8);
            END IF
        ELSEIF c >= 32 AND c < 128 AND LEN(result) < maxLength THEN
            result = result + k
            PRINT k;
        END IF
    LOOP
    PRINT " "; CHR$(8);
    RETURN result
END FUNCTION

#pragma pop(case_insensitive)

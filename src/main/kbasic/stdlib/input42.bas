' Klive BASIC standard library - input42.bas: INPUT42.
' Klive's own code, written from the documented API (.ai/kbasic/stdlib-api.json).
#pragma once
#include <__kbase.bas>
#include <print42.bas>
#pragma push(case_insensitive)
#pragma case_insensitive = true

' Reads a line of at most maxChars characters at the print42 cursor, echoed through print42 with a
' "_" cursor, and gives it when ENTER is pressed. DELETE (CAPS SHIFT + 0) removes the last character.
' Each key is taken once: it must be let go before the next one counts.
FUNCTION INPUT42(BYVAL maxChars AS UInteger) AS String
    DIM result AS String
    DIM k AS String
    DIM c AS UByte
    result = ""
    DO
        print42("_" + CHR$(8))
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
                print42(" " + CHR$(8) + CHR$(8))
            END IF
        ELSEIF c >= 32 AND c < 128 AND LEN(result) < maxChars THEN
            result = result + k
            print42(k)
        END IF
    LOOP
    print42(" " + CHR$(8))
    RETURN result
END FUNCTION

#pragma pop(case_insensitive)

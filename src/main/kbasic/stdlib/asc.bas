' Klive BASIC standard library - asc.bas: asc.
' Klive's own code, written from the documented API (.ai/kbasic/stdlib-api.json).
#pragma once
#include <__kbase.bas>
#pragma push(case_insensitive)
#pragma case_insensitive = true

' The code of the n-th character of s (counted from the string base); 0 past the end.
FUNCTION asc(BYVAL s AS String, BYVAL n AS UInteger) AS UByte
    IF n - __kbStringBase >= LEN(s) THEN RETURN 0
    RETURN CODE(s(n))
END FUNCTION

#pragma pop(case_insensitive)

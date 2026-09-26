' Klive BASIC standard library - string.bas: left, mid and right.
' Klive's own code, written from the documented API (.ai/kbasic/stdlib-api.json). Positions count
' from the program's string base, as the program's own slices do.
#pragma once
#include <__kbase.bas>
#pragma push(case_insensitive)
#pragma case_insensitive = true

' The first n characters of s (all of s when it is shorter).
FUNCTION left(BYVAL s AS String, BYVAL n AS UInteger) AS String
    IF n >= LEN(s) THEN RETURN s
    IF n = 0 THEN RETURN ""
    RETURN s( TO __kbStringBase + n - 1)
END FUNCTION

' The last n characters of s (all of s when it is shorter).
FUNCTION right(BYVAL s AS String, BYVAL n AS UInteger) AS String
    IF n >= LEN(s) THEN RETURN s
    IF n = 0 THEN RETURN ""
    RETURN s(__kbStringBase + LEN(s) - n TO )
END FUNCTION

' Up to n characters of s from position start; empty when start is past the end.
FUNCTION mid(BYVAL s AS String, BYVAL start AS UInteger, BYVAL n AS UInteger) AS String
    DIM first AS UInteger
    DIM available AS UInteger
    first = start - __kbStringBase
    IF n = 0 OR first >= LEN(s) THEN RETURN ""
    available = LEN(s) - first
    IF n > available THEN n = available
    RETURN s(start TO start + n - 1)
END FUNCTION

#pragma pop(case_insensitive)

' Klive BASIC standard library - point.bas: POINT.
' Klive's own code, written from the documented API (.ai/kbasic/stdlib-api.json).
#pragma once
#pragma push(case_insensitive)
#pragma case_insensitive = true

' 1 when the pixel at (x, y) is set, else 0, and -1 for a y past the top, as ZX BASIC's POINT gives.
' (0, 0) is the bottom left, as PLOT counts, and all 192 rows can be tested. sinclair-compatible
' (sinclair.bas defines __KBASIC_SINCLAIR_POINT) takes the ROM's coordinates instead, as zxbc --sinclair
' does: y counts the 176 rows above the ROM's editor, so POINT(x, y) tests the pixel PLOT x, y + 16
' sets (observed through the oracle, compatibility plan C3).
FUNCTION POINT(BYVAL x AS UByte, BYVAL y AS UByte) AS Byte
    DIM row AS UByte
    DIM address AS UInteger
#ifdef __KBASIC_SINCLAIR_POINT
    IF y > 175 THEN RETURN -1
    y = y + 16
#else
    IF y > 191 THEN RETURN -1
#endif
    row = 191 - y
    address = 16384 + (CAST(UInteger, row BAND 192) SHL 5) + (CAST(UInteger, row BAND 7) SHL 8)
    address = address + (CAST(UInteger, row BAND 56) SHL 2) + (x SHR 3)
    IF (PEEK(address) BAND (128 SHR (x BAND 7))) <> 0 THEN RETURN 1
    RETURN 0
END FUNCTION

#pragma pop(case_insensitive)

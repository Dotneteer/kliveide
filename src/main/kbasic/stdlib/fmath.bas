' Klive BASIC standard library - fmath.bas: fSin, fCos and fTan.
' Klive's own code, written from the documented API (.ai/kbasic/stdlib-api.json) and zxbc's observed
' results (compatibility plan C6): angles in degrees, Fixed results about 0.25% accurate.
#pragma once
#pragma push(case_insensitive)
#pragma case_insensitive = true

' SIN of 0, 2, 4, ... 90 degrees, times 255, rounded.
DIM __kbSinTable(0 TO 45) AS UByte => { _
    0, 9, 18, 27, 35, 44, 53, 62, 70, 79, 87, 96, 104, 112, 120, 127, 135, 143, 150, 157, 164, 171, _
    177, 183, 190, 195, 201, 206, 211, 216, 221, 225, 229, 233, 236, 240, 243, 245, 247, 249, 251, _
    253, 254, 254, 255, 255 }

' Sine of an angle in degrees: the table read between its 2-degree steps, the result the exact
' Fixed value of (interpolated entry) / 255, rounded down.
FUNCTION fSin(BYVAL num AS Fixed) AS Fixed
    DIM angle AS Fixed
    DIM result AS Fixed
    DIM negative AS UByte = 0
    DIM raw AS ULong
    DIM index AS UByte
    DIM low AS ULong
    DIM high AS ULong
    angle = num MOD 360
    IF angle > 270 THEN
        angle = 360 - angle
        negative = 1
    ELSEIF angle > 180 THEN
        angle = angle - 180
        negative = 1
    ELSEIF angle > 90 THEN
        angle = 180 - angle
    END IF
    raw = PEEK(ULong, @angle)
    index = CAST(UByte, raw SHR 17)
    low = __kbSinTable(index)
    IF index < 45 THEN high = __kbSinTable(index + 1) ELSE high = low
    raw = (low * 131072 + (high - low) * (raw BAND 131071)) / 510
    POKE ULong @result, raw
    IF negative THEN RETURN -result
    RETURN result
END FUNCTION

' Cosine of an angle in degrees: fSin(90 - num).
FUNCTION fCos(BYVAL num AS Fixed) AS Fixed
    RETURN fSin(90 - num)
END FUNCTION

' Tangent of an angle in degrees: fSin(num) / fSin(90 - num).
FUNCTION fTan(BYVAL num AS Fixed) AS Fixed
    RETURN fSin(num) / fSin(90 - num)
END FUNCTION

#pragma pop(case_insensitive)

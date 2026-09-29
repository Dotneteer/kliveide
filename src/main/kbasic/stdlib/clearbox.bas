' Klive BASIC standard library - clearbox.bas: clearBox.
' Klive's own code, written from the documented API (.ai/kbasic/stdlib-api.json).
#pragma once
#pragma push(case_insensitive)
#pragma case_insensitive = true

' Blanks the pixels of the character squares from column x, row y, `width` wide and `height` high.
' The attributes stay; like the documented routine, nothing is checked.
SUB clearBox(BYVAL x AS UByte, BYVAL y AS UByte, BYVAL width AS UByte, BYVAL height AS UByte)
    DIM row AS UByte
    DIM line AS UByte
    DIM address AS UInteger
    DIM column AS UByte
    FOR row = y TO y + height - 1
        FOR line = 0 TO 7
            address = 16384 + CAST(UInteger, row BAND 24) * 256 + CAST(UInteger, row BAND 7) * 32 + CAST(UInteger, line) * 256 + x
            FOR column = 1 TO width
                POKE address, 0
                address = address + 1
            NEXT column
        NEXT line
    NEXT row
END SUB

#pragma pop(case_insensitive)

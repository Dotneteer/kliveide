' Klive BASIC standard library - putchars.bas: putChars, paint and paintData.
' Klive's own code, written from the documented API (.ai/kbasic/stdlib-api.json). x is the column,
' y the row, both in character cells; nothing is checked against the screen's edges.
#pragma once
#pragma push(case_insensitive)
#pragma case_insensitive = true

' Copies width x height character bitmaps (8 bytes each) from dataAddress to the screen at (x, y).
' The data goes column by column: the cells of the first column top to bottom, then the next column.
SUB putChars(BYVAL x AS UByte, BYVAL y AS UByte, BYVAL width AS UByte, BYVAL height AS UByte, BYVAL dataAddress AS UInteger)
    DIM c AS UByte
    DIM r AS UByte
    DIM i AS UByte
    DIM row AS UByte
    DIM cell AS UInteger
    IF width = 0 OR height = 0 THEN RETURN
    FOR c = 0 TO width - 1
        FOR r = 0 TO height - 1
            row = y + r
            cell = 16384 + (CAST(UInteger, row BAND 24) SHL 8) + (CAST(UInteger, row BAND 7) SHL 5) + x + c
            FOR i = 0 TO 7
                POKE cell, PEEK(dataAddress)
                dataAddress = dataAddress + 1
                cell = cell + 256
            NEXT i
        NEXT r
    NEXT c
END SUB

' Gives every cell of the width x height rectangle at (x, y) the attribute byte attribute.
SUB paint(BYVAL x AS UByte, BYVAL y AS UByte, BYVAL width AS UByte, BYVAL height AS UByte, BYVAL attribute AS UByte)
    DIM r AS UByte
    DIM c AS UByte
    DIM address AS UInteger
    IF width = 0 OR height = 0 THEN RETURN
    FOR r = 0 TO height - 1
        address = 22528 + CAST(UInteger, y + r) * 32 + x
        FOR c = 0 TO width - 1
            POKE address + c, attribute
        NEXT c
    NEXT r
END SUB

' Copies width x height attribute bytes from address to the rectangle at (x, y), row by row.
SUB paintData(BYVAL x AS UByte, BYVAL y AS UByte, BYVAL width AS UByte, BYVAL height AS UByte, BYVAL address AS UInteger)
    DIM r AS UByte
    DIM c AS UByte
    DIM target AS UInteger
    IF width = 0 OR height = 0 THEN RETURN
    FOR r = 0 TO height - 1
        target = 22528 + CAST(UInteger, y + r) * 32 + x
        FOR c = 0 TO width - 1
            POKE target + c, PEEK(address)
            address = address + 1
        NEXT c
    NEXT r
END SUB

#pragma pop(case_insensitive)

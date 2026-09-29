' Klive BASIC standard library - puttile.bas: putTile.
' Klive's own code, written from the documented API (.ai/kbasic/stdlib-api.json).
#pragma once
#pragma push(case_insensitive)
#pragma case_insensitive = true

' Copies a 2 x 2 character tile to column x, row y: 36 bytes from graphicsAddr, two bytes for each of
' the 16 pixel rows from the top, then the top two attributes and the bottom two.
SUB putTile(BYVAL x AS UByte, BYVAL y AS UByte, BYVAL graphicsAddr AS UInteger)
    DIM r AS UByte
    DIM row AS UByte
    DIM address AS UInteger
    FOR r = 0 TO 15
        row = y + (r SHR 3)
        address = 16384 + CAST(UInteger, row BAND 24) * 256 + CAST(UInteger, row BAND 7) * 32 + CAST(UInteger, r BAND 7) * 256 + x
        POKE address, PEEK(graphicsAddr)
        POKE address + 1, PEEK(graphicsAddr + 1)
        graphicsAddr = graphicsAddr + 2
    NEXT r
    address = 22528 + CAST(UInteger, y) * 32 + x
    POKE address, PEEK(graphicsAddr)
    POKE address + 1, PEEK(graphicsAddr + 1)
    POKE address + 32, PEEK(graphicsAddr + 2)
    POKE address + 33, PEEK(graphicsAddr + 3)
END SUB

#pragma pop(case_insensitive)

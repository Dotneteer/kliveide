' Klive BASIC standard library - keys.bas: GetKey, GetKeyScanCode, MultiKeys and the KEY constants.
' Klive's own code, written from the documented API (.ai/kbasic/stdlib-api.json). The keyboard is
' read through port $FE, without the ROM.
#pragma once
#pragma push(case_insensitive)
#pragma case_insensitive = true

' A key's scan code: the high byte selects its half-row (the port's high address byte), the low byte
' is its bit there. Codes of one half-row can be combined with BOR.
CONST KEYCAPS AS UInteger = 0FE01h
CONST KEYZ AS UInteger = 0FE02h
CONST KEYX AS UInteger = 0FE04h
CONST KEYC AS UInteger = 0FE08h
CONST KEYV AS UInteger = 0FE10h

CONST KEYA AS UInteger = 0FD01h
CONST KEYS AS UInteger = 0FD02h
CONST KEYD AS UInteger = 0FD04h
CONST KEYF AS UInteger = 0FD08h
CONST KEYG AS UInteger = 0FD10h

CONST KEYQ AS UInteger = 0FB01h
CONST KEYW AS UInteger = 0FB02h
CONST KEYE AS UInteger = 0FB04h
CONST KEYR AS UInteger = 0FB08h
CONST KEYT AS UInteger = 0FB10h

CONST KEY1 AS UInteger = 0F701h
CONST KEY2 AS UInteger = 0F702h
CONST KEY3 AS UInteger = 0F704h
CONST KEY4 AS UInteger = 0F708h
CONST KEY5 AS UInteger = 0F710h

CONST KEY0 AS UInteger = 0EF01h
CONST KEY9 AS UInteger = 0EF02h
CONST KEY8 AS UInteger = 0EF04h
CONST KEY7 AS UInteger = 0EF08h
CONST KEY6 AS UInteger = 0EF10h

CONST KEYP AS UInteger = 0DF01h
CONST KEYO AS UInteger = 0DF02h
CONST KEYI AS UInteger = 0DF04h
CONST KEYU AS UInteger = 0DF08h
CONST KEYY AS UInteger = 0DF10h

CONST KEYENTER AS UInteger = 0BF01h
CONST KEYL AS UInteger = 0BF02h
CONST KEYK AS UInteger = 0BF04h
CONST KEYJ AS UInteger = 0BF08h
CONST KEYH AS UInteger = 0BF10h

CONST KEYSPACE AS UInteger = 07F01h
CONST KEYSYMBOL AS UInteger = 07F02h
CONST KEYM AS UInteger = 07F04h
CONST KEYN AS UInteger = 07F08h
CONST KEYB AS UInteger = 07F10h

' Waits for a key and gives its character code (as INKEY$ reads it).
FUNCTION GetKey() AS UByte
    DIM k AS String
    DO
        k = INKEY$
    LOOP WHILE k = ""
    RETURN CODE(k)
END FUNCTION

' The scan code of the keys held down in the first half-row (from CAPS SHIFT's to SPACE's) that has
' any, their bits combined; 0 when no key is down. Does not wait.
FUNCTION GetKeyScanCode() AS UInteger
    DIM half AS UByte
    DIM bits AS UByte
    DIM i AS UByte
    half = 0FEh
    FOR i = 1 TO 8
        bits = (IN((CAST(UInteger, half) SHL 8) BOR 0FEh) BXOR 0FFh) BAND 1Fh
        IF bits <> 0 THEN RETURN (CAST(UInteger, half) SHL 8) BOR bits
        half = (half SHL 1) BOR 1
    NEXT i
    RETURN 0
END FUNCTION

' The bits of the given keys (scan codes of one half-row, combined) that are held down; 0 for none.
FUNCTION MultiKeys(BYVAL scanCode AS UInteger) AS UByte
    RETURN (IN((scanCode BAND 0FF00h) BOR 0FEh) BXOR 0FFh) BAND CAST(UByte, scanCode BAND 1Fh)
END FUNCTION

#pragma pop(case_insensitive)

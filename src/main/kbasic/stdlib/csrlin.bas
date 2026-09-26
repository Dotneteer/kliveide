' Klive BASIC standard library - csrlin.bas: CSRLIN.
' Klive's own code, written from the documented API (.ai/kbasic/stdlib-api.json).
#pragma once
#pragma push(case_insensitive)
#pragma case_insensitive = true

' The PRINT cursor's row: 0 at the top, 23 at the bottom. (A FUNCTION with no locals keeps a UByte
' result at IX-1.)
FUNCTION CSRLIN() AS UByte
    ASM
        ld a,(core.PrintRow)
        ld (ix-1),a
    END ASM
END FUNCTION

#pragma pop(case_insensitive)

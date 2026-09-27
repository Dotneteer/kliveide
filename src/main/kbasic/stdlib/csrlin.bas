' Klive BASIC standard library - csrlin.bas: CSRLIN.
' Klive's own code, written from the documented API (.ai/kbasic/stdlib-api.json).
#pragma once
#pragma push(case_insensitive)
#pragma case_insensitive = true
#pragma push(asm_dialect)
#pragma asm_dialect = klive

' The PRINT cursor's row: 0 at the top, 23 at the bottom - also after a line feed on row 23, when the
' cursor waits below the screen (row 24) for the scroll the next character makes. (A FUNCTION with no
' locals keeps a UByte result at IX-1.)
FUNCTION CSRLIN() AS UByte
    ASM
        ld a,(core.PrintRow)
        cp 24
        adc a,$ff               ; 24 -> 23, below 24 unchanged (the carry adds the 1 back)
        ld (ix-1),a
    END ASM
END FUNCTION

#pragma pop(asm_dialect)
#pragma pop(case_insensitive)

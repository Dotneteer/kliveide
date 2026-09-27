' Klive BASIC standard library - pos.bas: POS.
' Klive's own code, written from the documented API (.ai/kbasic/stdlib-api.json).
#pragma once
#pragma push(case_insensitive)
#pragma case_insensitive = true
#pragma push(asm_dialect)
#pragma asm_dialect = klive

' The PRINT cursor's column: 0 at the left, 32 when the line is full and the next character goes to
' the next line. (A FUNCTION with no locals keeps a UByte result at IX-1.)
FUNCTION POS() AS UByte
    ASM
        ld a,(core.PrintCol)
        ld (ix-1),a
    END ASM
END FUNCTION

#pragma pop(asm_dialect)
#pragma pop(case_insensitive)

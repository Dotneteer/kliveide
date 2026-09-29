' Klive BASIC standard library - hmirror.bas: hMirror.
' Klive's own code, written from the documented API (.ai/kbasic/stdlib-api.json).
#pragma once
#pragma push(case_insensitive)
#pragma case_insensitive = true

' The byte with its bit order reversed (bit 7 becomes bit 0).
FUNCTION FASTCALL hMirror(BYVAL number AS UByte) AS UByte
    ASM
        ld b,8          ; A: the byte; C collects the mirror
    1:  rra
        rl c
        djnz 1b
        ld a,c
    END ASM
END FUNCTION

#pragma pop(case_insensitive)

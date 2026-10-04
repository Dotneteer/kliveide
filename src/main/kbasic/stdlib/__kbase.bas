' Klive BASIC standard library - __kbase.bas: what the other library files share.
' Klive's own code (plan §6.4).
#pragma once

' The program's string base: "ab"(1) is "b" (98) when strings count from 0 and "a" (97) when they
' count from 1, so library code indexes strings the way the program that includes it does.
CONST __kbStringBase AS UByte = 98 - CODE("ab"(1))

' The byte at address, where $0000-$3FFF is read from the 48K BASIC ROM even when the program (or the
' 128K/+3 editor it was started from) has another ROM paged in. For library code that reads the font
' at CHARS itself; PEEK reads whatever is paged. A framed routine in Klive's dialect, not a frameless
' FASTCALL, so SP is IX minus the frame at its statements (G4): the argument is at IX+4, and with no
' locals the UByte result is kept at IX-1.
#pragma push(asm_dialect)
#pragma asm_dialect = klive
FUNCTION __kbRomPeek(BYVAL address AS UInteger) AS UByte
    ASM
        ld l,(ix+4)
        ld h,(ix+5)
        call core.RomPeek
        ld (ix-1),a
    END ASM
END FUNCTION
#pragma pop(asm_dialect)

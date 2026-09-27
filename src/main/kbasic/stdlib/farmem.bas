' Klive BASIC standard library - farmem.bas: FarPeek, FarPeekW, FarPoke, FarPokeW, FarCopy, FarCopyTo
' and FarStr, CODEBANK's far-memory access (ZX Spectrum Next).
' Klive's own code, written from the documented API (.ai/kbasic/stdlib-api.json, recorded from
' .ai/kbasic/codebank-contract.md §1).
'
' A FARPTR value holds a logical bank in bits 16-23 and an address in bits 0-15. Each routine maps
' the bank into the CODEBANK window for the access and then puts back what the window held (the
' runtime's FarAccess and FarRelease), so it works from resident and from banked code alike and
' never changes the current bank. Bank 0 is resident memory, accessed as it is.
'
' Hazards (not checked): the resident side of FarCopy and FarCopyTo must not be in the window, an
' access must not run past the window's end, and none of this is re-entrant (not from an interrupt
' handler). This file must stay resident: include it outside CODEBANK blocks and #pragma codebank.
#pragma once
#pragma push(case_insensitive)
#pragma case_insensitive = true
#include <__kbase.bas>

' Maps a logical bank into the window, keeping what it held for __kbFarRelease.
SUB __kbFarAccess(BYVAL bank AS UByte)
    ASM
        ld a,(ix+5)
        call core.FarAccess
    END ASM
END SUB

SUB __kbFarRelease()
    ASM
        call core.FarRelease
    END ASM
END SUB

' Copies count bytes from src to dest (count > 0).
SUB __kbFarLdir(BYVAL src AS UInteger, BYVAL dest AS UInteger, BYVAL count AS UInteger)
    ASM
        ld l,(ix+4)
        ld h,(ix+5)
        ld e,(ix+6)
        ld d,(ix+7)
        ld c,(ix+8)
        ld b,(ix+9)
        ldir
    END ASM
END SUB

' The byte at a FARPTR.
FUNCTION FarPeek(BYVAL fp AS ULong) AS UByte
    DIM v AS UByte
    __kbFarAccess(CAST(UByte, fp >> 16))
    v = PEEK(CAST(UInteger, fp))
    __kbFarRelease()
    RETURN v
END FUNCTION

FUNCTION __kbFarPeekW(BYVAL fp AS ULong) AS UInteger
    DIM v AS UInteger
    __kbFarAccess(CAST(UByte, fp >> 16))
    v = PEEK(UInteger, CAST(UInteger, fp))
    __kbFarRelease()
    RETURN v
END FUNCTION

' The word at a FARPTR.
FUNCTION FASTCALL FarPeekW(BYVAL fp AS ULong) AS UInteger
    RETURN __kbFarPeekW(fp)
END FUNCTION

' Writes a byte at a FARPTR.
SUB FarPoke(BYVAL fp AS ULong, BYVAL v AS UByte)
    __kbFarAccess(CAST(UByte, fp >> 16))
    POKE CAST(UInteger, fp), v
    __kbFarRelease()
END SUB

' Writes a word at a FARPTR.
SUB FarPokeW(BYVAL fp AS ULong, BYVAL v AS UInteger)
    __kbFarAccess(CAST(UByte, fp >> 16))
    POKE UInteger CAST(UInteger, fp), v
    __kbFarRelease()
END SUB

' Copies count bytes from a bank (at fp) to resident memory at dest.
SUB FarCopy(BYVAL fp AS ULong, BYVAL dest AS UInteger, BYVAL count AS UInteger)
    IF count = 0 THEN RETURN
    __kbFarAccess(CAST(UByte, fp >> 16))
    __kbFarLdir(CAST(UInteger, fp), dest, count)
    __kbFarRelease()
END SUB

' Copies count bytes from resident memory at src into a bank (at fp).
SUB FarCopyTo(BYVAL fp AS ULong, BYVAL src AS UInteger, BYVAL count AS UInteger)
    IF count = 0 THEN RETURN
    __kbFarAccess(CAST(UByte, fp >> 16))
    __kbFarLdir(src, CAST(UInteger, fp), count)
    __kbFarRelease()
END SUB

' A String read from a bank: the image at fp is [length:2][characters]. The String is made at full
' length first (doubling, so a long one costs few allocations), then its characters are copied over.
FUNCTION __kbFarStr(BYVAL fp AS ULong) AS String
    DIM n AS UInteger
    DIM s AS String
    DIM grown AS UInteger
    n = __kbFarPeekW(fp)
    IF n = 0 THEN RETURN ""
    s = " "
    WHILE LEN(s) < n
        grown = LEN(s)
        s = s + s
        ' --- The heap is full: the empty String
        IF LEN(s) <= grown THEN RETURN ""
    WEND
    IF LEN(s) > n THEN s = s(__kbStringBase TO __kbStringBase + n - 1)
    FarCopy(fp + 2, PEEK(UInteger, @s) + 2, n)
    RETURN s
END FUNCTION

' A String read from a bank (see __kbFarStr).
FUNCTION FASTCALL FarStr(BYVAL fp AS ULong) AS String
    RETURN __kbFarStr(fp)
END FUNCTION

#pragma pop(case_insensitive)

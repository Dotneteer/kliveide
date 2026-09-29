' Klive BASIC standard library - memorybank.bas: SetBank, GetBank and SetCodeBank.
' Klive's own code, written from the documented API (.ai/kbasic/stdlib-api.json). 128K models only:
' the bank at $C000 is chosen through port $7FFD, whose last value the system variable BANKM keeps.
#pragma once
#pragma push(case_insensitive)
#pragma case_insensitive = true

' Pages RAM bank `bankNumber` (0-7) into $C000-$FFFF and records it in BANKM.
SUB SetBank(BYVAL bankNumber AS UByte)
    DIM value AS UByte
    value = (PEEK(23388) BAND 248) BOR (bankNumber BAND 7)
    POKE 23388, value
    OUT 32765, value
END SUB

' The RAM bank at $C000, from BANKM.
FUNCTION GetBank() AS UByte
    RETURN PEEK(23388) BAND 7
END FUNCTION

' Copies RAM bank `bankNumber` to $8000-$BFFF: the bank is paged in at $C000, copied, and the bank
' that was there before is paged back.
SUB SetCodeBank(BYVAL bankNumber AS UByte)
    DIM previous AS UByte
    previous = GetBank()
    SetBank(bankNumber)
    ASM
        ld hl,$C000
        ld de,$8000
        ld bc,$4000
        ldir
    END ASM
    SetBank(previous)
END SUB

#pragma pop(case_insensitive)

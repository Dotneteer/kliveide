' Klive BASIC standard library - __kbase.bas: what the other library files share.
' Klive's own code (plan §6.4).
#pragma once

' The program's string base: "ab"(1) is "b" (98) when strings count from 0 and "a" (97) when they
' count from 1, so library code indexes strings the way the program that includes it does.
CONST __kbStringBase AS UByte = 98 - CODE("ab"(1))

' Runs to the end on the Next: each PRINT line and the two values the ASM block and POKE leave
' are checked by test/boriel/boriel-next.test.ts
DIM a(4) AS UBYTE
DIM s$ AS STRING
DIM f AS FLOAT
DIM total AS ULONG
DIM i AS UBYTE

FUNCTION Fact(n AS UBYTE) AS ULONG
    IF n <= 1 THEN RETURN 1
    RETURN n * Fact(n - 1)
END FUNCTION

SUB Fill()
    DIM k AS UBYTE
    FOR k = 0 TO 4
        a(k) = k * k
    NEXT k
END SUB

CLS
PRINT AT 0, 0; "BORIEL NEXT OK"
Fill()
total = 0
FOR i = 0 TO 4
    total = total + a(i)
NEXT i
PRINT AT 1, 0; "SUM "; total
PRINT AT 2, 0; "FACT "; Fact(10)
s$ = "HELLO" + " " + "WORLD"
PRINT AT 3, 0; s$; " "; LEN(s$)
PRINT AT 4, 0; s$(6 TO 10)
f = 3.5 * 2
PRINT AT 5, 0; "F "; f; " "; INT(SQR(144))
ASM
    nextreg $14, $AB
    ld d, 5
    ld e, 7
    mul d, e
    ld a, e
    ld (40001), a
END ASM
POKE 40000, 77
DO
LOOP

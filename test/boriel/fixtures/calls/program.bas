DIM g As UByte = 7
DIM total As Long
DIM name$ As String
DIM ratio As Float
DIM fx As Fixed
DIM grid(2, 3) As UInteger
CONST LIMIT As UByte = 10

FUNCTION Square(n As UByte) As UInteger
    DIM r As UInteger
    r = n * n
    RETURN r
END FUNCTION

SUB Fill(n As UByte, BYREF acc As Long)
    DIM arr(9) As UByte
    DIM i As UByte
    FOR i = 0 TO 9
        arr(i) = n + i
    NEXT i
    acc = acc + arr(9)
END SUB

FUNCTION FASTCALL Twice(v As UByte) As UByte
    RETURN v * 2
END FUNCTION

name$ = "HELLO"
ratio = 3.25
fx = 1.5
grid(1, 2) = 42
total = 0
Fill(3, total)
PRINT Square(4) + Square(5)
PRINT Twice(g)
IF g > 5 THEN PRINT "big" ELSE PRINT "small"
GOSUB 1000
ON g - 6 GOSUB 1000, 2000
PRINT name$; ratio; fx: PRINT total
END

1000 PRINT "sub1": RETURN
2000 PRINT "sub2": RETURN

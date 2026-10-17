DIM total As Long
DIM name$ As String
DIM ratio As Float
DIM fx As Fixed
DIM grid(2, 3) As UInteger
DIM words$(1) As String

SUB Fill(n As UByte, BYREF acc As Long)
    DIM arr(9) As UByte
    DIM i As UByte
    FOR i = 0 TO 9
        arr(i) = n + i
    NEXT i
    acc = acc + arr(9)
    PRINT arr(9)
END SUB

SUB Dyn(k As UByte)
    DIM d(k) As UByte
    d(0) = 5
    PRINT d(0)
END SUB

name$ = "HELLO"
ratio = 3.25
fx = 1.5
grid(1, 2) = 42
words$(1) = "AB"
total = 1000
Fill(3, total)
Dyn(4)
PRINT grid(1, 2); total; name$; ratio; fx; words$(1)

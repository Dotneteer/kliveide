' A banked program (--split-modules): three modules of table data that cannot share one 16K
' bank, and a helper module one of them calls, so a call goes far twice (Klive's own test program).
USE big1
USE big2
USE big3
USE shade

DIM total As UInteger
total = big1.Sum(4)
total = total + big2.Weigh(2)
total = total + big3.Peek3(1)
PRINT total

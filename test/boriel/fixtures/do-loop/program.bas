' Bouncing ball - the program of Get Started, step 7.
' A ball bounces between the screen's edges and counts its bounces.

DIM x AS INTEGER = 15
DIM dx AS INTEGER = 1
DIM bounces AS UINTEGER = 0

SUB DrawBall(column AS INTEGER, ball AS STRING)
    PRINT AT 10, column; ball
END SUB

CLS
PRINT AT 0, 0; "Bounces: 0"
DO
    DrawBall(x, " ")
    x = x + dx
    IF x = 0 OR x = 31 THEN
        dx = -dx
        bounces = bounces + 1
        PRINT AT 0, 9; bounces
    END IF
    DrawBall(x, "O")
    PAUSE 2
LOOP

' Klive BASIC standard library - __drawarc.bas: the arc of DRAW x, y, angle.
' Klive's own code (plan §6.4). The compiler includes it when a program uses DRAW and calls it for
' DRAW's three-operand form; a program does not call it itself.
#pragma once

' An arc from the last point plotted to the point (dx, dy) away from it, turning through angle
' radians: a positive angle turns left (anticlockwise) as the arc is drawn, so the arc bulges to the
' right of the line from start to end. It is drawn as straight segments of about four pixels. The
' segments are the chord scaled by sin(d/2)/sin(angle/2) and turned by d = angle/n each time, the
' first one turned back by (n-1)*d/2 so that the last ends on the target. The running position is
' kept as a Float, so rounding does not add up along the arc.
SUB __kbDrawArc(BYVAL dx AS Integer, BYVAL dy AS Integer, BYVAL angle AS Float)
    DIM half AS Float
    DIM segments AS UInteger
    DIM n AS Float
    DIM d AS Float
    DIM scale AS Float
    DIM vx AS Float
    DIM vy AS Float
    DIM t AS Float
    DIM c AS Float
    DIM s AS Float
    DIM px AS Float
    DIM py AS Float
    DIM i AS UInteger
    half = SIN(angle / 2)
    IF ABS(half) < 0.00001 THEN
        DRAW dx, dy
        RETURN
    END IF
    ' --- About one segment per four pixels of arc (the arc is |chord * angle / (2 sin(angle/2))|)
    n = INT(ABS(SQR(CAST(Float, dx) * dx + CAST(Float, dy) * dy) * angle / (8 * half))) + 4
    IF n > 250 THEN n = 250
    segments = n
    d = angle / n
    scale = SIN(d / 2) / half
    t = (1 - n) * d / 2
    c = COS(t)
    s = SIN(t)
    vx = (dx * c - dy * s) * scale
    vy = (dx * s + dy * c) * scale
    c = COS(d)
    s = SIN(d)
    px = PEEK(23677)
    py = PEEK(23678)
    FOR i = 1 TO segments
        px = px + vx
        py = py + vy
        DRAW INT(px + 0.5) - PEEK(23677), INT(py + 0.5) - PEEK(23678)
        t = vx * c - vy * s
        vy = vx * s + vy * c
        vx = t
    NEXT i
END SUB

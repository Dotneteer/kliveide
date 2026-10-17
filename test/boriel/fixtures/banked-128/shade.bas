' shade: a small helper module that a banked module calls (Klive's own test program).
MODULE shade

PUBLIC
FUNCTION Mix(a As UByte, b As UByte) As UInteger
    DIM m As UInteger
    m = a * 4 + b
    RETURN m
END FUNCTION
END MODULE

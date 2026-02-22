GetReg .macro(idx)
    ld a,{{idx}}
    ld bc,$243b
    out (c),a
    inc b
    in (c),a
.endm
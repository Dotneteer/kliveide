Beep
    ld b, 200        ; outer duration

`beepLoop
    ld a,(LastBorder)
    or $10        ; bit 4 high
    out ($fe), a
    call `delay

    ld a,(LastBorder) ; bit 4 low
    out ($fe), a
    call `delay
    djnz `beepLoop
    ret
`delay
    ld hl,500
`d1
    dec hl
    ld a,h
    or l
    jr nz,`d1
    ret

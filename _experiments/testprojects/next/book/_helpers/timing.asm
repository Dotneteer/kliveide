_delayWithBc
    dec bc
    ld a,b
    or c
    ret z
    jr _delayWithBc
    

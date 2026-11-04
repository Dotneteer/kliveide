UlaPlusTest
    .dw UlaPlusExec
    .dw $00
    .db $01
    .dm "Ula+ palette change"
    TERM_TEXT()
    
UlaPlusExec
    call ClearScreen
    PrintAt(0, 0)
    ld a,0
`flashLoop
    push af
    Flash(a)
    ld a,0
`brightLoop
    push af
    Bright(a)
    ld a,0
`paperLoop
    push af
    Paper(a)
    ld a,0
`inkLoop
    push af
    Ink(a)
    ;
    ; Display
    ld a,'x'
    rst $10
    ;
    ; Next ink value
    pop af
    inc a
    cp 8
    jr c,`inkLoop
    ;
    ; Next paper value
    pop af
    inc a
    cp 8
    jr c,`paperLoop
    ;
    ; Next bright value
    pop af
    inc a
    cp 2
    jr c,`brightLoop
    ;
    ; Next flash value
    pop af
    inc a
    cp 2
    jr c,`flashLoop
    ;
    ; Turn on ULA+
    ld a,$40
    ld bc,$bf3b
    out (c),a
    ld a,$01
    ld b,$ff
    out (c),a
    ;
    ; Set ULA+ paletted item 0 to cyan
    xor a
    ld b,$bf
    out (c),a
    ld a,%111_000_11
    ld b,$ff
    out (c),a
    ;
    ; Done
    call WaitForKey
    ;
    ; Turn off ULA+
    ld a,$40
    ld bc,$bf3b
    out (c),a
    ld a,$00
    ld b,$ff
    out (c),a
    
    jp ResetScreenAttributes
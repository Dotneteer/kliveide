;==========================================================
; Read the $FE I/O port
;==========================================================
ReadIoDemo
    ld hl,Title_ReadIo
    call _printTitle
    ld hl,Instr_ReadIo
    call _printText
`loop
    ; Select row 2 (Q, W, E, R, T)
    ld a,$FB        ; 11111011 - bit 2 = 0 selects row 2
    in a,($FE)      ; Read keyboard state
    
    ld hl,$58a0
    ld d,attr(Color.Black, Color.Green, 1)
    ld e,attr(Color.Black, Color.Green, 0)
    ld b,5          ; Five keys to test
`bitscan
    ; Change attribute according to key state
    sra a
    jr c,`up
    ld (hl),d       ; The key is up
    jr `next
`up
    ld (hl),e       ; The key id down
`next
    inc hl
    djnz `bitscan
    
    ; Now check if Space is pressed
    ld a,$7F        ; 01111111 - bit 7 = 0 selects row 7 (Space row)
    in a,($FE)
    bit 0,a         ; Test bit 0 (Space key)
    jr nz,`loop     ; If Space not pressed (bit 1), loop again
    ret    
    
Title_ReadIo
    .defn "I/O #1: Read keyboard line"
Instr_ReadIo
    .defm "Press keys Q, W, E, R, or T\x0D"
    .defm "Press Space to complete\x0D\x0D"
    .defn "QWERT"

;==========================================================
; Write the $FE I/O port
;==========================================================
WriteIoDemo
    ld hl,Title_WriteIo
    call _printTitle
    ld hl,Instr_WriteIo
    call _printText
`kbloop
    ld a,Color.Green
    out ($fe),a
    ld bc,$400
    call _delayWithBc
    ld a,Color.Blue
    out ($fe),a
    ld bc,$488
    call _delayWithBc

    ; Now check if Space is pressed
    ld a,$7F        ; 01111111 - bit 7 = 0 selects row 7 (Space row)
    in a,($FE)
    bit 0,a         ; Test bit 0 (Space key)
    jr nz,`kbloop     ; If Space not pressed (bit 1), loop again
    ret    

Title_WriteIo
    .defn "I/O #2: Write border color"
Instr_WriteIo
    .defn "Press Space to complete"


BorderTest1
    .dw BorderTestExec
    .dw $06
    .db $01
    .dm "Yellow border"
    TERM_TEXT()
BorderTest2
    .dw BorderTestExec
    .dw $03
    .db $01
    .dm "Magenta border"
    TERM_TEXT()
    
BorderTestExec
    Border(c)
    ret
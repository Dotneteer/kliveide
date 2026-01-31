BorderTest
    .dw BorderTestExec
    .dw $06
    .db $01
    .dm "Yellow border"
    TERM_TEXT()
    
BorderTestExec
    Border(c)
    ret
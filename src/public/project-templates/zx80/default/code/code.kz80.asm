; A ZX80 machine-code program. Klive puts the code into a 1 REM line (its first byte at 16427,
; $402B) and adds 2 RANDOMISE USR(16427) to call it. Run types RUN; Export writes a .o file.
; A ZX80 REM line cannot hold a $76 byte (HALT, LD (HL),(HL)): the ROM takes it for the line's end.
;
; This one adds up 1 to 10 into Total; after it returns, PRINT PEEK(16443) shows 55.
    .model ZX80
Start:
    xor a               ; the running total
    ld b,10
Add:
    add a,b
    djnz Add
    ld (Total),a
    ret                 ; back to BASIC

    .org 16443
Total:
    .defb 0

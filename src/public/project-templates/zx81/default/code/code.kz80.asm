; A ZX81 machine-code program. Klive puts the code into a 1 REM line (its first byte at 16514,
; $4082) and adds 2 RAND USR 16514 to call it. Run types RUN; Export writes a .p file.
; Leave IX, IY and the alternate AF alone: the ROM's display needs them in SLOW mode.
    .model ZX81
Start:
    ld hl,Message       ; HL points to the message
    ld b,MessageEnd-Message
NextCh:
    ld a,(hl)           ; the next character
    push hl
    push bc
    rst $10             ; print it (PRINT-A)
    pop bc
    pop hl
    inc hl
    djnz NextCh
    ret                 ; back to BASIC: report 0/2

Message:
    .defzx "WELCOME TO klive ide" ; lower case prints in inverse video
MessageEnd:

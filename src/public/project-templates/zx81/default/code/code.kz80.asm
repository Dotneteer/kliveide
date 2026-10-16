; A ZX81 machine-code program. Klive puts the code into a 1 REM line (its first byte at 16514,
; $4082) and adds 2 RAND USR 16514 to call it. Run types RUN; Export writes a .p file.
; Leave IX, IY and the alternate AF alone: the ROM's display needs them in SLOW mode.
    .model ZX81

PRINT_AT .equ $08F5     ; ROM: move the print position to line B (0-21), column C (0-31)

; --- Control codes in the message, outside the ZX81 character set
CTL_AT   .equ $70       ; followed by line, column
CTL_INV  .equ $71       ; inverse video on/off
CTL_END  .equ $FF       ; end of the message

Start:
    ld hl,Message       ; HL points to the message
    ld e,0              ; E is OR-ed into each character: $80 prints it in inverse video
NextCh:
    ld a,(hl)           ; get the next code
    inc hl
    cp CTL_END
    ret z               ; back to BASIC when terminated (report 0/2)
    cp CTL_AT
    jr z,SetPosition
    cp CTL_INV
    jr z,Invert
    or e
    push hl
    push de
    rst $10             ; display the character (PRINT-A)
    pop de
    pop hl
    jr NextCh           ; next code

SetPosition:
    ld b,(hl)           ; line
    inc hl
    ld c,(hl)           ; column
    inc hl
    push hl
    push de
    call PRINT_AT
    pop de
    pop hl
    jr NextCh

Invert:
    ld a,e
    xor $80             ; toggle inverse video
    ld e,a
    jr NextCh

Message:
    .defb CTL_AT, 10, 6         ; AT 10, 6
    .defzx "WELCOME TO KLIVE IDE"
    .defb CTL_AT, 11, 8         ; AT 11, 8
    .defb CTL_INV               ; inverse video on
    .defzx "(SINCLAIR ZX81)"
    .defb CTL_INV               ; inverse video off
    .defb CTL_END               ; terminate

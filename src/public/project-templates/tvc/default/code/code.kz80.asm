; A Videoton TVC machine-code program. Run (or Debug) boots BASIC, writes the code into RAM, moves
; BASIC's program space above it (LOMEM) and calls it with C=USR(6704), so RET goes back to BASIC.
; Export writes a .cas program file: a one-line BASIC launcher and this code. LOAD runs it.
    .model TVC
    .org $1A30

Start:
    ld hl,Message
NextChar:
    ld a,(hl)
    or a
    ret z               ; back to BASIC
    ld c,a
    push hl             ; the system call keeps neither HL nor BC
    rst $30             ; the operating system's call...
    .defb $21           ; ...function 21h: the editor prints the character in C at the cursor
    pop hl
    inc hl
    jr NextChar

; The editor takes 13 (CR) back to the start of the line and 10 (LF) down a line: CR LF is a new line
Message:
    .defm "Welcome to Klive IDE"
    .defb 13, 10
    .defm "on the Videoton TVC"
    .defb 13, 10, 0

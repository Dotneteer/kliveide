; An Enterprise 64/128 machine-code program: an EXOS "$$APP". Run (or Debug) boots IS-BASIC and types
; LOAD "FILE:KLIVE.COM"; EXOS loads the program at $0100 and starts it there. Export writes the same
; program as a .com file, which LOAD "FILE:name.COM" runs.
;
; EXOS starts the program on its own system stack, so the program sets its stack first. EXOS has
; closed every channel: the program opens a VIDEO: page, shows it and prints into it.
    .model ENTERPRISE

Start:
    di
    ld sp,$3FFF         ; a stack of the program's own, at the top of page 0
    ei
    ld hl,VideoSetup    ; the page's mode, colours and size: EXOS variables 22-25
    ld c,22
SetVar:
    ld d,(hl)
    ld b,1              ; write...
    push hl
    push bc
    rst $30             ; EXOS call...
    .defb 16            ; ...16: set an EXOS variable (C: its number, D: the value)
    pop bc
    pop hl
    inc hl
    inc c
    ld a,c
    cp 26
    jr nz,SetVar
    ld a,1              ; channel 1...
    ld de,VideoName
    rst $30
    .defb 1             ; ...1: open the channel to VIDEO:
    ld a,1
    ld bc,$0101         ; B=1: display the page (@@DISP), C=1: from its first row
    ld de,$1801         ; D=24 rows, E=at screen row 1
    rst $30
    .defb 11            ; ...11: the channel's special function
    ld a,1
    ld de,Message
    ld bc,MessageEnd-Message
    rst $30
    .defb 8             ; ...8: write the text to the channel
Done:
    jr Done             ; stay here; a reset ends it

; MODE_VID 0 (hardware text), COLR_VID 0 (two colours), X_SIZ_VID 40 characters, Y_SIZ_VID 24 rows
VideoSetup:
    .defb 0, 0, 40, 24

VideoName:
    .defb 6
    .defm "VIDEO:"

; CR LF starts a new line
Message:
    .defm "Welcome to Klive IDE"
    .defb 13, 10
    .defm "on the Enterprise"
    .defb 13, 10
MessageEnd:

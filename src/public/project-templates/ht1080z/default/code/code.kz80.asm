; An HT-1080Z machine-code program. Run (or Debug) starts the machine, answers its power-on question
; with the code's address, so BASIC keeps below it, writes the code into RAM and starts it at Start.
; Export writes a .cmd (or .cas) file that loads with SYSTEM: type its name, then / to start it.
    .model HT1080Z
    .org $7000

CLS         .equ $01C9  ; ROM: clear the screen, cursor to the top left
PRINT_CHAR  .equ $0033  ; ROM: print the character in A at the cursor
CURSOR      .equ $4020  ; the cursor's address in video RAM
READY       .equ $06CC  ; ROM: back to BASIC's READY prompt
VIDEO       .equ $3C00  ; video RAM: 16 lines of 64 characters

Start:
    call CLS
    ld hl,VIDEO+6*64+22     ; line 6, column 22
    ld de,Welcome
    call PrintAt
    ld hl,VIDEO+8*64+28     ; line 8, column 28
    ld de,Machine
    call PrintAt

    ; --- A block-graphics bar under the welcome: $83 lights the top two blocks of a cell
    ld hl,VIDEO+7*64+22
    ld b,20
Bar:
    ld (hl),$83
    inc hl
    djnz Bar

    ; --- Leave the cursor below the text and go back to BASIC. JP, not RET: a program SYSTEM
    ; --- started has no return address on the stack
    ld hl,VIDEO+11*64
    ld (CURSOR),hl
    jp READY

; Prints the text at DE, which ends in 0, from the video RAM address in HL. The ROM draws its cursor
; where it will print next; it is blanked before the cursor moves, so nothing is left behind.
PrintAt:
    push hl
    call HideCursor
    pop hl
    ld (CURSOR),hl
NextChar:
    ld a,(de)
    or a
    jr z,HideCursor
    push de
    call PRINT_CHAR
    pop de
    inc de
    jr NextChar
HideCursor:
    ld hl,(CURSOR)
    ld (hl),' '
    ret

Welcome:
    .defm "WELCOME TO KLIVE IDE"
    .defb 0
Machine:
    .defm "HT-1080Z"
    .defb 0

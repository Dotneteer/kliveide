; CRTC register explorer for the Videoton TV Computer.
; Port of Kieran Connell's BBC BASIC MODE 1 CRTC explorer.
;
; BBC poked the 6845 at &FE00/&FE01. TVC uses I/O ports 70H/71H.
; Defaults are the TVC firmware trace from info/tvc.md, not BBC MODE 1.
; Cursor keys: up=05H down=18H left=13H right=04H (SYS ROM decode table).
; R restores firmware R0-R11 and the startup cursor interrupt address.
; After R1/R6 changes, R14-R15 track the last displayed character so the
; shared cursor IRQ (and therefore the keyboard) keeps running.
;
; Assemble and inject from a booted snapshot:
;   cargo run --bin rtvc-asm -- --format cas \
;     coding/crtc-register-explorer.asm \
;     -o target/coding/crtc-register-explorer.cas
;   cargo run --bin rtvc -- data/snapshots/boot12dos.rtvcsnap.zip \
;     -i target/coding/crtc-register-explorer.cas

        BASIC_START

VID_MODE EQU C9F4H
KB_CHIN  EQU D618H
FONT     EQU C474H
CRTC_AD  EQU 70H
CRTC_DT  EQU 71H
REG_MAX  EQU 11
COLS     EQU 64
ROWS     EQU 24
REG_ROW0 EQU 2

        EI
        LD C,00H
        CALL VID_MODE
        XOR A
        OUT (60H),A
        LD A,55H
        OUT (61H),A
        LD A,02H
        OUT (00H),A
        CALL RESET_REGS
        CALL DRAW_ALL

MAIN:
        CALL KB_CHIN
        LD A,C
        CP 05H
        JR Z,KEY_UP
        CP 18H
        JR Z,KEY_DOWN
        CP 13H
        JR Z,KEY_LEFT
        CP 04H
        JR Z,KEY_RIGHT
        CP 52H
        JR Z,KEY_RESET
        CP 72H
        JR Z,KEY_RESET
        JR MAIN

KEY_UP:
        LD A,(SEL)
        OR A
        JR Z,MAIN
        CALL MARK_OFF
        LD A,(SEL)
        DEC A
        LD (SEL),A
        CALL MARK_ON
        JR MAIN

KEY_DOWN:
        LD A,(SEL)
        CP REG_MAX
        JR NC,MAIN
        CALL MARK_OFF
        LD A,(SEL)
        INC A
        LD (SEL),A
        CALL MARK_ON
        JR MAIN

KEY_LEFT:
        LD A,(SEL)
        CALL REG_PTR
        LD A,(HL)
        DEC A
        LD (HL),A
        CALL APPLY_SEL
        JR MAIN

KEY_RIGHT:
        LD A,(SEL)
        CALL REG_PTR
        LD A,(HL)
        INC A
        LD (HL),A
        CALL APPLY_SEL
        JR MAIN

KEY_RESET:
        CALL RESET_REGS
        CALL DRAW_ALL
        JR MAIN

; A = register index. HL -> REGS+A
REG_PTR:
        LD E,A
        LD D,00H
        LD HL,REGS
        ADD HL,DE
        RET

RESET_REGS:
        LD HL,DEFAULTS
        LD DE,REGS
        LD BC,000CH
        LDIR
        XOR A
        LD (SEL),A
        CALL WRITE_ALL_REGS
        LD A,0CH
        OUT (CRTC_AD),A
        XOR A
        OUT (CRTC_DT),A
        LD A,0DH
        OUT (CRTC_AD),A
        XOR A
        OUT (CRTC_DT),A
        CALL FIX_IRQ_CURSOR
        RET

WRITE_ALL_REGS:
        XOR A
WRLOOP:
        PUSH AF
        CALL WRITE_REG
        POP AF
        INC A
        CP 0CH
        JR C,WRLOOP
        RET

; A = register index. Writes REGS[A] to the CRTC.
WRITE_REG:
        PUSH AF
        OUT (CRTC_AD),A
        CALL REG_PTR
        LD A,(HL)
        OUT (CRTC_DT),A
        POP AF
        RET

APPLY_SEL:
        LD A,(SEL)
        CALL WRITE_REG
        CALL FIX_IRQ_CURSOR
        CALL PAGE_VID
        CALL DRAW_REG_LINE
        CALL DRAW_STATS
        CALL PAGE_REST
        RET

; Keep the firmware-style cursor interrupt on the last displayed character.
FIX_IRQ_CURSOR:
        LD A,(REGS+1)
        LD D,A
        LD A,(REGS+6)
        LD E,A
        CALL MUL8
        LD A,H
        OR L
        JR Z,IRQ_ZERO
        DEC HL
IRQ_ZERO:
        LD A,0EH
        OUT (CRTC_AD),A
        LD A,H
        AND 3FH
        OUT (CRTC_DT),A
        LD A,0FH
        OUT (CRTC_AD),A
        LD A,L
        OUT (CRTC_DT),A
        RET

; HL = D * E
MUL8:
        LD HL,0000H
        LD A,D
        OR A
        RET Z
        LD B,D
        LD D,00H
MUL8LP:
        ADD HL,DE
        DJNZ MUL8LP
        RET

DRAW_ALL:
        CALL PAGE_VID
        CALL DRAW_GRID
        CALL DRAW_HELP
        XOR A
DRAW_REGS:
        LD (SEL),A
        PUSH AF
        CALL DRAW_REG_LINE
        POP AF
        INC A
        CP 0CH
        JR C,DRAW_REGS
        XOR A
        LD (SEL),A
        CALL DRAW_STATS
        LD A,3DH
        LD (MARK0),A
        LD A,3EH
        LD (MARK1),A
        CALL MARK_DRAW
        CALL PAGE_REST
        RET

DRAW_GRID:
        XOR A
        LD (ROW),A
        LD (COL),A
GRID_X:
        LD A,(COL)
        LD B,00H
GXDIV:
        SUB 0AH
        JR C,GXMOD
        INC B
        JR GXDIV
GXMOD:
        ADD A,0AH
        ADD A,30H
        CALL PUTCHAR
        LD A,(COL)
        INC A
        LD (COL),A
        CP COLS
        JR C,GRID_X
        LD A,01H
        LD (ROW),A
GRID_Y:
        XOR A
        LD (COL),A
        LD A,(ROW)
        LD B,00H
GYDIV:
        SUB 0AH
        JR C,GYMOD
        INC B
        JR GYDIV
GYMOD:
        ADD A,0AH
        PUSH AF
        LD A,B
        ADD A,30H
        CP 30H
        JR NZ,GYTENS
        LD A,20H
GYTENS:
        CALL PUTCHAR
        LD A,(COL)
        INC A
        LD (COL),A
        POP AF
        ADD A,30H
        CALL PUTCHAR
        LD A,(ROW)
        INC A
        LD (ROW),A
        CP ROWS
        JR C,GRID_Y
        RET

DRAW_HELP:
        LD A,18
        LD (ROW),A
        LD A,10
        LD (COL),A
        LD HL,HELP1
        CALL PUTSTR
        LD A,19
        LD (ROW),A
        LD A,10
        LD (COL),A
        LD HL,HELP2
        CALL PUTSTR
        LD A,20
        LD (ROW),A
        LD A,10
        LD (COL),A
        LD HL,HELP3
        CALL PUTSTR
        RET

DRAW_REG_LINE:
        LD A,(SEL)
        ADD A,REG_ROW0
        LD (ROW),A
        LD A,05H
        LD (COL),A
        LD A,(SEL)
        CALL NAME_PTR
        LD B,20
        CALL PUTN
        LD A,27
        LD (COL),A
        LD A,52H
        CALL PUTCHAR
        LD A,(COL)
        INC A
        LD (COL),A
        LD A,(SEL)
        CP 0AH
        JR C,REG_ONE
        LD A,31H
        CALL PUTCHAR
        LD A,(COL)
        INC A
        LD (COL),A
        LD A,(SEL)
        SUB 0AH
        JR REG_DIG
REG_ONE:
        LD A,20H
        CALL PUTCHAR
        LD A,(COL)
        INC A
        LD (COL),A
        LD A,(SEL)
REG_DIG:
        ADD A,30H
        CALL PUTCHAR
        LD A,(COL)
        INC A
        LD (COL),A
        LD A,3DH
        CALL PUTCHAR
        LD A,(COL)
        INC A
        LD (COL),A
        LD A,(SEL)
        CALL REG_PTR
        LD L,(HL)
        LD H,00H
        CALL PUTU8
        LD A,20H
        CALL PUTCHAR
        LD A,(COL)
        INC A
        LD (COL),A
        LD A,20H
        CALL PUTCHAR
        RET

; HL -> 20-byte name for register A
NAME_PTR:
        LD L,A
        LD H,00H
        ADD HL,HL
        ADD HL,HL
        LD D,H
        LD E,L
        ADD HL,HL
        ADD HL,HL
        ADD HL,DE
        LD DE,NAMES
        ADD HL,DE
        RET

DRAW_STATS:
        LD A,15
        LD (ROW),A
        LD A,09H
        LD (COL),A
        LD HL,STAT1
        CALL PUTSTR
        LD A,(REGS+4)
        INC A
        LD D,A
        LD A,(REGS+9)
        INC A
        LD E,A
        CALL MUL8
        LD A,(REGS+5)
        LD E,A
        LD D,00H
        ADD HL,DE
        CALL PUTU16
        LD B,04H
STATSPC:
        LD A,20H
        CALL PUTCHAR
        LD A,(COL)
        INC A
        LD (COL),A
        DJNZ STATSPC
        LD A,16
        LD (ROW),A
        LD A,09H
        LD (COL),A
        LD HL,STAT2
        CALL PUTSTR
        LD A,(REGS+1)
        LD D,A
        LD A,(REGS+6)
        LD E,A
        CALL MUL8
        CALL PUTU16
        LD B,06H
BYTSPC:
        LD A,20H
        CALL PUTCHAR
        LD A,(COL)
        INC A
        LD (COL),A
        DJNZ BYTSPC
        RET

MARK_OFF:
        LD A,20H
        LD (MARK0),A
        LD A,20H
        LD (MARK1),A
        JR MARK_GO
MARK_ON:
        LD A,3DH
        LD (MARK0),A
        LD A,3EH
        LD (MARK1),A
MARK_GO:
        CALL PAGE_VID
        CALL MARK_DRAW
        CALL PAGE_REST
        RET

MARK_DRAW:
        LD A,(SEL)
        ADD A,REG_ROW0
        LD (ROW),A
        LD A,02H
        LD (COL),A
        LD A,(MARK0)
        CALL PUTCHAR
        LD A,(COL)
        INC A
        LD (COL),A
        LD A,(MARK1)
        CALL PUTCHAR
        RET

PAGE_VID:
        LD A,(0003H)
        LD (PAGESV),A
        LD A,50H
        LD (0003H),A
        OUT (02H),A
        RET

PAGE_REST:
        LD A,(PAGESV)
        LD (0003H),A
        OUT (02H),A
        RET

; HL -> NUL-terminated string at ROW,COL
PUTSTR:
        LD A,(HL)
        OR A
        RET Z
        CALL PUTCHAR
        INC HL
        LD A,(COL)
        INC A
        LD (COL),A
        JR PUTSTR

; HL -> B characters
PUTN:
        LD A,(HL)
        CALL PUTCHAR
        INC HL
        LD A,(COL)
        INC A
        LD (COL),A
        DJNZ PUTN
        RET

; Print HL as 1-5 decimal digits, then leave COL after the last digit.
PUTU8:
        LD H,00H
PUTU16:
        XOR A
        LD (LEAD),A
        LD DE,10000
        CALL DIGIT
        LD DE,1000
        CALL DIGIT
        LD DE,100
        CALL DIGIT
        LD DE,10
        CALL DIGIT
        LD A,L
        ADD A,30H
        CALL PUTCHAR
        LD A,(COL)
        INC A
        LD (COL),A
        RET

; Subtract DE from HL until borrow; print the count (leading spaces).
DIGIT:
        LD A,2FH
DIGLP:
        INC A
        OR A
        SBC HL,DE
        JR NC,DIGLP
        ADD HL,DE
        CP 30H
        JR NZ,DIGOUT
        LD A,(LEAD)
        OR A
        JR NZ,DIGZERO
        LD A,20H
        JR DIGPUT
DIGZERO:
        LD A,30H
        JR DIGPUT
DIGOUT:
        PUSH AF
        LD A,01H
        LD (LEAD),A
        POP AF
DIGPUT:
        CALL PUTCHAR
        LD A,(COL)
        INC A
        LD (COL),A
        RET

; A = ASCII character at (COL,ROW). VRAM must be at 8000H.
PUTCHAR:
        PUSH AF
        PUSH BC
        PUSH DE
        PUSH HL
        LD L,A
        LD H,00H
        LD C,L
        LD B,H
        ADD HL,HL
        ADD HL,HL
        ADD HL,BC
        ADD HL,HL
        LD DE,FONT
        ADD HL,DE
        LD (FONTPT),HL
        LD A,(ROW)
        CP ROWS
        JR NC,PUTDONE
        LD L,A
        LD H,00H
        ADD HL,HL
        LD D,H
        LD E,L
        ADD HL,HL
        ADD HL,HL
        ADD HL,DE
        LD A,L
        LD (Y),A
        LD A,(COL)
        CP COLS
        JR NC,PUTDONE
        LD B,0AH
        LD HL,(FONTPT)
PUTLINE:
        PUSH BC
        LD A,(HL)
        LD (GLYPH),A
        PUSH HL
        LD A,(Y)
        LD C,A
        AND 03H
        ADD A,A
        ADD A,A
        ADD A,A
        ADD A,A
        ADD A,A
        ADD A,A
        LD B,A
        LD A,C
        AND 0FCH
        LD L,A
        LD H,00H
        ADD HL,HL
        ADD HL,HL
        ADD HL,HL
        ADD HL,HL
        ADD HL,HL
        ADD HL,HL
        LD A,B
        LD C,A
        LD A,(COL)
        ADD A,C
        LD L,A
        LD DE,8000H
        ADD HL,DE
        LD A,(GLYPH)
        LD (HL),A
        POP HL
        INC HL
        LD A,(Y)
        INC A
        LD (Y),A
        POP BC
        DJNZ PUTLINE
PUTDONE:
        POP HL
        POP DE
        POP BC
        POP AF
        RET

DEFAULTS:
        DB 99, 64, 75, 50, 77, 2, 60, 66, 0, 3, 3, 3

NAMES:
        DB "Horizontal total-1  "
        DB "Horizontal displayed"
        DB "Horizontal sync pos "
        DB "Horiz sync width    "
        DB "Vertical total-1    "
        DB "Vert total adjust   "
        DB "Vertical displayed  "
        DB "Vertical sync pos   "
        DB "Interlace control   "
        DB "Scanlines per row-1 "
        DB "Cursor start        "
        DB "Cursor end          "

HELP1:
        DB "Use cursor keys to", 0
HELP2:
        DB "change register values", 0
HELP3:
        DB "Press R to reset", 0
STAT1:
        DB "Total scanlines = ", 0
STAT2:
        DB "Displayed bytes = ", 0

SEL:    DB 0
REGS:   DS 12
PAGESV: DB 0
ROW:    DB 0
COL:    DB 0
Y:      DB 0
LEAD:   DB 0
FONTPT: DW 0
GLYPH:  DB 0
MARK0:  DB 0
MARK1:  DB 0

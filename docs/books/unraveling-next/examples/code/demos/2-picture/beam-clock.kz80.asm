; Demo: Beam Clock
; Chapter: The Frame and the Beam (content/next-display/timing.mdx), "The line interrupt"
;
; Sets the line interrupt for a line that Q and A move, and shows the line's number. The border is
; blue from the frame interrupt and red from the line interrupt, so its colour changes at the line.
; Stays in pulse mode: one handler serves both interrupts and reads their status bits in NextReg
; $C8 to tell them apart. The line numbers are the 128K timing's: 0 is the first line of the
; display area, 310 the line just above it.
; Changes NextRegs $22 and $23, the border and the shell's interrupt jump; puts all of them back.

BeamClockTitle:
    .defn "Beam Clock"

BcLastLine: .equ 310        ; the last line number of the 128K frame

BeamClock:
    ld de,$0000
    ld c,$78
    ld hl,BeamClockTitle
    call PrintText
    ld de,$0200             ; row 2
    ld c,$38
    ld hl,BcText1
    call PrintText
    ld de,$0400             ; row 4
    ld hl,BcText2
    call PrintText
    ld de,$0500
    ld hl,BcText3
    call PrintText
    ld de,$0600
    ld hl,BcText4
    call PrintText
    ld de,$0800             ; row 8
    ld hl,BcText5
    call PrintText
    call ShowMenuFooter
    call WaitNoKey          ; the menu's key may still be down

    ld hl,96
    ld (BcLine),hl
    xor a
    ld (BcHeld),a
    di
    ld hl,BcIsr
    ld (IsrAddr + 1),hl     ; the shell's JP at $BFBF now goes to BcIsr
    call BcSetLine
    ei

BcFrame:
    ld a,(Frames)
    ld b,a
BcWait:
    halt                    ; the line interrupt wakes it too
    ld a,(Frames)
    cp b
    jr z,BcWait             ; wait for the frame interrupt

    ld de,$0210             ; row 2, column 16: the line's number
    ld c,$38
    ld hl,(BcLine)
    call PrintNum16

    call ScanKeys
    cp $FF
    jr z,BcNoKey
    cp 10                   ; Q
    jr z,BcUp
    cp 5                    ; A
    jr nz,BcDone            ; any other key ends the demo
    call BcStep             ; A: the line moves down
    ld hl,(BcLine)
    add hl,bc
    ld de,BcLastLine + 1
    or a
    sbc hl,de
    jr nc,BcStore           ; past the last line: wrap round to the top
    add hl,de
    jr BcStore
BcUp:
    call BcStep             ; Q: the line moves up
    ld hl,(BcLine)
    or a
    sbc hl,bc
    jr nc,BcStore
    ld de,BcLastLine + 1    ; above line 0: wrap round to the bottom
    add hl,de
BcStore:
    ld (BcLine),hl
    di
    call BcSetLine
    ei
    jr BcFrame
BcNoKey:
    xor a
    ld (BcHeld),a
    jr BcFrame

    ; Put everything back: no line interrupt, the shell's handler, the white border
BcDone:
    di
    nextreg $22,0
    nextreg $23,0
    ld hl,FrameIsr
    ld (IsrAddr + 1),hl
    ei
    ld a,7
    out ($FE),a
    jp WaitNoKey

; Returns the step in BC: one line a frame, four once the key has been held for 16 frames
BcStep:
    ld bc,1
    ld a,(BcHeld)
    cp 16
    jr nc,BcStepFast
    inc a
    ld (BcHeld),a
    ret
BcStepFast:
    ld c,4
    ret

; Sets the line interrupt for line BcLine: the low eight bits in NextReg $23, bit 8 in bit 0 of
; NextReg $22, and bit 1 of NextReg $22 switches it on
BcSetLine:
    ld hl,(BcLine)
    ld a,l
    nextreg $23,a           ; the line's low eight bits
    ld a,h                  ; bit 8 of the line...
    or %00000010            ; ...and bit 1: the line interrupt on
    nextreg $22,a
    ret

; One handler for both interrupts. The status bits in NextReg $C8 say who rang:
; bit 0 the ULA's frame interrupt, bit 1 the line interrupt.
BcIsr:
    push af
    push bc
    ld a,$C8
    call ReadNextRegA
    nextreg $C8,a           ; write the 1s back: clears them
    bit 0,a
    jr z,BcIsrLine
    ld b,a
    ld a,1
    out ($FE),a             ; the frame interrupt: blue from the top of the frame
    ld a,(Frames)
    inc a
    ld (Frames),a           ; the shell's frame counter keeps counting
    ld a,b
BcIsrLine:
    bit 1,a
    jr z,BcIsrDone
    ld a,2
    out ($FE),a             ; the line interrupt: red from the chosen line
BcIsrDone:
    pop bc
    pop af
    ei
    reti

BcLine:
    .defw 0
BcHeld:
    .defb 0
BcText1:
    .defn "Line interrupt:"
BcText2:
    .defn "  0-191  the display area"
BcText3:
    .defn "192-246  the bottom border"
BcText4:
    .defn "247-310  the top of the frame"
BcText5:
    .defn "Q: up  A: down (hold: faster)"

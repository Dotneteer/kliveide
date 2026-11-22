; Demo: Fourteen Voices
; Chapter: Interrupts (content/next-interrupts.mdx), "Hardware IM2 mode: a vector for every voice"
;
; Switches to hardware IM2 mode with the vectors from $A0, and gives three sources a handler and a
; counter each: the line interrupt (index 0), CTC channel 0 (index 3) and the ULA's frame
; interrupt (index 11). The line handler turns the border red at line 96, the ULA handler white
; again at the top of the frame.
; Changes NextRegs $C0, $C4, $C5, $22 and $23, CTC channel 0 and three slots of the shell's vector
; table; puts all of them back.

FourteenVoicesTitle:
    .defn "Fourteen Voices"

FvLine:     .equ 96         ; the line the line interrupt rings for

FourteenVoices:
    ld de,$0000
    ld c,$78
    ld hl,FourteenVoicesTitle
    call PrintText
    ld de,$0200             ; row 2
    ld c,$38
    ld hl,FvText1
    call PrintText
    ld de,$0400             ; row 4
    ld hl,FvLineText
    call PrintText
    ld de,$0500
    ld hl,FvCtcText
    call PrintText
    ld de,$0600
    ld hl,FvUlaText
    call PrintText
    call ShowMenuFooter
    call WaitNoKey          ; the menu's key may still be down

    ld hl,0
    ld (FvLineCount),hl
    ld (FvCtcCount),hl
    ld (FvUlaCount),hl

    di
    ; The shell's table is at $BE00 and I is $BE already. Give three slots their handlers.
    ld hl,FvLineIsr
    ld ($BEA0),hl           ; line: $A0 + 0 x 2
    ld hl,FvCtcIsr
    ld ($BEA6),hl           ; CTC 0: $A0 + 3 x 2
    ld hl,FvUlaIsr
    ld ($BEB6),hl           ; ULA: $A0 + 11 x 2

    ld a,FvLine >> 8
    nextreg $22,a           ; the line's top bit; bit 1 (the line enable) comes from $C4
    nextreg $23,FvLine & $FF
    nextreg $C4,%00000011   ; enable the ULA (bit 0) and the line interrupt (bit 1)

    ; CTC channel 0: timer, prescaler 256, time constant 250: 437.5 times a second
    ld bc,$183B
    ld a,%10100101          ; interrupt, timer, /256, a time constant follows
    out (c),a
    ld a,250
    out (c),a

    nextreg $C0,$A1         ; vectors from $A0, hardware IM2 mode
    ei

FvShow:
    halt
    ld d,4                  ; row 4: the line interrupt's count
    ld hl,FvLineCount
    call FvPrintCount
    ld d,5                  ; row 5: CTC channel 0
    ld hl,FvCtcCount
    call FvPrintCount
    ld d,6                  ; row 6: the ULA
    ld hl,FvUlaCount
    call FvPrintCount
    call ScanKeys
    inc a                   ; $FF, no key, becomes 0
    jr z,FvShow

    ; Put everything back: pulse mode, the ULA alone, the CTC stopped, the table's slots
    di
    nextreg $C0,0
    nextreg $C4,1
    nextreg $22,0
    nextreg $23,0
    ld bc,$183B
    ld a,$03                ; software reset; this also clears the channel's interrupt enable
    out (c),a
    ld hl,$BFBF
    ld ($BEA0),hl
    ld ($BEA6),hl
    ld ($BEB6),hl
    ei
    ld a,7
    out ($FE),a
    jp WaitNoKey

; Prints the 16-bit count at HL at row D, column 23. Reads it with interrupts off, so a handler
; cannot change it halfway.
FvPrintCount:
    di
    ld a,(hl)
    inc hl
    ld h,(hl)
    ld l,a
    ei
    ld e,23
    ld c,$38
    jp PrintNum16

; The handlers. Each counts, and ends with EI and RETI: only RETI releases its source.
FvLineIsr:
    push af
    push hl
    ld a,2
    out ($FE),a             ; red from line 96 down
    ld hl,(FvLineCount)
    inc hl
    ld (FvLineCount),hl
    pop hl
    pop af
    ei
    reti

FvCtcIsr:
    push hl
    ld hl,(FvCtcCount)
    inc hl
    ld (FvCtcCount),hl
    pop hl
    ei
    reti

FvUlaIsr:
    push af
    push hl
    ld a,7
    out ($FE),a             ; white again at the top of the frame
    ld hl,(FvUlaCount)
    inc hl
    ld (FvUlaCount),hl
    ld hl,Frames
    inc (hl)                ; the shell's frame counter keeps counting
    pop hl
    pop af
    ei
    reti

FvLineCount:
    .defw 0
FvCtcCount:
    .defw 0
FvUlaCount:
    .defw 0
FvText1:
    .defn "Hardware IM2, vectors from $A0"
FvLineText:
    .defn "Line 96   index 0  $A0"
FvCtcText:
    .defn "CTC 0     index 3  $A6"
FvUlaText:
    .defn "ULA       index 11 $B6"

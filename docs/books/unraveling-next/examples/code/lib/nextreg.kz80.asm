; Reading a NextReg. Writing one needs no routine: NEXTREG does it in one instruction.

; Reads NextReg reg into A. Uses BC.
;   ReadNextReg($01)
ReadNextReg: .macro(reg)
    ld a,{{reg}}
    call ReadNextRegA
.endm

; Reads the NextReg whose number is in A; returns its value in A. Uses BC.
ReadNextRegA:
    ld bc,$243B
    out (c),a               ; select the register
    inc b                   ; BC: $253B
    in a,(c)                ; read its value
    ret

; Reads the NextReg whose number is in A, HL times, and returns the lowest value in D and the highest
; in E. Selects the register once and then reads port $253B again and again. Uses A, BC, HL.
ReadNextRegRange:
    ld bc,$243B
    out (c),a               ; select the register once
    inc b                   ; BC: $253B
    ld de,$FF00             ; lowest so far $FF, highest $00
ReadNextRegRangeLoop:
    in a,(c)
    cp d
    jr nc,ReadNextRegNotLower   ; not below the lowest so far
    ld d,a
ReadNextRegNotLower:
    cp e
    jr c,ReadNextRegNotHigher   ; below the highest so far
    ld e,a
ReadNextRegNotHigher:
    dec hl
    ld a,h
    or l
    jr nz,ReadNextRegRangeLoop
    ret

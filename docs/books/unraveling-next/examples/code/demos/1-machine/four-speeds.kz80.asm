; Demo: Four Speeds
; Chapter: The Z80N (content/next-cpu.mdx), "Four speeds and one wait state"
;
; Runs the same counting loop for one frame at each CPU speed and prints how far it got.
; Changes NextReg $07; the shell's reset puts it back to 28 MHz.

FourSpeedsTitle:
    .defn "Four Speeds"

FourSpeeds:
    ld de,$0000
    ld c,$78
    ld hl,FourSpeedsTitle
    call PrintText
    ld de,$0200             ; row 2
    ld c,$38
    ld hl,FsIntro
    call PrintText

    xor a
    ld (FsSpeed),a
FsNext:
    ld a,(FsSpeed)
    nextreg $07,a           ; 0-3: 3.5, 7, 14, 28 MHz
    call FsMeasure          ; HL: loops in one frame
    push hl
    ld a,(FsSpeed)
    add a,4
    ld d,a                  ; rows 4 to 7
    ld e,0
    ld c,$38
    ld a,(FsSpeed)
    add a,a
    ld hl,FsNames
    add hl,a
    ld a,(hl)
    inc hl
    ld h,(hl)
    ld l,a                  ; HL: the speed's name
    call PrintText
    pop hl
    call PrintNum16
    ld a,(FsSpeed)
    inc a
    ld (FsSpeed),a
    cp 4
    jr nz,FsNext

    nextreg $07,3           ; back to 28 MHz
    call WaitForMenu
    ret

; Counts loops from one frame interrupt to the next; returns the count in HL
FsMeasure:
    halt                    ; start right after an interrupt
    ld hl,0
    ld a,(Frames)
    ld b,a
FsMeasureLoop:
    inc hl
    ld a,(Frames)
    cp b
    jr z,FsMeasureLoop
    ret

FsSpeed:
    .defb 0
FsNames:
    .defw FsName0, FsName1, FsName2, FsName3
FsName0:
    .defn " 3.5 MHz: "
FsName1:
    .defn "   7 MHz: "
FsName2:
    .defn "  14 MHz: "
FsName3:
    .defn "  28 MHz: "
FsIntro:
    .defn "Loops counted in one frame:"

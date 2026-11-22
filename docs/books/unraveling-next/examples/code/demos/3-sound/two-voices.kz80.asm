; Demo: Two Voices
; Chapter: The Beeper (content/next-audio/beeper.mdx), "Two voices from one bit"
;
; Plays two voices at once on port $FE bit 4 with the chapter's 112-T-state loop: each voice keeps
; an 8-bit phase, adds its step every pass, and takes its slot of the pass with EAR on when the
; addition carries. A pitch is 31,250 x step / 256 Hz. The list on the screen plays each voice
; alone, then six intervals, and starts again; the row that plays is highlighted.
; Changes NextReg $07 (3.5 MHz) and NextReg $08 bit 6 (contention off), and runs with interrupts
; off; puts back 28 MHz, the old $08, EAR off and the white border.

TwoVoicesTitle:
    .defn "Two Voices"

TvFirstRow: .equ 6          ; the row of the list's first entry
TvBlocks:   .equ 110        ; a note's length in blocks of 256 passes (about 0.9 s)

TwoVoices:
    ld de,$0000
    ld c,$78
    ld hl,TwoVoicesTitle
    call PrintText
    ld de,$0200             ; row 2
    ld c,$38
    ld hl,TvText1
    call PrintText
    ld de,$0300
    ld hl,TvText2
    call PrintText
    ld de,$0500             ; row 5: the list's header
    ld hl,TvHeader
    call PrintText
    ld ix,TvTune            ; the list: one row per entry
    ld d,TvFirstRow
TvList:
    ld a,(ix+0)
    cp $FF
    jr z,TvListDone
    ld e,0
    ld c,$38
    ld l,(ix+2)
    ld h,(ix+3)
    call PrintText
    inc d
    ld bc,4
    add ix,bc
    jr TvList
TvListDone:
    call ShowMenuFooter
    call WaitNoKey          ; the menu's key may still be down

    ReadNextReg($08)
    ld (TvOld08),a
    or %01000000            ; contention off: every pass is exactly 112 T-states
    nextreg $08,a
    nextreg $07,0           ; 3.5 MHz, the chapter's timing
    di                      ; an interrupt would stretch a pass

    ld ix,TvTune
    ld d,TvFirstRow
TvNote:
    ld a,$68                ; highlight the row that plays
    call TvMark
    push de
    ld d,(ix+0)             ; voice 1's step
    ld e,(ix+1)             ; voice 2's step
    ld b,TvBlocks
    ld hl,0                 ; H, L: the two voices' phases
    ld c,l                  ; C counts 256 passes
TvLoop:
    ld a,h                  ;  4
    add a,d                 ;  4  voice 1's phase + its step
    ld h,a                  ;  4
    sbc a,a                 ;  4  $FF if that carried, else 0
    and $10                 ;  7  ... so A is EAR on or off
    out ($FE),a             ; 11  voice 1's slot begins
    ld a,l                  ;  4
    add a,e                 ;  4  the same for voice 2
    ld l,a                  ;  4
    sbc a,a                 ;  4
    and $10                 ;  7
    out ($FE),a             ; 11  voice 2's slot begins
    ld a,0                  ;  7
    dec c                   ;  4  the pass counter takes a NOP's place
    nop                     ;  4
    nop                     ;  4
    nop                     ;  4
    out ($FE),a             ; 11  both slots over: EAR off
    jp nz,TvLoop            ; 10  112 T-states a pass
    djnz TvLoop             ; the next 256 passes
    pop de
    ld a,$38                ; the row is done
    call TvMark
    call ScanKeys
    inc a                   ; $FF, no key, becomes 0
    jr nz,TvDone
    inc d                   ; the next entry, or the first again
    ld bc,4
    add ix,bc
    ld a,(ix+0)
    cp $FF
    jr nz,TvNote
    ld ix,TvTune
    ld d,TvFirstRow
    jr TvNote

TvDone:
    nextreg $07,3
    ld a,(TvOld08)
    nextreg $08,a
    ld a,7
    out ($FE),a             ; EAR off, white border
    ei
    jp WaitNoKey

; Sets the attribute of row D, columns 0-29, to A. Keeps DE.
TvMark:
    push de
    ld l,d
    ld h,0
    add hl,hl
    add hl,hl
    add hl,hl
    add hl,hl
    add hl,hl               ; row * 32
    add hl,$5800
    ld b,30
TvMarkLoop:
    ld (hl),a
    inc hl
    djnz TvMarkLoop
    pop de
    ret

; The list: voice 1's step, voice 2's step (0: silent), the row's text. $FF ends it.
TvTune:
    .defb 4, 0
    .defw TvRow1
    .defb 0, 5
    .defw TvRow2
    .defb 4, 5
    .defw TvRow3
    .defb 4, 6
    .defw TvRow4
    .defb 3, 4
    .defw TvRow5
    .defb 5, 6
    .defw TvRow6
    .defb 3, 5
    .defw TvRow7
    .defb 4, 8
    .defw TvRow8
    .defb $FF

TvOld08:
    .defb 0
TvText1:
    .defn "One bit, two voices, 112 T/pass"
TvText2:
    .defn "Pitch: 31,250 x step / 256 Hz"
TvHeader:
    .defn "Steps  Hz       Interval"
TvRow1:
    .defn " 4 0   488  -   voice 1 alone"
TvRow2:
    .defn " 0 5    -  610  voice 2 alone"
TvRow3:
    .defn " 4 5   488 610  third, 5:4"
TvRow4:
    .defn " 4 6   488 732  fifth, 3:2"
TvRow5:
    .defn " 3 4   366 488  fourth, 4:3"
TvRow6:
    .defn " 5 6   610 732  minor third"
TvRow7:
    .defn " 3 5   366 610  sixth, 5:3"
TvRow8:
    .defn " 4 8   488 977  octave, 2:1"

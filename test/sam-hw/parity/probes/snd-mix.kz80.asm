; Parity probe "snd-mix" (Phase 6, sound step 2): the beeper and the SAA 1099 as heard, recorded from each
; emulator's output (SimCoupé's through a loopback device: dev/scripts/sam-parity/sound.cjs). Parts, in
; frames (50.08 a second), each after a lead-in of 25 silent frames:
;   1  beeper toggled every frame, 50 frames (a 25 Hz square: the DC filter's droop)
;   2  silence, 15 frames
;   3  beeper at about 1 kHz, about 1 s (interrupts off, SOFF so every line has the same contention)
;   4  silence, 15 frames
;   5  SAA channel 0: octave 5, offset 11 (1000 Hz), amplitude 15 both sides, 50 frames
;   6  silence, 15 frames
;   7  beeper held high 50 frames, then low 50 frames (the DC filter's step response)
;   8  SAA channel 0 at amplitudes 15, 8, 4, 1, 25 frames each
;   9  silence, 25 frames
; @sound
;   DONE      1
;   BEEPLOOP  the 1 kHz part's half periods (so the analysis knows its length)

SAA_DATA        .equ $00FF
SAA_ADDR        .equ $01FF
BEEP_HALVES     .equ 2000           ; about 1 s of 1 kHz half periods
BEEP_DELAY      .equ 225            ; DJNZ passes a half period

ProbeMain:
    ei
    xor a
    out ($FE),a
    call SaaReset
    ld b,25
    call Frames

    ; --- 1: the beeper toggled every frame
    ld c,50
    xor a
Part1:
    xor $10
    out ($FE),a
    ld b,1
    push af
    call Frames
    pop af
    dec c
    jr nz,Part1
    xor a
    out ($FE),a
    ld b,15
    call Frames

    ; --- 3: about 1 kHz, interrupts off, SOFF (mode 4)
    di
    in a,($FC)
    ld (SavedVmpr),a
    or $60
    out ($FC),a
    ld hl,BEEP_HALVES
    ld a,$80
Part3:
    xor $10
    out ($FE),a
    ld b,BEEP_DELAY
Part3Wait:
    djnz Part3Wait
    dec hl
    ld e,a
    ld a,h
    or l
    ld a,e
    jp nz,Part3
    xor a
    out ($FE),a
    ld a,(SavedVmpr)
    out ($FC),a
    ei
    ld b,15
    call Frames

    ; --- 5: the SAA, 1000 Hz
    ld d,$FF
    call SaaTone
    ld b,50
    call Frames
    call SaaReset
    ld b,15
    call Frames

    ; --- 7: the beeper's step
    ld a,$10
    out ($FE),a
    ld b,50
    call Frames
    xor a
    out ($FE),a
    ld b,50
    call Frames

    ; --- 8: amplitude steps
    ld hl,Amplitudes
Part8:
    ld a,(hl)
    or a
    jr z,Part8Done
    ld d,a
    push hl
    call SaaTone
    ld b,25
    call Frames
    pop hl
    inc hl
    jr Part8
Part8Done:
    call SaaReset
    ld b,25
    call Frames

    ld a,1
    ld hl,NameDone
    call RecordA
    ld de,BEEP_HALVES
    ld bc,0
    ld hl,NameBeepLoop
    jp Record

; --- B frames (interrupts on)
Frames:
    halt
    djnz Frames
    ret

; --- A register write: register E, value A
SaaWrite:
    push bc
    ld bc,SAA_ADDR
    out (c),e
    ld bc,SAA_DATA
    out (c),a
    pop bc
    ret

; --- Everything off, then sound on with nothing playing
SaaReset:
    push de
    ld e,$1C
    ld a,$02            ; reset (sync)
    call SaaWrite
    ld e,$14
    xor a
    call SaaWrite       ; tones off
    ld e,$15
    call SaaWrite       ; noise off
    ld e,$18
    call SaaWrite       ; envelopes off
    ld e,$19
    call SaaWrite
    ld e,$00
    call SaaWrite       ; channel 0 silent
    ld e,$1C
    ld a,$01            ; sound on
    call SaaWrite
    pop de
    ret

; --- Channel 0 at 1000 Hz (octave 5, offset 11), amplitude D (left in bits 0-3, right in 4-7)
SaaTone:
    ld e,$08
    ld a,11
    call SaaWrite
    ld e,$10
    ld a,$05
    call SaaWrite
    ld e,$00
    ld a,d
    call SaaWrite
    ld e,$14
    ld a,$01
    jp SaaWrite

Amplitudes:     .defb $FF, $88, $44, $11, 0
SavedVmpr:      .defb 0
NameDone:       .defm "DONE    "
NameBeepLoop:   .defm "BEEPLOOP"

; Demo: Envelope Shapes
; Chapter: One AY Chip (content/next-audio/psg.mdx), "Playing a chord" and "The sixteen envelope
; shapes"
;
; Plays a C major chord on chip 0's three channels for two seconds, then the sixteen envelope
; shapes one after another, two seconds each, on channel A's C with envelope period 1,700 (a ramp
; of about a quarter of a second). Each shape's row shows its number, its CONT, ATT, ALT and HOLD
; bits, what it does, and a drawing of three ramps; the row that plays is highlighted. Then it
; starts again.
; Changes chip 0's registers; silences the chips before it returns.

EnvelopeShapesTitle:
    .defn "Envelope Shapes"

EsFirstRow: .equ 4          ; shape 0's row; the chord's row is 2
EsPeriod:   .equ 1700       ; the envelope period: 32 x 1,700 / 218,750 = 0.25 s a ramp
EsFrames:   .equ 100        ; two seconds for the chord and for each shape

EnvelopeShapes:
    ld de,$0000
    ld c,$78
    ld hl,EnvelopeShapesTitle
    call PrintText
    ld de,$0200             ; row 2: the chord
    ld c,$38
    ld hl,EsChordText
    call PrintText
    ld de,$0300
    ld hl,EsHeader
    call PrintText
    ld de,$1500             ; row 21
    ld hl,EsNote
    call PrintText
    ld de,$1600             ; row 22
    ld hl,EsBits
    call PrintText
    call EsDrawRows
    call ShowMenuFooter
    call WaitNoKey          ; the menu's key may still be down

EsAgain:
    ; A chord: C, E and G on channels A, B and C, tones on, volume 15
    ld hl,EsChord
    call AyWriteList
    ld d,2
    call EsPlay
    jr nz,EsDone
    ; Channel A alone, its volume from the envelope
    ld hl,EsEnvelope
    call AyWriteList
    xor a
EsShape:
    ld (EsCurrent),a
    ld e,a
    ld a,13                 ; R13: the shape; the write restarts the envelope
    call AyWrite
    ld a,(EsCurrent)
    add a,EsFirstRow
    ld d,a
    call EsPlay
    jr nz,EsDone
    ld a,(EsCurrent)
    inc a
    cp 16
    jr nz,EsShape
    jr EsAgain

EsDone:
    call SilenceSound
    jp WaitNoKey

; Highlights row D, waits EsFrames frames or until a key is down, and unhighlights the row.
; Returns NZ if a key is down.
EsPlay:
    ld a,$68
    call EsMark
    ld b,EsFrames
EsPlayFrame:
    halt
    push bc
    call ScanKeys
    pop bc
    inc a                   ; $FF, no key, becomes 0
    jr nz,EsPlayEnd
    djnz EsPlayFrame
EsPlayEnd:
    push af
    ld a,$38
    call EsMark
    pop af
    ret

; Sets the attribute of row D, columns 0-23, to A. Keeps DE.
EsMark:
    ld l,d
    ld h,0
    add hl,hl
    add hl,hl
    add hl,hl
    add hl,hl
    add hl,hl               ; row * 32
    add hl,$5800
    ld b,24
EsMarkLoop:
    ld (hl),a
    inc hl
    djnz EsMarkLoop
    ret

; Prints the sixteen rows: number, CONT ATT ALT HOLD, what the shape does, and its drawing
EsDrawRows:
    xor a
EsDrawRow:
    ld (EsCurrent),a
    add a,EsFirstRow
    ld d,a
    ld e,0
    ld c,$38
    ld a,(EsCurrent)
    call PrintDec8
    inc e
    ld a,(EsCurrent)
    rlca
    rlca
    rlca
    rlca                    ; bit 3, CONT, in bit 7
    ld b,4
EsDrawBits:
    rlca
    push af
    push bc
    ld a,$30
    adc a,0                 ; "0" or "1"
    call PrintCharNext
    pop bc
    pop af
    djnz EsDrawBits
    inc e
    ld a,(EsCurrent)
    add a,a
    ld hl,EsWhat
    add hl,a
    ld a,(hl)
    inc hl
    ld h,(hl)
    ld l,a
    call PrintText
    call EsDrawShape
    ld a,(EsCurrent)
    inc a
    cp 16
    jr nz,EsDrawRow
    ret

; Draws three ramps of shape EsCurrent in its row, columns 26-31: 16 pixels a ramp, a level of
; 0-15 drawn 0-5 pixels up from the row's second line from the bottom. A model of the envelope:
;   the first ramp climbs if ATT is 1 and falls if it is 0;
;   after it, with CONT 0 the level is 0; with HOLD it stays at the end of the first ramp, or at
;   the other end if ALT is 1; otherwise the ramps go on, every other one turned round if ALT is 1.
EsDrawShape:
    ld a,(EsCurrent)
    ld c,a                  ; C: the shape's bits
    ld b,0                  ; B: x, 0-47
EsDrawStep:
    ld a,b
    and $0F
    ld l,a                  ; L: the step within the ramp, 0-15
    ld a,b
    and $30
    jr z,EsUseRamp          ; the first ramp
    bit 3,c
    jr z,EsLevel0           ; CONT 0: silent
    bit 0,c
    jr z,EsRepeat
    ld a,c                  ; HOLD: the end of the first ramp, or the other end with ALT
    rrca
    xor c                   ; bit 1: ALT xor ATT
    bit 1,a
    jr z,EsLevel0
    ld a,15
    jr EsPlot
EsLevel0:
    xor a
    jr EsPlot
EsRepeat:
    bit 1,c
    jr z,EsUseRamp          ; no ALT: every ramp as the first
    ld a,b
    and $10                 ; ALT: odd ramps go the other way
    jr z,EsUseRamp
    ld a,c
    xor %00000100           ; ATT turned round
    jr EsRampDir
EsUseRamp:
    ld a,c
EsRampDir:
    bit 2,a
    ld a,l
    jr nz,EsPlot            ; climbing: the level is the step
    ld a,15
    sub l                   ; falling
EsPlot:
    push bc
    ld e,a
    add a,a
    add a,e
    srl a
    srl a
    srl a                   ; level x 3 / 8: 0-5 pixels up
    ld e,a
    ld a,(EsCurrent)
    add a,EsFirstRow
    add a,a
    add a,a
    add a,a
    add a,6                 ; a line above the row's bottom: rows do not touch
    sub e
    ld d,a
    ld a,b
    add a,26 * 8
    ld e,a
    pixelad                 ; HL: the byte of pixel (E, D)
    setae                   ; A: its bit
    or (hl)
    ld (hl),a
    pop bc
    inc b
    ld a,b
    cp 48
    jr nz,EsDrawStep
    ret

; Chip 0's registers for the chord: periods 209, 166 and 140 (C, E and G above middle C), tones
; on and noise off, volume 15
EsChord:
    .defb 0, 209, 1, 0
    .defb 2, 166, 3, 0
    .defb 4, 140, 5, 0
    .defb 7, %00111000
    .defb 8, 15, 9, 15, 10, 15
    .defb $FF

; Channel A follows the envelope; B and C are silent
EsEnvelope:
    .defb 9, 0, 10, 0
    .defb 11, EsPeriod & $FF, 12, EsPeriod >> 8
    .defb 8, $10
    .defb $FF

; What each shape does
EsWhat:
    .defw EsFall, EsFall, EsFall, EsFall
    .defw EsClimb, EsClimb, EsClimb, EsClimb
    .defw EsSawDown, EsFall, EsTriDown, EsFallFull
    .defw EsSawUp, EsClimbHold, EsTriUp, EsClimb

EsCurrent:
    .defb 0
EsChordText:
    .defn "Chord C E G: 209 166 140"
EsHeader:
    .defn "No bits what it does"
EsNote:
    .defn "Ch. A: C, envelope period 1700"
EsBits:
    .defn "bits: CONT ATT ALT HOLD"
EsFall:
    .defn "fall, silent"
EsClimb:
    .defn "climb, silent"
EsSawDown:
    .defn "falling saw"
EsSawUp:
    .defn "rising saw"
EsTriDown:
    .defn "triangle, down"
EsTriUp:
    .defn "triangle, up"
EsFallFull:
    .defn "fall, then full"
EsClimbHold:
    .defn "climb, hold"

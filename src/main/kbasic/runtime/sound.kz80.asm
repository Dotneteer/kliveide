; @module   sound
; @summary  BEEP: Klive's own beeper loop, timed from the duration and pitch by the ROM calculator.
; @exports  Beep
; @requires float
;
; BEEP duration, pitch: duration in seconds, pitch in semitones from middle C (261.63 Hz). The
; calculator turns them into the number of speaker toggles (2 * duration * frequency) and the delay
; between toggles; the loop then runs with interrupts disabled, the border kept as BORDCR says. A
; duration of 0 or less, or one too short for a single cycle, makes no sound.

; ------------------------------------------------------------------------------------------------
; In: A-E-D-C-B = the pitch, the duration (a Float) under the return address, removed. Changes AF,
; BC, DE, HL.
Beep:
    ld (BeepPitch),a
    ld (BeepPitch+1),de
    ld (BeepPitch+3),bc
    pop hl                  ; the return address
    pop af
    pop de
    pop bc                  ; A-E-D-C-B = the duration
    push hl
    push iy
    ld iy,$5c3a
    call FStack             ;                                  [duration]
    ld hl,BeepPitch
    call BeepStackHL        ;                                  [duration][pitch]
    ld hl,BeepTwelve
    call BeepStackHL
    rst $28
    .defb $05               ; division                         [duration][pitch/12]
    .defb $38
    ld hl,BeepTwo
    call BeepStackHL
    rst $28
    .defb $01               ; exchange                         [duration][2][pitch/12]
    .defb $06               ; to-power                         [duration][2^(pitch/12)]
    .defb $38
    ld hl,BeepMiddleC
    call BeepStackHL
    rst $28
    .defb $04               ; multiply                         [duration][f]
    .defb $c0               ; st-mem-0: f
    .defb $04               ; multiply                         [duration*f]
    .defb $38
    ld hl,BeepTwo
    call BeepStackHL
    rst $28
    .defb $04               ; multiply                         [toggles]
    .defb $38
    call FFetch
    call FToI32
    ld (BeepCount),hl
    ld (BeepCount+2),de
    ld hl,BeepHalfPeriod
    call BeepStackHL
    rst $28
    .defb $e0               ; get-mem-0                        [1750000][f]
    .defb $05               ; division: T-states per half cycle
    .defb $38
    ld hl,BeepOverhead
    call BeepStackHL
    rst $28
    .defb $03               ; subtract the loop's own time
    .defb $38
    ld hl,BeepIteration
    call BeepStackHL
    rst $28
    .defb $05               ; division: iterations of the wait
    .defb $38
    call FFetch
    call FToI32
    pop iy
    ; --- The wait: at least 1 and at most 65535 iterations
    ld a,d
    or e
    jr z,BeepWaitFits
    bit 7,d
    ld hl,1
    jr nz,BeepWaitFits      ; negative: as short as possible
    ld hl,$ffff
BeepWaitFits:
    ld a,h
    or l
    jr nz,BeepWaitSet
    inc hl
BeepWaitSet:
    ld (BeepDelay),hl
    ; --- No toggles (or a negative count): no sound
    ld hl,(BeepCount+2)
    bit 7,h
    ret nz
    ld a,h
    or l
    ld hl,(BeepCount)
    or h
    or l
    ret z
    di
    ld a,($5c48)            ; BORDCR: the border in bits 3-5
    rrca
    rrca
    rrca
    and $07
    ld c,a
BeepLoop:
    ld a,c
    xor $10                 ; the speaker bit
    ld c,a
    out ($fe),a
    ld de,(BeepDelay)
BeepWait:
    dec de
    ld a,d
    or e
    jr nz,BeepWait          ; 26 T-states an iteration
    ld hl,(BeepCount)
    ld a,h
    or l
    jr nz,BeepLow
    ld hl,(BeepCount+2)
    dec hl
    ld (BeepCount+2),hl
    ld hl,0
BeepLow:
    dec hl
    ld (BeepCount),hl
    ld a,h
    or l
    jr nz,BeepLoop
    ld hl,(BeepCount+2)
    ld a,h
    or l
    jr nz,BeepLoop
    ei
    ret

; Stacks the Float at HL on the calculator stack. Changes AF, BC, DE, HL.
BeepStackHL:
    ld a,(hl)
    inc hl
    ld e,(hl)
    inc hl
    ld d,(hl)
    inc hl
    ld c,(hl)
    inc hl
    ld b,(hl)
    jp FStack

BeepPitch:
    .defs 5
BeepCount:
    .defs 4
BeepDelay:
    .defw 0
BeepTwelve:
    .defb $00, $00, $0c, $00, $00
BeepTwo:
    .defb $00, $00, $02, $00, $00
BeepMiddleC:
    .defb $89, $02, $d0, $12, $86     ; 261.6255653: middle C in Hz
BeepHalfPeriod:
    .defb $95, $55, $9f, $80, $00     ; 1750000: T-states in half a second at 3.5 MHz
BeepOverhead:
    .defb $00, $00, $78, $00, $00     ; 120: the loop's T-states besides the wait
BeepIteration:
    .defb $00, $00, $1a, $00, $00     ; 26: the wait's T-states an iteration

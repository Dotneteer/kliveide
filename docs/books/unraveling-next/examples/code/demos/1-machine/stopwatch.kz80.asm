; Demo: Stopwatch
; Chapter: CTC (content/next-ctc.mdx), "A stopwatch"
;
; Chains CTC channels 0 and 1 into a 16-bit counter of 16-clock ticks and times three pieces of
; code with it: 100 NOPs and a 100-byte LDIR at 3.5 MHz, then the same NOPs at 28 MHz. Prints each
; time in T-states at 3.5 MHz, next to what the instruction tables say.
; Changes CTC channels 0 and 1 and NextReg $07; stops the channels and sets 28 MHz again.

StopwatchTitle:
    .defn "Stopwatch"

Stopwatch:
    ld de,$0000
    ld c,$78
    ld hl,StopwatchTitle
    call PrintText
    ld de,$0200             ; row 2
    ld c,$38
    ld hl,SwHeader
    call PrintText
    ld de,$0413             ; row 4, column 19: an empty row after the title line
    ld hl,SwColumns
    call PrintText

    ; Channel 0: timer, prescaler 16, time constant 0 (256): the low byte
    ld bc,$183B
    ld a,%00000101          ; timer, /16, a time constant follows
    out (c),a
    xor a
    out (c),a
    ; Channel 1: counter of channel 0's zero counts, time constant 0: the high byte
    inc b                   ; $193B
    ld a,%01000101          ; counter, a time constant follows
    out (c),a
    xor a
    out (c),a

    ; At 3.5 MHz: measure an empty block first, and take it off every other time
    nextreg $07,0
    ld ix,SwEmpty
    call SwTime
    ld (SwOverhead),hl
    ld ix,SwNops
    ld d,5                  ; row 5
    ld hl,SwNopsText
    ld bc,400               ; 100 x 4 T-states
    call SwShow
    ld ix,SwLdir
    ld d,6
    ld hl,SwLdirText
    ld bc,2125              ; 3 x 10 for the LDs, then 99 x 21 + 16
    call SwShow

    ; At 28 MHz the overhead is smaller: measure it again
    nextreg $07,3
    ld ix,SwEmpty
    call SwTime
    ld (SwOverhead),hl
    ld ix,SwNops
    ld d,8                  ; row 8
    ld hl,SwNops28Text
    ld bc,62                ; 100 x 5 clocks at 28 MHz: 62.5 T-states at 3.5 MHz
    call SwShow

    ; Stop both channels
    ld bc,$183B
    ld a,$03                ; software reset, no time constant
    out (c),a
    inc b
    out (c),a

    call WaitForMenu
    ret

; Times the code at IX and prints row D: the text at HL, the time, and BC, the time the
; instruction tables give
SwShow:
    push bc
    push de
    push hl
    call SwTime
    ld de,(SwOverhead)
    or a
    sbc hl,de               ; take off the timing's own cost
    ld (SwResult),hl
    pop hl
    pop de
    ld e,0
    ld c,$38
    call PrintText          ; keeps C and D
    ld e,19
    ld hl,(SwResult)
    call PrintNum16
    inc e
    pop hl                  ; the tables' time
    jp PrintNum16

; Times the code at IX; returns its time in HL, in T-states at 3.5 MHz, including the cost of the
; timing itself
SwTime:
    di
    call SwRead
    push hl
    call SwCallIx
    call SwRead
    pop de
    ex de,hl                ; HL: the first count, DE: the second
    or a
    sbc hl,de               ; the channels count down
    add hl,hl               ; a count: 2 T-states at 3.5 MHz
    ei
    ret

SwCallIx:
    jp (ix)

; Reads the 16-bit count: channel 1 the high byte, channel 0 the low byte.
; Returns it in HL; changes A, BC.
SwRead:
    ld bc,$193B
    in h,(c)                ; high byte: channel 1
    dec b                   ; $183B: channel 0
    in l,(c)                ; low byte
    inc b
    in a,(c)                ; high byte again
    cp h
    jr nz,SwRead            ; it counted: read again
    inc l
    dec l
    jr z,SwRead             ; low byte 0: read again
    ret

; The code being timed
SwEmpty:
    ret

SwNops:
    .loop 100
    nop
    .endl
    ret

SwLdir:
    ld hl,$0000             ; from the ROM
    ld de,$C000
    ld bc,100
    ldir
    ret

SwOverhead:
    .defw 0
SwResult:
    .defw 0
SwHeader:
    .defn "Time in T-states at 3.5 MHz"
SwColumns:
    .defn "meas.  book"
SwNopsText:
    .defn "NOP x 100"
SwLdirText:
    .defn "LD x 3, LDIR x 100"
SwNops28Text:
    .defn "NOP x 100, 28 MHz"

; Demo: Clock
; Chapter: Real-Time Clock (content/next-rtc.mdx), "Speaking the protocol yourself" and
; "Reading the time"
;
; Reads the DS1307's registers $00-$06 over I2C five times a second, with the chapter's
; bit-banged routines at 3.5 MHz, and shows them raw, in BCD, and as a date and a time, until a
; key is pressed. Says so if nothing acknowledges address $68. Never sets the clock: the only
; byte it writes after the address is the register pointer, $00, so the time and the 56 bytes of
; RAM stay as they were (guidelines/examples-plan.md, 2.1).
; Changes NextReg $07 for each read and sets 28 MHz again; leaves both I2C wires released.

ClockTitle:
    .defn "Clock"

Clock:
    ld de,$0000
    ld c,$78
    ld hl,ClockTitle
    call PrintText
    ld de,$0200
    ld c,$38
    ld hl,ClText1
    call PrintText
    call ShowMenuFooter
    call WaitNoKey
    ld hl,0
    ld (ClReads),hl

ClLoop:
    nextreg $07,0           ; 3.5 MHz: the DS1307 wants 4 us of SCL high
    call ClReadTime
    nextreg $07,3
    jr c,ClNoClock
    ld hl,(ClReads)
    inc hl
    ld (ClReads),hl
    call ClShow
    ld b,10                 ; the next read in ten frames
ClWait:
    halt
    push bc
    call ScanKeys
    pop bc
    inc a                   ; $FF, no key, becomes 0
    jr nz,ClDone
    djnz ClWait
    jr ClLoop
ClDone:
    jp WaitNoKey

ClNoClock:
    ld de,$0400
    ld c,$3A                ; INK 2
    ld hl,ClNoAckText
    call PrintText
    call WaitKey
    jp WaitNoKey

; Reads registers $00-$06 into ClTime. Returns carry set if no clock acknowledged $D0.
ClReadTime:
    call ClStart
    ld a,$D0                ; watchman, listen
    call ClWrite
    or a
    jr nz,ClNoAck           ; SDA stayed high: nobody is there
    xor a                   ; the pointer: $00
    call ClWrite
    call ClStart            ; repeated START
    ld a,$D1                ; watchman, talk
    call ClWrite
    ld hl,ClTime
    ld b,6                  ; six bytes with ACK
ClReadNext:
    push bc
    or a                    ; carry clear: ACK
    call ClRead
    ld (hl),a
    inc hl
    pop bc
    djnz ClReadNext
    scf                     ; carry set: NACK
    call ClRead             ; the year
    ld (hl),a
    call ClStop
    or a                    ; carry clear: done
    ret
ClNoAck:
    call ClStop
    scf
    ret

; START (also a repeated START): SDA, SCL high, SDA low while SCL is high, then SCL low
ClStart:
    ld bc,$113B             ; SDA
    ld a,1
    out (c),a               ; let SDA go
    ld b,$10                ; SCL
    out (c),a               ; let SCL go
    ld b,$11
    xor a
    out (c),a               ; SDA low: START
    ld b,$10
    out (c),a               ; SCL low
    ret

; STOP: SDA low, SCL high, then SDA high
ClStop:
    ld bc,$113B
    xor a
    out (c),a               ; SDA low
    ld b,$10
    inc a
    out (c),a               ; let SCL go
    ld b,$11
    out (c),a               ; SDA high: STOP
    ret

; Sends A, most significant bit first; returns the ACK bit in A (0 = ACK)
ClWrite:
    ld e,a
    ld d,8                  ; eight bits
ClWriteBit:
    ld bc,$113B
    xor a
    rl e                    ; the next bit into carry
    rla                     ; and into bit 0
    out (c),a               ; SDA = the bit
    ld b,$10
    ld a,1
    out (c),a               ; SCL high: read me
    xor a
    out (c),a               ; SCL low
    dec d
    jr nz,ClWriteBit
    ld bc,$113B
    ld a,1
    out (c),a               ; let SDA go
    ld b,$10
    out (c),a               ; the ninth pulse
    ld b,$11
    in a,(c)                ; the answer
    and 1
    ld e,a
    ld b,$10
    xor a
    out (c),a               ; SCL low
    ld a,e
    ret

; Receives a byte into A; answers NACK if carry is set, ACK otherwise
ClRead:
    push af                 ; keep the carry
    ld bc,$113B
    ld a,1
    out (c),a               ; let SDA go
    ld d,8
    ld e,0
ClReadBit:
    ld b,$10
    ld a,1
    out (c),a               ; SCL high
    ld b,$11
    in a,(c)                ; read SDA
    rra                     ; bit 0 into carry
    rl e                    ; and into E
    ld b,$10
    xor a
    out (c),a               ; SCL low
    dec d
    jr nz,ClReadBit
    pop af
    ld a,0
    rla                     ; A = carry: 0 ACK, 1 NACK
    ld b,$11
    out (c),a               ; our answer on SDA
    ld b,$10
    ld a,1
    out (c),a               ; the ninth pulse
    xor a
    out (c),a
    ld b,$11
    inc a
    out (c),a               ; let SDA go
    ld a,e
    ret

; Shows ClTime: the raw bytes, the time, the date, the day and the switches
ClShow:
    ld de,$0400
    ld c,$38
    ld hl,ClRawText
    call PrintText
    ld de,$0500
    ld hl,ClTime
    ld b,7
ClShowRaw:
    push bc
    ld a,(hl)
    push hl
    call PrintHex8          ; BCD: the hex digits are the decimal ones
    inc e
    pop hl
    inc hl
    pop bc
    djnz ClShowRaw
    ld de,$0600
    ld hl,ClRawNames
    call PrintText

    ; The time: hours, minutes, seconds
    ld de,$0800
    ld hl,ClTimeText
    call PrintText
    ld c,$78                ; BRIGHT
    ld a,(ClTime+2)
    bit 6,a
    jr z,ClHours24
    and $1F                 ; 12-hour mode: bit 5 is PM
ClHours24:
    and $3F                 ; 24-hour mode: bit 5 is a tens digit
    call PrintHex8
    ld a,$3A                ; ":"
    call PrintCharNext
    ld a,(ClTime+1)
    and $7F
    call PrintHex8
    ld a,$3A
    call PrintCharNext
    ld a,(ClTime)
    and $7F                 ; without CH
    call PrintHex8
    ld c,$38
    ld hl,ClBlank3
    ld a,(ClTime+2)
    bit 6,a
    jr z,ClAmPm
    ld hl,ClAmText
    bit 5,a
    jr z,ClAmPm
    ld hl,ClPmText
ClAmPm:
    call PrintText

    ; The date: day, month's name, year
    ld de,$0900
    ld hl,ClDateText
    call PrintText
    ld a,(ClTime+4)
    and $3F
    call PrintHex8
    inc e
    ld a,(ClTime+5)
    and $1F
    call ClBcdToBin
    ld hl,ClMonths
    call ClPrintName
    inc e
    ld a,$32                ; "2"
    call PrintCharNext
    ld a,$30                ; "0"
    call PrintCharNext
    ld a,(ClTime+6)
    call PrintHex8
    ld hl,ClBlank9
    call PrintText          ; wipe what a longer month left

    ; The day of the week, 1-7; which day is 1 is the software's choice
    ld de,$0A00
    ld hl,ClDayText
    call PrintText
    ld a,(ClTime+3)
    and $07
    push af
    add a,$30
    call PrintCharNext
    ld hl,ClDayNote
    call PrintText
    pop af
    ld hl,ClDays
    call ClPrintName
    ld hl,ClBlank3
    call PrintText          ; wipe what a longer name left

    ; The switches
    ld de,$0C00
    ld hl,ClChText
    call PrintText
    ld hl,ClRunning
    ld a,(ClTime)
    bit 7,a
    jr z,ClCh
    ld hl,ClHalted
ClCh:
    call PrintText
    ld de,$0D00
    ld hl,Cl24Text
    ld a,(ClTime+2)
    bit 6,a
    jr z,ClMode
    ld hl,Cl12Text
ClMode:
    call PrintText

    ld de,$0F00
    ld hl,ClReadsText
    call PrintText
    ld hl,(ClReads)
    jp PrintNum16

; Prints name A (1 up) from the table of pointers at HL; "?" if A is 0 or past the table's end
ClPrintName:
    or a
    jr z,ClNoName
    dec a
    cp (hl)                 ; the table's first byte: how many names
    jr nc,ClNoName
    inc hl
    add a,a
    add hl,a
    ld a,(hl)
    inc hl
    ld h,(hl)
    ld l,a
    jp PrintText
ClNoName:
    ld a,$3F                ; "?"
    jp PrintCharNext

; Converts the BCD byte in A to binary. Uses B, L.
ClBcdToBin:
    ld b,a
    and $F0
    rrca                    ; tens * 8
    push af
    rrca
    rrca                    ; tens * 2
    ld l,a
    pop af
    add a,l                 ; tens * 10
    ld l,a
    ld a,b
    and $0F
    add a,l
    ret

ClReads:
    .defw 0
ClTime:
    .defs 7                 ; seconds, minutes, hours, day, date, month, year
ClText1:
    .defn "DS1307 on I2C, address $68"
ClNoAckText:
    .defn "No clock acknowledged $D0"
ClRawText:
    .defn "Registers $00-$06, in BCD:"
ClRawNames:
    .defn "se mi ho dy dt mo yr"
ClTimeText:
    .defn "Time  "
ClDateText:
    .defn "Date  "
ClDayText:
    .defn "Day   "
ClDayNote:
    .defn ", Sunday=1: "
ClChText:
    .defn "CH, $00 bit 7: "
ClRunning:
    .defn "0, running"
ClHalted:
    .defn "1, halted "
Cl24Text:
    .defn "Hours, $02 bit 6: 0, 24h"
Cl12Text:
    .defn "Hours, $02 bit 6: 1, 12h"
ClReadsText:
    .defn "Reads:"
ClAmText:
    .defn " AM"
ClPmText:
    .defn " PM"
ClBlank3:
    .defn "   "
ClBlank9:
    .defn "         "

ClMonths:
    .defb 12
    .defw ClJan, ClFeb, ClMar, ClApr, ClMay, ClJun
    .defw ClJul, ClAug, ClSep, ClOct, ClNov, ClDec
ClJan: .defn "January"
ClFeb: .defn "February"
ClMar: .defn "March"
ClApr: .defn "April"
ClMay: .defn "May"
ClJun: .defn "June"
ClJul: .defn "July"
ClAug: .defn "August"
ClSep: .defn "September"
ClOct: .defn "October"
ClNov: .defn "November"
ClDec: .defn "December"

ClDays:
    .defb 7
    .defw ClSun, ClMon, ClTue, ClWed, ClThu, ClFri, ClSat
ClSun: .defn "Sunday"
ClMon: .defn "Monday"
ClTue: .defn "Tuesday"
ClWed: .defn "Wednesday"
ClThu: .defn "Thursday"
ClFri: .defn "Friday"
ClSat: .defn "Saturday"

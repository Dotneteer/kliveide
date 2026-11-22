; Demo: Serial Echo
; Chapter: UARTs (content/next-uart.mdx), "A frame on the wire", "The baud rate" and "Two
; buffers and the status"
;
; Sends "Hello, Next!" through UART 1, whose pins are not connected to the Pi while NextReg $A0
; is untouched, so no device receives it. Echoes the UART's own view back on the screen: the
; select and frame registers, the frame of "H" bit by bit, the status bits before, during and
; after sending, and how long the 12 frames take at three baud rates, timed by a polling loop
; at 3.5 MHz, next to what the prescaler says.
; Changes UART 1's prescaler and frame register and leaves them at 115,200 baud, 8N1, the
; values after power-on; selects UART 0 again. Changes NextReg $07 and sets 28 MHz again.

SerialEchoTitle:
    .defn "Serial Echo"

SeTableRow: .equ 17         ; the first row of the timing table

SerialEcho:
    ld de,$0000
    ld c,$78
    ld hl,SerialEchoTitle
    call PrintText
    ld c,$38
    ld de,$0100
    ld hl,SeText1
    call PrintText
    ld de,$0200
    ld hl,SeText2
    call PrintText

    ; UART 1, its prescaler's top bits 0, then empty both buffers and set 8N1
    ld bc,$153B
    ld a,%01010000          ; bit 6: UART 1; bit 4: bits 2-0 are prescaler bits 16-14
    out (c),a
    ld b,$16                ; $163B: the frame
    ld a,$98                ; reset the UART and empty its buffers...
    out (c),a
    ld a,$18                ; ...then let it go: 8 data bits, no parity, one stop bit
    out (c),a

    ; Time the message at each rate; the last, 115,200 baud, is the one the UART keeps
    ld ix,SeRates
    ld d,SeTableRow
SeEachRate:
    push de
    ld l,(ix+0)
    ld h,(ix+1)
    call SeMeasure          ; HL: the time in microseconds
    pop de
    push hl
    ld e,0
    ld c,$38
    ld l,(ix+2)
    ld h,(ix+3)
    call PrintText          ; the baud rate
    inc e
    ld l,(ix+0)
    ld h,(ix+1)
    call PrintNum16         ; the prescaler
    inc e
    pop hl
    call PrintNum16         ; measured
    inc e
    ld l,(ix+4)
    ld h,(ix+5)
    call PrintText          ; what the prescaler says
    ld bc,6
    add ix,bc
    inc d
    ld a,d
    cp SeTableRow + 3
    jr nz,SeEachRate

    ; The registers, read back
    ld de,$0400
    ld c,$38
    ld hl,SeSelectText
    call PrintText
    ld bc,$153B
    in a,(c)                ; bit 6: the UART; bits 2-0: its prescaler bits 16-14
    ld c,$38
    call PrintHex8
    ld hl,SeUart1Text
    call PrintText
    ld de,$0500
    ld hl,SeFrameText
    call PrintText
    ld bc,$163B
    in a,(c)
    ld c,$38
    call PrintHex8
    ld hl,Se8N1Text
    call PrintText

    ; The frame of "H": start bit, eight data bits from bit 0 up, stop bit
    ld de,$0700
    ld hl,SeWireText
    call PrintText
    ld de,$0801
    ld c,$3A                ; red: the start bit
    ld a,$30
    call PrintCharNext
    inc e
    ld c,$38
    ld a,(SeMessage)
    ld b,8
SeFrameBit:
    push bc
    rrca                    ; the next bit into carry, least significant first
    push af
    ld a,$30
    adc a,0                 ; "0" or "1"
    call PrintCharNext
    pop af
    pop bc
    djnz SeFrameBit
    inc e
    ld c,$3A
    ld a,$31                ; the stop bit
    call PrintCharNext
    ld de,$0900
    ld c,$38
    ld hl,SeWireLegend
    call PrintText

    ; The status bits of the last run
    ld de,$0B00
    ld hl,SeStatusHead
    call PrintText
    ld de,$0C00
    ld hl,SeBeforeText
    ld a,(SeStatus0)
    call SeStatusRow
    ld de,$0D00
    ld hl,SeAfterText
    ld a,(SeStatus1)
    call SeStatusRow
    ld de,$0E00
    ld hl,SeQuietText
    ld a,(SeStatus2)
    call SeStatusRow

    ld de,$1000
    ld hl,SeTableHead
    call PrintText
    ld de,$1500
    ld hl,SeTableNote
    call PrintText

    ld bc,$153B
    xor a                   ; UART 0, as after a reset; its prescaler untouched
    out (c),a
    call WaitForMenu
    ret

; Sets the selected UART's prescaler bits 13-0 to HL
SeSetBaud:
    ld bc,$143B
    ld a,l
    and $7F
    out (c),a               ; bit 7 = 0: bits 6-0
    ld a,l
    rla                     ; bit 7 into carry
    ld a,h
    rla                     ; bits 13-7
    or $80                  ; bit 7 = 1
    out (c),a
    ret

; Sets the prescaler to HL, sends the 12 bytes of SeMessage and polls the status until the line
; is quiet. Returns the time from the first byte in microseconds in HL. Keeps IX.
SeMeasure:
    call SeSetBaud
    ld bc,$133B             ; TX, and the status when read
    in a,(c)
    ld (SeStatus0),a
    di
    nextreg $07,0           ; 3.5 MHz: 56 T-states are 16 us
    ld hl,SeMessage
    ld d,12
SeSend:
    ld a,(hl)
    out (c),a               ; into the transmit buffer
    inc hl
    dec d
    jp nz,SeSend            ; 39 T-states a byte
    in a,(c)
    ld (SeStatus1),a        ; just after the last byte
    ld hl,9                 ; 484 T-states since the first byte: about nine polls
SePoll:
    in a,(c)                ; 12  the status
    bit 4,a                 ;  8  the line is quiet?
    jp nz,SeQuiet           ; 10
    inc hl                  ;  6
    bit 3,h                 ;  8  2,048 polls: give up
    jr z,SePoll             ; 12  56 T-states, 16 us
SeQuiet:
    ld (SeStatus2),a
    nextreg $07,3
    ei
    add hl,hl
    add hl,hl
    add hl,hl
    add hl,hl               ; polls * 16: microseconds
    ret

; Prints row D: the text at HL, then A as eight binary digits, bit 7 first
SeStatusRow:
    push af
    ld e,0
    ld c,$38
    call PrintText
    ld e,19
    pop af
    ld b,8
SeStatusBit:
    push bc
    rlca
    push af
    ld a,$30
    adc a,0
    call PrintCharNext
    pop af
    pop bc
    djnz SeStatusBit
    ret

; Each rate: the prescaler, its baud rate as text, the time of 12 frames, 120 x prescaler / 28 us
SeRates:
    .defw 2917, SeBaud1, SeBook1
    .defw 896, SeBaud2, SeBook2
    .defw 243, SeBaud3, SeBook3

SeStatus0:
    .defb 0
SeStatus1:
    .defb 0
SeStatus2:
    .defb 0
SeMessage:
    .defm "Hello, Next!"
SeText1:
    .defn "UART 1: the Pi's pins are not"
SeText2:
    .defn "connected, so nobody listens."
SeSelectText:
    .defn "Port $153B reads $"
SeUart1Text:
    .defn ": UART 1"
SeFrameText:
    .defn "Port $163B reads $"
Se8N1Text:
    .defn ": 8N1"
SeWireText:
    .defn "Letter H, $48, on the wire:"
SeWireLegend:
    .defn " start, bits 0-7, stop"
SeStatusHead:
    .defn "Status, port $133B 76543210"
SeBeforeText:
    .defn "before sending"
SeAfterText:
    .defn "after the 12 bytes"
SeQuietText:
    .defn "line quiet"
SeTableHead:
    .defn "   baud  pre.  meas  book"
SeTableNote:
    .defn "Time of 12 frames, in us"
SeBaud1: .defn "  9,599"
SeBaud2: .defn " 31,250"
SeBaud3: .defn "115,226"
SeBook1: .defn "12501"
SeBook2: .defn " 3840"
SeBook3: .defn " 1041"

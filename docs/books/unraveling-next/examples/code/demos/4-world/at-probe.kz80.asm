; Demo: AT Probe
; Chapter: Wi-Fi (content/next-wifi.mdx), "Talking in AT"
;
; Sets UART 0 to 115,200 baud, 8N1, empties its buffers, then sends AT and AT+GMR to the Wi-Fi
; module and shows what comes back within half a second of each: the echo, OK, and the
; firmware's versions. Klive has no module behind UART 0, so there it shows that no answer
; came. Sends nothing else: no command that saves a setting (guidelines/examples-plan.md, 2.1).
; Changes UART 0's prescaler and frame register, and leaves them at 115,200 baud, 8N1. Uses
; $C000-$C0FF (bank 0) for the replies.

AtProbeTitle:
    .defn "AT Probe"

AtLastRow:  .equ 22         ; replies stop above this row
AtBuffer:   .equ $C000      ; 256 bytes in bank 0: what came back
AtBufferEnd: .equ AtBuffer + 255 ; the last byte is kept for anything past the end

AtProbe:
    ld de,$0000
    ld c,$78
    ld hl,AtProbeTitle
    call PrintText
    ld de,$0200             ; row 2: row 1 stays empty
    ld c,$38
    ld hl,AtText1
    call PrintText

    ; UART 0 at 115,200 baud: prescaler 243, then empty its buffers and set 8N1
    ld bc,$153B
    ld a,%00010000          ; bit 6 = 0: UART 0; bit 4: bits 2-0 are prescaler bits 16-14
    out (c),a
    ld b,$14                ; $143B
    ld a,243 & $7F          ; bit 7 = 0: prescaler bits 6-0
    out (c),a
    ld a,$80 | (243 >> 7)   ; bit 7 = 1: prescaler bits 13-7
    out (c),a
    ld b,$16                ; $163B: the frame
    ld a,$98                ; reset the UART and empty its buffers...
    out (c),a
    ld a,$18                ; ...then let it go: 8N1
    out (c),a

    ld a,4
    ld (AtRow),a
    ld hl,AtCommand1
    call AtAsk
    ld hl,AtCommand2
    call AtAsk
    call WaitForMenu
    ret

; Shows the command at HL, sends it with CR LF, listens for 25 frames and shows the reply
AtAsk:
    push hl
    ld a,(AtRow)
    ld d,a
    ld e,0
    ld c,$39                ; INK 1: what we send
    ld hl,AtPrompt
    call PrintText
    pop hl
    push hl
    call PrintText
    ld a,d
    inc a
    ld (AtRow),a
    pop hl
    call AtSend
    ld hl,AtCrLf
    call AtSend
    call AtListen
    jp AtShowReply

; Sends the zero-terminated text at HL on UART 0, waiting while the transmit buffer is full
AtSend:
    ld bc,$133B             ; TX, and the status when read
AtSendNext:
    ld a,(hl)
    or a
    ret z                   ; the end of the text
AtSendWait:
    in a,(c)                ; status
    bit 1,a                 ; the TX buffer is full?
    jr nz,AtSendWait
    ld a,(hl)
    out (c),a               ; into the TX buffer
    inc hl
    jr AtSendNext

; Copies what UART 0 receives in the next 25 frames to AtBuffer, and sets AtEnd after it
AtListen:
    ld hl,AtBuffer
    ld d,25                 ; frames to listen: half a second
    ld a,(Frames)
    ld e,a
AtListenLoop:
    ld bc,$133B
    in a,(c)                ; status
    rra                     ; bit 0 into carry: a byte is waiting
    jr nc,AtListenTime
    inc b                   ; $143B: RX
    in a,(c)                ; the oldest byte
    ld (hl),a
    push hl
    ld bc,AtBufferEnd
    or a
    sbc hl,bc
    pop hl
    jr nc,AtListenLoop      ; the buffer is full: keep reading, keep the last byte
    inc hl
    jr AtListenLoop
AtListenTime:
    ld a,(Frames)
    cp e
    jr z,AtListenLoop
    ld e,a                  ; a new frame
    dec d
    jr nz,AtListenLoop
    ld (AtEnd),hl
    ret

; Prints the reply from row AtRow: CR is dropped, LF starts a new row, empty rows are skipped,
; and anything else that is not printable shows as a dot
AtShowReply:
    ld a,(AtRow)
    ld d,a
    ld e,0
    ld hl,(AtEnd)
    ld bc,AtBuffer
    or a
    sbc hl,bc
    jr nz,AtShowStart
    ld c,$3A                ; INK 2
    ld hl,AtNoAnswer
    call PrintText
    jr AtShowNextRow
AtShowStart:
    ld ix,AtBuffer
AtShowLoop:
    push ix
    pop hl
    ld bc,(AtEnd)
    or a
    sbc hl,bc
    jr nc,AtShowDone        ; every byte is shown
    ld c,$38
    ld a,(ix+0)
    inc ix
    cp 13
    jr z,AtShowLoop         ; CR: nothing
    cp 10
    jr z,AtShowLf
    cp 32
    jr c,AtShowDot
    cp 127
    jr c,AtShowChar
AtShowDot:
    ld a,$2E                ; "."
AtShowChar:
    call PrintCharNext
    ld a,e
    cp 32
    jr c,AtShowLoop
    jr AtShowWrap           ; the row is full
AtShowLf:
    ld a,e
    or a
    jr z,AtShowLoop         ; an empty row: skip it
AtShowWrap:
    ld e,0
    inc d
    ld a,d
    cp AtLastRow
    jr c,AtShowLoop
    jr AtShowEnd            ; the screen is full
AtShowDone:
    ld a,e
    or a
    jr z,AtShowEnd
AtShowNextRow:
    inc d
AtShowEnd:
    ld a,d
    ld (AtRow),a
    ret

AtRow:
    .defb 0
AtEnd:
    .defw 0
AtCommand1:
    .defn "AT"
AtCommand2:
    .defn "AT+GMR"
AtCrLf:
    .defb 13, 10, 0
AtPrompt:
    .defn ">> "
AtText1:
    .defn "UART 0: 115,200 baud, 8N1"
AtNoAnswer:
    .defn "(no answer in half a second)"

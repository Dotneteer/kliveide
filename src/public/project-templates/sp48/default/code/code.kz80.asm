Start:
    .model Spectrum48
    .org #7C00
    ld a,2;	      ; upper screen
    call #1601    ; open the channel
    ld hl,Message ; HL points the the message string
NextCh:
    ld a,(hl)     ; get next character
    or a
    jp z,#12a9    ; jump back to main cycle when terminated
    rst #10       ; display character
    inc hl        ; next character
    jr NextCh     ; next loop

Message:
    .dm "\a\x0A\x06" ; AT 10, 6
    .dm "\p\x04"     ; PAPER 4
    .dm "Welcome to Klive IDE"
    .dm "\a\x0B\x08" ; AT 10, 8
    .dm "\p\x04"     ; PAPER 4
    .dm "\b\x01"     ; BRIGH 1
    .dm "(ZX Spectrum 48)"
    .db 0x00         ; terminate
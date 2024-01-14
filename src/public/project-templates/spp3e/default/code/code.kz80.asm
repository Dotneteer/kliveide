Start:
    .model SpectrumP3
    .org #8000
    ld hl,Message ; HL points the the message string
NextCh:
    ld a,(hl)     ; get next character
    cp #ff
    jr z,WaitKey  ; jump when terminated
    rst #10       ; display character
    inc hl        ; next character
    jr NextCh     ; next loop

WaitKey:
    ld a,#ff
    ld (#5c08),a  ; Remove the last key code (LAST-K)
WaitKey2:    
    ld a,(#5c08)
    cp #ff
    jr z,WaitKey2 ; Wait for a new key
    jp #0937

Message:
    .dm "\a\x0A\x06" ; AT 10, 6
    .dm "\p\x04"     ; PAPER 4
    .dm "\b\x00"     ; BRIGH 1
    .dm "Welcome to Klive IDE"
    .dm "\a\x0B\x07" ; AT 10, 7
    .dm "\p\x04"     ; PAPER 4
    .dm "\b\x01"     ; BRIGH 1
    .dm "(ZX Spectrum +2/3)"
    .db 0xff         ; terminate

    device zxspectrum48
    org #8000
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
    defb 0x16, 0x0a, 0x06 ; AT 10,6
    defb 0x11, 0x04       ; PAPER 4
    defm "Welcome to Klive IDE"
    defb 0x16, 0x0b, 0x09 ; AT 11,9
    defm "with SjasmPlus"
    defb 0x16, 0x0c, 0x08 ; AT 12, 8
    defb 0x11, 0x04       ; PAPER 4
    defb 0x13, 0x01       ; BRIGH 1
    defm "(ZX Spectrum 48)"
    defb 0x00             ; terminate
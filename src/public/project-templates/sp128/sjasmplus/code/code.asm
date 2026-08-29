    device zxspectrum128
Start:
    org #8000
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
    jp #2604

Message:
    defb 0x16, 0x0a, 0x06 ; AT 10, 6
    defb 0x11, 0x04       ; PAPER 4
    defb 0x13, 0x00       ; BRIGHT 0
    defm "Welcome to Klive IDE"
    defb 0x16, 0x0b, 0x08 ; AT 11, 8
    defb 0x11, 0x04       ; PAPER 4
    defb 0x13, 0x01       ; BRIGHT 1
    defm "(ZX Spectrum 128)"
    defb 0xff             ; terminate

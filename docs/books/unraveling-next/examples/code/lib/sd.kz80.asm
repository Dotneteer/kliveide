; SD card 0 over SPI: starting the card and reading one sector. Read-only.
;
; This is the only file that touches ports $E7 (SPI chip select) and $EB (SPI data); see the
; storage rules in guidelines/examples-plan.md, section 2.1. $E7 is written only with $FE (select
; SD card 0) and $FF (deselect everything), and every routine ends with $FF. Commands go out
; only through SdCommand, which refuses any first byte that is not on SdAllowed: no write, no
; erase, no lock. The host never sends the data token $FE, which starts a write.
;
; Port $EB needs 16 T-states between two accesses (content/next-storage.mdx, "One byte, sixteen
; clocks"): commands go out with OTIR, data comes in with INIR, and no two lone INs are adjacent.

; Starts SD card 0: 80 clocks with nothing selected, then CMD0, CMD8, CMD55 + ACMD41 until the
; card is ready (one frame between tries, interrupts must be on), and CMD58 for the OCR. Fills
; the Sd... variables below. Returns carry set if the card failed, with SdStep naming the
; command. Uses A, BC, DE, HL.
SdStart:
    ld a,$FF
    ld (SdR1Cmd0),a
    ld (SdR1Cmd8),a
    ld (SdR1Acmd41),a
    xor a
    ld (SdTries),a
    ld (SdHighCap),a
    ld a,$FF
    out ($E7),a             ; nothing selected
    ld bc,$0AEB             ; ten bytes of $FF: 80 clocks
    ld a,$FF
SdWake:
    out (c),a
    djnz SdWake
    ld a,$FE
    out ($E7),a             ; select SD card 0

    ld a,0
    ld (SdStep),a
    ld hl,SdCmd0            ; reset: the card answers $01, idle
    call SdCommand
    ld (SdR1Cmd0),a
    jr c,SdFail
    cp $01
    jr nz,SdFail

    ld a,1
    ld (SdStep),a
    ld hl,SdCmd8            ; interface condition: a version 2 card echoes $01AA
    call SdCommand
    ld (SdR1Cmd8),a
    jr c,SdFail
    bit 2,a
    jr z,SdCmd8Known
    xor a                   ; an illegal command: an old card, which cannot be high capacity
    ld (SdAcmd41+1),a
    jr SdInit
SdCmd8Known:
    ld hl,SdR7
    ld b,4
    inir                    ; the rest of the answer: voltage and check pattern
    ld a,$40                ; we can handle a high-capacity card
    ld (SdAcmd41+1),a

SdInit:
    ld a,2
    ld (SdStep),a
SdInitTry:
    ld a,(SdTries)
    inc a
    ld (SdTries),a
    ld hl,SdCmd55           ; the next command is an application command
    call SdCommand
    jr c,SdFail
    ld hl,SdAcmd41          ; start up: $01 while busy, $00 when ready
    call SdCommand
    ld (SdR1Acmd41),a
    jr c,SdFail
    or a
    jr z,SdReady
    cp $01
    jr nz,SdFail
    halt                    ; give the card a frame
    ld a,(SdTries)
    cp 250                  ; about five seconds
    jr c,SdInitTry
    jr SdFail

SdReady:
    ld a,3
    ld (SdStep),a
    ld hl,SdCmd58           ; read the OCR
    call SdCommand
    jr c,SdFail
    or a
    jr nz,SdFail
    ld hl,SdOcr
    ld b,4
    inir                    ; OCR bits 31-0
    ld a,(SdOcr)
    and %01000000           ; bit 30, CCS: a high-capacity card, addressed in sectors
    ld (SdHighCap),a
    jr SdDone

; Every routine leaves through here: nothing selected, and carry as it was set
SdFail:
    scf
SdDone:
    push af
    ld a,$FF
    out ($E7),a             ; nothing selected
    pop af
    ret

; Reads sector DE (0-65535) of SD card 0 to the 512 bytes at HL. The card must be started.
; Returns carry set if it failed, with SdStep = 4. Uses A, BC, DE, HL.
SdReadSector:
    push hl
    ld hl,SdCmd17+1
    ld (hl),0               ; argument bits 31-24
    inc hl
    ld a,(SdHighCap)
    or a
    jr z,SdByteAddress
    ld (hl),0               ; bits 23-16
    inc hl
    ld (hl),d               ; bits 15-8
    inc hl
    ld (hl),e               ; bits 7-0: the sector number
    jr SdReadSend
SdByteAddress:
    ld a,e                  ; a standard-capacity card wants sector * 512
    add a,a
    ld c,a                  ; bits 15-8
    ld a,d
    rla
    ld b,a                  ; bits 23-16
    ld a,0
    rla                     ; bits 31-24
    dec hl
    ld (hl),a
    inc hl
    ld (hl),b
    inc hl
    ld (hl),c
    inc hl
    ld (hl),0
SdReadSend:
    ld a,4
    ld (SdStep),a
    ld a,$FE
    out ($E7),a             ; select SD card 0
    ld hl,SdCmd17           ; read a single block
    call SdCommand
    pop hl
    jr c,SdFail
    or a
    jr nz,SdFail            ; R1 not 0: an error
    ld de,0                 ; at most 65,536 polls for the token
SdToken:
    in a,(c)                ; $FF while the card fetches the sector
    cp $FE                  ; the data token
    jr z,SdData
    dec de
    ld a,d
    or e
    jr nz,SdToken
    jr SdFail
SdData:
    ld b,0
    inir                    ; bytes 0-255
    inir                    ; bytes 256-511
    in a,(c)                ; CRC, high byte
    nop                     ; keep 16 T-states apart
    in a,(c)                ; CRC, low byte
    or a                    ; carry clear: done
    jr SdDone

; Sends the six-byte command at HL to the selected card and waits for its R1. Returns R1 in A,
; BC = $00EB, carry set when the card did not answer or the command is not on SdAllowed.
SdCommand:
    ld a,(hl)
    push hl
    ld hl,SdAllowed
    ld b,SdAllowedEnd - SdAllowed
SdCheck:
    cp (hl)
    jr z,SdCheckOk
    inc hl
    djnz SdCheck
    pop hl
    ld a,$FF                ; refused: no byte of it is sent
    scf
    ret
SdCheckOk:
    pop hl
    ld bc,$06EB             ; six bytes to the SPI data port
    ld a,$FF
    out (c),a               ; one idle byte first, to let the card finish
    nop
    otir
    nop                     ; keep 16 T-states after the last byte
    ld e,16                 ; R1 comes within eight bytes; wait a little longer
SdR1:
    in a,(c)                ; $FF until R1 comes
    cp $FF
    jr nz,SdR1Got
    dec e
    jr nz,SdR1
    scf
    ret
SdR1Got:
    or a                    ; carry clear: an answer
    ret

; The only commands SdCommand sends: their first bytes
SdAllowed:
    .defb $40               ; CMD0, go to the idle state
    .defb $48               ; CMD8, interface condition
    .defb $77               ; CMD55, an application command follows
    .defb $69               ; ACMD41, start up
    .defb $7A               ; CMD58, read the OCR
    .defb $51               ; CMD17, read one sector
SdAllowedEnd:

; The commands: $40 + number, a 32-bit argument (most significant byte first), CRC
SdCmd0:   .defb $40, 0, 0, 0, 0, $95
SdCmd8:   .defb $48, 0, 0, $01, $AA, $87    ; 2.7-3.6 V, check pattern $AA
SdCmd55:  .defb $77, 0, 0, 0, 0, $01
SdAcmd41: .defb $69, $40, 0, 0, 0, $01      ; byte 1 bit 6: we can handle high capacity
SdCmd58:  .defb $7A, 0, 0, 0, 0, $01
SdCmd17:  .defb $51, 0, 0, 0, 0, $01        ; the sector goes in bytes 1-4

; What the card answered
SdStep:     .defb 0         ; the command that failed: 0 CMD0, 1 CMD8, 2 ACMD41, 3 CMD58, 4 CMD17
SdR1Cmd0:   .defb $FF
SdR1Cmd8:   .defb $FF
SdR1Acmd41: .defb $FF
SdTries:    .defb 0         ; how many times ACMD41 was sent
SdR7:       .defs 4         ; CMD8's answer after R1
SdOcr:      .defs 4         ; the OCR, bits 31-24 first
SdHighCap:  .defb 0         ; not 0: SDHC or larger, addressed in sectors

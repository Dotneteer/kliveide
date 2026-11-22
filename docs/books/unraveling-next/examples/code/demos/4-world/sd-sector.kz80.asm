; Demo: SD Sector
; Chapter: Storage (content/next-storage.mdx), "Talking to an SD card"
;
; Starts SD card 0 over SPI (CMD0, CMD8, CMD55 + ACMD41, CMD58), reads sector 0 with CMD17 and
; shows it as hex and text, 128 bytes a page: keys 1-4 choose the page, any other key returns to
; the menu. Page 4 holds the partition table (cyan) and the $55 $AA signature (yellow) of an
; MBR. Read-only: every command goes through lib/sd.kz80.asm, which sends none that writes.
; Changes NextReg $07 for the card's start-up and sets 28 MHz again; deselects the card. Uses
; $C000-$C1FF (bank 0) for the sector.

SdSectorTitle:
    .defn "SD Sector"

SsFirstRow: .equ 5          ; the first row of hex
SsBuffer:   .equ $C000      ; 512 bytes in bank 0: the sector

SdSector:
    ld de,$0000
    ld c,$78
    ld hl,SdSectorTitle
    call PrintText
    ld de,$0100             ; row 1
    ld c,$38
    ld hl,SsText1
    call PrintText

    ; Start the card and read sector 0 at 3.5 MHz, the slowest SPI clock the Next has
    nextreg $07,0
    call SdStart
    jr c,SsFailed
    ld de,0                 ; sector 0
    ld hl,SsBuffer
    call SdReadSector
SsFailed:
    push af
    nextreg $07,3
    call SsShowStart        ; what the card answered
    pop af
    jr nc,SsRead

    ld de,$0400             ; row 4
    ld c,$3A                ; PAPER 7, INK 2
    ld hl,SsNoAnswer
    call PrintText
    ld a,(SdStep)
    add a,a
    ld hl,SsSteps
    add hl,a
    ld a,(hl)
    inc hl
    ld h,(hl)
    ld l,a
    call PrintText          ; the command that failed
    call WaitForMenu
    ret

SsRead:
    ld de,$1600             ; row 22
    ld c,$28                ; PAPER 5
    ld hl,SsLegend1
    call PrintText
    inc e
    ld c,$30                ; PAPER 6
    ld hl,SsLegend2
    call PrintText
    ld de,$1700             ; row 23
    ld c,$68
    ld hl,SsFooter
    call PrintText
    ld a,3                  ; page 4 first: the end of the sector
SsPage:
    call SsDrawPage
    call WaitKey
    sub $31                 ; "1"
    cp 4
    jr c,SsPage             ; keys 1-4: another page
    jp WaitNoKey

; Prints rows 2 and 3: the R1 of CMD0, CMD8 and ACMD41, the OCR and the number of tries
SsShowStart:
    ld de,$0200
    ld c,$38
    ld hl,SsR1Text
    call PrintText
    ld a,(SdR1Cmd0)
    call PrintHex8
    ld hl,SsCmd8Text
    call PrintText
    ld a,(SdR1Cmd8)
    call PrintHex8
    ld hl,SsAcmd41Text
    call PrintText
    ld a,(SdR1Acmd41)
    call PrintHex8
    ld de,$0300
    ld hl,SsOcrText
    call PrintText
    ld hl,SdOcr
    ld b,4
SsShowOcr:
    push bc
    ld a,(hl)
    push hl
    call PrintHex8
    pop hl
    inc hl
    pop bc
    djnz SsShowOcr
    ld hl,SsSdhcText
    ld a,(SdHighCap)
    or a
    jr nz,SsShowCap
    ld hl,SsSdscText
SsShowCap:
    call PrintText
    ld hl,SsTriesText
    call PrintText
    ld a,(SdTries)
    ld l,a
    ld h,0
    jp PrintNum16           ; how many times ACMD41 was sent

; Draws page A (0-3): 16 rows of 8 bytes, each with its offset, its hex and its text
SsDrawPage:
    ld l,0
    srl a
    rr l
    ld h,a                  ; HL: page * 128
    ld (SsOffset),hl
    ld d,SsFirstRow
SsDrawRow:
    ld e,0
    ld c,$38
    ld a,(SsOffset+1)
    call PrintHex8
    ld a,(SsOffset)
    call PrintHex8          ; the offset in the sector
    inc e
    ld b,8
SsDrawHex:
    push bc
    call SsByte
    call PrintHex8
    pop bc
    djnz SsDrawHex
    ld hl,(SsOffset)
    add hl,-8               ; back to the row's first byte
    ld (SsOffset),hl
    inc e
    ld b,8
SsDrawText:
    push bc
    call SsByte
    cp 32
    jr c,SsDot
    cp 128
    jr c,SsPrintable
SsDot:
    ld a,$2E                ; "."
SsPrintable:
    call PrintCharNext
    pop bc
    djnz SsDrawText
    inc d
    ld a,d
    cp SsFirstRow + 16
    jr nz,SsDrawRow
    ret

; Returns the byte at SsOffset in A and its attribute in C, and moves SsOffset on. Keeps DE.
; Odd bytes are blue; the partition table ($1BE-$1FD) is on cyan, the signature on yellow.
SsByte:
    ld hl,(SsOffset)
    ld c,$38                ; PAPER 7, INK 0
    bit 0,l
    jr z,SsByteArea
    ld c,$39                ; INK 1
SsByteArea:
    ld a,h
    or a
    jr z,SsByteGet          ; $000-$0FF
    ld a,l
    cp $BE
    jr c,SsByteGet
    ld a,c
    xor $10                 ; PAPER 7 to PAPER 5
    ld c,a
    ld a,l
    cp $FE
    jr c,SsByteGet
    ld a,c
    xor $18                 ; PAPER 5 to PAPER 6
    ld c,a
SsByteGet:
    push hl
    inc hl
    ld (SsOffset),hl
    pop hl
    push de
    ld de,SsBuffer
    add hl,de
    pop de
    ld a,(hl)
    ret

SsOffset:
    .defw 0
SsSteps:
    .defw SsStep0, SsStep1, SsStep2, SsStep3, SsStep4
SsStep0: .defn "CMD0"
SsStep1: .defn "CMD8"
SsStep2: .defn "ACMD41"
SsStep3: .defn "CMD58"
SsStep4: .defn "CMD17"
SsText1:
    .defn "SD card 0, sector 0, read-only"
SsR1Text:
    .defn "R1: CMD0 "
SsCmd8Text:
    .defn " CMD8 "
SsAcmd41Text:
    .defn " ACMD41 "
SsOcrText:
    .defn "OCR "
SsSdhcText:
    .defn " SDHC "
SsSdscText:
    .defn " SDSC "
SsTriesText:
    .defn "tries:"
SsNoAnswer:
    .defn "The card failed at "
SsLegend1:
    .defn "partition table"
SsLegend2:
    .defn "signature"
SsFooter:
    .defn "1-4: page    other key: menu"

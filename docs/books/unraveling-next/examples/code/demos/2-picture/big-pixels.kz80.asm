; Demo: Big Pixels
; Chapter: LoRes and Radastan (content/next-display/lores.mdx)
;
; A 128 x 96 picture of 2 x 2-dot pixels in the ULA's place. Key 1 shows it in LoRes, a byte a
; pixel, in two halves of bank 5 ($4000 and $6000), with every entry of the ULA's second palette
; set to its own index as RRRGGGBB. Key 2 shows it in Radastan, 4 bits a pixel in one 6K block at
; $4000, with 16 colours in entries 0-15. Key 3 starts or stops the scroll: NextRegs $32 and $33
; move one dot and one line a frame, half a pixel. The text is drawn into the picture, so it
; scrolls with it. Any other key returns to the menu.
; Changes NextRegs $15, $32, $33, $40-$44 and $6A and the ULA's second palette; puts them back.
; Uses UmSavePalette, UmRestorePalette and UmInks from ULA Modes.

BigPixelsTitle:
    .defn "Big Pixels"

BigPixels:
    ReadNextReg($15)
    ld (BpOld15),a
    ReadNextReg($32)
    ld (BpOld32),a
    ReadNextReg($33)
    ld (BpOld33),a
    ReadNextReg($43)
    ld (BpOld43),a
    ReadNextReg($6A)
    ld (BpOld6A),a
    call UmSavePalette
    xor a
    ld (BpScroll),a
    ld (BpX),a
    ld (BpY),a
    nextreg $32,a
    nextreg $33,a
    call BpShow             ; LoRes first
    ReadNextReg($15)
    or %10000000            ; bit 7: LoRes on, in the ULA's place
    nextreg $15,a
    call WaitNoKey          ; the menu's key may still be down

BpFrame:
    halt
    ld a,(BpScroll)
    or a
    jr z,BpKeys
    ld a,(BpX)
    inc a                   ; one dot across: half a pixel; wraps at 256
    ld (BpX),a
    nextreg $32,a
    ld a,(BpY)
    inc a                   ; one line down: half a pixel; wraps at 192
    cp 192
    jr c,BpYOk
    xor a
BpYOk:
    ld (BpY),a
    nextreg $33,a
BpKeys:
    call ScanKeys
    cp $FF
    jr z,BpFrame            ; no key
    ld hl,KeyChars
    add hl,a
    ld a,(hl)
    or a
    jr z,BpFrame            ; a shift key alone
    push af
    call WaitNoKey
    pop af
    sub $31                 ; "1"
    cp 2
    jr nc,BpNotMode
    call BpShow             ; 0: LoRes, 1: Radastan
    jr BpFrame
BpNotMode:
    cp 2
    jr nz,BpDone            ; not 1-3: back to the menu
    ld a,(BpScroll)
    cpl
    ld (BpScroll),a
    or a
    jr nz,BpFrame
    ld (BpX),a              ; stopped: back to no scroll, where the text can be read
    ld (BpY),a
    nextreg $32,a
    nextreg $33,a
    jr BpFrame

    ; Put everything back
BpDone:
    ld a,(BpOld15)
    nextreg $15,a
    ld a,(BpOld6A)
    nextreg $6A,a
    ld a,(BpOld32)
    nextreg $32,a
    ld a,(BpOld33)
    nextreg $33,a
    call UmRestorePalette
    ld a,(BpOld43)
    nextreg $43,a
    jp WaitNoKey

; Shows the picture in mode A: 0 LoRes, 1 Radastan
BpShow:
    ld (BpMode),a
    nextreg $43,%01000000   ; write the ULA's second palette
    nextreg $40,0
    or a
    jr nz,BpShowRadastan
BpIndex:                    ; LoRes: entry n is the colour n, so a byte is its own colour
    nextreg $41,a
    inc a
    jr nz,BpIndex
    nextreg $6A,0           ; LoRes, palette offset 0
    ld hl,BpLoResText
    jr BpShowDraw
BpShowRadastan:
    ld hl,UmInks            ; Radastan: 16 colours in entries 0-15
    ld b,16
BpInk:
    ld a,(hl)
    nextreg $41,a
    inc hl
    djnz BpInk
    nextreg $6A,%00100000   ; bit 5: Radastan; palette offset 0
    ld hl,BpRadastanText
BpShowDraw:
    nextreg $43,%00000010   ; show the ULA's second palette
    push hl
    ld d,0                  ; the picture: D is y (0-95), E is x (0-127)
BpPictureRow:
    ld e,0
BpPictureDot:
    call BpColour
    call BpPlot
    inc e
    bit 7,e
    jr z,BpPictureDot
    inc d
    ld a,d
    cp 96
    jr nz,BpPictureRow
    pop hl
    ld d,0
    call BpText
    ld d,8
    call BpText
    ld hl,BpKeysText
    ld d,72
    call BpText
    ld d,80
    call BpText
    ld d,88
    jp BpText

; The colour of pixel (E, D) in A: white grid lines every 16 pixels; between them, in LoRes, red
; from x, green from y and blue along the diagonal; in Radastan, bands of the 16 colours.
BpColour:
    ld a,e
    and 15
    jr z,BpWhite
    ld a,d
    and 15
    jr z,BpWhite
    ld a,(BpMode)
    or a
    jr nz,BpColourRadastan
    ld a,e
    add a,a
    and $E0                 ; red: x / 16
    ld c,a
    ld a,d
    rrca
    rrca
    and $1C                 ; green: y / 16
    or c
    ld c,a
    ld a,e
    add a,d
    swapnib
    and 3                   ; blue: (x + y) / 16
    or c
    ret
BpColourRadastan:
    ld a,d
    swapnib
    and 15
    ld c,a                  ; y / 16
    ld a,e
    rrca
    rrca
    rrca
    add a,c                 ; + x / 8
    and 15
    ret

; White in the current mode: colour $FF in LoRes, colour 15 in Radastan
BpWhite:
    ld a,(BpMode)
    or a
    ld a,$FF
    ret z
    ld a,15
    ret

; Plots pixel (E, D) in colour A. Keeps DE. Uses BC, HL.
BpPlot:
    ld c,a
    ld a,(BpMode)
    or a
    jr nz,BpPlotRadastan
    ld a,d                  ; LoRes: rows 0-47 at $4000, rows 48-95 at $6000, 128 bytes a row
    cp 48
    jr c,BpPlotTop
    add a,16                ; $6000 + 128 * (y - 48) = $4000 + 128 * (y + 16)
BpPlotTop:
    srl a
    ld h,a
    ld a,0
    rra                     ; bit 7: the odd row's half of the 256 bytes
    or e
    ld l,a
    ld a,h
    or $40
    ld h,a
    ld (hl),c
    ret
BpPlotRadastan:
    ld l,d                  ; Radastan: $4000 + 64 * y + x / 2, left pixel in the high nibble
    ld h,0
    add hl,hl
    add hl,hl
    add hl,hl
    add hl,hl
    add hl,hl
    add hl,hl
    ld a,e
    srl a
    add hl,a
    ld a,h
    or $40
    ld h,a
    ld a,c
    bit 0,e
    jr nz,BpPlotRight
    swapnib
    ld c,a
    ld a,(hl)
    and $0F
    or c
    ld (hl),a
    ret
BpPlotRight:
    ld c,a
    ld a,(hl)
    and $F0
    or c
    ld (hl),a
    ret

; Draws the text at HL into the picture, 8 x 8 pixels a character, from pixel row D, x = 0,
; white on black. Returns HL after its zero.
BpText:
    ld e,0
BpTextChar:
    ld a,(hl)
    inc hl
    or a
    ret z
    push hl
    ld l,a
    ld h,0
    add hl,hl
    add hl,hl
    add hl,hl
    add hl,$3C00            ; the character's 8 bytes in the ROM
    push de
    ld b,8
BpTextLine:
    push bc
    push de
    ld c,(hl)
    ld b,8
BpTextDot:
    sla c
    ld a,0                  ; black, without touching the carry
    jr nc,BpTextPaper
    call BpWhite
BpTextPaper:
    push bc
    push hl
    call BpPlot
    pop hl
    pop bc
    inc e
    djnz BpTextDot
    pop de
    pop bc
    inc hl
    inc d
    djnz BpTextLine
    pop de
    pop hl
    ld a,e
    add a,8
    ld e,a
    jr BpTextChar

BpMode:
    .defb 0
BpScroll:
    .defb 0                 ; $FF while scrolling
BpX:
    .defb 0
BpY:
    .defb 0
BpOld15:
    .defb 0
BpOld32:
    .defb 0
BpOld33:
    .defb 0
BpOld43:
    .defb 0
BpOld6A:
    .defb 0

; Two lines at the top, three at the bottom: 16 characters fill a row
BpLoResText:
    .defn "LoRes 128x96"
    .defn "1 byte a pixel"
BpRadastanText:
    .defn "Radastan 128x96"
    .defn "4 bits a pixel"
BpKeysText:
    .defn "Keys 1, 2: mode"
    .defn "Key 3: scroll"
    .defn "Other keys: menu"

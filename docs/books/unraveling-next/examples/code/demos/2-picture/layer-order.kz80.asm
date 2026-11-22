; Demo: Layer Order
; Chapter: Putting It Together (content/next-display/composition.mdx)
;
; Three layers that overlap: the ULA's red panel (U), a green block on Layer 2 (L) and three
; yellow sprites (S), one on the panel, one where panel and block overlap, one on the block.
; Keys 1-6 write the six orders, 000-101, into NextReg $15 bits 4-2; keys 7 and 8 write the two
; blend modes, 110 and 111, with the ULA as the blend source (NextReg $68 bits 6-5 = 00). Black is
; the transparent colour (NextReg $14), so the ULA's black paper and border let the layers below
; show, and the fallback colour (NextReg $4A) is a dark blue. In the blend modes the ULA shows only
; through Layer 2, so Layer 2 draws grey strips behind the text there. Any other key returns to
; the menu.
; Changes NextRegs $12, $14, $15, $4A, $56 and $70, port $123B, the border, sprites 0-2 and
; sprite pattern 0; puts them back, and leaves every sprite invisible.

LayerOrderTitle:
    .defn "Layer Order"

LoL2Page:   .equ 16         ; Layer 2 in banks 8-10: 8K pages 16-21

LayerOrder:
    ReadNextReg($12)
    ld (LoOld12),a
    ReadNextReg($14)
    ld (LoOld14),a
    ReadNextReg($15)
    ld (LoOld15),a
    ReadNextReg($4A)
    ld (LoOld4A),a
    ReadNextReg($56)
    ld (LoOld56),a
    ReadNextReg($70)
    ld (LoOld70),a
    nextreg $12,LoL2Page / 2 ; Layer 2 starts in bank 8
    nextreg $70,0           ; 256 x 192
    nextreg $14,$00         ; black is transparent
    nextreg $4A,$02         ; the fallback colour: dark blue
    xor a
    out ($FE),a             ; a black border: transparent too

    ; The ULA: black paper, white text, and a red panel in rows 6-14, columns 2-13
    ld hl,$5800
    ld de,$5801
    ld bc,767
    ld (hl),$47             ; BRIGHT, PAPER 0, INK 7
    ldir
    ld hl,LoTexts
LoTextLine:
    ld e,(hl)               ; the column
    inc hl
    ld d,(hl)               ; the row, or $FF at the end
    inc hl
    ld a,d
    cp $FF
    jr z,LoPanel
    ld c,$47
    call PrintText
    inc hl
    jr LoTextLine
LoPanel:
    ld hl,$5800 + 6 * 32 + 2
    ld b,9
LoPanelRow:
    push bc
    push hl
    ld b,12
LoPanelCell:
    ld (hl),$57             ; BRIGHT, PAPER 2 (red), INK 7
    inc hl
    djnz LoPanelCell
    pop hl
    add hl,32
    pop bc
    djnz LoPanelRow
    ld de,$0A06             ; row 10, column 6
    ld c,$57
    ld hl,LoUlaText
    call PrintText

    ; Sprites: every one invisible, then pattern 0, a yellow diamond with a black edge
    call LoHideSprites
    ld bc,$303B
    xor a
    out (c),a               ; pattern slot 0
    ld c,$5B
    ld d,0                  ; the pattern's row
LoPatternRow:
    ld e,0                  ; its column
LoPatternDot:
    ld a,d
    call LoDistance
    ld b,a
    ld a,e
    call LoDistance
    add a,b
    cp 7
    ld a,$FC                ; yellow inside
    jr c,LoPatternOut
    ld a,$00                ; a black edge
    jr z,LoPatternOut
    ld a,$E3                ; transparent outside (NextReg $4B)
LoPatternOut:
    out (c),a
    inc e
    bit 4,e
    jr z,LoPatternDot
    inc d
    bit 4,d
    jr z,LoPatternRow
    ld bc,$303B
    xor a
    out (c),a               ; sprite 0
    ld hl,LoSprites
    ld bc,12 * 256 + $57    ; 3 sprites, 4 attribute bytes each, to port $57
    otir

    ld bc,$123B
    ld a,%00000010          ; bit 1: Layer 2 visible
    out (c),a
    xor a                   ; start with SLU
LoKey:
    call LoShow
    call WaitKey            ; A: the key's character
    sub $31                 ; "1"
    cp 8
    jr c,LoKey              ; 1-8: that value of bits 4-2

    ; Put everything back
    call LoHideSprites
    ld bc,$123B
    xor a
    out (c),a               ; Layer 2 hidden
    ld a,(LoOld15)
    nextreg $15,a
    ld a,(LoOld14)
    nextreg $14,a
    ld a,(LoOld4A)
    nextreg $4A,a
    ld a,(LoOld12)
    nextreg $12,a
    ld a,(LoOld70)
    nextreg $70,a
    ld a,7
    out ($FE),a             ; the white border
    jp WaitNoKey

; Shows value A (0-7) of NextReg $15 bits 4-2, with its name on row 2
LoShow:
    push af
    ld e,a
    ld d,LoNameSize
    mul d,e
    ld hl,LoNames
    add hl,de
    ld de,$020E             ; row 2, column 14
    ld c,$47
    call PrintText
    pop af
    push af
    cp 6
    ld a,$00                ; an order: no strips (transparent)
    jr c,LoStrips
    ld a,$B6                ; blending: grey strips, level 5
LoStrips:
    call LoDrawLayer2
    pop af
    add a,a
    add a,a                 ; bits 4-2
    or %00000001            ; bit 0: sprites visible
    nextreg $15,a
    ret

; Draws Layer 2 through MMU slot 6 ($C000): text rows 0-4 and 20-23 in colour A, a green block
; at x 72-207, y 80-151, and black (transparent) elsewhere
LoDrawLayer2:
    ld (LoStrip),a
    ld a,LoL2Page
LoPage:
    nextreg $56,a           ; 32 lines of 256 bytes
    push af
    sub LoL2Page
    rrca
    rrca
    rrca
    ld d,a                  ; the first line of this page
    ld hl,$C000
LoLine:
    ld a,d
    cp 40
    jr c,LoStripLine
    cp 160
    jr nc,LoStripLine
    ld e,0
LoDot:
    ld b,0                  ; black
    ld a,d
    sub 80
    cp 72
    jr nc,LoDotOut          ; not in lines 80-151
    ld a,e
    sub 72
    cp 136
    jr nc,LoDotOut          ; not in columns 72-207
    ld b,$1C                ; green
LoDotOut:
    ld (hl),b
    inc hl
    inc e
    jr nz,LoDot
    jr LoNextLine
LoStripLine:
    ld a,(LoStrip)
    ld b,0                  ; 256 bytes
LoStripDot:
    ld (hl),a
    inc hl
    djnz LoStripDot
LoNextLine:
    inc d
    ld a,h
    cp $E0
    jr nz,LoLine
    pop af
    inc a
    cp LoL2Page + 6
    jr nz,LoPage
    ld a,(LoOld56)
    nextreg $56,a           ; slot 6 back
    ret

; A pattern coordinate (0-15) to its distance from the middle (0-7)
LoDistance:
    bit 3,a
    jr nz,LoDistanceHigh
    xor 7
    ret
LoDistanceHigh:
    and 7
    ret

; Makes all 128 sprites invisible: 512 zero bytes to port $57
LoHideSprites:
    ld bc,$303B
    xor a
    out (c),a               ; sprite 0
    ld c,$57
    ld e,2
    ld b,a
LoHideByte:
    out (c),a
    djnz LoHideByte
    dec e
    jr nz,LoHideByte
    ret

; X, Y, byte 2, byte 3 (visible, pattern 0); the display area starts at sprite position 32, 32
LoSprites:
    .defb 32 + 32, 32 + 64, 0, $80     ; on the panel
    .defb 32 + 84, 32 + 92, 0, $80     ; where the panel and the block overlap
    .defb 32 + 160, 32 + 116, 0, $80   ; on the block

LoStrip:
    .defb 0
LoOld12:
    .defb 0
LoOld14:
    .defb 0
LoOld15:
    .defb 0
LoOld4A:
    .defb 0
LoOld56:
    .defb 0
LoOld70:
    .defb 0

LoUlaText:
    .defn "ULA"
; The column, the row, the text; a row of $FF ends the list
LoTexts:
    .defb 0, 0
    .defn "Layer Order"
    .defb 0, 2
    .defn "$15 bits 4-2:"
    .defb 0, 4
    .defn "U: red  L: green  S: yellow"
    .defb 0, 21
    .defn "1-6: the orders  7, 8: blending"
    .defb 0, 23
    .defn "Other keys: menu"
    .defb 0, $FF

; The names of the eight values, padded to the same length
LoNameSize: .equ 15
LoNames:
    .defn "000 SLU       "
    .defn "001 LSU       "
    .defn "010 SUL       "
    .defn "011 LUS       "
    .defn "100 USL       "
    .defn "101 ULS       "
    .defn "110 add, clamp"
    .defn "111 add, -5   "

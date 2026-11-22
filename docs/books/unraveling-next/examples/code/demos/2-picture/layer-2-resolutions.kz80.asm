; Demo: Layer 2 Resolutions
; Chapter: Layer 2 (content/next-display/layer2.mdx)
;
; Shows Layer 2 in its three resolutions, one key each: 1 for 256 x 192, 2 for 320 x 256 and 3 for
; 640 x 256 (NextReg $70 bits 5-4). The picture starts in bank 8 (NextReg $12) and is drawn through
; MMU slot 6, one 8K page at a time, by the same code in every mode: a 256-byte run is a line in
; 256 x 192 and a column in the wide modes. It is a grid of 16-dot cells, so the 640 x 256 cells are
; half as wide; there each byte is two 4-bit dots, and the palette offset (NextReg $70 bits 3-0) is
; $F. Q, A, O and P scroll it with NextRegs $16, $71 and $17, and it wraps round at its own size.
; The clip window (NextReg $18, its index reset through NextReg $1C) leaves the bottom three text
; rows to the ULA. Any other key returns to the menu.
; Changes NextRegs $12, $16, $17, $18, $56, $69, $70 and $71; puts them back.

Layer2ResolutionsTitle:
    .defn "Layer 2 Resolutions"

L2Slot:     .equ $C000      ; MMU slot 6: the window the picture is drawn through
L2Grid:     .equ $FF        ; the grid's lines: white, or two white 4-bit dots

Layer2Resolutions:
    ReadNextReg($12)
    ld (L2Old12),a
    ReadNextReg($56)
    ld (L2Old56),a
    ReadNextReg($69)
    ld (L2Old69),a
    ReadNextReg($70)
    ld (L2Old70),a
    nextreg $12,8           ; the picture starts in bank 8: pages 16-25
    ld a,(L2Old69)
    or $80
    nextreg $69,a           ; bit 7: Layer 2 on
    ld de,$1600             ; row 22
    ld c,$38
    ld hl,L2KeysText
    call PrintText
    call ShowMenuFooter
    xor a
    call L2SetMode          ; start in 256 x 192
    call WaitNoKey          ; the menu's key may still be down

L2Frame:
    halt
    call ScanKeys
    inc a
    jr z,L2Frame            ; no key
    dec a
    ld hl,KeyChars
    add hl,a
    ld a,(hl)
    or a
    jr z,L2Frame            ; a shift key alone
    ld hl,(L2X)
    ld de,(L2XWrap)
    cp 'O'
    jr z,L2Left
    cp 'P'
    jr z,L2Right
    ld hl,L2Y
    cp 'Q'
    jr z,L2Up
    cp 'A'
    jr z,L2Down
    sub '1'
    cp 3
    jr nc,L2Exit            ; any other key: back to the menu
    call L2SetMode
    call WaitNoKey
    jr L2Frame

L2Left:
    ld a,h
    or l
    jr nz,L2Left1
    ex de,hl                ; from 0 to the width
L2Left1:
    dec hl
    jr L2SetX
L2Right:
    inc hl
    or a
    sbc hl,de
    jr z,L2SetX             ; at the width: back to 0
    add hl,de
L2SetX:
    ld (L2X),hl
    jr L2Scrolled
L2Up:
    ld a,(hl)
    or a
    jr nz,L2Up1
    ld a,(L2YWrap)
L2Up1:
    dec a
    ld (hl),a
    jr L2Scrolled
L2Down:
    ld a,(L2YWrap)
    ld b,a
    ld a,(hl)
    inc a
    cp b
    jr nz,L2Down1
    xor a                   ; at the height: back to 0
L2Down1:
    ld (hl),a
L2Scrolled:
    call L2Scroll
    jr L2Frame

L2Exit:
    nextreg $1C,1           ; bit 0: Layer 2's clip index
    nextreg $18,0
    nextreg $18,255
    nextreg $18,0
    nextreg $18,191
    nextreg $16,0
    nextreg $71,0
    nextreg $17,0
    ld a,(L2Old70)
    nextreg $70,a
    ld a,(L2Old69)
    nextreg $69,a
    ld a,(L2Old12)
    nextreg $12,a
    jp WaitNoKey

; Switches to the mode in A (0: 256 x 192, 1: 320 x 256, 2: 640 x 256), draws its picture and
; scrolls it back to 0, 0
L2SetMode:
    ld (L2Mode),a
    ld hl,L2Modes
    ld e,a
    ld d,L2ModeSize
    mul d,e
    add hl,de
    ld de,L2Shift
    ld bc,L2ModeSize
    ldir                    ; the mode's settings: L2Shift to L2Name
    ld a,(L2Mode)
    swapnib                 ; the mode in bits 5-4
    cp $20
    jr nz,L2SetMode1
    or $0F                  ; 640 x 256: palette offset $F
L2SetMode1:
    nextreg $70,a
    ; The clip window: all but the bottom three text rows
    nextreg $1C,1           ; bit 0: Layer 2's clip index
    nextreg $18,0           ; X1
    ld a,(L2ClipX2)
    nextreg $18,a           ; X2: 255, or 159 in units of two dots
    nextreg $18,0           ; Y1
    ld a,(L2ClipY2)
    nextreg $18,a           ; Y2: 167, or 199 in the wide modes
    ld de,$1500             ; row 21
    ld c,$38
    ld hl,L2Name
    call PrintText
    ld hl,0
    ld (L2X),hl
    xor a
    ld (L2Y),a
    call L2Scroll
    ; fall through to L2Draw

; Draws the picture through MMU slot 6, one 8K page at a time: 32 runs of 256 bytes a page. A run
; is a line in 256 x 192 and a column in the wide modes.
L2Draw:
    ld a,(L2Pages)
    ld b,a
    xor a
L2DrawPage:
    push bc
    ld (L2Page),a
    add a,16                ; bank 8 is pages 16 and 17
    nextreg $56,a
    ld h,high(L2Slot)
L2DrawRun:
    ld a,(L2Page)
    ld e,a
    ld d,32
    mul d,e
    ld a,h
    and $1F
    add de,a                ; DE: the run's number, 0-319
    ld a,(L2Mask)
    and e
    ld c,a                  ; C: 0 on a grid line
    ld a,(L2Shift)
    ld b,a
L2DrawShift:
    srl d
    rr e
    djnz L2DrawShift
    ld d,e                  ; D: the cell's number along the run's coordinate
    ld e,b                  ; E: 0
    ld a,c
    or a
    jr nz,L2DrawCells
    inc e                   ; E: 1 on a grid line
L2DrawCells:
    ld l,0
L2DrawCell:
    ld a,l
    swapnib
    and $0F
    ld c,a                  ; C: the cell's number along the other coordinate
    call L2Colour
    ld (hl),L2Grid          ; the cell's first byte is a grid line
    inc l
    ld b,15
L2DrawByte:
    ld (hl),a
    inc l
    djnz L2DrawByte
    jr nz,L2DrawCell        ; Z from INC L: the run is done
    inc h
    ld a,h
    cp high(L2Slot) + $20
    jr nz,L2DrawRun
    pop bc
    ld a,(L2Page)
    inc a
    djnz L2DrawPage
    ld a,(L2Old56)
    nextreg $56,a           ; slot 6 back
    ret

; The byte for cell D, C, with E = 1 on a grid line: 8-bit modes, a colour from both numbers;
; 640 x 256, a checkerboard of two 4-bit colours
L2Colour:
    ld a,(L2Mode)
    cp 2
    jr z,L2Colour4
    dec e
    inc e
    ld a,L2Grid
    ret nz
    ld a,d
    add a,c
    swapnib
    and $F0
    ld b,a
    ld a,d
    xor c
    and $0F
    or b
    cp $E3                  ; the transparent colour: one step darker
    ret nz
    dec a
    ret
L2Colour4:
    ld a,d
    xor c
    rrca
    ld a,$11                ; two dots of colour $F1, orange
    jr nc,L2Colour4a
    ld a,$CC                ; two dots of colour $FC, yellow
L2Colour4a:
    bit 0,e
    ret z
    or $F0                  ; on a grid line, the left dot is white
    ret

; Writes the scroll offsets and prints them on row 21
L2Scroll:
    ld hl,(L2X)
    ld a,l
    nextreg $16,a           ; X, bits 7-0
    ld a,h
    nextreg $71,a           ; X, bit 8
    ld a,(L2Y)
    nextreg $17,a           ; Y
    ld de,$150B             ; row 21, column 11
    ld c,$38
    ld a,'X'
    call PrintCharNext
    ld hl,(L2X)
    call PrintNum16
    inc e
    ld a,'Y'
    call PrintCharNext
    ld a,(L2Y)
    ld l,a
    ld h,0
    jp PrintNum16

; Each mode's settings, copied to L2Shift-L2Name
L2Modes:
    .defb 4, 15, 6, 255, 167, 192   ; 256 x 192: 6 pages, a cell 16 runs
    .defw 256
    .defn "256 x 192"
    .defb 4, 15, 10, 159, 199, 0    ; 320 x 256: 10 pages; Y wraps at 256
    .defw 320
    .defn "320 x 256"
    .defb 3, 7, 10, 159, 199, 0     ; 640 x 256: a cell 8 runs, two dots a byte
    .defw 320
    .defn "640 x 256"
L2ModeSize: .equ 18

L2Shift:    .defb 0         ; a run's number >> L2Shift: its cell
L2Mask:     .defb 0         ; a run's number & L2Mask = 0: a grid line
L2Pages:    .defb 0         ; 8K pages in the picture
L2ClipX2:   .defb 0
L2ClipY2:   .defb 0
L2YWrap:    .defb 0         ; lines in the picture (0: 256)
L2XWrap:    .defw 0         ; X offsets: 256, or 320 (in steps of two dots at 640 x 256)
L2Name:     .defs 10
L2Mode:     .defb 0
L2Page:     .defb 0
L2X:        .defw 0
L2Y:        .defb 0
L2Old12:    .defb 0
L2Old56:    .defb 0
L2Old69:    .defb 0
L2Old70:    .defb 0
L2KeysText:
    .defn "1-3: mode   Q A O P: scroll"

; Demo: Sprite Swarm
; Chapter: Sprites (content/next-display/sprites.mdx)
;
; Uploads two 8-bit patterns through ports $303B and $5B, both made by code: a ball, and the ROM's
; letter F at twice its size. Then, once a frame, uploads the attributes of 69 sprites through port
; $57 and reads the two flags of port $303B:
;   sprite 0      an anchor, the F; Q, A, O and P move it, R toggles its rotate bit, U its T bit
;                 (composite or unified)
;   sprites 1-3   relative sprites, Fs at (+16, 0), (0, +16) and (+16, +16) from the anchor
;   sprite 4      a rock: the ball at 2x across and down
;   sprites 5-68  the swarm: 64 balls that bounce round the screen; S shows or hides them
; Row 21 lights "Collision" when bit 0 of port $303B is set, and "Too many" for bit 1; reading the
; port clears both. Any other key returns to the menu.
; Changes NextReg $15 (sprites on), sprite patterns 0 and 1 and the attributes of every sprite (all
; hidden at the end), and the ULA's attributes; puts back $15. Keeps the swarm's table in bank 0,
; at $E000-$E17F.

SpriteSwarmTitle:
    .defn "Sprite Swarm"

SsTable:    .equ $E000      ; the swarm: 64 records of SsRecord bytes, in bank 0
SsRecord:   .equ 6          ; X (2 bytes), Y, X step, Y step, palette offset in bits 7-4
SsCount:    .equ 64
SsGlyph:    .equ $3D00 + ('F' - 32) * 8     ; the letter F in the ROM's font
SsBall:     .equ $0F        ; the patterns' colour; each sprite's palette offset changes it
SsClear:    .equ $E3        ; transparent: NextReg $4B after a reset

SpriteSwarm:
    ReadNextReg($15)
    ld (SsOld15),a
    ld de,$0000
    ld c,$78
    ld hl,SpriteSwarmTitle
    call PrintText
    ld hl,$5820             ; text rows 1-20: black paper, the sprites' playfield
    ld de,$5821
    ld bc,20 * 32 - 1
    ld (hl),0
    ldir
    ld de,$1500             ; row 21
    ld c,$38
    ld hl,SsCompositeText
    call PrintText
    ld e,11
    ld hl,SsCollisionText
    call PrintText
    ld e,22
    ld hl,SsTooManyText
    call PrintText
    ld de,$1600             ; row 22
    ld hl,SsKeysText
    call PrintText
    call ShowMenuFooter

    ; The patterns, through port $5B from slot 0: 256 bytes each, row after row
    ld bc,$303B
    xor a
    out (c),a               ; pattern slot 0 (and sprite 0)
    ld hl,SsBallRows        ; pattern 0: a ball, 14 dots across at most
SsBallRow:
    ld a,8
    sub (hl)
    ld c,a                  ; C: transparent dots each side
    ld b,a
    call SsClearDots
    ld a,(hl)
    add a,a
    ld b,a
    ld a,SsBall
SsBallDot:
    out ($5B),a
    djnz SsBallDot
    ld b,c
    call SsClearDots
    inc hl
    ld a,l
    cp low(SsBallRows + 16)
    jr nz,SsBallRow
    ld hl,SsGlyph           ; pattern 1: the F, each dot of the font 2 x 2
    ld d,8
SsFRow:
    ld e,2                  ; each row twice
SsFTwice:
    ld c,(hl)
    ld b,8
SsFDot:
    ld a,SsClear
    sla c
    jr nc,SsFDot1
    ld a,SsBall
SsFDot1:
    out ($5B),a
    out ($5B),a
    djnz SsFDot
    dec e
    jr nz,SsFTwice
    inc hl
    dec d
    jr nz,SsFRow

    ; The swarm: spread out, each with its own steps and palette offset
    ld ix,SsTable
    ld b,0                  ; the sprite's number, i
SsInit:
    ld a,b
    ld e,53
    ld d,a
    mul d,e
    ld a,e
    and $DF                 ; 0-223
    add a,40
    ld (ix+0),a             ; X: 40-263
    ld (ix+1),0
    ld a,b
    ld e,23
    ld d,a
    mul d,e
    ld a,e
    and $7F
    add a,48
    ld (ix+2),a             ; Y: 48-175
    ld a,b
    and 4
    rrca
    rrca
    inc a                   ; 1 or 2
    bit 0,b
    jr z,SsInit1
    neg
SsInit1:
    ld (ix+3),a             ; X step
    ld a,b
    and 8
    rrca
    rrca
    rrca
    inc a
    bit 1,b
    jr z,SsInit2
    neg
SsInit2:
    ld (ix+4),a             ; Y step
    ld a,b
    swapnib
    and $F0
    ld (ix+5),a             ; palette offset: i & 15
    ld de,SsRecord
    add ix,de
    inc b
    ld a,b
    cp SsCount
    jr nz,SsInit

    ld a,(SsOld15)
    or 1
    nextreg $15,a           ; bit 0: sprites on
    call WaitNoKey          ; the menu's key may still be down

SsFrame:
    halt
    call SsUpload
    ld bc,$303B
    in a,(c)                ; bit 0: collision, bit 1: too many; reading clears both
    ld b,a
    ld hl,$5800 + 21 * 32 + 11
    rrc b
    call SsFlag
    ld l,low($5800 + 21 * 32 + 22)
    rrc b
    call SsFlag
    call SsMove

    call ScanKeys
    ld c,0
    inc a
    jr z,SsKey              ; no key
    dec a
    ld hl,KeyChars
    add hl,a
    ld c,(hl)               ; C: the key's character, 0 for a shift key
SsKey:
    ld a,(SsLast)
    ld b,a                  ; B: the key of the last frame
    ld a,c
    ld (SsLast),a
    or a
    jr z,SsFrame
    ld hl,(SsX)
    ld de,-2
    cp 'O'
    jr z,SsMoveX
    ld de,2
    cp 'P'
    jr z,SsMoveX
    ld hl,SsY
    cp 'Q'
    jr z,SsUp
    cp 'A'
    jr z,SsDown
    cp b
    jr z,SsFrame            ; the same key still down: toggle once a press
    ld hl,SsRotate
    ld c,%00000010          ; byte 2 bit 1: rotate
    cp 'R'
    jr z,SsToggle
    ld hl,SsSwarm
    ld c,%10000000          ; byte 3 bit 7: visible
    cp 'S'
    jr z,SsToggle
    cp 'U'
    jr nz,SsExit            ; any other key: back to the menu
    ld a,(SsUnified)
    xor %00100000           ; byte 4 bit 5: T
    ld (SsUnified),a
    ld hl,SsCompositeText
    jr z,SsShowT
    ld hl,SsUnifiedText
SsShowT:
    ld de,$1500
    ld c,$38
    call PrintText
    jr SsNext
SsToggle:
    ld a,(hl)
    xor c
    ld (hl),a
    jr SsNext

SsMoveX:
    add hl,de               ; keep the group inside the playfield: X 48-256
    ld a,l
    dec h
    jr z,SsMoveX256
    cp 48
    jr c,SsNext
    jr SsMoveX1
SsMoveX256:
    or a
    jr nz,SsNext            ; past 256
SsMoveX1:
    inc h
    ld (SsX),hl
    jr SsNext
SsUp:
    ld a,(hl)
    cp 58
    jr c,SsNext             ; Y 56-168
    sub 2
    ld (hl),a
    jr SsNext
SsDown:
    ld a,(hl)
    cp 168
    jr nc,SsNext
    add a,2
    ld (hl),a
    jr SsNext

SsNext:
    jp SsFrame

SsExit:
    ld bc,$303B
    xor a
    out (c),a               ; sprite 0
    ld b,a                  ; 256 x 2 bytes of 0: four for each of the 128 sprites. Byte 3 is
SsHide:                     ; 0: not visible, and no byte 4
    out ($57),a
    out ($57),a
    djnz SsHide
    ld a,(SsOld15)
    nextreg $15,a
    jp WaitNoKey

; Colours the flag's text at HL: red paper if carry, white if not. Keeps B.
SsFlag:
    ld a,$38                ; PAPER 7, INK 0
    jr nc,SsFlag1
    ld a,$50                ; BRIGHT 1, PAPER 2, INK 0
SsFlag1:
    ld c,9
SsFlag2:
    ld (hl),a
    inc hl
    dec c
    jr nz,SsFlag2
    ret

; Writes B transparent dots to port $5B
SsClearDots:
    ld a,SsClear
SsClearDot:
    out ($5B),a
    djnz SsClearDot
    ret

; Uploads the attributes of sprites 0-68 through port $57, from sprite 0
SsUpload:
    ld bc,$303B
    xor a
    out (c),a               ; sprite 0
    ld hl,(SsX)
    ld a,l
    out ($57),a             ; byte 0: X
    ld a,(SsY)
    out ($57),a             ; byte 1: Y
    ld a,(SsRotate)
    or h                    ; bit 0: X8
    or $F0                  ; palette offset $F
    out ($57),a             ; byte 2
    ld a,%11000001          ; visible, E: byte 4 follows, pattern 1
    out ($57),a             ; byte 3
    ld a,(SsUnified)
    out ($57),a             ; byte 4: T, an 8-bit pattern, 1x
    ld hl,SsGroup
    ld b,SsGroupEnd - SsGroup
SsUploadGroup:
    ld a,(hl)
    out ($57),a
    inc hl
    djnz SsUploadGroup
    ld ix,SsTable
    ld de,SsRecord
    ld b,SsCount
SsUploadSwarm:
    ld a,(ix+0)
    out ($57),a             ; byte 0: X
    ld a,(ix+2)
    out ($57),a             ; byte 1: Y
    ld a,(ix+5)
    or (ix+1)
    out ($57),a             ; byte 2: palette offset, X8
    ld a,(SsSwarm)
    out ($57),a             ; byte 3: visible or not, no byte 4, pattern 0
    add ix,de
    djnz SsUploadSwarm
    ret

; Moves the swarm one step and bounces it off the playfield's edges: X 32-272, Y 40-184
SsMove:
    ld ix,SsTable
    ld b,SsCount
SsMoveOne:
    ld e,(ix+0)
    ld d,(ix+1)
    ld a,(ix+3)
    ld l,a
    add a,a
    sbc a,a
    ld h,a                  ; HL: the X step, signed
    add hl,de
    ld (ix+0),l
    ld (ix+1),h
    ld de,272
    bit 7,(ix+3)
    jr z,SsMoveRight
    ld de,33
    or a
    sbc hl,de
    jr nc,SsMoveY           ; still right of 32
    jr SsBounceX
SsMoveRight:
    or a
    sbc hl,de
    jr c,SsMoveY            ; still left of 272
SsBounceX:
    ld a,(ix+3)
    neg
    ld (ix+3),a
SsMoveY:
    ld a,(ix+2)
    add a,(ix+4)
    ld (ix+2),a
    bit 7,(ix+4)
    jr z,SsMoveDown
    cp 41
    jr nc,SsMoveNext        ; still below 40
    jr SsBounceY
SsMoveDown:
    cp 184
    jr c,SsMoveNext         ; still above 184
SsBounceY:
    ld a,(ix+4)
    neg
    ld (ix+4),a
SsMoveNext:
    ld de,SsRecord
    add ix,de
    djnz SsMoveOne
    ret

; Sprites 1-4, five bytes each
SsGroup:
    .defb 16, 0, $E0, %11000001, %01000000  ; relative: +16, 0; offset $E; pattern 1
    .defb 0, 16, $30, %11000001, %01000000  ; relative: 0, +16; offset 3
    .defb 16, 16, $90, %11000001, %01000000 ; relative: +16, +16; offset 9
    .defb 144, 104, $80, %11000000, %00001010   ; the rock: pattern 0, 2x across and down
SsGroupEnd:

; The ball's half-width, row by row
SsBallRows:
    .defb 2, 4, 5, 6, 6, 7, 7, 7, 7, 7, 7, 6, 6, 5, 4, 2

SsX:        .defw 64        ; the anchor's position
SsY:        .defb 64
SsRotate:   .defb 0         ; the anchor's byte 2 bit 1
SsUnified:  .defb 0         ; the anchor's byte 4 bit 5, T
SsSwarm:    .defb $80       ; the swarm's byte 3: visible
SsLast:     .defb 0
SsOld15:    .defb 0
SsCompositeText:
    .defn "Composite"
SsUnifiedText:
    .defn "Unified  "
SsCollisionText:
    .defn "Collision"
SsTooManyText:
    .defn "Too many "
SsKeysText:
    .defn "QAOP:move R:turn U:unify S:swarm"

; Parity probe "pic-raster" (Phase 3): register writes in the middle of a line, as pictures.
; @use timing @picture
; Mode 4 on page 30 (16 stripes, CLUT entry = stripe); page 28 holds the stripes reversed. Every 8th screen
; line (8-184) the line interrupt, entered from HALT, waits (DJNZ rounds, then k NOPs: k = 3 * (line / 8
; MOD 6)) and does one of four things, by group of lines:
;   lines   8-48   border entry 2, then back to 5 after 8 NOPs (DJNZ to reach the right border)
;   lines  56-96   SOFF on, off again 8 NOPs later (in the screen: the black's start and end)
;   lines 104-144  VMPR mode 2 (page 30), mode 4 again 8 NOPs later (plan Q15: the mode-change cell)
;   lines 152-184  VMPR page 28, page 30 again 8 NOPs later (when a page change shows)
ProbeMain:
    call TimingSetup
    ld a,$20 | 30
    out ($FA),a
    ld hl,$0000
    ld bc,$6000
RasFill:
    ld a,l
    and $78
    rrca
    rrca
    rrca
    ld e,a
    add a,a
    add a,a
    add a,a
    add a,a
    or e
    ld (hl),a
    inc hl
    dec bc
    ld a,b
    or c
    jr nz,RasFill
    ld a,$20 | 28
    out ($FA),a
    ld hl,$0000
    ld bc,$6000
RasFill2:
    ld a,l
    and $78
    rrca
    rrca
    rrca
    xor $0F             ; reversed
    ld e,a
    add a,a
    add a,a
    add a,a
    add a,a
    or e
    ld (hl),a
    inc hl
    dec bc
    ld a,b
    or c
    jr nz,RasFill2
    ld a,$1F
    out ($FA),a
    ld e,0
RasClut:
    ld a,e
    add a,a
    add a,a
    add a,a
    add a,e
    add a,3
    and $7F
    ld b,e
    ld c,$F8
    out (c),a
    inc e
    ld a,e
    cp 16
    jr c,RasClut
    ld a,$7E
    out ($FC),a
    ld a,5
    ld (BorderBase),a
    out ($FE),a
    ; --- The sled: 16 NOPs, then JP (IX)
    ld hl,LOOPBUF
    ld b,16
RasNops:
    ld (hl),0
    inc hl
    djnz RasNops
    ld (hl),$DD
    inc hl
    ld (hl),$E9         ; JP (IX)
    ld hl,RasIsr
    ld (VECTOR),hl
    ld a,8
    ld (RasLine),a
    xor a
    ld (Passes),a
    ld a,8
    out (LINE_PORT),a
    ei
RasWait:
    halt
    ld a,(Passes)
    cp 3
    jr c,RasWait
    di
    ld hl,NameDrawn
    ld de,1
    ld bc,0
    call Record
    call WriteResult
    ld a,4
    jr z,RasSignal
    ld a,2
RasSignal:
    ld (BorderBase),a
    out ($FE),a
    ei
RasForever:
    halt
    jr RasForever

RasIsr:
    push af
    in a,(STATUS_PORT)
    rra
    jr c,RasIgnore
    push bc
    push de
    push hl
    push ix
    ld a,(RasLine)
    ld d,a              ; this line
    add a,8
    cp 192
    jr c,RasNextLine
    ld hl,Passes
    inc (hl)
    ld a,8
RasNextLine:
    ld (RasLine),a
    out (LINE_PORT),a
    ; --- The group: line / 8 = 1-6 border, 7-12 SOFF, 13-18 mode, 19-23 page
    ld a,d
    rrca
    rrca
    rrca
    and $1F
    ld e,a              ; line / 8
    ld hl,Groups
RasGroup:
    ld a,e
    cp (hl)             ; the group's last line / 8
    jr c,RasFound
    jr z,RasFound
    inc hl
    inc hl
    inc hl
    inc hl
    jr RasGroup
RasFound:
    inc hl
    ld b,(hl)           ; DJNZ rounds
    inc hl
    ld a,(hl)
    inc hl
    ld h,(hl)
    ld l,a
    push hl
    pop ix              ; the action
    ; --- k = 3 * (line / 8 MOD 6)
    ld a,e
RasMod:
    cp 6
    jr c,RasModDone
    sub 6
    jr RasMod
RasModDone:
    ld c,a
    add a,a
    add a,c
    ld c,a
RasDjnz:
    djnz RasDjnz
    ld b,0
    ld hl,LOOPBUF + 16
    or a
    sbc hl,bc
    jp (hl)
RasDone:
    pop ix
    pop hl
    pop de
    pop bc
RasIgnore:
    pop af
    ei
    reti

; --- Actions (after the sled; each ends with JP RasDone)
ActBorder:
    ld a,2
    out ($FE),a
    nop
    nop
    nop
    nop
    nop
    nop
    nop
    nop
    ld a,(BorderBase)
    out ($FE),a
    jp RasDone
ActSoff:
    ld a,(BorderBase)
    or $80
    out ($FE),a
    nop
    nop
    nop
    nop
    nop
    nop
    nop
    nop
    ld a,(BorderBase)
    out ($FE),a
    jp RasDone
ActMode:
    ld a,$3E            ; mode 2, page 30
    out ($FC),a
    nop
    nop
    nop
    nop
    nop
    nop
    nop
    nop
    ld a,$7E
    out ($FC),a
    jp RasDone
ActPage:
    ld a,$7C            ; mode 4, page 28
    out ($FC),a
    nop
    nop
    nop
    nop
    nop
    nop
    nop
    nop
    ld a,$7E
    out ($FC),a
    jp RasDone

; --- Groups: last line / 8, DJNZ rounds, action
Groups:
    .defb 6, 30
    .defw ActBorder
    .defb 12, 6
    .defw ActSoff
    .defb 18, 6
    .defw ActMode
    .defb 23, 6
    .defw ActPage

RasLine:    .defb 0
Passes:     .defb 0
BorderBase: .defb 0
NameDrawn:  .defm "DRAWN   "

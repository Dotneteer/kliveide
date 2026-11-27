; Parity probe "pic-clut" (Phase 1): where a CLUT write shows on the screen. @use timing @picture
; Every 8th screen line (8-184) the line interrupt, entered from HALT, jumps k NOPs before the end of a
; sled (k = line / 8 AND 15), reads LPEN (recorded once: four values a record, "LPEN<kk>"), writes white
; (7Fh) to CLUT 0 (the cleared mode-4 screen and the border), and black again 8 NOPs later. The program
; then writes its result itself and keeps the raster going, so both emulators' pictures can be compared:
; with the LPEN values equal, any difference in where the white starts is the display's latency.
ProbeMain:
    call TimingSetup
    ; --- Screen pages 30 and 31 (mode 4's 24K) cleared
    ld a,$3E            ; LMPR: RAM0, page 30 in A, page 31 in B
    out ($FA),a
    ld hl,$0000
    ld de,$0001
    ld bc,$5FFF
    ld (hl),l
    ldir
    ld a,$1F
    out ($FA),a
    xor a
    out ($FE),a         ; border: CLUT 0
    ld bc,$00F8
    out (c),a           ; CLUT 0 black
    ; --- The sled in LOOPBUF: 32 NOPs, then the read and the writes
    ld hl,LOOPBUF
    ld b,32
PicNops:
    ld (hl),0
    inc hl
    djnz PicNops
    ex de,hl
    ld hl,PicTail
    ld bc,PicTailEnd - PicTail
    ldir
    ld hl,RasterIsr
    ld (VECTOR),hl
    ld a,8
    ld (RasterLine),a
    out (LINE_PORT),a
    ei
PicWait:
    halt
    ld a,(RasterPasses)
    cp 2
    jr c,PicWait
    di
    ; --- Record the LPEN values, write the result, then keep drawing
    ld hl,NamePrefix
    ld de,NameBuf
    ld bc,6
    ldir
    ld hl,LpenBuf
    ld b,0
PicRecords:
    push bc
    ld a,b
    call HexPair
    ld e,(hl)
    inc hl
    ld d,(hl)
    inc hl
    ld c,(hl)
    inc hl
    ld a,(hl)
    inc hl
    push hl
    ld b,a
    ld hl,NameBuf
    call Record
    pop hl
    pop bc
    ld a,b
    add a,4
    ld b,a
    cp 16
    jr c,PicRecords
    call WriteResult
    ld a,4              ; green: done
    jr z,PicSignal
    ld a,2
PicSignal:
    out ($FE),a
    ei
PicForever:
    halt
    jr PicForever

; --- Copied after the sled (absolute addresses only)
PicTail:
    .defs 20            ; 20 NOPs: k = 0 reads LPEN past hc 128
    xor a
    in a,($F8)          ; LPEN
    ld (ix+0),a
    ld bc,$00F8
    ld a,$7F
    out (c),a           ; white
    nop
    nop
    nop
    nop
    nop
    nop
    nop
    nop
    xor a
    out (c),a           ; black
    jp RasterRet
PicTailEnd:

RasterIsr:
    push af
    in a,(STATUS_PORT)
    rra
    jr c,RasterIgnore
    push bc
    push hl
    push ix
    ld a,(RasterLine)
    ld b,a              ; this line
    add a,8
    cp 192
    jr c,RasterNext
    ld hl,RasterPasses
    inc (hl)
    ld a,8
RasterNext:
    ld (RasterLine),a
    out (LINE_PORT),a   ; ends the pulse, the next line
    ld a,b
    rrca
    rrca
    rrca
    and $0F             ; k
    ld c,a
    ld b,0
    ld ix,LpenBuf
    add ix,bc
    ld hl,LOOPBUF + 32
    or a
    sbc hl,bc
    jp (hl)
RasterRet:
    pop ix
    pop hl
    pop bc
RasterIgnore:
    pop af
    ei
    reti

; --- NameBuf "LPEN" + the first k in hex (HexPair writes NameBuf + 6/7)
NamePrefix:     .defm "LPEN  "
RasterLine:     .defb 0
RasterPasses:   .defb 0
LpenBuf:        .defs 16

; =============================================================================
; Timing helpers for the parity probes (Phase 1). `parity.ts` appends this file after a probe that
; contains "@use timing". Klive's own code.
;
; Counting: a block of code is copied to LOOPBUF and run as `block / INC IY / JP LOOPBUF` over a window
; between two interrupts; the count of whole iterations is the result. The window starts from HALT, so
; the start is the same in every emulator that times the interrupt and HALT the same way:
;   window 0, border: from the frame interrupt (after its pulse ends) to the line interrupt at line 0
;                     (68 border lines, 1-in-4 contention);
;   window 1, screen: from the line interrupt at line 0 to the one at line 191 (191 screen lines).
; IM 2 with the vector at VEC_PAGE * 256 + FFh (the SAM's data bus reads FFh during the acknowledge).
; Blocks may use AF, BC, DE, HL, IX, the word at (SP) and the memory at DATA (DATA + 10h holds a RET); they must leave IY, SP and the interrupts
; alone. Each iteration starts with HL = DATA, DE = DATA + 100h, BC = 00FEh, IX = DATA only before the
; first: a block that needs fixed values sets them itself.
; =============================================================================

STATUS_PORT     .equ $F9            ; read: STATUS (bit 0 line, bit 3 frame; 0 = active)
LINE_PORT       .equ $F9            ; write: the line interrupt's line (FFh: off)
VEC_PAGE        .equ $A0
VECTOR          .equ $A0FF
LOOPBUF         .equ $A200
DATA            .equ $A800

; --- IM 2 through VECTOR; leaves the interrupts off
TimingSetup:
    di
    ld hl,Isr
    ld (VECTOR),hl
    ld a,VEC_PAGE
    ld i,a
    im 2
    ld a,$FF
    out (LINE_PORT),a
    ld a,$C9            ; a RET at DATA + 10h for CALL blocks
    ld (DATA + $10),a
    ret

; --- Waits for the frame interrupt from HALT (so the moment does not depend on what ran before) and
; --- for its pulse to end; returns with interrupts off and the line interrupt as it was
SyncFrame:
    push hl
    ld hl,(VECTOR)
    ld (SyncSavedVector),hl
    ld hl,SyncIsr
    ld (VECTOR),hl
    pop hl
    ld (SyncSavedSp),sp
    ei
SyncWait:
    halt
    jr SyncWait
SyncIsr:
    push af
    in a,(STATUS_PORT)
    and $08
    jr nz,SyncIgnore
    ld sp,(SyncSavedSp)
    push hl
    ld hl,(SyncSavedVector)
    ld (VECTOR),hl
    pop hl
    ld c,$08
    jp WaitInactive
SyncIgnore:
    pop af
    ei
    reti

; --- Polling (interrupts off)

; --- Waits until STATUS AND C is 0 (active) / not 0 (inactive)
WaitActive:
    in a,(STATUS_PORT)
    and c
    jr nz,WaitActive
    ret
WaitInactive:
    in a,(STATUS_PORT)
    and c
    jr z,WaitInactive
    ret

; --- Copies C bytes from HL to LOOPBUF and closes the loop with INC IY / JP LOOPBUF
CopyBlock:
    ld de,LOOPBUF
    ld b,0
    ld a,c
    or a
    jr z,CopyTail
    ldir
CopyTail:
    ex de,hl
    ld (hl),$FD
    inc hl
    ld (hl),$23         ; INC IY
    inc hl
    ld (hl),$C3         ; JP LOOPBUF
    inc hl
    ld (hl),LOOPBUF & $FF
    inc hl
    ld (hl),LOOPBUF >> 8
    ret

; --- Runs LOOPBUF over window A (0: border, 1: screen); DE = the iterations
Measure:
    ld (Window),a
    xor a
    ld (Phase),a
    ld (SavedSp),sp
    ld a,(Window)
    or a
    ld a,$FF            ; border: no line interrupt while waiting for the frame
    jr z,MeasureLine
    xor a               ; screen: line 0
MeasureLine:
    out (LINE_PORT),a
    ei
MeasureWait:
    halt
    jr MeasureWait
MeasureDone:
    ret

; --- The interrupt handler
Isr:
    push af
    in a,(STATUS_PORT)
    ld (Status),a
    ld a,(Phase)
    or a
    jr nz,IsrEnd
    ld a,(Window)
    or a
    jr nz,IsrStartScreen
    ; --- Border window: starts at the frame interrupt, once its pulse is over
    ld a,(Status)
    bit 3,a
    jr nz,IsrIgnore
IsrFramePulse:
    in a,(STATUS_PORT)
    bit 3,a
    jr z,IsrFramePulse
    xor a               ; ends at line 0
    out (LINE_PORT),a
    jr IsrGo
IsrStartScreen:
    ld a,(Status)
    bit 0,a
    jr nz,IsrIgnore
    ld a,191            ; ends the pulse; the window ends at line 191
    out (LINE_PORT),a
IsrGo:
    ld a,1
    ld (Phase),a
    ld sp,(SavedSp)
    dec sp              ; a scratch word for blocks such as EX (SP),HL
    dec sp
    ld iy,0
    ld ix,DATA
    ld hl,DATA
    ld de,DATA + $100
    ld bc,$00FE
    ei
    jp LOOPBUF
IsrEnd:
    ld a,(Status)
    bit 0,a
    jr nz,IsrIgnore
    ld a,$FF            ; ends the pulse, the line interrupt off
    out (LINE_PORT),a
    ld a,2
    ld (Phase),a
    ld sp,(SavedSp)
    push iy
    pop de
    jp MeasureDone
IsrIgnore:
    pop af
    ei
    reti

; --- Measures each block of the table at HL in both windows, recording "<name>B" and "<name>S".
; --- A table entry: 7-character name, block address (word), block length (byte); a zero byte ends it.
MeasureTable:
    ld a,(hl)
    or a
    ret z
    ld de,NameBuf
    ld bc,7
    ldir
    ld e,(hl)
    inc hl
    ld d,(hl)
    inc hl
    ld c,(hl)
    inc hl
    ld (TablePtr),hl
    ex de,hl
    call CopyBlock
    xor a
    call Measure
    ld a,'B'
    call RecordCount
    ld a,1
    call Measure
    ld a,'S'
    call RecordCount
    ld hl,(TablePtr)
    jr MeasureTable

; --- Records DE under NameBuf with A as its 8th character
RecordCount:
    ld (NameBuf + 7),a
    ld hl,NameBuf
    ld bc,0
    jp Record

Window:     .defb 0
Phase:      .defb 0
Status:     .defb 0
SavedSp:    .defw 0
SyncSavedSp:    .defw 0
SyncSavedVector: .defw 0
TablePtr:   .defw 0
NameBuf:    .defs 8

; =============================================================================
; Staircases: the beam position (LPEN) after a line interrupt, k NOPs (k = 0-31) and a block.
; From HALT, the line interrupt at STAIR_LINE enters StairIsr, which ends the pulse and jumps into a
; 64-NOP sled at its last k NOPs (after a fixed delay); after the sled comes the block, then XOR A / IN A,(F8h) (LPEN: bits
; 7-2 the T-states since hc 128, in steps of 4) and JP StairDone. The 32 LPEN bytes are recorded four to
; a record, as "<name><kk>" with kk the first k in hex.
; =============================================================================

STAIR_LINE      .equ 100

; --- Measures each block of the table at HL; an entry: 6-character name, address (word), length (byte)
StairTable:
    ld a,(hl)
    or a
    ret z
    ld de,NameBuf
    ld bc,6
    ldir
    ld e,(hl)
    inc hl
    ld d,(hl)
    inc hl
    ld c,(hl)
    inc hl
    ld (TablePtr),hl
    ex de,hl
    call StairBuild
    ld hl,StairValues
    ld (StairPtr),hl
    xor a
    ld (StairK),a
StairNextK:
    call StairOne
    ld a,(StairK)
    inc a
    ld (StairK),a
    cp 32
    jr c,StairNextK
    ; --- Eight records of four values
    ld hl,StairValues
    ld b,0
StairRecords:
    push bc
    push hl
    ld a,b
    call HexPair        ; NameBuf + 6/7 = the first k in hex
    pop hl
    ld e,(hl)
    inc hl
    ld d,(hl)
    inc hl
    ld c,(hl)
    inc hl
    ld b,(hl)
    inc hl
    push hl
    ld hl,NameBuf
    call Record
    pop hl
    pop bc
    ld a,b
    add a,4
    ld b,a
    cp 32
    jr c,StairRecords
    ld hl,(TablePtr)
    jr StairTable

; --- Writes A as two hex digits to NameBuf + 6
HexPair:
    push af
    rrca
    rrca
    rrca
    rrca
    call HexDigit
    ld (NameBuf + 6),a
    pop af
    call HexDigit
    ld (NameBuf + 7),a
    ret
HexDigit:
    and $0F
    add a,'0'
    cp '9' + 1
    ret c
    add a,'A' - '9' - 1
    ret

; --- LOOPBUF = 64 NOPs, the C bytes at HL, XOR A, IN A,(F8h), JP StairDone
StairBuild:
    push hl
    push bc
    ld hl,LOOPBUF
    ld b,64
StairNops:
    ld (hl),0
    inc hl
    djnz StairNops
    ex de,hl
    pop bc
    pop hl
    ld b,0
    ld a,c
    or a
    jr z,StairTail
    ldir
StairTail:
    ex de,hl
    ld (hl),$AF         ; XOR A
    inc hl
    ld (hl),$DB         ; IN A,(F8h)
    inc hl
    ld (hl),$F8
    inc hl
    ld (hl),$C3         ; JP StairDone
    inc hl
    ld (hl),StairDone & $FF
    inc hl
    ld (hl),StairDone >> 8
    ret

; --- One run with k = (StairK) NOPs; stores LPEN at (StairPtr)
StairOne:
    ld hl,StairIsr
    ld (VECTOR),hl
    ld (SavedSp),sp
    ld a,(StairK)
    ld e,a
    ld d,0
    ld hl,LOOPBUF + 64
    or a
    sbc hl,de           ; HL: the sled's entry
    ld a,STAIR_LINE
    out (LINE_PORT),a
    ei
StairWait:
    halt
    jr StairWait

StairIsr:
    push af
    in a,(STATUS_PORT)
    bit 0,a
    jr nz,StairIgnore
StairIsrGo:             ; (the IM 1 probe enters here, with the status checked)
    ld a,$FF            ; ends the pulse, the line interrupt off
    out (LINE_PORT),a
    ld sp,(SavedSp)
    dec sp
    dec sp
    ld ix,DATA
    ld de,DATA + $100
    ld bc,$00FE
    ld a,(StairDelayN)
StairDelay:
    dec a
    jr nz,StairDelay
    jp (hl)
StairIgnore:
    pop af
    ei
    reti

StairDone:
    ld sp,(SavedSp)
    ld hl,(StairPtr)
    ld (hl),a
    inc hl
    ld (StairPtr),hl
    ld hl,Isr
    ld (VECTOR),hl
    ret

StairK:         .defb 0
; DEC A / JR NZ rounds before the sled; 10: k = 0 lands in line 101's border part. A probe may change it.
StairDelayN:    .defb 10
StairPtr:       .defw 0
StairValues:    .defs 32

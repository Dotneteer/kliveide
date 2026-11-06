;;
;; background.asm
;;
;; Code to do with drawing the floor and walls
;;

;; Exported functions:
;;  * DrawBkgnd
;;  * TweakEdges
;;  * JpIX
;;  * SetFloorAddr

;; Exported varibles:
;;  * IsColBufFlipped
;;  * IsColBufFilled
;;  * CornerPos
;;  * LeftAdj
;;  * RightAdj

;; Given extents stored in ViewXExtent and ViewYExtent,
;; draw the appropriate piece of screen background into
;; ViewBuff (to be drawn over and blitted to display later)
;;
;; Despite ostensibly coping with varied X extents, the buffer to
;; write to is assumed to be 6 bytes wide.
DrawBkgnd:      LD      HL,(ViewXExtent)
        ;; H contains start, L end, in double-pixels
                LD      A,H
                RRA
                RRA
        ;; A now contains start byte number
                LD      C,A     ; Start byte number stashed in C for later.
                AND     $3E     ; Clear lowest bit to get 2x double column index...
        ;; Set HL' to column info
                EXX
                LD      L,A
                LD      H,BkgndData >> 8 ; BkgndData is page-aligned.
                EXX
        ;; Calculate width to draw, in bytes
                LD      A,L
                SUB     H
                RRA
                RRA
                AND     $07
                SUB     $02
        ;; Oh, and destination buffer
                LD      DE,ViewBuff
        ;; Below here, DE points at the sprite buffer, and HL' the
        ;; source data (two bytes per column pair). A contains number
        ;; of cols to draw, minus 2.
        ;;
        ;; If index is initially odd, draw RHS of a column pair.
                RR      C
                JR      NC,DB_1
                LD      IY,ClearOne
                LD      IX,OneColBlitR
                LD      HL,BlitFloorR
                CALL    DrawBkgndCol
                CP      $FF
                RET     Z
                SUB     $01
                JR      DB_2
        ;; Draw two columns at a time.
DB_1:           LD      IY,ClearTwo
                LD      IX,TwoColBlit
                LD      HL,BlitFloor
                CALL    DrawBkgndCol
                INC     E       ; We did 2 columns this time, so bump one more.
                SUB     $02
DB_2:           JR      NC,DB_1
        ;; One left-over column.
                INC     A
                RET     NZ
                LD      IY,ClearOne
                LD      IX,OneColBlitL
                LD      HL,BlitFloorL
                LD      (BlitFloorFnPtr+1),HL
                EXX
                JR      DrawBkgndCol2           ; Tail call.

;; Performs register-saving and incrementing HL'/E. Not needed
;; for the last call from DrawBkgnd.
DrawBkgndCol:   LD      (BlitFloorFnPtr+1),HL
                PUSH    DE
                PUSH    AF
                EXX
                PUSH    HL
                CALL    DrawBkgndCol2
                POP     HL
                INC     L
                INC     L
                EXX
                POP     AF
                POP     DE
                INC     E
                RET

;; The basic walls are 56 pixels high
SHORT_WALL:     EQU $38
;; Columns/spaces (indices 4 and 5) are up to 74 pixels high, made up
;; of top, repeated middle and bottom section.
TALL_WALL:      EQU (9 + 24 + 4) * 2

;; Call inputs:
;; * Reads from ViewYExtent
;; * Takes in:
;;   HL' - Floor drawing function
;;   DE' - Destination buffer (only modified via IX, IY, etc.)
;;   IX  - Copying function (takes #rows in A, writes to DE' and updates it)
;;   IY  - Clearing function (takes #rows in A, writes to DE' and updates it)
;;   HL  - Pointer to BkgndData array entry:
;;           Byte 0: Y of wall bottom (0 = clear)
;;           Byte 1: Id for wall panel sprite
;;                   (0-3 - world-specific, 4 - columns, 5 - blank, | $80 to flip)
;; Note that the Y coordinates are downward-increasing, matching memory.
DrawBkgndCol2:  LD      DE,(ViewYExtent)
                LD      A,E
                SUB     D
                LD      E,A             ; E now contains height
                LD      A,(HL)
                AND     A
                JR      Z,DBC_Clear     ; Baseline of zero? Clear full height, then
                LD      A,D
                SUB     (HL)
                LD      D,A             ; D holds how many lines we are below the bottom of the wall
                JR      NC,DBC_DoFloor  ; Positive? Then skip to drawing the floor.
        ;; In this case, we handle the viewing window starting above the start of the floor.
                INC     HL
                LD      C,SHORT_WALL    ; Wall height for ids 0-3
                BIT     2,(HL)
                JR      Z,DBC_Flag
                LD      C,TALL_WALL     ; Wall height for ids 4-5
DBC_Flag:       ADD     A,C             ; Add the wall height on.
        ;; Window Y start now relative to the top of the current wall panel.
                JR      NC,DBC_TopSpace ; Still some space left above in window? Jump
        ;; Start drawing some fraction through the wall panel
                ADD     A,A
                CALL    GetOffsetWall
                EXX
                LD      A,D
                NEG
                JP      DBC_Wall
        ;; We start before the top of the wall panel, so we'll start off by clearing above.
        ;; A holds -number of rows to top of wall panel, E holds number of rows to write.
DBC_TopSpace:   NEG
                CP      E
                JR      NC,DBC_Clear    ; If we're /only/ drawing space, do the tail call.
        ;; Clear the appropriate amount of space.
                LD      B,A
                NEG
                ADD     A,E
                LD      E,A
                LD      A,B
                CALL    DoClear
        ;; Get the pointer to the wall panel bitmap to copy in...
                LD      A,(HL)
                EXX
                CALL    GetWall
                EXX
        ;; and the height to use
                LD      A,SHORT_WALL
                BIT     2,(HL)
                JR      Z,DBC_Wall
                LD      A,TALL_WALL
        ;; Now draw the wall. A holds number of lines of wall to draw, source in HL'
DBC_Wall:       CP      E
                JR      NC,DBC_Copy     ; Window ends in the wall panel? Tail call
        ;; Otherwise, copy the full wall panel, and then draw the floor etc.
                LD      B,A
                NEG
                ADD     A,E
                EX      AF,AF'
                LD      A,B
                CALL    DoCopy
                EX      AF,AF'
                LD      D,$00
                JR      DBC_FloorEtc    ; Tail call
DBC_Copy:       LD      A,E
                JP      (IX)            ; Copy A rows from HL' to DE'.
DBC_Clear:      LD      A,E
                JP      (IY)            ; Clear A rows at DE'.

        ;; Point we jump to if we're initially below the top edge of the floor.
DBC_DoFloor:    LD      A,E
                INC     HL
        ;; NB: Fall through

        ;; Code to draw the floor, bottom edge, and any space below
        ;;
        ;; At this point, HL has been incremented by 1, A contains
        ;; number of rows to draw, D contains number of lines below
        ;; bottom of wall we're at.
        ;;
        ;; First, calculate the position of the bottom edge.
DBC_FloorEtc:   LD      B,A             ; Store height in B
                DEC     HL              ; And go back to original pointer location
                LD      A,L             ; L contained column number & ~1
                ADD     A,A
                ADD     A,A             ; The bottom edge goes down 4 pixels for each
                ADD     A,$04           ; byte across, so multiply by 4 and add 4.
        ;; Compare A with the position of the corner, to determine the
        ;; play area edge graphic to use, by overwriting the WhichEdge
        ;; operand. A itself is adjusted around the corner position.
CornerPos:      CP      $00             ; NB: Target of self-modifying code.
                JR      C,DBC_Left
                LD      E,DBE_R - DBE_R ; Right edge graphic case
                JR      NZ,DBC_Right
                LD      E,DBE_C - DBE_R ; Corner edge graphic case
DBC_Right:      SUB     $04
RightAdj:       ADD     A,$00           ; NB: Target of self-modifying code.
                JR      DBC_CrnrJmp
DBC_Left:       ADD     A,$04
                NEG
LeftAdj:        ADD     A,$00           ; NB: Target of self-modifying code.
                LD      E,DBE_L - DBE_R ; Left edge graphic case
        ;; Store coordinate of bottom edge in C, write out edge graphic
DBC_CrnrJmp:    NEG
                ADD     A,EDGE_HEIGHT
                LD      C,A
                LD      A,E
                LD      (WhichEdge+1),A
        ;; Find out how much remains to be drawn
                LD      A,(HL)          ; Load Y baseline
                ADD     A,D             ; Add to offset start to get original start again.
                INC     HL
                SUB     C               ; Calculate A (onscreen start) - C (screen end of image)
                JR      NC,DBC_Clear2   ; <= 0 -> Reached end, so clear buffer
                ADD     A,EDGE_HEIGHT
                JR      NC,DBC_Floor    ; > 11 -> Some floor and edge
        ;; 0 < Amount to draw <= 11
                LD      E,A             ; Now we see if we'll reach the end of the bottom edge
                SUB     EDGE_HEIGHT
                ADD     A,B
                JR      C,DBC_AllBottom ; Does the drawing window extend to the edge and beyond?
                LD      A,B             ; No, so only draw B lines of edge
                JR      DrawBottomEdge  ; Tail call
        ;; Case where we're drawing
DBC_AllBottom:  PUSH    AF
                SUB     B
                NEG                     ; Draw the bottom edge, then any remaining lines cleared
        ;; Expects number of rows of edge in A, starting row in E,
        ;; draws bottom edge and remaining blanks in DE'. Number of
        ;; blank rows pushed on stack.
DBC_Bottom:     CALL    DrawBottomEdge
                POP     AF
                RET     Z
                JP      (IY)            ; Clear A rows at DE'
DBC_Clear2:     LD      A,B
                JP      (IY)            ; Clear A rows at DE'
        ;; Draw some floor. A contains -height before reaching edge,
        ;; B contains drawing window height.
DBC_Floor:      ADD     A,B
                JR      C,DBC_FloorNEdge; Need to draw some floor and also edge.
                LD      A,B             ; Just draw a window-height of floor.
        ;; NB: Fall through
BlitFloorFnPtr: JP      $0000           ; NB: Target of self-modifying code
        ;; Draw the floor and then edge etc.
DBC_FloorNEdge: PUSH    AF
                SUB     B
                NEG
                CALL    BlitFloorFnPtr
                POP     AF
                RET     Z
        ;; Having drawn the floor, do the same draw edge/draw edge and blank space
        ;; test we did above for the no-floor case
                SUB     EDGE_HEIGHT
                LD      E,$00
                JR      NC,DBC_EdgeNSpace
        ;; Just-draw-the-edge case
                ADD     A,EDGE_HEIGHT
                JR      DrawBottomEdge
        ;; Draw-the-edge-and-then-space case
DBC_EdgeNSpace: PUSH    AF
                LD      A,EDGE_HEIGHT
                JR      DBC_Bottom

;; Takes starting row number in E, number of rows in A, destination in DE'
;; Returns an updated DE' pointer.
DrawBottomEdge: PUSH    DE
                EXX
                POP     HL
                LD      H,$00
                ADD     HL,HL
                LD      BC,LeftEdge
WhichEdge:      JR      DBE_L           ; NB: Target of self-modifying code.
DBE_R:          LD      BC,RightEdge
                JR      DBE_L
DBE_C:          LD      BC,CornerEdge
DBE_L:          ADD     HL,BC
                EXX
        ;; Copies from HL' to DE', number of rows in A.
                JP      (IX)            ; NB: Tail call to copy data

        ;; Each edge image is 11 pixels high
EDGE_HEIGHT:    EQU 11

        ;; FIXME: Export as images?
LeftEdge:       DEFB $40,$00,$70,$00,$74,$00,$77,$00,$37,$40,$07
                DEFB $70,$03,$74,$00,$77,$00,$37,$00,$07,$00,$03
RightEdge:      DEFB $00,$01,$00,$0d,$00,$3d,$00,$7d,$01,$7c,$0d
                DEFB $70,$3d,$40,$7d,$00,$7c,$00,$70,$00,$40,$00
CornerEdge:     DEFB $40,$01,$70,$0d,$74,$3d,$77,$7d,$37,$7c,$07
                DEFB $70,$03,$40,$00,$00,$00,$00,$00,$00,$00,$00

;; ----------------------------------------------------------------------

;; Takes the room origin in BC, and stores it, and then updates the edge patterns
;; to include a bit of the floor pattern.
;;
;; TODO: The maths here is a bit obscure.
TweakEdges:     LD              HL,(FloorAddr)
                LD              (RoomOrigin),BC
                LD              BC,2*5
                ADD             HL,BC           ; Move 5 rows into the tile
                LD              C,2*8
                LD              A,(HasDoor)
                RRA
                PUSH            HL              ; Push this address.
                JR              NC,TE_1         ; If bottom bit of HasDoor is set...
                ADD             HL,BC
                EX              (SP),HL         ; Move 8 rows further on the stack-saved pointer
TE_1:           ADD             HL,BC           ; In any case, move 8 rows on HL...
                RRA
                JR              NC,TE_2         ; Unless the next bit of HasDoor was set
                AND             A
                SBC             HL,BC
        ;; Copy some of the left column of the floor into the right edge.
TE_2:           LD              DE,RightEdge    ; Call once...
                CALL            TweakEdgesInner
        ;; Then copy some of the right column of the floor pattern to the left.
                POP             HL
                INC             HL
                LD              DE,LeftEdge+1   ; then again with saved address.
        ;; NB: Fall through

;; Copy 4 bytes, skipping every second byte. Used to copy part of the
;; floor pattern into one side of the top of the edge pattern.
;;
;; Edge pattern in DE, floor in HL.
TweakEdgesInner:LD              A,$04
TEI_1:          LDI
                INC             HL
                INC             DE
                DEC             A
                JR              NZ,TEI_1
                RET

;; ------------------------------------------------------------------------

;; Wrap up a call to GetWall, and add in the starting offset from A.
GetOffsetWall:  PUSH    AF
                LD      A,(HL)
                EXX
                CALL    GetWall
                POP     AF
                ADD     A,L
                LD      L,A
                RET     NC
                INC     H
                RET

;; Zero means column buffer is zeroed, non-zero means filled with
;; column image.
IsColBufFilled: DEFB $00

;; Returns ColBuf in HL.
;; If IsColBufFilled is non-zero, it zeroes the buffer, and the flag.
GetEmptyColBuf: LD      A,(IsColBufFilled)
                AND     A
                LD      HL,ColBuf
                RET     Z
                PUSH    HL
                PUSH    BC
                PUSH    DE
                LD      BC,ColBufLen
                CALL    FillZero
                POP     DE
                POP     BC
                POP     HL
                XOR     A
                LD      (IsColBufFilled),A
                RET

;; Called by GetWall for high-index sprites, to draw the space under a door
;; A=5 -> blank space, A=4 -> columns
GetUnderDoor:   BIT     0,A                     ; Low bit nonzero? Return cleared buffer.
                JR      NZ,GetEmptyColBuf       ; Tail call
                LD      L,A
        ;; Otherwise, we're drawing a column
                LD      A,(IsColBufFilled)
                AND     A
                CALL    Z,FillColBuf
                LD      A,(IsColBufFlipped)
                XOR     L
                RLA
        ;; Carry set if we need to flip and update flag to match request...
                LD      HL,ColBuf
                RET     NC                      ; Return ColBuf if no flip required...
                LD      A,(IsColBufFlipped)     ; Otherwise, flip flag and buffer.
                XOR     $80
                LD      (IsColBufFlipped),A
                LD      B,TALL_WALL             ; Tall wall section
                JP      FlipColumn              ; Tail call

;; Get a wall section thing.
;; Index in A. Top bit represents whether flip is required.
;; Pointer to data returned in HL.
GetWall:        BIT     2,A             ; 4 and 5 handled by GetUnderDoor.
                JR      NZ,GetUnderDoor
                PUSH    AF
                CALL    NeedsFlip2      ; Check if flip is required
                EX      AF,AF'
                POP     AF
                CALL    GetPanelAddr    ; Get the address
                EX      AF,AF'
                RET     NC              ; Flip the data only if required.
                JP      FlipPanel       ; Tail call

;; Takes a sprite index in A. Looks up low three bits in the bitmap.
;; If the top bit was set, we flip the bit if necessary to match,
;; and return carry if a bit flip was needed.
;;
;; Rather similar to 'NeedsFlip'.
NeedsFlip2:     LD              C,A
                LD              HL,(PanelFlipsPtr)
                AND             $03
        ;; A = 1 << A
                LD              B,A
                INC             B
                LD              A,$01
NF2_1:          RRCA
                DJNZ            NF2_1
        ;; Check if that bit of (HL) is set
                LD              B,A
                AND             (HL)
                JR              NZ,NF2_2
        ;; It isn't. Was top bit if param set?
                RL              C
                RET             NC      ; No - return with carry reset
        ;; It was. So, set bit and return with carry flag set.
                LD              A,B
                OR              (HL)
                LD              (HL),A
                SCF
                RET
        ;; Top bit was set. Is bit set?
NF2_2:          RL              C
                CCF
                RET             NC      ; Yes - return with carry reset
        ;; No. So reset bit and return with carry flag set.
                LD              A,B
                CPL
                AND             (HL)
                LD              (HL),A
                SCF
                RET

JpIX:                           ; Alternate, more helpful name.
DoCopy:         JP      (IX)    ; Call the copying function
DoClear:        JP      (IY)    ; Call the clearing function

;; Zero a single column of the 6-byte-wide buffer at DE' (A rows).
ClearOne:       EXX
                LD      B,A
                EX      DE,HL
                LD      E,$00
CO_1:           LD      (HL),E
                LD      A,L
                ADD     A,$06
                LD      L,A
                DJNZ    CO_1
                EX      DE,HL
                EXX
                RET

;; Zero two columns of the 6-byte-wide buffer at DE' (A rows).
ClearTwo:       EXX
                LD      B,A
                EX      DE,HL
                LD      E,$00
CT_1:           LD      (HL),E
                INC     L
                LD      (HL),E
                LD      A,L
                ADD     A,$05
                LD      L,A
                DJNZ    CT_1
                EX      DE,HL
                EXX
                RET

;; Set FloorAddr to the floor sprite indexed in A.
SetFloorAddr:   LD      C,A
                ADD     A,A
                ADD     A,C
                ADD     A,A
                ADD     A,A
                ADD     A,A
                LD      L,A
                LD      H,$00
                ADD     HL,HL           ; x $30 (floor tile size)
                LD      DE,IMG_2x24 - MAGIC_OFFSET      ; The floor tile images.
                ADD     HL,DE           ; Add to floor tile base.
                LD      (FloorAddr),HL
                RET

;; Address of the sprite used to draw the floor.
FloorAddr:      DEFW IMG_2x24 - MAGIC_OFFSET + 2 * $30

;; HL' points to the wall sprite id. If it's 'space', we
;; return a blank floor tile (FIXME: Why?).
;; Otherwise we return the current tile address pointer, plus C, in BC.
GetFloorAddr:   PUSH    AF
                EXX
                LD      A,(HL)
                OR      ~5
                INC     A       ; If the wall sprite id is 5 (space)...
                EXX
                JR      Z,GFA_1 ; jump.
                LD      A,C
                LD      BC,(FloorAddr)
                ADD     A,C     ; Add old C to FloorAddr and return in BC.
                LD      C,A
                ADC     A,B
                SUB     C
                LD      B,A
                POP     AF
                RET
        ;; Return the blank tile
GFA_1:          LD      BC,IMG_2x24 - MAGIC_OFFSET + 7 * $30
                POP     AF
                RET

;; Fill a 6-byte-wide buffer at DE' with both columns of a floor tile.
;; A  contains number of rows to generate.
;; D  contains initial offset in rows.
;; HL points to wall sprite id.
BlitFloor:      LD      B,A
                LD      A,D
        ;; Move down 8 rows if top bit of (HL) is set,
        ;; i.e. if we're on the flipped side.
                BIT     7,(HL)
                EXX
                LD      C,0
                JR      Z,BF_1
                LD      C,2*8
        ;; Get the address (using HL' for wall sprite id)
BF_1:           CALL    GetFloorAddr
        ;; Construct offset in HL from original D. Double it as tile is 2 wide.
                AND     $0F
                ADD     A,A
                LD      H,$00
                LD      L,A
                EXX
        ;; At this point we have source in BC', destination in DE',
        ;; offset of source in HL', and number of rows to copy in B.
BF_2:           EXX
                PUSH    HL
        ;; Copy both bytes of the current row into the 6-byte-wide buffer.
                ADD     HL,BC
                LD      A,(HL)
                LD      (DE),A
                INC     HL
                INC     E
                LD      A,(HL)
                LD      (DE),A
                LD      A,E
                ADD     A,$05
                LD      E,A
                POP     HL
                LD      A,L
                ADD     A,$02
        ;; Floor tiles are 24 pixels high. Depending on odd/even, we
        ;; start at offset 0 or 16 (8 rows in). So, if we read offsets
        ;; 0..31 (rows 0..15) from there, we get the right data, and
        ;; can safely wrap.
                AND     $1F
                LD      L,A
                EXX
                DJNZ    BF_2
                RET

;; Fill a 6-byte-wide buffer at DE' with the right column of background tile.
;; A  contains number of rows to generate.
;; D  contains initial offset in rows.
;; HL contains pointer to wall sprite id.
BlitFloorR:     LD      B,A
                LD      A,D
        ;; Move down 8 rows if top bit of (HL) is set.
        ;; Do the second column of the image (the extra +1)
                BIT     7,(HL)
                EXX
                LD      C,1
                JR      Z,BFL_1
                LD      C,2*8+1
                JR      BFL_1

;; Fill a 6-byte-wide buffer at DE' with the left column of background tile.
;; A  contains number of rows to generate.
;; D  contains initial offset in rows.
;; HL contains pointer to wall sprite id.
BlitFloorL:     LD      B,A
                LD      A,D
        ;; Move down 8 rows if top bit of (HL) is set.
                BIT     7,(HL)
                EXX
                LD      C,0
                JR      Z,BFL_1
                LD      C,2*8
        ;; Get the address (using HL' for wall sprite id)
BFL_1:          CALL    GetFloorAddr
        ;; Construct offset in HL from original D. Double it as tile is 2 wide.
                AND     $0F
                ADD     A,A
                LD      H,$00
                LD      L,A
                EXX
        ;; At this point we have source in BC', destination in DE',
        ;; offset of source in HL', and number of rows to copy in B.
BFL_2:          EXX
                PUSH    HL
        ;; Copy 1 byte into 6-byte-wide buffer
                ADD     HL,BC
                LD      A,(HL)
                LD      (DE),A
                LD      A,E
                ADD     A,$06
                LD      E,A
                POP     HL
                LD      A,L
                ADD     A,$02
                AND     $1F
                LD      L,A     ; Add 1 row to source offset pointer, mod 32
                EXX
                DJNZ    BFL_2
                RET

;; Blit from HL' to DE', right byte of a 2-byte-wide sprite in a 6-byte wide buffer.
;; Number of rows in A.
OneColBlitR:    EXX
                INC     HL
                JR      OCB_1

;; Blit from HL' to DE', left byte of a 2-byte-wide sprite in a 6-byte wide buffer.
;; Number of rows in A.
OneColBlitL:    EXX
OCB_1:          LD      B,A
OCB_2:          LD      A,(HL)
                LD      (DE),A
                INC     HL
                INC     HL
                LD      A,E
                ADD     A,$06
                LD      E,A
                DJNZ    OCB_2
                EXX
                RET

;; Blit from HL' to DE', a 2-byte-wide sprite in a 6-byte wide buffer.
;; Number of rows in A.
TwoColBlit:     EXX
                LD      B,A
TCB_1:          LD      A,(HL)
                LD      (DE),A
                INC     HL
                INC     E
                LD      A,(HL)
                LD      (DE),A
                INC     HL
                LD      A,E
                ADD     A,$05
                LD      E,A
                DJNZ    TCB_1
                EXX
                RET

;; Flip a normal wall panel
FlipPanel:      LD      B,SHORT_WALL
;; Reverse a two-byte-wide image. Height in B, pointer to data in HL.
FlipColumn:     PUSH    DE
                LD      D,RevTable >> 8
                PUSH    HL
FC_1:           INC     HL
                LD      E,(HL)
                LD      A,(DE)
                DEC     HL
                LD      E,(HL)
                LD      (HL),A
                INC     HL
                LD      A,(DE)
                LD      (HL),A
                INC     HL
                DJNZ    FC_1
                POP     HL
                POP     DE
                RET

;; Top bit is set if the column image buffer is flipped
IsColBufFlipped:DEFB $00

;; Return the wall panel address in HL, given panel index in A.
GetPanelAddr:   AND     $03     ; Limit to 0-3
                ADD     A,A
                ADD     A,A
                LD      C,A     ; 4x
                ADD     A,A
                ADD     A,A
                ADD     A,A     ; 32x
                SUB     C       ; 28x
                ADD     A,A     ; 56x
                LD      L,A
                LD      H,$00   ; 112x
                ADD     HL,HL
                LD      BC,(PanelBase)
                ADD     HL,BC   ; Add on to contents of PanelBase and return.
                RET

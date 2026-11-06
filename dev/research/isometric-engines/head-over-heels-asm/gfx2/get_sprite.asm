;;
;; get_sprite.asm
;;
;; Function to return pointer to data for a particular sprite id
;;
;; Incorporates code to do horizontal flipping, etc.
;;
;; TODO: There remains some special-case code for 3x56, to decide when
;; to use an occluded doorway.
;;

;; Exported functions:
;; * GetSpriteAddr
;; * GetSprExtents
;; * InitRevTbl
;; * Sprite3x56

;; Exported variables:
;; * DoorwayFlipped
;; * SpriteCode
;; * SpriteWidth

;; Exported constants:
;; * SPR_*

SPR_FLIP:       EQU $80

;; 3x56
SPR_DOORL:      EQU $00
SPR_DOORR:      EQU $01

;; 3x32
SPR_VISOROHALF: EQU $10
SPR_VISORCHALF: EQU $11
SPR_VISORO:     EQU $12
SPR_VISORC:     EQU $13

;; 3x24
SPR_HEELS1:     EQU $18
SPR_HEELS2:     EQU $19
SPR_HEELS3:     EQU $1A
SPR_HEELSB1:    EQU $1B
SPR_HEELSB2:    EQU $1C
SPR_HEELSB3:    EQU $1D

SPR_HEAD1:      EQU $1E
SPR_HEAD2:      EQU $1F
SPR_HEAD3:      EQU $20
SPR_HEADB1:     EQU $21
SPR_HEADB2:     EQU $22
SPR_HEADB3:     EQU $23

SPR_VAPE1:      EQU $24
SPR_VAPE2:      EQU $25
SPR_VAPE3:      EQU $26

SPR_PURSE:      EQU $27
SPR_HOOTER:     EQU $28
SPR_DONUTS:     EQU $29
SPR_BUNNY:      EQU $2A
SPR_SPRING:     EQU $2B
SPR_SPRUNG:     EQU $2C

SPR_FISH1:      EQU $2D
SPR_FISH2:      EQU $2E
SPR_CROWN:      EQU $2F
SPR_SWITCH:     EQU $30
SPR_GRATING:    EQU $31

SPR_MONOCAT1:   EQU $32
SPR_MONOCAT2:   EQU $33
SPR_MONOCATB1:  EQU $34
SPR_MONOCATB2:  EQU $35

SPR_ROBOMOUSE:  EQU $36
SPR_ROBOMOUSEB: EQU $37

SPR_BEE1:       EQU $38
SPR_BEE2:       EQU $39
SPR_BEACON:     EQU $3A
SPR_FACE:       EQU $3B
SPR_FACEB:      EQU $3C
SPR_TAP:        EQU $3D

SPR_CHIMP:      EQU $3E
SPR_CHIMPB:     EQU $3F
SPR_CHARLES:    EQU $40
SPR_CHARLESB:   EQU $41
SPR_TRUNK:      EQU $42
SPR_TRUNKB:     EQU $43

SPR_HELIPLAT1:  EQU $44
SPR_HELIPLAT2:  EQU $45
SPR_BONGO:      EQU $46
SPR_DRUM:       EQU $47
SPR_WELL:       EQU $48
SPR_STICK:      EQU $49

SPR_TRUNKS:     EQU $4A
SPR_DECK:       EQU $4B
SPR_BALL:       EQU $4C
SPR_HEAD:       EQU $4D

;; 4x28
SPR_STEP:       EQU $54
SPR_SANDWICH:   EQU $55
SPR_ROLLERS:    EQU $56
SPR_TELEPORT:   EQU $57
SPR_VAPORISE:   EQU $58
SPR_PAD:        EQU $59
SPR_ANVIL:      EQU $5A
SPR_SPIKES:     EQU $5B
SPR_HUSHPUPPY:  EQU $5C
SPR_BOOK:       EQU $5D
SPR_TOASTER:    EQU $5E
SPR_CUSHION:    EQU $5F

;; Width of sprite in bytes.
SpriteWidth:    DEFB $04
;; Current sprite we're drawing.
SpriteCode:     DEFB $00

;; Initialise a look-up table of byte reverses.
InitRevTbl:     LD      HL,RevTable
RevLoop_1:      LD      C,L
                LD      A,$01
                AND     A
RevLoop_2:      RRA
                RL      C
                JR      NZ,RevLoop_2
                LD      (HL),A
                INC     L
                JR      NZ,RevLoop_1
                RET

;; TODO: SpriteFlags

;; For a given sprite code, generates the X and Y extents, and sets
;; the current sprite code and sprite width.
;;
;; Parameters: Sprite code is passed in in A.
;;             X coordinate in C, Y coordinate in B
;; Returns: X extent in BC, Y extent in HL
GetSprExtents:  LD      (SpriteCode),A
                AND     $7F
                CP      $10
                JR      C,Case3x56      ; Codes < $10 are 3x56
                LD      DE,$0606        ; 3x24 or 3x32 (3x32 will be modified)
                LD      H,18
                CP      $54
                JR      C,SSW_1
                LD      DE,$0808        ; Codes >= $54 are 4x28
                LD      H,20
SSW_1:          CP      $18
                JR      NC,SSW_2
                LD      A,(SpriteFlags) ; Codes < $18 are 3x32
                AND     $02
                LD      D,4
                LD      H,12
                JR      Z,SSW_2
                LD      D,0
                LD      H,16
        ;; All cases but 3x56 join up here:
        ;; D is Y extent down, H is Y extent up
        ;; E is half-width (in double pixels)
        ;;
        ;; 4x28: D = 8, E = 8, H = 20
        ;; 3x24: D = 6, E = 6, H = 18
        ;; 3x32: D = 0, E = 6, H = 16 if flags & 2
        ;; 3x32: D = 4, E = 6, H = 12 otherwise
        ;;
        ;; The 3x32 case is split into 2 parts of height 16 each.
SSW_2:          LD      A,B
                ADD     A,D
                LD      L,A             ; L = B + D
                SUB     D
                SUB     H
                LD      H,A             ; H = B - H
                LD      A,C
                ADD     A,E
                LD      C,A             ; C = C + E
                SUB     E
                SUB     E
                LD      B,A             ; B = C - 2*E
                LD      A,E
                AND     A
                RRA                     ; And save width in bytes to SpriteWidth
                LD      (SpriteWidth),A
                RET

Case3x56:
        ;; Horrible hack to get the current object - we're usually
        ;; called via BlitObjects, which sets this.
        ;;
        ;; However, IntersectObj is also called via AddObject, so err...
        ;; either something clever's going on, or the extents can be
        ;; slightly wrong in the AddObject case for doors.
        ;;
        ;; TODO: Tie these into the object definitions and flags
                LD      HL,(CurrObject2+1)
                INC     HL
                INC     HL
                BIT     5,(HL)          ; Bit 5 = is LHS door
                EX      AF,AF'
                LD      A,(HL)
                SUB     $10             ; NC for < 9 or > 30 - ie near doors
                CP      $20
                LD      L,$04
                JR      NC,C356_1
                LD      L,$08
        ;; Use 8 for front doors, 4 for back
C356_1:         LD      A,B             ; L = (Flag - $10) >= $20 ? 8 : 4
                ADD     A,L
                LD      L,A             ; L = B + L
                SUB     $38
                LD      H,A             ; H = L - 56
                EX      AF,AF'
                LD      A,C
                LD      B,$08
                JR      NZ,C356_2
                LD      B,$04
        ;; Use 8 for left doors, 4 for right.
C356_2:         ADD     A,B             ; B = (Flag & 0x20) ? 8 : 4
                LD      C,A             ; C = C + B
                SUB     $0C
                LD      B,A             ; B = C - 12
                LD      A,$03           ; Always 3 bytes wide.
                LD      (SpriteWidth),A
                RET

;; Looks up based on SpriteCode. Top bit set means flip horizontally.
;; Return height in B, image in DE, mask in HL.
GetSpriteAddr:  LD      A,(SpriteCode)
                AND     $7F             ; Top bit holds 'reverse?'. Ignore.
                CP      $54             ; >= 0x54 -> 4x28
                JP      NC,Sprite4x28
                CP      $18             ; >= 0x18 -> 3x24
                JR      NC,Sprite3x24
                CP      $10             ; >= 0x10 -> 3x32
                LD      H,$00
                JR      NC,Sprite3x32
        ;; Special case stuff for 3x56:
                LD      L,A
                LD      DE,(CurrObject2+1)
                INC     DE
                INC     DE
        ;; Normal case if the object's flag & 3 != 3
                LD      A,(DE)
                OR      ~$03
                INC     A
                JR      NZ,Sprite3x56
        ;; flag & 3 == 3 case:
        ;; TODO: This gets mysterious...
                LD      A,(SpriteCode)
                LD      C,A
                RLA
                LD      A,(RoomShapeIdx); Check the shape of the room...
                JR      C,GSA_1         ; Flip bit set?
                CP      $06             ; Narrow-in-U-direction room?
                JR      GSA_2
GSA_1:          CP      $03             ; Narrow-in-V-direction room?
GSA_2:          JR      Z,Sprite3x56
        ;; Use DoorwayBuf.
        ;; TOOD: Occluded doorway case:
                LD      A,(DoorwayFlipped)
                XOR     C
                RLA
        ;; The data we'll return...
                LD      DE,DoorwayBuf
                LD      HL,DoorwayBuf + 56 * 3
                RET     NC
        ;; And flip it if necessary.
                LD      A,C
                LD      (DoorwayFlipped),A
                LD      B,56*2
                JR      FlipSprite3     ; Tail call

;; Deal with a 3 byte x sprite 56 pixels high.
;; Same parameters/return as GetSpriteAddr.
Sprite3x56:     LD      A,L
                LD      E,A
                ADD     A,A             ; 2x
                ADD     A,A             ; 4x
                ADD     A,E             ; 5x
                ADD     A,A             ; 10x
                LD      L,A
                ADD     HL,HL           ; 20x
                ADD     HL,HL           ; 40x
                ADD     HL,HL           ; 80x
                LD      A,E
                ADD     A,H
                LD      H,A             ; 336x = 3x56x2x
                LD      DE,IMG_3x56 - MAGIC_OFFSET
                ADD     HL,DE
                LD      DE,56*3         ; Point to mask
                LD      B,56*2          ; Height of image and mask
                JR      Sprite3Wide

;; Deal with a 3 byte x 32 pixel high sprite.
;; Same parameters/return as GetSpriteAddr.
;;
;; Returns a half-height offset sprite if bit 2 is not set, since the
;; 3x32 sprites are broken into 2 16-bit-high chunks.
Sprite3x32:     SUB     $10
                LD      L,A
                ADD     A,A             ; 2x
                ADD     A,L             ; 3x
                LD      L,A
                ADD     HL,HL           ; 3x2x
                ADD     HL,HL           ; 3x4x
                ADD     HL,HL           ; 3x8x
                ADD     HL,HL           ; 3x16x
                ADD     HL,HL           ; 3x32x
                ADD     HL,HL           ; 3x32x2x
                LD      DE,IMG_3x32 - MAGIC_OFFSET
                ADD     HL,DE
                LD      DE,32*3
                LD      B,32*2
                EX      DE,HL
                ADD     HL,DE
                EXX
                CALL    NeedsFlip
                EXX
                CALL    NC,FlipSprite3
        ;; If bit 2 is not set, move half a sprite down.
                LD      A,(SpriteFlags)
                AND     $02
                RET     NZ
                LD      BC,3*16
                ADD     HL,BC
                EX      DE,HL
                ADD     HL,BC
                EX      DE,HL
                RET

;; Deal with a 3 byte x 24 pixel high sprite
;; Same parameters/return as GetSpriteAddr.
Sprite3x24:     SUB     $18
                LD      D,A
                LD      E,$00
                LD      H,E
                ADD     A,A             ; 2x
                ADD     A,A             ; 4x
                LD      L,A
                ADD     HL,HL           ; 8x
                ADD     HL,HL           ; 16x
                SRL     D
                RR      E               ; 128x
                ADD     HL,DE           ; 144x = 3x24x2x
                LD      DE,IMG_3x24 - MAGIC_OFFSET
                ADD     HL,DE
                LD      DE,24*3
                LD      B,24*2
Sprite3Wide:    EX      DE,HL
                ADD     HL,DE
                EXX
                CALL    NeedsFlip
                EXX
                RET     C
        ;; NB: Fall-through.

;; Flip a 3-character-wide sprite. Height in B, source in DE.
FlipSprite3:    PUSH    HL
                PUSH    DE
                EX      DE,HL
                LD      D,RevTable >> 8
FS3_1:          LD      C,(HL)
                LD      (FS3_2+1),HL    ; Self-modifying code!
                INC     HL
                LD      E,(HL)
                LD      A,(DE)
                LD      (HL),A
                INC     HL
                LD      E,(HL)
                LD      A,(DE)
FS3_2:          LD      ($0000),A       ; Target of self-modifying code.
                LD      E,C
                LD      A,(DE)
                LD      (HL),A
                INC     HL
                DJNZ    FS3_1
                POP     DE
                POP     HL
                RET

;; Looks up a 4x28 sprite.
;; Same parameters/return as GetSpriteAddr.
Sprite4x28:     SUB     $54
                LD      D,A
                RLCA                    ; 2x
                RLCA                    ; 4x
                LD      H,$00
                LD      L,A
                LD      E,H
                ADD     HL,HL           ; 8x
                ADD     HL,HL           ; 16x
                ADD     HL,HL           ; 32x
                EX      DE,HL
                SBC     HL,DE           ; 224x = 4x28x2x
                LD      DE,IMG_4x28 - MAGIC_OFFSET
                ADD     HL,DE
                LD      DE,28*4
                LD      B,28*2
                EX      DE,HL
                ADD     HL,DE
                EXX
                CALL    NeedsFlip
                EXX
                RET     C               ; NB: Fall through

;; Flip a 4-character-wide sprite. Height in B, source in DE.
FlipSprite4:    PUSH    HL
                PUSH    DE
                EX      DE,HL
                LD      D,RevTable >> 8
FS4_1:          LD      C,(HL)
                LD      (FS4_2+1),HL    ; Self-modifying code
                INC     HL
                LD      E,(HL)
                INC     HL
                LD      A,(DE)
                LD      E,(HL)
                LD      (HL),A
                DEC     HL
                LD      A,(DE)
                LD      (HL),A
                INC     HL
                INC     HL
                LD      E,(HL)
                LD      A,(DE)
FS4_2:          LD      ($0000),A       ; Target of self-modifying code
                LD      E,C
                LD      A,(DE)
                LD      (HL),A
                INC     HL
                DJNZ    FS4_1
                POP     DE
                POP     HL
                RET

;; Look up the sprite in the bitmap, returns with C set if the top bit of
;; SpriteCode matches the bitmap, otherwise updates the bitmap (assumes
;; that the caller will flip the sprite if we return NC). In effect, a
;; simple cache.
NeedsFlip:      LD      A,(SpriteCode)
                LD      C,A
                AND     $07
                INC     A
                LD      B,A
                LD      A,$01
NF_1:           RRCA
                DJNZ    NF_1
                LD      B,A             ; B now contains bitmask from low 3 bits of SpriteCode
                LD      A,C
                RRA
                RRA
                RRA
                AND     $0F             ; A contains next 4 bits.
                LD      E,A
                LD      D,$00
                LD      HL,SpriteFlips - MAGIC_OFFSET
                ADD     HL,DE
                LD      A,B
                AND     (HL)            ; Perform bit-mask look-up
                JR      Z,NF_2          ; Bit set?
                RL      C               ; Bit was non-zero
                RET     C
                LD      A,B
                CPL
                AND     (HL)
                LD      (HL),A          ; If top bit of SpriteCode wasn't set, reset bit mask
                RET
NF_2:           RL      C               ; Bit was zero
                CCF
                RET     C
                LD      A,B
                OR      (HL)
                LD      (HL),A          ; If top bit of SpriteCode was set, set bit mask
                RET

;; Are the contents of DoorwayBuf flipped?
DoorwayFlipped: DEFB $00

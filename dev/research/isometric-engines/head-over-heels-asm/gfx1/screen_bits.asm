;;
;; screen_bits.asm
;;
;; Various screen- and sprite-related utilities
;;

;; Exported functions:
;;  * ApplyAttribs
;;  * ScreenWipe
;;  * DrawSprite
;;  * GetScrMemAddr

;; Takes a B = Y, C = X single-pixel coordinate. Real Spectrum screen
;; coords - top left is (0,0).
;;
;; Returns a pointer to corresponding bitmap address in DE.
GetScrMemAddr:  LD      A,B
                AND     A
                RRA
                SCF
                RRA
                AND     A
                RRA
        ;; A is now B >> 3 | 0x40
                XOR     B
                AND     $F8
                XOR     B
                LD      D,A
        ;; D is now ((B >> 3) | 0x40) & ~0x07  |  B & 0x07
                LD      A,C
                RLCA
                RLCA
                RLCA
        ;; A is now C << 3 | C >> 5
                XOR     B
                AND     $C7
                XOR     B
        ;; A is now (C << 3 | C >> 5) & ~0x38  |  B & 0x38
                RLCA
                RLCA
                LD      E,A
        ;; E is now C >> 3  |  (B << 2) & 0xE0
                RET

;; Screen-wipe loop
ScreenWipe:     LD      E,$04
SW_0:           LD      HL,$4000
                LD      BC,$1800
                PUSH    AF
        ;; This loop smears to the right...
SW_1:           POP     AF
                LD      A,(HL)
                RRA
                PUSH    AF
                AND     (HL)
                LD      (HL),A
        ;; (Delay loop)
                LD      D,$0C
SW_2:           DEC     D
                JR      NZ,SW_2
                INC     HL
                DEC     BC
                LD      A,B
                OR      C
                JR      NZ,SW_1
        ;; This loop smears to the left...
                LD      BC,$1800
SW_3:           DEC     HL
                POP     AF
                LD      A,(HL)
                RLA
                PUSH    AF
                AND     (HL)
                LD      (HL),A
        ;; (Delay loop)
                LD      D,$0C
SW_4:           DEC     D
                JR      NZ,SW_4
                DEC     BC
                LD      A,B
                OR      C
                JR      NZ,SW_3
                POP     AF
                DEC     E
        ;; And loop until fully wiped...
                JR      NZ,SW_0
                LD      HL,$4000
                LD      BC,$1800
                JP      FillZero        ; Tail call

;; Draw a sprite, with attributes.
;; Source in DE, dest coords in BC, size in HL, Attribute style in A
;; (H = Y, L = X, X measured in double-pixels, centered on $80)
;; Top of screen is Y = 0, for once.
DrawSprite:     PUSH    AF
                PUSH    BC
                PUSH    DE
                XOR     A
                LD      (BlitYOffset+1),A       ; Zero Y offset for the BlitScreen call
        ;; Initialise sprite extents from origin and size.
                LD      D,B
                LD      A,B
                ADD     A,H
                LD      E,A
                LD      (ViewYExtent),DE
                LD      A,C
                LD      B,C
                ADD     A,L
                LD      C,A
                LD      (ViewXExtent),BC
                LD      A,L
        ;; Put width in bytes into L
                RRCA
                RRCA
                AND     $07
                LD      L,A
        ;; Restore source, save byte-oriented size.
                POP     DE
                PUSH    HL
        ;; First, copy sprite into ViewBuff...
                LD      C,A
                LD      A,H
                LD      HL,ViewBuff
        ;; At this point, byte width in C, height in A
        ;; Y loop of copy
DRS_1:          EX      AF,AF'
                LD      B,C
        ;; X loop of copy
DRS_2:          LD      A,(DE)
                LD      (HL),A
                INC     L
                INC     DE
                DJNZ    DRS_2
        ;; ViewBuff is 6 bytes wide...
                LD      A,$06
                SUB     C
                ADD     A,L
                LD      L,A
                EX      AF,AF'
                DEC     A
                JR      NZ,DRS_1
        ;; Image is now in ViewBuff, blit to screen.
                CALL    BlitScreen
        ;; Prepare to do the attributes
                POP     HL              ; Restore byte-oriented size.
                POP     BC              ; Restore double-pixel-oriented origin.
                LD      A,C
                SUB     $40
                ADD     A,A
                LD      C,A             ; BC now contains single-pixel-oriented origin.
                CALL    GetScrMemAddr
                CALL    ToAttrAddr      ; DE now contains pointer to starting attribute.
                LD      A,H             ; Divide height by 8, as we're working with attributes...
                RRA
                RRA
                RRA
                AND     $1F
                LD      H,A
                POP     AF              ; Now get attribute style.
                ADD     A,Attrib0 & $FF
                LD      C,A
                ADC     A,Attrib0 >> 8
                SUB     C
                LD      B,A
                LD      A,(BC)          ; Fetch Attrib0[A] (= AttribA).
        ;; Now actually do the attribute-writing work
                EX      DE,HL
        ;; D now holds height, E width, HL starting point.
        ;; Outer, vertical loop.
DRS_3:          LD      B,E
        ;; Row-drawing loop.
                LD      C,L             ; Save start point.
DRS_4:          LD      (HL),A
                INC     L
                DJNZ    DRS_4
                LD      L,C             ; Restore start point
                LD      BC,$0020
                ADD     HL,BC           ; Move down a row.
                DEC     D
                JR      NZ,DRS_3        ; Repeat as necessary.
        ;; Restore original Y offset for the BlitScreen call
                LD      A,Y_START
                LD      (BlitYOffset+1),A
                RET

;; Converts a bitmap address to its corresponding attribute address.
;; Works on an address in DE.
;; Divide by 8, take bottom 2 bits, tack on $58 (top byte of attribute table address)
ToAttrAddr:     LD      A,D
                RRA
                RRA
                RRA
                AND     $03
                OR      $58
                LD      D,A
                RET

;; Draw the diagonal edge-of-screen attribute lines.
ApplyAttribs:
        ;; Convert RoomOrigin's coordinates to screen coords,
        ;; and then memory address.
                LD      BC,(RoomOrigin)
                LD      A,C
                SUB     $40
                ADD     A,A
                LD      C,A
                LD      A,B
                SUB     Y_START - EDGE_HEIGHT   ; Floor of $C0 becomes Y = 131.
                LD      B,A
                CALL    GetScrMemAddr
        ;; Save high byte of address in L, and convert to attribute address
                LD      L,D
                CALL    ToAttrAddr
                EX      DE,HL           ; Addr now in HL, saved high byte in E

                PUSH    HL
        ;; Write out AttribR over HL, in a diagonal line up the right, 2:1 gradient.
                LD      A,L
                AND     $1F
                NEG
                ADD     A,$20
                LD      B,A             ; Initialise count using X coordinate.
                LD      A,(AttribR)
                LD      C,A
                CALL    ApplyAttribsR

                POP     HL
        ;; Write out AttribL over HL, in a diagonal line up the left, 2:1 gradient.
                LD      A,L
                DEC     L
                AND     $1F
                LD      B,A             ; Initialise count with X coordinate from address.
                LD      A,(AttribL)
                LD      C,A
        ;; NB: Fall through

;; Draws a diagonal line up-and-left by alternating moving L and U-then-L.
;; Parameters:
;;  E  - Bit 2 is checked to see if we start with up and left, or just up.
;;  C  - Attribute to write
;;  B  - Count of how many to write
;;  HL - Destination address
;; E is populated from the high bit of the upper part of the screen address -
;; i.e. even vs odd attribute row number.
ApplyAttribsL:
                BIT     2,E
                JR      Z,AAL_2         ; Do we start with up and left, or left?
AAL_1:          LD      (HL),C
                DEC     B
                RET     Z
        ;; Left one
                DEC     L
AAL_2:          LD      (HL),C
        ;; Up one line
                LD      A,L
                SUB     $20
                LD      L,A
                JR      NC,AAL_3
                DEC     H
AAL_3:          LD      (HL),C
        ;; Left one
                DEC     L
                DJNZ    AAL_1
                RET

;; Draws a diagonal line up-and-right by alternating moving R and U-then-R.
;; Parameters:
;;  E  - Bit 2 is checked to see if we start with up and right, or just up.
;;  C  - Attribute to write
;;  B  - Count of how many to write
;;  HL - Destination address
;; E is populated from the high bit of the upper part of the screen address -
;; i.e. even vs odd attribute row number.
ApplyAttribsR:  BIT     2,E
                JR      Z,AAR_2         ; Do we start with up and right or up?
AAR_1:          LD      (HL),C
                DEC     B
                RET     Z
        ;; Right one
                INC     L
AAR_2:          LD      (HL),C
        ;; Up one line
                LD      A,L
                SUB     $20
                LD      L,A
                JR      NC,AAR_3
                DEC     H
AAR_3:          LD      (HL),C
        ;; Right one
                INC     L
                DJNZ    AAR_1
                RET

;;
;; blit_screen.asm
;;
;; Copy image from buffer to screen.
;;

;; Exported functions:
;; * BlitScreen

;; Exported variables:
;; * BlitYOffset

;; Y coordinate of first line of the display.
Y_START:        EQU $48

;; BlitScreen copies from ViewBuff to the screen coordinates of
;; ViewYExtent and ViewXExtent. The X extent can be up to 6 bytes (24
;; double pixels).
;;
;; ViewBuff must be arranged as 6 bytes wide, and the Y origin can
;; be adjusted by overwriting BlitYOffset. It is usually Y_START, but
;; is set to 0 during DrawSprite. The X origin is always fixed at 0x40
;; in double-width pixels.
BlitScreen:
        ;; Construct X coordinate: 2 * (XHigh) - $80
                LD      HL,(ViewXExtent)
                LD      A,H
                SUB     $40
                ADD     A,A
                LD      C,A
        ;; Push the function to blit the appropriate width
                LD      A,L
                SUB     H
                RRA
                RRA
                AND     $07             ; Width = ((XHigh) - (XLow)) >> 2 & 0x7
                DEC     A
                ADD     A,A
                LD      E,A
                LD      D,$00
                LD      HL,CoordLut
                ADD     HL,DE
                LD      E,(HL)
                INC     HL
                LD      D,(HL)
                PUSH    DE              ; Push CoordLut[Width-1]
        ;; Construct height: (YHigh) - (YLow)
                LD      HL,(ViewYExtent)
                LD      A,L
                SUB     H
                EX      AF,AF'
        ;; Construct Y coordinate: (YLow) - $48
                LD      A,H
BlitYOffset:    SUB     $48             ; Target of self-modifying code
                LD      B,A
                CALL    GetScrMemAddr
        ;; Screen address now in DE
                EX      AF,AF'
        ;; Height in B, $FF in C.
                LD      B,A
                LD      C,$FF
                LD      HL,ViewBuff
        ;; Oooh, clever - tail call the blitter.
                RET

CoordLut:       DEFW BlitScreen1,BlitScreen2,BlitScreen3,BlitScreen4,BlitScreen5,BlitScreen6

;; BlitScreenN copies an N-byte-wide image to the screen.
;; Copy from HL to DE, size in rows in B.
;;
;; Assumes HL buffer is 6 bytes wide, and DE is a screen
;; location (no clipping).

BlitScreen1:    LDI
                INC     L
                INC     L
                INC     L
                INC     L
                INC     L
                DEC     DE
                INC     D
                LD      A,D
                AND     $07
                JR      Z,BlitScreen1Adj
                DJNZ    BlitScreen1
                RET
        ;; This bit deals with the update every eight-line
        ;; boundary. In short, it adds 32 onto the low-byte, and removes
        ;; 8 onto the top byte (going back in the interleaved fashion)
        ;; unless we had a carry, in which case it's onto the next screen
        ;; third so we don't subtract anything.
BlitScreen1Adj: LD      A,E
                ADD     A,$20
                LD      E,A
                CCF
                SBC     A,A
                AND     $F8
                ADD     A,D
                LD      D,A
                DJNZ    BlitScreen1
                RET

BlitScreen2:    LDI
                LDI
                INC     L
                INC     L
                INC     L
                INC     L
                DEC     DE
                DEC     E
                INC     D
                LD      A,D
                AND     $07
                JR      Z,BlitScreen2Adj
                DJNZ    BlitScreen2
                RET
BlitScreen2Adj: LD      A,E
                ADD     A,$20
                LD      E,A
                CCF
                SBC     A,A
                AND     $F8
                ADD     A,D
                LD      D,A
                DJNZ    BlitScreen2
                RET

BlitScreen3:    LDI
                LDI
                LDI
                INC     L
                INC     L
                INC     L
                DEC     DE
                DEC     E
                DEC     E
                INC     D
                LD      A,D
                AND     $07
                JR      Z,BlitScreen3Adj
                DJNZ    BlitScreen3
                RET
BlitScreen3Adj: LD      A,E
                ADD     A,$20
                LD      E,A
                CCF
                SBC     A,A
                AND     $F8
                ADD     A,D
                LD      D,A
                DJNZ    BlitScreen3
                RET

BlitScreen4:    LDI
                LDI
                LDI
                LDI
                INC     L
                INC     L
                DEC     DE
                DEC     E
                DEC     E
                DEC     E
                INC     D
                LD      A,D
                AND     $07
                JR      Z,BlitScreen4Adj
                DJNZ    BlitScreen4
                RET
BlitScreen4Adj: LD      A,E
                ADD     A,$20
                LD      E,A
                CCF
                SBC     A,A
                AND     $F8
                ADD     A,D
                LD      D,A
                DJNZ    BlitScreen4
                RET

BlitScreen5:    PUSH    DE
                LDI
                LDI
                LDI
                LDI
                LDI
                INC     L
                POP     DE
                INC     D
                LD      A,D
                AND     $07
                JR      Z,BlitScreen5Adj
                DJNZ    BlitScreen5
                RET
BlitScreen5Adj: LD      A,E
                ADD     A,$20
                LD      E,A
                CCF
                SBC     A,A
                AND     $F8
                ADD     A,D
                LD      D,A
                DJNZ    BlitScreen5
                RET

BlitScreen6:    PUSH    DE
                LDI
                LDI
                LDI
                LDI
                LDI
                LDI
                POP     DE
                INC     D
                LD      A,D
                AND     $07
                JR      Z,BlitScreen6Adj
                DJNZ    BlitScreen6
                RET
BlitScreen6Adj: LD      A,E
                ADD     A,$20
                LD      E,A
                CCF
                SBC     A,A
                AND     $F8
                ADD     A,D
                LD      D,A
                DJNZ    BlitScreen6
                RET

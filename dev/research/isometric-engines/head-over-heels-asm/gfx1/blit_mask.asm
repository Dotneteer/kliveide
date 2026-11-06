;;
;; blit_mask.asm
;;
;; Masked blit into an offscreen buffer.
;;

;; Exported functions:
;; * BlitMaskXofX

;; BlitMaskNofM does a masked blit into a dest buffer assumed 6 bytes wide.
;; The blit is from a source N bytes wide in a buffer M bytes wide.
;; The height is in B.
;; Destination is BC', source image is in DE', mask is in HL'.

BlitMask1of3:   EXX
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     HL
                INC     DE
                LD      A,C
                ADD     A,$06
                LD      C,A
                INC     HL
                INC     DE
                INC     HL
                INC     DE
                EXX
                DJNZ    BlitMask1of3
                RET

BlitMask2of3:   EXX
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     C
                INC     HL
                INC     DE
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     HL
                INC     DE
                LD      A,C
                ADD     A,$05
                LD      C,A
                INC     HL
                INC     DE
                EXX
                DJNZ    BlitMask2of3
                RET

BlitMask3of3:   EXX
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     C
                INC     HL
                INC     DE
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     C
                INC     HL
                INC     DE
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     HL
                INC     DE
                LD      A,C
                ADD     A,$04
                LD      C,A
                EXX
                DJNZ    BlitMask3of3
                RET

BlitMask1of4:   EXX
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     HL
                INC     DE
                LD      A,C
                ADD     A,$06
                LD      C,A
                INC     HL
                INC     DE
                INC     HL
                INC     DE
                INC     HL
                INC     DE
                EXX
                DJNZ    BlitMask1of4
                RET

BlitMask2of4:   EXX
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     C
                INC     HL
                INC     DE
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     HL
                INC     DE
                LD      A,C
                ADD     A,$05
                LD      C,A
                INC     HL
                INC     DE
                INC     HL
                INC     DE
                EXX
                DJNZ    BlitMask2of4
                RET

BlitMask3of4:   EXX
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     C
                INC     HL
                INC     DE
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     C
                INC     HL
                INC     DE
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     HL
                INC     DE
                LD      A,C
                ADD     A,$04
                LD      C,A
                INC     HL
                INC     DE
                EXX
                DJNZ    BlitMask3of4
                RET

BlitMask4of4:   EXX
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     C
                INC     HL
                INC     DE
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     C
                INC     HL
                INC     DE
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     C
                INC     HL
                INC     DE
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     HL
                INC     DE
                INC     C
                INC     C
                INC     C
                EXX
                DJNZ    BlitMask4of4
                RET

BlitMask1of5:   EXX
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     HL
                INC     DE
                LD      A,C
                ADD     A,$06
                LD      C,A
                INC     HL
                INC     DE
                INC     HL
                INC     DE
                INC     HL
                INC     DE
                INC     HL
                INC     DE
                EXX
                DJNZ    BlitMask1of5
                RET

BlitMask2of5:   EXX
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     C
                INC     HL
                INC     DE
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     HL
                INC     DE
                LD      A,C
                ADD     A,$05
                LD      C,A
                INC     HL
                INC     DE
                INC     HL
                INC     DE
                INC     HL
                INC     DE
                EXX
                DJNZ    BlitMask2of5
                RET

BlitMask3of5:   EXX
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     C
                INC     HL
                INC     DE
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     C
                INC     HL
                INC     DE
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     HL
                INC     DE
                LD      A,C
                ADD     A,$04
                LD      C,A
                INC     HL
                INC     DE
                INC     HL
                INC     DE
                EXX
                DJNZ    BlitMask3of5
                RET

BlitMask4of5:   EXX
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     C
                INC     HL
                INC     DE
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     C
                INC     HL
                INC     DE
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     C
                INC     HL
                INC     DE
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     HL
                INC     DE
                INC     C
                INC     C
                INC     C
                INC     HL
                INC     DE
                EXX
                DJNZ    BlitMask4of5
                RET

BlitMask5of5:   EXX
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     C
                INC     HL
                INC     DE
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     C
                INC     HL
                INC     DE
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     C
                INC     HL
                INC     DE
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     C
                INC     HL
                INC     DE
                LD      A,(BC)
                AND     (HL)
                EX      DE,HL
                OR      (HL)
                EX      DE,HL
                LD      (BC),A
                INC     HL
                INC     DE
                INC     C
                INC     C
                EXX
                DJNZ    BlitMask5of5
                RET

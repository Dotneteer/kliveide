;;
;; depthcmp.asm
;;
;; Provides a single, long-winded function to depth-order two set of
;; UVZ extents.
;;

;; Exported functions:
;;  * DepthCmp

;; Two set of UVZ extents (as returned from GetUVZExtents), in main
;; and EXX'd registers.
;;
;; Returns:
;;  Carry set if EXX'd registers represent a further-away object.
;;  A = 0 if there's an overlap in 2 dimensions, $FF otherwise
DepthCmp:
        ;; L < H' && H > L' -> U Overlap
                LD      A,L
                EXX
                CP      H
                LD      A,L
                EXX
                JR      NC,NoUOverlap
                CP      H
                JR      C,UOverlap
NoUOverlap:
        ;; E < D' && D > E' -> V Overlap
                LD      A,E
                EXX
                CP      D
                LD      A,E
                EXX
                JR      NC,NoUVOverlap
                CP      D
                JR      C,VNoUOverlap
NoUVOverlap:
        ;; C < B' && B > C' -> Z Overlap
                LD      A,C
                EXX
                CP      B
                LD      A,C
                EXX
                JR      NC,NoUVZOverlap
                CP      B
                JR      C,ZNoUVOverlap
NoUVZOverlap:
        ;; No overlaps at all - simple depth comparison
        ;; HL = U + V + Z (lower coords)
                LD      A,L
                ADD     A,E
                ADD     A,C
                LD      L,A
                ADC     A,$00
                SUB     L
                LD      H,A
        ;; DE = U' + V' + Z' (lower co-ords)
                EXX
                LD      A,L
                ADD     A,E
                ADD     A,C
                EXX
                LD      E,A
                ADC     A,$00
                SUB     E
                LD      D,A
        ;; Compare depths
                SBC     HL,DE
                LD      A,$FF
                RET

ZNoUVOverlap:
        ;; Overlaps in Z, not U or V. In this case, we compare on U + V
                LD      A,L
                ADD     A,E
                LD      L,A
                EXX
                LD      A,L
                ADD     A,E
                EXX
                CP      L
                CCF
                LD      A,$FF
                RET

UOverlap:
        ;; E < D' && D > E' -> V Overlap
                LD      A,E
                EXX
                CP      D
                LD      A,E
                EXX
                JR      NC,UNoVOverlap
                CP      D
                JR      C,UVOverlap
UNoVOverlap:
        ;; C < B' && B > C' -> Z Overlap
                LD      A,C
                EXX
                CP      B
                LD      A,C
                EXX
                JR      NC,UNoVZOverlap
                CP      B
                JR      C,UZNoVOverlap
UNoVZOverlap:
        ;; Compare on Z  + V
                EXX
                ADD     A,E
                EXX
                LD      L,A
                ADC     A,$00
                SUB     L
                LD      H,A
                LD      A,C
                ADD     A,E
                LD      E,A
                ADC     A,$00
                SUB     E
                LD      D,A
                SBC     HL,DE
                CCF
                LD      A,$FF
                RET

UZNoVOverlap:
        ;; Compare on V
                LD      A,E
                EXX
                CP      E
                EXX
                LD      A,$00
                RET

UVOverlap:
        ;; Compare on Z
                LD      A,C
                EXX
                CP      C
                EXX
                LD      A,$00
                RET

VNoUOverlap:
        ;; C < B' && B > C' -> Z Overlap
                LD      A,C
                EXX
                CP      B
                LD      A,C
                EXX
                JR      NC,VNoUZOverlap
                CP      B
                JR      C,VZNoUOverlap
VNoUZOverlap:
        ;; Compare on U + Z
                EXX
                ADD     A,L
                EXX
                LD      E,A
                ADC     A,$00
                SUB     E
                LD      D,A
                LD      A,C
                ADD     A,L
                LD      L,A
                ADC     A,$00
                SUB     L
                LD      H,A
                SBC     HL,DE
                LD      A,$FF
                RET

VZNoUOverlap:
        ;; Compare on U
                LD      A,L
                EXX
                CP      L
                EXX
                LD      A,$00
                RET

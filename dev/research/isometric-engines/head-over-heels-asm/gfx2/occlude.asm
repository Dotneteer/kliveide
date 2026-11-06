;;
;; occlude.asm
;;
;; Perform occlusion of the edge of the doorway sprite by the
;; background panels.
;;

;; Takes sprite codes in HL and a height in A, and applies truncation
;; of the third column A * 2 + from the top of the column. This
;; performs removal of the bits of the door hidden by the walls.
;; If the door is raised, more of the frame is visible, so A is
;; the height of the door.
OccludeDoorway:
        ;; Copy the sprite (and mask) indexed by L to DoorwayBuf
                PUSH    AF
                LD      A,L
                LD      H,$00
                LD      (SpriteCode),A
                CALL    Sprite3x56
                EX      DE,HL
                LD      DE,DoorwayBuf
                PUSH    DE
                LD      BC, 56 * 3 * 2
                LDIR
                POP     HL
                POP     AF
        ;; A = Min(A * 2 + 8, 0x38)
                ADD     A,A
                ADD     A,$08
                CP      $39
                JR      C,ODW
                LD      A,$38
        ;; A *= 3
ODW:            LD      B,A
                ADD     A,A
                ADD     A,B
        ;; DE = Top of sprite + A
        ;; HL = Top of mask + A
                LD      E,A
                LD      D,$00
                ADD     HL,DE
                EX      DE,HL
                LD      HL, 56 * 3
                ADD     HL,DE
        ;; B = $39 - A
                LD      A,B
                NEG
                ADD     A,$39
                LD      B,A
        ;; C = ~$03
                LD      C,$FC
                JR      ODW3
        ;; This loop then cuts off a wedge from the right-hand side,
        ;; presumably to give a nice trunction of the image?
ODW2:           LD      A,(DE)
                AND     C
                LD      (DE),A
                INC     DE
                INC     DE
                INC     DE
                LD      A,C
                CPL
                OR      (HL)
                LD      (HL),A
                INC     HL
                INC     HL
                INC     HL
                AND     A
                RL      C
                AND     A
                RL      C
ODW3:           DJNZ    ODW2
        ;; Clear the flipped flag for this copy.
                XOR     A
                LD      (DoorwayFlipped),A
                RET

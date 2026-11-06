;;
;; blit_rot.asm
;;
;; Blit with rotation into an offscreen buffer
;;

;; Exported functions:
;; * BlitRot

;; Given sprite data, return a rotated version of it.
;;
;; A holds the rotation size (in 2-bit units).
;; At start, HL holds source image, DE hold mask image.
;; At end, HL holds dest image, DE holds mask image.
;; A' is incremented.
;;
;; The sprite width and number of bytes are read from SpriteWidth and
;; SpriteRowCount. SpriteWidth is incremented.
;; Uses 'Buffer'.
BlitRot:        DEC     A
                ADD     A,A
                EXX
        ;; Load rotation size into BC, and function table into HL.
                LD      C,A
                LD      B,$00
                LD      A,(SpriteWidth)
                INC     A
                LD      (SpriteWidth),A ; Increase sprite width, now we have rotation.
                CP      $05
                LD      HL,BlitRot3s    ; Default to BlitRot on 3 case.
                JR      NZ,BR_1
                LD      HL,BlitRot4s    ; SpriteWidth was 4 -> Use the BlitRot on 4 case.
BR_1:           ADD     HL,BC
        ;; Dereference function pointer into HL.
                LD      A,(HL)
                INC     HL
                LD      H,(HL)
                LD      L,A
        ;; And modify the code.
                LD      (BR_2+1),HL
                LD      (BR_3+1),HL
                EXX
                EX      AF,AF'
                PUSH    AF
        ;; Time to rotate the sprite.
                LD      A,(SpriteRowCount)
                PUSH    DE
                LD      DE,Buffer
                LD      B,$00           ; Blank space in the filler.
BR_2:           CALL    $0000           ; NB: Target of self-modifying code.
        ;; HL now holds the end of the destination buffer.
                EX      DE,HL
                POP     HL
                PUSH    DE
        ;; And to rotate the mask.
                LD      A,(SpriteRowCount)
                LD      B,$FF           ; Appropriate filler for the mask.
BR_3:           CALL    $0000           ; NB: Target of self-modifying code.
                LD      HL,Buffer
                POP     DE
                POP     AF
                INC     A
                EX      AF,AF'
                RET

BlitRot3s:      DEFW BlitRot2on3,BlitRot4on3,BlitRot6on3
BlitRot4s:      DEFW BlitRot2on4,BlitRot4on4,BlitRot6on4

;; Do a copy with 2-bit shift.
;; Source HL, width 3 bytes.
;; Destination DE, width 4 bytes.
;; A contains byte-count, B contains filler character
;; Returns next space after destination write in HL
BlitRot2on3:    PUSH    DE
BR2o3:          EX      AF,AF'
        ;; Load filler and 3 bytes of data in E, A, C, D.
                LD      E,B
                LD      A,(HL)
                INC     HL
                LD      C,(HL)
                INC     HL
                LD      D,(HL)
                INC     HL
        ;; Now shuffle 1 bit around, twice.
                RRC     E
                RRA
                RR      C
                RR      D
                RR      E
                RRA
                RR      C
                RR      D
                RR      E
        ;; And write out (saved DE in (SP) earlier).
                EX      (SP),HL
                LD      (HL),A
                INC     HL
                LD      (HL),C
                INC     HL
                LD      (HL),D
                INC     HL
                LD      (HL),E
                INC     HL
                EX      (SP),HL
        ;; Check counter, repeat until done.
                EX      AF,AF'
                DEC     A
                JR      NZ,BR2o3
                POP     HL
                RET

;; Do a copy with 6-bit shift.
;; Source HL, width 3 bytes.
;; Destination DE, width 4 bytes.
;; A contains byte-count, B contains filler character
;; Returns next space after destination write in HL
BlitRot6on3:    PUSH    DE
BR6o3:          EX      AF,AF'
        ;; Load filler and 3 bytes of data in E, A, C, D.
                LD      E,B
                LD      A,(HL)
                INC     HL
                LD      C,(HL)
                INC     HL
                LD      D,(HL)
                INC     HL
        ;; Now shuffle 1 bit around, twice.
                RLC     E
                RL      D
                RL      C
                RLA
                RL      E
                RL      D
                RL      C
                RLA
                RL      E
        ;; And write out (saved DE in (SP) earlier).
                EX      (SP),HL
                LD      (HL),E
                INC     HL
                LD      (HL),A
                INC     HL
                LD      (HL),C
                INC     HL
                LD      (HL),D
                INC     HL
                EX      (SP),HL
        ;; Check counter, repeat until done.
                EX      AF,AF'
                DEC     A
                JR      NZ,BR6o3
                POP     HL
                RET

;; Do a copy with 4-bit shift.
;; Source HL, width 3 bytes.
;; Destination DE, width 4 bytes.
;; A contains byte-count, B contains filler character
;; Returns next space after destination write in HL
BlitRot4on3:    LD      C,B
                LD      B,A
                LD      A,C     ; Swapped A and B.
        ;; Phase 1: Copy from HL to DE:
                PUSH    BC
                LD      C,$FF
                PUSH    DE
BR4o3_1:        LDI
                LDI
                LDI
                LD      (DE),A
                INC     DE
                DJNZ    BR4o3_1
                POP     HL
                POP     BC
        ;; Phase 2: Rotate right, 4 bits at a time, over the destination (now in HL).
                LD      A,C
BR4o3_2:        RRD
                INC     HL
                RRD
                INC     HL
                RRD
                INC     HL
                RRD
                INC     HL
                DJNZ    BR4o3_2
                RET

;; Do a copy with 2-bit shift.
;; Source HL, width 3 bytes.
;; Destination DE, width 4 bytes.
;; A contains byte-count, B contains filler character
;; Returns next space after destination write in HL
BlitRot2on4:    PUSH    DE
                LD      C,$1E        ; Opcode for 'LD E,'
                LD      (BR2o4_2),BC ; Modify target instruction to load filler into E.
BR2o4_1:        EX      AF,AF'
        ;; Load filler and 4 bytes of data in E, A, B, C, D.
BR2o4_2:        LD      E,$00   ; NB: Target of self-modifying code.
                LD      A,(HL)
                INC     HL
                LD      B,(HL)
                INC     HL
                LD      C,(HL)
                INC     HL
                LD      D,(HL)
                INC     HL
        ;; Now shuffle 1 bit around, twice.
                RRC     E
                RRA
                RR      B
                RR      C
                RR      D
                RR      E
                RRA
                RR      B
                RR      C
                RR      D
                RR      E
        ;; And write out (saved DE in (SP) earlier).
                EX      (SP),HL
                LD      (HL),A
                INC     HL
                LD      (HL),B
                INC     HL
                LD      (HL),C
                INC     HL
                LD      (HL),D
                INC     HL
                LD      (HL),E
                INC     HL
                EX      (SP),HL
        ;; Check counter, repeat until done.
                EX      AF,AF'
                DEC     A
                JR      NZ,BR2o4_1
                POP     HL
                RET

;; Do a copy with 6-bit shift.
;; Source HL, width 3 bytes.
;; Destination DE, width 4 bytes.
;; A contains byte-count, B contains filler character
;; Returns next space after destination write in HL
BlitRot6on4:    PUSH    DE
                LD      C,$1E           ; Opcode for 'LD E,'
                LD      (BR6on4_2),BC   ; Modify target instruction to load filler into E.
BR6on4_1:       EX      AF,AF'
        ;; Load filler and 4 bytes of data in E, A, B, C, D.
BR6on4_2:       LD      E,$00           ; NB: Target of self-modifying code.
                LD      A,(HL)
                INC     HL
                LD      B,(HL)
                INC     HL
                LD      C,(HL)
                INC     HL
                LD      D,(HL)
                INC     HL
        ;; Now shuffle 1 bit around, twice.
                RLC     E
                RL      D
                RL      C
                RL      B
                RLA
                RL      E
                RL      D
                RL      C
                RL      B
                RLA
                RL      E
        ;; And write out (saved DE in (SP) earlier).
                EX      (SP),HL
                LD      (HL),E
                INC     HL
                LD      (HL),A
                INC     HL
                LD      (HL),B
                INC     HL
                LD      (HL),C
                INC     HL
                LD      (HL),D
                INC     HL
                EX      (SP),HL
        ;; Check counter, repeat until done.
                EX      AF,AF'
                DEC     A
                JR      NZ,BR6on4_1
                POP     HL
                RET

;; Do a copy with 4-bit shift.
;; Source HL, width 3 bytes.
;; Destination DE, width 4 bytes.
;; A contains byte-count, B contains filler character
;; Returns next space after destination write in HL
BlitRot4on4:    LD      C,B
                LD      B,A
                LD      A,C     ; Swapped A and B.
        ;; Phase 1: Copy from HL to DE:
                PUSH    BC
                LD      C,$FF
                PUSH    DE
BR4o4_1:        LDI
                LDI
                LDI
                LDI
                LD      (DE),A
                INC     DE
                DJNZ    BR4o4_1
                POP     HL
                POP     BC
        ;; Phase 2: Rotate right, 4 bits at a time, over the destination (now in HL).
BR4o4_2:        RRD
                INC     HL
                RRD
                INC     HL
                RRD
                INC     HL
                RRD
                INC     HL
                RRD
                INC     HL
                DJNZ    BR4o4_2
                RET

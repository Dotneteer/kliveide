;;
;; init_bkgnd.asm
;;
;; Initialise variables used by background-drawing.
;;

;; Exports GetScreenEdges

;; Uses the following variables and functions:
;; * BkgndData
;; * CornerPos
;; * HasDoor
;; * LeftAdj
;; * MinU
;; * RightAdj
;; * TweakEdges

GetScreenEdges: LD      HL,(MinU)       ; MinU in L, MinV in H.
                LD      A,(HasDoor)
                PUSH    AF
                BIT     1,A
                JR      Z,GSE_1
        ;; If there's a door, bump up MinV.
                DEC     H
                DEC     H
                DEC     H
                DEC     H
GSE_1:          RRA
                LD      A,L
                JR      NC,GSE_2
        ;; If there's the other door, reduce MinU.
                SUB     $04
                LD      L,A
        ;; Find MinU - MinV
GSE_2:          SUB     H
        ;; And use this to set the X coordinate of the corner.
                ADD     A,$80
                LD      (CornerPos+1),A
                LD      C,A                      ; Save in C for TweakEdges
        ;; Then set the Y coordinate of the corner, taking into
        ;; account various fudge factors.
                LD      A,Y_START + $C0 - EDGE_HEIGHT - 1
                SUB     H
                SUB     L
        ;; Save Y coordinate of the corner in B for TweakEdges
                LD      B,A
        ;; Then generate offsets to convert from screen X coordinates to
        ;; associated Y coordinates.
                NEG
                LD      E,A                     ; E = MinU + MinV - $FC
                ADD     A,C
                LD      (LeftAdj+1),A           ; E + CornerPos
                LD      A,C
                NEG
                ADD     A,E
                LD      (RightAdj+1),A          ; E - CornerPos
        ;; TweakEdges fixes up the floor drawing around the edges.
                CALL    TweakEdges
        ;; Then, inspect HasDoors to see if we need to remove a column or two.
        ;; TODO: What exactly is this for?
                POP     AF
                RRA
                PUSH    AF
                CALL    NC,NukeColL
                POP     AF
                RRA
                RET     C
        ;; NB: Fall through

;; Scan from the right for the first drawn column
NukeColR:       LD      HL,BkgndData + 31*2
ScanR:          LD      A,(HL)
                AND     A
                JR      NZ,NukeCol
                DEC     HL
                DEC     HL
                JR      ScanR

;; If the current screen column sprite is a blank, delete it.
NukeCol:        INC     HL
                LD      A,(HL)
                OR      ~5
                INC     A
                RET     NZ
                LD      (HL),A
                DEC     HL
                LD      (HL),A
                RET

;; Scan from the left for the first drawn column
NukeColL:       LD      HL,BkgndData
ScanL:          LD      A,(HL)
                AND     A
                JR      NZ,NukeCol
                INC     HL
                INC     HL
                JR      ScanL

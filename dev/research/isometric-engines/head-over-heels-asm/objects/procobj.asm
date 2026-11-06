;;
;; procobj.asm
;;
;; Mystery set of functions that handle an object?
;;

;; Exported functions:
;;  * AddObject
;;  * GetUVZExtentsB
;;  * Enlist
;;  * Unlink
;;  * EnlistAux
;;  * Relink

OBJECT_LEN:     EQU 18


ObjVars:        DEFB $1B                ; Reinitialisation size

                DEFB $00
                DEFW Objects
                DEFW ObjectLists + 0
                DEFW ObjectLists + 2
                DEFW $0000
                DEFW $0000
                DEFW $0000,$0000
                DEFW $0000,$0000
                DEFW $0000,$0000
                DEFW $0000,$0000

        ;; The index into ObjectLists.
ObjListIdx:     DEFB $00
        ;; Current pointer for where we write objects into
ObjDest:        DEFW Objects
        ;; 'A' list item pointers are offset +2 from 'B' list pointers.
ObjListAPtr:    DEFW ObjectLists
ObjListBPtr:    DEFW ObjectLists + 2
        ;; Each list consists of a pair of pointers to linked lists of
        ;; objects (ListA and ListB). They're opposite directions in a
        ;; doubly-linked list, and each side has a head node, it seems.
ObjectLists:    DEFW $0000,$0000 ; 0 - Usual list
                DEFW $0000,$0000 ; 1 - Next room in V direction
                DEFW $0000,$0000 ; 2 - Next room in U direction
                DEFW $0000,$0000 ; 3 - Far
                DEFW $0000,$0000 ; 4 - Near

SavedObjDest:	DEFW Objects
SortObj:	DEFW $0000

        ;; Given an index in A, set the object list index and pointers.
SetObjList:     LD      (ObjListIdx),A
                ADD     A,A
                ADD     A,A
                ADD     A,ObjectLists & $ff
                LD      L,A
                ADC     A,ObjectLists >> 8
                SUB     L
                LD      H,A
        ;; ObjListAPtr = ObjectLists + (ObjListIdx) * 4
                LD      (ObjListAPtr),HL
                INC     HL
                INC     HL
        ;; ObjListBPtr = ObjectLists + (ObjListIdx) * 4 + 2
                LD      (ObjListBPtr),HL
                RET

;; DE contains an 'A' object pointer. Assumes the other half of the object
;; is in the next slot (+0x12). Syncs the object state.
SyncDoubleObject:
        ;; Copy 5 bytes, from the pointer location onwards:
        ;; Next pointer, flags, U & V coordinates.
                LD      HL,$0012
                ADD     HL,DE
                PUSH    HL
                EX      DE,HL
                LD      BC,$0005
                LDIR
        ;; Copy across Z coordinate, sutracting 6.
                LD      A,(HL)
                SUB     $06
                LD      (DE),A
        ;; If bit 5 of byte 9 is set on first object, we're done.
                INC     DE
                INC     HL
                INC     HL
                BIT     5,(HL)
                JR      NZ,SDO_2
        ;; Otherwise, copy the sprite over (byte 8).
                DEC     HL
                LDI
SDO_2:          POP     HL
                RET

;; Copy an object into the object buffer, add a second object if it's
;; doubled, and link it into the depth-sorted lists.
;;
;; HL is a 'B' pointer to an object.
;; BC contains the size of the object (always 18 bytes!).
AddObject:
        ;; First, just return if there's no intersection with the view window.
                PUSH    HL
                PUSH    BC
                INC     HL
                INC     HL
                CALL    IntersectObj   ; HL now contains an 'A' ptr to object.
                POP     BC
                POP     HL
                RET     NC
        ;; Copy BC bytes of object to what ObjDest pointer, updating ObjDest
                LD      DE,(ObjDest)
                PUSH    DE
                LDIR
                LD      (ObjDest),DE
                POP     HL
        ;; HL now points at copied object
                PUSH    HL
                POP     IY
        ;; If it's not a double object, just call Enlist.
                BIT     3,(IY+$04)      ; Check bit 3 of flags...
                JR      Z,Enlist        ; NB: Tail call if not set
        ;; Bit 3 set = tall object. Make the second object like the
        ;; first, copying the first 9 bytes.
                LD      BC,9
                PUSH    HL
                LDIR
        ;; Copy byte at offset 9 over, setting bit 1.
                EX      DE,HL
                LD      A,(DE)          ; Load A with offset 9 of original
                OR      $02
                LD      (HL),A          ; Set bit 1, write out.
        ;; Write 0 for byte at offset 10.
                INC     HL
                LD      (HL),$00
        ;; And update ObjDest to point past newly constructed object (offset 18).
                LD      DE,8
                ADD     HL,DE
                LD      (ObjDest),HL
        ;; If bit 5 of offset 9 set, set the sprite on this second object.
                BIT     5,(IY+$09)
                JR      Z,AO_2
                PUSH    IY
                LD      DE,18   ; TODO: Object size
                ADD     IY,DE
                LD      A,(BottomSprite)
                CALL    SetObjSprite
                POP     IY
AO_2:           POP     HL
        ;; NB: Fall through.

;; HL points at an object, as does IY.
Enlist:         LD      A,(ObjListIdx)
        ;; If the current object list is >= 3, use EnlistAux directly.
                DEC     A
                CP      $02
                JR      NC,EnlistAux    ; NB: Tail call
        ;; If it's not double-height, insert on the current list.
                INC     HL
                INC     HL
                BIT     3,(IY+$04)
                JR      Z,EnlistObj
        ;; Otherwise, do the two halves analogously to in EnlistAux.
                PUSH    HL
                CALL    EnlistObj
                POP     DE
                CALL    SyncDoubleObject
                PUSH    HL
                CALL    GetUVZExtentsA
                EXX
                PUSH    IY
                POP     HL
                INC     HL
                INC     HL
                JR      DepthInsert

;; Put the object in HL into its depth-sorted position in the
;; list.
EnlistObj:      PUSH    HL
                CALL    GetUVZExtentsA
                EXX
                JR      DepthInsertHd

;; Takes a B pointer in HL/IY. Enlists it, and its other half if it's a
;; double-size object. Inserts inthe the appropriate list.
EnlistAux:      INC     HL
                INC     HL
        ;; Easy path if it's a single object.
                BIT     3,(IY+$04)
                JR      Z,EnlistObjAux  ; NB: Tail call
        ;; Otherwise, do one half...
                PUSH    HL
                CALL    EnlistObjAux
        ;; update the other half...
                POP     DE
                CALL    SyncDoubleObject
        ;; and insert the other half, on the same object list.
                PUSH    HL
                CALL    GetUVZExtentsA
                EXX
                PUSH    IY
                POP     HL
                INC     HL
                INC     HL
                JR      DepthInsert     ; NB: Tail call

;; Object in HL. Inserts object into appropriate object list
;; based on coordinates.
;;
;; List 3 is far away, 0 in middle, 4 is near.
EnlistObjAux:   PUSH    HL
                CALL    GetUVZExtentsA
        ;; If object is beyond high U boundary, put on list 3.
                LD      A,$03
                EX      AF,AF'
                LD      A,(MaxU)
                CP      D
                JR      C,EOA_2
        ;; If object is beyond high V boundary, put on list 3.
                LD      A,(MaxV)
                CP      H
                JR      C,EOA_2
        ;; If object is beyond low U boundary, put on list 4.
                LD      A,$04
                EX      AF,AF'
                LD      A,(MinU)
                DEC     A
                CP      E
                JR      NC,EOA_2
        ;; If object is beyond low V boundary, put on list 4.
                LD      A,(MinV)
                DEC     A
                CP      L
                JR      NC,EOA_2
        ;; Otherwise, put on list 0.
                XOR     A
                EX      AF,AF'
EOA_2:          EXX
                EX      AF,AF'
        ;; And then insert into the appropriate place on that list.
                CALL    SetObjList
        ;; NB: Fall through

;; Does DepthInsert on the list pointed to by ObjListAPtr
DepthInsertHd:  LD      HL,(ObjListAPtr)
        ;; NB: Fall through

;; Object extents in alt registers, 'A' pointer in HL.
;; Object to insert is on the stack.
;;
;; I believe this traverses a list sorted far-to-near, and
;; loads up HL with the nearest object further away from our
;; object.
DepthInsert:    LD      (SortObj),HL
DepIns2:        LD      A,(HL)          ; Load next object into HL...
                INC     HL
                LD      H,(HL)
                LD      L,A
                OR      H
                JR      Z,DepIns3       ; Zero? Done!
                PUSH    HL
                CALL    GetUVZExtentsA
                CALL    DepthCmp
                POP     HL
                JR      NC,DepthInsert  ; Update SortObj if current HL is far away
                AND     A
                JR      NZ,DepIns2      ; Break out of loop if past point of caring
DepIns3:        LD      HL,(SortObj)
        ;; Insert the stack-stored object after SortObj.
        ;;
        ;; Load our object in DE, HL contains object to chain after.
                POP     DE
        ;; Copy HL obj's 'next' pointer into DE obj's.
                LD      A,(HL)
                LDI
                LD      C,A
                LD      A,(HL)
                LD      (DE),A
        ;; Now copy address of DE into HL's 'next' pointer.
                DEC     DE
                LD      (HL),D
                DEC     HL
                LD      (HL),E
        ;; Now links in the other direction:
        ;; Put DE's new 'next' pointer into HL.
                LD      L,C
                LD      H,A
        ;; And if it's zero, load HL with pointer referred to by ObjListBPtr
                OR      C
                JR      NZ,DepIns4
                LD      HL,(ObjListBPtr)
                INC     HL
                INC     HL
        ;; Link DE after HL
DepIns4:        DEC     HL
                DEC     DE
                LDD
                LD      A,(HL)
                LD      (DE),A
                LD      (HL),E
                INC     HL
                LD      (HL),D
                RET

;; Take an object out of the list, and reinserts it in the
;; appropriate list.
Relink:         PUSH    HL
                CALL    Unlink
                POP     HL
                JP      EnlistAux

;; Unlink the object in HL. If bit 3 of IY+4 is set, it's an
;; object made out of two subcomponents, and both must be
;; unlinked.
Unlink:         BIT     3,(IY+$04)
                JR      Z,UnlinkObj
                PUSH    HL
                CALL    UnlinkObj
                POP     DE
                LD      HL,18   ; TODO: Object size
                ADD     HL,DE
        ;; NB: Fall through.

;; Takes a 'B' pointer in HL, and removes the pointed object
;; from the list.
;;
;; In C-like pseudocode:
;;
;; if (obj->b_next == null) {
;;   a_head = obj->a_next;
;; } else {
;;   obj->b_next->a_next = obj->a_next;
;; }
;;
;; if (obj->a_next == null) {
;;   b_head = obj->b_next;
;; } else {
;;   obj->a_next->b_next = obj->b_next;
;; }
UnlinkObj:
        ;; Load DE with next object after HL, save it.
                LD      E,(HL)
                INC     HL
                LD      D,(HL)
                INC     HL
                PUSH    DE
        ;; If zero, get first object on List A, else offset DE by 2 to
        ;; create an 'A' pointer.
                LD      A,D
                OR      E
                INC     DE
                INC     DE
                JR      NZ,UO_1
                LD      DE,(ObjListAPtr)
UO_1:
        ;; HL pointer at 'A' pointer now. Copy *HL to *DE, saving
        ;; value in HL.
                LD      A,(HL)
                LDI
                LD      C,A
                LD      A,(HL)
                LD      (DE),A
                LD      H,A
                LD      L,C
        ;; If the pointer was null, put the head of the B list in HL.
                OR      C
                DEC     HL
                JR      NZ,UO_2
                LD      HL,(ObjListBPtr)
                INC     HL
UO_2:
        ;; Make HL's next B object the saved DE B pointer.
                POP     DE
                LD      (HL),D
                DEC     HL
                LD      (HL),E
                RET

;; Like GetUVZExtentsB, but applies extra height adjustment -
;; increases height by 6 if flag bit 3 is set.
GetUVZExtentsE: CALL    GetUVZExtentsB
                AND     $08
                RET     Z
                LD      A,C
                SUB     $06
                LD      C,A
                RET

;; Given an object in HL, returns its U, V and Z extents.
;; moves in a particular direction:
;;
;; D = high U, E = low U
;; H = high V, L = low V
;; B = high Z, C = low Z
;; It also returns flags in A.
;;
;; Values are based on the bottom 3 flag bits
;; Flag   U      V      Z
;; 0    +3 -3  +3 -3  0  -6
;; 1    +4 -4  +4 -4  0  -6
;; 2    +4 -4  +1 -1  0  -6
;; 3    +1 -1  +4 -4  0  -6
;; 4    +4  0  +4  0  0 -18
;; 5     0 -4  +4  0  0 -18
;; 6    +4  0   0 -4  0 -18
;; 7     0 -4   0 -4  0 -18
GetUVZExtentsB: INC     HL
                INC     HL
        ;; NB: Fall through!

;; GetUVZExtentsB, except HL has a pointer + 2 to an object, so works with ListA items.
GetUVZExtentsA: INC     HL
                INC     HL
                LD      A,(HL)          ; Offset 4: Flags
                INC     HL
                LD      C,A
                EX      AF,AF'
                LD      A,C
                BIT     2,A
                JR      NZ,GUVZE_5      ; If bit 2 set
                BIT     1,A
                JR      NZ,GUVZE_3      ; If bit 1 set
                AND     $01
                ADD     A,$03
                LD      B,A             ; Bit 0 + 3 in B
                ADD     A,A
                LD      C,A             ; x2 in C
                LD      A,(HL)          ; Load U co-ord
                ADD     A,B
                LD      D,A             ; Store added co-ord in D
                SUB     C
                LD      E,A             ; And subtracted co-ord in E
                INC     HL
                LD      A,(HL)          ; Load V co-ord
                INC     HL
                ADD     A,B
                LD      B,(HL)          ; Load Z co-ord for later
                LD      H,A             ; Store 2nd added co-ord in H
                SUB     C
                LD      L,A             ; And 2nd subtracted co-ored in L
GUVZE_2:        LD      A,B
                SUB     $06
                LD      C,A             ; Put Z co-ord - 6 in C
                EX      AF,AF'
                RET

        ;; Bit 1 was set in the object flags
GUVZE_3:        RRA
                JR      C,GUVZE_4
        ;; Bit 1 set, bit 0 not set
                LD      A,(HL)
                ADD     A,$04
                LD      D,A
                SUB     $08
                LD      E,A             ; D/E given added/subtracted U co-ords of 4
                INC     HL
                LD      A,(HL)
                INC     HL
                LD      B,(HL)
                LD      H,A
                LD      L,A             ; H/L given added/subtracted V co-ords of 1
                INC     H
                DEC     L
                JR      GUVZE_2

        ;; Bits 1 and 0 were set
GUVZE_4:        LD      D,(HL)
                LD      E,D
                INC     D
                DEC     E               ; D/E given added/subtracted U co-ords of 1
                INC     HL
                LD      A,(HL)
                INC     HL
                ADD     A,$04
                LD      B,(HL)
                LD      H,A
                SUB     $08
                LD      L,A             ; H/L given added/subtracted V co-ords of 4
                JR      GUVZE_2

        ;; Bit 2 was set in the object flags
GUVZE_5:        LD      A,(HL)          ; Load U co-ord
                RR      C
                JR      C,GUVZE_5b
        ;; Bit 0 reset
                LD      E,A
                ADD     A,$04
                LD      D,A
                JR      GUVZE_5c
        ;; Bit 0 set
GUVZE_5b:       LD      D,A
                SUB     $04
                LD      E,A
GUVZE_5c:       INC     HL
                LD      A,(HL)          ; Load V co-ord
                INC     HL
                LD      B,(HL)          ; Load Z co-ord
                RR      C
                JR      C,GUVZE_5d
        ;; Bit 1 reset
                LD      L,A
                ADD     A,$04
                LD      H,A
                JR      GUVZE_5e
        ;; Bit 1 set
GUVZE_5d:       LD      H,A
                SUB     $04
                LD      L,A
GUVZE_5e:       LD      A,B
                SUB     $12
                LD      C,A
                EX      AF,AF'
                RET

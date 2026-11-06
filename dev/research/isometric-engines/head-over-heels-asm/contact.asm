	;; 
	;; contact.asm
	;;
	;; Handles checking contact between things
	;;

ObjContact:	DEFW $0000        ; Pointer to an object contacting the character.

;; Takes object (character?) in IY
DoorContact:    CALL    GetDoorHeight
                LD      A,(IY+$07)
                SUB     C
        ;; Call with A containing height above door.
                JP      DoContact ; NB: Tail call

;; Takes object in IY, returns height of relevant door.
GetDoorHeight:
        ;; Return $C0 if SavedObjListIdx == 0.
                LD      C,$C0
                LD      A,(SavedObjListIdx)
                AND     A
                RET     Z
                LD      IX,DoorHeights
        ;; Return IX+$00 if near MaxV
                LD      C,(IX+$00)
                LD      A,(MaxV)
                SUB     $03
                CP      A,(IY+$06)
                RET     C
        ;; Return IX+$02 if near near MinV
                LD      C,(IX+$02)
                LD      A,(MinV)
                ADD     A,$02
                CP      A,(IY+$06)
                RET     NC
        ;; Return IX+$01 if near MaxU
                LD      C,(IX+$01)
                LD      A,(MaxU)
                SUB     $03
                CP      A,(IY+$05)
                RET     C
        ;; Otherwise, IX+$03
                LD      C,(IX+$03)
                RET

NearHitFloor:	CP	$FF     	; This way, only get the start.
	;; NB: Fall through.

;; A is zero. We've hit, or nearly hit, the floor.
HitFloor:	SCF
		LD	(IY+$0D),A
		LD	(IY+$0E),A
		RET	NZ
        ;; Called HitFloor, not NearHitFloor.
		BIT	0,(IY+$09)
		JR	Z,FloorCheck 	; Floor check for non-player objects
        ;; Right, player has hit floor.
        ;; Some check?
		LD	A,(SavedObjListIdx)
		AND	A
		JR	NZ,RetZeroC
        ;; Then handle the possibilities
		LD	A,(FloorCode)
		CP	$06 		; Deadly floor?
		JR	Z,DeadlyFloorCase
		CP	$07 		; No floor?
		JR	NZ,RetZeroC
	;; Code to handle no floor...
        ;; TODO
		CALL	GetCharObj
		PUSH	IY
		POP	DE
		AND	A
		SBC	HL,DE
		JR	Z,HF_1
		LD	HL,SwopPressed
		LD	A,(HL)
		OR	$03
		LD	(HL),A
		JR	RetZeroC 	; Tail call.
HF_1:		LD	A,$05           ; Next room below.
		LD	(NextRoom),A
		AND	A
		RET

DeadlyFloorCase:LD	C,(IY+$09)
		LD	B,(IY+$04)
		CALL	DeadlyContact

	;; Return with 0 in A, and carry flag set.
RetZeroC:	XOR	A
		SCF
		RET

;; A non-player object has hit the floor...
FloorCheck:	LD	A,(FloorCode)
		CP	$07 				; No floor?
		JR	NZ,RetZeroC
		LD	(IY+$0A),OBJFN_DISAPPEAR	; Then it disappears.
		JR	RetZeroC

        ;; Object (character?) in IY.
DoContact2:	LD	A,(IY+$07)
		SUB	$C0
        ;; NB: Fall through

;; A contains height difference
DoContact:
        ;; Clear what's on character so far.
                LD      BC,0
                LD      (ObjContact),BC
        ;; If we've hit the floor, go to that case
                JR      Z,HitFloor
        ;; Just above floor? Still call through
                INC     A
                JR      Z,NearHitFloor
        ;; Set C to high-Z plus one (i.e. what we're resting on)
                CALL    GetUVZExtentsE
                LD      C,B
                INC     C
        ;; Looks like we use what we were on previously as our current
        ;; "on" object - avoid recomputation and keeps the object
        ;; consistent?
        ;;
        ;; Load the object character's on into IX. Go to ChkSitOn if null.
                EXX
                LD      A,(IY+$0E)
                AND     A
                JR      Z,ChkSitOn
                LD      H,A
                LD      L,(IY+$0D)
                PUSH    HL
                POP     IX
        ;; Various other tests where we switch over to ChkSitOn.
                BIT     7,(IX+$04)
                JR      NZ,ChkSitOn
        ;; Check we're still on it.
                LD      A,(IX+$07)
                SUB     $06
                EXX
                CP      B
                EXX
                JR      NZ,ChkSitOn
                CALL    CheckWeOverlap
                JR      NC,ChkSitOn
        ;; We're still on the object we were on before.
        ;; NB: Fall through

;; Deal with contact between a character and a thing.
;;
;; IY is the character, IX is what it's resting on.
DoObjContact:
        ;; If it's the second part of a double-height...
                BIT     1,(IX+$09)
                JR      Z,DOC_1
        ;; Reset bit 5 of Offset C
                RES     5,(IX-$06)
        ;; Load Offset B
                LD      A,(IX-$07)
                JR      DOC_2
        ;; Otherwise, do the same, but single-height.
DOC_1:          RES     5,(IX+$0C)
                LD      A,(IX+$0B)
        ;; Mask Offset C of IY with top 3 bits of Offset C of stood-on
        ;; object.
DOC_2:          OR      $E0
                LD      C,A
                LD      A,(IY+$0C)
                AND     C
                LD      (IY+$0C),A
        ;; NB: Fall through.

DoAltContact:	XOR	A
		SCF
		JP	Contact

;; Run through all the objects in the main object list and check their
;; contact with our object in IY, see if it's sitting on them or
;; touching them.
;;
;; Object extents should be in primed registers.
ChkSitOn:       LD      HL,ObjectLists + 2
CSIT_1:         LD      A,(HL)
                INC     HL
                LD      H,(HL)
                LD      L,A
                OR      H
                JR      Z,CSIT_4         ; Done - exit list.
                PUSH    HL
                POP     IX
                BIT     7,(IX+$04)
                JR      NZ,CSIT_1        ; Bit set? Skip this item
                LD      A,(IX+$07)      ; Check Z coord of top of obj against bottom of IY
                SUB     $06
                EXX
                CP      B
                JR      NZ,CSIT_3        ; Go to differing height case.
                EXX
                PUSH    HL
                CALL    CheckWeOverlap
                POP     HL
                JR      NC,CSIT_1        ; Same height, overlap? Skip
CSIT_2:         LD      (IY+$0D),L      ; Record what we're sitting on.
                LD      (IY+$0E),H
                JR      DoObjContact    ; Hit!
        ;; Not stacked...
CSIT_3:         CP      C               ; TODO: Compares with C, not B
                EXX
                JR      NZ,CSIT_1        ; Differs other way? Continue.
        ;; Same height instead.
                LD      A,(ObjContact+1) ; TODO: +1
                AND     A
                JR      NZ,CSIT_1        ; Some test makes us skip...
                PUSH    HL
                CALL    CheckWeOverlap
                POP     HL
                JR      NC,CSIT_1        ; If we don't overlap, skip
                LD      (ObjContact),HL ; Store the object we're touching, carry on.
                JR      CSIT_1
        ;; Completed object list traversal
CSIT_4:		LD	A,(SavedObjListIdx)
		AND	A
		JR	Z,CSIT_7
		CALL	GetCharObjIX
        ;; Get Z coord of top of the character into A.
		LD	A,(Character)
		CP	$03
		LD	A,-12
		JR	Z,CSIT_5
		LD	A,-6
CSIT_5:		ADD	A,(IX+$07)
		EXX
        ;; Compare against bottom of us.
		CP	B
		JR	NZ,CSIT_6
        ;; We're on it, if we overlap.
		EXX
		PUSH	HL
		CALL	CheckWeOverlap
		POP	HL
		JR	NC,CSIT_7
		JR	CSIT_2
CSIT_6:		CP	C
		EXX
		JR	NZ,CSIT_7
        ;; Same height, making it pushable.
		LD	A,(ObjContact+1)
		AND	A
		JR	NZ,CSIT_7 		; Give up if already in contact.
		CALL	GetCharObjIX
		CALL	CheckWeOverlap
		JR	NC,CSIT_7
		LD	(IY+$0D),$00
		LD	(IY+$0E),$00
		JR	CSIT_11
        ;; Nothing found case...
CSIT_7:		LD	HL,(ObjContact)
		LD	(IY+$0D),$00
		LD	(IY+$0E),$00
		LD	A,H
		AND	A
		RET	Z
		PUSH	HL
		POP	IX
		BIT	1,(IX+$09)
		JR	Z,CSIT_9
		BIT	4,(IX-$07)
		JR	CSIT_10
CSIT_9:		BIT	4,(IX+$0B)
CSIT_10:	JR	NZ,CSIT_11
		RES	4,(IY+$0C)
CSIT_11:	XOR	A
		SUB	$01
		RET

	;; Called by the purse routine to find something to pick up.
	;; Carry flag set if something is found, and thing returned in HL.
	;;
	;; Loop through all items, finding ones which match on B or C
	;; Then call CheckWeOverlap to see if ok candidate. Return it
	;; in HL if it is.
GetStoodUpon:	CALL	GetUVZExtentsE		; Perhaps getting height as a filter?
		LD	A,B
		ADD	A,$06
		LD	B,A
		INC	A
		LD	C,A
		EXX
	;; Traverse list of objects in main object list
		LD	HL,ObjectLists + 2
GSU_1:		LD	A,(HL)
		INC	HL
		LD	H,(HL)
		LD	L,A
		OR	H
		RET	Z
		PUSH	HL
		POP	IX
		BIT	6,(IX+$04)
		JR	Z,GSU_1
		LD	A,(IX+$07)
		EXX
		CP	B
		JR	Z,GSU_2
		CP	C
GSU_2:		EXX
		JR	NZ,GSU_1
		PUSH	HL
		CALL	CheckWeOverlap
		POP	HL
		JR	NC,GSU_1
		RET

;; Object in IY, extents in primed registers.
;; Very similar to ChkSitOn. Checks to see if stuff is on us.
ChkSatOn:
        ;; Put top of object in B'
		CALL	GetUVZExtentsE
		LD	B,C
		DEC	B
		EXX
        ;; Clear the thing on top of us
		XOR	A
		LD	(ObjContact),A
	;; Traverse main list of objects
		LD	HL,ObjectLists + 2
CSAT_1:		LD	A,(HL)
		INC	HL
		LD	H,(HL)
		LD	L,A
		OR	H
		JR	Z,CSAT_4		; Reached end?
		PUSH	HL
		POP	IX
		BIT	7,(IX+$04)
		JR	NZ,CSAT_1 	; Skip if bit set
		LD	A,(IX+$07)
		EXX
		CP	C               ; Compare IY top with bottom of this object.
		JR	NZ,CSAT_3 	; Jump if not at same height
		EXX
		PUSH	HL
		CALL	CheckWeOverlap
		POP	HL
		JR	NC,CSAT_1
        ;; Top of us = bottom of them, we have a thing on top.
        ;; Copy our movement over to the block on top.
CSAT_2:		LD	A,(IY+$0B)
		OR	$E0
		AND	$EF
		LD	C,A
		LD	A,(IX+$0C)
		AND	C
		LD	(IX+$0C),A
		JP	DoAltContact	; Tail call
        ;; Not stacked
CSAT_3:		CP	B
		EXX
		JR	NZ,CSAT_1
        ;; Same height instead
		LD	A,(ObjContact)
		AND	A
		JR	NZ,CSAT_1 	; Continue if we're already in contact
		PUSH	HL
		CALL	CheckWeOverlap
		POP	HL
		JR	NC,CSAT_1
		LD	A,$FF
		LD	(ObjContact),A 	; Set ObjContact to $FF and carry on.
		JR	CSAT_1
	;; Finished traversing list. Check the character object.
CSAT_4:		LD	A,(SavedObjListIdx) 	; Are we in the same list?
		AND	A
		JR	Z,CSAT_7 		; If not, give up.
		CALL	GetCharObjIX 		; Fetch character's bottom height.
		LD	A,(IX+$07)
		EXX
		CP	C        		; Is the character sitting on us?
		JR	NZ,CSAT_5 		; If no, go to CSAT_5.
		EXX
		CALL	CheckWeOverlap
		JR	NC,CSAT_7 ; Nothing on top
		JR	CSAT_2    ; Thing is on top.
        
GetCharObjIX:	CALL	GetCharObj
		PUSH	HL
		POP	IX
		RET

CSAT_5:		CP	B
		EXX
		JR	NZ,CSAT_7 ; Nothing on top case
		LD	A,(ObjContact)
		AND	A
		JR	NZ,CSAT_7 ; Nothing on top case.
		CALL	GetCharObjIX
		CALL	CheckWeOverlap
		JR	NC,CSAT_7
		LD	A,$FF
		JR	CSAT_8
CSAT_7:		LD	A,(ObjContact)
CSAT_8:		AND	A       ; Rather than setting ObjContact, we return it?
		RET	Z
		SCF
		RET

;; Takes object point in IX and checks to see if we overlap with it.
;; Assumes our extents are in DE',HL'.
CheckWeOverlap: CALL    GetUVExt
        ;; NB: Fall through

;; Assuming X and Y extents in DE,HL and DE',HL', check two boundaries overlap.
;; Sets carry flag if they do.
CheckOverlap:
        ;; Check E < D' and E' < D
                LD      A,E
                EXX
                CP      D
                LD      A,E
                EXX
                RET     NC
                CP      D
                RET     NC
        ;; Check L < H' and L' < H
                LD      A,L
                EXX
                CP      H
                LD      A,L
                EXX
                RET     NC
                CP      H
                RET

;; Given an object in IX, returns its U and V extents.
;; Very like GetUVZExtents... but different?!
;;
;; D = high U, E = low U
;; H = high V, L = low V
;;
;; Values are based on the bottom 2 flag bits
;; Flag   U      V
;; 0     0 -6  +0 -6
;; 1    +0 -8  +0 -8
;; 2    +4 -4  +1 -1
;; 3    +1 -1  +4 -4
GetUVExt:
        ;; Check bit 1 of object shape.
                LD      A,(IX+$04)
                BIT     1,A
                JR      NZ,GUVE_1
        ;; Bit was reset: Case 0/1
        ;; C = 3 + bottom bit of object shape
                RRA
                LD      A,$03
                ADC     A,$00
                LD      C,A
        ;; D = U coord, E = U coord - 2 * C
                ADD     A,(IX+$05)
                LD      D,A
                SUB     C
                SUB     C
                LD      E,A
        ;; H = V coord, L = V coord - 2 * C
                LD      A,C
                ADD     A,(IX+$06)
                LD      H,A
                SUB     C
                SUB     C
                LD      L,A
                RET
GUVE_1:
        ;; Jump if bottom bit set.
                RRA
                JR      C,GUVE_2
        ;; Case 2
        ;; D = U coord + 4, E = U coord - 4
                LD      A,(IX+$05)
                ADD     A,$04
                LD      D,A
                SUB     $08
                LD      E,A
        ;; L = V coord - 1, H = V coord + 1
                LD      L,(IX+$06)
                LD      H,L
                INC     H
                DEC     L
                RET
GUVE_2:
        ;; Case 3
        ;; H = V coord + 4, L = V coord - 4
                LD      A,(IX+$06)
                ADD     A,$04
                LD      H,A
                SUB     $08
                LD      L,A
        ;; D = U coord + 1, E = U coord - 1
                LD      E,(IX+$05)
                LD      D,E
                INC     D
                DEC     E
                RET

;; Swap RoomId with the room at the other end of the teleport.
Teleport:       LD      BC,(RoomId)
                LD      HL,Teleports
                CALL    FindPair
                LD      (RoomId),DE
                RET

;; Scans array from HL, looking for BC, scanning in pairs. If the
;; first is equal, it returns the second in DE. If the second is equal,
;; it returns the first.
FindPair:       CALL    CmpBCHL
                JR      Z,CmpBCHL
                PUSH    DE
                CALL    CmpBCHL
                POP     DE
                JR      NZ,FindPair
                RET

;; Loads (HL) into DE, incrementing HL. Compares BC with DE, sets Z if equal.
CmpBCHL:        LD      A,C
                LD      E,(HL)
                INC     HL
                LD      D,(HL)
                INC     HL
                CP      E
                RET     NZ
                LD      A,B
                CP      D
                RET

Teleports:      DEFW $8A40,$7150
                DEFW $8940,$0480
                DEFW $BA70,$1300
                DEFW $4100,$2980
                DEFW $A100,$2600
                DEFW $8100,$E980
                DEFW $8400,$B100
                DEFW $8500,$EF20
                DEFW $A400,$00F0
                DEFW $A500,$88D0
                DEFW $BCD0,$DED0
                DEFW $2DB0,$8BD0
                DEFW $1190,$E1C0
                DEFW $00B0,$E2C0
                DEFW $10B0,$C100
                DEFW $8BF0,$00F0
                DEFW $9730,$EF20
                DEFW $1D00,$A800
                DEFW $BA70,$4E00
                DEFW $8800,$1B30
                DEFW $4C00,$3930
                DEFW $8B30,$8D30

;; 
;; obj_fns.asm
;;
;; The functions that implement the per-object function table.
;;
;; FIXME: Needs a lot of reversing!
;; 

;; Called functions and accessed values:
;; * AnimateObj
;; * UpdateCurrPos
;; * Random
;; * SetFacingDirEx
;; * DoContact2
;; * ChkSatOn
;; * Character
;; * CurrObject
;; * GetCharObj
;; * CharDir
;; * LookupDir
;; * OBJFN_HELIPLAT3
;; * OBJFN_FADE
;; * OBJFN_FIRE
;; * ObjDir
;; * ObjectLists
;; * PlaySound
;; * Relink
;; * RemoveObject
;; * RootDir
;; * SetSound
;; * StoreObjExtents
;; * Move
;; * UnionAndDraw
;; * WorldMask

;; Exports ObjFn* and ObjFn36Val.

	;; Offset 0: 'B' list next item pointer
        ;; Offset 2: 'A' list next item pointer
	;; Offset 4: Some flag - bit 6 and 7 causes skipping.
        ;;           Bits 0-2: Object shape - see GetUVZExtents
        ;;           Bit 3: Tall (extra 6 height)
        ;;           Bit 4: Holds switch status for a switch.
        ;;           Bit 5: Used on doors by Case3x56.
        ;;           Bit 6: Object is a special collectable item.
        ;;           For doors, bits 4 and 5 hold the direction.
	;; Offset 5: U coordinate
	;; Offset 6: V coordinate
	;; Offset 7: Z coordinate, C0 = ground
	;; Offset 8: Its sprite
	;; Offset 9: Sprite flags:
        ;;           Bit 0 - perhaps is playable character?
        ;;           Bit 1 set for other bit of double height?
        ;;           Bit 2 = we're Head.
        ;;           Bit 4 = non-deadlyness?
        ;;           Bit 5 = has another object tacked after (double height?)
        ;;           Bit 7 = switched flag
        ;;           Gets loaded into SpriteFlags
	;; Offset A: Top bit is flag that's checked against Phase, lower 6 bits are object function.
	;; Offset B: Bottom 4 bits are roller direction... last move dir for updated things.
	;; Offset C: Some form of direction bitmask?
        ;;           I think it's how we're being pushed. I think bit 5 means 'being stood on'.
        ;; Offset D&E: Object we're resting on.
        ;; Offset D/E get zeroed on the floor. Forms a pointer?
        ;; Offset F: Animation code - top 5 bits are the animation, bottom 3 bits are the frame.
	;; Offset 10: Direction code. I think this is not the bit mask.
        ;; Offset 11: Z limits for helipad, state for switch, special id for specials.
	;; Hmmm. May be 17 bytes? Object-copying code suggests 18 bytes.

        ;; U/V coordinates: X/Y coordinates are used for screen space,
        ;; so we'll use U/V/Z coordinates for the isometric space.
        ;; V     U
        ;;  \   /
        ;;   \ /
        ;;    *
        ;;    |
        ;;    Z

O_OFLAGS:       EQU $04
O_U:            EQU $05
O_V:            EQU $06
O_Z:            EQU $07
O_SPRITE:       EQU $08
O_FUNC:         EQU $0A
O_ANIM: 	EQU $0F
O_DIRECTION:    EQU $10

        ;; Bit 0 set = have updated object extents
        ;; Bit 1 set = needs redraw
DrawFlags:	DEFB $00

Collided:	DEFB $FF
RobotDir:	DEFB $FF

ObjFnJoystick:	LD	A,(IY+$0C)
		LD	(IY+$0C),$FF
		OR	$F0
		CP	$FF
		RET	Z
		LD	(RobotDir),A
		RET

ObjFnRobot:	CALL	ObjAgain8
		LD	HL,RobotDir
		LD	A,(HL)
		LD	(HL),$FF
		PUSH	AF
		CALL	LookupDir
		INC	A
		SUB	$01
		CALL	NC,MoveDir
		POP	AF
		CALL	ObjAgain6
		CALL	FaceAndAnimate
		JP	ObjDraw		; Tail call

ObjFnTeleport:	BIT	5,(IY+$0C)
		RET	NZ
		CALL	FaceAndAnimate
		CALL	ObjDraw
		LD	B,$47           ; Teleporter waiting noise
		JP	PlaySound 	; Tail call

ObjFn36Val:	DEFB $60
ObjFn36:	LD		HL,ObjFn36Val
		LD		A,(HL)
		AND		A
		RET		NZ
		LD		(HL),$60
		LD		(IY+$0B),~$08
		LD		(IY+O_FUNC),OBJFN_FIRE
		LD		A,$05 ; TODO: Actually 04?
		JP		SetSound

ObjFn35Val:	DEFB 0
ObjFn35:	LD		HL,ObjFn35Val
		LD		(HL),$FF
		PUSH	HL
		CALL	ObjFn35b
		POP		HL
		LD		(HL),$00
		RET
ObjFn35b:	LD		A,(ObjDir)
		INC		A
		JR		NZ,ObjFnEnd2
		LD		A,(IY+$0C)
		AND		$20
		RET		NZ
		LD		BC,(CharDir)
		JR		ObjFnEnd

ObjFn32:	LD		A,(ObjDir)
		INC		A
		JR		NZ,ObjFnEnd2
		CALL		CharDistAndDir
		OR		~$0C	; Clear one axis of direction bits
		CP		C
		JR		Z,ObjFnEnd
		LD		A,C
		OR		$FC
		CP		C
		RET		NZ
        ;; NB: Fall through

ObjFnEnd:	LD		(IY+$0C),C
		JR		ObjFnEnd2

	;; The function associated with a firing donut object.
ObjFnFire:	CALL		AnimateMe
		CALL		ObjFnSub
		JR		C,OFF2
		CALL		ObjFnSub
OFF2:		JP		C,Fadeify
		JR		ObjDraw2

ObjFnBall:	LD		A,(ObjDir)
		INC		A
		JR		NZ,ObjFnEnd2
		LD		A,(IY+$0C)
		INC		A
		JR		Z,ObjFnEnd4
	;; NB: Fall through

ObjFnEnd2:	CALL		ObjAgain8
		CALL		ObjFnSub
ObjDraw2:	JP		ObjDraw

ObjFnEnd4:	PUSH		IY
		CALL		ObjFnPushable
		POP		IY
		LD		(IY+$0B),$FF
		RET

ObjFnSub:	LD		A,(ObjDir)
		AND		A,(IY+$0C)
		CALL		LookupDir
		CP		$FF
		SCF
		RET		Z
		CALL	MoveCurr
		RET		C
		PUSH	AF
		CALL	UpdateObjExtents
		POP		AF
		PUSH	AF
		CALL	UpdateCurrPos
		POP		AF
		LD		HL,(ObjFn35Val)
		INC		L
		RET		Z
		CALL	MoveCurr
		RET		C
		CALL	UpdateCurrPos
		AND		A
		RET

MoveCurr:	LD		HL,(CurrObject)
		JP		Move

ObjFnSwitch:
        ;; First check if we're touched. If not, clear $11 and return.
                LD      A,(IY+$0C)
                OR      $C0
                INC     A
                JR      NZ,OFS1
                LD      (IY+$11),A
                RET
        ;; Otherwise, check if there was a previous touch.
        ;; If so, clear $0C and return.
OFS1:           LD      A,(IY+$11)
                AND     A
                JR      Z,OFS2
                LD      (IY+$0C),$FF
                RET
        ;; Mark as previously touched...
OFS2:           DEC     (IY+$11)
                CALL    ObjAgain7
        ;; Call PerObj on each object in the main object list...
                LD      HL,ObjectLists + 2
OFS3:           LD      A,(HL)
                INC     HL
                LD      H,(HL)
                LD      L,A
                OR      H
                JR      Z,OFS4
                PUSH    HL
                PUSH    HL
                POP     IX
                CALL    PerObjSwitch    ; Call with the object in HL and IX
                POP     HL
                JR      OFS3
        ;; End part, mark for redraw and tottle the switch state flag.
OFS4:           CALL    MarkToDraw
                LD      A,(IY+$04)
                XOR     $10
                LD      (IY+$04),A
                JP      ObjDraw         ; Tail call

PerObjSwitch:   LD      A,(IX+O_FUNC)
        ;; Some objects aren't affected by a switch...
                AND     $7F
                CP      OBJFN_SWITCH
                RET     Z
                CP      OBJFN_FADE
                RET     Z
        ;; If neither bit 3 or 1 of $09 is set, toggle bit 7.
                LD      A,(IX+$09)
                LD      C,A
                AND     $09
                RET     NZ
                LD      A,C
                XOR     $40
                LD      (IX+$09),A
                RET

ObjFnHeliplat2:	LD 	A,$90
		DEFB 	$01	; LD BC,nn , NOPs next instruction!

ObjFnHeliplat:  LD	A,$52
		LD	(IY+$11),A
		LD	(IY+O_FUNC),OBJFN_HELIPLAT3
		RET

ObjFn19:	BIT	5,(IY+$0C)
		RET	NZ
		CALL	ObjAgain9
		JP	ObjDraw

;; Rollers in the various directions
ObjFnRollers1:  LD      A,~$01
                JR      WriteRollerDir

ObjFnRollers2:  LD      A,~$02
                JR      WriteRollerDir

ObjFnRollers3:  LD      A,~$08
                JR      WriteRollerDir

ObjFnRollers4:  LD      A,~$04
        ;; Fall through

WriteRollerDir: LD      (IY+$0B),A
                LD      (IY+O_FUNC),$00
                RET

ObjFnHushPuppy:	LD	A,(Character)
		AND	$02		; Test if we have Head (returns early if not)
		JR	TestAndFade

        ;; FIXME: Theory is this is for the dissolving wall grating next to the hooter
ObjFnDissolve:	LD	A,$C0
		DEFB	$01		; LD BC,nn , NOPs next instruction!
ObjFnDissolve2: LD	A,$CF
		OR	A,(IY+$0C)
		INC	A
	;; NB: Fall through

TestAndFade:	RET	Z
	;; NB: Fall through

        ;; Set to use ObjFnFade
Fadeify:	LD	A,$05   ; TODO: 04?
		CALL	SetSound
		LD	A,(IY+O_FUNC)
		AND	$80
		OR	OBJFN_FADE
		LD	(IY+O_FUNC),A
		LD	(IY+$0F),$08
        ;; NB: Fall through

ObjFnFade:	LD	(IY+$04),$80
		CALL	UpdateObjExtents
		CALL	AnimateMe
		LD	A,(IY+$0F)
		AND	$07
		JP	NZ,ObjDraw
ObjFnDisappear:	LD	HL,(CurrObject)
		JP	RemoveObject

ObjFnSpring:	LD		B,(IY+$08)
		BIT		5,(IY+$0C)
		SET		5,(IY+$0C)
		LD		A,$2C
		JR		Z,OFSp2
		LD		A,(IY+$0F)
		AND		A
		JR		NZ,OFSp1
		LD		A,$2C
		CP		B
		JR		NZ,ObjFnPushable
		LD		(IY+$0F),$50
		LD		A,$04 ; TODO: ?
		CALL	SetSound
		JR		ObjFnStuff
OFSp1:	AND		$07
		JR		NZ,ObjFnStuff
		LD		A,$2B
OFSp2:	LD		(IY+$08),A
		LD		(IY+$0F),$00
		CP		B
		JR		Z,ObjFnPushable
		JR		ObjFnStuff

ObjFn26:	LD		A,(IY+$0F)
		AND		$F0
		JR		Z,ObjFnPushable
        ;; NB: Fall through

ObjFnStuff:	CALL	UpdateObjExtents
		CALL	AnimateMe
        ;; NB: Fall through

ObjFnPushable:	CALL	ObjAgain8
		LD	A,$FF
		CALL	ObjAgain6
		JP	ObjDraw

ObjFn22:	LD		HL,HalfTurn
		JP		ObjFnStuff2

ObjFn21:	LD		HL,Clockwise
		JP		ObjFnStuff2

ObjFnVisor1:    LD      HL,HalfTurn
                JR      TurnOnCollision

ObjFnMonocat:   LD      HL,Clockwise
                JR      TurnOnCollision

ObjFnAnticlock: LD      HL,Anticlockwise
                JR      TurnOnCollision

ObjFnBee:       LD      HL,DirAny
                JR      TurnOnCollision

;; Random direction change, like a queen.
ObjFnRandQ:     LD      HL,DirAny
                JR      TurnRandomly

;; Random direction change, like a rook.
ObjFnRandR:     LD      HL,DirAxes
                JR      TurnRandomly

;; Random direction change, like a bishop.
ObjFnRandB:     LD      HL,DirDiag
                JR      TurnRandomly

;; Home in, like a robomouse.
ObjFnHomeIn:    LD      HL,HomeIn
                JR      GoThatWay

;; If you have the first 4 crowns, it moves away, otherwise it comes near.
ObjFnCrowny:    LD      A,(WorldMask)
                OR      $F0
                INC     A
                LD      HL,MoveAway
                JR      Z,OFC1
                LD      HL,MoveTowards
OFC1:           JR      GoThatWay

ObjFnStuff2:	PUSH	HL
		CALL	FaceAndAnimate
		JR	ObjFnStuff5

TurnOnCollision:PUSH	HL
TurnOnColl2:	CALL	FaceAndAnimate
		CALL	ObjAgain8
		LD	A,$FF
		JR	C,ObjFnStuff6
ObjFnStuff5:	CALL	ObjAgain11
ObjFnStuff6:	CALL	ObjAgain6
		POP	HL
		LD	A,(Collided)
		INC	A
		JP	Z,ObjDraw
		CALL	DoTurn
		JP	ObjDraw

;; Call the turning function provided earlier.
DoTurn:         JP      (HL)

GoThatWay:	PUSH	HL
		CALL	ObjAgain8
		POP	HL
		CALL	DoTurn
        ;; NB: Fall through

Collision33:	CALL	FaceAndAnimate
		CALL	ObjAgain11
		CALL	ObjAgain6
		JP	ObjDraw

;; Turn randomly. If not turning randomly, act like TurnOnCollision.
TurnRandomly:	PUSH	HL
        ;; Pick a number. If not lucky, follow TurnOnCollision case.
		CALL	Random
		LD	A,L
		AND	$0F
		JR	NZ,TurnOnColl2  ; NB: Tail call
		CALL	ObjAgain8
		POP	HL
		CALL	DoTurn
		CALL	FaceAndAnimate
		CALL	ObjAgain11
		CALL	ObjAgain6
		JP	ObjDraw

HeliPadDir:	DEFB 0
        ;; Running heliplat
ObjFnHeliplat3:	LD	A,$01   ; TODO: $01? Is that even a sound?
		CALL	SetSound
		CALL	FaceAndAnimate
		LD	A,(IY+$11)
		LD	B,A
		BIT	3,A     ; & 0x08?
		JR	Z,HP_4
        ;; Bit 3 is set...
        ;; Calculate $C0 - (6 * A >> 4) - opposite direction in top bits!
		RRA
		RRA
		AND	$3C
		LD	C,A
		RRCA
		ADD	A,C
		NEG
		ADD	A,$C0
		CP	A,(IY+O_Z)
        ;; Above this level? Go to HP_2.
		JR	NC,HP_2
		LD	HL,(CurrObject)
		CALL	ChkSatOn
		RES	4,(IY+$0B)
		JR	NC,HP_1
		JR	Z,HP_6
        ;; Ascend.
HP_1:		CALL	UpdateObjExtents
		DEC	(IY+O_Z)
		JR	HP_6
        ;; I think we've hit our target level.
HP_2:		LD	HL,HeliPadDir
        ;; Every other time (alternates 0/1):
		LD	A,(HL)
		AND	A
		JR	NZ,HP_3
		LD	(HL),$02
HP_3:		DEC	(HL)
		JR	NZ,HP_6
        ;; Flip the movement direction
		LD	A,B
		XOR	$08
		LD	(IY+$11),A
		AND	$08
		JR	HP_6
HP_4:
        ;; Calculate $BF - 6 * (A & 7): convert height to Z coord.
        	AND	$07
		ADD	A,A
		LD	C,A
		ADD	A,A
		ADD	A,C
		NEG
		ADD	A,$BF
        ;; Below this level? Go to HP_2
		CP	A,(IY+O_Z)
		JR	C,HP_2
		LD	HL,(CurrObject)
		CALL	DoContact2
		JR	NC,HP_5
		JR	Z,HP_6
        ;; Descend
HP_5:		CALL	UpdateObjExtents
		RES	5,(IY+$0B)
		INC	(IY+O_Z)
HP_6:		JP	ObjDraw 		; NB: Tail call

;; An axis direction different to the current one.
DirAxes:        CALL    Random
                LD      A,L
                AND     $06
                CP      A,(IY+O_DIRECTION)
                JR      Z,DirAxes
                JR      MoveDir

;; A diagonal direction different to the current one.
DirDiag:        CALL    Random
                LD      A,L
                AND     $06
                OR      $01
                CP      A,(IY+O_DIRECTION)
                JR      Z,DirDiag
                JR      MoveDir

;; Any new direction at all.
DirAny:         CALL    Random
                LD      A,L
                AND     $07
                CP      A,(IY+O_DIRECTION)
                JR      Z,DirAny
                JR      MoveDir

;; 90 degrees round clockwise.
Clockwise:      LD      A,(IY+O_DIRECTION)
                SUB     $02
                JR      ModMoveDir

;; 90 degrees anticlockwise.
Anticlockwise:  LD      A,(IY+O_DIRECTION)
                ADD     A,$02
ModMoveDir:     AND     $07
        ;; NB: Fall through

MoveDir:        LD      (IY+O_DIRECTION),A
                RET

;; 180 degree half-turn.
HalfTurn:       LD      A,(IY+O_DIRECTION)
                ADD     A,$04
                JR      ModMoveDir

ObjFn33:	CALL		ObjAgain8
	;; Check for collision
		CALL		CharDistAndDir
		LD		A,$18
		CP		D
		JR		C,NoColl33
		CP		E
		JP		C,NoColl33
		LD		A,C
		CALL		LookupDir
		LD		(IY+O_DIRECTION),A
		JP		Collision33
NoColl33:	CALL		FaceAndAnimate
		JP		ObjDraw

;; Find the direction number associated with zeroing the
;; smaller distance, and then working towards the other
;; dimension.
HomeIn:         CALL    CharDistAndDir
                LD      A,D
                CP      E
                LD      B,~$0C
                JR      C,HI2
                LD      A,E
                LD      B,~$03
HI2:            AND     A
                LD      A,B
                JR      NZ,HI3
                XOR     $0F
HI3:            OR      C
        ;; NB: Fall through

MoveToDirMask:  CALL    LookupDir
                JR      MoveDir

MoveAway:	CALL		CharDistAndDir
		XOR		$0F
		JR		MoveToDirMask
MoveTowards:	CALL		CharDistAndDir
		JR		MoveToDirMask

;; Return the absolute distances from the character in DE,
;; and direction as a bitmask in A.
CharDistAndDir: CALL    GetCharObj
                LD      DE,$0005
                ADD     HL,DE
                LD      A,(HL)
                INC     HL
                LD      H,(HL)
                LD      L,A
        ;; Character position now in HL.
                LD      C,$FF
                LD      A,H
                SUB     (IY+O_V)
                LD      D,A
        ;; Second coord diff in D...
                JR      Z,SndCoordMatch
                JR      NC,SndCoordDiff
                NEG
                LD      D,A
                SCF
        ;; Absolute coord diff in D...
SndCoordDiff:   PUSH    AF
                RL      C
                POP     AF
                CCF
                RL      C
        ;; Build 2 bits of direction flag in C
SndCoordMatch:  LD      A,(IY+O_U)
                SUB     L
                LD      E,A
                JR      Z,FstCoordMatch
                JR      NC,FstCoordDiff
                NEG
                LD      E,A
                SCF
        ;; Absolute coord diff in E...
FstCoordDiff:   PUSH    AF
                RL      C
                POP     AF
                CCF
                RL      C
                LD      A,C
        ;; Direction flag now in A.
                RET
FstCoordMatch:  RLC     C
                RLC     C
                LD      A,C
        ;; Direction flag now in A.
                RET

;; If bit 0 of DrawFlags is not set, set it and set the object extents.
UpdateObjExtents:
                LD      A,(DrawFlags)
                BIT     0,A
                RET     NZ
                OR      $01
                LD      (DrawFlags),A
                LD      HL,(CurrObject)
                JP      StoreObjExtents

;; Clear $0C and if any of DrawFlags are set, draw the thing.
ObjDraw:        LD      (IY+$0C),$FF
                LD      A,(DrawFlags)
                AND     A
                RET     Z
                CALL    UpdateObjExtents
                LD      HL,(CurrObject)
                CALL    Relink
                LD      HL,(CurrObject)
                JP      UnionAndDraw

FaceAndAnimate: CALL    SetFacingDirEx
        ;; NB: Fall through

;; Calls animate and MarkToDraw if it's an animation.
AnimateMe:      CALL    AnimateObj
                RET     NC
        ;; NB: Fall through

;; Sets bit 1 of DrawFlags
MarkToDraw:     LD      A,(DrawFlags)
                OR      $02
                LD      (DrawFlags),A
                RET

        ;; TODO: Hmmm. Looks like collision checks!
ObjAgain6:	AND		A,(IY+$0C)
		CP		$FF
		LD		(Collided),A
		RET		Z
		CALL	LookupDir
		CP		$FF
		LD		(Collided),A
		RET		Z
		PUSH	AF
		LD		(Collided),A
		CALL	MoveCurr
		POP		BC
		CCF
		JP		NC,OA6c
		PUSH	AF
		CP		B
		JR		NZ,OA6b
		LD		A,$FF
		LD		(Collided),A
OA6b:		CALL	UpdateObjExtents
		POP		AF
		CALL	UpdateCurrPos
		SCF
		RET
OA6c:		LD		A,(ObjDir)
		INC		A
		RET		Z
        ;; NB: Fall through
        
ObjAgain7:	LD		A,$06 ; TODO: ??
		JP		SetSound

        ;; TODO: Called quite a lot.
ObjAgain8:	BIT		4,(IY+$0C)
		JR		Z,ObjAgain10
        ;; NB: Fall through

ObjAgain9:	LD		HL,(CurrObject)
		CALL	DoContact2
		JR		NC,OA9c
		CCF
		JR		NZ,OA9b
		BIT		4,(IY+$0C)
		RET		NZ
		JR		ObjAgain10
OA9b:		BIT		4,(IY+$0C)
		SCF
		JR		NZ,OA9c
		RES		4,(IY+$0B)
		RET
OA9c:		PUSH	AF
		CALL	UpdateObjExtents
		RES		5,(IY+$0B)
		INC		(IY+O_Z)
		LD		A,$03 ; TODO: ??
		CALL	SetSound
		POP		AF
		RET		C
		INC		(IY+O_Z)
		SCF
		RET

ObjAgain10:	LD		HL,(CurrObject)
		CALL	ChkSatOn
		RES		4,(IY+$0B)
		JR		NC,OA10b
		CCF
		RET		Z
OA10b:		CALL	UpdateObjExtents
		DEC		(IY+O_Z)
		SCF
		RET

ObjAgain11:	LD		A,(IY+O_DIRECTION)
		ADD		A,$76
		LD		L,A
		ADC		A,$93
		SUB		L
		LD		H,A
		LD		A,(HL)
		RET

L9376:	DEFB $FD,$F9,$FB,$FA,$FE,$F6,$F7,$F5

SetFacingDirEx: LD      C,(IY+$10)      ; Read direction code
                BIT     1,C             ; Heading 'down'?
                RES     4,(IY+$04)      ; Set bit 4 of flags, if so.
                JR      NZ,SetFacingDir
                SET     4,(IY+$04)
        ;; NB: Fall through
SetFacingDir:   LD      A,(IY+$0F)      ; Load animation code.
                AND     A
                RET     Z               ; Return if not animated
                BIT     2,C             ; Heading right?
        ;; TODO: All seems a bit complicated for what I think it does.
                LD      C,A
                JR      Z,SFD1          ; Then jump to that case.
                BIT     3,C
                RET     NZ
                LD      A,$08
                JR      SFD2
SFD1:           BIT     3,C             ; Ret if sprite currently faces forward.
                RET     Z
                XOR     A               ; ...
SFD2:           XOR     C
                AND     $0F
                XOR     C
                LD      (IY+$0F),A
                RET

L93AA:	DEFB $00,$00,$00,$00,$00,$00

	;; The phase mechanism allows an object to not get processed
	;; for one frame.
DoObjects:	LD	A,(Phase)
		XOR	$80
		LD	(Phase),A 		; Toggle top bit of Phase
		CALL	CharThing
	;; Loop over main object list...
		LD	HL,(ObjectLists + 2)
		JR	DO_3
DO_1:		PUSH	HL
		LD	A,(HL)
		INC	HL
		LD	H,(HL)
		LD	L,A
		EX	(SP),HL			; Next item on top of stack, curr item in HL
		EX	DE,HL
		LD	HL,10   ; TODO
		ADD	HL,DE
	;; Check position +10
		LD	A,(Phase)
		XOR	(HL)
		CP	$80			; Skip if top bit doesn't match Phase
		JR	C,DO_2
		LD	A,(HL)
		XOR	$80
		LD	(HL),A			; Flip top bit - will now mismatch Phase
		AND	$7F
		CALL	NZ,CallObjFn 		; And if any other bits set, call CallObjFn
DO_2:		POP	HL
DO_3:		LD	A,H			; loop until null pointer.
		OR	L
		JR	NZ,DO_1
		RET

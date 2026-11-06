	;; 
	;; character.asm
	;;
	;; Does a lot of stuff which seems to care about Character.
	;;
	;; Looks like it hangs together, but needs a lot of
	;; reverse-engineering
	;; 

	;; Exported functions:
	;; * CharThing
	;; * CharThing3
	;; * SetSound
	;; * GetCharObj
	;; * CharThing15
	;; * DrawCarriedObject

	;; Unknown functions that are called:
	;; C8D7F
	;; DoorContact
	;; LB21C
	
	
	;; Something of an epic function...
	;; Think it involves general movement/firing etc.
CharThing:
        ;; If currently wiggled, unwiggle.
		LD	A,(WiggleState)
		RLA
		CALL	C,WiggleEyebrows
        ;; TODO...
		LD	HL,LB219
		LD	A,(HL)
		AND	A
		JR	Z,EPIC_1
		EXX
		LD	HL,Character
		LD	A,(Dying)
		AND	(HL)
		EXX
		JP	NZ,HandleDeath 		; NB: Tail call
		CALL	HandleDeath
EPIC_1:		LD	HL,LA296
		LD	A,(HL)
		AND	A
		JP	NZ,EPIC_14
		INC	HL
		OR	(HL)
		JP	NZ,EPIC_13

	;; Deal with invuln counter every 3 frames.
		LD	HL,InvulnModulo
		DEC	(HL)
		JR	NZ,EPIC_2
		LD	(HL),$03
		LD	HL,(Character)
		LD	A,H
		ADD	A,A
		OR	H
		OR	L
		RRA
		PUSH	AF
	;; Use up heels invuln
		LD	A,$02
		CALL	C,DecCount
		POP	AF
		RRA
	;; Use up head invuln
		LD	A,$03
		CALL	C,DecCount
EPIC_2:		LD	A,$FF
		LD	(Movement),A
		LD	A,(NextRoom)
		AND	A
		JR	Z,EPIC_4
		LD	A,(SavedObjListIdx)
		AND	A
		JR	Z,EPIC_3
		LD	A,(CharDir)
		SCF
		RLA
		LD	(CurrDir),A
		JR	EPIC_4
EPIC_3:		LD	(NextRoom),A
EPIC_4:		CALL	CharThing4
	;; NB: Big loop back up to here.
EPIC_5:		CALL	GetCharObj
		PUSH	HL
		POP	IY
		LD	A,(IY+$07)
		CP	$84
		JR	NC,DoFire
		XOR	A
		LD	(LA29F),A
		LD	A,(FloorAboveFlag)
		AND	A
		JR	NZ,DoFire
		LD	A,$06
		LD	(NextRoom),A
	;;  NB: Fall through

	;; Check for Fire being pressed
DoFire:		LD	A,(FirePressed)
		RRA
		JR	NC,NotFire
		LD	A,(Character)
		OR	~2
		INC	A
		LD	HL,SavedObjListIdx
		OR	(HL)
		JR	NZ,NopeFire 	; Skips if not Head (alone) or FIXME
		LD	A,(Inventory)
		OR	~6
		INC	A
		JR	NZ,NopeFire 	; Skips if don't have donuts and a hooter
		LD	A,(FiredObj+$0F)
		CP	$08
		JR	NZ,NopeFire 	; Skips if not FIXME
		LD	HL,HeadObj+$05
		LD	DE,FiredObj+$05
		LD	BC,3            ; TODO
		LDIR			; Copies X/Y/Z coordinate from Head.
		LD	HL,FiredObj
		PUSH	HL
		POP	IY		; Sets IY to FiredObj
	;; Set initial phase and object function
		LD	A,(Phase)
		OR	$19		; ObjFnFire
		LD	(FiredObj+$0A),A
	;; FIXME: Initialise other fields...
		LD	(IY+$04),$00
		LD	A,(CharDir)
		LD	(FiredObj+$0B),A
		LD	(IY+$0C),$FF
		LD	(IY+$0F),$20
		CALL	EnlistAux
	;; Use up a donut
		LD	A,$06
		CALL	DecCount
		LD	B,$48                   ; Donut firing noise
		CALL	PlaySound
		LD	A,(Donuts)
		AND	A
		JR	NZ,NotFire
		LD	HL,Inventory
		RES	2,(HL)			; Run out of donuts
		CALL	DrawScreenPeriphery
		JR	NotFire
NopeFire:	CALL	NopeNoise
	;; Next section?
NotFire:	LD	HL,NextRoom
		LD	A,(HL)
		AND	$7F
		RET	Z
		LD	A,(LB219)
		AND	A
		JR	Z,EPIC_9
		LD	(HL),$00
		RET
EPIC_9:		LD	A,(InSameRoom)
		AND	A
		JR	Z,EPIC_12
		CALL	GetCharObj
		PUSH	HL
		POP	IY
		CALL	Unlink
		LD	A,(Character)
		CP	$03
		JR	Z,EPIC_12
		LD	HL,LA2A6
		CP	(HL)
		JR	Z,EPIC_10
		XOR	$03
		LD	(HL),A
		JR	EPIC_11
EPIC_10:	LD	HL,LFB49
		LD	DE,LA2A2
		LD	BC,5 ; TODO
		LDIR
EPIC_11:	LD	HL,0
		LD	(LA2CD),HL
		LD	(LA2DF),HL
		CALL	SaveStuff
EPIC_12:	LD	HL,0
		LD	(Carrying),HL
		JP	GoToRoom
EPIC_13:	DEC	(HL)
		LD	HL,(Character)
		JP	CharThing18 		; NB: Tail call
EPIC_14:	DEC	(HL)
		LD	HL,(Character)
		JP	NZ,CharThing19 		; NB: Tail call
		LD	A,$07                   ; Teleport
		LD	(NextRoom),A
		JP	EPIC_5

	;; TODO: Almost certainly, "die"
;; HL holds LB219
HandleDeath:	DEC	(HL)                    ; ??
		JP	NZ,CharThing20 		; NB: Tail call
        ;; Drop what you're carrying.
		LD	HL,$0000
		LD	(Carrying),HL
        ;; Decrement lives counters.
		LD	HL,Lives
		LD	BC,(Dying)
		LD	B,$02   ; Run over both characters..
		LD	D,$FF   ; D is set to $FF
HD_1:		RR	C
		JR	NC,HD_2 ; Skip if C bit not set.
		LD	A,(HL)  ; Decrement lives counter.
		SUB	$01
		DAA
		LD	(HL),A
		JR	NZ,HD_2
		LD	D,$00   ; D updated to $00 if any lives reduced.
HD_2:		INC	HL
		DJNZ	HD_1
        ;; If no lives left, game over.
		DEC	HL
		LD	A,(HL)
		DEC	HL
		OR	(HL)
		JP	Z,FinishGame
        ;; No lives lost, then skip to the end.
		LD	A,D
		AND	A
		JR	NZ,HD_9
        ;; FIXME: Messy below here.
		LD	HL,Lives
		LD	A,(InSameRoom)
		AND	A
		JR	Z,HD_6
		LD	A,(LA2A6)
		CP	$03
		JR	NZ,HD_4
        ;; LA2A6 = Lives != 0 ? 1 : 2
		LD	A,(HL)
		AND	A
		LD	A,$01
		JR	NZ,HD_3
		INC	A
HD_3:		LD	(LA2A6),A
		JR	HD_9
        ;; 
HD_4:		RRA
		JR	C,HD_5
		INC	HL
HD_5:		LD	A,(HL)
		AND	A
		JR	NZ,HD_8
		LD	(InSameRoom),A
        ;; Assuming this is "all lives lost, try other character"
HD_6:		CALL	SwitchChar
		LD	HL,0
		LD	(LB219),HL
HD_7:		LD	HL,OtherState
		SET	0,(HL)
		RET
HD_8:		CALL	HD_7
        ;; 
HD_9:		LD	A,(LA2A6)
		LD	(Character),A
		CALL	CharThing3
        ;; Restore the UVZ position of the character as we enter the room.
		CALL	GetCharObj
		LD	DE,5 ; TODO
		ADD	HL,DE
		EX	DE,HL
		LD	HL,EntryPosn
		LD	BC,3    ; TODO
		LDIR
        ;; TODO: Restore something, jump somewhere.
		LD	A,(LA2A2)
		LD	(NextRoom),A
		JP	RoomLongJmp

CharThing18:	PUSH	HL
		LD	HL,VapeLoop2
		JR	CharThing21 		; NB: Tail call
	
CharThing20:	LD	HL,(Dying)
	;; NB: Fall through
	
CharThing19:	PUSH	HL
		LD	HL,VapeLoop1
	;; NB: Fall through

CharThing21:	LD	IY,HeelsObj
		CALL	ReadLoop
		POP	HL
		PUSH	HL
		BIT	1,L
		JR	Z,EPIC_29
		PUSH	AF
		LD	(HeadFrame),A
		RES	3,(IY+$16)
		LD	HL,HeadObj
		CALL	StoreObjExtents
		LD	HL,HeadObj
		CALL	UnionAndDraw
		POP	AF
EPIC_29:	POP	HL
		RR	L
		RET	NC
		XOR	$80
		LD	(HeelsFrame),A
		RES	3,(IY+$04)
		LD	HL,HeelsObj
		CALL	StoreObjExtents
		LD	HL,HeelsObj
		JP	UnionAndDraw			; NB: Tail call

        ;; Put bit 0 of A into bit 2 of SwopPressed
CharThing3:	AND	$01
		RLCA
		RLCA
		LD	HL,SwopPressed
		RES	2,(HL)
		OR	(HL)
		LD	(HL),A
		RET

	;; Looks like more movement stuff
CharThing4:	CALL	GetCharObj
		PUSH	HL
		POP	IY
		LD	A,$3F   ; Stop 0x0X noise
		LD	(OtherSoundId),A
		LD	A,(SavedObjListIdx)
		CALL	SetObjList
		CALL	GetCharObj
		CALL	StoreObjExtents
		LD	HL,LA29F
		LD	A,(HL)
		AND	A
		JR	Z,EPIC_37
		LD	A,(SavedObjListIdx)
		AND	A
		JR	Z,EPIC_31
		LD	(HL),$00
		JR	EPIC_37
EPIC_31:	DEC	(HL)
		CALL	GetCharObj
		CALL	ChkSatOn
		JR	C,EPIC_32
		DEC	(IY+$07)
		LD	A,$84   ; TODO: Repeated rising sequence
		CALL	SetOtherSound
		JR	EPIC_33
EPIC_32:	EX	AF,AF'
		LD	A,$88   ; TODO: Menu blip
		BIT	4,(IY+$0B)
		SET	4,(IY+$0B)
		CALL	Z,SetOtherSound
		EX	AF,AF'
		JR	Z,EPIC_34
EPIC_33:	RES	4,(IY+$0B)
		SET	5,(IY+$0B)
		DEC	(IY+$07)
EPIC_34:	LD	A,(Character)
		AND	$02
		JR	NZ,EPIC_36
EPIC_35:	LD	A,(CharDir)
		JP	HandleMove
EPIC_36:	LD	A,(CurrDir)
		RRA
		CALL	LookupDir
		INC	A
		JP	NZ,EPIC_42
		JR	EPIC_35
EPIC_37:	SET	4,(IY+$0B)
		SET	5,(IY+$0C)
		CALL	GetCharObj
		LD	A,(NextRoom)
		AND	A
		JR	NZ,EPIC_38
		CALL	DoorContact
		JP	NC,CharThing23 		; NB: Tail call
		JP	NZ,CharThing22		; NB: Tail call
EPIC_38:	LD	A,(NextRoom)
		RLA
		JR	NC,EPIC_39
		LD	(IY+$0C),$FF
EPIC_39:	LD	A,$86   ; TODO High blip
		BIT	5,(IY+$0B)
		SET	5,(IY+$0B)
		CALL	Z,SetOtherSound 		; NB: Tail call
		BIT	4,(IY+$0C)
		SET	4,(IY+$0C)
		JR	NZ,EPIC_41
		CALL	GetCharObj
		CALL	ChkSatOn
		JR	NC,EPIC_40
		JR	NZ,EPIC_40
		LD	A,$88   ; TODO Menu blip
		CALL	SetOtherSound
		JR	EPIC_41
EPIC_40:	DEC	(IY+$07)
		RES	4,(IY+$0B)
EPIC_41:	XOR	A
		LD	(LA29E),A
		CALL	DoCarry
		CALL	DoJump
EPIC_42:	LD	A,(CurrDir)
		RRA
        ;; Fall through

;; Do the actual movement stuff. Direction in A.
HandleMove:     CALL    MoveChar
                CALL    Orient
                EX      AF,AF'
                LD      A,(IsStill)
                INC     A
                JR      NZ,HM_3         ; Jump to HM_3 for moving case.
        ;; Character-is-still case.
        ;; Reset the animation loops for whichever Character is running now.
                XOR     A
                LD      HL,Character
                BIT     0,(HL)
                JR      Z,HM_1
                LD      (HeelsLoop),A
                LD      (HeelsBLoop),A
HM_1:           BIT     1,(HL)
                JR      Z,HM_2
                LD      (HeadLoop),A
                LD      (HeadBLoop),A
        ;; If facing towards us, do wiggle. Set BC appropriately.
HM_2:           EX      AF,AF'
                LD      BC,SPR_HEELSB1 << 8 | SPR_HEADB1
                JR      C,HM_7
                CALL    DoWiggle
                LD      BC,SPR_HEELS1 << 8 | SPR_HEAD2
                JR      HM_7
        ;; Choose animation frame for movement.
        ;; A' carry -> facing away.
HM_3:           EX      AF,AF'
                LD      HL,HeelsLoop
                LD      DE,HeadLoop
                JR      NC,HM_4
                LD      HL,HeelsBLoop
                LD      DE,HeadBLoop
HM_4:           PUSH    DE
        ;; Update HeelsFrame if Character contains Heels
                LD      A,(Character)
                RRA
                JR      NC,HM_5
                CALL    ReadLoop
                LD      (HeelsFrame),A
HM_5:           POP     HL
        ;; Update HeadFrame if Character contains Head.
                LD      A,(Character)
                AND     $02
                JR      Z,HM_6
                CALL    ReadLoop
                LD      (HeadFrame),A
        ;; TODO: Set some bit.
HM_6:           SET     5,(IY+$0B)
                JR      UpdateChar              ; NB: Tail call.
        ;; TODO: Also set some bit.
HM_7:           SET     5,(IY+$0B)
        ;; NB: Fall through

;; Update the character animation frames to values in BC, and then
;; call UpdateChar.
UpdateCharFrame:LD      A,(Character)
                RRA
                JR      NC,UCF_1
        ;; Heels case.
                LD      (IY+$08),B
UCF_1:          LD      A,(Character)
                AND     $02
                JR      Z,UpdateChar           ; NB: Tail call
        ;; Head case.
                LD      A,C
                LD      (HeadFrame),A
        ;; NB: Fall through

;; Actually resort and redraw the character in IY.
UpdateChar:     LD      A,(Movement)
                LD      (IY+$0C),A
                CALL    GetCharObj
                CALL    Relink
                CALL    SaveObjListIdx
                XOR     A
                CALL    SetObjList              ; Switch to default object list
                CALL    GetCharObj
                CALL    UnionAndDraw
                JP      PlayOtherSound          ; NB: Tail call

DoWiggle:
        ;; Decrement counter and return if >= 3.
                LD      HL,WiggleCounter
                DEC     (HL)
                LD      A,$03
                SUB     (HL)
                RET     C
        ;; If it's 3, wiggle.
                JR      Z,DW_1
                CP      $03
                RET     NZ
        ;; If it's 0, reset counter and unwiggle
                LD      (HL),$40
DW_1:           JP      WiggleEyebrows          ; NB: Tail call.

CharThing22:	LD	HL,LA29E
		LD	A,(HL)
		AND	A
		LD	(HL),$FF
		JR	Z,CharThing24 		; NB: Tail call
		CALL	DoCarry
		CALL	DoJump
		XOR	A
		JR	CharThing24 		; NB: Tail call
	
CharThing23:	XOR	A
		LD	(LA29E),A
		INC	A
	;; NB: Fall through
CharThing24:	LD	C,A
		CALL	ResetTickTock
		RES	5,(IY+$0B)
		LD	A,(Character)
		AND	$02
		JR	NZ,EPIC_59
		DEC	C
		JR	NZ,EPIC_60
		INC	(IY+$07)
EPIC_59:	INC	(IY+$07)
		AND	A
		JR	NZ,EPIC_61
		LD	A,$82   ; TODO: Faster falling noise
		CALL	SetOtherSound
		LD	HL,LA293
		LD	A,(HL)
		AND	A
		JR	Z,EPIC_63
		DEC	(HL)
		LD	A,(CharDir)
		JR	EPIC_62
EPIC_60:	INC	(IY+$07)
EPIC_61:	LD	A,$83   ; TODO: Slower falling noise
		CALL	SetOtherSound
		LD	A,(CurrDir)
		RRA
EPIC_62:	CALL	MoveChar
EPIC_63:	CALL	Orient
		LD	BC,SPR_HEELSB1 << 8 | SPR_HEADB1
		JP	C,UpdateCharFrame
		LD	BC,SPR_HEELS1 << 8 | SPR_HEAD
		JP	UpdateCharFrame

;; Sets bit 4 of offset 4 if $02 bit is set (sprite needs flip),
;; returns with carry if facing away.
Orient:         LD      A,(CharDir)
                CALL    LookupDir
                RRA
                RES     4,(IY+$04)
                RRA
                JR      C,O_1
                SET     4,(IY+$04)
O_1:            RRA
                RET

;; Move the character.
MoveChar:	OR	$F0
		CP	$FF
		LD	(IsStill),A
		JR	Z,MC_1
		EX	AF,AF'
		XOR	A
		LD	(IsStill),A
		LD	A,$80   ; TODO: Slower walking sound
		CALL	SetOtherSound
		EX	AF,AF'
		LD	HL,CharDir
		CP	(HL)
		LD	(HL),A
		JR	Z,MC_2
MC_1:		CALL	ResetTickTock
		LD	A,$FF
MC_2:		PUSH	AF
		AND	A,(IY+$0C)
		CALL	LookupDir
		CP	$FF
		JR	Z,MC_3
		CALL	GetCharObj
		CALL	Move	
		JR	NC,MC_5
		LD	A,(IY+$0B)
		OR	$F0
		INC	A
		LD	A,$88   ; TODO: Menu blip
		CALL	NZ,SetOtherSound
MC_3:		POP	AF
		LD	A,(IY+$0B)
		OR	$0F
		LD	(IY+$0B),A
		RET
        ;; Direction bitmask is on stack. "Move" has been called.
        ;; Update position and do the speed-related movement when when
        ;; TickTock hits zero.
MC_5:           CALL    GetCharObj
                CALL    UpdatePos
                POP     BC
                LD      HL,TickTock
                LD      A,(HL)
                AND     A
                JR      Z,MC_6
                DEC     (HL)
                RET
        ;; Do a bit more movement if we're Heels or have speed.
        ;; Direction bitmask is in B
MC_6:           LD      HL,Speed ; We're fast if we have Speed or are Heels...
                LD      A,(Character)
                AND     $01
                OR      (HL)
                RET     Z
        ;; Deal with speed counter every other time
                LD      HL,SpeedModulo
                DEC     (HL)
                PUSH    BC
                JR      NZ,MC_7
                LD      (HL),$02
                LD      A,(Character)
                RRA
                JR      C,MC_7
        ;; Use up speed if heels not present
                LD      A,$00
                CALL    DecCount
        ;; Do the sound bit...
MC_7:           LD      A,$81   ; TODO: Running sound.
                CALL    SetOtherSound
        ;; Convert bitmap to direction.
                POP     AF
                CALL    LookupDir
        ;; Return if not moving...
                CP      $FF
                RET     Z
        ;; And do a bit of movement.
                CALL    GetCharObj
                PUSH    HL
                CALL    Move
                POP     HL
                JP      NC,UpdatePos
        ;; Failing to move...
                LD      A,$88           ; TODO: Menu blip
                JP      SetOtherSound   ; NB: Tail call

;; The TickTock counter cycles down from 2. Reset it.
ResetTickTock:  LD      A,$02
                LD      (TickTock),A
                RET


	
DoJump:		LD	A,(Character)
	;; Zero LA293 if it's Heels
		LD	B,A
		DEC	A
		JR	NZ,DJ_1
		XOR	A
		LD	(LA293),A
DJ_1:		LD	A,(SavedObjListIdx)
		AND	A
		RET	NZ
	;; Return if jump not pressed.
		LD	A,(CurrDir)
		RRA
		RET	C
	;; Jump button handling case
		LD	C,$00
		LD	L,(IY+$0D)
		LD	H,(IY+$0E)
		LD	A,H
		OR	L
		JR	Z,DJ_5
		PUSH	HL
		POP	IX
		BIT	0,(IX+$09)
		JR	Z,DJ_3
		LD	A,(IX+$0B)
		OR	$CF
		INC	A
		RET	NZ
DJ_3:		LD	A,(IX+$08)
		AND	$7F
		CP	$57
		JR	Z,DJ_10
		CP	$2B
		JR	Z,DJ_4
		CP	$2C
		JR	NZ,DJ_5
DJ_4:		INC	C
DJ_5:		LD	A,(Character)
		AND	$02
		JR	NZ,DJ_6
	;; No Head - use up a spring
		PUSH	BC
		LD	A,$01
		CALL	DecCount
		POP	BC
		JR	Z,DJ_7
	;;  Head
DJ_6:		INC	C
DJ_7:		LD	A,C
		ADD	A,A
		ADD	A,A
		ADD	A,$04
		CP	$0C
		JR	NZ,DJ_8
		LD	A,$0A
DJ_8:		LD	(LA29F),A
		LD	A,$85   ; TODO: High blip
		DEC	B
		JR	NZ,DJ_9
		LD	HL,LA293
		LD	(HL),$07
DJ_9:		JP	SetOtherSound 	; NB: Tail call
DJ_10:		LD	HL,$080C        ; TODO
		LD	(LA296),HL
		LD	B,$C7           ; Teleporter beam up noise
		JP	PlaySound


	;; Position where the contents being carried are drawn.
CARRY_POSN:	EQU	216 << 8 | 176
	
DoCarry:	LD	A,(CarryPressed)
		RRA
		RET	NC
		LD	A,(Inventory) 		; Check if we have the purse
		RRA
PurseNope:	JP	NC,NopeNoise 		; Tail call
		LD	A,(Character)
		AND	$01
		JR	Z,PurseNope 		; Check if heels is present
		LD	A,$87			; FIXME: Sweep down and up
		CALL	SetOtherSound
		LD	A,(Carrying+1)
		AND	A
		JR	NZ,DropCarried 		; If holding something, drop it
		CALL	GetCharObj
		CALL	GetStoodUpon
		JR	NC,PurseNope		; NC if nothing there
		LD	A,(IX+$08)		; Load sprite of thing carried
		PUSH	HL
		LD	(Carrying),HL 		; Save carried thing
		LD	BC,CARRY_POSN
		PUSH	AF
		CALL	Draw3x24 		; Draw the item now carried
		POP	AF
		POP	HL
		JP	RemoveObject		; Tail call
DropCarried:	LD	A,(SavedObjListIdx)
		AND	A
		JP	NZ,NopeNoise 		; FIXME: Can't drop if ???
		LD	C,(IY+$07)
		LD	B,$03
CarryLoop:	CALL	GetCharObj
		PUSH	BC
		CALL	ChkSatOn
		POP	BC
		JR	C,NoDrop
		DEC	(IY+$07)
		DEC	(IY+$07)
		DJNZ	CarryLoop
	;; FIXME: That was some other test...
		LD	HL,(Carrying)
		PUSH	HL
		LD	DE,7    ; TODO
		ADD	HL,DE
		PUSH	HL
		CALL	GetCharObj
		LD	DE,6    ; TODO
		ADD	HL,DE
		EX	DE,HL			; CharObj + 6 in DL
		POP	HL			; Object + 7 in HL
		LD	(HL),C			; Overwrite id thing with C...
		EX	DE,HL
		DEC	DE
		LDD
		LDD
		POP	HL
		CALL	InsertObject
		LD	HL,0
		LD	(Carrying),HL
		LD	BC,CARRY_POSN
		CALL	Clear3x24 		; Clear out the what's-carried display
		CALL	GetCharObj
		CALL	DoorContact
		CALL	GetCharObj
		JP	StoreObjExtents
NoDrop:		LD	(IY+$07),C 		; Restore old value
		JP	NopeNoise		; Tail call

SetSound:	LD	HL,SoundId 	; FIXME: Unused?
		JR	BumpUp

SetOtherSound:	LD	HL,OtherSoundId
	;; Fall through.
        
	;; Sets (HL) to A if A > (HL)
BumpUp:		CP	(HL)
		RET	C
		LD	(HL),A
		RET

PlayOtherSound:	LD	A,(OtherSoundId)
		OR	$80
		LD	B,A
		CP	$85
		JP	NC,PlaySound
		LD	A,(MENU_SOUND)
		AND	A
		RET	NZ
		JP	PlaySound

	;; Get the object data structure associated with the character.
GetCharObj:	LD	HL,Character
		BIT	0,(HL)
		LD	HL,HeelsObj
		RET	NZ
		LD	HL,HeadObj
		RET


	
CharThing15:	XOR	A 	; FIXME: Unused?
		LD	(VapeLoop1),A
		LD	(LA296),A
		LD	(VapeLoop2),A
		LD	A,$08
		LD	(FiredObj+$0F),A
		CALL	SetCharFlags
		LD	A,(Character)
		LD	(LA2A6),A
		CALL	GetCharObj
		PUSH	HL
		PUSH	HL
		PUSH	HL
		POP	IY
		LD	A,(NextRoom)
		LD	(LA2A2),A
		PUSH	AF
		SUB	$01
		PUSH	AF
		CP	$04
		JR	NC,EPIC_86
		XOR	$01
		LD	E,A
		LD	D,$00
		LD	HL,DoorHeights
		ADD	HL,DE
		LD	C,(HL)
		LD	HL,LAA6E
		ADD	HL,DE
		LD	A,(HasNoWall)
		AND	(HL)
		JR	NZ,EPIC_86
		LD	(IY+$07),C
EPIC_86:	CALL	GetCharObj
		LD	DE,5 ; TODO
		ADD	HL,DE
		EX	DE,HL
		POP	AF
		JR	C,EPIC_93
		CP	$06
		JR	Z,EPIC_90
		JR	NC,EPIC_92
		CP	$04
		JR	NC,EPIC_88
		LD	HL,MinU
		LD	C,$FD
		RRA
		JR	NC,EPIC_87
		INC	DE
		INC	HL
EPIC_87:	RRA
		JR	C,EPIC_95
		LD	C,$03
		INC	HL
		INC	HL
		JR	EPIC_95
EPIC_88:	INC	DE
		INC	DE
		RRA
		LD	A,$84
		JR	NC,EPIC_89
		LD	A,(L7B8F)
		AND	A
		LD	A,$BA
		JR	Z,EPIC_89
		LD	A,$B4
EPIC_89:	LD	(DE),A
		POP	AF
		JR	EPIC_97
EPIC_90:	INC	DE
		INC	DE
		LD	A,(L7B8F)
		AND	A
		JR	Z,EPIC_91
		LD	A,(DE)
		SUB	$06
		LD	(DE),A
EPIC_91:	LD	B,$C8           ; Teleport beam down noise
		CALL	PlaySound
		JR	EPIC_96
EPIC_92:	LD	HL,L8ADF
		JR	EPIC_94
EPIC_93:	LD	HL,LAA64
EPIC_94:	LDI
		LDI
		LDI
		JR	EPIC_96
EPIC_95:	LD	A,(HL)
		ADD	A,C
		LD	(DE),A
EPIC_96:	POP	AF
		ADD	A,$67
		LD	L,A
		ADC	A,$AA
		SUB	L
		LD	H,A
		LD	A,(HL)
		LD	(CharDir),A
EPIC_97:	LD	A,$80
		LD	(NextRoom),A
		POP	HL
		LD	DE,5    ; TODO
		ADD	HL,DE
		LD	DE,EntryPosn
		LD	BC,3    ; TODO
		LDIR
		LD	(IY+$0D),$00
		LD	(IY+$0E),$00
		LD	(IY+$0B),$FF
		LD	(IY+$0C),$FF
		POP	HL
		CALL	Enlist
		CALL	SaveObjListIdx
		XOR	A
		LD	(LB219),A
		LD	(Dying),A
		LD	(L7B8F),A
		JP	SetObjList ; Switch to default object list
	
SaveObjListIdx:	LD	A,(ObjListIdx)
		LD	(SavedObjListIdx),A
		RET

	
DrawCarriedObject:	LD	A,(Character)
			LD	HL,InSameRoom
			RRA
			OR	(HL)
			RRA
			RET	NC		; Return if low bit not set on InSameRoom and not head
			LD	HL,(Carrying)
			INC	H
			DEC	H
			RET	Z		; Return if high byte zero...
			LD	DE,8            ; TODO
			ADD	HL,DE
			LD	A,(HL)		; Get sprite from object pointed to...
			LD	BC,CARRY_POSN
			JP	Draw3x24 	; And draw it

LAA64:	DEFB $28,$28,$C0,$FD,$FD,$FB,$FE,$F7,$FD,$FD
LAA6E:	DEFB 08,$04,$02,$01

	;; 
	;; stuff.asm
	;;
	;; TODO: Misc stuff?
	;;

InitStuff:	CALL	IrqInstall
		JP	InitRevTbl

InitNewGame:	XOR	A
		LD	(WorldMask),A
		LD	(NextRoom),A
		LD	(Continues),A
		LD	A,$18
		LD	(HeelsFrame),A
		LD	A,$1F
		LD	(HeadFrame),A
		CALL	InitNewGame1
		CALL	Reinitialise
		DEFW	StatusReinit
		CALL	ResetSpecials
		LD	HL,$8940 ; TODO: Starting room?
		LD	(RoomId),HL
		LD	A,$01
		CALL	InitThings
		LD	HL,$8A40 ; TODO: Starting room?
		LD	(RoomId),HL
		XOR	A
		LD	(NextRoom),A
		RET

InitThings:	LD	(Character),A
		PUSH	AF
		LD	(OtherState),A
		CALL	EnterRoom
		XOR	A
		LD	(LA297),A
		CALL	CharThing15
		JR	IT_2
IT_1:		CALL	CharThing
IT_2:		LD	A,(SavedObjListIdx)
		AND	A
		JR	NZ,IT_1
		POP	AF
		XOR	$03
		LD	(Character),A
		CALL	CharThing3
		JP	SaveStuff	; Tail call

InitContinue:	CALL	Reinitialise
		DEFW	StatusReinit
		LD	A,$08
		CALL	UpdateAttribs	; Blacked-out attributes
		JP	DoContinue	; Tail call

FinishRestore:	CALL	BuildRoomNoObj
		CALL	Reinitialise
		DEFW	ReinitThing
		CALL	SetCharFlags
		CALL	GetScreenEdges
		CALL	DrawBlacked
		XOR	A
		LD	(InSameRoom),A
		JR	RevealScreen	; Tail call

L7B8F:		DEFB $00
WorldIdSnd:	DEFB $00

;; Enter the room, and then also make the sound and display it.
EnterRoom2:     CALL    EnterRoom
                LD      A,(MENU_SOUND)
                AND     A
                JR      NZ,ER2_2
                LD      A,(WorldId)
                CP      $07
                JR      NZ,ER2_1
                LD      A,(WorldIdSnd)
ER2_1:          LD      (WorldIdSnd),A
                OR      $40
                LD      B,A
                CALL    PlaySound       ; $40-$46 are world noises?
ER2_2:          CALL    DrawBlacked
                CALL    CharThing15
        ;; NB: Fall through

;; Apply the attributes to make the screen visible, and draw the bits
;; around the edge.
RevealScreen:   LD      A,(AttribScheme)
                CALL    UpdateAttribs
                CALL    PrintStatus
                JP      DrawScreenPeriphery             ; Tail call

EnterRoom:	CALL	Reinitialise
		DEFW	ObjVars
		CALL	Reinitialise
		DEFW	ReinitThing
		LD	A,(Character)
		CP	$03
		JR	NZ,ER_1
		LD	HL,OtherState
		SET	0,(HL)
		CALL	BuildRoom
		LD	A,$01
		JR	ER_5
ER_1:		CALL	IsSharedRoom
		JR	NZ,ER_4
        ;; Same room case...
		CALL	RestoreStuff2
		CALL	BuildRoomNoObj
		LD	HL,HeelsObj
		CALL	GetUVZExtentsB
		EXX
		LD	HL,HeadObj
		CALL	GetUVZExtentsB
		CALL	CheckOverlap
		JR	NC,ER_3
		LD	A,(Character)
		RRA
		JR	C,ER_2
		EXX
ER_2:		LD	A,B
		ADD	A,$05
		EXX
		CP	B
		JR	C,ER_3
		LD	A,$FF
		LD	(L7B8F),A
ER_3:		LD	A,$01
		JR	ER_5
        ;; Different rooms case
ER_4:		CALL	BuildRoom
		XOR	A
ER_5:		LD	(InSameRoom),A
		JP	GetScreenEdges

#include "gfx2/init_bkgnd.asm"

	;; A funky shuffle routine: Load a pointer from the top of stack.
	;; (i.e. our return address contains data to skip over)
	;; The pointed value points to a size. We copy that much data
	;; from directly after it to a size later.
	;; i.e. 5 A B C D E M N O P Q becomes 5 A B C D E A B C D E.
	;; Useful for reinitialising structures.
Reinitialise:
	;; Dereference top of stack into HL, incrementing pointer
		POP	HL
		LD	E,(HL)
		INC	HL
		LD	D,(HL)
		INC	HL
		PUSH	HL
		EX	DE,HL
	;; Dereference /that/ into bottom of BC
		LD	C,(HL)
		LD	B,$00
	;; Then increment HL and set DE = HL + BC
		INC	HL
		LD	D,H
		LD	E,L
		ADD	HL,BC
		EX	DE,HL
	;; Finally LDIR
		LDIR
		RET

;;
;; objects.asm
;;
;; Functions dealing with objects and animations.
;;

;; Exported functions:
;;  * InitObj
;;  * SetObjSprite
;;  * AnimateObj
;;  * CallObjFn

;; Exported variables:
;;  * CurrObject
;;  * ObjDir
;;  * BottomSprite

CurrObject:     DEFW $0000
ObjDir:         DEFB $FF
        ;; The sprite used in the bottom half of a double-height sprite.
BottomSprite:   DEFB $00
        ;; Values BottomSprite can take
Bottoms:        DEFB SPR_TAP, ANIM_VAPE3, SPR_TAP
        ;; Convert Bottoms into a 1-based array.
BottomsArr:     EQU Bottoms - 1

;; Takes an object pointer in IY, an object code in A, and initialises it.
;; Doesn't set flags, direction code, or coordinates.
;; Caller should call AddObject when you're done to copy it into the room.
InitObj:        LD      (IY+$09),$00    ; Sprite flags
        ;; Look up A in the ObjDefns table.
                LD      L,A
                LD      E,A
                LD      D,$00
                LD      H,D
                ADD     HL,HL
                ADD     HL,DE
                LD      DE,ObjDefns
                ADD     HL,DE
        ;; Stash sprite code in B
                LD      B,(HL)
        ;; Bottom 6 bits of second byte are the 'object function'
                INC     HL
                LD      A,(HL)
                AND     $3F
                LD      (IY+$0A),A
        ;; Grab top 2 bits...
                LD      A,(HL)
                INC     HL
                RLCA
                RLCA
                AND     $03
                JR      Z,IO_1
        ;; If non-zero, adjust BottomSprite:
        ;; Value in A is used to index after BottomSprite, and fetched to A.
                ADD     A,BottomsArr & $FF
                LD      E,A
                ADC     A,BottomsArr >> 8
                SUB     E
                LD      D,A
                LD      A,(DE)
        ;; Set the doubled-object bit...
                SET     5,(IY+$09)
        ;; And if bit 2 of the third byte is set, swap A and B.
        ;; (i.e. Stash current sprite in the bottom, and use bottom
        ;; sprite for the current object.)
                BIT     2,(HL)
                JR      Z,IO_1
                LD      C,B
                LD      B,A
                LD      A,C
IO_1:           LD      (BottomSprite),A
                LD      A,B
                CALL    SetObjSprite
        ;; Load third byte of the object definition.
                LD      A,(HL)
                OR      ~$60
                INC     A
                LD      A,(HL)
        ;; If $60 is set, set bit 7 of the sprite flags...
                JR      NZ,IO_2
                SET     7,(IY+$09)
        ;; and reset bit $40 of the flags
                AND     ~$40
IO_2:           AND     ~$04            ; Clear bit 3.
                CP      $80
                RES     7,A
                LD      (IY-$01),A      ; Write stuff before start of sprite?!
                LD      (IY-$02),$02
                RET     C
        ;; and set bit 4 (non-deadly?) if top bit was set.
                SET     4,(IY+$09)
                RET

;; Set the sprite or animation up for an object.
;; Object pointer in IY, sprite/animation code in A
SetObjSprite:
        ;; Clear animation code, and set sprite code.
                LD      (IY+O_ANIM),$00
                LD      (IY+O_SPRITE),A
        ;; Sprite code > $80?
                CP      $80
                RET     C
        ;; Then it's an animation. Left shift by three bits and put
        ;; the code into the animation code.
                ADD     A,A
                ADD     A,A
                ADD     A,A
                LD      (IY+$0F),A
                PUSH    HL
                CALL    Animate
                POP     HL
                RET

	;; Takes an object pointer in DE, and index thing in A
CallObjFn:	LD	(CurrObject),DE
		PUSH	DE
		POP	IY
		DEC	A
	;; Get word from ObjFnTbl[A] into HL.
		ADD	A,A
		ADD	A, ObjFnTbl & $FF
		LD	L,A
		ADC	A,ObjFnTbl >> 8
		SUB	L
		LD	H,A
		LD	A,(HL)
		INC	HL
		LD	H,(HL)
		LD	L,A
	;; Do some stuff...
		XOR	A
		LD	(DrawFlags),A
		LD	A,(IY+$0B)
		LD	(ObjDir),A
		LD	(IY+$0B),$FF
		BIT	6,(IY+$09)
		RET	NZ
	;; And function table jump
		JP	(HL)

AnimateObj:	BIT	5,(IY+$09)
		JR	Z,Animate
		CALL	Animate
		EX	AF,AF'
		LD	C,(IY+$10)
		LD	DE,18   ; TODO - next obj
		PUSH	IY
		ADD	IY,DE
		CALL	SetFacingDir
		CALL	Animate
		POP	IY
		RET	C
		EX	AF,AF'
		RET

;; Update the animation. IY points to an object.
;; Returns with carry flag set if it's an animation.
Animate:
        ;; Extract the animation id (top 5 bits)
                LD      C,(IY+O_ANIM)
                LD      A,C
                AND     $F8
        ;; If it's zero (no animation), return.
                CP      $08
                CCF
                RET     NC
        ;; Take top five bits, and index into animations table (1-based)
                RRCA
                RRCA
                SUB     $02
                ADD     A,AnimTable & $FF
                LD      L,A
                ADC     A,AnimTable >> 8
                SUB     L
                LD      H,A
        ;; Add on bottom 3 bits + 1 to generate index into subtable
        ;; for next animation step.
                LD      A,C
                INC     A
                AND     $07
                LD      B,A
        ;; Dereference next animation step sprite.
                ADD     A,(HL)
                LD      E,A
                INC     HL
                ADC     A,(HL)
                SUB     E
                LD      D,A
                LD      A,(DE)
        ;; Check if we've reached a zero (end of animation cycle).
                AND     A
                JR      NZ,Anim1
        ;; We have. Set animation step to 0 and load first sprite in cycle.
                LD      B,$00
                LD      A,(HL)
                DEC     HL
                LD      L,(HL)
                LD      H,A
                LD      A,(HL)
        ;; Update current sprite and animation step.
Anim1:          LD      (IY+O_SPRITE),A
                LD      A,B
                XOR     C
                AND     $07
                XOR     C
                LD      (IY+O_ANIM),A
                AND     $F0
        ;; Set sound for ANIM_ROBOMOUSE
                CP      $80
                LD      C,$02
                JR      Z,Anim2
        ;; Or ANIM_BEE
                CP      $90
                LD      C,$01
Anim2:          LD      A,C
        ;; Otherwise, no sound.
                CALL    Z,SetSound
                SCF
                RET

AnimTable:
        ;; 'B' version is the moving-away-from-viewers version.
ANIM_VAPE1:     EQU $81
                DEFW AnimVape1
ANIM_VISORO:    EQU $82
                DEFW AnimVisorO
ANIM_VISORC:    EQU $83
                DEFW AnimVisorC
ANIM_VAPE2:     EQU $84
                DEFW AnimVape2
ANIM_VAPE2B:    EQU $85
                DEFW AnimVape2
ANIM_FISH:      EQU $86
                DEFW AnimFish
ANIM_FISHB:     EQU $87
                DEFW AnimFish
ANIM_TELEPORT:  EQU $88
                DEFW AnimTeleport
ANIM_TELEPORTB: EQU $89
                DEFW AnimTeleport
ANIM_SPRING:    EQU $8A
                DEFW AnimSpring
ANIM_SPRINGB:   EQU $8B
                DEFW AnimSpring
ANIM_MONOCAT:   EQU $8C
                DEFW AnimMonocat
ANIM_MONOCATB:  EQU $8D
                DEFW AnimMonocatB
ANIM_VAPE3:     EQU $8E
                DEFW AnimVape3
ANIM_VAPE3B:    EQU $8F
                DEFW AnimVape3
ANIM_ROBOMOUSE: EQU $90
                DEFW AnimRobomouse
ANIM_ROBOMOUSEB:EQU $91
                DEFW AnimRobomouseB
ANIM_BEE:       EQU $92
                DEFW AnimBee
ANIM_BEEB:      EQU $93
                DEFW AnimBee
ANIM_BEACON:    EQU $94
                DEFW AnimBeacon
ANIM_BEACONB:   EQU $95
                DEFW AnimBeacon
ANIM_FACE:      EQU $96
                DEFW AnimFace
ANIM_FACEB:     EQU $97
                DEFW AnimFaceB
ANIM_CHIMP:     EQU $98
                DEFW AnimChimp
ANIM_CHIMPB:    EQU $99
                DEFW AnimChimpB
ANIM_CHARLES:   EQU $9A
                DEFW AnimCharles
ANIM_CHARLESB:  EQU $9B
                DEFW AnimCharlesB
ANIM_TRUNK:     EQU $9C
                DEFW AnimTrunk
ANIM_TRUNKB:    EQU $9D
                DEFW AnimTrunkB
ANIM_HELIPLAT:  EQU $9E
                DEFW AnimHeliplat
ANIM_HELIPLATB: EQU $9F
                DEFW AnimHeliplat

AnimVape1:      DEFB $80|SPR_VAPE1,SPR_VAPE1,SPR_VAPE2,SPR_VAPE3,$00
AnimVisorO:     DEFB SPR_VISOROHALF,$00
AnimVisorC:     DEFB SPR_VISORCHALF,$00
AnimVape2:      DEFB SPR_VAPE1,SPR_VAPE2,SPR_VAPE2,SPR_VAPE1,$00
AnimFish:       DEFB SPR_FISH1,SPR_FISH1,SPR_FISH2,SPR_FISH2,$00
AnimTeleport:   DEFB SPR_TELEPORT,$80|SPR_TELEPORT,$00
AnimSpring:     DEFB SPR_SPRING,SPR_SPRING,SPR_SPRUNG,SPR_SPRING,SPR_SPRUNG,$00
AnimMonocat:    DEFB SPR_MONOCAT1,SPR_MONOCAT1,SPR_MONOCAT2,SPR_MONOCAT2,$00
AnimMonocatB:   DEFB SPR_MONOCATB1,SPR_MONOCATB1,SPR_MONOCATB2,SPR_MONOCATB2,$00
AnimVape3:      DEFB SPR_VAPE3,SPR_VAPE2,SPR_VAPE3
                DEFB $80|SPR_VAPE3,$80|SPR_VAPE2,$80|SPR_VAPE3,$00
AnimRobomouse:  DEFB SPR_ROBOMOUSE,$00
AnimRobomouseB: DEFB SPR_ROBOMOUSEB,$00
AnimBee:        DEFB SPR_BEE1,SPR_BEE2,$80|SPR_BEE2,$80|SPR_BEE1,$00
AnimBeacon:     DEFB SPR_BEACON,$80|SPR_BEACON,$00
AnimFace:       DEFB SPR_FACE,$00
AnimFaceB:      DEFB SPR_FACEB,$00
AnimChimp:      DEFB SPR_CHIMP,$00
AnimChimpB:     DEFB SPR_CHIMPB,$00
AnimCharles:    DEFB SPR_CHARLES,$00
AnimCharlesB:   DEFB SPR_CHARLESB,$00
AnimTrunk:      DEFB SPR_TRUNK,$00
AnimTrunkB:     DEFB SPR_TRUNKB,$00
AnimHeliplat:   DEFB SPR_HELIPLAT1,SPR_HELIPLAT2
                DEFB $80|SPR_HELIPLAT2,$80|SPR_HELIPLAT1,$00

;; Table has base index of 1 in CallObjFn
ObjFnTbl:
OBJFN_PUSHABLE: EQU 1
                DEFW ObjFnPushable
OBJFN_ROLLERS1: EQU 2
                DEFW ObjFnRollers1
OBJFN_ROLLERS2: EQU 3
                DEFW ObjFnRollers2
OBJFN_ROLLERS3: EQU 4
                DEFW ObjFnRollers3
OBJFN_ROLLERS4: EQU 5
                DEFW ObjFnRollers4
OBJFN_VISOR1:   EQU 6
                DEFW ObjFnVisor1
OBJFN_MONOCAT:  EQU 7
                DEFW ObjFnMonocat
OBJFN_ANTICLOCK:EQU 8
                DEFW ObjFnAnticlock
OBJFN_RANDB:    EQU 9
                DEFW ObjFnRandB
OBJFN_BALL:     EQU 10
                DEFW ObjFnBall
OBJFN_BEE:      EQU 11
                DEFW ObjFnBee
OBJFN_RANDQ:    EQU 12
                DEFW ObjFnRandQ
OBJFN_RANDR:    EQU 13
                DEFW ObjFnRandR
OBJFN_SWITCH:   EQU 14
                DEFW ObjFnSwitch
OBJFN_HOMEIN:   EQU 15
                DEFW ObjFnHomeIn
OBJFN_HELIPLAT3:EQU 16
                DEFW ObjFnHeliplat3
OBJFN_FADE:     EQU 17
                DEFW ObjFnFade
OBJFN_HELIPLAT: EQU 18
                DEFW ObjFnHeliplat
OBJFN_19:       EQU  19
                DEFW ObjFn19
OBJFN_DISSOLVE2:EQU 20
                DEFW ObjFnDissolve2
OBJFN_21:       EQU 21
                DEFW ObjFn21
OBJFN_22:       EQU 22
                DEFW ObjFn22
OBJFN_HELIPLAT2:EQU 23
                DEFW ObjFnHeliplat2
OBJFN_DISSOLVE: EQU 24
                DEFW ObjFnDissolve
OBJFN_FIRE:     EQU 25
                DEFW ObjFnFire
OBJFN_26:       EQU 26
                DEFW ObjFn26
OBJFN_TELEPORT: EQU 27
                DEFW ObjFnTeleport
OBJFN_SPRING:   EQU 28
                DEFW ObjFnSpring
OBJFN_ROBOT:    EQU 29
                DEFW ObjFnRobot
OBJFN_JOYSTICK: EQU 30
                DEFW ObjFnJoystick
OBJFN_HUSHPUPPY:EQU 31
                DEFW ObjFnHushPuppy
OBJFN_32:       EQU 32
                DEFW ObjFn32
OBJFN_33:       EQU 33
                DEFW ObjFn33
OBJFN_DISAPPEAR:EQU 34
                DEFW ObjFnDisappear
OBJFN_35:       EQU 35
                DEFW ObjFn35
OBJFN_36:       EQU 36
                DEFW ObjFn36
OBJFN_CROWNY:   EQU 37
                DEFW ObjFnCrowny

        ;; Flags for double-height stuff
DH_1:           EQU $40
DH_2:           EQU $80
DH_3:           EQU $C0

        ;; FIXME: Guessing the flags...
DEADLY:         EQU $20
PORTABLE:       EQU $40

SWAPPED:        EQU $04
SWITCHED:       EQU $60

        ;; Still unknown: $01, $02, $08, $10. $10 is probably H-flip?

        ;; Define the objects that can appear in a room definition
ObjDefns:
OBJ_TELEPORT:   EQU $00
                DEFB ANIM_TELEPORT,  OBJFN_TELEPORT,            $01
OBJ_SPRING:     EQU $01
                DEFB SPR_SPRING,     OBJFN_SPRING,              PORTABLE
OBJ_GRATING:    EQU $02
                DEFB SPR_GRATING,    0,                         $02
OBJ_FIXME:      EQU $03
                DEFB SPR_TRUNKS,     OBJFN_PUSHABLE,            PORTABLE
OBJ_FIXME2:     EQU $04
                DEFB ANIM_HELIPLAT,  OBJFN_HELIPLAT2,           0
OBJ_FIXME3:     EQU $05
                DEFB SPR_BOOK,       0,                         $01
OBJ_ROLLERS1:   EQU $06
                DEFB SPR_ROLLERS,    OBJFN_ROLLERS1,            $11
OBJ_ROLLERS2:   EQU $07
                DEFB SPR_ROLLERS,    OBJFN_ROLLERS2,            $11
OBJ_ROLLERS3:   EQU $08
                DEFB SPR_ROLLERS,    OBJFN_ROLLERS3,            $01
OBJ_ROLLERS4:   EQU $09
                DEFB SPR_ROLLERS,    OBJFN_ROLLERS4,            $01
                DEFB SPR_BONGO,      OBJFN_PUSHABLE,            PORTABLE
                DEFB SPR_DECK,       OBJFN_PUSHABLE,            PORTABLE
                DEFB ANIM_ROBOMOUSE, DH_2 | OBJFN_HOMEIN,       SWITCHED | SWAPPED | $08
                DEFB SPR_BALL,       OBJFN_BALL,                0
                DEFB SPR_VAPORISE,   0,                         DEADLY | $01
                DEFB SPR_TOASTER,    0,                         DEADLY | $01
                DEFB SPR_SWITCH,     OBJFN_SWITCH,              0
                DEFB ANIM_BEACON,    OBJFN_RANDB,               SWITCHED
                DEFB ANIM_FACE,      DH_1 | OBJFN_HOMEIN,       SWITCHED | SWAPPED | $08
                DEFB ANIM_CHARLES,   DH_3 | OBJFN_ROBOT,        SWAPPED | $08
                DEFB SPR_STICK,      OBJFN_JOYSTICK,            0
                DEFB SPR_ANVIL,      OBJFN_PUSHABLE,            $01
                DEFB SPR_CUSHION,    0,                         $01
                DEFB SPR_CUSHION,    OBJFN_DISSOLVE2,           $01
                DEFB SPR_WELL,       0,                         0
                DEFB ANIM_BEE,       OBJFN_BEE,                 SWITCHED
                DEFB SPR_GRATING,    OBJFN_DISSOLVE,            $02
                DEFB ANIM_VISORO,    OBJFN_VISOR1,              SWITCHED | $08
                DEFB ANIM_VAPE2,     DH_3 | OBJFN_RANDQ,        SWITCHED | SWAPPED | $08
                DEFB SPR_DRUM,       OBJFN_BALL,                DEADLY
                DEFB SPR_HUSHPUPPY,  OBJFN_HUSHPUPPY,           $01
                DEFB SPR_SANDWICH,   OBJFN_21,                  $01
                DEFB ANIM_FACE,      DH_3 | OBJFN_RANDR,        SWITCHED | SWAPPED | $08
                DEFB SPR_SPIKES,     0,                         DEADLY | $01
                DEFB SPR_BOOK,       OBJFN_DISSOLVE2,           $01
                DEFB SPR_PAD,        OBJFN_DISSOLVE2,           $01
                DEFB SPR_PAD,        0,                         $01
                DEFB SPR_TAP,        OBJFN_32,                  SWITCHED
                DEFB ANIM_BEE,       OBJFN_33,                  SWITCHED
                DEFB ANIM_HELIPLAT,  OBJFN_HELIPLAT,            0
                DEFB SPR_SANDWICH,   OBJFN_PUSHABLE,            $01
                DEFB SPR_CUSHION,    OBJFN_19,                  $01
                DEFB ANIM_MONOCAT,   OBJFN_MONOCAT,             SWITCHED
                DEFB SPR_ANVIL,      OBJFN_22,                  $01
                DEFB SPR_BOOK,       OBJFN_ANTICLOCK,           $01
                DEFB SPR_SANDWICH,   OBJFN_35,                  $01
                DEFB ANIM_TRUNK,     DH_3 | OBJFN_RANDR,        SWITCHED | SWAPPED | $08
                DEFB SPR_TRUNK,      0,                         DEADLY
                DEFB SPR_DRUM,       OBJFN_BALL,                0
                DEFB SPR_FISH1,      0,                         DEADLY
                DEFB SPR_ROLLERS,    OBJFN_DISSOLVE2,           $01
                DEFB SPR_BOOK,       OBJFN_BALL,                $01
                DEFB SPR_BOOK,       OBJFN_PUSHABLE,            $01
                DEFB ANIM_CHIMP,     DH_1 | OBJFN_HOMEIN,       SWITCHED | SWAPPED | $08
                DEFB ANIM_CHIMP,     DH_3 | OBJFN_RANDR,        SWITCHED | SWAPPED | $08
                DEFB ANIM_VISORO,    OBJFN_ANTICLOCK,           SWITCHED | $08
                DEFB SPR_ROBOMOUSE,  0,                         DEADLY
                DEFB SPR_ROBOMOUSEB, 0,                         DEADLY
                DEFB SPR_HEAD1,      0,                         0
                DEFB SPR_HEELS1,     0,                         0
                DEFB SPR_BALL,       OBJFN_36,                  0
                DEFB SPR_BALL,       DH_2 | OBJFN_CROWNY,       DEADLY | SWAPPED | $08
                DEFB ANIM_VAPE2,     OBJFN_33,                  SWITCHED

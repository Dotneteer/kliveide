;;
;;  mainloop.asm
;;
;;  The main game loop and some associated functions
;;

;; Exported functions:
;;  * SetCharFlags
;;  * IsSharedRoom
;;  * SetSens
;;  * InVictoryRoom
;;  * NopeNoise
;;  * FirePressed
;;  * GoToRoom
;;  * FinishGame
;;  * SwitchChar
;;  * RoomLongJmp

;; Exported variables:
;;  * RoomId
;;  * Phase
;;  * CurrDir
;;  * CarryPressed
;;  * SwopPressed
;;  * FirePressed
;;  * FrameCounter

;; Main entry point
Entry:          LD      SP,$FFF4
                CALL    InitStuff       ; Install interrupts, mirror table.
                CALL    InitStick       ; Initialise joystick
                JR      Main

RoomId:		DEFW $00
Phase:		DEFB $00	; Top bit toggles every DoObjects loop.
LastDir:	DEFB $EF
CurrDir:	DEFB $FF

;; For each of these, bit 1 means 'currently pressed', and bit 0 is
;; 'newly triggered'.
CarryPressed:	DEFB $00
SwopPressed:	DEFB $00
FirePressed:	DEFB $00

FrameCounter:	DEFB $01
SavedDir:		DEFB $FB,$FB

        ;; Finish the game and then loop back into the main entry point.
FinishGame:     CALL    GameOverScreen

        ;; Main menu start point, after first loading, or finishing a game.
Main:           LD      SP,$FFF4
                CALL    GoMainMenu
                JR      NC,MainContinue
                CALL    InitNewGame
                JR      MainStart
        ;; Play the game from a continue.
MainContinue:   CALL    PlayTune
                CALL    InitContinue
        ;; Play the game from the start.
MainStart:      CALL    CrownScreen
                LD      A,$40
                LD      (ObjFn36Val),A  ; TODO: ???
        ;; Called when entering a room.
MainGoRoom:     XOR     A
                LD      (Phase),A
                CALL    EnterRoom2
        ;; The main game-playing loop, within a room.
MainLoop:       CALL    WaitFrame
                CALL    CheckCtrls
                CALL    DoVictoryRoom
                CALL    DoObjects
                CALL    CheckPause
                CALL    CheckSwop
        ;; Play sound if there is one.
                LD      HL,SoundId
                LD      A,(HL)
                SUB     $01
                LD      (HL),$00
                LD      B,A
                CALL    NC,PlaySound
                JR      MainLoop

        ;; Set zero flag if in victory room.
InVictoryRoom:  LD      HL,(RoomId)
                LD      BC,$8D30 ; Victory room
                XOR     A
                SBC     HL,BC
                RET

;; Do special-case stuff associated with being in the victory room.
DoVictoryRoom:
        ;; Return if in victory room.
                CALL    InVictoryRoom
                RET     NZ
        ;; A is $00. No swapping
                LD      (SwopPressed),A
        ;; No movement
                DEC     A
                LD      (CurrDir),A
        ;; ???
                LD      HL,ObjFn36Val
                DEC     (HL)
                LD      A,(HL)
                INC     A
                JP      Z,FinishGame
        ;; Play sound
                LD      B,$C1   ; "TADA" noise
                CP      $30
                PUSH    AF
                CALL    Z,PlaySound
        ;; Print message
                POP     AF
                AND     $01
                LD      A,STR_FREEDOM
                CALL    Z,PrintChar
                RET

;; Update the room location, given the value in NextRoom.
GoToRoom:       LD      HL,RoomId+1
                LD      A,(NextRoom)
                DEC     A
                CP      $06
        ;; NextRoom == 7 -> Teleport
                JR      Z,TeleportRoom
        ;; NextRoom > 7 or NextRoom == 0 -> RoomLongJump
                JR      NC,RoomLongJmp
        ;; Special case for above or below
                CP      $04
                JR      C,GTR_1
                ADD     A,A
                XOR     $02
                DEC     HL      ; For Above/Below, modify first byte.
        ;; 0 = Down, 1 = Right, 2 = Up, 3 = Left, 8 = Below, 14 = Above
GTR_1:          LD      C,$01
                BIT     1,A
                JR      NZ,GTR_2
                LD      C,$FF
        ;; C = 1 if Up, Left, Above, C = -1 if Down, Right, Below.
GTR_2:          RRA
                JR      C,GTR_3
        ;; Modify upper bits of location - Up, Down, Below, Above.
                RLD
                ADD     A,C
                RRD
                JR      RoomLongJmp
        ;; Modify bottom bits of location - Left/Right
GTR_3:          RRD
                ADD     A,C
                RLD
        ;; NB: Fall through

;; Perform a longjmp to the enter-a-room code.
RoomLongJmp:    LD      SP,$FFF4
                JP      MainGoRoom

TeleportRoom:   CALL    Teleport
                JR      RoomLongJmp

;; Wait for the frame counter to reduce to zero
WaitFrame:      LD      A,(FrameCounter)
                AND     A
                JR      NZ,WaitFrame
        ;; 12.5 FPS, then.
                LD      A,$04
                LD      (FrameCounter),A
                RET

;; Checks for pausing key, and if it's pressed, pauses.
CheckPause:     CALL    IsHPressed
                RET     NZ
        ;; Play pause sound
                LD      B,$C0           ; Pause sound is silence!
                CALL    PlaySound
        ;; Display pause message...
                CALL    WaitInputClear
                LD      A,STR_FINISH_RESTART
                CALL    PrintChar
        ;; Wait for a key...
CP_1:           CALL    GetInputEntSh
                JR      C,CP_1
                DEC     C
                JP      Z,FinishGame            ; Pressed a shift key.
        ;; Continue
                CALL    WaitInputClear
                CALL    RevealScreen
        ;; Redraw over the message, in a loop updating the X extent.
                LD      HL,$4C50 ; X extent
CP_2:           PUSH    HL
                LD      DE,$6088 ; Y extent
                CALL    Draw
                POP     HL
                LD      A,L
                LD      H,A
                ADD     A,$14
                LD      L,A
                CP      $B5
                JR      C,CP_2
                RET

;; Receives sensitivity in A
SetSens:        LD      HL,HighSensFn           ; High sensitivity routine
                AND     A
                JR      Z,SetSens_1             ; Low sensitivity routine
                LD      HL,LowSensFn
SetSens_1:      LD      (SensFnCall+1),HL       ; Modifies code
                RET

        ;; Read all the inputs and set input variables
CheckCtrls:     CALL    GetInputCtrls
                BIT     7,A                     ; Carry pressed?
                LD      HL,CarryPressed
                CALL    KeyTrigger2
                BIT     5,A                     ; Swop pressed?
                CALL    KeyTrigger
                BIT     6,A                     ; Fire pressed?
                CALL    KeyTrigger
                LD      C,A
                RRA
                CALL    LookupDir
                CP      $FF
                JR      Z,NoKeysPressed
                RRA                             ; Lowest bit held 'is diagonal?'
SensFnCall:     JP      C,LowSensFn             ; NB: Self-modifying code target
                LD      A,C                     ; Not a diagonal move. Simple write.
                LD      (LastDir),A
                LD      (CurrDir),A
                RET

        ;; If we receive diagonal input, set the new direction
HighSensFn:     LD      A,(LastDir)
                XOR     C
                CPL
                XOR     C
                AND     $FE
                XOR     C
                LD      (CurrDir),A
                RET

        ;; If we receive diagonal input, prefer the old direction
LowSensFn:      LD      A,(LastDir)
                XOR     C
                AND     $FE
                XOR     C
                LD      B,A
                OR      C
                CP      B
                JR      Z,LSF
                LD      A,B
                XOR     $FE
LSF:            LD      (CurrDir),A
                RET

NoKeysPressed:  LD      A,C
                LD      (CurrDir),A
                RET

;; KeyTrigger: Writes to (HL+1), based on whether Z flag is set (meaning key pressed).
;; Bit 1 is 'is currently set', bit 0 is 'newly pressed'.
KeyTrigger:     INC     HL
        ;; Version without the inc
KeyTrigger2:    RES     0,(HL)
                JR      Z,KT
                RES     1,(HL)          ; Key not pressed, reset bits 0 and 1 and return.
                RET
        ;; Key pressed:
KT:             BIT     1,(HL)          ; If bit 1 set, already processed already...
                RET     NZ              ; so return (bit 0 reset).
                SET     1,(HL)          ; Otherwise set both bits.
                SET     0,(HL)
                RET

;; Played when we can't do something.
NopeNoise:      LD      B,$C4           ; "Nope" noise
                JP      PlaySound

;; Checks if 'swop' has just been pressed, and if it has, do it.
CheckSwop:      LD      A,(SwopPressed)
                RRA
                RET     NC              ; Return if not pressed...
	;; FIXME: Don't know what these variables are that prevent us swopping
		LD	A,(SavedObjListIdx)
		LD	HL,LB219
		OR	(HL)
		LD	HL,(LA296)
		OR	H
		OR	L
		JR	NZ,NopeNoise 	; Tail call
        ;; Can't swop if out of lives for the other character
                LD      HL,(Lives)
                CP      H
                JR      Z,NopeNoise     ; Tail call
                CP      L
                JR      Z,NopeNoise     ; Tail call
        ;; NB: Fall through

;; Perform the character switchover.
SwitchChar:
        ;; Write out the current character's direction into SavedDir.
                CALL    GetSavedDir
                LD      BC,(CharDir)
                JR      NC,SwC_1        ; Jump if no heels
                LD      (HL),C          ; Save CharDir in SavedDir if Heels.
SwC_1:          INC     HL
                RRA
                JR      NC,SwC_2        ; Jump if no head
                LD      (HL),C          ; Save CharDir in SavedDir+1 if Head.
SwC_2:          LD      HL,SwopPressed
        ;; First, let's check if we're going to switch to Both.
                LD      IY,HeelsObj
                LD      A,E
                CP      $03
                JR      Z,SwC_6         ; Jump to SwC_6 if both active now.
                LD      A,(InSameRoom)  ; Jump to SwC_6 if not in diff rooms.
                AND     A
                JR      Z,SwC_6
                LD      A,(IY+$05)      ; U coordinate of Heels
                INC     A
                SUB     (IY+18+$05)     ; U coordinate of Head
                CP      $03
                JR      NC,SwC_6        ; Jump to SwC_6 if apart in U.
                LD      C,A
                LD      A,(IY+$06)      ; V coordinate of Heels
                INC     A
                SUB     (IY+18+$06)     ; V coordinate of Head
                CP      $03
                JR      NC,SwC_6        ; Jump to SwC_6 if apart in V.
                LD      B,A
                LD      A,(IY+$07)      ; Z coordinate of Heels
                SUB     $06
                CP      A,(IY+18+$07)   ; Z coordinate of Head
                JR      NZ,SwC_6        ; Jump to SwC_6 if Head not on Heels.
        ;; We're switching to Head on Heels. Move to align them, if needed.
                LD      E,$FF
                RR      B               ; Lowest bit set means aligned in V.
                JR      C,SwC_3
        ;; Unaligned, so put movement needed into E.
                RR      B
                CCF
                CALL    GetMove
SwC_3:          RR      C               ; Lowest bit set means aligned in U.
                JR      C,SwC_4
        ;; Unaligned, so put movement needed into E.
                RR      C
                CALL    GetMove
                JR      SwC_5
        ;; Aligned in U, so put no movement into the next two bits of E.
SwC_4:          RLC     E
                RLC     E
        ;; Already fully aligned? Go to SwC_7.
SwC_5:          LD      A,$03           ; Switch to "Both".
                INC     E
                JR      Z,SwC_7
                DEC     E
        ;; If not aligned, put the movement into Head's movement flag,
        ;; and clear the flag that says we've seen the swap button be pressed,
        ;; so we'll have another go next time.
                LD      (IY+18+$0C),E
                RES     1,(HL)
                RET
        ;; Switch to just Head or Heels.
SwC_6:
        ;; Flip bit 2 of SwopPressed, which we use to store the next
        ;; single character to swop to.
                LD      A,$04
                XOR     (HL)
                LD      (HL),A
        ;; And then choose which one we're swopping to.
                AND     $04
                LD      A,$02
                JR      Z,SwC_7         ; Zero: Switch to Head
                DEC     A               ; Otherwise Heels
        ;; Perform the actual switch.
SwC_7:          LD      (Character),A
                CALL    SetCharFlags2
        ;; Restore the appropriate SavedDir into CharDir.
                CALL    GetSavedDir
                JR      C,SwC_8
                INC     HL
SwC_8:          LD      A,(HL)
                LD      (CharDir),A
        ;; If both characters are on the same screen, we just redraw
        ;; the screen periphery. If they're not, we do restore all the
        ;; state.
                LD      A,(InSameRoom)
                AND     A
                JP      NZ,DrawScreenPeriphery
                JR      RestoreStuff

;; Fill in two bits of E with a direction - depending on C flag, set
;; one bit or the other, to create a direction to move to align
;; Head and Heels.
GetMove:        PUSH    AF
                RL      E       ; Rotate in one bit
                POP     AF
                CCF
                RL      E       ; And its complement.
                RET

;; Set the character flags for the current character.
SetCharFlags:   LD      IY,HeelsObj
                LD      A,(Character)
        ;; NB: Fall through

;; Expects IY to point at Heels, and A to identify the current character.
SetCharFlags2:  LD      (IY+O_FUNC),$00         ; Clear func for Heels.
                RES     3,(IY+O_OFLAGS)         ; Clear the 'tall' flag on Heels.
                BIT     0,A                     ; Is Heels active?
                JR      NZ,SCF_1
                LD      (IY+O_FUNC),$01         ; If not, set func to 1.
SCF_1:          LD      (IY+18+O_FUNC),$00      ; Clear func for Head.
                RES     3,(IY+18+O_OFLAGS)      ; Clear the 'tall' flag on Head.
                BIT     1,A                     ; Is Head active?
                JR      NZ,SCF_2
                LD      (IY+18+O_FUNC),$01      ; If not, set func to 1.
SCF_2:          RES     1,(IY+18+$09)           ; Clear double-height flag on Head.
                CP      $03
                RET     NZ
        ;; If Both is selected:
                SET     3,(IY+O_OFLAGS)         ; Set the 'tall' flag on Heels...
                SET     1,(IY+18+$09)           ; and the double-height flag on Head.
                RET

;; Returns whether or not we're in the same room as the other character.
;; Zero flag is set if it's a shared room.
IsSharedRoom:   LD      HL,(RoomId)
                LD      DE,(OtherState)
                AND     A
                SBC     HL,DE
                RET

;; Returns Carry set if using Heels, and HL points to where we stash
;; the directions the characters are facing.
GetSavedDir:    LD      A,(Character)
                LD      HL,SavedDir
                LD      E,A
                RRA
                RET

SaveStuff:      XOR     A
                JR      CopyStuff2

RestoreStuff2:  LD      A,$FF
                LD      HL,ClearObjLists
                PUSH    HL
        ;; Fall through

CopyStuff2:     LD      HL,HL2DE
                LD      DE,CopyChar
                JR      CopyStuff

RestoreStuff:   XOR     A
                LD      HL,FinishRestore ; Set the function to call after.
                PUSH    HL
                LD      HL,DE2HL
                LD      DE,LoadCharObjs
        ;; Fall through

;; Take the copy function to use in HL, and function to call
;; afterwards in DE. Copies various chunks of data to/from buffer at
;; OtherState.
CopyStuff:      PUSH    DE
                LD      (COD_JP+1),HL
                CALL    GetOtherChar
                LD      (CC_Ptr),HL
                AND     A
                LD      HL,OtherState
                JR      NZ,CS_1
                EX      DE,HL
CS_1:           EX      AF,AF'
                CALL    CopyData
                DEFW    $0004, RoomId
                CALL    CopyData
                DEFW    $001D, ObjListIdx
                CALL    CopyData
                DEFW    $0019, LA2A2
                CALL    CopyData
                DEFW    ObjectsLen, Objects
                RET

;; Runs CopyData on a character object.
CopyChar:       CALL    CopyData
                DEFW    $0012           ; Size of an object.
CC_Ptr:         DEFW    HeelsObj        ; Self-modifying code
                RET

;; Takes pointer in DE, and copies data out to current character, then
;; the other character.
LoadCharObjs:   PUSH    DE
                CALL    GetCharObj
                EX      DE,HL
                LD      BC,18   ; TODO
                PUSH    BC
                LDIR
                CALL    GetOtherChar
                POP     BC
                POP     DE
                LDIR
        ;; Fall through.

ClearObjLists:  LD      HL,(SavedObjDest)       ; NB: Referenced as data.
                LD      (ObjDest),HL
                LD      HL,ObjectLists + 4
                LD      BC,8    ; TODO
                JP      FillZero

;; Get the character object associated with the one we're not playing now?
GetOtherChar:   LD      HL,Character
                BIT     0,(HL)          ; Heels?
                LD      HL,HeelsObj     ; No Heels case
                RET     Z
                LD      HL,HeadObj      ; Have Heels case
                RET

;; Given a pointer on the stack, load values into C, B, and if A' is
;; non-zero, then E, D, otherwise L, H. Push updated pointer.
;;
;; Then call the currently-selected function, which may be LDIR, or a
;; kind of reverse LDIR (DE to HL).
CopyData:       POP     IX
                LD      C,(IX+$00)
                INC     IX
                LD      B,(IX+$00)
                INC     IX
                EX      AF,AF'
                AND     A
                JR      Z,COD_1
                LD      E,(IX+$00)
                INC     IX
                LD      D,(IX+$00)
                JR      COD_2
COD_1:          LD      L,(IX+$00)
                INC     IX
                LD      H,(IX+$00)
COD_2:          INC     IX
                EX      AF,AF'
                PUSH    IX
COD_JP:         JP      HL2DE           ; Self-modifying code
DE2HL:          LD      A,(DE)
                LDI
                DEC     HL
                LD      (HL),A
                INC     HL
                JP      PE,DE2HL
                RET
HL2DE:          LDIR
                RET

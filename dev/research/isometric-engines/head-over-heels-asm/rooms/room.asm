;;
;; room.asm
;;
;; Functions that largely decode the packed room data
;;

;; Exported functions:
;;  * BuildRoom
;;  * SetTmpObjUVZ
;;  * SetUVZ
;;  * AddObjOpt
;;  * HasFloorAbove

;; Pointer into stack for current origin coordinates
DecodeOrgPtr:   DEFW DecodeOrgStack
;; Each stack entry contains UVZ coordinates
DecodeOrgStack: DEFB $00, $00, $00
                DEFB $00, $00, $00
                DEFB $00, $00, $00
                DEFB $00, $00, $00

;; TODO: Doesn't seem to be modified anywhere?
BaseFlags:      DEFW $0000

;; Buffer for an object used during unpacking
TmpObj:         DEFB $00,$00,$00,$00,$00,$00,$00,$00
                DEFB $00,$00,$00,$FF,$FF,$00,$00,$00
                DEFB $00,$00

;; Bit 0: Do we loop?
;; Bit 1: Are all the switch flags the same in the loop?
;; Bit 2: If they're the same, the value.
UnpackFlags:    DEFB $00

;; Current pointer to bit-packed data
DataPtr:        DEFW $0000
;; The remaining bits to read at the current address.
CurrData:       DEFB $00

;; Set to 0xFF when the current expansion is complete.
ExpandDone:     DEFB $00

;; Sprites to use for L and R parts of the door.
DoorSprites:    DEFB $00,$00

;; Bits 4 and 5 have values as follows:
;; 2/\1
;; 3\/0
;; TODO: Not sure about the lower bits.
DoorObjFlags:   DEFB $27, $26
                DEFB $17, $15
                DEFB $05, $04
                DEFB $36, $34

RoomShapeIdx:   DEFB $00        ; The room shape for the main room.
RoomShapeIdxTmp:DEFB $00        ; The room shape for the room being processed.

;; The index of the floor pattern to use.
FloorCode:      DEFB $00

;; Set if the room above has a floor.
FloorAboveFlag: DEFB $00

;; Suppress drawing of objects - used when restoring room states.
SkipObj:        DEFB $00

AttribScheme:   DEFB $00
WorldId:        DEFB $00        ; Range 0..7 (I think 7 is 'same as last')

;; Bit numbers for the doors:
;; 3/\2
;; 0\/1
HasNoWall:      DEFB $00        ; $8 = Extra room in +V, $04 = Extra in +U
HasDoor:        DEFB $00

;; IY is pointed to MinU, and values are loaded in (based on RoomShape),
;; with IY incrementing to point after MaxV when loading is complete.
MinU:           DEFB $00
MinV:           DEFB $00
MaxU:           DEFB $00
MaxV:           DEFB $00
;; AltLimits[12] are also used as IY for drawing extra rooms.
AltLimits1:     DEFB $00
                DEFB $00
                DEFB $00
                DEFB $00
AltLimits2:     DEFB $00
                DEFB $00
                DEFB $00
                DEFB $00

;; Coordinates of doors along the walls. cf RoomShapes coordinates.
DOOR_LOW:       EQU $24
DOOR_HIGH:      EQU $2C

;; Array of room shapes: Min U, Min V, Max U, Max V
;; Index into array stored in RoomShapeIdx(Tmp).
RoomShapes:     DEFB $08,$08,$48,$48
                DEFB $08,$10,$48,$40
                DEFB $08,$18,$48,$38
                DEFB $08,$20,$48,$30
                DEFB $10,$08,$40,$48
                DEFB $18,$08,$38,$48
                DEFB $20,$08,$30,$48
                DEFB $10,$10,$40,$40

;; Heights of the 4 doors, for the main room.
;; 0/\1
;; 3\/2
DoorHeights:    DEFB $00, $00, $00, $00
;; Locations of the 4 doors along their respective walls, for the room
;; currently being processed.
DoorHeightsTmp: DEFB $00, $00, $00, $00
;; The height of the highest door present.
HighestDoor:    DEFB $C0

;; Like BuildRoom, but we skip calling AddObject on the main room.
;; Used when restoring previously-stashed room state.
;; (SkipObj will be reset by BuildRoom soon afterwards.)
BuildRoomNoObj: LD      A,$FF
                LD      (SkipObj),A
        ;; NB: Fall through

        ;; Set up a room.
BuildRoom:
        ;; Set the base of where we load limits.
                LD      IY,MinU
        ;; Initialise the sprite extents to cover the full screen.
                LD      HL,$40C0
                LD      (ViewXExtent),HL
                LD      HL,$00FF
                LD      (ViewYExtent),HL
        ;; Set all doors to ground level to start with
                LD      HL,$C0C0
                LD      (DoorHeightsTmp),HL
                LD      (DoorHeightsTmp+2),HL
        ;; Go read the room.
                LD      HL,$0000
                LD      BC,(RoomId)
                CALL    ReadRoom
        ;; Clear a couple of variables.
                XOR     A
                LD      (SkipObj),A
                LD      (HighestDoor),A
        ;; Copy the variables created during *this* ReadRoom pass into
        ;; the main variables.
                LD      HL,(ObjDest)
                LD      (SavedObjDest),HL       ; Save current ObjDest
                LD      A,(RoomShapeIdxTmp)
                LD      (RoomShapeIdx),A
                LD      DE,DoorHeights
                LD      HL,DoorHeightsTmp
                LD      BC,$0004
                LDIR
        ;; Clear the backdrop info...
                LD      HL,BkgndData
                LD      BC,BkgndDataLen
                CALL    FillZero

                CALL    DoConfigWalls
        ;; Set a few variables
                CALL    HasFloorAbove
                LD      A,$00
                RLA
                LD      (FloorAboveFlag),A
                CALL    StoreCorner

        ;; Check if we have no wall in +V direction.
                LD      HL,(HasNoWall)
                PUSH    HL
                LD      A,L
                AND     $08
                JR      Z,BRM_1
        ;; Optional ReadRoom pass on object list 1:
        ;; Draw the next room in V direction, tacked on.
                LD      A,$01
                CALL    SetObjList
                LD      BC,(RoomId)     ; Increment V nybble of the RoomId
                LD      A,B
                INC     A
                XOR     B
                AND     $0F
                XOR     B
                LD      B,A
                LD      A,(MaxV)        ; Set HL offset to MaxV
                LD      H,A
                LD      L,$00
                CALL    ReadRoom        ; IY pointing to AltLimits1.
                CALL    DoConfigWalls

        ;; Check if we have no wall in +U direction.
BRM_1:          LD      IY,AltLimits2
                POP     HL
                PUSH    HL
                LD      A,L
                AND     $04
                JR      Z,BRM_2
        ;; Optional ReadRoom pass on object list 2:
        ;; Draw the next room in U direction, tacked on.
                LD      A,$02
                CALL    SetObjList
                LD      BC,(RoomId)     ; Increment U byte of the RoomId
                LD      A,B
                ADD     A,$10
                XOR     B
                AND     $F0
                XOR     B
                LD      B,A
                LD      A,(MaxU)        ; Set HL offset to MaxU
                LD      L,A
                LD      H,$00
                CALL    ReadRoom        ; IY pointing to AltLimits2.
                CALL    DoConfigWalls

        ;; Final setup
BRM_2:          LD      A,(HighestDoor)
                LD      HL,(DoorSprites)
                PUSH    AF
                CALL    OccludeDoorway  ; Occlude edge of door sprites at the back.
                POP     AF
                CALL    SetColHeight    ; Columns high as the tallest door
                POP     HL
                LD      (HasNoWall),HL  ; Restore value from first pass.
                XOR     A               ; Switch back to usual object list.
                JP      SetObjList      ; NB: Tail call.

;; Unpacks a room, adding all its sprites to the lists, and generally
;; setting it up.
;;
;; IY points to where we stash the room size.
;; Takes room id in BC.
;; HL holds the UV origin of the room.
;;
ReadRoom:       LD      (DecodeOrgStack),HL     ; Set UV origin.
                XOR     A
                LD      (DecodeOrgStack + 2),A  ; And Z origin.
                PUSH    BC
                CALL    FindVisitRoom
                LD      B,$03
                CALL    FetchData
                LD      (RoomShapeIdxTmp),A
        ;; Load HL with RoomShapes + 4 * A
                ADD     A,A
                ADD     A,A
                ADD     A,RoomShapes & $FF
                LD      L,A
                ADC     A,RoomShapes >> 8
                SUB     L
                LD      H,A

        ;; Loop twice...
                LD      B,$02
                LD      IX,DecodeOrgStack
RR_1:
        ;; Load U, then V room shape and origin.
                LD      C,(HL)
                LD      A,(IX+$00)
                AND     A
                JR      Z,RR_2
        ;; If origin is zero, just use C, otherwise update by
        ;; subtracting C and dividing by 8 to create block
        ;; coordinates, and store the unadjusted value in IY.
                SUB     C
                LD      E,A
                RRA
                RRA
                RRA
                AND     $1F
                LD      (IX+$00),A
                LD      A,E
        ;; And store sum in IY.
RR_2:           ADD     A,C
                LD      (IY+$00),A
                INC     HL
                INC     IX
                INC     IY
                DJNZ    RR_1

        ;; Do this bit twice, too (for U and V again)
                LD      B,$02
        ;; Take previous origin, multiply by 8 and add max U/V.
RR_3:           LD      A,(IX-$02)
                ADD     A,A
                ADD     A,A
                ADD     A,A
                ADD     A,(HL)
        ;; Then save it.
                LD      (IY+$00),A
                INC     IY
                INC     IX
                INC     HL
                DJNZ    RR_3

        ;; Now read the room configuration
                LD      B,$03
                CALL    FetchData
                LD      (AttribScheme),A        ; Fetch the attribute scheme to use.
                LD      B,$03
                CALL    FetchData
                LD      (WorldId),A             ; Fetch the current world identifier
                CALL    DoDoors
                LD      B,$03
                CALL    FetchData
                LD      (FloorCode),A           ; And the floor pattern to use
                CALL    SetFloorAddr
        ;; Then we have a loop to process objects in the room.
RR_4:           CALL    ProcEntry
                JR      NC,RR_4
                POP     BC
                JP      AddSpecials             ; NB: Tail call.

;; Add a signed 3-bit value in A to (HL), result in A
Add3Bit:        BIT     2,A
                JR      Z,A3B
                OR      $F8
A3B:            ADD     A,(HL)
                RET

;; Recursively do ProcEntry. Macro code is in A.
RecProcEntry:   EX      AF,AF'
        ;; When processing recursively, we read 3 values to adjust the
        ;; origin for the macro-expanded processing, so it can be played
        ;; at whatever offset you like.
        ;;
        ;; Read values into B, C, A
                CALL    FetchData333
                LD      HL,(DecodeOrgPtr)
                PUSH    AF
                LD      A,B             ; Adjust U value
                CALL    Add3Bit
                LD      B,A
                INC     HL
                LD      A,C             ; Adjust V value
                CALL    Add3Bit
                LD      C,A
                INC     HL
                POP     AF
                SUB     $07
                ADD     A,(HL)          ; Adjust Z value (slightly different)
                INC     HL
        ;; Write out origin values, update pointer
                LD      (DecodeOrgPtr),HL
                LD      (HL),B
                INC     HL
                LD      (HL),C
                INC     HL
                LD      (HL),A
        ;; Origin updated, save the current read pointer.
                LD      A,(CurrData)
                LD      HL,(DataPtr)
                PUSH    AF
                PUSH    HL
        ;; Run the macro.
                CALL    FindMacro
                LD      (DataPtr),HL
RPE_1:          CALL    ProcEntry
                JR      NC,RPE_1
        ;; Pop the decode origin stack...
                LD      HL,(DecodeOrgPtr)
                DEC     HL
                DEC     HL
                DEC     HL
                LD      (DecodeOrgPtr),HL
        ;; And restore the read pointer.
                POP     HL
                POP     AF
                LD      (DataPtr),HL
                LD      (CurrData),A
        ;; NB: Fall through, carrying on.

;; Process one entry in the description array. Returns carry when done.
ProcEntry:      LD      B,$08
                CALL    FetchData
        ;; Return with carry set if we hit $FF.
                CP      $FF
                SCF
                RET     Z
        ;; Code >= $C0 means recurse.
                CP      $C0
                JR      NC,RecProcEntry         ; NB: Tail call (falls through back)
        ;; Otherwise, deal with an object.
                PUSH    IY
                LD      IY,TmpObj
                CALL    InitObj                 ; Object code in A.
                POP     IY
        ;; Read two bits. Bottom bit is "should loop".
        ;; Top bit is "read flag bit once for all loops?".
                LD      B,$02
                CALL    FetchData
                BIT     1,A
                JR      NZ,PE_1
        ;; We will read per loop. Set "should loop" bit.
                LD      A,$01
                JR      PE_2
PE_1:
        ;; Not reading per-loop. Read once and store in the bit 2.
                PUSH    AF
                LD      B,$01
                CALL    FetchData
                POP     BC
                RLCA
                RLCA
                OR      B
PE_2:           LD      (UnpackFlags),A
        ;; And then some processing loops thing...
PE_3:           CALL    SetTmpObjFlags
                CALL    SetTmpObjUVZEx
        ;; Only loop if loop bit (bottom bit) is set.
                LD      A,(UnpackFlags)
                RRA
                JR      NC,PE_4
        ;; Although we break out if (ExpandDone) is 0xFF.
                LD      A,(ExpandDone)
                INC     A
                AND     A
                RET     Z
                CALL    AddObjOpt
                JR      PE_3
PE_4:           CALL    AddObjOpt
                AND     A
                RET

;; If SkipObj is zero, do an "AddObject"
AddObjOpt:      LD      HL,TmpObj
                LD      BC,OBJECT_LEN
                PUSH    IY
                LD      A,(SkipObj)
                AND     A
                CALL    Z,AddObject
                POP     IY
                RET

;; Initialise the doors. IY is pointing after min u/v, max u/v.
DoDoors:
        ;; Read the door type? Looks like dead functionality.
                LD      B,$03
                CALL    FetchData
                CALL    ToDoorId
        ;; A contains door number - load in A*2 and A*2 + 1 into (DoorSprites).
        ;; This gives the L and R door sprites.
                ADD     A,A
                LD      L,A
                LD      H,A
                INC     H
                LD      (DoorSprites),HL
        ;; Do each of the doors, with the room size information coming
        ;; in through IY. Door heights are written out to DoorHeightsTmp.
                LD      IX,DoorObjFlags
                LD      HL,DoorHeightsTmp
                EXX
                LD      A,(IY-$01)      ; MaxV
                ADD     A,$04
                CALL    DoDoorU
                LD      HL,DoorHeightsTmp + 1
                EXX
                LD      A,(IY-$02)      ; MaxU
                ADD     A,$04
                CALL    DoDoorV
                LD      HL,DoorHeightsTmp + 2
                EXX
                LD      A,(IY-$03)      ; MinV
                SUB     $04
                CALL    DoDoorU
                LD      HL,DoorHeightsTmp + 3
                EXX
                LD      A,(IY-$04)      ; MinU
                SUB     $04
                JP      DoDoorV         ; Tail call

;; Reads the code for the kind of door.
;;
;; It rotates flags into the door flags (HasNoWall and HasDoor), and
;; sets the door Z coord in TmpObj and HL' (DoorHeightsTmp pointer).
;;
;; For the read value:
;;  0 means wall, no door
;;  1 means no wall, no door.
;;  >= 2 means has wall. Can be 2..7 for heights.
FetchDoor:      LD      B,$03
                CALL    FetchData
                LD      HL,HasNoWall
                SUB     $02
        ;; Jump for the fetched-a-0-or-1 case
                JR      C,FD2
        ;; Rotate a zero into HasNoWall - there's a wall.
                RL      (HL)
        ;; And rotate a one bit into HasDoor
                INC     HL
                SCF
                RL      (HL)
        ;; Set A = 9 - fetched data
                SUB     $07
                NEG
        ;; Z coordinate set to 6 * A + 0x96
                LD      C,A
                ADD     A,A
                ADD     A,C
                ADD     A,A
                ADD     A,$C0 - 6 * 7   ; 2 maps to $C0 ground level.
                LD      (TmpObj+O_Z),A
        ;; Set carry flag, switch reg set and save Z coord
                SCF
                EXX
                LD      (HL),A
                RET
FD2:
        ;; No door case:
        ;; Set flag if fetched value was 0.
                CP      $FF
        ;; Complement.
                CCF
        ;; Rotate it into HasNoWall
                RL      (HL)
        ;; And rotate a zero bit into HasDoor
                AND     A
                INC     HL
                RL      (HL)
        ;; Return with no carry
                AND     A
                RET

;; These two take the coordinate of the wall plane in A,
;; and HL' is where the coordinate is stashed.
;; IX points to flags to use.

;; Build a door parallel to the V axis.
DoDoorV:        LD      (TmpObj+O_U),A
                LD      HL,TmpObj+O_V
                LD      A,(DecodeOrgStack + 1)  ; V offset
                JP      DoDoorAux       ; NB: Tail call

;; Build a door parallel to the U axis
DoDoorU:        LD      (TmpObj+O_V),A
                LD      HL,TmpObj+O_U
                LD      A,(DecodeOrgStack)      ; U offset
        ;; NB: Fall through

;; HL points to the object's coordinate field to write to, and A holds
;; the origin value in that dimension. Takes extra parameters in IX
;; IX (object flags) and HL' (pointer to relevant DoorHeightsTmp entry).
DoDoorAux:
        ;; Multiply A by 8
                ADD     A,A
                ADD     A,A
                ADD     A,A
                PUSH    AF
        ;; Stash A + DOOR_LOW in the coordinate
                ADD     A,DOOR_LOW
                LD      (HL),A
                PUSH    HL
        ;; Get the door Z coordinate set up, return if no object to add.
                CALL    FetchDoor               ; NB: Does EXX
                JR      NC,NoDoorRet            ; NB: Tail call
        ;; Draw one half
                LD      A,(IX+$00)
                LD      (TmpObj+O_OFLAGS),A     ; Set the flags
                INC     IX
                LD      A,(DoorSprites)
                LD      (TmpObj+O_SPRITE),A     ; Set the sprite.
                CALL    AddHalfDoorObj  ; And draw.
        ;; Draw the other
                LD      A,(IX+$00)
                LD      (TmpObj+O_OFLAGS),A
                INC     IX
                LD      A,(DoorSprites+1)
                LD      (TmpObj+O_SPRITE),A
        ;; Stash A + DOOR_HIGH in the coordinate this time.
                POP     HL
                POP     AF
                ADD     A,DOOR_HIGH
                LD      (HL),A
        ;; NB: Fall through

;; Adds the current object in TmpObj, and creates a step
;; underneath it if necessary.
AddHalfDoorObj:
        ;; Add current object.
                CALL    AddObjOpt
        ;; Return early for the far doors. Only add ledges for the near doors.
                LD      A,(TmpObj+O_OFLAGS)
                LD      C,A
                AND     $30
                RET     PO
        ;; Change flags for the ledge.
                AND     $10
                OR      $01
                LD      (TmpObj+O_OFLAGS),A
        ;; $C0 is ground level, don't need to put anything underneath.
                LD      A,(TmpObj+O_Z)
                CP      $C0
                RET     Z
        ;; Otherwise, add a step under the doorway (6 down)
                PUSH    AF
                ADD     A,$06
                LD      (TmpObj+O_Z),A          ; Update Z coord
                LD      A,SPR_STEP
                LD      (TmpObj+O_SPRITE),A     ; And sprite
                CALL    AddObjOpt               ; Add the step
                POP     AF
                LD      (TmpObj+O_Z),A          ; And restore.
                RET

;; No door case - unwind variables and return
NoDoorRet:      POP     HL
                POP     AF
                INC     IX
                INC     IX
                RET

;; Clears CurrData and returns a pointer to a specific room description macro
;; Macro id passed in A', pointer returned in HL.
FindMacro:      LD      A,$80
                LD      (CurrData),A    ; Clear buffered byte.
                LD      HL,RoomMacros
                EX      AF,AF'
                LD      D,$00
FM_1:           LD      E,(HL)
                INC     HL
                CP      (HL)
                RET     Z
                ADD     HL,DE
                JR      FM_1

;; Returns with carry set if the room above has a floor. Unset
;; otherwise.
HasFloorAbove:  LD      BC,(RoomId)
        ;; Find the next room with a lower Z coordinate (above).
                LD      A,C
                DEC     A
                AND     $F0
                LD      C,A
                CALL    FindRoom
                RET     C
        ;; Room found, extract some data
        ;; DE is the data pointer after the room header.
        ;; This code skips ahead to the floor field
                INC     DE
                INC     DE
                INC     DE
                LD      A,(DE)          ; A & $0E contains floor code.
                OR      $F1
                INC     A               ; Floor code of 7 means no floor.
                RET     Z               ; Return with clear carry if no floor.
                SCF
                RET                     ; Set carry if there's a floor.

;; Like FindRoom, but set the "visited" bit.
FindVisitRoom:  CALL    FindRoom
                EXX
                LD      A,C
                OR      (HL)
                LD      (HL),A
                EXX
                RET

;; Find a room. Takes room id in BC. Returns first field in A, and
;; room bit mask location in HL' and C'.
FindRoom:       LD      D,$00
                LD      HL,RoomList1
                CALL    FindRoom2
                RET     NC
                LD      HL,RoomList2
                JR      FindRoomInner ; NB: Tail call

        ;; Set up the room bit field thing, and do the first run.
FindRoom2:      EXX
                LD      HL,RoomMask
                LD      C,$01
                EXX
        ;; NB: Fall through

;; Finds an entry in a room list. The list consists of packed entries.
;;
;; The entry structure is:
;; 1 byte size (excludes this byte)
;; 1.5 bytes id (bottom nibble ignored for matching)
;; Data
;;
;; A size of zero terminates the list.
;;
;; This is called with:
;;  HL pointing to the start of the tagged list
;;  D should be zero - DE will be the entry size
;;  BC should be the id we're looking for
;;  HL' and C' are incremented as the address and bit mask for a bitfield
;;   associated with the nth entry.
;;
;; The carry flag is set if nothing's returned.
;; If the room is found, you can read data with FetchData.
FindRoomInner:
        ;; Return with carry set if (HL) is 0 - not found.
                LD      E,(HL)
                INC     E
                DEC     E
                SCF
                RET     Z
        ;; If HL+1 equals B, go to FR_4
                INC     HL
                LD      A,B
                CP      (HL)
                JR      Z,FR_4
        ;; Otherwise, increment HL by DE, move the bit pointer in C',
        ;; and increment HL' every time the bit wraps round. Then loop.
FR_2:           ADD     HL,DE
                EXX
                RLC     C
                JR      NC,FR_3
                INC     HL
FR_3:           EXX
                JR      FindRoomInner
        ;; Second check: Does HL+2 & 0xF0 equal C?
FR_4:           INC     HL
                DEC     E       ; Incremented HL, so decrement DE.
                LD      A,(HL)
                AND     $F0
                CP      C
                JR      NZ,FR_2
        ;; Found item. Step back to start of item.
                DEC     HL
        ;; Initialise DataPtr and CurrData for new data.
                LD      (DataPtr),HL
                LD      A,$80
                LD      (CurrData),A
        ;; Skip that top nibble of id.
                LD      B,$04
                JP      FetchData ; NB: Tail call

;; Called from inside the ProcEntry loop...
SetTmpObjFlags: LD      A,(UnpackFlags)
                RRA
                RRA
        ;; If the 'read once' bit is set, use the read-once value.
        ;; Otherwise, read another bit.
                JR      C,STOF_1
                LD      B,$01
                CALL    FetchData
STOF_1:         AND     $01
        ;; Flag goes into 0x10 position ("is switched?") of the object flag
                RLCA
                RLCA
                RLCA
                RLCA
                AND     $10
        ;; Set fields of TmpObj
                LD      C,A
                LD      A,(BaseFlags + 1)
                XOR     C
                LD      (TmpObj+4),A
                LD      BC,(BaseFlags)
        ;; If 0x10 position set, flip bit 0 if bit 1 set. (???)
        ;; It also adjusts the value going into offset 0x10. TODO: ???
                BIT     4,A
                JR      Z,STOF_3
                BIT     1,A
                JR      Z,STOF_2
                XOR     $01
                LD      (TmpObj+4),A
STOF_2:         DEC     C
                DEC     C
STOF_3:         LD      A,C
                LD      (TmpObj+16),A
                RET

;; Read U, V, Z coords (3 bits each), and set TmpObj's location
SetTmpObjUVZEx: CALL    FetchData333
        ;; NB: Fall through

;; Put B = U coord, C = V coord, A = Z coord
;; Set's TmpObj's location
SetTmpObjUVZ:   EX      AF,AF'
                LD      HL,(DecodeOrgPtr)
                LD      DE,TmpObj+5
        ;; NB: Fall through

;; Calculates U, V and Z coordinates
;;  DE points to where we will write the U, V and Z coordinates
;;  HL points to the address of the origin data.
;;  We pass in coordinates:
;;   B contains U, C contains V, A' contains Z
;;  U/V coordinates are built on a grid of * 8 + 12
;;  Z coordinate is built on a grid of * 6 + 0x96 (i.e. [0..7])
;;  Sets ExpandDone to 0xFF (done) if B = 7, C = 7, A' = 0
SetUVZ:         LD      A,B
                CALL    TwiddleHL
                LD      (DE),A          ; Set U coordinate
                LD      A,C
                CALL    TwiddleHL
                INC     DE
                LD      (DE),A          ; Set V coordinate
                EX      AF,AF'
                PUSH    AF
                ADD     A,(HL)
        ;; Take value * 6 + 0x96
                LD      L,A
                ADD     A,A
                ADD     A,L
                ADD     A,A
                ADD     A,$96
                INC     DE
                LD      (DE),A          ; Set Z coordinate
                POP     AF
        ;; Set ExpandDone to 0xFF if Z coord is 0, U and V are 7.
                CPL
                AND     C
                AND     B
                OR      $F8
                LD      (ExpandDone),A
                RET

;; Add a value from (HL), increment HL, return value * 8 + 12
TwiddleHL:      ADD     A,(HL)
                INC     HL
                RLCA
                RLCA
                RLCA
                ADD     A,$0C
                RET

;; Fetch 3 lots of 3 bits to B, C and A.
FetchData333:   LD      B,$03
                CALL    FetchData
                PUSH    AF
                LD      B,$03
                CALL    FetchData
                PUSH    AF
                LD      B,$03
                CALL    FetchData
                POP     HL
                POP     BC
                LD      C,H
                RET

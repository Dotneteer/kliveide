; Shadow Maze Random: generated connected mazes, original cover, music and sound.
; Original music credits: Morri / Rayon Studio. TVC single-channel adaptation.
; Original game and four maps: Rayon Studio. Machine-code adaptation.
; No ROM-version-specific entry points. Firmware IRQ supplies timer/joystick.
; Controls: joystick directions; UP starts/restarts, ESC returns to BASIC.
; Assemble: pyz80 --obj=Shadow_Maze_Z80.bin Shadow_Maze_Z80.asm
; Binary origin 7000. CAS includes a tiny BASIC USR launcher.
        ORG 7000
ENTRY:  PUSH IX
        PUSH IY
        PUSH BC
        PUSH DE
        LD (OLDSP),SP
        LD SP,32752
        LD A,(3)
        LD (OLDPAGE),A
        LD A,(2835)
        LD (OLDMODE),A
        AND 252
        OR 1
        LD (2835),A
        OUT (6),A
        LD A,80
        LD (3),A
        OUT (2),A
        XOR A
        OUT (96),A
        LD A,81
        OUT (97),A
        LD A,21
        OUT (98),A
        LD A,85
        OUT (99),A
        EI
        CALL AUDIO_INIT
        CALL COVER
        CALL PALETTE_GAME
        XOR A
        LD (LEVEL),A
        LD HL,0
        LD (SCORE),HL
MENU:   CALL CLEAR
        CALL PALETTE_MENU
        LD HL,MENU_DATA
        LD DE,34304
        CALL MENU_UNPACK
        XOR A
        LD (TITLE_POS),A
        LD A,1
        LD (TITLE_DIR),A
        LD A,(2845)
        LD (TITLE_LAST),A
        CALL DRAW_TITLE
        CALL RELEASE
MENULOOP:
        HALT
        CALL AUDIO_TICK
        CALL TITLE_TICK
        CALL ESCAPE
        JP NZ,QUIT
        CALL GET_INPUT
        AND 3
        JP Z,MENULOOP
        CALL PALETTE_GAME
NEWGAME:
        CALL SEED_RANDOM
        CALL MUSIC_STOP
        XOR A
        LD (LEVEL),A
        LD HL,0
        LD (SCORE),HL
LEVELSTART:
        CALL GENERATE_MAZE
        LD HL,BOARD+628
        LD (PLAYER),HL
        LD HL,0
        LD (LIGHT),HL
        LD A,1
        LD (SHOWALL),A
        LD HL,FX_START
        CALL PLAY_FX
        LD A,7
        LD (HEROFRAME),A
        XOR A
        LD (PHASE),A
        CALL CLEAR
        CALL FRAME
        CALL DRAW
        LD HL,READYTEXT
        LD DE,46080
        CALL TEXT
        CALL RELEASE
PREVIEW:
        HALT
        CALL AUDIO_TICK
        CALL ESCAPE
        JP NZ,QUIT
        CALL GET_INPUT
        AND 103
        JP Z,PREVIEW
        XOR A
        LD (SHOWALL),A
        CALL CLEARFOOT
        CALL REVEAL
        CALL DRAW
        LD HL,6000
        LD (TIMELEFT),HL
        CALL READTIME
        LD (LASTTIME),HL
        LD A,L
        LD (LASTMOVE),A
MAIN:   HALT
        CALL AUDIO_TICK
        CALL ESCAPE
        JP NZ,QUIT
        CALL UPDATE_TIME
        LD HL,(TIMELEFT)
        LD A,H
        OR L
        JP Z,LOST
        CALL HUD
        CALL READTIME
        LD A,(LASTMOVE)
        LD B,A
        LD A,L
        SUB B
        CP 5
        JP C,MAIN
        LD A,L
        LD (LASTMOVE),A
        CALL GET_INPUT
        LD B,A
        LD DE,0
        BIT 6,B
        JP Z,CHECKRIGHT
        LD DE,65535
        JP TRY_MOVE
CHECKRIGHT:
        BIT 5,B
        JP Z,CHECKUP
        LD DE,1
        JP TRY_MOVE
CHECKUP:
        BIT 1,B
        JP Z,CHECKDOWN
        LD DE,65503
        JP TRY_MOVE
CHECKDOWN:
        BIT 2,B
        JP Z,MAIN
        LD DE,33
TRY_MOVE:
        LD HL,(PLAYER)
        ADD HL,DE
        LD A,(HL)
        AND 127
        CP 1
        JP Z,MAIN
        LD (PLAYER),HL
        PUSH AF
        LD A,E
        CP 255
        LD A,11
        JP Z,SETANIMATION
        LD A,E
        CP 1
        LD A,7
        JP Z,SETANIMATION
        LD A,E
        CP 223
        LD A,5
        JP Z,SETANIMATION
        LD A,9
SETANIMATION:
        LD B,A
        LD A,(PHASE)
        XOR 1
        LD (PHASE),A
        ADD A,B
        LD (HEROFRAME),A
        POP AF
        CP 3
        JP Z,NEXTLEVEL
        CP 4
        JP C,AFTERMOVE
        ; Consume the stone in the working map before starting the light.
        ; Revisiting this cell now sees floor 0, never item 4/5 again.
        LD HL,(PLAYER)
        LD (HL),0
        LD HL,250
        LD (LIGHT),HL
        LD HL,FX_LIGHT
        CALL PLAY_FX
AFTERMOVE:
        CALL REVEAL
        CALL DRAW
        JP MAIN
NEXTLEVEL:
        LD A,(LEVEL)
        INC A
        LD (LEVEL),A
        CP 4
        JP C,LEVELSTART
        LD HL,FX_WIN
        CALL PLAY_FX
        LD HL,WINTEXT
        JP FINISH
LOST:   LD HL,FX_LOSE
        CALL PLAY_FX
        LD HL,LOSETEXT
FINISH: PUSH HL
        CALL CLEAR
        POP HL
        LD DE,36936
        CALL TEXT
        LD HL,RESTARTTEXT
        LD DE,40008
        CALL TEXT
        CALL RELEASE
RESTARTWAIT:
        HALT
        CALL AUDIO_TICK
        CALL ESCAPE
        JP NZ,QUIT
        CALL GET_INPUT
        AND 3
        JP Z,RESTARTWAIT
        JP NEWGAME
QUIT:   CALL AUDIO_STOP
        DI
        LD A,(OLDMODE)
        LD (2835),A
        OUT (6),A
        LD A,(OLDPAGE)
        LD (3),A
        OUT (2),A
        LD SP,(OLDSP)
        POP DE
        POP BC
        POP IY
        POP IX
        LD HL,0
        EI
        RET
ESCAPE: LD A,(2897)
        AND 32
        RET NZ
        LD A,(2904)
        AND 8
        RET
; Firmware PICTURE rows are active-high. Native TVC keys:
; O=row3 bit2, P=row3 bit6, Q=row2 bit6, A=row4 bit6, SPACE=row7 bit5.
; Returned mask: LEFT=64 RIGHT=32 UP=2 DOWN=4 START=1.
GET_INPUT:
        PUSH BC
        LD A,(2905)
        AND 102
        LD C,A
        LD A,(2900)
        BIT 2,A
        JP Z,INPUT_P
        SET 6,C
INPUT_P: BIT 6,A
        JP Z,INPUT_Q
        SET 5,C
INPUT_Q: LD A,(2899)
        BIT 6,A
        JP Z,INPUT_A
        SET 1,C
INPUT_A: LD A,(2901)
        BIT 6,A
        JP Z,INPUT_SPACE
        SET 2,C
INPUT_SPACE:
        LD A,(2904)
        BIT 5,A
        JP Z,INPUT_DONE
        SET 0,C
INPUT_DONE:
        LD A,C
        POP BC
        RET
RELEASE:
        HALT
        CALL AUDIO_TICK
        CALL ESCAPE
        JP NZ,QUIT
        CALL GET_INPUT
        AND 103
        JP NZ,RELEASE
        RET
READTIME:
        DI
        LD HL,(2845)
        EI
        RET
UPDATE_TIME:
        CALL READTIME
        PUSH HL
        LD DE,(LASTTIME)
        OR A
        SBC HL,DE
        EX DE,HL
        POP HL
        LD (LASTTIME),HL
        LD HL,(TIMELEFT)
        OR A
        SBC HL,DE
        JP NC,TIMEVALID
        LD HL,0
TIMEVALID:
        LD (TIMELEFT),HL
        LD HL,(LIGHT)
        LD A,H
        OR L
        RET Z
        OR A
        SBC HL,DE
        JP C,LIGHTOUT
        LD A,H
        OR L
        JP Z,LIGHTOUT
        LD (LIGHT),HL
        RET
LIGHTOUT:
        LD HL,0
        LD (LIGHT),HL
        CALL DRAW
        RET
; CPC-compatible malus: each newly discovered neighboring wall is +0.2.
; SCORE stores fifths (integers) to avoid floating-point rounding errors.
; Illumination changes visibility, not wall identity/color index.
REVEAL: LD HL,(PLAYER)
        LD DE,65535
        ADD HL,DE
        CALL MARK
        LD HL,(PLAYER)
        INC HL
        CALL MARK
        LD HL,(PLAYER)
        LD DE,65503
        ADD HL,DE
        CALL MARK
        LD HL,(PLAYER)
        LD DE,33
        ADD HL,DE
        CALL MARK
        RET
MARK:   LD A,(HL)
        CP 1
        RET NZ
        LD (HL),129
        LD HL,(SCORE)
        INC HL
        LD (SCORE),HL
        LD HL,FX_WALL
        CALL PLAY_FX
        RET
; Display INT(malus): raw SCORE / 5, matching CPC +0.2 discoveries.
MALUS_VALUE:
        LD HL,(SCORE)
        LD DE,5
        LD BC,0
MALUS_DIVIDE:
        OR A
        SBC HL,DE
        JP C,MALUS_INTEGER
        INC BC
        JP MALUS_DIVIDE
MALUS_INTEGER:
        LD H,B
        LD L,C
        RET
CLEAR:  LD HL,32768
        LD DE,32769
        LD BC,15359
        LD (HL),0
        LDIR
        RET
CLEARFOOT:
        LD HL,46080
        LD DE,46081
        LD BC,1023
        LD (HL),0
        LDIR
        RET
FRAME:  LD HL,TIMELABEL
        LD DE,32900
        CALL TEXT
        LD HL,MALUSLABEL
        LD DE,32930
        CALL TEXT
        LD HL,SIDETEXT
        LD DE,38966
        CALL TEXT
        LD A,(LEVEL)
        ADD A,49
        LD DE,39993
        CALL CHAR
        ; Full-width cyan bars at y=0,12,192.
        LD HL,32768
        CALL HLINE
        LD HL,33536
        CALL HLINE
        LD HL,45056
        CALL HLINE
        LD HL,32768
        CALL VLINELEFT
        LD HL,32831
        CALL VLINERIGHT
        LD HL,33586
        LD B,181
SIDEBORDER:
        LD A,(HL)
        OR 128
        LD (HL),A
        LD DE,64
        ADD HL,DE
        DJNZ SIDEBORDER
        RET
HLINE:  LD B,64
HLINELOOP:
        LD (HL),240
        INC HL
        DJNZ HLINELOOP
        RET
VLINELEFT:
        LD B,13
VLEFT:  LD A,(HL)
        OR 128
        LD (HL),A
        LD DE,64
        ADD HL,DE
        DJNZ VLEFT
        RET
VLINERIGHT:
        LD B,193
VRIGHT: LD A,(HL)
        OR 16
        LD (HL),A
        LD DE,64
        ADD HL,DE
        DJNZ VRIGHT
        RET
HUD:    LD HL,(TIMELEFT)
        LD DE,50
        LD BC,0
DIVSEC: OR A
        SBC HL,DE
        JP C,SECEND
        INC BC
        JP DIVSEC
SECEND: LD H,B
        LD L,C
        LD DE,32910
        CALL NUMBER
        CALL MALUS_VALUE
        LD DE,32944
        CALL NUMBER
        RET
; Draw 33 x 22 original tiles, 6x8 pixels, four colors.
DRAW:   LD HL,BOARD
        LD DE,33792
        LD B,22
DRAWROW:
        CALL AUDIO_TICK
        XOR A
        LD (ALIGNMENT),A
        LD C,33
DRAWCELL:
        PUSH BC
        PUSH HL
        PUSH DE
        LD A,(HL)
        LD C,A
        AND 127
        LD B,A
        XOR A
        LD (GLYPH),A
        LD A,B
        CP 1
        JP NZ,NOTWALL
        LD A,(SHOWALL)
        OR A
        JP NZ,WALLVISIBLE
        LD A,(LIGHT)
        LD D,A
        LD A,(LIGHT+1)
        OR D
        JP NZ,WALLVISIBLE
        BIT 7,C
        JP Z,CELLSELECTED
WALLVISIBLE:
        LD A,1
        BIT 7,C
        JP Z,WALLCOLOR
        INC A
WALLCOLOR:
        LD (GLYPH),A
        JP CELLSELECTED
NOTWALL:
        CP 3
        JP NZ,NOTEXIT
        LD A,3
        LD (GLYPH),A
        JP CELLSELECTED
NOTEXIT:
        CP 4
        JP C,CELLSELECTED
        LD A,4
        LD (GLYPH),A
CELLSELECTED:
        LD DE,(PLAYER)
        OR A
        SBC HL,DE
        JP NZ,NOTPLAYER
        LD A,(HEROFRAME)
        LD (GLYPH),A
NOTPLAYER:
        POP DE
        LD A,(GLYPH)
        PUSH DE
        CALL TILE
        POP DE
        POP HL
        POP BC
        INC HL
        LD A,(ALIGNMENT)
        XOR 1
        LD (ALIGNMENT),A
        INC DE
        OR A
        JP NZ,TILESTEPPED
        INC DE
TILESTEPPED:
        DEC C
        JP NZ,DRAWCELL
        PUSH HL
        LD HL,463
        ADD HL,DE
        EX DE,HL
        POP HL
        DEC B
        JP NZ,DRAWROW
        RET
 ; TILE index A, screen DE, global ALIGNMENT 0/1. BC preserved.
TILE:   PUSH BC
        LD L,A
        LD H,0
        ADD HL,HL
        ADD HL,HL
        ADD HL,HL
        ADD HL,HL
        ADD HL,HL
        LD BC,TILES
        ADD HL,BC
        LD A,(ALIGNMENT)
        OR A
        JP Z,TILEALIGNED
        LD BC,16
        ADD HL,BC
        LD A,204
        LD (MASKFIRST),A
        XOR A
        LD (MASKLAST),A
        JP TILEBLIT
TILEALIGNED:
        XOR A
        LD (MASKFIRST),A
        LD A,51
        LD (MASKLAST),A
TILEBLIT:
        LD B,8
TILESCAN:
        LD A,(DE)
        LD C,A
        LD A,(MASKFIRST)
        AND C
        OR (HL)
        LD (DE),A
        INC HL
        INC DE
        LD A,(DE)
        LD C,A
        LD A,(MASKLAST)
        AND C
        OR (HL)
        LD (DE),A
        INC HL
        PUSH HL
        LD HL,63
        ADD HL,DE
        EX DE,HL
        POP HL
        DJNZ TILESCAN
        POP BC
        RET
; Eight-pixel-wide text glyphs, two bytes per scanline in graphics 4.
CHAR:   PUSH BC
        SUB 32
        LD L,A
        LD H,0
        ADD HL,HL
        ADD HL,HL
        ADD HL,HL
        ADD HL,HL
        LD BC,FONT
        ADD HL,BC
        LD B,8
CHARROW:
        LD A,(HL)
        LD (DE),A
        INC HL
        INC DE
        LD A,(HL)
        LD (DE),A
        INC HL
        PUSH HL
        LD HL,63
        ADD HL,DE
        EX DE,HL
        POP HL
        DJNZ CHARROW
        POP BC
        RET
; Null-terminated text. Byte 10 starts the next 8-pixel character row.
TEXT:   LD (TEXTLEFT),DE
TEXTLOOP:
        LD A,(HL)
        INC HL
        OR A
        RET Z
        CP 10
        JP Z,TEXTNEWLINE
        PUSH HL
        PUSH DE
        CALL CHAR
        POP DE
        INC DE
        INC DE
        POP HL
        JP TEXTLOOP
TEXTNEWLINE:
        PUSH HL
        LD HL,(TEXTLEFT)
        LD BC,512
        ADD HL,BC
        EX DE,HL
        LD (TEXTLEFT),DE
        POP HL
        JP TEXTLOOP
; Fixed 5-digit decimal field. HL value, DE screen address.
NUMBER: LD IX,DIVISORS+4
        LD B,3
DIGIT:  LD C,48
        PUSH DE
        LD E,(IX+0)
        LD D,(IX+1)
SUBDIGIT:
        OR A
        SBC HL,DE
        JP C,DIGITREADY
        INC C
        JP SUBDIGIT
DIGITREADY:
        ADD HL,DE
        POP DE
        PUSH HL
        PUSH DE
        LD A,C
        CALL CHAR
        POP DE
        INC DE
        INC DE
        POP HL
        INC IX
        INC IX
        DJNZ DIGIT
        RET
; AUDIO states: stream pointer, tick count, pitch word, volume.
; Timing comes from firmware clock (2845), preserving all caller registers.
AUDIO_INIT:
        LD A,(2834)
        LD (OLDSOUND),A
        XOR A
        LD (MUSIC_ENABLED),A
        LD HL,0
        LD (FX_STATE),HL
        LD (MUSIC_STATE),HL
        LD A,(2845)
        LD (AUDIO_LAST),A
        CALL AUDIO_SILENCE
        RET
MUSIC_START:
        LD HL,MUSIC_INTRO_PACKED
        LD (MUSIC_STATE),HL
        CALL MUSIC_RESET
        XOR A
        LD (MUSIC_STATE+2),A
        LD A,36
        LD (MUSIC_PHASE),A
        LD A,1
        LD (MUSIC_ENABLED),A
        RET
MUSIC_STOP:
        XOR A
        LD (MUSIC_ENABLED),A
        CALL AUDIO_SILENCE
        RET
PLAY_FX:
        LD (FX_STATE),HL
        XOR A
        LD (FX_STATE+2),A
        RET
AUDIO_STOP:
        XOR A
        LD (MUSIC_ENABLED),A
        LD HL,0
        LD (FX_STATE),HL
        CALL AUDIO_SILENCE
        RET
AUDIO_SILENCE:
        LD A,(2834)
        AND 239
        LD (2834),A
        OUT (5),A
        RET
AUDIO_TICK:
        PUSH AF
        PUSH BC
        PUSH DE
        PUSH HL
        PUSH IX
        LD A,(AUDIO_LAST)
        LD B,A
        LD A,(2845)
        LD (AUDIO_LAST),A
        SUB B
        JP Z,AUDIO_DONE
        LD B,A
AUDIO_CATCHUP:
        PUSH BC
        CALL AUDIO_STEP
        POP BC
        DJNZ AUDIO_CATCHUP
AUDIO_DONE:
        POP IX
        POP HL
        POP DE
        POP BC
        POP AF
        RET
AUDIO_STEP:
        LD A,(MUSIC_ENABLED)
        OR A
        JP Z,FX_ADVANCE
        ; Original BASIC title loop is approx. 14 Hz (video estimate).
        ; Fractional divider: music 14 Hz; audio/SFX/system clock 50 Hz.
        LD A,(MUSIC_PHASE)
        ADD A,14
        LD (MUSIC_PHASE),A
        CP 50
        JP C,FX_ADVANCE
        SUB 50
        LD (MUSIC_PHASE),A
        LD IX,MUSIC_STATE
        CALL MUSIC_STEP
FX_ADVANCE:
        LD IX,FX_STATE
        LD DE,0
        CALL STREAM_STEP
        LD HL,(FX_STATE)
        LD A,H
        OR L
        JP NZ,SOUND_OUTPUT
        LD A,(MUSIC_ENABLED)
        OR A
        JP Z,AUDIO_SILENCE
        LD IX,MUSIC_STATE
SOUND_OUTPUT:
        LD A,(IX+5)
        OR A
        JP Z,AUDIO_SILENCE
        RLCA
        RLCA
        LD C,A
        LD A,(2835)
        AND 195
        OR C
        LD (2835),A
        OUT (6),A
        LD A,(IX+3)
        OUT (4),A
        LD A,(2834)
        AND 224
        OR 16
        OR (IX+4)
        LD (2834),A
        OUT (5),A
        RET
STREAM_STEP:
        LD A,(IX+2)
        OR A
        JP Z,STREAM_FETCH
        DEC A
        LD (IX+2),A
        RET NZ
STREAM_FETCH:
        LD L,(IX+0)
        LD H,(IX+1)
STREAM_CHECK:
        LD A,H
        OR L
        JP Z,STREAM_END
        LD A,(HL)
        LD (IX+3),A
        INC HL
        LD A,(HL)
        LD (IX+4),A
        INC HL
        LD A,(HL)
        LD (IX+5),A
        INC HL
        LD A,(HL)
        INC HL
        OR A
        JP NZ,STREAM_RECORD
        LD A,D
        OR E
        JP Z,STREAM_END
        EX DE,HL
        JP STREAM_CHECK
STREAM_RECORD:
        LD (IX+2),A
        LD (IX+0),L
        LD (IX+1),H
        RET
STREAM_END:
        XOR A
        LD (IX+0),A
        LD (IX+1),A
        LD (IX+2),A
        LD (IX+5),A
        RET
; Cover: original CPC screenshot, resized 320 -> 256 pixels, 200 lines.
COVER:  CALL CLEAR
        CALL PALETTE_COVER
        LD HL,COVER_DATA
        LD DE,33792
COVER_DECODE:
        LD A,(HL)
        INC HL
        BIT 7,A
        JP NZ,COVER_MATCH
        INC A
        LD C,A
        LD B,0
        LDIR
        JP COVER_CHECK
COVER_MATCH:
        AND 127
        ADD A,3
        LD (MATCH_LENGTH),A
        LD A,(HL)
        INC HL
        PUSH HL
        PUSH DE
        LD H,D
        LD L,E
        LD C,A
        LD B,0
        INC BC
        OR A
        SBC HL,BC
        POP DE
        LD A,(MATCH_LENGTH)
        LD C,A
        LD B,0
        LDIR
        POP HL
COVER_CHECK:
        LD A,D
        CP 182
        JP NZ,COVER_DECODE
        LD A,E
        OR A
        JP NZ,COVER_DECODE
        LD HL,COVER_CAPTION
        LD DE,47106
        CALL TEXT
        LD A,(2845)
        LD (AUDIO_LAST),A
        CALL MUSIC_START
        CALL RELEASE
COVER_WAIT:
        HALT
        CALL AUDIO_TICK
        CALL ESCAPE
        JP NZ,QUIT
        CALL GET_INPUT
        AND 3
        JP Z,COVER_WAIT
        RET
PALETTE_COVER:
        XOR A
        OUT (96),A
        LD A,4
        OUT (97),A
        LD A,85
        OUT (98),A
        LD A,17
        OUT (99),A
        RET
PALETTE_GAME:
        XOR A
        OUT (96),A
        LD A,81
        OUT (97),A
        LD A,21
        OUT (98),A
        LD A,85
        OUT (99),A
        RET
OLDSOUND: DB 0
AUDIO_LAST: DB 0
MUSIC_ENABLED: DB 0
MUSIC_PHASE: DB 36
MUSIC_STATE: DW 0
        DB 0,0,0,0
FX_STATE: DW 0
        DB 0,0,0,0
MATCH_LENGTH: DB 0
COVER_CAPTION: DB 74,79,89,83,84,73,67,75,32,85,80,58,32,67,79,78,84,73,78,85,69,0
; Seed timing makes the same snapshot produce different games after input.
SEED_RANDOM:
        CALL READTIME
        LD DE,(RNG_STATE)
        ADD HL,DE
        LD A,R
        XOR L
        LD L,A
        LD A,H
        OR L
        JP NZ,SEED_NONZERO
        INC HL
SEED_NONZERO:
        LD (RNG_STATE),HL
        RET
; Maximal-period 16-bit Galois LFSR, polynomial mask B400h.
RANDOM_BYTE:
        LD HL,(RNG_STATE)
        SRL H
        RR L
        JP NC,RANDOM_READY
        LD A,H
        XOR 180
        LD H,A
RANDOM_READY:
        LD (RNG_STATE),HL
        LD A,H
        XOR L
        RET
GENERATE_MAZE:
        LD HL,BOARD
        LD DE,BOARD+1
        LD BC,725
        LD (HL),1
        LDIR
        LD HL,DFS_STACK
        LD (DFS_TOP),HL
        LD A,1
        LD (CUR_X),A
        LD A,19
        LD (CUR_Y),A
        LD HL,BOARD+628
        LD (HL),0
GEN_VISIT:
        CALL RANDOM_BYTE
        AND 3
        LD (GEN_DIR),A
        LD B,4
GEN_TRY:
        PUSH BC
        CALL TRY_CARVE
        POP BC
        JP C,GEN_VISIT
        LD A,(GEN_DIR)
        INC A
        AND 3
        LD (GEN_DIR),A
        DJNZ GEN_TRY
        ; No unvisited neighbors: pop the previous cell.
        LD HL,(DFS_TOP)
        LD DE,DFS_STACK
        OR A
        SBC HL,DE
        LD A,H
        OR L
        JP Z,GEN_FINISH
        LD HL,(DFS_TOP)
        DEC HL
        LD A,(HL)
        LD (CUR_Y),A
        DEC HL
        LD A,(HL)
        LD (CUR_X),A
        LD (DFS_TOP),HL
        JP GEN_VISIT
GEN_FINISH:
        CALL OPEN_ROOMS
        CALL THIN_WALLS
        ; Opposite corner is an open odd-coordinate cell, guaranteed connected.
        LD HL,BOARD+64
        LD (HL),3
        LD A,4
        LD (STONE_ID),A
        CALL PLACE_STONE
        LD A,5
        LD (STONE_ID),A
        CALL PLACE_STONE
        RET
; B=x, C=y (zero based). HL = BOARD + y*33 + x.
CELL_POINTER:
        LD L,C
        LD H,0
        LD E,C
        LD D,0
        ADD HL,HL
        ADD HL,HL
        ADD HL,HL
        ADD HL,HL
        ADD HL,HL
        ADD HL,DE
        LD E,B
        ADD HL,DE
        LD DE,BOARD
        ADD HL,DE
        RET
TRY_CARVE:
        LD A,(CUR_X)
        LD (NEXT_X),A
        LD A,(CUR_Y)
        LD (NEXT_Y),A
        LD A,(GEN_DIR)
        OR A
        JP Z,GEN_LEFT
        CP 1
        JP Z,GEN_RIGHT
        CP 2
        JP Z,GEN_UP
        LD A,(CUR_Y)
        CP 19
        JP NC,CARVE_FAIL
        ADD A,2
        LD (NEXT_Y),A
        JP CARVE_TEST
GEN_UP: LD A,(CUR_Y)
        CP 3
        JP C,CARVE_FAIL
        SUB 2
        LD (NEXT_Y),A
        JP CARVE_TEST
GEN_LEFT:
        LD A,(CUR_X)
        CP 3
        JP C,CARVE_FAIL
        SUB 2
        LD (NEXT_X),A
        JP CARVE_TEST
GEN_RIGHT:
        LD A,(CUR_X)
        CP 31
        JP NC,CARVE_FAIL
        ADD A,2
        LD (NEXT_X),A
CARVE_TEST:
        LD A,(NEXT_X)
        LD B,A
        LD A,(NEXT_Y)
        LD C,A
        CALL CELL_POINTER
        LD A,(HL)
        CP 1
        JP NZ,CARVE_FAIL
        LD (HL),0
        ; Open the intermediate wall.
        LD A,(NEXT_X)
        LD B,A
        LD A,(CUR_X)
        ADD A,B
        SRL A
        LD B,A
        LD A,(NEXT_Y)
        LD C,A
        LD A,(CUR_Y)
        ADD A,C
        SRL A
        LD C,A
        CALL CELL_POINTER
        LD (HL),0
        ; Push old coordinates (maximum 159 entries, 318 bytes).
        LD HL,(DFS_TOP)
        LD A,(CUR_X)
        LD (HL),A
        INC HL
        LD A,(CUR_Y)
        LD (HL),A
        INC HL
        LD (DFS_TOP),HL
        LD A,(NEXT_X)
        LD (CUR_X),A
        LD A,(NEXT_Y)
        LD (CUR_Y),A
        SCF
        RET
CARVE_FAIL:
        OR A
        RET
PLACE_STONE:
        CALL RANDOM_BYTE
        AND 15
        ADD A,A
        INC A
        LD (NEXT_X),A
STONE_Y:
        CALL RANDOM_BYTE
        AND 15
        CP 10
        JP NC,STONE_Y
        ADD A,A
        INC A
        LD C,A
        LD A,(NEXT_X)
        LD B,A
        ; Keep start (1,19) free.
        CP 1
        JP NZ,STONE_POINTER
        LD A,C
        CP 19
        JP Z,PLACE_STONE
STONE_POINTER:
        CALL CELL_POINTER
        LD A,(HL)
        OR A
        JP NZ,PLACE_STONE
        LD A,(STONE_ID)
        LD (HL),A
        RET
; Open 10 small rooms around already connected logical cells.
; Centers are kept away from outer walls; every room touches the maze.
OPEN_ROOMS:
        LD A,10
        LD (ROOMS_LEFT),A
ROOM_NEXT:
        CALL RANDOM_BYTE
        AND 15
        ADD A,A
        INC A
        CP 1
        JP Z,ROOM_NEXT
        CP 31
        JP Z,ROOM_NEXT
        DEC A
        LD (NEXT_X),A
ROOM_PICK_Y:
        CALL RANDOM_BYTE
        AND 15
        CP 10
        JP NC,ROOM_PICK_Y
        ADD A,A
        INC A
        CP 1
        JP Z,ROOM_PICK_Y
        CP 19
        JP Z,ROOM_PICK_Y
        DEC A
        LD C,A
        LD A,(NEXT_X)
        LD B,A
        CALL CELL_POINTER
        LD B,3
ROOM_ROW:
        LD C,3
ROOM_CELL:
        LD (HL),0
        INC HL
        DEC C
        JP NZ,ROOM_CELL
        LD DE,30
        ADD HL,DE
        DJNZ ROOM_ROW
        LD A,(ROOMS_LEFT)
        DEC A
        LD (ROOMS_LEFT),A
        JP NZ,ROOM_NEXT
        RET
; Reduce total walls to a varying 280..311 (38.6..42.8 percent).
; Only remove interior walls touching a floor, preserving connectivity.
THIN_WALLS:
        LD HL,BOARD
        LD BC,726
        LD DE,0
COUNT_WALLS:
        LD A,(HL)
        CP 1
        JP NZ,COUNT_NEXT
        INC DE
COUNT_NEXT:
        INC HL
        DEC BC
        LD A,B
        OR C
        JP NZ,COUNT_WALLS
        PUSH DE
        CALL RANDOM_BYTE
        AND 31
        LD L,A
        LD H,0
        LD DE,280
        ADD HL,DE
        EX DE,HL
        POP HL
        OR A
        SBC HL,DE
        RET C
        LD (WALLS_TO_OPEN),HL
THIN_NEXT:
        LD HL,(WALLS_TO_OPEN)
        LD A,H
        OR L
        RET Z
        CALL RANDOM_BYTE
        AND 31
        OR A
        JP Z,THIN_NEXT
        LD (NEXT_X),A
THIN_PICK_Y:
        CALL RANDOM_BYTE
        AND 31
        OR A
        JP Z,THIN_PICK_Y
        CP 21
        JP NC,THIN_PICK_Y
        LD C,A
        LD A,(NEXT_X)
        LD B,A
        CALL CELL_POINTER
        LD A,(HL)
        CP 1
        JP NZ,THIN_NEXT
        LD (THIN_CELL),HL
        DEC HL
        LD A,(HL)
        OR A
        JP Z,THIN_OPEN
        INC HL
        INC HL
        LD A,(HL)
        OR A
        JP Z,THIN_OPEN
        LD HL,(THIN_CELL)
        LD DE,33
        ADD HL,DE
        LD A,(HL)
        OR A
        JP Z,THIN_OPEN
        LD HL,(THIN_CELL)
        LD DE,65503
        ADD HL,DE
        LD A,(HL)
        OR A
        JP NZ,THIN_NEXT
THIN_OPEN:
        LD HL,(THIN_CELL)
        LD (HL),0
        LD HL,(WALLS_TO_OPEN)
        DEC HL
        LD (WALLS_TO_OPEN),HL
        JP THIN_NEXT
ROOMS_LEFT: DB 0
WALLS_TO_OPEN: DW 0
THIN_CELL: DW 0
RNG_STATE: DW 44257
DFS_TOP: DW 0
CUR_X: DB 1
CUR_Y: DB 19
NEXT_X: DB 0
NEXT_Y: DB 0
GEN_DIR: DB 0
STONE_ID: DB 0
PALETTE_MENU:
        XOR A
        OUT (96),A
        LD A,81
        OUT (97),A
        LD A,84
        OUT (98),A
        LD A,68
        OUT (99),A
        RET
; Lossless LZ unpack of the exact selected instructions screen.
MENU_UNPACK:
        LD A,(HL)
        INC HL
        BIT 7,A
        JP NZ,MENU_MATCH
        INC A
        LD C,A
        LD B,0
        LDIR
        JP MENU_CHECK
MENU_MATCH:
        AND 127
        ADD A,3
        LD (MATCH_LENGTH),A
        LD A,(HL)
        INC HL
        PUSH HL
        PUSH DE
        LD H,D
        LD L,E
        LD C,A
        LD B,0
        INC BC
        OR A
        SBC HL,BC
        POP DE
        LD A,(MATCH_LENGTH)
        LD C,A
        LD B,0
        LDIR
        POP HL
MENU_CHECK:
        LD A,D
        CP 183
        JP NZ,MENU_UNPACK
        LD A,E
        OR A
        JP NZ,MENU_UNPACK
        RET
; Smooth title movement between figures, one physical pixel per 100 ms.
TITLE_TICK:
        LD A,(TITLE_LAST)
        LD B,A
        LD A,(2845)
        SUB B
        CP 5
        RET C
        LD A,(2845)
        LD (TITLE_LAST),A
        LD A,(TITLE_DIR)
        LD B,A
        LD A,(TITLE_POS)
        ADD A,B
        LD (TITLE_POS),A
        OR A
        JP NZ,TITLE_RIGHT_EDGE
        LD A,1
        LD (TITLE_DIR),A
        JP DRAW_TITLE
TITLE_RIGHT_EDGE:
        CP 14
        JP NZ,DRAW_TITLE
        LD A,255
        LD (TITLE_DIR),A
DRAW_TITLE:
        ; Clear only the 80-pixel-wide gap, never the figures or the story.
        LD HL,34837
        LD B,8
TITLE_CLEAR_ROW:
        LD C,20
TITLE_CLEAR_BYTE:
        LD (HL),0
        INC HL
        DEC C
        JP NZ,TITLE_CLEAR_BYTE
        LD DE,44
        ADD HL,DE
        DJNZ TITLE_CLEAR_ROW
        LD A,(TITLE_POS)
        AND 3
        LD B,A
        LD A,17
        CP 17
        LD (TITLE_WIDTH),A
        LD A,B
        CP 3
        JP NZ,TITLE_SOURCE
        LD A,18
        LD (TITLE_WIDTH),A
TITLE_SOURCE:
        LD HL,TITLE_DATA
        LD DE,144
        LD A,B
        OR A
        JP Z,TITLE_DEST
TITLE_ALIGN:
        ADD HL,DE
        DJNZ TITLE_ALIGN
TITLE_DEST:
        LD A,(TITLE_POS)
        SRL A
        SRL A
        ADD A,21
        LD E,A
        LD D,136
        LD B,8
TITLE_COPY_ROW:
        PUSH BC
        LD A,(TITLE_WIDTH)
        LD C,A
        LD B,0
        LDIR
        LD A,(TITLE_WIDTH)
        CP 18
        JP Z,TITLE_SOURCE_NEXT
        INC HL
TITLE_SOURCE_NEXT:
        LD A,(TITLE_WIDTH)
        LD C,A
        LD A,64
        SUB C
        LD C,A
        LD B,0
        PUSH HL
        LD H,D
        LD L,E
        ADD HL,BC
        EX DE,HL
        POP HL
        POP BC
        DJNZ TITLE_COPY_ROW
        RET
TITLE_POS: DB 0
TITLE_DIR: DB 1
TITLE_LAST: DB 0
TITLE_WIDTH: DB 17
; Streaming LZ music decoder: 256-byte history replaces the 7092-byte
; expanded song. Intro/body each have independent dictionaries and sentinels.
MUSIC_RESET:
        LD (MUSIC_INPUT),HL
        XOR A
        LD (MUSIC_REMAIN),A
        LD (MUSIC_RINGPOS),A
        RET
MUSIC_STEP:
        LD A,(IX+2)
        OR A
        JP Z,MUSIC_FETCH
        DEC A
        LD (IX+2),A
        RET NZ
MUSIC_FETCH:
        CALL MUSIC_BYTE
        LD (IX+3),A
        CALL MUSIC_BYTE
        LD (IX+4),A
        CALL MUSIC_BYTE
        LD (IX+5),A
        CALL MUSIC_BYTE
        OR A
        JP NZ,MUSIC_SET_COUNT
        LD HL,MUSIC_BODY_PACKED
        CALL MUSIC_RESET
        JP MUSIC_FETCH
MUSIC_SET_COUNT:
        LD (IX+2),A
        RET
MUSIC_BYTE:
        LD A,(MUSIC_REMAIN)
        OR A
        JP NZ,MUSIC_EMIT
        LD HL,(MUSIC_INPUT)
        LD A,(HL)
        INC HL
        BIT 7,A
        JP NZ,MUSIC_MATCH_TOKEN
        INC A
        LD (MUSIC_REMAIN),A
        XOR A
        LD (MUSIC_MATCH),A
        JP MUSIC_TOKEN_DONE
MUSIC_MATCH_TOKEN:
        AND 127
        ADD A,3
        LD (MUSIC_REMAIN),A
        LD A,1
        LD (MUSIC_MATCH),A
        LD A,(HL)
        INC HL
        LD (MUSIC_DISTANCE),A
MUSIC_TOKEN_DONE:
        LD (MUSIC_INPUT),HL
MUSIC_EMIT:
        LD A,(MUSIC_MATCH)
        OR A
        JP NZ,MUSIC_BACKREF
        LD HL,(MUSIC_INPUT)
        LD A,(HL)
        INC HL
        LD (MUSIC_INPUT),HL
        JP MUSIC_REMEMBER
MUSIC_BACKREF:
        LD A,(MUSIC_DISTANCE)
        LD B,A
        LD A,(MUSIC_RINGPOS)
        SUB B
        DEC A
        LD L,A
        LD H,0
        LD DE,MUSIC_HISTORY
        ADD HL,DE
        LD A,(HL)
MUSIC_REMEMBER:
        PUSH AF
        LD A,(MUSIC_RINGPOS)
        LD L,A
        INC A
        LD (MUSIC_RINGPOS),A
        LD H,0
        LD DE,MUSIC_HISTORY
        ADD HL,DE
        POP AF
        LD (HL),A
        LD B,A
        LD A,(MUSIC_REMAIN)
        DEC A
        LD (MUSIC_REMAIN),A
        LD A,B
        RET
MUSIC_INPUT: DW 0
MUSIC_REMAIN: DB 0
MUSIC_MATCH: DB 0
MUSIC_DISTANCE: DB 0
MUSIC_RINGPOS: DB 0
DIVISORS: DW 10000,1000,100,10,1
OLDSP:  DW 0
OLDPAGE: DB 0
OLDMODE: DB 0
LEVEL: DB 0
SCORE: DW 0
PLAYER: DW 0
TIMELEFT: DW 0
LASTTIME: DW 0
LIGHT: DW 0
LASTMOVE: DB 0
SHOWALL: DB 0
GLYPH: DB 0
TEXTLEFT: DW 0
ALIGNMENT: DB 0
MASKFIRST: DB 0
MASKLAST: DB 0
HEROFRAME: DB 7
PHASE: DB 0
TITLETEXT: DB 83,72,65,68,79,87,32,77,65,90,69,0
TIMELABEL: DB 84,73,77,69,58,0
MALUSLABEL: DB 77,65,76,85,83,58,0
SIDETEXT: DB 77,65,90,69,0
READYTEXT: DB 77,69,77,79,82,73,90,69,33,32,77,79,86,69,32,74,79,89,83,84,73,67,75,32,84,79,32,83,84,65,82,84,0
WINTEXT: DB 89,79,85,32,69,83,67,65,80,69,68,32,65,76,76,32,70,79,85,82,32,77,65,90,69,83,33,0
LOSETEXT: DB 84,73,77,69,32,79,86,69,82,32,45,32,71,65,77,69,32,79,86,69,82,0
RESTARTTEXT: DB 74,79,89,83,84,73,67,75,32,85,80,58,32,82,69,83,84,65,82,84,10,69,83,67,58,32,81,85,73,84,0
FONT:
        DB 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0 ; ASCII 32
        DB 32,0,32,0,32,0,32,0,32,0,0,0,32,0,0,0 ; ASCII 33
        DB 80,0,80,0,0,0,0,0,0,0,0,0,0,0,0,0 ; ASCII 34
        DB 48,0,80,0,240,128,80,0,240,128,96,0,160,0,0,0 ; ASCII 35
        DB 16,0,48,192,80,0,112,0,16,192,16,64,112,128,16,0 ; ASCII 36
        DB 224,0,160,0,224,128,48,0,112,128,32,128,48,128,0,0 ; ASCII 37
        DB 48,128,32,0,32,0,48,0,80,128,80,0,48,128,0,0 ; ASCII 38
        DB 32,0,32,0,0,0,0,0,0,0,0,0,0,0,0,0 ; ASCII 39
        DB 32,0,32,0,32,0,32,0,32,0,32,0,16,0,0,0 ; ASCII 40
        DB 32,0,16,0,16,0,16,0,16,0,32,0,32,0,0,0 ; ASCII 41
        DB 160,128,112,0,112,0,160,128,0,0,0,0,0,0,0,0 ; ASCII 42
        DB 0,0,0,0,32,0,32,0,240,128,32,0,32,0,0,0 ; ASCII 43
        DB 0,0,0,0,0,0,0,0,0,0,0,0,32,0,32,0 ; ASCII 44
        DB 0,0,0,0,0,0,0,0,48,0,0,0,0,0,0,0 ; ASCII 45
        DB 0,0,0,0,0,0,0,0,0,0,0,0,32,0,0,0 ; ASCII 46
        DB 16,0,32,0,32,0,96,0,64,0,64,0,128,0,0,0 ; ASCII 47
        DB 48,0,64,128,64,128,80,128,64,128,64,128,48,0,0,0 ; ASCII 48
        DB 48,0,16,0,16,0,16,0,16,0,16,0,48,128,0,0 ; ASCII 49
        DB 48,0,64,128,0,128,16,128,48,0,96,0,112,128,0,0 ; ASCII 50
        DB 48,0,64,128,0,128,48,0,0,128,0,128,112,0,0,0 ; ASCII 51
        DB 16,0,16,0,48,0,48,0,80,0,112,128,16,0,0,0 ; ASCII 52
        DB 112,128,64,0,64,0,112,0,0,128,0,128,112,0,0,0 ; ASCII 53
        DB 48,128,96,0,64,0,112,128,64,128,64,128,48,0,0,0 ; ASCII 54
        DB 112,128,0,128,16,0,16,0,16,0,48,0,32,0,0,0 ; ASCII 55
        DB 48,0,64,128,64,128,48,0,64,128,64,128,48,0,0,0 ; ASCII 56
        DB 48,0,64,128,64,128,112,128,0,128,16,128,112,0,0,0 ; ASCII 57
        DB 0,0,0,0,32,0,0,0,0,0,0,0,32,0,0,0 ; ASCII 58
        DB 0,0,0,0,32,0,0,0,0,0,0,0,32,0,32,0 ; ASCII 59
        DB 0,0,0,0,0,64,48,128,112,0,0,192,0,0,0,0 ; ASCII 60
        DB 0,0,0,0,0,0,240,128,0,0,240,128,0,0,0,0 ; ASCII 61
        DB 0,0,0,0,64,0,48,128,16,192,96,0,0,0,0,0 ; ASCII 62
        DB 112,128,0,128,16,0,32,0,32,0,0,0,32,0,0,0 ; ASCII 63
        DB 0,0,48,0,64,128,80,128,80,128,80,128,96,0,48,0 ; ASCII 64
        DB 48,0,48,0,48,0,64,128,64,128,112,128,64,128,0,0 ; ASCII 65
        DB 112,0,64,128,64,128,112,0,64,128,64,128,112,128,0,0 ; ASCII 66
        DB 48,128,64,0,64,0,64,0,64,0,64,0,48,128,0,0 ; ASCII 67
        DB 112,0,64,128,64,128,64,128,64,128,64,128,112,0,0,0 ; ASCII 68
        DB 112,128,64,0,64,0,112,128,64,0,64,0,112,128,0,0 ; ASCII 69
        DB 112,128,64,0,64,0,112,128,64,0,64,0,64,0,0,0 ; ASCII 70
        DB 48,128,64,0,64,0,80,128,64,128,64,128,48,128,0,0 ; ASCII 71
        DB 64,128,64,128,64,128,112,128,64,128,64,128,64,128,0,0 ; ASCII 72
        DB 112,0,32,0,32,0,32,0,32,0,32,0,112,0,0,0 ; ASCII 73
        DB 48,128,0,128,0,128,0,128,0,128,0,128,112,128,0,0 ; ASCII 74
        DB 64,128,80,0,96,0,96,0,80,0,80,0,64,128,0,0 ; ASCII 75
        DB 64,0,64,0,64,0,64,0,64,0,64,0,112,128,0,0 ; ASCII 76
        DB 64,128,112,128,112,128,112,128,112,128,64,128,64,128,0,0 ; ASCII 77
        DB 64,128,96,128,96,128,80,128,80,128,80,128,64,128,0,0 ; ASCII 78
        DB 48,0,64,128,64,128,64,128,64,128,64,128,48,0,0,0 ; ASCII 79
        DB 112,0,64,128,64,128,112,0,64,0,64,0,64,0,0,0 ; ASCII 80
        DB 48,0,64,128,64,128,64,128,64,128,64,128,48,0,0,128 ; ASCII 81
        DB 112,0,64,128,64,128,112,0,80,128,64,128,64,64,0,0 ; ASCII 82
        DB 48,0,64,128,64,0,48,128,0,128,64,128,48,0,0,0 ; ASCII 83
        DB 240,128,32,0,32,0,32,0,32,0,32,0,32,0,0,0 ; ASCII 84
        DB 64,128,64,128,64,128,64,128,64,128,64,128,48,0,0,0 ; ASCII 85
        DB 64,128,64,128,48,0,48,0,48,0,48,0,48,0,0,0 ; ASCII 86
        DB 128,128,128,128,160,128,208,128,80,0,80,0,80,0,0,0 ; ASCII 87
        DB 64,128,64,128,48,0,48,0,48,0,64,128,64,128,0,0 ; ASCII 88
        DB 128,128,80,0,80,0,32,0,32,0,32,0,32,0,0,0 ; ASCII 89
        DB 112,128,0,128,16,0,16,0,32,0,64,0,112,128,0,0 ; ASCII 90
        DB 32,0,32,0,32,0,32,0,32,0,32,0,48,0,0,0 ; ASCII 91
        DB 128,0,64,0,64,0,96,0,32,0,32,0,16,0,0,0 ; ASCII 92
        DB 16,0,16,0,16,0,16,0,16,0,16,0,48,0,0,0 ; ASCII 93
        DB 32,0,208,0,0,0,0,0,0,0,0,0,0,0,0,0 ; ASCII 94
        DB 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0 ; ASCII 95
TILES:
        DB 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0 ; tile 0
        DB 15,12,9,4,8,4,10,4,8,4,12,4,8,4,15,12,3,15,2,5,2,1,2,9,2,1,3,1,2,1,3,15 ; tile 1
        DB 240,192,144,64,128,64,160,64,128,64,192,64,128,64,240,192,48,240,32,80,32,16,32,144,32,16,48,16,32,16,48,240 ; tile 2
        DB 48,0,67,128,180,72,195,192,134,64,129,72,14,4,195,192,0,192,16,44,33,210,48,60,33,24,32,22,3,9,48,60 ; tile 3
        DB 48,0,64,128,11,4,131,64,131,64,11,4,64,128,48,0,0,192,16,32,2,13,32,28,32,28,2,13,16,32,0,192 ; tile 4
        DB 0,4,2,72,48,72,3,192,130,192,72,132,52,8,3,0,0,1,0,26,0,210,0,60,32,56,18,33,1,194,0,12 ; tile 5
        DB 8,0,133,0,180,0,195,0,193,64,72,132,52,8,3,0,2,0,33,4,33,192,48,12,48,20,18,33,1,194,0,12 ; tile 6
        DB 18,0,32,0,48,12,5,132,4,128,5,128,48,12,18,192,0,72,0,128,0,195,1,37,1,32,1,36,0,195,0,120 ; tile 7
        DB 18,192,48,12,5,128,4,128,5,132,48,12,32,0,18,0,0,120,0,195,1,36,1,32,1,37,0,195,0,128,0,72 ; tile 8
        DB 3,0,52,8,72,132,130,192,3,192,48,72,2,72,0,4,0,12,1,194,18,33,32,56,0,60,0,210,0,26,0,1 ; tile 9
        DB 3,0,52,8,72,132,193,64,195,0,180,0,133,0,8,0,0,12,1,194,18,33,48,20,48,12,33,192,33,4,2,0 ; tile 10
        DB 33,0,16,0,60,0,74,8,64,8,74,8,60,0,225,0,0,132,0,64,3,192,18,10,16,2,18,10,3,192,48,132 ; tile 11
        DB 225,0,60,0,66,8,64,8,74,8,60,0,16,0,33,0,48,132,3,192,16,10,16,2,18,10,3,192,0,64,0,132 ; tile 12
MUSIC_INTRO_PACKED:
        DB 28,136,12,12,3,136,12,11,1,174,13,12,3,174,13,11
        DB 1,68,14,12,2,21,13,8,1,136,12,8,1,115,136,11
        DB 137,23,128,43,134,11,0,21,136,11,1,233,12,135,11,144
        DB 87,3,3,68,14,11,138,83,0,140,172,107,6,161,11,12
        DB 3,161,11,11,129,115,1,3,21,128,83,0,209,128,7,0
        DB 209,128,7,0,15,128,91,0,15,128,91,133,55,2,161,11
        DB 8,129,19,0,2,131,51,0,8,129,39,134,11,133,175,129
        DB 11,141,79,133,107,141,51,141,75,133,35,129,111,145,35,144
        DB 251,170,231,133,163,129,11,1,233,12,135,11,144,87,1,3
        DB 68,128,247,137,83,0,140,172,107,6,161,11,12,3,161,11
        DB 11,129,115,1,3,21,128,83,128,223,1,3,209,128,7,128
        DB 207,1,3,15,128,91,133,55,141,227,128,39,134,11,133,175
        DB 129,11,141,79,133,107,141,51,141,75,133,35,129,111,145,35
        DB 144,251,128,51,0,9,128,23,0,9,132,231,131,11,137,23
        DB 131,123,131,11,131,163,131,11,1,233,12,135,11,144,87,1
        DB 3,68,128,247,137,83,0,140,172,107,6,161,11,12,3,161
        DB 11,11,129,115,1,3,21,128,83,128,223,1,3,209,128,7
        DB 128,207,1,3,15,128,91,133,55,2,161,11,9,132,227,131
        DB 11,128,39,134,11,133,175,129,11,141,79,133,107,141,51,141
        DB 75,133,35,129,111,145,35,144,251,170,231,133,163,129,11,1
        DB 233,12,135,11,144,87,1,3,68,128,247,137,83,0,140,172
        DB 107,6,161,11,12,3,161,11,11,129,115,1,3,21,128,83
        DB 128,223,1,3,209,128,7,128,207,1,3,15,128,91,133,55
        DB 141,227,128,39,134,11,133,175,129,11,141,79,133,107,141,51
        DB 141,75,133,35,129,111,145,35,6,231,15,7,1,171,13,10
        DB 128,87,131,183,129,15,2,174,13,8,128,15,0,8,128,15
        DB 0,8,255,15,224,15,0,18,128,255,129,251,1,161,11,131
        DB 255,0,209,132,31,1,161,11,131,31,129,15,129,43,133,15
        DB 133,59,137,31,255,47,183,47,0,171,128,255,2,21,13,9
        DB 128,19,131,255,0,174,132,63,129,35,255,15,223,15,0,18
        DB 128,255,129,251,1,161,11,131,255,0,209,132,31,1,161,11
        DB 131,31,129,15,129,43,133,15,133,59,137,31,255,47,179,47
        DB 128,7,16,3,136,12,7,1,174,13,8,3,174,13,7,1
        DB 68,14,8,2,133,31,0,115,136,11,137,23,128,43,134,11
        DB 128,7,128,63,3,8,1,233,12,134,19,0,4,140,79,3
        DB 3,68,14,7,138,75,0,140,172,99,128,167,2,3,161,11
        DB 130,183,1,3,21,128,83,128,207,1,3,209,128,7,0,15
        DB 128,91,0,15,128,91,133,55,129,207,128,19,0,2,133,219
        DB 128,39,134,11,129,59,128,7,0,4,137,71,133,99,141,43
        DB 141,67,133,35,129,103,145,35,128,7,0,3,140,243,170,223
        DB 129,143,129,7,1,233,12,134,19,0,4,140,79,1,3,68
        DB 128,231,137,75,0,140,172,99,128,167,128,255,135,251,128,215
        DB 1,3,209,128,7,128,199,1,3,15,128,91,133,55,145,255
        DB 133,11,129,59,128,7,0,4,137,71,133,99,141,43,141,67
        DB 133,35,129,103,145,35,128,7,0,3,129,243,0,0,128,0
MUSIC_BODY_PACKED:
        DB 22,68,14,10,1,171,13,10,1,21,13,9,1,136,12,9
        DB 1,68,14,8,1,174,13,8,128,15,0,8,128,15,0,8
        DB 142,15,8,174,13,7,1,233,12,7,1,27,128,3,2,96
        DB 11,6,128,31,139,63,0,209,128,31,0,21,128,3,0,83
        DB 128,31,0,161,144,31,2,68,14,7,130,67,129,35,1,136
        DB 12,145,31,219,127,141,31,0,209,128,27,0,18,128,3,129
        DB 27,1,161,11,129,35,0,8,128,19,131,111,1,161,11,131
        DB 7,129,15,129,23,131,15,133,123,3,7,1,42,10,143,63
        DB 0,102,130,215,2,7,1,224,128,31,0,205,144,31,133,127
        DB 129,35,241,127,4,68,14,7,1,174,128,35,0,65,130,39
        DB 0,6,128,15,2,10,1,171,128,31,1,21,13,129,123,129
        DB 31,0,8,128,31,131,119,129,115,141,15,129,59,0,233,128
        DB 95,131,131,143,63,133,223,0,83,132,223,143,95,131,127,129
        DB 35,241,127,141,31,0,209,128,27,0,18,128,3,129,27,1
        DB 161,11,129,35,0,8,128,19,131,111,1,161,11,131,7,129
        DB 15,129,23,131,15,133,123,3,7,1,42,10,143,63,0,102
        DB 130,215,2,7,1,224,128,31,0,205,144,31,133,127,129,35
        DB 241,127,19,136,12,12,3,136,12,11,1,174,13,12,3,174
        DB 13,11,1,68,14,12,2,129,99,129,95,0,115,136,11,137
        DB 23,128,43,134,11,0,21,136,11,1,233,12,135,11,144,87
        DB 3,3,68,14,11,138,83,0,140,172,107,6,161,11,12,3
        DB 161,11,11,129,115,1,3,21,128,83,0,209,128,7,0,209
        DB 128,7,0,15,128,91,0,15,128,91,133,55,2,161,11,8
        DB 129,19,0,2,131,51,0,8,129,39,134,11,133,175,129,11
        DB 141,79,133,107,141,51,141,75,133,35,129,111,145,35,144,251
        DB 170,231,133,163,129,11,1,233,12,135,11,144,87,1,3,68
        DB 128,247,137,83,0,140,172,107,6,161,11,12,3,161,11,11
        DB 129,115,1,3,21,128,83,128,223,1,3,209,128,7,128,207
        DB 1,3,15,128,91,133,55,141,227,128,39,134,11,133,175,129
        DB 11,141,79,133,107,141,51,141,75,133,35,129,111,145,35,144
        DB 251,128,51,0,9,128,23,0,9,132,231,131,11,137,23,131
        DB 123,131,11,131,163,131,11,1,233,12,135,11,144,87,1,3
        DB 68,128,247,137,83,0,140,172,107,6,161,11,12,3,161,11
        DB 11,129,115,1,3,21,128,83,128,223,1,3,209,128,7,128
        DB 207,1,3,15,128,91,133,55,2,161,11,9,132,227,131,11
        DB 128,39,134,11,133,175,129,11,141,79,133,107,141,51,141,75
        DB 133,35,129,111,145,35,144,251,170,231,133,163,129,11,1,233
        DB 12,135,11,144,87,1,3,68,128,247,137,83,0,140,172,107
        DB 6,161,11,12,3,161,11,11,129,115,1,3,21,128,83,128
        DB 223,1,3,209,128,7,128,207,1,3,15,128,91,133,55,141
        DB 227,128,39,134,11,133,175,129,11,141,79,133,107,141,51,141
        DB 75,133,35,129,111,145,35,6,231,15,7,1,171,13,10,128
        DB 87,131,183,129,15,2,174,13,8,128,15,0,8,128,15,0
        DB 8,255,15,224,15,0,18,128,255,129,251,1,161,11,131,255
        DB 0,209,132,31,1,161,11,131,31,129,15,129,43,133,15,133
        DB 59,137,31,255,47,183,47,0,171,128,255,2,21,13,9,128
        DB 19,131,255,0,174,132,63,129,35,255,15,223,15,0,18,128
        DB 255,129,251,1,161,11,131,255,0,209,132,31,1,161,11,131
        DB 31,129,15,129,43,133,15,133,59,137,31,255,47,179,47,128
        DB 7,16,3,136,12,7,1,174,13,8,3,174,13,7,1,68
        DB 14,8,2,133,31,0,115,136,11,137,23,128,43,134,11,128
        DB 7,128,63,3,8,1,233,12,134,19,0,4,140,79,3,3
        DB 68,14,7,138,75,0,140,172,99,128,167,2,3,161,11,130
        DB 183,1,3,21,128,83,128,207,1,3,209,128,7,0,15,128
        DB 91,0,15,128,91,133,55,129,207,128,19,0,2,133,219,128
        DB 39,134,11,129,59,128,7,0,4,137,71,133,99,141,43,141
        DB 67,133,35,129,103,145,35,128,7,0,3,140,243,170,223,129
        DB 143,129,7,1,233,12,134,19,0,4,140,79,1,3,68,128
        DB 231,137,75,0,140,172,99,128,167,128,255,135,251,128,215,1
        DB 3,209,128,7,128,199,1,3,15,128,91,133,55,145,255,133
        DB 11,129,59,128,7,0,4,137,71,133,99,141,43,141,67,133
        DB 35,129,103,145,35,128,7,0,3,129,243,0,0,128,0
FX_START:
        DB 197,15,15,1,187,15,15,1,178,15,14,1,168,15,14,1
        DB 159,15,13,1,150,15,13,1,140,15,12,1,131,15,12,1
        DB 197,15,11,1,187,15,11,1,178,15,10,1,168,15,10,1
        DB 159,15,9,1,150,15,9,1,140,15,8,1,131,15,8,1
        DB 197,15,7,1,187,15,7,1,178,15,6,1,168,15,6,1
        DB 159,15,5,1,150,15,5,1,140,15,4,1,0,0,0,0
FX_WALL:
        DB 75,15,12,1,84,15,10,1,215,14,8,1,118,15,5,1
        DB 37,15,2,1,0,0,0,0
FX_LIGHT:
        DB 54,8,15,1,186,8,15,1,61,9,15,1,192,9,14,1
        DB 67,10,14,1,198,10,14,1,74,11,13,1,205,11,13,1
        DB 80,12,13,1,212,12,12,1,87,13,12,1,218,13,12,1
        DB 93,14,11,1,224,14,11,1,100,15,11,1,0,0,0,0
FX_LOSE:
        DB 30,11,15,4,21,11,15,4,11,11,15,4,2,11,15,4
        DB 248,10,14,4,2,11,14,4,11,11,14,4,21,11,14,4
        DB 30,11,13,4,21,11,13,4,11,11,13,4,2,11,13,4
        DB 248,10,12,4,2,11,12,4,11,11,12,4,21,11,12,4
        DB 30,11,11,4,21,11,11,4,11,11,11,4,2,11,11,4
        DB 248,10,10,4,2,11,10,4,11,11,10,4,21,11,10,4
        DB 30,11,9,4,21,11,9,4,11,11,9,4,2,11,9,4
        DB 248,10,8,4,2,11,8,4,11,11,8,4,21,11,8,4
        DB 30,11,7,4,21,11,7,4,11,11,7,4,2,11,7,4
        DB 248,10,6,4,2,11,6,4,11,11,6,4,21,11,6,4
        DB 30,11,5,4,21,11,5,4,11,11,5,4,2,11,5,4
        DB 248,10,4,4,2,11,4,4,11,11,4,4,21,11,4,4
        DB 30,11,3,4,21,11,3,4,11,11,3,4,2,11,3,4
        DB 248,10,2,4,2,11,2,4,11,11,2,4,21,11,2,4
        DB 30,11,1,4,21,11,1,4,11,11,1,4,2,11,1,4
        DB 248,10,0,4,2,11,0,4,11,11,0,2,0,0,0,0
FX_WIN:
        DB 136,12,12,9,65,13,12,9,174,13,12,9,68,14,12,9
        DB 174,13,12,9,68,14,12,9,159,14,12,9,215,14,12,9
        DB 68,14,12,9,0,0,0,0
MENU_DATA:
        DB 0,0,206,0,1,35,136,173,24,139,0,1,16,192,148,24
        DB 0,240,164,128,148,39,1,48,224,163,62,0,48,148,128,1
        DB 224,48,163,63,2,96,175,232,146,23,2,227,190,128,162,63
        DB 2,83,95,76,146,23,1,95,95,163,63,2,99,235,140,146
        DB 23,1,173,235,163,63,2,19,240,78,146,23,2,124,211,8
        DB 162,63,1,35,248,147,127,2,52,227,136,162,63,2,112,214
        DB 160,145,22,3,16,241,120,192,162,63,2,240,240,180,146,63
        DB 2,188,240,224,162,63,2,198,214,87,145,22,3,17,125,104
        DB 108,162,63,2,39,233,174,146,23,2,175,133,132,162,63,2
        DB 70,240,128,146,23,2,112,224,76,162,63,2,48,176,192,146
        DB 23,1,240,240,162,62,3,0,18,93,198,146,23,2,95,117
        DB 8,163,64,255,0,255,0,255,0,239,0,5,35,0,4,35
        DB 0,140,129,8,6,171,174,35,136,174,0,0,128,2,1,0
        DB 39,128,3,0,1,129,20,130,0,0,175,129,4,2,1,140
        DB 35,131,27,140,0,5,87,0,70,19,17,78,129,8,7,25
        DB 27,87,8,78,0,17,27,130,20,128,0,0,76,133,34,0
        DB 70,129,4,0,17,129,14,130,9,139,0,11,39,0,39,35
        DB 1,175,35,136,0,140,141,171,128,2,128,143,128,136,0,39
        DB 128,2,4,136,140,39,136,0,128,8,12,0,0,38,39,137
        DB 171,39,137,174,39,1,174,38,134,147,134,0,26,95,95,95
        DB 27,19,95,27,8,0,76,93,78,76,93,27,0,19,0,70
        DB 93,27,87,17,95,70,76,76,128,109,2,70,93,95,128,4
        DB 128,17,4,70,17,76,19,17,128,160,142,63,0,175,128,0
        DB 0,174,129,86,5,140,141,136,175,141,175,128,127,7,38,141
        DB 171,39,1,136,38,140,129,127,5,38,141,136,0,35,38,129
        DB 17,5,137,140,35,1,136,39,145,255,5,87,87,76,76,19
        DB 8,128,255,3,8,93,25,27,128,255,129,127,1,93,8,128
        DB 127,1,0,76,128,127,2,8,0,19,128,127,3,95,0,93
        DB 95,147,127,0,39,128,222,1,136,140,128,255,3,35,171,140
        DB 39,128,255,4,0,174,35,137,171,129,11,128,240,129,255,2
        DB 140,0,1,128,136,3,35,39,136,174,128,17,130,168,139,0
        DB 3,19,0,68,19,128,104,155,0,1,17,78,156,32,255,0
        DB 255,0,255,0,244,0,0,48,130,5,11,175,0,174,0,35
        DB 136,35,0,0,35,137,140,131,23,1,35,136,129,5,3,39
        DB 140,0,39,130,8,0,0,128,32,146,0,1,96,192,129,5
        DB 0,70,128,3,2,17,8,19,128,8,1,93,76,131,23,0
        DB 87,130,7,1,70,76,129,2,130,0,129,34,144,0,1,240
        DB 192,129,106,5,38,0,174,35,141,174,128,106,4,38,1,174
        DB 39,171,129,8,3,39,1,174,175,129,23,130,17,3,137,174
        DB 175,137,129,20,145,63,3,224,0,19,8,128,92,3,78,70
        DB 93,95,128,127,5,19,25,76,70,93,27,128,115,2,87,17
        DB 27,128,130,5,87,8,0,87,25,27,129,17,1,95,70,147
        DB 128,128,63,128,0,5,38,4,174,38,141,171,128,255,2,0
        DB 141,140,128,8,129,246,1,1,171,128,124,1,0,140,128,17
        DB 1,175,38,128,11,1,175,38,148,127,0,192,130,127,5,76
        DB 78,19,93,27,19,128,237,1,93,95,129,109,128,255,0,17
        DB 129,5,129,255,1,93,8,131,127,1,0,76,145,63,0,96
        DB 130,255,5,175,140,174,0,175,171,128,8,1,35,136,128,237
        DB 0,171,132,255,1,0,0,129,8,128,249,0,137,128,157,0
        DB 175,147,127,0,48,133,8,128,234,255,0,255,0,255,0,255
        DB 0,169,0,1,112,128,130,6,4,35,140,0,35,136,129,7
        DB 5,136,0,39,35,136,35,129,9,4,175,0,0,140,39,159
        DB 63,0,192,130,6,1,17,8,129,2,130,0,3,87,17,8
        DB 19,129,17,0,27,129,11,158,63,1,240,224,130,120,10,1
        DB 136,39,137,174,38,175,174,35,171,174,128,8,9,39,1,174
        DB 0,1,140,140,141,140,39,129,147,157,63,0,19,128,120,13
        DB 17,8,17,25,27,70,93,95,19,25,27,87,17,95,130,142
        DB 3,76,87,8,76,159,127,1,224,224,130,6,14,1,137,39
        DB 137,171,38,141,136,35,137,171,39,1,171,0,130,127,0,39
        DB 161,255,133,127,6,27,93,25,27,19,93,8,129,127,0,93
        DB 128,249,0,19,128,17,129,127,0,76,158,127,0,192,130,255
        DB 7,35,175,39,175,174,0,175,140,128,127,1,35,171,130,127
        DB 4,35,175,140,141,174,129,26,158,127,134,0,0,87,128,136
        DB 255,0,255,0,255,0,255,0,153,0,1,112,128,128,4,1
        DB 224,48,144,25,6,224,0,16,192,96,0,192,133,14,128,8
        DB 134,11,136,0,0,96,129,20,0,96,144,24,1,16,176,128
        DB 48,145,24,139,0,9,192,48,48,96,208,224,48,16,224,240
        DB 128,136,1,16,192,128,54,14,48,144,176,240,128,240,0,48
        DB 0,48,128,192,112,144,192,128,160,129,5,0,208,130,11,1
        DB 48,224,143,63,6,176,96,240,96,48,16,176,132,136,128,8
        DB 0,208,129,2,128,63,1,96,192,129,191,128,23,2,240,192
        DB 96,129,11,3,192,192,16,144,128,148,139,0,1,208,240,136
        DB 63,0,16,128,243,135,63,0,112,131,63,4,0,0,224,208
        DB 224,131,75,0,112,143,63,3,96,240,240,112,132,63,2,192
        DB 0,48,128,44,0,240,129,63,1,192,240,129,72,129,124,129
        DB 127,2,224,240,96,129,75,5,192,192,208,144,176,48,140,63
        DB 4,112,208,224,0,208,128,243,129,97,128,51,7,0,0,48
        DB 48,128,240,96,192,128,38,0,224,128,20,128,2,128,255,0
        DB 192,128,142,2,208,224,112,128,35,128,41,141,128,128,66,0
        DB 128,130,6,0,16,130,6,128,194,134,5,143,35,128,175,143
        DB 63,2,0,0,128,132,60,2,0,0,32,130,5,130,100,129
        DB 17,0,112,129,12,128,8,136,78,133,41,162,63,129,8,128
        DB 26,129,215,148,63,5,192,208,224,240,144,224,128,176,128,161
        DB 128,109,6,112,128,224,112,176,224,48,128,112,1,16,224,128
        DB 120,0,48,128,23,1,144,176,128,51,128,20,128,17,134,41
        DB 135,0,4,224,208,176,96,192,129,127,1,96,192,129,90,6
        DB 32,16,176,240,208,176,48,129,112,129,17,128,8,1,96,208
        DB 128,51,2,192,96,208,128,69,128,11,129,75,128,23,137,63
        DB 0,240,134,63,128,88,2,32,16,240,128,81,2,48,16,240
        DB 136,63,129,88,1,96,208,129,197,0,96,128,23,140,63,1
        DB 240,208,128,15,130,91,1,192,0,128,35,6,32,208,128,224
        DB 208,224,48,129,228,129,17,133,127,134,63,130,5,137,63,5
        DB 112,144,224,96,192,224,128,135,128,124,129,48,4,128,224,192
        DB 208,128,128,5,128,17,128,255,128,29,1,112,176,128,93,2
        DB 192,112,176,128,57,2,224,224,16,132,41,154,0,128,55,170
        DB 0,128,83,132,0,2,16,128,48,135,19,129,165,130,14,128
        DB 158,4,192,112,0,192,96,149,63,135,24,129,246,131,0,0
        DB 176,140,32,128,72,147,63,2,112,144,192,129,255,0,16,128
        DB 250,0,224,128,237,4,48,0,224,240,128,128,193,128,72,4
        DB 192,240,144,176,112,129,20,0,192,128,2,1,48,16,128,5
        DB 138,84,132,0,2,240,192,96,130,24,7,96,0,16,176,96
        DB 208,128,48,128,5,3,192,0,96,208,128,188,3,192,96,208
        DB 176,130,14,128,96,1,192,48,128,14,0,16,145,63,7,224
        DB 208,224,112,16,240,0,16,128,130,136,63,0,192,129,127,132
        DB 63,128,8,153,63,0,240,128,127,128,177,128,127,0,224,133
        DB 112,134,63,0,224,138,127,2,208,240,48,143,63,3,192,208
        DB 176,224,129,255,9,176,0,16,128,112,128,224,48,128,224,128
        DB 63,1,48,144,128,191,128,8,129,243,5,112,144,224,240,144
        DB 224,128,5,2,48,128,48,144,63,135,0,0,48,128,115,154
        DB 0,128,227,143,0,3,240,128,0,96,128,133,128,111,0,16
        DB 128,164,130,209,0,0,128,12,129,153,128,3,0,112,133,38
        DB 128,35,128,160,130,29,132,108,132,139,129,237,128,69,129,44
        DB 131,54,130,42,134,147,142,63,132,29,130,11,130,24,12,208
        DB 176,112,128,0,240,208,224,240,128,192,112,48,129,93,2,112
        DB 128,192,128,202,128,14,1,96,208,130,145,1,48,48,128,23
        DB 128,255,128,191,128,41,3,112,144,192,240,131,11,131,206,2
        DB 112,144,176,129,127,7,208,176,96,192,192,48,16,176,130,145
        DB 0,192,128,17,129,5,1,192,96,130,63,1,176,16,128,35
        DB 128,112,1,16,128,129,172,10,192,96,96,240,240,0,16,176
        DB 48,48,240,132,127,128,45,4,224,208,240,96,0,135,63,128
        DB 127,128,14,2,96,208,224,131,63,129,99,128,109,131,63,4
        DB 208,224,96,48,176,130,63,129,44,130,63,4,192,0,192,208
        DB 128,131,63,128,48,128,63,0,0,128,39,128,14,0,176,128
        DB 127,4,192,0,48,240,208,128,63,128,202,0,16,129,41,2
        DB 96,240,96,138,63,2,240,144,240,128,109,3,192,208,224,224
        DB 128,210,0,144,129,63,1,224,192,129,231,2,224,0,224,128
        DB 78,2,112,128,192,128,234,128,99,0,48,128,243,0,0,130
        DB 23,4,208,176,224,48,48,129,148,129,43,142,0,0,32,140
        DB 15,128,246,160,0,128,91,129,0,2,112,16,192,130,7,131
        DB 51,132,57,2,96,48,128,129,104,131,72,132,32,141,0,0
        DB 96,131,6,129,237,143,63,132,57,131,14,143,63,2,16,192
        DB 240,128,219,1,16,224,128,5,129,63,128,97,128,11,3,128
        DB 224,112,16,130,20,3,128,0,112,144,132,11,128,8,3,240
        DB 128,192,112,142,208,3,96,96,240,96,128,94,2,96,208,176
        DB 130,127,128,139,129,11,7,16,128,128,0,16,176,96,192,128
        DB 127,1,176,48,128,124,128,32,4,240,240,96,192,192,128,17
        DB 140,127,0,224,130,63,3,224,96,208,240,130,127,0,224,129
        DB 63,2,16,240,112,138,63,128,127,2,128,112,240,128,14,1
        DB 192,112,141,63,0,48,130,127,4,0,48,112,144,128,129,63
        DB 0,48,128,11,0,176,128,243,2,208,128,176,132,63,129,151
        DB 0,48,129,11,5,48,176,112,128,192,96,129,163,138,127,0
        DB 176,128,33,129,127,130,225,128,14,7,0,0,224,224,0,224
        DB 96,192,129,243,128,63,2,48,176,176,129,23,4,0,224,112
        DB 176,48,129,35,0,128,141,128,132,0,128,34,158,0,129,35
        DB 1,16,128,140,191,128,182,129,24,128,183,139,71,1,192,32
        DB 128,28,139,23,132,38,0,48,131,66,131,41,130,79,128,21
        DB 133,39,128,191,132,0,128,63,131,26,134,7,132,38,132,130
        DB 130,25,3,192,208,224,112,128,219,11,128,0,112,176,224,112
        DB 48,224,48,128,128,48,128,8,0,128,128,91,0,192,129,20
        DB 1,48,224,129,252,2,16,192,0,128,249,4,48,224,96,192
        DB 0,128,14,131,17,0,240,128,5,129,132,4,208,176,48,16
        DB 176,128,24,13,96,16,176,16,144,176,96,16,192,96,208,176
        DB 240,208,128,97,130,191,128,26,0,16,128,145,3,96,0,48
        DB 96,128,29,128,81,128,14,1,240,208,129,17,1,96,240,130
        DB 127,130,63,0,128,130,63,3,128,112,144,176,128,127,4,96
        DB 208,128,224,192,129,127,135,63,1,16,224,128,63,3,112,144
        DB 128,112,128,55,1,16,176,128,50,128,17,132,63,128,76,132
        DB 127,6,208,128,208,144,176,0,192,131,63,0,48,129,63,0
        DB 192,130,63,128,45,0,48,129,127,0,208,128,63,128,127,0
        DB 208,130,63,0,48,133,127,1,112,176,128,149,1,224,224,128
        DB 42,0,176,128,57,3,176,112,144,192,128,8,1,192,208,128
        DB 127,1,224,48,128,255,128,145,129,237,128,112,2,176,96,240
        DB 128,87,0,0,128,14,1,192,240,129,17,129,87,198,0,128
        DB 234,2,0,16,128,133,13,0,192,128,121,2,224,0,192,128
        DB 9,128,8,129,0,0,16,129,11,128,23,129,17,160,63,129
        DB 10,130,220,1,0,96,131,56,130,57,131,0,142,63,5,48
        DB 48,112,48,224,112,129,228,1,224,112,128,240,4,16,176,48
        DB 128,192,129,8,130,5,0,96,131,26,10,0,192,112,144,192
        DB 96,208,192,240,144,240,143,63,4,176,16,144,176,32,128,113
        DB 1,16,128,128,109,128,11,3,96,192,192,208,128,57,3,192
        DB 192,240,192,129,78,2,96,240,240,128,63,2,96,192,96,128
        DB 17,2,96,208,176,144,63,0,112,129,63,128,127,129,63,128
        DB 11,134,63,3,224,192,0,96,128,20,1,240,176,129,127,1
        DB 208,224,149,63,1,240,208,128,63,2,192,48,0,128,106,3
        DB 192,0,208,128,129,39,143,63,2,96,48,96,128,209,1,96
        DB 208,128,139,140,0,1,16,224,129,85,129,228,129,255,128,54
        DB 0,48,129,66,1,0,224,128,62,128,142,2,48,128,112,128
        DB 114,1,16,224,128,151,0,48,128,41,1,192,48,142,127,170
        DB 0,128,230,140,0,0,112,128,101,129,0,131,5,130,208,133
        DB 8,0,32,131,14,2,128,0,112,139,32,0,96,138,254,0
        DB 64,150,108,131,63,1,16,128,135,81,145,63,5,16,192,112
        DB 128,224,0,129,5,15,0,240,144,176,240,176,224,48,48,224
        DB 48,192,0,48,144,176,128,17,2,112,48,224,128,5,10,48
        DB 16,176,112,144,192,240,144,224,96,208,128,41,3,224,112,144
        DB 224,128,11,128,23,131,173,3,192,240,208,176,128,158,128,85
        DB 2,96,208,176,128,2,128,45,1,96,192,129,11,128,127,3
        DB 16,144,176,208,130,63,2,240,192,192,130,29,0,128,128,143
        DB 0,96,128,32,128,11,133,237,3,192,224,208,240,128,63,128
        DB 79,131,24,137,63,0,112,133,63,0,224,132,63,129,127,130
        DB 38,0,240,135,127,0,224,128,34,1,0,192,128,1,134,63
        DB 128,191,129,63,2,192,0,208,140,63,1,192,48,128,49,132
        DB 136,0,192,130,63,128,204,1,192,192,130,213,4,128,0,224
        DB 16,240,129,63,1,144,176,128,27,3,48,128,240,48,128,145
        DB 129,51,128,35,2,240,192,208,129,252,0,112,130,127,1,48
        DB 144,130,11,131,127,146,0,153,27,155,0,0,32,128,116,130
        DB 212,128,168,0,224,140,84,129,24,2,128,0,16,128,183,131
        DB 186,146,63,0,16,131,122,129,63,0,96,139,26,128,17,0
        DB 0,129,29,139,63,1,112,176,128,210,129,243,11,240,128,0
        DB 240,144,192,112,144,224,0,48,48,131,127,129,11,2,16,176
        DB 112,130,26,128,38,2,48,16,176,128,252,4,112,128,192,240
        DB 128,136,63,1,96,208,128,21,0,176,128,5,6,96,192,0
        DB 96,192,96,32,128,36,1,48,176,131,63,138,26,1,208,176
        DB 130,63,128,11,0,192,128,2,145,63,129,11,0,224,139,63
        DB 0,240,136,26,132,63,0,112,144,63,1,0,240,131,36,3
        DB 112,176,96,32,128,14,1,48,240,133,63,2,128,0,16,132
        DB 26,130,63,130,78,3,0,192,112,128,135,62,128,228,128,63
        DB 4,48,48,144,240,224,128,36,3,16,176,48,176,129,228,1
        DB 48,128,128,2,1,0,240,128,255,2,0,48,112,130,26,128
        DB 38,2,112,128,48,128,154,2,112,144,224,128,66,136,64,128
        DB 0,0,16,128,32,129,0,132,6,145,26,150,38,3,96,192
        DB 0,112,133,27,1,48,128,131,88,132,159,0,32,131,32,130
        DB 5,128,206,135,59,0,16,136,192,128,63,129,27,0,16,128
        DB 197,134,23,144,63,134,46,142,63,4,208,224,48,48,224,128
        DB 67,1,192,208,128,219,3,192,48,176,224,130,255,5,0,48
        DB 192,224,112,128,131,246,129,38,0,112,128,35,5,16,224,240
        DB 144,224,112,130,32,131,20,130,24,2,208,176,48,128,124,9
        DB 48,0,224,208,176,208,128,192,96,208,128,136,0,128,128,148
        DB 128,8,128,127,128,5,132,191,128,35,4,16,176,96,240,96
        DB 129,32,0,16,129,32,134,127,0,240,130,63,0,112,142,63
        DB 0,240,144,63,4,48,96,112,208,128,140,63,2,128,48,16
        DB 128,146,3,176,240,208,240,133,63,0,176,128,30,3,48,208
        DB 128,32,130,133,129,11,136,63,0,96,128,252,128,8,136,63
        DB 2,224,112,144,128,18,3,240,112,128,48,128,11,1,48,144
        DB 128,63,129,255,1,0,192,129,5,2,112,144,240,128,5,128
        DB 63,0,112,128,23,6,16,224,224,16,176,112,176,128,27,136
        DB 255,130,156,130,13,128,133,136,0,137,33,131,194,152,0,0
        DB 128,128,97,135,72,0,0,134,156,129,121,130,90,132,32,132
        DB 14,143,63,132,7,128,219,146,0,133,23,144,63,8,112,144
        DB 224,240,144,224,48,48,224,128,252,128,194,8,240,128,224,192
        DB 192,192,240,128,240,128,11,3,112,16,240,112,128,212,1,48
        DB 224,128,35,128,8,129,38,143,63,8,96,208,176,96,192,128
        DB 48,16,176,128,8,0,0,130,5,128,64,129,11,4,48,240
        DB 16,144,176,128,23,130,20,131,32,133,230,138,63,128,24,132
        DB 63,128,115,3,176,96,16,240,133,63,1,176,112,129,63,0
        DB 128,136,63,150,127,129,103,128,36,130,63,1,128,240,128,63
        DB 1,192,240,128,63,2,208,144,240,130,127,128,218,130,32,0
        DB 192,144,62,129,255,6,96,192,224,48,144,176,112,128,255,6
        DB 48,224,224,0,224,112,128,128,17,3,48,0,48,48,128,5
        DB 128,29,2,0,16,128,128,17,129,38,146,127,147,0,1,16
        DB 224,135,5,1,48,128,153,41,3,48,0,224,96,131,8,3
        DB 128,0,192,192,136,23,2,48,128,32,133,57,130,70,134,0
        DB 3,192,112,16,192,135,84,2,112,144,176,131,63,3,112,128
        DB 0,240,137,63,3,16,128,32,16,132,36,131,32,136,114,0
        DB 192,128,212,132,12,1,96,208,129,222,1,240,128,130,63,4
        DB 208,192,112,192,224,129,136,4,208,192,48,16,176,128,243,0
        DB 240,129,246,0,240,128,26,130,41,2,224,96,192,130,26,129
        DB 63,0,224,131,20,128,21,3,192,96,16,176,128,24,0,208
        DB 129,127,1,96,80,130,142,6,224,192,96,48,16,224,32,128
        DB 23,0,208,130,2,130,151,131,8,1,224,192,131,63,132,20
        DB 6,0,112,208,128,96,16,240,128,51,128,188,5,224,208,224
        DB 48,16,240,128,127,130,8,0,192,129,63,131,66,145,63,0
        DB 112,131,63,128,191,129,2,0,0,129,209,4,192,240,96,32
        DB 80,128,6,2,0,240,240,130,127,128,48,129,63,0,240,128
        DB 54,0,48,129,105,129,63,0,240,134,127,133,255,7,192,48
        DB 128,224,224,0,0,48,129,219,128,85,129,216,4,112,144,176
        DB 48,176,129,2,0,224,128,231,2,192,48,224,130,63,1,0
        DB 208,128,11,128,26,0,224,128,2,1,0,48,133,255,159,0
        DB 0,16,128,92,0,0,128,109,150,48,131,137,128,246,128,195
        DB 128,155,129,106,132,5,130,20,133,0,131,17,129,169,0,16
        DB 128,178,129,35,138,63,128,255,130,3,132,63,132,26,133,35
        DB 139,108,0,192,129,40,131,35,128,234,129,240,130,207,128,216
        DB 131,127,0,112,128,5,1,16,176,128,100,3,96,16,224,240
        DB 128,23,4,16,224,112,16,240,129,35,129,255,0,176,128,29
        DB 128,41,132,63,2,96,208,176,128,82,3,16,144,176,208,129
        DB 45,132,191,1,16,128,129,63,128,124,0,112,130,5,5,16
        DB 176,240,16,144,96,131,17,128,47,128,35,1,208,144,129,169
        DB 135,63,128,85,128,63,1,112,144,132,63,0,112,130,63,128
        DB 109,0,96,128,51,128,14,0,176,128,163,132,81,133,63,137
        DB 127,2,192,0,208,130,63,0,0,130,27,128,63,0,208,128
        DB 45,1,0,224,128,57,131,63,2,208,176,176,128,32,132,81
        DB 131,63,128,104,131,0,2,112,144,240,129,231,130,69,3,112
        DB 128,224,48,129,2,2,0,96,192,128,5,0,192,128,8,128
        DB 249,128,104,5,96,240,48,96,208,240,128,163,128,114,1,240
        DB 144,128,8,2,224,96,208,133,127,170,0,0,112,128,163,255
        DB 0,255,0,255,0,255,0,147,0,1,175,136,132,8,9,35
        DB 171,174,35,137,174,175,140,0,35,130,17,7,39,137,175,35
        DB 35,174,39,140,157,63,1,70,76,133,8,4,93,27,19,25
        DB 27,128,14,0,87,130,17,5,70,93,95,87,25,27,131,11
        DB 153,0,4,38,175,174,35,136,128,2,7,0,38,1,171,38
        DB 175,0,39,128,121,1,1,174,128,148,6,38,0,140,38,141
        DB 171,35,158,191,15,87,25,95,70,93,8,70,0,0,19,25
        DB 78,70,95,0,87,128,17,0,17,129,118,6,87,8,76,70
        DB 93,78,19,158,63,4,38,1,136,39,140,129,127,3,0,141
        DB 136,39,132,127,1,171,38,128,24,4,140,140,39,141,174,159
        DB 127,1,70,17,128,124,2,19,0,76,128,240,2,8,70,93
        DB 130,255,1,17,27,128,142,1,70,76,128,127,0,27,159,127
        DB 10,175,35,140,35,137,174,39,136,0,35,171,128,240,2,174
        DB 175,140,130,255,128,133,4,137,174,38,175,171,128,23,255,0
        DB 255,0,135,0
TITLE_DATA:
        DB 48,16,32,48,16,192,48,32,32,0,16,32,48,16,224,112
        DB 128,0,64,144,32,48,16,32,64,160,32,0,16,224,48,0
        DB 32,64,0,0,64,16,32,48,16,32,64,160,160,0,16,224
        DB 48,0,64,64,0,0,48,144,224,64,144,32,64,176,96,0
        DB 16,224,64,128,64,112,128,0,0,144,32,64,144,32,64,144
        DB 64,0,16,224,64,128,128,64,0,0,64,144,32,112,144,32
        DB 64,144,64,0,16,32,112,144,0,64,0,0,48,16,32,64
        DB 144,192,48,16,64,0,16,32,64,144,224,112,128,0,0,0
        DB 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
        DB 16,128,144,16,128,224,16,144,16,0,0,144,16,128,240,48
        DB 192,0,32,64,144,16,128,144,32,80,16,0,0,240,16,128
        DB 16,32,0,0,32,0,144,16,128,144,32,80,80,0,0,240
        DB 16,128,32,32,0,0,16,192,240,32,64,144,32,80,176,0
        DB 0,240,32,64,32,48,192,0,0,64,144,32,64,144,32,64
        DB 160,0,0,240,32,64,64,32,0,0,32,64,144,48,192,144
        DB 32,64,160,0,0,144,48,192,128,32,0,0,16,128,144,32
        DB 64,224,16,128,160,0,0,144,32,64,240,48,192,0,0,0
        DB 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
        DB 0,192,64,128,192,112,0,192,128,128,0,64,128,192,112,144
        DB 224,0,16,32,64,128,192,64,144,32,128,128,0,112,128,192
        DB 0,144,0,0,16,0,64,128,192,64,144,32,160,128,0,112
        DB 128,192,16,16,0,0,0,224,112,144,32,64,144,32,208,128
        DB 0,112,144,32,16,16,224,0,0,32,64,144,32,64,144,32
        DB 80,0,0,112,144,32,32,16,0,0,16,32,64,144,224,64
        DB 144,32,80,0,0,64,144,224,64,16,0,0,0,192,64,144
        DB 32,112,0,192,80,0,0,64,144,32,112,144,224,0,0,0
        DB 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
        DB 0,96,32,64,96,48,128,96,64,64,0,32,64,96,48,192
        DB 240,0,0,144,32,64,96,32,64,144,64,64,0,48,192,96
        DB 0,64,128,0,0,128,32,64,96,32,64,144,80,64,0,48
        DB 192,96,0,128,128,0,0,112,48,192,144,32,64,144,96,192
        DB 0,48,192,144,0,128,240,0,0,16,32,64,144,32,64,144
        DB 32,128,0,48,192,144,16,0,128,0,0,144,32,64,240,32
        DB 64,144,32,128,0,32,64,240,32,0,128,0,0,96,32,64
        DB 144,48,128,96,32,128,0,32,64,144,48,192,240,0,0,0
        DB 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
COVER_DATA:
        DB 0,0,131,0,1,144,96,129,1,14,249,246,249,230,153,246
        DB 121,150,109,158,75,150,165,30,15,133,0,19,30,105,180,105
        DB 242,240,246,249,240,248,244,249,240,208,240,240,64,0,112,176
        DB 132,55,132,0,20,16,96,144,100,153,98,145,246,233,214,249
        DB 246,105,158,107,190,47,143,15,150,45,134,63,2,15,150,105
        DB 128,1,1,241,246,128,94,11,246,177,240,240,240,128,32,112
        DB 224,128,32,128,136,63,0,32,128,64,128,1,17,185,68,0
        DB 102,136,18,128,150,104,18,120,0,0,150,15,128,3,44,128
        DB 1,128,127,10,72,18,72,50,249,128,241,192,0,0,64,128
        DB 43,1,208,96,128,3,142,127,0,102,128,129,13,246,72,0
        DB 113,196,35,128,111,172,3,150,0,0,75,134,63,19,15,132
        DB 33,132,33,182,128,246,200,0,0,100,0,0,48,224,144,32
        DB 48,112,139,127,132,255,16,153,128,232,34,136,50,128,150,72
        DB 0,105,192,64,18,44,18,1,133,127,13,16,128,50,232,0
        DB 49,192,112,192,16,128,208,48,176,128,255,0,144,143,255,0
        DB 152,128,255,13,128,228,49,196,33,128,107,200,0,30,72,4
        DB 33,164,133,63,18,15,132,1,128,49,164,0,50,200,118,72
        DB 114,128,240,176,224,144,0,16,140,255,132,127,3,185,0,249
        DB 230,129,255,9,1,132,33,192,112,16,72,7,72,36,132,127
        DB 128,181,9,200,54,17,208,248,0,240,128,216,96,129,255,2
        DB 144,64,16,145,255,2,128,214,249,128,255,7,126,16,76,19
        DB 72,22,1,192,133,63,3,15,132,0,0,129,80,6,89,228
        DB 16,246,128,208,240,129,255,2,240,128,0,129,1,140,127,3
        DB 152,196,0,102,128,20,136,127,1,18,32,133,127,10,192,54
        DB 17,244,128,50,176,128,16,240,144,130,127,0,0,129,1,136
        DB 62,14,100,152,96,145,246,200,0,113,196,0,0,126,16,12
        DB 3,128,127,134,63,129,127,0,49,128,80,3,240,64,49,246
        DB 128,63,128,127,0,80,130,127,143,255,2,118,232,34,129,255
        DB 131,174,129,63,1,0,0,130,127,3,32,64,50,200,128,228
        DB 2,128,96,112,128,255,2,144,96,128,131,127,138,62,7,114
        DB 144,102,153,246,249,164,49,128,255,3,124,0,0,18,132,127
        DB 130,63,11,15,132,32,4,33,192,0,0,241,128,232,118,138
        DB 255,138,192,129,255,3,128,168,34,192,128,127,129,255,9,64
        DB 3,44,18,1,44,0,72,3,7,128,127,8,18,192,50,200
        DB 96,16,96,48,192,128,127,0,176,132,255,137,0,20,16,96
        DB 144,116,153,102,145,246,128,228,49,68,35,128,122,17,76,19
        DB 72,4,33,132,63,129,127,1,33,132,128,58,11,16,232,50
        DB 200,118,128,240,176,224,144,64,16,131,127,142,255,2,68,0
        DB 118,129,255,13,1,132,48,0,0,150,15,128,3,44,3,44
        DB 1,22,128,127,5,48,200,48,192,118,16,128,194,5,96,0
        DB 0,32,208,64,145,127,1,114,176,128,255,2,200,0,113,129
        DB 255,5,1,76,18,0,0,75,131,63,3,3,45,15,45,132
        DB 127,9,200,0,0,100,0,0,48,224,144,96,148,127,6,144
        DB 246,185,102,152,150,105,132,1,0,75,128,185,18,15,14,9
        DB 30,15,30,105,180,248,240,241,240,144,112,208,240,240,246,216
        DB 128,62,132,127,136,131,18,96,144,112,145,230,145,246,249,246
        DB 249,230,239,158,105,150,47,31,105,30,130,62,13,15,15,6
        DB 13,135,15,150,165,244,241,214,249,224,241,128,31,2,248,240
        DB 240,150,127,6,100,185,102,217,230,152,214,133,127,28,45,135
        DB 9,15,45,150,9,6,75,30,105,242,240,244,241,224,224,112
        DB 176,112,240,242,216,96,208,96,128,32,208,143,127,1,176,102
        DB 130,127,12,246,235,158,109,158,75,158,107,150,75,44,74,135
        DB 128,127,10,44,26,7,45,150,105,244,249,214,240,228,129,127
        DB 2,249,240,240,128,106,0,48,147,255,3,217,246,185,98,132
        DB 127,128,5,22,24,6,65,30,105,150,72,6,105,30,120,180
        DB 120,180,240,240,176,96,208,240,241,240,216,128,39,2,0,32
        DB 176,139,127,0,16,128,127,2,209,226,144,130,255,1,233,159
        DB 128,62,21,30,107,150,105,195,28,3,15,14,75,44,67,67
        DB 45,150,121,246,248,246,241,242,113,134,255,148,127,3,249,102
        DB 216,102,132,127,15,210,105,150,161,164,161,30,120,150,8,18
        DB 41,150,121,182,105,128,54,0,208,129,255,130,127,143,255,6
        DB 224,144,242,241,102,152,182,129,127,1,151,111,130,64,128,1
        DB 7,88,82,105,30,225,104,3,135,128,127,5,180,248,150,241
        DB 246,177,130,255,0,208,128,127,0,16,130,127,1,144,32,133
        DB 62,1,32,80,131,127,5,246,153,98,144,210,121,132,127,7
        DB 60,64,225,135,105,96,8,33,128,127,3,244,248,240,248,138
        DB 255,0,240,144,255,1,246,144,130,127,0,233,130,123,19,107
        DB 150,75,60,144,150,45,30,144,164,16,30,45,150,105,244,240
        DB 30,241,242,129,127,1,248,240,130,234,129,127,0,16,128,246
        DB 132,63,0,64,129,20,0,208,128,127,1,216,228,132,255,129
        DB 190,6,96,176,135,105,224,72,0,128,11,6,242,240,242,248
        DB 224,208,96,129,255,0,248,129,255,0,0,130,255,0,128,132
        DB 61,0,128,129,127,1,242,184,132,255,23,227,150,109,150,105
        DB 158,105,150,15,104,176,225,105,94,208,224,16,150,45,150,249
        DB 180,249,62,131,255,2,248,244,176,130,127,5,0,32,128,64
        DB 144,32,133,127,0,0,128,18,7,112,144,96,216,244,217,98
        DB 144,133,127,1,135,88,128,38,9,91,224,128,0,225,150,248
        DB 242,248,244,129,255,4,144,240,248,240,208,129,255,1,0,240
        DB 129,244,133,60,130,127,2,112,217,246,130,127,1,102,229,128
        DB 123,132,127,12,180,240,210,208,96,16,82,105,180,233,246,240
        DB 126,131,127,3,241,224,144,240,128,108,128,86,1,144,0,128
        DB 129,128,74,5,0,0,32,0,0,80,129,148,128,255,3,248
        DB 228,153,82,134,127,11,112,75,240,240,224,128,32,33,182,248
        DB 240,249,128,121,1,240,240,133,255,0,144,129,127,0,64,128
        DB 1,130,0,128,199,128,127,1,240,184,131,127,1,246,231,128
        DB 255,8,121,151,109,150,75,224,240,135,120,128,64,6,16,112
        DB 105,180,249,182,105,128,27,6,145,242,249,244,248,224,176,129
        DB 127,4,164,128,32,16,32,128,255,130,66,128,127,129,125,6
        DB 144,96,245,246,249,98,144,134,127,128,109,7,60,240,96,200
        DB 32,144,242,120,128,127,128,74,129,255,0,224,129,39,2,128
        DB 0,208,128,53,0,16,132,127,0,32,130,60,9,112,249,246
        DB 152,54,249,214,249,102,235,128,251,1,75,195,128,3,128,123
        DB 20,244,240,240,164,16,112,241,180,249,214,233,188,249,246,177
        DB 226,249,246,208,96,240,130,127,128,181,0,96,128,127,130,255
        DB 128,79,128,192,8,96,208,96,249,242,248,244,152,86,132,127
        DB 0,150,129,84,9,240,192,144,0,144,240,120,242,248,225,128
        DB 254,3,160,176,112,208,129,106,3,224,144,64,192,136,127,131
        DB 188,3,240,248,102,216,130,255,0,227,128,127,9,120,135,105
        DB 150,60,112,240,224,241,244,128,231,11,96,241,182,249,150,233
        DB 242,241,246,177,242,241,128,253,1,240,224,128,68,0,164,129
        DB 112,128,1,131,255,0,128,129,66,8,112,144,98,240,244,248
        DB 102,144,114,129,123,8,225,150,225,44,176,82,88,15,120,128
        DB 27,4,16,112,248,242,248,128,126,0,240,128,161,128,165,4
        DB 240,176,96,16,96,128,255,0,64,134,127,129,75,10,176,112
        DB 217,246,144,118,121,246,249,230,233,128,127,0,105,128,255,19
        DB 60,112,195,150,15,60,208,228,0,96,240,182,105,182,240,180
        DB 241,242,144,116,130,70,0,240,128,70,0,192,132,127,130,255
        DB 1,0,144,128,164,128,12,5,100,241,246,217,228,152,129,127
        DB 11,214,105,150,233,224,208,195,15,15,60,182,88,128,127,9
        DB 240,246,248,240,248,240,208,176,144,96,132,62,0,112,128,149
        DB 139,255,4,208,240,185,230,208,128,253,2,249,246,241,128,190
        DB 5,121,150,105,151,104,240,129,63,15,233,228,0,32,240,210
        DB 121,182,225,182,240,246,145,246,176,244,131,64,1,161,224,130
        DB 51,132,255,2,0,144,64,130,140,129,255,2,100,144,242,129
        DB 127,9,225,150,248,224,176,67,15,15,120,150,130,127,3,242
        DB 240,240,120,128,247,2,144,112,176,128,62,129,7,2,128,0
        DB 0,135,127,9,0,32,144,112,144,112,241,246,176,118,128,127
        DB 1,230,249,128,127,129,1,1,208,112,128,127,0,124,128,127
        DB 0,48,128,255,2,246,233,182,128,255,0,208,130,254,0,240
        DB 128,198,132,253,1,144,32,130,63,130,253,128,1,9,241,246
        DB 208,224,184,114,233,150,120,210,128,3,7,224,144,195,15,122
        DB 88,246,88,128,63,9,121,242,240,241,121,224,240,224,144,112
        DB 130,190,130,188,1,144,96,129,127,128,135,0,0,128,67,128
        DB 81,3,242,240,246,152,128,253,2,248,246,233,128,123,16,107
        DB 150,121,180,144,64,195,15,120,244,249,228,0,112,248,150,249
        DB 130,255,0,176,130,62,128,64,1,240,88,132,112,0,128,129
        DB 194,2,16,0,0,131,14,129,255,2,96,208,242,128,64,15
        DB 210,241,214,248,96,128,82,15,30,240,242,144,0,16,240,241
        DB 131,255,132,127,128,188,131,129,133,255,128,34,2,96,176,116
        DB 131,255,2,248,246,225,131,255,16,244,176,224,67,15,61,242
        DB 249,224,0,112,241,242,249,246,225,246,128,255,130,62,4,225
        DB 180,240,82,176,133,127,130,255,3,96,128,0,16,128,81,3
        DB 145,98,241,246,128,227,1,114,121,128,62,128,111,7,112,192
        DB 82,75,30,105,244,136,128,127,128,220,128,255,1,208,192,128
        DB 230,2,240,176,182,130,129,130,127,129,253,129,192,7,64,0
        DB 32,248,242,240,244,249,128,127,128,105,128,62,128,3,19,244
        DB 176,192,33,15,15,182,248,224,0,96,240,254,249,182,233,182
        DB 241,246,152,129,126,4,210,120,240,240,104,131,194,3,208,96
        DB 128,96,129,63,0,32,129,192,129,81,129,255,15,144,242,105
        DB 214,248,150,248,210,240,112,200,112,105,159,121,224,128,155,5
        DB 112,240,244,233,210,248,129,255,6,240,241,150,120,240,176,82
        DB 131,188,129,255,130,129,130,58,2,240,249,242,129,127,3,240
        DB 246,233,150,129,192,22,225,244,240,104,33,30,45,150,248,224
        DB 16,96,240,214,121,182,203,246,249,242,176,240,225,128,216,128
        DB 0,0,112,128,198,128,51,2,208,64,144,131,127,0,128,128
        DB 138,128,68,2,112,241,242,128,24,128,255,5,225,150,241,150
        DB 248,240,128,127,1,240,240,128,127,128,23,8,240,240,242,120
        DB 96,208,224,161,180,128,31,2,112,240,164,128,58,128,190,134
        DB 255,5,144,96,176,100,176,242,128,251,0,86,129,255,0,241
        DB 128,125,128,1,8,246,180,224,112,150,120,112,248,64,128,190
        DB 3,210,249,242,233,128,153,7,216,244,240,96,208,240,240,210
        DB 128,3,128,175,3,176,96,192,96,131,64,128,127,1,176,32
        DB 128,79,0,98,130,255,13,240,121,214,249,214,233,150,240,164
        DB 208,112,225,244,176,128,34,0,144,129,178,1,210,216,128,48
        DB 131,165,131,190,129,11,131,126,129,58,6,82,145,242,217,242
        DB 249,114,136,127,1,180,156,129,247,14,240,208,0,48,240,241
        DB 182,121,210,90,244,249,242,241,224,129,74,2,225,224,176,129
        DB 80,6,240,208,224,208,96,128,32,132,127,33,144,32,176,96
        DB 144,114,177,242,208,240,176,82,121,246,233,210,233,182,120,108
        DB 144,242,225,150,216,64,0,16,240,240,248,244,241,242,128,186
        DB 0,224,128,123,2,240,225,182,130,143,0,240,135,255,129,127
        DB 5,96,144,118,185,116,217,128,125,130,127,0,182,128,127,7
        DB 188,88,49,105,244,105,228,128,129,63,9,182,120,214,241,242
        DB 241,246,216,112,240,128,153,0,248,130,62,128,0,3,224,224
        DB 96,0,132,127,6,64,16,64,16,224,144,98,128,152,128,255
        DB 128,66,9,214,233,210,105,196,1,150,120,240,144,128,30,128
        DB 127,128,255,128,153,128,27,130,0,128,133,128,190,128,116,128
        DB 92,131,127,128,192,4,98,249,246,185,242,129,127,3,225,150
        DB 105,214,128,127,6,165,208,83,105,180,208,224,128,34,12,114
        DB 225,246,249,150,180,242,249,240,144,240,225,180,128,57,0,214
        DB 133,128,0,176,128,118,129,127,128,201,1,16,96,128,93,17
        DB 116,184,244,208,240,177,114,249,246,121,214,249,210,105,224,45
        DB 30,120,130,99,4,161,246,121,240,248,128,56,4,208,96,176
        DB 240,88,128,3,132,0,3,96,208,240,0,136,127,3,240,249
        DB 230,240,133,127,131,1,2,15,15,180,128,84,13,64,128,114
        DB 121,244,233,180,120,242,248,244,240,240,105,129,56,2,210,225
        DB 210,131,255,3,240,64,144,96,130,255,1,144,64,128,131,20
        DB 100,145,96,248,240,144,96,145,112,249,242,248,246,105,210,105
        DB 167,75,30,120,224,129,32,4,49,214,249,240,249,128,127,1
        DB 176,96,128,3,133,125,128,62,129,27,0,144,131,127,128,1
        DB 3,80,121,244,176,128,125,2,241,244,233,131,125,5,135,203
        DB 15,15,182,240,129,192,6,114,105,244,233,210,120,244,128,155
        DB 1,150,120,129,56,0,180,128,1,131,255,0,0,131,127,128
        DB 164,3,0,32,128,230,128,223,129,72,10,114,249,214,105,214
        DB 233,210,105,135,45,15,129,127,128,97,3,246,248,242,225,132
        DB 115,131,6,131,192,130,246,134,127,3,64,241,118,217,128,127
        DB 5,249,242,161,150,105,182,130,253,12,15,15,30,248,96,208
        DB 224,128,34,225,182,248,150,128,25,1,246,233,131,119,4,180
        DB 105,180,105,210,128,137,4,224,208,0,48,224,128,63,0,16
        DB 128,64,128,127,1,180,152,129,70,11,96,145,114,249,246,121
        DB 244,249,150,75,15,105,130,127,5,128,0,0,114,240,244,131
        DB 119,1,208,112,129,255,0,248,128,66,129,200,2,144,96,16
        DB 130,127,128,197,129,10,7,209,246,184,118,249,246,240,246,128
        DB 127,1,214,105,128,62,130,127,9,112,241,96,128,100,48,150
        DB 249,182,241,128,127,1,248,112,130,188,5,240,105,210,225,150
        DB 240,128,139,2,144,0,176,130,127,2,96,144,32,128,127,1
        DB 98,216,130,127,129,255,11,121,242,248,135,15,15,45,15,45
        DB 224,144,244,128,127,4,176,109,240,248,242,129,253,1,144,96
        DB 128,5,128,68,128,64,129,141,3,96,0,96,208,132,127,9
        DB 32,16,224,113,246,217,246,248,244,217,129,127,2,150,233,150
        DB 128,125,12,31,15,30,120,240,241,96,0,100,208,15,235,244
        DB 129,255,128,184,130,128,5,165,182,105,180,105,210,128,127,1
        DB 16,112,129,127,0,0,129,197,3,32,144,96,153,133,127,3
        DB 246,248,246,105,128,63,12,109,135,45,244,177,224,144,0,16
        DB 112,15,122,240,129,127,7,96,144,112,240,224,208,240,176,132
        DB 255,129,127,136,255,0,178,128,97,8,249,246,176,102,177,150
        DB 105,246,105,128,190,13,60,22,75,30,120,242,120,224,17,96
        DB 176,15,125,242,129,27,128,51,128,56,0,120,128,253,2,105
        DB 150,105,128,9,132,255,10,0,96,128,32,0,16,144,96,209
        DB 96,176,129,127,15,82,249,182,121,246,233,15,15,44,45,195
        DB 31,180,225,164,128,129,127,2,60,240,244,129,111,128,127,1
        DB 240,225,128,251,3,225,210,240,180,136,127,6,80,96,144,64
        DB 16,96,145,128,255,8,249,230,217,230,177,150,121,214,233,128
        DB 127,5,30,30,105,15,249,151,130,127,5,135,124,246,241,246
        DB 249,129,250,4,240,240,150,120,210,128,125,128,1,135,127,1
        DB 32,128,129,196,0,32,130,253,128,255,4,121,246,240,242,75
        DB 128,191,4,15,210,15,150,105,130,127,1,79,60,128,59,0
        DB 240,128,27,2,240,176,66,129,9,0,240,128,62,130,127,0
        DB 112,130,127,0,16,128,253,13,16,100,144,118,185,118,249,230
        DB 152,102,241,150,121,182,129,255,12,30,15,75,15,105,15,120
        DB 96,17,96,177,135,60,128,253,5,248,240,240,112,105,210,139
        DB 127,0,144,133,127,1,128,0,129,251,3,176,98,144,98,128
        DB 255,11,244,241,210,203,15,15,14,149,151,15,30,45,129,127
        DB 6,114,107,60,240,246,240,224,128,255,2,240,176,112,129,126
        DB 131,62,129,255,0,208,133,127,4,0,242,144,114,153,128,255
        DB 7,153,102,225,150,121,150,105,195,128,191,9,7,105,15,15
        DB 15,120,64,17,96,161,132,127,1,208,96,128,59,1,210,248
        DB 128,127,1,75,30,140,255,4,128,0,80,64,16,128,129,7
        DB 152,100,144,114,249,240,240,214,128,127,6,30,195,150,15,15
        DB 45,224,129,255,2,233,180,241,131,255,2,82,176,224,131,253
        DB 129,62,0,240,133,255,1,32,224,128,127,3,112,240,48,152
        DB 128,127,6,145,100,225,150,249,246,225,128,255,6,15,151,41
        DB 135,15,30,240,128,127,2,176,111,125,130,127,0,176,129,187
        DB 1,150,120,128,60,0,15,130,127,1,128,64,130,127,1,16
        DB 32,129,69,129,125,9,144,96,145,96,144,114,248,240,241,210
        DB 128,63,5,30,129,116,225,30,120,128,127,3,0,112,225,180
        DB 128,56,5,224,208,112,240,224,225,128,192,2,225,150,75,129
        DB 129,2,210,240,224,131,127,41,64,144,96,16,32,0,48,176
        DB 64,209,246,249,100,153,102,241,150,249,244,248,135,15,60,15
        DB 210,25,210,249,240,208,0,136,96,144,214,61,244,249,242,240
        DB 240,225,128,123,128,1,1,210,105,128,156,0,45,128,127,0
        DB 208,131,255,1,16,0,130,127,1,224,128,130,129,12,128,114
        DB 248,224,240,244,135,30,225,135,11,100,248,128,227,128,255,0
        DB 96,128,127,0,112,129,255,0,240,130,253,1,225,150,130,62
        DB 0,180,133,255,0,32,128,54,25,32,0,32,208,224,80,230
        DB 217,230,152,102,245,246,249,242,248,135,105,182,15,195,121,182
        DB 120,246,144,130,127,2,60,244,240,128,255,1,240,214,129,251
        DB 2,120,150,75,128,127,2,15,150,105,133,127,128,192,128,4
        DB 0,48,128,68,129,127,1,144,118,128,40,13,246,45,182,233
        DB 15,131,14,233,150,208,224,0,68,0,128,127,0,208,128,120
        DB 128,127,6,240,120,240,105,240,105,135,128,62,4,30,105,240
        DB 240,192,128,45,131,127,0,128,128,63,30,248,114,176,246,185
        DB 102,153,98,241,246,249,246,249,30,120,244,15,167,47,87,111
        DB 182,144,34,0,96,144,210,124,244,240,128,255,4,240,210,240
        DB 30,225,128,129,129,126,128,127,2,180,192,64,131,255,1,32
        DB 16,129,5,1,112,144,129,79,3,96,128,102,184,128,103,0
        DB 15,128,2,5,88,14,177,150,216,64,128,25,3,96,241,182
        DB 144,130,255,5,176,112,120,210,120,210,134,127,0,224,128,51
        DB 3,16,64,128,0,128,52,10,96,0,16,241,224,192,230,217
        DB 102,144,102,129,127,9,233,15,120,240,15,12,145,114,233,228
        DB 128,153,3,32,144,82,124,128,210,0,121,128,48,4,131,150
        DB 150,180,165,130,126,128,64,3,180,208,64,240,130,255,3,0
        DB 144,0,16,128,127,2,208,100,16,129,255,13,102,152,100,176
        DB 229,15,60,144,135,72,86,24,240,144,130,127,1,225,150,129
        DB 127,7,208,96,144,112,120,150,120,150,132,127,6,182,240,192
        DB 160,112,208,16,128,251,128,127,6,32,128,0,240,228,176,114
        DB 128,255,1,102,177,128,127,8,225,15,62,224,15,44,99,172
        DB 152,128,29,128,127,8,114,122,240,241,242,248,194,144,112,128
        DB 253,1,195,75,134,127,1,192,96,130,255,128,127,5,64,16
        DB 0,0,112,176,129,125,15,32,0,100,153,98,209,195,15,30
        DB 208,135,30,18,92,96,144,128,29,13,16,96,177,150,144,96
        DB 240,240,176,32,144,150,105,150,128,66,130,63,4,105,150,240
        DB 224,144,128,255,129,97,130,127,24,241,242,177,96,217,102,153
        DB 100,145,246,185,246,195,15,61,224,199,30,129,134,225,174,136
        DB 0,128,128,127,0,126,128,255,7,248,194,208,240,105,180,120
        DB 150,131,126,135,127,0,32,130,127,4,96,0,96,208,208,128
        DB 127,5,64,144,102,144,100,184,128,127,6,144,22,15,224,185
        DB 98,88,133,127,8,112,176,224,208,96,240,150,105,240,130,253
        DB 134,127,2,208,16,32,129,60,7,128,0,144,0,112,244,216
        DB 80,130,255,12,118,249,246,15,15,121,224,195,135,124,70,153
        DB 68,128,63,3,32,208,242,111,128,255,5,240,164,225,225,225
        DB 150,132,253,129,127,128,212,129,127,128,251,3,16,64,0,32
        DB 128,166,2,96,128,224,131,255,8,208,15,15,180,144,82,105
        DB 134,209,128,61,129,127,11,145,151,144,96,208,240,208,96,225
        DB 150,210,210,136,127,5,96,128,112,144,0,64,128,127,1,64
        DB 128,128,66,4,49,242,224,96,145,129,255,2,118,185,229,130
        DB 127,3,30,47,226,136,128,94,14,128,48,176,240,233,248,241
        DB 244,240,240,240,210,105,150,225,135,127,1,180,208,130,127,0
        DB 96,129,97,6,0,0,144,32,144,240,176,130,255,4,152,100
        DB 131,15,31,129,127,2,150,72,64,131,127,11,144,214,88,112
        DB 176,112,24,240,225,210,120,150,139,127,0,208,128,30,129,184
        DB 128,36,4,48,244,249,82,177,128,255,8,145,102,249,195,15
        DB 30,249,224,131,128,99,1,0,32,128,90,7,48,248,240,227
        DB 188,209,246,240,128,62,1,105,180,133,126,128,127,2,240,208
        DB 224,130,127,129,60,24,16,0,80,64,144,96,145,96,144,0
        DB 0,100,144,96,195,15,45,224,128,114,107,150,45,224,16,131
        DB 127,6,244,88,96,208,224,144,96,130,127,132,63,128,127,1
        DB 224,192,128,255,0,32,129,127,128,188,5,96,144,112,240,240
        DB 153,130,255,10,184,7,15,62,120,228,161,143,225,150,88,128
        DB 84,14,0,48,240,224,225,188,177,244,88,112,240,150,105,195
        DB 75,134,127,0,120,131,127,7,16,32,128,64,16,32,16,64
        DB 128,101,0,240,128,200,1,64,0,128,72,2,135,15,60,128
        DB 127,3,121,210,105,166,131,218,12,176,242,72,96,176,96,208
        DB 240,240,150,225,150,75,133,255,4,180,240,224,208,96,128,255
        DB 128,97,0,96,128,60,3,96,208,96,249,130,127,14,153,102
        DB 216,135,15,30,121,224,225,252,105,195,249,96,152,130,255,1
        DB 241,164,128,159,4,180,105,150,105,210,135,255,2,120,210,240
        DB 130,255,0,64,128,97,1,0,144,128,127,128,97,129,255,128
        DB 127,9,15,15,120,96,128,225,121,182,240,122,128,92,128,127
        DB 2,208,114,120,128,96,0,176,130,127,132,255,2,30,105,240
        DB 129,127,128,47,129,180,7,128,64,144,64,240,112,240,208,128
        DB 127,16,96,153,102,137,15,15,94,240,96,233,31,124,180,121
        DB 224,144,64,130,127,8,180,144,96,240,210,225,165,120,210,134
        DB 255,0,150,129,192,129,127,3,32,128,96,16,128,117,1,0
        DB 112,128,162,128,74,128,5,0,101,128,156,5,96,128,112,109
        DB 242,248,128,182,128,127,3,112,144,82,248,128,157,3,240,240
        DB 225,180,128,255,133,190,128,62,128,43,129,158,9,144,32,128
        DB 64,80,96,177,224,240,224,128,253,128,255,9,131,15,15,240
        DB 144,32,225,159,105,182,128,34,130,127,9,225,150,208,240,240
        DB 180,105,165,120,30,139,127,0,144,128,127,128,129,129,4,3
        DB 0,112,208,98,128,127,129,255,2,67,15,30,128,54,4,112
        DB 225,210,120,228,132,255,5,242,248,96,144,112,176,130,127,133
        DB 255,4,120,240,240,240,80,133,127,1,0,32,128,5,6,228
        DB 176,224,241,102,152,80,129,127,8,60,224,128,96,80,150,95
        DB 182,208,129,127,0,16,128,184,2,150,208,112,129,5,0,105
        DB 133,190,7,15,45,150,105,240,240,96,208,129,127,3,16,32
        DB 144,32,129,3,6,240,112,144,100,128,64,128,130,127,128,135
        DB 4,32,225,150,121,96,128,62,128,255,2,176,242,233,128,235
        DB 7,240,240,105,210,105,150,105,135,132,190,128,127,0,176,132
        DB 127,17,96,0,64,144,96,176,242,176,224,208,102,153,32,153
        DB 100,195,15,15,128,46,5,0,83,47,150,176,224,128,32,4
        DB 0,248,240,249,215,128,255,128,60,1,195,180,132,190,128,127
        DB 1,121,180,129,64,129,127,128,99,0,0,128,119,0,241,128
        DB 52,15,144,0,128,64,144,71,15,15,104,0,128,0,33,158
        DB 249,228,129,127,6,0,224,144,242,105,224,144,128,192,135,127
        DB 1,45,150,129,255,0,144,130,94,128,127,1,16,32,128,5
        DB 12,240,216,96,208,96,152,100,152,96,199,15,15,60,128,127
        DB 4,48,225,166,249,224,128,200,6,0,240,240,249,151,120,112
        DB 129,127,4,225,240,105,135,45,130,127,128,72,3,180,240,224
        DB 208,130,127,10,96,16,0,128,32,16,96,240,228,144,96,128
        DB 46,2,96,144,7,128,63,129,9,3,48,145,100,128,129,127
        DB 4,96,176,118,233,156,134,255,0,150,129,194,0,105,130,127
        DB 0,208,129,255,2,128,32,144,128,125,15,48,96,176,240,240
        DB 112,208,96,145,96,152,96,173,15,15,30,128,89,2,64,0
        DB 32,129,158,129,127,2,225,215,124,130,127,0,105,128,127,1
        DB 75,30,128,63,0,30,128,64,1,180,225,131,255,0,0,130
        DB 132,4,128,96,176,210,16,129,117,5,64,144,86,79,15,15
        DB 128,184,0,16,130,60,130,224,2,240,233,164,128,255,0,210
        DB 132,127,1,150,45,128,62,128,126,2,240,208,112,129,96,128
        DB 127,6,128,96,128,192,144,242,248,129,144,4,100,144,96,241
        DB 135,130,192,0,112,129,251,129,0,4,112,240,240,242,188,131
        DB 127,128,3,7,45,150,75,150,45,180,105,210,128,192,2,180
        DB 240,240,130,95,128,40,128,68,1,240,242,129,207,4,128,96
        DB 16,114,233,128,160,3,144,32,177,228,132,64,4,96,176,112
        DB 241,214,130,127,0,240,131,127,128,188,130,255,2,240,96,208
        DB 130,127,11,96,128,96,144,98,144,240,249,164,224,96,160,129
        DB 9,0,214,128,225,4,90,24,244,249,224,131,63,6,249,240
        DB 241,240,249,240,176,128,123,0,120,132,192,8,105,150,225,180
        DB 240,180,120,240,176,129,127,0,16,128,255,4,16,96,16,96
        DB 176,129,190,5,64,128,0,144,96,240,128,192,3,15,224,176
        DB 242,129,93,128,27,0,86,129,123,130,127,0,180,130,60,129
        DB 7,0,240,128,127,3,224,144,224,176,129,31,2,16,96,128
        DB 128,131,4,216,112,249,180,240,129,137,1,96,144,129,192,0
        DB 15,128,143,1,228,144,130,63,5,161,244,240,240,227,224,129
        DB 255,0,120,132,125,2,105,210,240,129,129,1,240,208,131,127
        DB 2,128,64,16,128,54,0,176,128,207,8,144,96,16,32,16
        DB 96,177,246,107,128,127,1,144,240,128,216,129,64,7,240,88
        DB 96,208,240,216,112,240,128,125,0,225,128,3,128,68,1,240
        DB 105,129,253,128,31,129,127,128,123,7,0,16,208,96,176,112
        DB 225,210,128,64,128,190,3,144,112,249,151,128,128,2,240,241
        DB 224,130,62,6,0,144,246,241,244,241,244,128,239,134,127,3
        DB 120,240,120,112,130,65,0,112,129,31,128,52,128,3,4,112
        DB 144,112,241,224,128,60,130,64,7,233,135,45,15,45,224,144
        DB 64,130,63,5,96,240,112,248,112,208,128,255,1,225,150,128
        DB 182,129,188,2,210,120,180,128,63,130,45,130,127,2,128,0
        DB 176,128,174,2,240,244,88,128,146,129,1,2,240,246,105,128
        DB 128,0,120,133,127,3,114,248,242,240,128,52,128,119,128,190
        DB 128,188,128,135,2,240,112,120,128,64,130,255,0,0,129,229
        DB 128,52,6,208,240,240,164,208,96,128,128,78,128,64,4,210
        DB 75,15,15,30,131,62,6,0,160,144,224,241,240,176,129,176
        DB 128,127,0,105,128,129,5,120,210,225,240,144,224,128,177,134
        DB 127,10,32,144,240,144,112,240,242,240,112,208,98,128,20,128
        DB 11,1,233,195,128,128,0,104,131,63,6,152,112,249,244,241
        DB 240,240,128,123,0,120,129,60,0,120,128,131,2,150,225,160
        DB 128,190,128,192,129,31,0,32,128,103,129,117,0,112,130,209
        DB 0,64,129,127,6,16,112,131,30,79,15,88,131,63,2,0
        DB 16,112,128,218,130,127,11,225,180,240,240,225,210,240,180,240
        DB 96,144,36,129,39,2,176,0,64,132,127,128,62,6,176,180
        DB 240,224,240,96,128,129,202,6,64,144,67,45,151,15,108,132
        DB 192,6,96,240,242,120,240,208,210,129,184,2,120,240,225,128
        DB 125,4,120,224,176,96,176,128,39,133,127,1,32,0,129,117
        DB 0,240,130,127,1,96,16,128,3,6,128,0,131,60,248,135
        DB 44,133,127,4,98,240,244,216,224,129,121,128,66,5,240,120
        DB 182,240,150,208,130,41,128,1,3,16,64,0,0,129,46,1
        DB 144,112,128,117,0,210,130,211,0,32,128,72,6,64,0,67
        DB 15,180,195,62,132,63,5,242,177,242,120,244,120,128,119,4
        DB 105,210,105,210,120,130,68,0,88,131,62,131,127,129,1,129
        DB 117,1,240,240,132,85,7,96,144,0,33,173,124,112,61,128
        DB 92,129,0,5,80,112,176,226,208,164,129,255,0,161,128,255
        DB 128,135,4,240,240,192,16,80,130,171,128,255,128,127,129,3
        DB 4,208,112,176,112,248,129,150,128,202,7,240,224,0,48,61
        DB 150,240,151,133,255,5,241,240,248,180,240,210,128,127,0,225
        DB 128,127,0,240,128,127,3,180,120,112,208,134,127,0,64,129
        DB 38,129,12,0,176,129,188,1,96,128,129,24,6,64,16,150
        DB 195,240,225,136,132,255,3,96,208,246,240,128,157,6,240,150
        DB 120,90,120,240,240,128,131,128,68,129,106,1,96,16,129,255
        DB 0,16,128,69,5,16,96,176,112,240,240,131,83,128,255,7
        DB 224,128,0,242,227,111,231,136,130,90,5,128,112,176,244,240
        DB 244,129,127,4,225,240,30,180,225,128,190,5,195,165,105,150
        DB 60,96,129,45,131,96,129,36,132,247,133,127,4,0,82,152
        DB 62,88,132,191,128,127,2,114,240,224,129,247,0,120,128,190
        DB 3,208,112,240,225,128,74,0,164,128,41,1,64,144,133,255
        DB 0,0,130,117,1,240,96,129,192,11,80,112,240,224,144,64
        DB 33,240,167,164,128,32,130,127,23,32,176,244,241,242,240,210
        DB 120,180,105,180,225,180,240,180,225,150,75,180,90,210,120,112
        DB 176,136,127,1,64,0,128,56,128,81,128,76,129,66,128,9
        DB 3,32,216,114,216,129,60,129,29,0,112,128,115,129,255,128
        DB 0,128,127,128,190,0,120,130,127,128,41,1,16,32,130,127
        DB 0,64,129,52,1,240,96,129,81,130,255,7,240,153,228,112
        DB 86,240,224,0,131,127,4,16,161,244,241,210,129,255,12,105
        DB 240,120,150,105,224,240,150,120,90,105,210,120,138,255,128,40
        DB 131,127,0,16,132,127,0,152,130,13,130,64,7,64,0,214
        DB 88,240,240,112,176,128,86,7,225,180,225,240,88,240,225,150
        DB 128,127,0,208,128,31,0,96,130,255,0,16,128,127,2,16
        DB 64,16,133,125,6,96,144,112,240,242,153,166,130,184,1,32
        DB 144,128,216,2,136,0,227,131,186,0,180,128,117,7,150,105
        DB 164,240,90,120,210,150,128,127,129,43,130,36,0,16,130,231
        DB 128,121,2,96,144,64,131,3,2,208,224,152,129,25,128,60
        DB 128,23,6,192,0,82,176,240,184,112,130,67,10,150,240,150
        DB 208,240,105,150,120,210,161,224,130,106,132,255,3,0,128,96
        DB 0,128,119,2,176,240,144,129,133,4,112,240,246,217,228,128
        DB 123,11,96,16,96,145,96,128,49,128,0,99,240,241,128,59
        DB 128,125,10,210,105,240,240,224,240,30,120,210,240,225,129,127
        DB 128,53,132,127,128,3,128,127,131,83,128,64,18,144,100,128
        DB 32,145,102,136,0,152,96,128,0,1,0,0,48,120,240,176
        DB 128,1,128,0,0,180,128,54,5,112,225,180,120,240,112,128
        DB 43,2,0,160,16,129,162,129,127,6,16,32,16,32,144,114
        DB 248,128,127,17,240,246,240,224,241,242,128,0,145,102,105,102
        DB 144,100,16,100,128,98,128,29,2,30,241,242,130,60,2,210
        DB 225,150,129,196,3,120,240,240,112,129,127,0,240,131,127,0
        DB 144,131,3,12,96,176,240,208,224,177,118,241,240,248,112,208
        DB 64,128,52,3,118,25,64,17,128,127,128,157,2,0,180,224
        DB 130,253,129,196,1,240,208,128,127,128,8,2,164,144,64,128
        DB 177,130,255,0,64,128,36,15,96,144,0,144,240,248,244,249
        DB 246,241,244,248,246,249,240,128,128,52,3,129,134,136,34,128
        DB 227,0,228,128,10,9,240,121,244,225,244,240,210,240,150,105
        DB 131,127,3,210,240,240,208,130,234,130,127,129,4,0,16,129
        DB 200,2,240,176,112,128,30,128,107,128,141,128,23,1,153,96
        DB 128,21,0,0,129,74,2,16,112,208,133,128,129,127,3,240
        DB 225,240,240,128,112,129,116,128,65,132,127,128,190,4,241,242
        DB 241,246,249,128,1,1,248,226,129,80,7,16,70,152,0,152
        DB 96,144,100,129,74,3,240,240,241,214,128,245,0,210,130,127
        DB 1,210,208,128,137,129,125,136,127,128,10,4,96,176,224,208
        DB 240,130,3,0,96,128,118,128,249,5,1,64,0,68,0,16
        DB 129,127,4,0,112,144,240,240,129,245,130,127,129,161,3,225
        DB 224,144,64,128,64,0,16,129,127,0,32,131,127,4,144,242
        DB 248,244,248,128,60,10,208,244,208,100,0,32,152,96,128,50
        DB 24,128,23,1,145,196,129,63,3,241,240,241,210,128,127,129
        DB 255,0,180,128,125,128,76,0,176,138,127,0,32,128,68,0
        DB 32,130,68,130,1,129,80,128,3,0,68,128,27,1,32,136
        DB 129,35,0,96,128,117,1,240,208,131,128,6,96,240,240,176
        DB 240,240,224,129,179,1,144,0,128,169,1,144,32,133,54,133
        DB 1,8,177,196,0,82,137,228,128,0,152,128,56,0,113,129
        DB 62,3,0,48,112,225,128,50,0,225,129,127,129,194,128,3
        DB 0,88,135,127,128,225,3,64,128,64,0,136,64,128,123,2
        DB 82,60,64,129,92,0,0,128,11,130,159,3,114,121,244,120
        DB 128,131,131,0,142,127,0,16,128,1,128,20,1,240,144,129
        DB 255,7,240,241,192,0,180,15,30,72,129,216,1,64,144,131
        DB 127,129,50,2,150,240,210,133,127,2,120,210,208,137,127,0
        DB 16,128,239,136,192,5,224,128,0,144,15,88,130,28,1,16
        DB 68,130,63,128,107,0,241,128,115,129,98,129,3,0,120,128
        DB 11,128,35,128,127,129,34,130,52,1,217,242,130,89,130,11
        DB 6,240,96,17,75,15,30,144,128,86,2,0,32,24,132,255
        DB 7,208,244,240,214,120,240,105,150,128,58,130,0,2,208,96
        DB 128,133,127,129,6,131,121,131,62,128,15,3,32,131,15,88
        DB 128,97,2,0,0,49,130,254,129,35,131,184,5,240,224,144
        DB 240,240,112,128,10,1,96,128,128,19,130,127,130,50,6,112
        DB 176,240,241,242,240,112,130,68,7,240,208,64,33,67,15,14
        DB 208,129,127,1,50,136,130,63,8,49,244,144,114,249,242,248
        DB 224,225,131,127,0,180,133,169,132,91,136,1,4,112,176,96
        DB 144,64,130,127,131,255,0,64,130,63,2,16,240,96,129,247
        DB 129,121,1,144,112,132,127,129,248,134,255,0,100,130,158,1
        DB 224,240,128,133,8,249,244,136,0,16,7,15,164,208,129,28
        DB 0,34,131,191,11,48,244,144,112,120,244,241,214,240,210,120
        DB 240,130,72,140,127,130,184,129,7,0,153,128,190,0,225,128
        DB 127,2,15,15,208,131,127,130,62,128,127,1,64,16,129,53
        DB 5,224,176,210,208,96,176,128,127,0,176,128,127,1,144,96
        DB 130,29,129,127,4,209,240,240,244,208,128,89,11,248,244,249
        DB 246,249,244,128,0,17,15,15,96,130,127,0,32,130,62,128
        DB 60,8,144,96,241,242,248,244,248,240,165,131,125,131,127,130
        DB 220,0,32,130,192,129,1,1,224,144,128,125,9,176,96,208
        DB 64,128,16,233,164,144,98,131,122,130,0,3,32,144,64,16
        DB 129,245,128,56,0,120,129,7,128,41,128,255,0,64,132,255
        DB 3,241,240,176,242,128,150,2,96,240,240,128,125,128,29,130
        DB 87,1,16,160,129,188,129,127,128,206,129,127,7,176,244,121
        DB 246,225,240,176,180,134,253,128,84,137,127,0,112,128,121,6
        DB 240,240,96,240,244,233,32,128,91,1,0,0,136,127,4,16
        DB 0,176,192,144,130,127,1,240,224,129,251,129,62,134,220,0
        DB 16,128,89,1,248,224,130,30,1,246,248,128,3,4,249,246
        DB 145,64,0,128,158,129,54,1,0,0,128,74,9,96,0,16
        DB 144,242,144,96,177,242,225,130,157,0,120,129,70,128,251,129
        DB 118,131,94,133,255,0,112,128,255,0,246,128,156,128,255,0
        DB 157,132,26,132,0,1,64,176,131,96,128,0,129,9,128,43
        DB 130,186,129,96,128,95,6,16,226,144,96,209,240,240,128,133
        DB 10,241,246,241,244,240,224,16,0,33,150,88,132,57,128,135
        DB 128,74,0,128,128,50,4,176,240,241,242,241,130,192,128,0
        DB 0,64,128,123,132,68,128,69,0,80,129,125,1,98,176,128
        DB 34,0,240,128,93,6,152,32,0,35,121,96,0,131,28,0
        DB 32,130,229,1,96,48,134,127,130,188,1,96,144,135,155,128
        DB 199,1,0,144,128,125,15,249,240,176,246,249,242,176,240,248
        DB 228,144,0,33,158,152,64,128,121,131,29,128,127,5,16,48
        DB 144,96,241,242,129,35,2,241,240,208,128,100,2,208,192,128
        DB 128,94,0,16,132,228,0,64,128,138,4,96,176,96,144,240
        DB 128,3,128,7,128,56,1,82,120,135,255,130,135,136,127,0
        DB 224,128,125,129,35,133,255,15,0,32,144,64,16,96,249,242
        DB 240,240,249,246,240,112,241,246,128,219,2,0,67,30,133,127
        DB 128,29,129,40,2,32,240,112,129,125,135,66,130,62,131,226
        DB 128,34,0,32,129,83,129,125,128,1,4,242,144,64,0,7
        DB 136,127,130,0,128,23,134,254,141,127,129,28,128,156,128,223
        DB 128,227,7,185,246,233,32,136,0,167,94,129,117,136,0,2
        DB 80,176,96,128,57,0,244,139,127,131,218,129,64,0,64,130
        DB 121,129,1,2,224,240,96,128,127,1,214,88,133,26,133,0
        DB 0,96,128,163,128,100,130,0,128,33,138,127,128,28,2,112
        DB 240,242,128,85,10,114,176,100,249,242,248,96,136,0,105,164
        DB 132,253,136,192,0,208,134,194,0,208,133,127,0,32,132,28
        DB 0,16,133,125,0,112,128,166,0,198,128,85,0,180,140,190
        DB 128,42,130,35,133,190,0,0,140,94,3,144,96,176,100,128
        DB 3,10,96,217,246,249,215,120,98,128,0,248,224,141,127,3
        DB 0,64,144,112,128,33,134,192,131,183,134,93,128,91,7,0
        DB 16,80,16,96,208,244,120,129,186,1,180,120,141,255,131,35
        DB 2,64,144,240,129,66,133,157,133,255,133,192,12,242,240,242
        DB 121,182,216,100,0,0,159,150,144,96,139,129,0,16,129,62
        DB 2,224,160,96,131,192,128,27,3,32,128,0,128,133,255,129
        DB 192,130,95,11,240,233,244,241,224,136,0,0,150,120,224,16
        DB 141,129,2,64,0,96,129,194,129,62,0,208,129,27,137,31
        DB 131,127,6,176,244,225,182,249,214,248,128,92,2,235,150,240
        DB 140,127,3,0,64,16,96,130,37,0,112,131,127,0,16,128
        DB 31,0,64,135,127,130,66,5,112,176,242,240,240,233,129,156
        DB 2,82,120,224,133,227,134,31,132,102,4,176,96,208,240,144
        DB 128,123,128,15,0,64,134,255,129,192,128,89,5,242,105,244
        DB 249,150,241,128,13,2,177,182,216,129,70,136,0,0,144,129
        DB 33,131,165,128,128,131,127,0,0,136,127,129,253,5,112,241
        DB 240,240,242,121,130,156,1,240,96,140,127,6,64,128,64,144
        DB 32,0,64,129,64,3,240,96,208,96,128,47,1,64,0,128
        DB 133,136,62,8,177,242,241,150,121,242,233,150,212,128,155,3
        DB 88,96,176,226,131,127,0,16,131,36,129,94,131,125,0,224
        DB 128,167,1,240,208,129,15,1,0,128,136,127,128,26,6,208
        DB 210,248,240,240,246,120,128,48,0,49,128,156,142,127,129,62
        DB 1,32,16,129,5,4,112,144,96,128,32,128,31,136,255,129
        DB 253,14,240,105,214,241,150,105,180,136,0,0,35,216,96,0
        DB 98,133,25,139,127,129,60,1,240,240,130,9,137,127,15,16
        DB 96,208,240,241,180,240,240,249,246,88,192,0,0,33,224,140
        DB 125,130,33,129,52,128,119,128,133,1,208,224,128,7,134,253
        DB 128,97,11,16,96,176,114,241,150,241,246,233,151,107,236,129
        DB 127,0,208,134,28,0,16,128,202,129,0,1,144,64,129,121
        DB 133,131,0,208,129,5,1,16,0,134,127,3,32,16,112,176
        DB 128,192,4,240,242,249,214,232,128,14,0,35,131,51,130,0
        DB 134,10,130,194,1,128,64,128,5,0,64,128,139,128,255,0
        DB 16,128,1,131,97,128,26,9,209,240,233,246,249,246,105,150
        DB 111,224,128,48,1,19,88,134,127,128,50,131,7,0,32,128
        DB 117,0,224,132,127,0,48,130,127,128,55,134,194,1,144,96
        DB 128,125,4,240,241,246,105,182,128,254,2,0,3,172,135,128
        DB 133,9,0,128,133,188,129,56,129,127,0,64,130,125,129,217
        DB 4,0,224,144,112,240,128,125,4,233,214,105,151,124,129,127
        DB 2,3,120,96,134,127,0,100,132,64,4,96,208,240,240,224
        DB 131,119,132,1,1,32,0,133,37,128,207,132,253,2,233,180
        DB 136,129,255,1,228,144,142,127,4,16,98,216,240,176,131,56
        DB 0,64,129,240,128,129,0,0,132,37,129,62,8,241,214,249
        DB 242,105,150,105,159,217,129,83,1,18,240,132,245,135,255,4
        DB 0,32,177,246,249,128,129,135,127,3,208,96,16,64,132,26
        DB 128,14,129,254,128,194,1,120,98,130,80,1,64,128,133,154
        DB 0,32,133,135,4,16,112,249,214,248,132,62,1,128,64,131
        DB 255,129,90,0,32,130,140,9,240,249,244,249,242,121,150,120
        DB 224,144,129,83,128,156,133,91,0,16,134,127,0,153,128,94
        DB 0,248,132,194,0,128,128,177,2,128,224,16,132,100,3,64
        DB 144,96,176,131,127,128,95,131,52,134,254,134,0,4,16,96
        DB 240,246,121,130,127,129,125,128,98,2,0,64,32,128,90,0
        DB 16,129,10,128,62,7,249,240,241,246,105,150,233,158,130,127
        DB 1,112,144,135,55,133,192,0,96,128,255,4,150,249,240,208
        DB 240,131,194,0,240,128,74,132,102,0,16,129,14,128,0,4
        DB 241,246,233,182,241,130,18,1,241,224,144,127,5,98,185,242
        DB 233,246,248,130,60,128,251,128,127,0,192,129,127,129,188,128
        DB 62,0,242,129,62,4,121,183,124,32,24,129,43,1,143,124
        DB 132,244,136,0,1,96,249,128,94,4,105,182,240,224,208,129
        DB 64,1,112,240,128,5,1,16,96
DFS_STACK: DS 320
MUSIC_HISTORY: DS 256
BOARD: DS 726
ENDPROGRAM:

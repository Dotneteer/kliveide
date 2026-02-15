;-------------------------------
; .nexload 
; © Jim Bagley 2018-2024
;
; Assembles with sjasmplus - https://github.com/z00m128/sjasmplus
; 
; Changelist:
; v18 06/06/2024 RVG   Bumped version to v18 as it was left at v16 last time.
; v17 25/01/2024 RVG   Preserve existing internal speaker enable setting.
;                      This is a user preference setting, not a game setting.
; v16 27/06/2021 RVG   Exiting via help no longer disables interrupts.
; v15 13/07/2020 RVG   Pauses are now done by waiting for video lines without
;                      enabling interrupts.
;                      AYs are now held in reset for one frame before loading,
;                      to kill any possible held notes.
;                      DMA mode is no longer set in nextreg 6, as bit 6 is now
;                      repurposed as "divert BEEP only to internal speaker".
; v14 15/12/2019 RVG   New V1.3 feature: if the byte at HEADER_EXPBUSDISABLE 
;                      (offset 0x8e) is zero (default) and the core is 3.00.05 
;                      or newer, disable the expansion bus by writing 0 to the 
;                      top four bits of nextreg 0x80, otherwise do nothing.                    
;                      Running without any arguments shows more expansive help,
;                      including the dot command and format versions.
;                      Messages are now printed with interrupts enabled, and 
;                      saying no to the Scroll? message, or any esxDOS errors,
;                      now exits safely with a D BREAK - CONT repeats error.
; v13 02/11/2019 RVG   DMA mode was originally being set to ZXN. Undid previous
;                      DMA change in v12.
; v12 02/11/2019 RVG   Now sets Turbo mode to 28MHz instead of 14MHz.
;                      Now preserves whether F3 and F8 were previously enabled
;                      or disabled.
;                      DMA mode is now always set to ZXN instead of Z80.
; v11 24/07/2019 RVG   Now does core and nex version checks before clearing ULA
;                      screen and setting border, and doesn't CLS when returning
;                      custom BASIC errors. This plays nicer with different
;                      layer modes, and is more in line with other dot commands.
; v10 02/06/2019 RVG   Now skips core version check if nextreg 0 reports as an
;                      emulator.
; v9  19/02/2019 RVG   If the word at HEADER_FILEHANDLEADDR < $4000, the open 
;					   file handle is returned in register C rather than an 
;					   address.
; v8  19/02/2019 RVG   New V1.2 feature: leave the .NEX file handle open, and
;					   specify an address between $4000-FFFF to write the file
;				       handle byte into.
; v7  19/02/2019 RVG   Bugfix: .nexload clip indices were still not being reset 
;					   correctly.
; v6  14/02/2019 RVG   Bugfix: .nexload now resets all four sets of clip indices 
;  					   correctly.
; v5  03/01/2019 RVG   .nexload now reads the V1.2 HEADER_ENTRYBANK byte, and 
;					   pages in this 16K bank at $C000 before jumping to the PC. 
;					   This only happens if HEADER_DONTRESETNEXTREGS is 0. The 
;					   user must be sure to create a suitable entry point code 
;					   in this bank somewhere between $C000..FFFF, and set PC 
;					   accordingly, either in the input SNA or with the !PCSP 
;					   token.
;					   Note: .nexload CSpect test mode (SNA-based) still needs 
;					   fixing up to work with the custom BASIC error changes.
; v4  03/01/2019 RVG   Bugfix: .nexload now checks the subminor core version 
;                      correctly.
; v3  03/01/2019 RVG  .nexload gives an core update error when it encounters 
;                     .nex files requiring core version newer than the current 
;					   core.
; v2  03/01/2019 RVG  .nexload gives an nexload update error when it encounters 
;                     .nex files newer than it can handle.
; v1  14/09/2018 JB   Jim's final version for V1.1 format.
;
;-------------------------------
	device zxspectrum48
;-------------------------------
;	DEFINE testing
;	DEFINE testing8000	; define this to test just loading images
	
;							offset	;size
HEADER_NEXT					= 0		;4
HEADER_VERSION				= 4		;4
HEADER_VERSION_MAJOR		= HEADER_VERSION+1
HEADER_VERSION_MINOR		= HEADER_VERSION+3
HEADER_RAMREQ				= 8		;1
HEADER_NUMBANKS 			= 9		;1
HEADER_LOADSCR				= 10	;1
HEADER_BORDERCOL			= 11	;1
HEADER_SP					= 12	;2
HEADER_PC					= 14	;2
HEADER_NUMFILES				= 16	;2
HEADER_BANKS				= 18	;48+64
HEADER_LOADBAR				= 130	;1
HEADER_LOADCOL				= 131	;1
HEADER_LOADDEL				= 132	;1
HEADER_STARTDEL				= 133	;1
HEADER_DONTRESETNEXTREGS	= 134	;1
HEADER_CORE_MAJOR			= 135	;1
HEADER_CORE_MINOR			= 136	;1
HEADER_CORE_SUBMINOR		= 137	;1
HEADER_HIRESCOL				= 138	;1 // if non zero is to be 
HEADER_ENTRYBANK			= 139	;1 // V1.2, 16K bank to page into $C000 at exit
HEADER_FILEHANDLEADDR		= 140   ;2 // V1.2, if address is nonzero then file will be left open, and the handle written into a single byte at this address.
									;     Should be between $4000-FFFF in banks 5/2/0, or banks 5/2/N if HEADER_ENTRYBANK is non-zero.
HEADER_EXPBUSDISABLE        = 142	;1 // V1.3, if zero (default) will disable the expansion bus by writing 0 to the top four bits of nextreg 0x80. If non-zero do nothing.								

LAYER_2_PAGE				= 9
LAYER_2_PAGE_0				= 9
LAYER_2_PAGE_1				= 10
LAYER_2_PAGE_2				= 11

M_GETSETDRV  				equ $89
M_GETERR 					equ $93
F_OPEN       				equ $9a
F_CLOSE      				equ $9b
F_READ       				equ $9d
F_WRITE      				equ $9e
F_SEEK       				equ $9f
F_GET_DIR    				equ $a8
F_SET_DIR    				equ $a9
FA_READ      				equ $01
FA_APPEND    				equ $06
FA_OVERWRITE 				equ $0E

TURBO_CONTROL_REGISTER			equ $07		;Turbo mode 0=3.5Mhz, 1=7Mhz, 2=14Mhz
SPRITE_CONTROL_REGISTER			equ $15		;Enables/disables Sprites and Lores Layer, and chooses priority of sprites and Layer 2.
PALETTE_INDEX_REGISTER			equ $40		;Chooses a ULANext palette number to configure.
PALETTE_VALUE_REGISTER			equ $41		;Used to upload 8-bit colors to the ULANext palette.
PALETTE_FORMAT_REGISTER			equ $42
PALETTE_CONTROL_REGISTER		equ $43		;Enables or disables ULANext interpretation of attribute values and toggles active palette.
PALETTE_VALUE_BIT9_REGISTER		equ $44		;Holds the additional blue color bit for RGB333 color selection.
MMU_REGISTER_0				equ $50		;Set a Spectrum RAM page at position 0x0000 to 0x1FFF
MMU_REGISTER_1				equ $51		;Set a Spectrum RAM page at position 0x2000 to 0x3FFF
MMU_REGISTER_2				equ $52		;Set a Spectrum RAM page at position 0x4000 to 0x5FFF
MMU_REGISTER_3				equ $53		;Set a Spectrum RAM page at position 0x6000 to 0x7FFF
MMU_REGISTER_4				equ $54		;Set a Spectrum RAM page at position 0x8000 to 0x9FFF
MMU_REGISTER_5				equ $55		;Set a Spectrum RAM page at position 0xA000 to 0xBFFF
MMU_REGISTER_6				equ $56		;Set a Spectrum RAM page at position 0xC000 to 0xDFFF
MMU_REGISTER_7				equ $57		;Set a Spectrum RAM page at position 0xE000 to 0xFFFF

COPPER_CONTROL_LO_BYTE_REGISTER		equ $61
COPPER_CONTROL_HI_BYTE_REGISTER		equ $62

GRAPHIC_PRIORITIES_SLU			= %00000000	; sprites over l2 over ula
GRAPHIC_PRIORITIES_LSU			= %00000100
GRAPHIC_PRIORITIES_SUL			= %00001000
GRAPHIC_PRIORITIES_LUS			= %00001100
GRAPHIC_PRIORITIES_USL			= %00010000
GRAPHIC_PRIORITIES_ULS			= %00010100
GRAPHIC_OVER_BORDER				= %00000010
GRAPHIC_SPRITES_VISIBLE			= %00000001
LORES_ENABLE					= %10000000

NEXT_MACHINE_REGISTER			equ $00
NEXT_VERSION_REGISTER			equ $01
CORE_VERSION_REGISTER			equ $0E
PERIPHERAL_1_REGISTER			equ $05		;Sets joystick mode, video frequency, Scanlines and Scandoubler.
PERIPHERAL_2_REGISTER			equ $06		;Enables Acceleration, Lightpen, DivMMC, Multiface, Mouse and AY audio.
PERIPHERAL_3_REGISTER			equ $08		;Enables Stereo, Internal Speaker, SpecDrum, Timex Video Modes, Turbo Sound Next and NTSC/PAL selection.
RASTER_MSB_REGISTER				equ $1e
RASTER_LSB_REGISTER   			equ $1f
TBBLUE_REGISTER_SELECT			equ $243B

	MACRO DOT_VERSION:db "v18":ENDM
	MACRO FMT_VERSION:db "V1.3":ENDM
	MACRO SetSpriteControlRegister:NEXTREG_A SPRITE_CONTROL_REGISTER:ENDM
	MACRO Set14mhz:NEXTREG_nn TURBO_CONTROL_REGISTER,%10:ENDM
	MACRO BREAK:dw $01DD:ENDM
	MACRO ADD_HL_A:dw $31ED:ENDM
	MACRO SWAPNIB: dw $23ED: ENDM
	MACRO NEXTREG_A register:dw $92ED:db register:ENDM			; Set Next hardware register using A
	MACRO NEXTREG_nn register, value:dw $91ED:db register:db value:ENDM	; Set Next hardware register using an immediate value
	MACRO NEXTREG_RD register:ld bc,TBBLUE_REGISTER_SELECT:ld a,register:out (c),a:inc b:in a,(c):ENDM ; Read register into A
	MACRO BORDER colour:ld a,colour:out ($FE),a:ld a,colour*8:ld (23624),a:ENDM
	MACRO FREEZE:BORDER 1:BORDER 2:jr$-18:ENDM
	MACRO PRINT_CHAN chan:ld a,chan:rst $18:dw 5981:ENDM
	MACRO CSBREAK:push bc:db $DD,$01:nop:nop:pop bc:ENDM ; Does a safe breakpoint in CSpect. Should not crash if accidentally run on the Next board
	MACRO CPHLDE:or a:sbc hl,de:add hl,de:ENDM
	MACRO CPHLBC:or a:sbc hl,bc:add hl,bc:ENDM

;-------------------------------

	IFDEF testing

	IFDEF testing8000
		org $8000
	ELSE
		org	$4000
	ENDIF
start
	ld	ix,testfile
	jp	loadbig

;testfile db	"l2.nex",0
;testfile db	"ula.nex",0
;testfile db	"lo.nex",0
;testfile db	"shr.nex",0
;testfile db	"shc.nex",0

;testfile db	"bis.nex",0
;testfile db	"warhawk.nex",0
testfile db 	"NXtel.nex",0
	ELSE

	org	$2000
start
	ld (oldStack),sp

	ld	a,h:or l:jr nz,.gl
	ld	hl,help:call print_rst16:jr finish
	ld a, $f3:ld (print_ret),a ; SMC a DI after printing help
.gl	ld	de,filename:ld b,127
.bl	ld	a,(hl):cp ":":jr z,.dn:or a:jr z,.dn:cp 13:jr z,.dn:bit 7,a:jr nz,.dn
	ld	(de),a:inc hl:inc de:djnz .bl
.dn	xor	a:ld (de),a

	; the filename passed may have trailing spaces... the index needs to update to omit them

	ld	ix,filename
	call stripLeading	
	call loadbig
finish
	xor	a:ret

	ENDIF
;-------------------------------
stripLeading					; remove leading spaces ix = pointer
	ld a,ixh:ld h,a:ld a,ixl:ld l,a		; hl = pointer to filename
	ld b,127
.l1	ld a,(hl):cp ' ':jp nz,.ok
	inc hl
	djnz .l1
.ok	ld a,h:ld ixh,a:ld a,l:ld ixl,a		; set ix to current
	ret
;-------------------------------
getCurrentCore	
    ld a,NEXT_VERSION_REGISTER
    ld bc,TBBLUE_REGISTER_SELECT
    out (c),a:inc b:in a,(c)		; major and minor
	ld (CoreFull+1),a  				; Full version MSB
    ld d,a
    and %1111:ld (CoreMinor),a
    ld a,d:SWAPNIB:and %1111:ld (CoreMajor),a
    ld a,CORE_VERSION_REGISTER:dec b
    out (c),a:inc b:in a,(c):ld (CoreSub),a		; sub minor
	ld (CoreFull),a							; Full version LSB
	ret
	
;-------------------------------

getrealbank
	cp	8:ret nc
	ld	hl,.table:add a,l:ld l,a:adc a,h:sub l:ld h,a:ld a,(hl):ret
.table	db	5,2,0,1,3,4,6,7
;-------------------------------
loadbig
	di
	IFDEF testing
		IFDEF testing8000
			ld	sp,$7fff
		ELSE
			ld	sp,$4800
		ENDIF
	ELSE
	ld	sp,$3fff
	ENDIF	
	Set14mhz
	ld hl, esxDOSerrorHandler:rst 8:db $95 ; install M_ERRH error handler	
	push ix:call fopen:pop ix
	call getCurrentCore
	
	; set transparency on ULA
	NEXTREG_nn 66, 15
	NEXTREG_nn PALETTE_CONTROL_REGISTER, 0
	NEXTREG_nn PALETTE_CONTROL_REGISTER, 0
	NEXTREG_nn PALETTE_INDEX_REGISTER, 	$18
	NEXTREG_nn PALETTE_VALUE_REGISTER, 	$e3
;   xor a:out (254),a
;   ld hl,$5800:ld de,$5801:ld bc,$2ff:ld (hl),0:ldir
	ld	bc,4667:ld a,0:out (c),a
	NEXTREG_nn SPRITE_CONTROL_REGISTER,GRAPHIC_PRIORITIES_SLU + GRAPHIC_SPRITES_VISIBLE

;	ld	a,LAYER_2_PAGE_0*2:NEXTREG_A MMU_REGISTER_6:inc a:NEXTREG_A MMU_REGISTER_7:ld	hl,$c000:ld de,$c001:ld bc,$3fff:ld (hl),l:ldir
;	ld	a,LAYER_2_PAGE_1*2:NEXTREG_A MMU_REGISTER_6:inc a:NEXTREG_A MMU_REGISTER_7:ld	hl,$c000:ld de,$c001:ld bc,$3fff:ld (hl),l:ldir
;	ld	a,LAYER_2_PAGE_2*2:NEXTREG_A MMU_REGISTER_6:inc a:NEXTREG_A MMU_REGISTER_7:ld	hl,$c000:ld de,$c001:ld bc,$3fff:ld (hl),l:ldir

	ld a,5*2:NEXTREG_A MMU_REGISTER_2	; warning if this 16K bank isn't 5 on loading this then it will crash on testing but 5 is default so should be ok.
	inc a:NEXTREG_A MMU_REGISTER_3
	ld a,2*2:NEXTREG_A MMU_REGISTER_4
	inc a:NEXTREG_A MMU_REGISTER_5
	xor a:NEXTREG_A MMU_REGISTER_6:inc a:NEXTREG_A MMU_REGISTER_7
	
;	pop ix
;	push ix:call setdrv:pop ix:call fopen
	ld	ix,$c000:ld bc,$200:call fread
	
	ld a,($c000+HEADER_VERSION_MAJOR):sub '0':and %1111:SWAPNIB:ld b,a:ld a,($c000+HEADER_VERSION_MINOR):and %1111:or b:ld b,a
	ld a,(LoaderVersion):cp b:jp c,loaderUpdate
	
;	The default value 0 should disable the expansion bus by writing 0 to the top four bits of nextreg 0x80. If non-zero do nothing	
	ld a,($c000+HEADER_EXPBUSDISABLE):or a:jp nz,.noDisableBus
;	But if core < 3.00.05, do nothing either
	ld hl,(CoreFull):ld de,$3005:CPHLDE:jr c,.noDisableBus
;	Disable bus
	NEXTREG_RD 0x80:and %00001111:NEXTREG_A 0x80
.noDisableBus	
		
	ld	hl,$c000+HEADER_BANKS:ld de,LocalBanks:ld bc,48+64:ldir
	ld	hl,($c000+HEADER_PC):ld (PCReg),hl
	ld	hl,($c000+HEADER_SP):ld (SPReg),hl
	ld	hl,($c000+HEADER_LOADBAR):ld (LoadBar),hl
	ld	hl,($c000+HEADER_LOADDEL):ld (LoadDel),hl
	ld	hl,($c000+HEADER_FILEHANDLEADDR):ld (HandleAddr),hl
	
    ld a,NEXT_MACHINE_REGISTER
    ld bc,TBBLUE_REGISTER_SELECT
    out (c),a:inc b:in a,(c) ; 10 for Next or 8 for emulator
	cp 8:jp z,.ok            ; Skip core version check if emulator

	ld hl,(CoreMajor):ld de,(CoreSub)
	ld a,($c000+HEADER_CORE_MAJOR)					:cp l:jr z,.o1:jp nc,coreUpdate:jr .ok
.o1	ld a,($c000+HEADER_CORE_MINOR)                  :cp h:jr z,.o2:jp nc,coreUpdate:jr .ok
.o2	ld a,($c000+HEADER_CORE_SUBMINOR)               :cp e:jr z,.ok:jp nc,coreUpdate
.ok

	xor a:out (254),a
	ld	hl,$5800:ld de,$5801:ld bc,$2ff:ld (hl),0:ldir

	ld a, ($c000+HEADER_ENTRYBANK):ld (.entryBankSMC),a
	ld a,($c000+HEADER_DONTRESETNEXTREGS):or a:jp nz,.dontresetregs
;Reset All registers
;stop copper
	NEXTREG_nn COPPER_CONTROL_HI_BYTE_REGISTER, 0	; stop
	NEXTREG_nn COPPER_CONTROL_LO_BYTE_REGISTER, 0
;reset AY sound chips enabled
;    ld a,6:ld bc,$243b:out (c),a:inc b:in a,(c):or 3:out (c),a	 ;PERIPHERAL_3_REGISTER

;	NEXTREG_nn 6,200
;	11001000
	ld a,PERIPHERAL_2_REGISTER:ld bc,TBBLUE_REGISTER_SELECT:out (c),a:inc b:in a,(c)
    ;set 7,a			; preserve F8 enabled/disabled setting
    ;res 6,a		    ; set DMA to ZXN mode - NO, this bit now means Divert BEEP only to internal speaker
	;res 5,a    		; preserve F3 enabled/disabled setting
   	res 4,a				; DivMMC automatic paging off
    set 3,a				; mulitface - add to build options so can be selected
;   res 2,a				; 2 = ps2 mode - leave to option control
;   set 1,a:set 0,a		; set AY (rather than YM) - * Causes Silence *

	; 			bits 1-0 = Audio chip mode (0- = disabled, 10 = YM, 11 = AY)
	;			11 = disable audio, or appears to be the case
	
	push af:and %11111100:out (c),a ; disable AYs and set register
	ld a,1: call rasterWait ; wait 1 frame for AY reset to take effect
	pop af: NEXTREG_A PERIPHERAL_2_REGISTER; reenable AY to whatever the previous mode was

;	NEXTREG_nn 8,a
; 	111x1110
	ld a,PERIPHERAL_3_REGISTER:ld bc,TBBLUE_REGISTER_SELECT:out (c),a:inc b:in a,(c)
	set 7,a			; disable locked paging
	set 6,a			; disable contention
	res 5,a			; stereo to ABC   (perhaps leave to options?)
					; bit 4 (enable internal speaker) is a user setting, not a game setting. Don't change it!
	set 3,a 		; enable specdrum
	set 2,a 		; enable timex
	set 1,a 		; enable turbosound
	res 0,a 		; must be 0

	out (c),a

;    ld a,8:ld bc,$243b:out (c),a:inc b:in a,(c):set 1,a:set 5,a:out (c),a	 ;PERIPHERAL_3_REGISTER

	NEXTREG_nn 7,%11	; turbo 28Mhz

	NEXTREG_nn 18,9														; layer2 page
	NEXTREG_nn 19,12													; layer2 shadow page
	NEXTREG_nn 20,$e3													; transparent index
	NEXTREG_nn 21,1														; priorities + sprite over border + sprite enable
	NEXTREG_nn 22,0:NEXTREG_nn 23,0										; layer2 xy scroll
	NEXTREG_nn 28,%1111										     		; clipwindow index reset all 4
	NEXTREG_nn 24,0														; reset layer 2 clip
	NEXTREG_nn 24,255
	NEXTREG_nn 24,0
	NEXTREG_nn 24,191
	NEXTREG_nn 25,0														; reset sprites clip
	NEXTREG_nn 25,255
	NEXTREG_nn 25,0
	NEXTREG_nn 25,191
	NEXTREG_nn 26,0														; reset ULA clip
	NEXTREG_nn 26,255
	NEXTREG_nn 26,0
	NEXTREG_nn 26,191
	NEXTREG_nn 27,0														; reset tilemap clip
	NEXTREG_nn 27,159
	NEXTREG_nn 27,0
	NEXTREG_nn 27,255
	NEXTREG_nn 24,0:NEXTREG_nn 24,255:NEXTREG_nn 24,0:NEXTREG_nn 24,191	; clip window layer2
	NEXTREG_nn 25,0:NEXTREG_nn 25,255:NEXTREG_nn 25,0:NEXTREG_nn 25,191	; clip window sprites
	NEXTREG_nn 26,0:NEXTREG_nn 26,255:NEXTREG_nn 26,0:NEXTREG_nn 26,191	; clip window ula
	NEXTREG_nn 45,0														; sound drive reset
	NEXTREG_nn 50,0:NEXTREG_nn 51,0										; lores XY scroll
	NEXTREG_nn 67,0														; ula palette
	NEXTREG_nn 66,15													; allow flashing
	NEXTREG_nn 64,0
	call .ul
	NEXTREG_nn 64,128
	call .ul
	NEXTREG_nn 67,16													;layer2 palette
	call .pa
	NEXTREG_nn 67,32													;sprite palette
	call .pa
	NEXTREG_nn 74,0														; transparency fallback value
	NEXTREG_nn 75,$e3													; sprite transparency index
	NEXTREG_nn MMU_REGISTER_0,255
	NEXTREG_nn MMU_REGISTER_1,255

	jr .dontresetregs

.pa	NEXTREG_nn 64,0														;palette index
	xor a																;index 0
.rp	NEXTREG_A 65														;palette low 8
	inc a:jr nz,.rp														;reset all 256 colours
	ret
.ul	ld c,8
.u0	ld hl,DefaultPalette:ld b,16
.u2	ld a,(hl):inc hl:NEXTREG_A PALETTE_VALUE_REGISTER
	djnz .u2:dec c:jr nz,.u0
	ret

.dontresetregs

	ld	a,($c000+HEADER_LOADSCR):ld (IsLoadingScr),a:or a:jp z,.skpbmp
	ld	a,($c000+HEADER_BORDERCOL):ld (BorderCol),a
	ld	a,(IsLoadingScr):and 128:jr nz,.skppal
	ld	a,(IsLoadingScr):and %11010:jr nz,.skppal
	ld	ix,$c200:ld bc,$200:call fread	;palette
	ld a,(IsLoadingScr):and 4:jr z,.nlores
	NEXTREG_nn PALETTE_CONTROL_REGISTER,%00000001:jr .nl2	;layer2 palette
.nlores
	NEXTREG_nn PALETTE_CONTROL_REGISTER,%00010000	;layer2 palette
.nl2
	NEXTREG_nn PALETTE_INDEX_REGISTER, 	0
	ld	hl,$c200:ld b,0
.pl	ld a,(hl):inc hl:NEXTREG_A PALETTE_VALUE_BIT9_REGISTER
	ld a,(hl):inc hl:NEXTREG_A PALETTE_VALUE_BIT9_REGISTER
	djnz .pl
.skppal
	ld	a,(IsLoadingScr):and 1:jr z,.notbmp
	ld	a,LAYER_2_PAGE_0*2:NEXTREG_A MMU_REGISTER_6:inc a:NEXTREG_A MMU_REGISTER_7:ld	ix,$c000:ld bc,$4000:call fread:ld a,6:jp c,.err
	ld	a,LAYER_2_PAGE_1*2:NEXTREG_A MMU_REGISTER_6:inc a:NEXTREG_A MMU_REGISTER_7:ld	ix,$c000:ld bc,$4000:call fread:ld a,6:jp c,.err
	ld	a,LAYER_2_PAGE_2*2:NEXTREG_A MMU_REGISTER_6:inc a:NEXTREG_A MMU_REGISTER_7:ld	ix,$c000:ld bc,$4000:call fread:ld a,6:jp c,.err
	ld	bc,4667:ld a,2:out (c),a
	NEXTREG_nn SPRITE_CONTROL_REGISTER,GRAPHIC_PRIORITIES_SLU + GRAPHIC_SPRITES_VISIBLE
	xor a:out (255),a
.notbmp
	ld	a,(IsLoadingScr):and 2:jr z,.notULA
	IFDEF testing
		IFDEF testing8000
			ld	ix,$4000:ld bc,$1b00:call fread
		ELSE
			ld	ix,$4800:ld bc,$800:call fread
			ld	ix,$4800:ld bc,$1b00-$800:call fread
		ENDIF
	ELSE
		ld	ix,$4000:ld bc,$1b00:call fread
	ENDIF
	ld	bc,4667:xor a:out (c),a
	NEXTREG_nn SPRITE_CONTROL_REGISTER,GRAPHIC_PRIORITIES_SLU + GRAPHIC_SPRITES_VISIBLE
	xor a:out (255),a
.notULA
	ld	a,(IsLoadingScr):and 4:jr z,.notLoRes
	IFDEF testing
		IFDEF testing8000
			ld	ix,$4000:ld bc,$1800:call fread
		ELSE
			ld	ix,$4800:ld bc,$800:call fread
			ld	ix,$4800:ld bc,$1800-$800:call fread
		ENDIF
	ELSE
		ld	ix,$4000:ld bc,$1800:call fread
	ENDIF
	ld	ix,$6000:ld bc,$1800:call fread
	ld	bc,4667:xor a:out (c),a
	NEXTREG_nn SPRITE_CONTROL_REGISTER,GRAPHIC_PRIORITIES_SLU + GRAPHIC_SPRITES_VISIBLE + LORES_ENABLE
	ld a,3:out (255),a
.notLoRes
	ld	a,(IsLoadingScr):and 8:jr z,.notHiRes
	IFDEF testing
		IFDEF testing8000
			ld	ix,$4000:ld bc,$1800:call fread
		ELSE
			ld	ix,$4800:ld bc,$800:call fread
			ld	ix,$4800:ld bc,$1800-$800:call fread
		ENDIF
	ELSE
		ld	ix,$4000:ld bc,$1800:call fread
	ENDIF
	ld	ix,$6000:ld bc,$1800:call fread
	ld	bc,4667:xor a:out (c),a
	NEXTREG_nn SPRITE_CONTROL_REGISTER,GRAPHIC_PRIORITIES_SLU + GRAPHIC_SPRITES_VISIBLE
	ld a,($c000+HEADER_HIRESCOL):and %111000:or 6:out (255),a
;	ld a,6+24:out (255),a
.notHiRes
	ld	a,(IsLoadingScr):and 16:jr z,.notHiCol
	IFDEF testing
		IFDEF testing8000
			ld	ix,$4000:ld bc,$1800:call fread
		ELSE
			ld	ix,$4800:ld bc,$800:call fread
			ld	ix,$4800:ld bc,$1800-$800:call fread
		ENDIF
	ELSE
		ld	ix,$4000:ld bc,$1800:call fread
	ENDIF
	ld	ix,$6000:ld bc,$1800:call fread
	ld	bc,4667:xor a:out (c),a
	NEXTREG_nn SPRITE_CONTROL_REGISTER,GRAPHIC_PRIORITIES_SLU + GRAPHIC_SPRITES_VISIBLE
	ld a,2:out (255),a
.notHiCol
	ld	a,(BorderCol):out (254),a
.skpbmp
	xor a:NEXTREG_A MMU_REGISTER_6:inc a:NEXTREG_A MMU_REGISTER_7

	IFDEF testing	
		BREAK
	ENDIF
	
	ld a,(LocalBanks+5):or a:jr z,.skb5
	IFDEF testing
		ld ix,$4800:ld bc,$800:call fread:ld a,5:jp c,.poperr
		ld ix,$4800:ld bc,$3800:call fread:ld a,5:jp c,.poperr
	ELSE
		ld ix,$4000:ld bc,$4000:call fread:ld a,5:jp c,.poperr
	ENDIF
.skb5
	ld a,(LocalBanks+2):or a:jr z,.skb2
	ld ix,$8000:ld bc,$4000:call fread:ld a,4:jp c,.poperr
.skb2
	ld a,(LocalBanks+0):or a:jr z,.skb0
	ld ix,$c000:ld bc,$4000:call fread:ld a,3:jp c,.poperr
.skb0

	ld	d,0:call progress:inc d:call progress:inc d:call progress
	ld a,3
.lp	push af:call getrealbank:ld e,a:ld hl,LocalBanks:ADD_HL_A:ld a,(hl):or a:jr z,.skpld
	ld a,e:add a,a:NEXTREG_A MMU_REGISTER_6:inc a:NEXTREG_A MMU_REGISTER_7
	ld ix,$c000:ld bc,$4000:call fread:ld a,2:jp c,.poperr
.skpld
	ld a,(IsLoadingScr):or a:call nz,delay

	pop de:push de:call progress
	
	pop af:inc a:cp 112:jr nz,.lp;48+64:jr nz,.lp

	ld hl, (HandleAddr)
	ld a, h
	or l
	jp nz, .noClose	
	call fclose
.noClose

	db $3E ;ld a,n
.entryBankSMC ; Read entry bank
	db 0
	add a,a:NEXTREG_A MMU_REGISTER_6 ; Set upper 16K to entry bank
	inc a:NEXTREG_A MMU_REGISTER_7	 ; (V1.2 feature)

	ld hl, (HandleAddr)
	ld a, h
	or l	
	jp z, .noWriteHandle
	ld bc, $4000
	or a
	sbc hl, bc	
	add hl, bc
	jp c, .setRegHandle
	ld a, (handle)
	ld (hl), a
.noWriteHandle	

;.stop	inc a:and 7:out (254),a:jr .stop

	ld a,(StartDel)
;.ss	or a:jr z,.go:dec a:ei:halt:di:jp .ss
	call rasterWait
.go

	ld	hl,(PCReg):ld sp,(SPReg)
	ld a,h:or l:jr z,.returnToBasic
	db 01 ; ld bc, $00nn 
.regBCHandleSMC
	db 0
	db 0
	IFDEF testing
		jp (hl)
	ELSE
		ld	hl,(PCReg)
		rst	$20
	ENDIF

.poperr
.err	out (254),a
	ld	bc,4667:xor a:out (c),a

.returnToBasic
    call .returnToBasicTidy
	ld sp,(oldStack)
	xor a
	ret
.returnToBasicTidy	
	call fclose
	ld a,($5b5c):and 7:add a,a:NEXTREG_A MMU_REGISTER_6:inc a:NEXTREG_A MMU_REGISTER_7
	ret
.setRegHandle
	ld a, (handle)
	ld (.regBCHandleSMC), a
	jp .noWriteHandle	

;--------------------
delay	ld a,(LoadDel)
;.ss	or a:ret z:dec a:ei:halt:di:jp .ss
	or a: ret z:call rasterWait
;--------------------
progress
	ld a,(LoadBar):or a:ret z
	ld a,LAYER_2_PAGE_2*2:NEXTREG_A MMU_REGISTER_6:inc a:NEXTREG_A MMU_REGISTER_7
	ld a,(LoadCol):ld e,a
	ld h,$fe:ld a,d:add a,a:add a,24-6:ld l,a:ld (hl),e:inc h:ld (hl),e:inc l:ld (hl),e:dec h:ld (hl),e
	ret
;--------------------
rasterWait ; wait for A frames without enabling interrupts, A=0 returns immediately
	or a:ret z:ld e,a
.loop
	NEXTREG_RD RASTER_LSB_REGISTER
	or a:jr nz, .loop
	NEXTREG_RD RASTER_MSB_REGISTER
	or a:jr nz, .loop
	dec e:jr nz, .loop
	ret
;--------------------
fileError ; esxDOS error code arrives in a
	ld b,1 ;return error message to 32-byte buffer at DE
	ld de,esxError:rst $08:db M_GETERR
	ld hl,esxError
	ld sp,(oldStack)
	jp returnError2
;-------------
fopen
	ld b,FA_READ
	ld a,'*'
	push ix:pop hl:rst $08:db F_OPEN
	ld (handle),a:jp c, fileError
	ret
;--------------
fread
	push ix:pop hl:db 62
handle	db 1
	rst $08:db F_READ
	ret
;-------------
fclose
	ld a,(handle):rst $08:db F_CLOSE
	ret

;-------------
coreUpdate
	ld sp,(oldStack)
	ld hl,coretext:call print_rst16	
	ld hl,(CoreMajor):ld h,0:call dec8:ld a,".":rst 16
	ld hl,(CoreMinor):ld h,0:call dec8:ld a,".":rst 16
	ld hl,(CoreSub):ld h,0:call dec8	
	ld hl,yourcoretext:call print_rst16	
	ld hl,($c000+HEADER_CORE_MAJOR):ld h,0:call dec8:ld a,".":rst 16
	ld hl,($c000+HEADER_CORE_MINOR):ld h,0:call dec8:ld a,".":rst 16
	ld hl,($c000+HEADER_CORE_SUBMINOR):ld h,0:call dec8		
	ld hl,coretext2:call print_rst16
	ld a,(CoreSub)
	ld hl,coreerrortext
	jp returnError

;-------------
loaderUpdate
	ld sp,(oldStack)
	ld a,($c000+HEADER_VERSION_MAJOR)
	ld (loadervertextMajor),a
	ld a,($c000+HEADER_VERSION_MINOR)
	ld (loadervertextMinor),a
    ld hl,loadervertext:call print_rst16
	ld hl,fileversionerrortext
returnError
	ld sp,(oldStack)
returnError2
	xor a
	scf
	ei
	ret	
esxDOSerrorHandler
	 ld hl, breakerrortext
     jr returnError

dec8
	ld de,100
	call dec0
	ld de,10
	call dec0
	ld de,1
dec0
	ld a,"0"-1
.lp	inc a
	sub hl,de
	jr nc,.lp
	add hl,de
	rst 16
	ret

coretext
	db	"Your core is ",0
yourcoretext
	db	", but ",13,"this file needs ",0	
coretext2
    db ".",13,"Please update your core.",13,0
coreerrortext
    db  "Update cor",'e'|128
fileversionerrortext
    db  "Update .nexloa",'d'|128
breakerrortext
	db	"D BREAK - CONT repeat",'s'|128
loadervertext
    db  "This is a V"
loadervertextMajor
	db	"x."
loadervertextMinor
	db	"x file. Please     update to the latest .nexload   version.",0

;-------------
DefaultPalette
	db	%00000000,%00000010,%10100000,%10100010,%00010100,%00010110,%10110100,%10110110
	db	%00000000,%00000011,%11100000,%11100111,%00011100,%00011111,%11111100,%11111111
;-------------
CoreMajor	db 	0
CoreMinor	db	0
CoreSub		db 	0
CoreFull	dw	0

oldStack	dw	0
IsLoadingScr db 0
PCReg		dw	0
SPReg		dw	0
BorderCol	db	0
LoadBar		db	0
LoadCol		db	0
LoadDel		db	0
StartDel	db	0
NumFiles	dw	0
LocalBanks	db	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
		db	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
LoaderVersion db $12 ; V1.2 in bcd
HandleAddr  dw 0

print_rst16	ei:ld a,(hl):inc hl:or a:jr z,print_ret:rst 16:jr print_rst16
print_ret	nop:ret ; This will get SMC'd to DI after printing the help

filename	db		0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
			db		0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
help		db		"NEXLOAD "
			DOT_VERSION
			db 		13, "Loads and runs .NEX files",13,13,"nexload",13,"Show help",13,13,"nexload FILENAME",13,"Load a .NEX file",13,13
			db		"FILENAME",13,"File to load, which can include an optional drive or path",13,13,"NEXLOAD "
			DOT_VERSION
			db 		" can load .NEX files up to and including format "
			FMT_VERSION
			db 		13,13,"Copyright ",127," 2018-2024 Jim Bagley",13
			db		"Maintenance Robin Verhagen-Guest",13,0
esxError	ds 		34,128

header		equ		$


	IFDEF testing
	savesna "nexload.sna",start
	ELSE
last
	savebin "NEXLOAD",start,last-start
	ENDIF

;-------------------------------

	CPU z80
	 org $1a01
CRAM EQU $5800
FALSE EQU $00
INIT_MUSIC EQU $00
NADA EQU $00
NIL EQU $00
PLAY_MUSIC EQU $00
SCREEN EQU $c000
STOP_MUSIC EQU $00
TRUE EQU $01
VRAM EQU $4000
StartBlock1a01:
	jp block1
varPrefixed_i:	db	0
kepernyo: dw  0
	
; //
; // Videoton TVC-re próbáluk programot írni, fordítani
; // a TRSE 0.14 fejlesztőeszközzel.
; // Célplatformnak válasszuk mondjuk a Spectrumot.
; // Project settings -> Target Settings
; // pipa: Override default target setting
; // program start adress: $1A01
; // pipa: Ignore BASIC SYS start
; // fordítsunk egy VALAMI.BIN-t
; // utána futtassuk az OSSZEFUZ.BAT fájlt ami a 
; // VALAMI.BIN elé másolja a CASBIN.BIN fájlt és 
; // létrehozza a .CAS fájlt, ami már TVC emulátorban
; // futtatható.
; //
; // bekapcsoljuk a kívánt video módot, majd a 
; // video RAM-ot belapozzuk 32768-tól.
	; NodeProcedureDecl -1
	; ***********  Defining procedure : init_Graphics
	;    Procedure type : User-defined procedure
mode:	db	0
 ; Temp vars section
 ; Temp vars section ends
init_Graphics_block2:
init_Graphics:
	; ****** Inline assembler section
	
         LD   C,mode // 0,1,2 = 2,4,16 color
         RST  $30                           
	     db $4 //
		 ld	A,$50 // video ram belapozása
		 ld($3),A
		 out($2),A
    
	ret
end_procedure_init_Graphics:
block1:
main_block_begin_:
	
; // ------------- ITT kezdődik majd a program --------
	ld a, $1
	ld [mode], a
	call init_Graphics
	
; // 4 színű mód bekapcsolása
	ld hl,$8000
	ld [kepernyo],hl
	
; // le négyet és jobbra egyet
; // egy vízszintes sor 64 byte, 1 byte 4 pixelt ír le
	ld a, $0
	ld [varPrefixed_i], a
MainProgram_forloop3:
	
; // bal-felső sarok címe
; // ferde "vonalat" maszatolunk a képernyőre
	ld hl,[kepernyo]
	ld a,$f
	ld [hl],a
	
; // 00001111  -01 mind a 4 pixel
	; Generic assign 16-bit pointer
	; Generic 16-bit binop
	ld hl,$1
	ex de,hl
	push de
	; Generic 16-bit binop
	ld hl,$40
	ex de,hl
	push de
	; Generic 16-bit binop
	ld hl,$40
	ex de,hl
	push de
	; Generic 16-bit binop
	ld hl,$40
	ex de,hl
	push de
	; Generic 16-bit binop
	ld hl,$40
	ex de,hl
	; Variable is 16-bit
	ld hl,[kepernyo]
	add hl,de
	pop de
	add hl,de
	pop de
	add hl,de
	pop de
	add hl,de
	pop de
	add hl,de
	; Store 16-bit address
	ld [kepernyo],hl
MainProgram_forloopcounter5:
MainProgram_loopstart6:
	ld a,[varPrefixed_i]
	add a,1
	ld [varPrefixed_i],a
	cp $40
	jr nz,MainProgram_forloop3
MainProgram_forloopend4:
MainProgram_loopend7:
MainProgram_end10:
	;nop
	jr MainProgram_end10
main_block_end_:
; Copy BC bytes from HL to DE.
z80_copy_mem:
    ld      a,b
    or      c
    ret     z
    ld      a,16
    sub     c
    and     15
    add     a,a
    ld      (z80_copy_lp-1),a
    jr      z80_copy_lp ; will be overwritten
z80_copy_lp:
    ldi
    ldi
    ldi
    ldi
    ldi
    ldi
    ldi
    ldi
    ldi
    ldi
    ldi
    ldi
    ldi
    ldi
    ldi
    ldi
    jp      pe,z80_copy_lp
    ret
mul_8x8:
    sla h  ; optimised 1st iteration
    jr nc,mul_8x8_s1
    ld l,e
mul_8x8_s1:
    add hl,hl
    jr nc,mul_8x8_s2
    add hl,de
mul_8x8_s2:
    add hl,hl
    jr nc,mul_8x8_s3
    add hl,de
mul_8x8_s3:
    add hl,hl
    jr nc,mul_8x8_s4
    add hl,de
mul_8x8_s4:
    add hl,hl
    jr nc,mul_8x8_s5
    add hl,de
mul_8x8_s5:
    add hl,hl
    jr nc,mul_8x8_s6
    add hl,de
mul_8x8_s6:
    add hl,hl
    jr nc,mul_8x8_s7
    add hl,de
mul_8x8_s7:
    add hl,hl
    jr nc,mul_8x8_s8
    add hl,de
mul_8x8_s8:
    ret
mul_16x8:
    add a,a  ; optimised 1st iteration
    jr nc,mul_16x8_s1
    ld h,d
    ld l,e
mul_16x8_s1:
    add hl,hl
    rla
    jr nc,mul_16x8_s2
    add hl,de
    adc a,c
mul_16x8_s2:
    add hl,hl
    rla
    jr nc,mul_16x8_s3
    add hl,de
    adc a,c
mul_16x8_s3:
    add hl,hl
    rla
    jr nc,mul_16x8_s4
    add hl,de
    adc a,c
mul_16x8_s4:
    add hl,hl
    rla
    jr nc,mul_16x8_s5
    add hl,de
    adc a,c
mul_16x8_s5:
    add hl,hl
    rla
    jr nc,mul_16x8_s6
    add hl,de
    adc a,c
mul_16x8_s6:
    add hl,hl
    rla
    jr nc,mul_16x8_s7
    add hl,de
    adc a,c
mul_16x8_s7:
    add hl,hl
    rla
    jr nc,mul_16x8_s8
    add hl,de
    adc a,c
mul_16x8_s8:
    ret
div_16x8
;div_hl_c:
   xor	a
   ld	b, 16
_loop:
   add	hl, hl
   rla
   jr	c, $+5
   cp	c
   jr	c, $+4
   sub	c
   inc	l
   djnz	_loop
   ret
div_16x16:
   ld	hl, 0
   ld	b, 16
_loop16:
   sll	c
   rla
   adc	hl, hl
   sbc	hl, de
   jr	nc, $+4
   add	hl, de
   dec	c
   djnz	_loop16
   ret
_Mod_16:
    ld hl,0
    ld a,b
    ld b,8
_Mod_Loop1:
    rla
    adc hl,hl
    sbc hl,de
    jr nc,_Mod_NoAdd1
    add hl,de
_Mod_NoAdd1:
    djnz _Mod_Loop1
    rla
    cpl
    ld b,a
    ld a,c
    ld c,b
    ld b,8
_Mod_Loop2:
    rla
    adc hl,hl
    sbc hl,de
    jr nc,_Mod_NoAdd2
    add hl,de
_Mod_NoAdd2:
    djnz _Mod_Loop2
    rla
    cpl
    ld b,c
    ld c,a
    ret
EndBlock1a01:
	end

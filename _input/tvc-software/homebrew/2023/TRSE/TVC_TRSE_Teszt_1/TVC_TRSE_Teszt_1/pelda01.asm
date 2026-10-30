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
varPrefixed_a:	db	0
varPrefixed_i:	db	0
j:	db	0
s:	db	0
varPrefixed_e:	db	0
ii:	dw	0
Ran:	db	0
kepernyo: dw  0
po2: dw  0
mem: dw  0
xe:	db	0
ye:	db	0
	map:	 ds 241
grafika:	db $033, $0ff, $0ff, $0ee, $044, $055, $077, $0dd
	db $0aa, $0bb, $0ff, $0aa, $0dd, $0ff, $0ff, $0cc
	db $0bb, $0ff, $0ff, $0aa, $0ff, $0ff, $0ff, $044
	db $0bb, $0ff, $0ee, $088, $0ff, $0ff, $0dd, $00
	db $0ff, $0ff, $088, $00, $0ff, $0ff, $044, $0cc
	db $0bb, $0ff, $099, $0aa, $077, $055, $011, $044
	db $0bb, $0aa, $0aa, $0ee, $055, $00, $00, $044
	db $00, $022, $088, $088, $011, $044, $00, $00
	db $00, $0a0, $0a0, $080, $010, $050, $050, $040
	db $020, $0a0, $0a0, $0a0, $030, $070, $0f0, $060
	db $020, $00, $080, $020, $030, $010, $0c0, $020
	db $020, $0f0, $0f0, $0a0, $030, $0c0, $00, $0e0
	db $010, $090, $0e0, $040, $00, $0f0, $0f0, $0a0
	db $050, $0a0, $0a0, $0c0, $0a0, $0d0, $076, $0a0
	db $0d0, $0f3, $0f0, $0d0, $0b1, $0f8, $020, $0a0
	db $050, $0a0, $010, $00, $00, $050, $020, $080
	db $00
	
; // ebben a tömbben tároljuk a pályát
; // 16x15-ös pálya, 240 byte
; // grafikai adatok, a kő és az ellenfél, 1 elem= 64 byte
; // blokk 0 -kő
; // blokk 1 -ellenfél
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
	; NodeProcedureDecl -1
	; ***********  Defining procedure : init_4colors
	;    Procedure type : User-defined procedure
init_4colors:
	; ****** Inline assembler section
	
		 ld	A,$55		// 4 szin beallitasa
		 out($63),A
		 ld	A,$41		
		 out($62),A
		 ld	A,$44		
		 out($61),A
		 ld	A,$00		
		 out($60),A
    
	ret
end_procedure_init_4colors:
	
; // Ran byte változó tartalma random 0..255 lesz
	; NodeProcedureDecl -1
	; ***********  Defining procedure : random_szamgeneralas
	;    Procedure type : User-defined procedure
random_szamgeneralas:
	; ****** Inline assembler section
	
      NOP
	  LD A,R
	  LD [Ran],A
  
	ret
end_procedure_random_szamgeneralas:
	
; // 16x16 pixeles objektumot rajzol cpclr színnel
	; NodeProcedureDecl -1
	; ***********  Defining procedure : putimage_color
	;    Procedure type : User-defined procedure
ig0:	db	0
cpclr:	db	0
po3: dw  0
putimage_color_block5:
putimage_color:
	ld a, $0
	ld [ig0], a
putimage_color_forloop6:
	ld hl,[po3]
	ld a,[cpclr]
	ld [hl],a
	ld hl,[po3]
	; ; index is pure number optimization
	ld de,$1
	add hl,de
	ld a,[cpclr]
	ld [hl],a
	ld hl,[po3]
	; ; index is pure number optimization
	ld de,$2
	add hl,de
	ld a,[cpclr]
	ld [hl],a
	ld hl,[po3]
	; ; index is pure number optimization
	ld de,$3
	add hl,de
	ld a,[cpclr]
	ld [hl],a
	; ;generic pointer/integer P:=P+(expr) add expression
	; RHS is pure 
	ld de,$40
	ld hl,[po3]
	add  hl,de
	ld [po3],hl
putimage_color_forloopcounter8:
putimage_color_loopstart9:
	ld a,[ig0]
	add a,1
	ld [ig0],a
	cp $10
	jr nz,putimage_color_forloop6
putimage_color_forloopend7:
putimage_color_loopend10:
	ret
end_procedure_putimage_color:
	
; // 16x16 pixeles objektumot rajzol grafikával
	; NodeProcedureDecl -1
	; ***********  Defining procedure : putimage_a
	;    Procedure type : User-defined procedure
ig1:	db	0
po4: dw  0
putimage_a_block13:
putimage_a:
	ld a, $0
	ld [ig1], a
putimage_a_forloop14:
	; Variable is 16-bit
	; Integer
	ld hl,[ii]
	ex de,hl
	ld hl,grafika
	add hl,de
	ld a,[hl]
	; LoadVar Testing if 'grafika' is word : 0
	push af
	ld hl,[po4]
	pop af
	ld [hl],a
	; 16 bit BINOP
	; RHS is pure 
	ld de,$1
	; Variable is 16-bit
	; Integer
	ld hl,[ii]
	add  hl,de
	ld [ii],hl
	; Variable is 16-bit
	; Integer
	ld hl,[ii]
	ex de,hl
	ld hl,grafika
	add hl,de
	ld a,[hl]
	; LoadVar Testing if 'grafika' is word : 0
	push af
	ld hl,[po4]
	; ; index is pure number optimization
	ld de,$1
	add hl,de
	pop af
	ld [hl],a
	; 16 bit BINOP
	; RHS is pure 
	ld de,$1
	; Variable is 16-bit
	; Integer
	ld hl,[ii]
	add  hl,de
	ld [ii],hl
	; Variable is 16-bit
	; Integer
	ld hl,[ii]
	ex de,hl
	ld hl,grafika
	add hl,de
	ld a,[hl]
	; LoadVar Testing if 'grafika' is word : 0
	push af
	ld hl,[po4]
	; ; index is pure number optimization
	ld de,$2
	add hl,de
	pop af
	ld [hl],a
	; 16 bit BINOP
	; RHS is pure 
	ld de,$1
	; Variable is 16-bit
	; Integer
	ld hl,[ii]
	add  hl,de
	ld [ii],hl
	; Variable is 16-bit
	; Integer
	ld hl,[ii]
	ex de,hl
	ld hl,grafika
	add hl,de
	ld a,[hl]
	; LoadVar Testing if 'grafika' is word : 0
	push af
	ld hl,[po4]
	; ; index is pure number optimization
	ld de,$3
	add hl,de
	pop af
	ld [hl],a
	; 16 bit BINOP
	; RHS is pure 
	ld de,$1
	; Variable is 16-bit
	; Integer
	ld hl,[ii]
	add  hl,de
	ld [ii],hl
	; ;generic pointer/integer P:=P+(expr) add expression
	; RHS is pure 
	ld de,$40
	ld hl,[po4]
	add  hl,de
	ld [po4],hl
putimage_a_forloopcounter16:
putimage_a_loopstart17:
	ld a,[ig1]
	add a,1
	ld [ig1],a
	cp $10
	jp nz,putimage_a_forloop14
putimage_a_forloopend15:
putimage_a_loopend18:
	ret
end_procedure_putimage_a:
	; NodeProcedureDecl -1
	; ***********  Defining procedure : kiszamol_kepernyo_ertek
	;    Procedure type : User-defined procedure
kiszamol_kepernyo_ertek:
	; Generic assign 16-bit pointer
	; Generic 16-bit binop
	; Variable is 16-bit
	ld a,[xe]
	ld l,a
	ld h,0
	ex de,hl
	ld hl,$8000
	add hl,de
	; Store 16-bit address
	ld [kepernyo],hl
	; ****** Inline assembler section
	
	  NOP
	  LD H,0
	  LD A,[ye]
	  LD L,A
	  SLA L
	  RL H
	  SLA L
	  RL H
	  SLA L
	  RL H
	  SLA L
	  RL H
	  SLA L
	  RL H
	  SLA L
	  RL H
	  ex DE,HL
	  LD HL,[kepernyo]
	  ADD HL,DE
	  LD [kepernyo],HL
    
	ret
end_procedure_kiszamol_kepernyo_ertek:
	
; // -----------------------------------------------------
; // -----------------------------------------------------
; // --------------------------------------------------
; // --------------- Indítunk egy pályát --------------
	; NodeProcedureDecl -1
	; ***********  Defining procedure : palya_generalas
	;    Procedure type : User-defined procedure
xf:	db	0
yf:	db	0
palya_generalas_block22:
palya_generalas:
	
; // ----------  feltöltjük a MAP tömböt random elemekkel 
	call random_szamgeneralas
	; generic assign 
	ld a,[Ran]
	ld b,a
	ld a,$1f
	add  a, b
	push af
	ld a,$3f
	ld b,a
	pop af
	and  b
	ld [varPrefixed_e], a
	; generic assign 
	ld a,[Ran]
	ld [varPrefixed_a], a
	ld a, $0
	ld [varPrefixed_i], a
palya_generalas_forloop23:
	call random_szamgeneralas
	; 'a:=a + const'  optimization 
	ld a,[varPrefixed_e]
	add  a,$1
	ld [varPrefixed_e], a
	; Binary clause core: GREATER
	; Compare with pure num / var optimization
	ld a,[varPrefixed_e]
	cp $78
	jr c, palya_generalas_elsedoneblock46
	jr z, palya_generalas_elsedoneblock46
palya_generalas_ConditionalTrueBlock44: ;Main true block ;keep :
	ld a, $16
	ld [varPrefixed_e], a
palya_generalas_elsedoneblock46:
	ld a, $0
	ld [j], a
palya_generalas_forloop49:
	; 'a:=a + const'  optimization 
	ld a,[varPrefixed_a]
	add  a,$1
	ld [varPrefixed_a], a
palya_generalas_forloopcounter51:
palya_generalas_loopstart52:
	ld a,[varPrefixed_e]
	ld c,a
	ld a,[j]
	add a,1
	ld [j],a
	cp c
	jr nz,palya_generalas_forloop49
palya_generalas_forloopend50:
palya_generalas_loopend53:
	; Storing to array
	ld a,[varPrefixed_a]
	ld b,a
	ld a,[Ran]
	add  a, b
	push af
	ld a,$3
	ld b,a
	pop af
	and  b
	push af
	ld a,[varPrefixed_i]
	ld e,a
	ld d,0
	ld hl,map
	add hl,de
	pop af
	ld [hl],a
palya_generalas_forloopcounter25:
palya_generalas_loopstart26:
	ld a,[varPrefixed_i]
	add a,1
	ld [varPrefixed_i],a
	cp $f0
	jr nz,palya_generalas_forloop23
palya_generalas_forloopend24:
palya_generalas_loopend27:
	
; // 16x15-ös "pálya" kirajzolása
	ld hl,$8000
	ld [po2],hl
	ld a, $0
	ld [varPrefixed_e], a
	
; // 16*64=1024, 16 sorral lejjebb megyünk
	ld a, $0
	ld [j], a
palya_generalas_forloop56:
	ld hl,[po2]
	ld [kepernyo],hl
	ld a, $0
	ld [varPrefixed_i], a
palya_generalas_forloop88:
	; generic assign 
	ld a,[varPrefixed_e]
	ld e,a ; variable is 8-bit
	ld d,0
	ld hl,map
	add hl,de
	ld a,[hl]
	; LoadVar Testing if 'map' is word : 0
	ld [s], a
	; 'a:=a + const'  optimization 
	ld a,[varPrefixed_e]
	add  a,$1
	ld [varPrefixed_e], a
	ld a,[s]
	cp $0
	jr nz,palya_generalas_casenext105
	ld a, $0
	ld [cpclr], a
	ld hl,[kepernyo]
	ld [po3],hl
	call putimage_color
	jp palya_generalas_caseend104
palya_generalas_casenext105:
	ld a,[s]
	cp $1
	jr nz,palya_generalas_casenext107
	
; // semmi -fekete kocka
	; generic assign 
	ld hl,$0
	; Integer assignment 
	; Loading pointer
	ld [ii],hl
	ld hl,[kepernyo]
	ld [po4],hl
	call putimage_a
	jp palya_generalas_caseend104
palya_generalas_casenext107:
	ld a,[s]
	cp $2
	jr nz,palya_generalas_casenext109
	
; // fal kirajzolása
	ld a, $f
	ld [cpclr], a
	ld hl,[kepernyo]
	ld [po3],hl
	call putimage_color
	jp palya_generalas_caseend104
palya_generalas_casenext109:
	ld a,[s]
	cp $3
	jr nz,palya_generalas_casenext111
	
; // piros kocka
	; generic assign 
	ld hl,$0
	; Integer assignment 
	; Loading pointer
	ld [ii],hl
	ld hl,[kepernyo]
	ld [po4],hl
	call putimage_a
palya_generalas_casenext111:
palya_generalas_caseend104:
	
; // fal kirajzolása
	; ;generic pointer/integer P:=P+(expr) add expression
	; RHS is pure 
	ld de,$4
	ld hl,[kepernyo]
	add  hl,de
	ld [kepernyo],hl
palya_generalas_forloopcounter90:
palya_generalas_loopstart91:
	ld a,[varPrefixed_i]
	add a,1
	ld [varPrefixed_i],a
	cp $10
	jp nz,palya_generalas_forloop88
palya_generalas_forloopend89:
palya_generalas_loopend92:
	; ;generic pointer/integer P:=P+(expr) add expression
	; RHS is pure 
	; RHS is pure constant of $100
	ld b,$04
	ld a,[ po2+1]
	add a,b
	ld [ po2+1],a
palya_generalas_forloopcounter58:
palya_generalas_loopstart59:
	ld a,[j]
	add a,1
	ld [j],a
	cp $f
	jp nz,palya_generalas_forloop56
palya_generalas_forloopend57:
palya_generalas_loopend60:
	
; // kirajzolunk három ellenfelet a pályára
; // 1. ellenfél
	ld a, $b
	ld [xe], a
	ld a, $24
	ld [ye], a
	call kiszamol_kepernyo_ertek
	; generic assign 
	ld hl,$40
	; Integer assignment 
	; Loading pointer
	ld [ii],hl
	ld hl,[kepernyo]
	ld [po4],hl
	call putimage_a
	
; // 2. ellenfél
	ld a, $33
	ld [xe], a
	ld a, $4b
	ld [ye], a
	call kiszamol_kepernyo_ertek
	; generic assign 
	ld hl,$40
	; Integer assignment 
	; Loading pointer
	ld [ii],hl
	ld hl,[kepernyo]
	ld [po4],hl
	call putimage_a
	
; // 3. ellenfél
	ld a, $1f
	ld [xe], a
	ld a, $8a
	ld [ye], a
	call kiszamol_kepernyo_ertek
	; generic assign 
	ld hl,$40
	; Integer assignment 
	; Loading pointer
	ld [ii],hl
	ld hl,[kepernyo]
	ld [po4],hl
	call putimage_a
	ret
end_procedure_palya_generalas:
	
; // "akárhány" ellenfél kirajzolható
; // SPACE lenyomására majd felengedésére vár
	; NodeProcedureDecl -1
	; ***********  Defining procedure : VARAKOZIK_SPACE_LENYOMASRA
	;    Procedure type : User-defined procedure
VARAKOZIK_SPACE_LENYOMASRA:
	; ****** Inline assembler section
	
varakozas_space
				nop
				HALT
				ld  HL,2904
				ld	a,(HL) 
				cp	32
				jp	NZ,varakozas_space // lenyomásra vár
varakozas_space2
				ld  HL,2904
				ld	a,(HL) 
				cp	32
				jp	Z,varakozas_space2 // és felengedésre
    
	ret
end_procedure_VARAKOZIK_SPACE_LENYOMASRA:
block1:
main_block_begin_:
	
; // ---------------------------------------------
; // --------------------------------------------------
; // ------------- ITT kezdődik majd a program --------
; // --------------------------------------------------
	ld a, $1
	ld [mode], a
	call init_Graphics
	
; // 4 színű mód bekapcsolása
	call init_4colors
	; ****** Inline assembler section
	
	  NOP
START
	  HALT
	  NOP
    
	
; // 4 szín beállítása
; // megjelenítjük a pályát
	call palya_generalas
	
; // várunk SPACE lenyomására
	call VARAKOZIK_SPACE_LENYOMASRA
	; ****** Inline assembler section
	
	  NOP
	  jp START
	  NOP
    
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

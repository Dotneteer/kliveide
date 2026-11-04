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
jatekmod:	db	0
varPrefixed_a:	db	0
k:	db	0
varPrefixed_i:	db	0
j:	db	0
s:	db	0
varPrefixed_e:	db	0
fociklus:	db	0
fociklusx:	db	0
ii:	dw	0
Ran:	db	0
kepernyo: dw  0
po: dw  0
p1: dw  0
po2: dw  0
mem: dw  0
mem2: dw  0
ciim:	db	0
x:	db	0
xe:	db	0
ye:	db	0
me:	db	0
xem:	db	0
yem:	db	0
kep:	db	0
szamol:	db	0
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
	db $013, $05f, $05f, $04e, $027, $0af, $0af, $0af
	db $01f, $0df, $05f, $0df, $05f, $01f, $0cf, $06f
	db $0af, $019, $0cc, $01f, $05f, $019, $0cc, $06f
	db $0bf, $0ff, $0ff, $0ce, $01b, $0cf, $01f, $0cd
	db $07, $0ff, $0ff, $08e, $01, $0f, $0f, $08
	db $013, $0af, $05f, $08c, $027, $0ff, $0ff, $04e
	db $027, $0f, $0f, $04e, $07, $0ef, $07f, $0e
	db $01, $0ef, $07f, $08, $01, $0e, $07, $00
	db $00, $00
	map:	 ds 241
map1:	db $01, $00, $00, $00, $00, $00, $00, $00
	db $00, $00, $00, $00, $00, $00, $00, $01
	db $01, $00, $00, $00, $00, $00, $00, $00
	db $00, $00, $00, $00, $00, $00, $00, $01
	db $01, $01, $01, $01, $01, $01, $01, $01
	db $01, $01, $01, $01, $01, $01, $01, $01
	db $01, $01, $01, $01, $01, $01, $01, $01
	db $01, $01, $01, $01, $01, $01, $01, $01
	db $01, $01, $00, $01, $00, $00, $00, $01
	db $00, $00, $00, $01, $00, $00, $01, $01
	db $01, $01, $00, $01, $00, $00, $00, $00
	db $00, $00, $09, $00, $00, $01, $01, $01
	db $01, $01, $00, $01, $00, $00, $00, $00
	db $00, $00, $00, $00, $00, $00, $01, $01
	db $01, $01, $00, $00, $00, $00, $00, $01
	db $00, $00, $00, $00, $00, $00, $01, $01
	db $01, $01, $01, $01, $00, $00, $00, $00
	db $09, $00, $00, $00, $00, $01, $01, $01
	db $01, $01, $00, $00, $00, $00, $00, $00
	db $00, $00, $00, $01, $01, $01, $01, $01
	db $01, $01, $00, $00, $09, $00, $00, $00
	db $00, $00, $00, $00, $01, $01, $01, $01
	db $01, $01, $01, $00, $00, $00, $01, $00
	db $09, $00, $00, $00, $00, $00, $01, $01
	db $01, $01, $00, $00, $00, $00, $01, $01
	db $00, $00, $01, $01, $00, $01, $01, $01
	db $01, $01, $01, $01, $01, $01, $01, $01
	db $01, $01, $01, $01, $01, $01, $01, $01
	db $01, $01, $01, $01, $01, $01, $01, $01
	db $01, $01, $01, $01, $01, $01, $01, $01
	
; //  1024 byte, 128 karakter, 8byte/karakter
; //   30975-31999   -- karakterkészlet a kiíráshoz
; // 128 karakter, egyelőre ékezetek nélkül
; //  kb 1024 byte
; //   -29950-30974  -- maga a szöveg a kiíráshoz
; // blokk 0 -kő
; // blokk 1 -ellenfél
; // blokk 2 -főszereplő
; // 
; //
; //
; // 0-semmi
; // 1-fal
; // 9-ellenfél start
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
	
; // 8x8 pixeles karatert rajzol grafikával
	; NodeProcedureDecl -1
	; ***********  Defining procedure : putimage_a8x8
	;    Procedure type : User-defined procedure
ig2:	db	0
po5: dw  0
putimage_a8x8_block21:
putimage_a8x8:
	ld a, $0
	ld [ig2], a
putimage_a8x8_forloop22:
	; Optimization : zp[0]
	ld hl,[mem2]
	ld a,[hl]
	push af
	ld a,$f0
	ld b,a
	pop af
	and  b
	push af
	ld hl,[po5]
	pop af
	ld [hl],a
	; Generic mul
	ld a,$10
	ld e,a
	ld d,0
	push de
	; Optimization : zp[0]
	ld hl,[mem2]
	ld a,[hl]
	push af
	ld a,$f
	ld b,a
	pop af
	and  b
	ld h,a
	ld l,0
	pop de
	call mul_8x8
	ld a,l
	push af
	ld hl,[po5]
	; ; index is pure number optimization
	ld de,$1
	add hl,de
	pop af
	ld [hl],a
	; ;generic pointer/integer P:=P+(expr) add expression
	; RHS is pure 
	ld de,$1
	ld hl,[mem2]
	add  hl,de
	ld [mem2],hl
	; ;generic pointer/integer P:=P+(expr) add expression
	; RHS is pure 
	ld de,$40
	ld hl,[po5]
	add  hl,de
	ld [po5],hl
putimage_a8x8_forloopcounter24:
putimage_a8x8_loopstart25:
	ld a,[ig2]
	add a,1
	ld [ig2],a
	cp $8
	jr nz,putimage_a8x8_forloop22
putimage_a8x8_forloopend23:
putimage_a8x8_loopend26:
	ret
end_procedure_putimage_a8x8:
	
; // -------------------------------------------------------
	; NodeProcedureDecl -1
	; ***********  Defining procedure : putimage_color_torol1_vizszintes
	;    Procedure type : User-defined procedure
igt0:	db	0
putimage_color_torol1_vizszintes_block31:
putimage_color_torol1_vizszintes:
	ld a, $0
	ld [igt0], a
putimage_color_torol1_vizszintes_forloop32:
	ld hl,[kepernyo]
	ld a,$0
	ld [hl],a
	ld hl,[kepernyo]
	; ; index is pure number optimization
	ld de,$1
	add hl,de
	ld a,$0
	ld [hl],a
	ld hl,[kepernyo]
	; ; index is pure number optimization
	ld de,$2
	add hl,de
	ld a,$0
	ld [hl],a
	ld hl,[kepernyo]
	; ; index is pure number optimization
	ld de,$3
	add hl,de
	ld a,$0
	ld [hl],a
	; ;generic pointer/integer P:=P+(expr) add expression
	; RHS is pure 
	ld de,$40
	ld hl,[kepernyo]
	add  hl,de
	ld [kepernyo],hl
putimage_color_torol1_vizszintes_forloopcounter34:
putimage_color_torol1_vizszintes_loopstart35:
	ld a,[igt0]
	add a,1
	ld [igt0],a
	cp $4
	jr nz,putimage_color_torol1_vizszintes_forloop32
putimage_color_torol1_vizszintes_forloopend33:
putimage_color_torol1_vizszintes_loopend36:
	ret
end_procedure_putimage_color_torol1_vizszintes:
	
; // -------------------------------------------------------
	; NodeProcedureDecl -1
	; ***********  Defining procedure : putimage_color_torol1_fuggoleges
	;    Procedure type : User-defined procedure
igt1:	db	0
putimage_color_torol1_fuggoleges_block39:
putimage_color_torol1_fuggoleges:
	ld a, $0
	ld [igt1], a
putimage_color_torol1_fuggoleges_forloop40:
	ld hl,[kepernyo]
	ld a,$0
	ld [hl],a
	; ;generic pointer/integer P:=P+(expr) add expression
	; RHS is pure 
	ld de,$40
	ld hl,[kepernyo]
	add  hl,de
	ld [kepernyo],hl
putimage_color_torol1_fuggoleges_forloopcounter42:
putimage_color_torol1_fuggoleges_loopstart43:
	ld a,[igt1]
	add a,1
	ld [igt1],a
	cp $10
	jr nz,putimage_color_torol1_fuggoleges_forloop40
putimage_color_torol1_fuggoleges_forloopend41:
putimage_color_torol1_fuggoleges_loopend44:
	ret
end_procedure_putimage_color_torol1_fuggoleges:
	
; // -----------------------------------------------------
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
; // megkeressük a SZOVEG.BIN-ben a TXTsor2-edik szöveget és
; // rámutatunk p1-el.  
	; NodeProcedureDecl -1
	; ***********  Defining procedure : ir_BINszoveg_KERES
	;    Procedure type : User-defined procedure
TXTsor2:	db	0
ir_BINszoveg_KERES_block48:
ir_BINszoveg_KERES:
	ld hl,$74fe
	ld [po2],hl
	
; // innen indulunk
	ld hl,$74fe
	ld [p1],hl
	ld a, $0
	ld [x], a
	; ****** Inline assembler section
	
cimke1	
    
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	; Optimization : zp[0]
	ld hl,[po2]
	ld a,[hl]
	cp $cb
	jr nz,ir_BINszoveg_KERES_elsedoneblock52
ir_BINszoveg_KERES_ConditionalTrueBlock50: ;Main true block ;keep :
	; 'a:=a + const'  optimization 
	ld a,[x]
	add  a,$1
	ld [x], a
	; Binary clause core: EQUALS
	; Compare two vars optimization
	ld a,[TXTsor2]
	ld b,a
	ld a,[x]
	cp b
	jr nz,ir_BINszoveg_KERES_elsedoneblock64
ir_BINszoveg_KERES_ConditionalTrueBlock62: ;Main true block ;keep :
	; Generic assign 16-bit pointer
	; Generic 16-bit binop
	ld hl,$1
	ex de,hl
	; Variable is 16-bit
	ld hl,[po2]
	add hl,de
	; Store 16-bit address
	ld [p1],hl
	; ****** Inline assembler section
	
		  	 jp cimke2
		     
ir_BINszoveg_KERES_elsedoneblock64:
ir_BINszoveg_KERES_elsedoneblock52:
	; ;generic pointer/integer P:=P+(expr) add expression
	; RHS is pure 
	ld de,$1
	ld hl,[po2]
	add  hl,de
	ld [po2],hl
	; Binary clause core: GREATER
	; Binary clause INTEGER: GREATER
	ld hl,$78ff
	push hl
	; Variable is 16-bit
	ld hl,[po2]
	pop de
	xor a ; clear carry
	sbc hl,de
	jr c, ir_BINszoveg_KERES_elsedoneblock70
	jr z, ir_BINszoveg_KERES_elsedoneblock70
ir_BINszoveg_KERES_ConditionalTrueBlock68: ;Main true block ;keep :
	; ****** Inline assembler section
	
		  	 jp cimke2
		     
ir_BINszoveg_KERES_elsedoneblock70:
	; ****** Inline assembler section
	
	  NOP
	  jp cimke1
cimke2	
	  NOP
    
	ret
end_procedure_ir_BINszoveg_KERES:
	; NodeProcedureDecl -1
	; ***********  Defining procedure : ir_BINszoveg
	;    Procedure type : User-defined procedure
xx:	db	0
yy:	db	0
TXTsor:	db	0
ir_BINszoveg_block73:
ir_BINszoveg:
	; generic assign 
	ld a,[TXTsor]
	ld [TXTsor2], a
	call ir_BINszoveg_KERES
	; generic assign 
	ld a,[xx]
	ld [xe], a
	; generic assign 
	ld a,[yy]
	ld [ye], a
	call kiszamol_kepernyo_ertek
	ld hl,$78ff
	ld [mem2],hl
	ld a, $1
	ld [x], a
	; ****** Inline assembler section
	
ir_BINszoveg_cimke1	
    
	; generic assign 
	; Optimization : zp[0]
	ld hl,[p1]
	ld a,[hl]
	ld [varPrefixed_i], a
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	ld a,[varPrefixed_i]
	cp $c9
	jr nz,ir_BINszoveg_elsedoneblock77
ir_BINszoveg_ConditionalTrueBlock75: ;Main true block ;keep :
	ld a, $0
	ld [x], a
ir_BINszoveg_elsedoneblock77:
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	ld a,[x]
	cp $1
	jr nz,ir_BINszoveg_elsedoneblock83
ir_BINszoveg_ConditionalTrueBlock81: ;Main true block ;keep :
	; Generic assign 16-bit pointer
	; Generic 16-bit binop
	; Generic mul
	; Variable is 16-bit
	ld a,[varPrefixed_i]
	ld e,a
	ld d,0
	ld a,$8
	ld hl,0
	ld c,0
	call mul_16x8
	ex de,hl
	ld hl,$78ff
	add hl,de
	; Store 16-bit address
	ld [mem2],hl
	ld hl,[kepernyo]
	ld [po5],hl
	call putimage_a8x8
	; ;generic pointer/integer P:=P+(expr) add expression
	; RHS is pure 
	ld de,$2
	ld hl,[kepernyo]
	add  hl,de
	ld [kepernyo],hl
	; ;generic pointer/integer P:=P+(expr) add expression
	; RHS is pure 
	ld de,$1
	ld hl,[p1]
	add  hl,de
	ld [p1],hl
	; ****** Inline assembler section
	
	  jp ir_BINszoveg_cimke1
    
ir_BINszoveg_elsedoneblock83:
	ret
end_procedure_ir_BINszoveg:
	
; // -----------------------------------------------------
; // ----------------- GÉPI Játékos ----------------------
; // -----------------------------------------------------
; // 1  -gondolkodik
	; NodeProcedureDecl -1
	; ***********  Defining procedure : sprite_gondolkodik
	;    Procedure type : User-defined procedure
sprite_gondolkodik:
	; generic assign 
	; Generic mul
	ld a,$10
	ld e,a
	ld d,0
	ld a,[yem]
	ld h,a
	ld l,0
	call mul_8x8
	ld a,l
	push af
	ld a,[xem]
	ld b,a
	pop af
	add  a, b
	ld [ciim], a
	; Binary clause core: EQUALS
	ld a,$0
	ld c, a
	ld b,$3
	ld a,[Ran]
	and  b
	cp c
	jr nz,sprite_gondolkodik_elsedoneblock93
sprite_gondolkodik_ConditionalTrueBlock91: ;Main true block ;keep :
	; Binary clause core: GREATER
	; Compare with pure num / var optimization
	ld a,[yem]
	cp $0
	jr c, sprite_gondolkodik_elsedoneblock135
	jr z, sprite_gondolkodik_elsedoneblock135
sprite_gondolkodik_ConditionalTrueBlock133: ;Main true block ;keep :
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	ld b,$10
	ld a,[ciim]
	sub  b
	ld e,a ; variable is 8-bit
	ld d,0
	ld hl,map
	add hl,de
	ld a,[hl]
	; LoadVar Testing if 'map' is word : 0
	cp $0
	jr nz,sprite_gondolkodik_elsedoneblock147
sprite_gondolkodik_ConditionalTrueBlock145: ;Main true block ;keep :
	ld a, $2
	ld [me], a
sprite_gondolkodik_elsedoneblock147:
sprite_gondolkodik_elsedoneblock135:
	; Binary clause core: LESS
	; Compare with pure num / var optimization
	ld a,[yem]
	cp $e
	jr nc,sprite_gondolkodik_elsedoneblock153
sprite_gondolkodik_ConditionalTrueBlock151: ;Main true block ;keep :
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	ld b,$10
	ld a,[ciim]
	add  a, b
	ld e,a ; variable is 8-bit
	ld d,0
	ld hl,map
	add hl,de
	ld a,[hl]
	; LoadVar Testing if 'map' is word : 0
	cp $0
	jr nz,sprite_gondolkodik_elsedoneblock165
sprite_gondolkodik_ConditionalTrueBlock163: ;Main true block ;keep :
	ld a, $4
	ld [me], a
sprite_gondolkodik_elsedoneblock165:
sprite_gondolkodik_elsedoneblock153:
sprite_gondolkodik_elsedoneblock93:
	; Binary clause core: EQUALS
	ld a,$1
	ld c, a
	ld b,$3
	ld a,[Ran]
	and  b
	cp c
	jr nz,sprite_gondolkodik_elsedoneblock171
sprite_gondolkodik_ConditionalTrueBlock169: ;Main true block ;keep :
	; Binary clause core: GREATER
	; Compare with pure num / var optimization
	ld a,[xem]
	cp $0
	jr c, sprite_gondolkodik_elsedoneblock213
	jr z, sprite_gondolkodik_elsedoneblock213
sprite_gondolkodik_ConditionalTrueBlock211: ;Main true block ;keep :
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	ld b,$1
	ld a,[ciim]
	sub  b
	ld e,a ; variable is 8-bit
	ld d,0
	ld hl,map
	add hl,de
	ld a,[hl]
	; LoadVar Testing if 'map' is word : 0
	cp $0
	jr nz,sprite_gondolkodik_elsedoneblock225
sprite_gondolkodik_ConditionalTrueBlock223: ;Main true block ;keep :
	ld a, $5
	ld [me], a
sprite_gondolkodik_elsedoneblock225:
sprite_gondolkodik_elsedoneblock213:
	; Binary clause core: LESS
	; Compare with pure num / var optimization
	ld a,[xem]
	cp $f
	jr nc,sprite_gondolkodik_elsedoneblock231
sprite_gondolkodik_ConditionalTrueBlock229: ;Main true block ;keep :
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	ld b,$1
	ld a,[ciim]
	add  a, b
	ld e,a ; variable is 8-bit
	ld d,0
	ld hl,map
	add hl,de
	ld a,[hl]
	; LoadVar Testing if 'map' is word : 0
	cp $0
	jr nz,sprite_gondolkodik_elsedoneblock243
sprite_gondolkodik_ConditionalTrueBlock241: ;Main true block ;keep :
	ld a, $3
	ld [me], a
sprite_gondolkodik_elsedoneblock243:
sprite_gondolkodik_elsedoneblock231:
sprite_gondolkodik_elsedoneblock171:
	; Binary clause core: EQUALS
	ld a,$2
	ld c, a
	ld b,$3
	ld a,[Ran]
	and  b
	cp c
	jr nz,sprite_gondolkodik_elsedoneblock249
sprite_gondolkodik_ConditionalTrueBlock247: ;Main true block ;keep :
	; Binary clause core: LESS
	; Compare with pure num / var optimization
	ld a,[yem]
	cp $e
	jr nc,sprite_gondolkodik_elsedoneblock291
sprite_gondolkodik_ConditionalTrueBlock289: ;Main true block ;keep :
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	ld b,$10
	ld a,[ciim]
	add  a, b
	ld e,a ; variable is 8-bit
	ld d,0
	ld hl,map
	add hl,de
	ld a,[hl]
	; LoadVar Testing if 'map' is word : 0
	cp $0
	jr nz,sprite_gondolkodik_elsedoneblock303
sprite_gondolkodik_ConditionalTrueBlock301: ;Main true block ;keep :
	ld a, $4
	ld [me], a
sprite_gondolkodik_elsedoneblock303:
sprite_gondolkodik_elsedoneblock291:
	; Binary clause core: GREATER
	; Compare with pure num / var optimization
	ld a,[yem]
	cp $0
	jr c, sprite_gondolkodik_elsedoneblock309
	jr z, sprite_gondolkodik_elsedoneblock309
sprite_gondolkodik_ConditionalTrueBlock307: ;Main true block ;keep :
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	ld b,$10
	ld a,[ciim]
	sub  b
	ld e,a ; variable is 8-bit
	ld d,0
	ld hl,map
	add hl,de
	ld a,[hl]
	; LoadVar Testing if 'map' is word : 0
	cp $0
	jr nz,sprite_gondolkodik_elsedoneblock321
sprite_gondolkodik_ConditionalTrueBlock319: ;Main true block ;keep :
	ld a, $2
	ld [me], a
sprite_gondolkodik_elsedoneblock321:
sprite_gondolkodik_elsedoneblock309:
sprite_gondolkodik_elsedoneblock249:
	; Binary clause core: EQUALS
	ld a,$3
	ld c, a
	ld b,$3
	ld a,[Ran]
	and  b
	cp c
	jr nz,sprite_gondolkodik_elsedoneblock327
sprite_gondolkodik_ConditionalTrueBlock325: ;Main true block ;keep :
	; Binary clause core: LESS
	; Compare with pure num / var optimization
	ld a,[xem]
	cp $f
	jr nc,sprite_gondolkodik_elsedoneblock369
sprite_gondolkodik_ConditionalTrueBlock367: ;Main true block ;keep :
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	ld b,$1
	ld a,[ciim]
	add  a, b
	ld e,a ; variable is 8-bit
	ld d,0
	ld hl,map
	add hl,de
	ld a,[hl]
	; LoadVar Testing if 'map' is word : 0
	cp $0
	jr nz,sprite_gondolkodik_elsedoneblock381
sprite_gondolkodik_ConditionalTrueBlock379: ;Main true block ;keep :
	ld a, $3
	ld [me], a
sprite_gondolkodik_elsedoneblock381:
sprite_gondolkodik_elsedoneblock369:
	; Binary clause core: GREATER
	; Compare with pure num / var optimization
	ld a,[xem]
	cp $0
	jr c, sprite_gondolkodik_elsedoneblock387
	jr z, sprite_gondolkodik_elsedoneblock387
sprite_gondolkodik_ConditionalTrueBlock385: ;Main true block ;keep :
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	ld b,$1
	ld a,[ciim]
	sub  b
	ld e,a ; variable is 8-bit
	ld d,0
	ld hl,map
	add hl,de
	ld a,[hl]
	; LoadVar Testing if 'map' is word : 0
	cp $0
	jr nz,sprite_gondolkodik_elsedoneblock399
sprite_gondolkodik_ConditionalTrueBlock397: ;Main true block ;keep :
	ld a, $5
	ld [me], a
sprite_gondolkodik_elsedoneblock399:
sprite_gondolkodik_elsedoneblock387:
sprite_gondolkodik_elsedoneblock327:
	ld a, $0
	ld [szamol], a
	ret
end_procedure_sprite_gondolkodik:
	
; // 2    FEL
	; NodeProcedureDecl -1
	; ***********  Defining procedure : sprite_mozog_fel
	;    Procedure type : User-defined procedure
sprite_mozog_fel:
	; ;generic pointer/integer P:=P+(expr) add expression
	; RHS is pure 
	; RHS is pure constant of $100
	ld b,$03
	ld a,[ kepernyo+1]
	add a,b
	ld [ kepernyo+1],a
	call putimage_color_torol1_vizszintes
	; 'a:=a + const'  optimization 
	ld a,[ye]
	sub $4
	ld [ye], a
	; 'a:=a + const'  optimization 
	ld a,[szamol]
	add  a,$1
	ld [szamol], a
	; Binary clause core: GREATER
	; Compare with pure num / var optimization
	ld a,[szamol]
	cp $3
	jr c, sprite_mozog_fel_elsedoneblock406
	jr z, sprite_mozog_fel_elsedoneblock406
sprite_mozog_fel_ConditionalTrueBlock404: ;Main true block ;keep :
	ld a, $0
	ld [szamol], a
	; 'a:=a + const'  optimization 
	ld a,[yem]
	sub $1
	ld [yem], a
	ld a, $1
	ld [me], a
	; Binary clause core: EQUALS
	ld a,$0
	ld c, a
	ld b,$8
	ld a,[Ran]
	and  b
	cp c
	jr nz,sprite_mozog_fel_elsedoneblock456
sprite_mozog_fel_ConditionalTrueBlock454: ;Main true block ;keep :
	; generic assign 
	; Generic mul
	ld a,$10
	ld e,a
	ld d,0
	ld a,[yem]
	ld h,a
	ld l,0
	call mul_8x8
	ld a,l
	push af
	ld a,[xem]
	ld b,a
	pop af
	add  a, b
	ld [ciim], a
	; Binary clause core: GREATER
	; Compare with pure num / var optimization
	ld a,[yem]
	cp $0
	jr c, sprite_mozog_fel_elsedoneblock482
	jr z, sprite_mozog_fel_elsedoneblock482
sprite_mozog_fel_ConditionalTrueBlock480: ;Main true block ;keep :
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	ld b,$10
	ld a,[ciim]
	sub  b
	ld e,a ; variable is 8-bit
	ld d,0
	ld hl,map
	add hl,de
	ld a,[hl]
	; LoadVar Testing if 'map' is word : 0
	cp $0
	jr nz,sprite_mozog_fel_elsedoneblock494
sprite_mozog_fel_ConditionalTrueBlock492: ;Main true block ;keep :
	ld a, $2
	ld [me], a
sprite_mozog_fel_elsedoneblock494:
sprite_mozog_fel_elsedoneblock482:
sprite_mozog_fel_elsedoneblock456:
sprite_mozog_fel_elsedoneblock406:
	ret
end_procedure_sprite_mozog_fel:
	
; // 3  ----- JOBBRA
	; NodeProcedureDecl -1
	; ***********  Defining procedure : sprite_mozog_jobbra
	;    Procedure type : User-defined procedure
sprite_mozog_jobbra:
	call putimage_color_torol1_fuggoleges
	; 'a:=a + const'  optimization 
	ld a,[xe]
	add  a,$1
	ld [xe], a
	; 'a:=a + const'  optimization 
	ld a,[szamol]
	add  a,$1
	ld [szamol], a
	; Binary clause core: GREATER
	; Compare with pure num / var optimization
	ld a,[szamol]
	cp $3
	jr c, sprite_mozog_jobbra_elsedoneblock501
	jr z, sprite_mozog_jobbra_elsedoneblock501
sprite_mozog_jobbra_ConditionalTrueBlock499: ;Main true block ;keep :
	ld a, $0
	ld [szamol], a
	; 'a:=a + const'  optimization 
	ld a,[xem]
	add  a,$1
	ld [xem], a
	ld a, $1
	ld [me], a
	; Binary clause core: EQUALS
	ld a,$0
	ld c, a
	ld b,$40
	ld a,[Ran]
	and  b
	cp c
	jr nz,sprite_mozog_jobbra_elsedoneblock551
sprite_mozog_jobbra_ConditionalTrueBlock549: ;Main true block ;keep :
	; generic assign 
	; Generic mul
	ld a,$10
	ld e,a
	ld d,0
	ld a,[yem]
	ld h,a
	ld l,0
	call mul_8x8
	ld a,l
	push af
	ld a,[xem]
	ld b,a
	pop af
	add  a, b
	ld [ciim], a
	; Binary clause core: LESS
	; Compare with pure num / var optimization
	ld a,[xem]
	cp $f
	jr nc,sprite_mozog_jobbra_elsedoneblock577
sprite_mozog_jobbra_ConditionalTrueBlock575: ;Main true block ;keep :
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	ld b,$1
	ld a,[ciim]
	add  a, b
	ld e,a ; variable is 8-bit
	ld d,0
	ld hl,map
	add hl,de
	ld a,[hl]
	; LoadVar Testing if 'map' is word : 0
	cp $0
	jr nz,sprite_mozog_jobbra_elsedoneblock589
sprite_mozog_jobbra_ConditionalTrueBlock587: ;Main true block ;keep :
	ld a, $3
	ld [me], a
sprite_mozog_jobbra_elsedoneblock589:
sprite_mozog_jobbra_elsedoneblock577:
sprite_mozog_jobbra_elsedoneblock551:
sprite_mozog_jobbra_elsedoneblock501:
	ret
end_procedure_sprite_mozog_jobbra:
	
; //4 ----   LE
	; NodeProcedureDecl -1
	; ***********  Defining procedure : sprite_mozog_le
	;    Procedure type : User-defined procedure
sprite_mozog_le:
	call putimage_color_torol1_vizszintes
	; 'a:=a + const'  optimization 
	ld a,[ye]
	add  a,$4
	ld [ye], a
	; 'a:=a + const'  optimization 
	ld a,[szamol]
	add  a,$1
	ld [szamol], a
	; Binary clause core: GREATER
	; Compare with pure num / var optimization
	ld a,[szamol]
	cp $3
	jr c, sprite_mozog_le_elsedoneblock596
	jr z, sprite_mozog_le_elsedoneblock596
sprite_mozog_le_ConditionalTrueBlock594: ;Main true block ;keep :
	ld a, $0
	ld [szamol], a
	; 'a:=a + const'  optimization 
	ld a,[yem]
	add  a,$1
	ld [yem], a
	ld a, $1
	ld [me], a
	; Binary clause core: EQUALS
	ld a,$0
	ld c, a
	ld b,$2
	ld a,[Ran]
	and  b
	cp c
	jr nz,sprite_mozog_le_elsedoneblock646
sprite_mozog_le_ConditionalTrueBlock644: ;Main true block ;keep :
	; generic assign 
	; Generic mul
	ld a,$10
	ld e,a
	ld d,0
	ld a,[yem]
	ld h,a
	ld l,0
	call mul_8x8
	ld a,l
	push af
	ld a,[xem]
	ld b,a
	pop af
	add  a, b
	ld [ciim], a
	; Binary clause core: LESS
	; Compare with pure num / var optimization
	ld a,[yem]
	cp $e
	jr nc,sprite_mozog_le_elsedoneblock672
sprite_mozog_le_ConditionalTrueBlock670: ;Main true block ;keep :
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	ld b,$10
	ld a,[ciim]
	add  a, b
	ld e,a ; variable is 8-bit
	ld d,0
	ld hl,map
	add hl,de
	ld a,[hl]
	; LoadVar Testing if 'map' is word : 0
	cp $0
	jr nz,sprite_mozog_le_elsedoneblock684
sprite_mozog_le_ConditionalTrueBlock682: ;Main true block ;keep :
	ld a, $4
	ld [me], a
sprite_mozog_le_elsedoneblock684:
sprite_mozog_le_elsedoneblock672:
sprite_mozog_le_elsedoneblock646:
sprite_mozog_le_elsedoneblock596:
	ret
end_procedure_sprite_mozog_le:
	
; // 5  ----  BALRA
	; NodeProcedureDecl -1
	; ***********  Defining procedure : sprite_mozog_balra
	;    Procedure type : User-defined procedure
sprite_mozog_balra:
	; ;generic pointer/integer P:=P+(expr) add expression
	; RHS is pure 
	ld de,$3
	ld hl,[kepernyo]
	add  hl,de
	ld [kepernyo],hl
	call putimage_color_torol1_fuggoleges
	; 'a:=a + const'  optimization 
	ld a,[xe]
	sub $1
	ld [xe], a
	; 'a:=a + const'  optimization 
	ld a,[szamol]
	add  a,$1
	ld [szamol], a
	; Binary clause core: GREATER
	; Compare with pure num / var optimization
	ld a,[szamol]
	cp $3
	jr c, sprite_mozog_balra_elsedoneblock691
	jr z, sprite_mozog_balra_elsedoneblock691
sprite_mozog_balra_ConditionalTrueBlock689: ;Main true block ;keep :
	ld a, $0
	ld [szamol], a
	; 'a:=a + const'  optimization 
	ld a,[xem]
	sub $1
	ld [xem], a
	ld a, $1
	ld [me], a
	; Binary clause core: EQUALS
	ld a,$0
	ld c, a
	ld b,$20
	ld a,[Ran]
	and  b
	cp c
	jr nz,sprite_mozog_balra_elsedoneblock741
sprite_mozog_balra_ConditionalTrueBlock739: ;Main true block ;keep :
	; generic assign 
	; Generic mul
	ld a,$10
	ld e,a
	ld d,0
	ld a,[yem]
	ld h,a
	ld l,0
	call mul_8x8
	ld a,l
	push af
	ld a,[xem]
	ld b,a
	pop af
	add  a, b
	ld [ciim], a
	; Binary clause core: GREATER
	; Compare with pure num / var optimization
	ld a,[xem]
	cp $0
	jr c, sprite_mozog_balra_elsedoneblock767
	jr z, sprite_mozog_balra_elsedoneblock767
sprite_mozog_balra_ConditionalTrueBlock765: ;Main true block ;keep :
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	ld b,$1
	ld a,[ciim]
	sub  b
	ld e,a ; variable is 8-bit
	ld d,0
	ld hl,map
	add hl,de
	ld a,[hl]
	; LoadVar Testing if 'map' is word : 0
	cp $0
	jr nz,sprite_mozog_balra_elsedoneblock779
sprite_mozog_balra_ConditionalTrueBlock777: ;Main true block ;keep :
	ld a, $5
	ld [me], a
sprite_mozog_balra_elsedoneblock779:
sprite_mozog_balra_elsedoneblock767:
sprite_mozog_balra_elsedoneblock741:
sprite_mozog_balra_elsedoneblock691:
	ret
end_procedure_sprite_mozog_balra:
	
; // --------------------------------------------------
; // ---------------- Főszereplő mozgása --------------
; // --------------------------------------------------
; // jobbra
	; NodeProcedureDecl -1
	; ***********  Defining procedure : sprite_mozgat_foszereplo_jobbra
	;    Procedure type : User-defined procedure
sprite_mozgat_foszereplo_jobbra:
	call putimage_color_torol1_fuggoleges
	; 'a:=a + const'  optimization 
	ld a,[xe]
	add  a,$1
	ld [xe], a
	; 'a:=a + const'  optimization 
	ld a,[szamol]
	add  a,$1
	ld [szamol], a
	; Binary clause core: GREATER
	; Compare with pure num / var optimization
	ld a,[szamol]
	cp $3
	jr c, sprite_mozgat_foszereplo_jobbra_elsedoneblock786
	jr z, sprite_mozgat_foszereplo_jobbra_elsedoneblock786
sprite_mozgat_foszereplo_jobbra_ConditionalTrueBlock784: ;Main true block ;keep :
	; 'a:=a + const'  optimization 
	ld a,[xem]
	add  a,$1
	ld [xem], a
	ld a, $0
	ld [szamol], a
	ld a, $9
	ld [me], a
sprite_mozgat_foszereplo_jobbra_elsedoneblock786:
	ret
end_procedure_sprite_mozgat_foszereplo_jobbra:
	
; // balra
	; NodeProcedureDecl -1
	; ***********  Defining procedure : sprite_mozgat_foszereplo_balra
	;    Procedure type : User-defined procedure
sprite_mozgat_foszereplo_balra:
	; ;generic pointer/integer P:=P+(expr) add expression
	; RHS is pure 
	ld de,$3
	ld hl,[kepernyo]
	add  hl,de
	ld [kepernyo],hl
	call putimage_color_torol1_fuggoleges
	; 'a:=a + const'  optimization 
	ld a,[xe]
	sub $1
	ld [xe], a
	; 'a:=a + const'  optimization 
	ld a,[szamol]
	add  a,$1
	ld [szamol], a
	; Binary clause core: GREATER
	; Compare with pure num / var optimization
	ld a,[szamol]
	cp $3
	jr c, sprite_mozgat_foszereplo_balra_elsedoneblock793
	jr z, sprite_mozgat_foszereplo_balra_elsedoneblock793
sprite_mozgat_foszereplo_balra_ConditionalTrueBlock791: ;Main true block ;keep :
	; 'a:=a + const'  optimization 
	ld a,[xem]
	sub $1
	ld [xem], a
	ld a, $0
	ld [szamol], a
	ld a, $9
	ld [me], a
sprite_mozgat_foszereplo_balra_elsedoneblock793:
	ret
end_procedure_sprite_mozgat_foszereplo_balra:
	
; // fel
	; NodeProcedureDecl -1
	; ***********  Defining procedure : sprite_mozgat_foszereplo_fel
	;    Procedure type : User-defined procedure
sprite_mozgat_foszereplo_fel:
	; ;generic pointer/integer P:=P+(expr) add expression
	; RHS is pure 
	; RHS is pure constant of $100
	ld b,$03
	ld a,[ kepernyo+1]
	add a,b
	ld [ kepernyo+1],a
	call putimage_color_torol1_vizszintes
	; 'a:=a + const'  optimization 
	ld a,[ye]
	sub $4
	ld [ye], a
	; 'a:=a + const'  optimization 
	ld a,[szamol]
	add  a,$1
	ld [szamol], a
	; Binary clause core: GREATER
	; Compare with pure num / var optimization
	ld a,[szamol]
	cp $3
	jr c, sprite_mozgat_foszereplo_fel_elsedoneblock800
	jr z, sprite_mozgat_foszereplo_fel_elsedoneblock800
sprite_mozgat_foszereplo_fel_ConditionalTrueBlock798: ;Main true block ;keep :
	; 'a:=a + const'  optimization 
	ld a,[yem]
	sub $1
	ld [yem], a
	ld a, $0
	ld [szamol], a
	ld a, $9
	ld [me], a
sprite_mozgat_foszereplo_fel_elsedoneblock800:
	ret
end_procedure_sprite_mozgat_foszereplo_fel:
	
; // le
	; NodeProcedureDecl -1
	; ***********  Defining procedure : sprite_mozgat_foszereplo_le
	;    Procedure type : User-defined procedure
sprite_mozgat_foszereplo_le:
	call putimage_color_torol1_vizszintes
	; 'a:=a + const'  optimization 
	ld a,[ye]
	add  a,$4
	ld [ye], a
	; 'a:=a + const'  optimization 
	ld a,[szamol]
	add  a,$1
	ld [szamol], a
	; Binary clause core: GREATER
	; Compare with pure num / var optimization
	ld a,[szamol]
	cp $3
	jr c, sprite_mozgat_foszereplo_le_elsedoneblock807
	jr z, sprite_mozgat_foszereplo_le_elsedoneblock807
sprite_mozgat_foszereplo_le_ConditionalTrueBlock805: ;Main true block ;keep :
	; 'a:=a + const'  optimization 
	ld a,[yem]
	add  a,$1
	ld [yem], a
	ld a, $0
	ld [szamol], a
	ld a, $9
	ld [me], a
sprite_mozgat_foszereplo_le_elsedoneblock807:
	ret
end_procedure_sprite_mozgat_foszereplo_le:
	
; // ---------------------------------------------------------
; // --------- Főszereplő irányítása joystickkal -------------
	; NodeProcedureDecl -1
	; ***********  Defining procedure : sprite_mozgat_joystick
	;    Procedure type : User-defined procedure
sprite_mozgat_joystick:
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	ld a,[me]
	cp $9
	jp nz,sprite_mozgat_joystick_elsedoneblock814
sprite_mozgat_joystick_ConditionalTrueBlock812: ;Main true block ;keep :
	ld hl,$b59
	ld [po],hl
	
; // a 2905-ös címen érjük el a joy-t
	; generic assign 
	; Optimization : zp[0]
	ld hl,[po]
	ld a,[hl]
	ld [varPrefixed_a], a
	; Binary clause core: EQUALS
	ld a,$2
	ld c, a
	ld b,$2
	ld a,[varPrefixed_a]
	and  b
	cp c
	jr nz,sprite_mozgat_joystick_elsedoneblock996
sprite_mozgat_joystick_ConditionalTrueBlock994: ;Main true block ;keep :
	
; // FEL
; // ---------- FEL ------------------- 
	; generic assign 
	; Generic mul
	ld a,$10
	ld e,a
	ld d,0
	ld a,[yem]
	ld h,a
	ld l,0
	call mul_8x8
	ld a,l
	push af
	ld a,[xem]
	ld b,a
	pop af
	add  a, b
	ld [ciim], a
	ld a, $0
	ld [szamol], a
	; Binary clause core: GREATER
	; Compare with pure num / var optimization
	ld a,[yem]
	cp $0
	jr c, sprite_mozgat_joystick_elsedoneblock1022
	jr z, sprite_mozgat_joystick_elsedoneblock1022
sprite_mozgat_joystick_ConditionalTrueBlock1020: ;Main true block ;keep :
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	ld b,$10
	ld a,[ciim]
	sub  b
	ld e,a ; variable is 8-bit
	ld d,0
	ld hl,map
	add hl,de
	ld a,[hl]
	; LoadVar Testing if 'map' is word : 0
	cp $0
	jr nz,sprite_mozgat_joystick_elsedoneblock1034
sprite_mozgat_joystick_ConditionalTrueBlock1032: ;Main true block ;keep :
	ld a, $b
	ld [me], a
sprite_mozgat_joystick_elsedoneblock1034:
sprite_mozgat_joystick_elsedoneblock1022:
sprite_mozgat_joystick_elsedoneblock996:
	; Binary clause core: EQUALS
	ld a,$4
	ld c, a
	ld b,$4
	ld a,[varPrefixed_a]
	and  b
	cp c
	jr nz,sprite_mozgat_joystick_elsedoneblock1040
sprite_mozgat_joystick_ConditionalTrueBlock1038: ;Main true block ;keep :
	
; // LE
; // ----------- LE -------------------
	; generic assign 
	; Generic mul
	ld a,$10
	ld e,a
	ld d,0
	ld a,[yem]
	ld h,a
	ld l,0
	call mul_8x8
	ld a,l
	push af
	ld a,[xem]
	ld b,a
	pop af
	add  a, b
	ld [ciim], a
	ld a, $0
	ld [szamol], a
	; Binary clause core: LESS
	; Compare with pure num / var optimization
	ld a,[yem]
	cp $e
	jr nc,sprite_mozgat_joystick_elsedoneblock1066
sprite_mozgat_joystick_ConditionalTrueBlock1064: ;Main true block ;keep :
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	ld b,$10
	ld a,[ciim]
	add  a, b
	ld e,a ; variable is 8-bit
	ld d,0
	ld hl,map
	add hl,de
	ld a,[hl]
	; LoadVar Testing if 'map' is word : 0
	cp $0
	jr nz,sprite_mozgat_joystick_elsedoneblock1078
sprite_mozgat_joystick_ConditionalTrueBlock1076: ;Main true block ;keep :
	ld a, $c
	ld [me], a
sprite_mozgat_joystick_elsedoneblock1078:
sprite_mozgat_joystick_elsedoneblock1066:
sprite_mozgat_joystick_elsedoneblock1040:
	; Binary clause core: EQUALS
	ld a,$20
	ld c, a
	ld b,$20
	ld a,[varPrefixed_a]
	and  b
	cp c
	jr nz,sprite_mozgat_joystick_elsedoneblock1084
sprite_mozgat_joystick_ConditionalTrueBlock1082: ;Main true block ;keep :
	
; // JOBBRA
; // ---------- JOBBRA --------------
	; generic assign 
	; Generic mul
	ld a,$10
	ld e,a
	ld d,0
	ld a,[yem]
	ld h,a
	ld l,0
	call mul_8x8
	ld a,l
	push af
	ld a,[xem]
	ld b,a
	pop af
	add  a, b
	ld [ciim], a
	ld a, $0
	ld [szamol], a
	; Binary clause core: LESS
	; Compare with pure num / var optimization
	ld a,[xem]
	cp $f
	jr nc,sprite_mozgat_joystick_elsedoneblock1110
sprite_mozgat_joystick_ConditionalTrueBlock1108: ;Main true block ;keep :
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	ld b,$1
	ld a,[ciim]
	add  a, b
	ld e,a ; variable is 8-bit
	ld d,0
	ld hl,map
	add hl,de
	ld a,[hl]
	; LoadVar Testing if 'map' is word : 0
	cp $0
	jr nz,sprite_mozgat_joystick_elsedoneblock1122
sprite_mozgat_joystick_ConditionalTrueBlock1120: ;Main true block ;keep :
	ld a, $d
	ld [me], a
sprite_mozgat_joystick_elsedoneblock1122:
sprite_mozgat_joystick_elsedoneblock1110:
sprite_mozgat_joystick_elsedoneblock1084:
	; Binary clause core: EQUALS
	ld a,$40
	ld c, a
	ld b,$40
	ld a,[varPrefixed_a]
	and  b
	cp c
	jr nz,sprite_mozgat_joystick_elsedoneblock1128
sprite_mozgat_joystick_ConditionalTrueBlock1126: ;Main true block ;keep :
	
; // BALRA
; // ---------- BALRA ---------------
	; generic assign 
	; Generic mul
	ld a,$10
	ld e,a
	ld d,0
	ld a,[yem]
	ld h,a
	ld l,0
	call mul_8x8
	ld a,l
	push af
	ld a,[xem]
	ld b,a
	pop af
	add  a, b
	ld [ciim], a
	ld a, $0
	ld [szamol], a
	; Binary clause core: GREATER
	; Compare with pure num / var optimization
	ld a,[xem]
	cp $0
	jr c, sprite_mozgat_joystick_elsedoneblock1154
	jr z, sprite_mozgat_joystick_elsedoneblock1154
sprite_mozgat_joystick_ConditionalTrueBlock1152: ;Main true block ;keep :
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	ld b,$1
	ld a,[ciim]
	sub  b
	ld e,a ; variable is 8-bit
	ld d,0
	ld hl,map
	add hl,de
	ld a,[hl]
	; LoadVar Testing if 'map' is word : 0
	cp $0
	jr nz,sprite_mozgat_joystick_elsedoneblock1166
sprite_mozgat_joystick_ConditionalTrueBlock1164: ;Main true block ;keep :
	ld a, $e
	ld [me], a
sprite_mozgat_joystick_elsedoneblock1166:
sprite_mozgat_joystick_elsedoneblock1154:
sprite_mozgat_joystick_elsedoneblock1128:
sprite_mozgat_joystick_elsedoneblock814:
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	ld a,[me]
	cp $b
	jr nz,sprite_mozgat_joystick_elsedoneblock1172
sprite_mozgat_joystick_ConditionalTrueBlock1170: ;Main true block ;keep :
	call sprite_mozgat_foszereplo_fel
sprite_mozgat_joystick_elsedoneblock1172:
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	ld a,[me]
	cp $c
	jr nz,sprite_mozgat_joystick_elsedoneblock1178
sprite_mozgat_joystick_ConditionalTrueBlock1176: ;Main true block ;keep :
	call sprite_mozgat_foszereplo_le
sprite_mozgat_joystick_elsedoneblock1178:
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	ld a,[me]
	cp $d
	jr nz,sprite_mozgat_joystick_elsedoneblock1184
sprite_mozgat_joystick_ConditionalTrueBlock1182: ;Main true block ;keep :
	call sprite_mozgat_foszereplo_jobbra
sprite_mozgat_joystick_elsedoneblock1184:
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	ld a,[me]
	cp $e
	jr nz,sprite_mozgat_joystick_elsedoneblock1190
sprite_mozgat_joystick_ConditionalTrueBlock1188: ;Main true block ;keep :
	call sprite_mozgat_foszereplo_balra
sprite_mozgat_joystick_elsedoneblock1190:
	ret
end_procedure_sprite_mozgat_joystick:
	
; // --------------------------------------------------
; // ---- A gépi és emberi játékost is ez irányítja ---
; // --- mem pointer a megfelelő sprite címére mutat --
	; NodeProcedureDecl -1
	; ***********  Defining procedure : objektum
	;    Procedure type : User-defined procedure
objektum:
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	; Optimization : zp[0]
	ld hl,[mem]
	ld a,[hl]
	cp $0
	jr nz,objektum_elsedoneblock1197
objektum_ConditionalTrueBlock1195: ;Main true block ;keep :
	
; // nem létezik a sprite, "kilépés"
	ret
objektum_elsedoneblock1197:
	call random_szamgeneralas
	
; //"betöltjük" az adatokat, közvetlenül a memóriában tároljuk ezeket, 
; // nem változóban, így nagyobb helyet foglalhatnak, bárhová 
; // helyezhetők.
	; generic assign 
	; Optimization : zp[0]
	ld hl,[mem]
	ld a,[hl]
	ld [me], a
	
; // milyen mozgást végez
	; generic assign 
	ld de,$1
	ld hl,[mem]
	add hl,de
	ld a,[hl]
	; LoadVar Testing if 'mem' is word : 0
	ld [xe], a
	
; // X helyzet a képernyőn(4 bixel)
	; generic assign 
	ld de,$2
	ld hl,[mem]
	add hl,de
	ld a,[hl]
	; LoadVar Testing if 'mem' is word : 0
	ld [ye], a
	
; // Y helyzet a képernyőn(pixel)
	; generic assign 
	ld de,$6
	ld hl,[mem]
	add hl,de
	ld a,[hl]
	; LoadVar Testing if 'mem' is word : 0
	ld [xem], a
	
; // X helyzet a pályán
	; generic assign 
	ld de,$7
	ld hl,[mem]
	add hl,de
	ld a,[hl]
	; LoadVar Testing if 'mem' is word : 0
	ld [yem], a
	
; // Y helyzet a pályán
	; generic assign 
	ld de,$5
	ld hl,[mem]
	add hl,de
	ld a,[hl]
	; LoadVar Testing if 'mem' is word : 0
	ld [kep], a
	
; // képe, rajza
	; generic assign 
	ld de,$8
	ld hl,[mem]
	add hl,de
	ld a,[hl]
	; LoadVar Testing if 'mem' is word : 0
	ld [szamol], a
	call kiszamol_kepernyo_ertek
	
; // megjelenítéshez, törléshez kell
; // s-be töltjük, hogy milyen mozgást végez a sprite
	; generic assign 
	ld a,[me]
	ld [s], a
	ld a,[s]
	cp $1
	jr nz,objektum_casenext1201
	
; // ---------  na ez vezérli a valósi mozgást ----------
	call sprite_gondolkodik
	jp objektum_caseend1200
objektum_casenext1201:
	ld a,[s]
	cp $2
	jr nz,objektum_casenext1203
	call sprite_mozog_fel
	jp objektum_caseend1200
objektum_casenext1203:
	ld a,[s]
	cp $3
	jr nz,objektum_casenext1205
	call sprite_mozog_jobbra
	jp objektum_caseend1200
objektum_casenext1205:
	ld a,[s]
	cp $4
	jr nz,objektum_casenext1207
	call sprite_mozog_le
	jp objektum_caseend1200
objektum_casenext1207:
	ld a,[s]
	cp $5
	jr nz,objektum_casenext1209
	call sprite_mozog_balra
	jp objektum_caseend1200
objektum_casenext1209:
	ld a,[s]
	cp $9
	jr nz,objektum_casenext1211
	call sprite_mozgat_joystick
	jp objektum_caseend1200
objektum_casenext1211:
	ld a,[s]
	cp $b
	jr nz,objektum_casenext1213
	call sprite_mozgat_foszereplo_fel
	jp objektum_caseend1200
objektum_casenext1213:
	ld a,[s]
	cp $c
	jr nz,objektum_casenext1215
	call sprite_mozgat_foszereplo_le
	jp objektum_caseend1200
objektum_casenext1215:
	ld a,[s]
	cp $d
	jr nz,objektum_casenext1217
	call sprite_mozgat_foszereplo_jobbra
	jp objektum_caseend1200
objektum_casenext1217:
	ld a,[s]
	cp $e
	jr nz,objektum_casenext1219
	call sprite_mozgat_foszereplo_balra
objektum_casenext1219:
objektum_caseend1200:
	
; // --------  kirajzoljuk az "új helyre" a sprite-ot  -------
	; generic assign 
	; Generic mul
	; Variable is 16-bit
	ld a,[kep]
	ld e,a
	ld d,0
	ld a,$40
	ld hl,0
	ld c,0
	call mul_16x8
	; Integer assignment 
	; Loading pointer
	ld [ii],hl
	call kiszamol_kepernyo_ertek
	ld hl,[kepernyo]
	ld [po4],hl
	call putimage_a
	
; // -----  és mentjük az adatait ---------------------------
	ld hl,[mem]
	ld a,[me]
	ld [hl],a
	ld hl,[mem]
	; ; index is pure number optimization
	ld de,$1
	add hl,de
	ld a,[xe]
	ld [hl],a
	ld hl,[mem]
	; ; index is pure number optimization
	ld de,$2
	add hl,de
	ld a,[ye]
	ld [hl],a
	ld hl,[mem]
	; ; index is pure number optimization
	ld de,$6
	add hl,de
	ld a,[xem]
	ld [hl],a
	ld hl,[mem]
	; ; index is pure number optimization
	ld de,$7
	add hl,de
	ld a,[yem]
	ld [hl],a
	ld hl,[mem]
	; ; index is pure number optimization
	ld de,$8
	add hl,de
	ld a,[szamol]
	ld [hl],a
	ret
end_procedure_objektum:
	
; // --------------------------------------------------
; // --------------- Indítunk egy pályát --------------
	; NodeProcedureDecl -1
	; ***********  Defining procedure : palya_generalas
	;    Procedure type : User-defined procedure
xf:	db	0
yf:	db	0
palya_generalas_block1222:
palya_generalas:
	ld a, $0
	ld [fociklusx], a
	ld hl,$7d14
	ld [mem],hl
	ld a, $0
	ld [varPrefixed_i], a
palya_generalas_forloop1223:
	
; // első 10 sprite törlése, ennyi csak elég lesz, de igazából
; // akármennyi lehet, amit a gép elbír(memória, cpu)
	ld hl,[mem]
	ld a,$0
	ld [hl],a
	; ;generic pointer/integer P:=P+(expr) add expression
	; RHS is pure 
	ld de,$a
	ld hl,[mem]
	add  hl,de
	ld [mem],hl
palya_generalas_forloopcounter1225:
palya_generalas_loopstart1226:
	ld a,[varPrefixed_i]
	add a,1
	ld [varPrefixed_i],a
	cp $a
	jr nz,palya_generalas_forloop1223
palya_generalas_forloopend1224:
palya_generalas_loopend1227:
	ld a, $0
	ld [varPrefixed_i], a
palya_generalas_forloop1230:
	
; // MAP-ba töltjük MAP1-et, hogy MAP1 legyen érintetlen
	; Storing to array
	ld a,[varPrefixed_i]
	ld e,a ; variable is 8-bit
	ld d,0
	ld hl,map1
	add hl,de
	ld a,[hl]
	; LoadVar Testing if 'map1' is word : 0
	push af
	ld a,[varPrefixed_i]
	ld e,a
	ld d,0
	ld hl,map
	add hl,de
	pop af
	ld [hl],a
palya_generalas_forloopcounter1232:
palya_generalas_loopstart1233:
	ld a,[varPrefixed_i]
	add a,1
	ld [varPrefixed_i],a
	cp $f0
	jr nz,palya_generalas_forloop1230
palya_generalas_forloopend1231:
palya_generalas_loopend1234:
	
; // Végig megyünk a pályán és ahol 9-es elemet találunk, oda
; // rakunk egy ellenfelet(legfeljebb 10 ellenfél rakható le)
	ld a, $0
	ld [varPrefixed_e], a
	ld hl,$7d14
	ld [mem],hl
	ld a, $0
	ld [ye], a
	ld a, $0
	ld [j], a
palya_generalas_forloop1237:
	ld a, $0
	ld [xe], a
	ld a, $0
	ld [varPrefixed_i], a
palya_generalas_forloop1263:
	; generic assign 
	ld a,[varPrefixed_e]
	ld e,a ; variable is 8-bit
	ld d,0
	ld hl,map
	add hl,de
	ld a,[hl]
	; LoadVar Testing if 'map' is word : 0
	ld [s], a
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	ld a,[s]
	cp $9
	jr nz,palya_generalas_elsedoneblock1279
palya_generalas_ConditionalTrueBlock1277: ;Main true block ;keep :
	
; // 9-es elem, ellenfél
	; Storing to array
	ld a,[varPrefixed_e]
	ld e,a
	ld d,0
	ld hl,map
	add hl,de
	ld a,$0
	ld [hl],a
	
; // mem:=32000;
	ld hl,[mem]
	ld a,$1
	ld [hl],a
	
; //létezik e, mi a sprite
	ld hl,[mem]
	; ; index is pure number optimization
	ld de,$1
	add hl,de
	ld a,[xe]
	ld [hl],a
	
; //x
	ld hl,[mem]
	; ; index is pure number optimization
	ld de,$2
	add hl,de
	ld a,[ye]
	ld [hl],a
	
; //Y
	ld hl,[mem]
	; ; index is pure number optimization
	ld de,$5
	add hl,de
	ld a,$1
	ld [hl],a
	
; //kep
	ld hl,[mem]
	; ; index is pure number optimization
	ld de,$6
	add hl,de
	ld a,[varPrefixed_i]
	ld [hl],a
	
; //xMAP
	ld hl,[mem]
	; ; index is pure number optimization
	ld de,$7
	add hl,de
	ld a,[j]
	ld [hl],a
	
; //YMAP
	ld hl,[mem]
	; ; index is pure number optimization
	ld de,$8
	add hl,de
	ld a,$0
	ld [hl],a
	
; // számláló
	; ;generic pointer/integer P:=P+(expr) add expression
	; RHS is pure 
	ld de,$a
	ld hl,[mem]
	add  hl,de
	ld [mem],hl
palya_generalas_elsedoneblock1279:
	; 'a:=a + const'  optimization 
	ld a,[xe]
	add  a,$4
	ld [xe], a
	; 'a:=a + const'  optimization 
	ld a,[varPrefixed_e]
	add  a,$1
	ld [varPrefixed_e], a
palya_generalas_forloopcounter1265:
palya_generalas_loopstart1266:
	ld a,[varPrefixed_i]
	add a,1
	ld [varPrefixed_i],a
	cp $10
	jp nz,palya_generalas_forloop1263
palya_generalas_forloopend1264:
palya_generalas_loopend1267:
	
; // i
	; 'a:=a + const'  optimization 
	ld a,[ye]
	add  a,$10
	ld [ye], a
palya_generalas_forloopcounter1239:
palya_generalas_loopstart1240:
	ld a,[j]
	add a,1
	ld [j],a
	cp $f
	jp nz,palya_generalas_forloop1237
palya_generalas_forloopend1238:
palya_generalas_loopend1241:
	
; // j
; // egy emberi játékos, most fixen x=5,y=5 pozicióban kezd
; // de később érdemes ezt is megkeresni a pályán mint az ellenfelet
	ld hl,$7d00
	ld [mem],hl
	ld hl,[mem]
	ld a,$9
	ld [hl],a
	
; //mi a sprite
	ld hl,[mem]
	; ; index is pure number optimization
	ld de,$1
	add hl,de
	ld a,$14
	ld [hl],a
	
; //x
	ld hl,[mem]
	; ; index is pure number optimization
	ld de,$2
	add hl,de
	ld a,$50
	ld [hl],a
	
; //Y
	ld hl,[mem]
	; ; index is pure number optimization
	ld de,$5
	add hl,de
	ld a,$2
	ld [hl],a
	
; //kep
	ld hl,[mem]
	; ; index is pure number optimization
	ld de,$6
	add hl,de
	ld a,$5
	ld [hl],a
	
; //xMAP
	ld hl,[mem]
	; ; index is pure number optimization
	ld de,$7
	add hl,de
	ld a,$5
	ld [hl],a
	
; //YMAP
	ld hl,[mem]
	; ; index is pure number optimization
	ld de,$8
	add hl,de
	ld a,$0
	ld [hl],a
	
; // számláló
; // 16x15-ös "pálya" kirajzolása
	ld hl,$8000
	ld [po2],hl
	ld a, $0
	ld [varPrefixed_e], a
	
; // 16*64=1024, 16 sorral lejjebb megyünk
	ld a, $0
	ld [j], a
palya_generalas_forloop1282:
	ld hl,[po2]
	ld [po],hl
	ld a, $0
	ld [varPrefixed_i], a
palya_generalas_forloop1306:
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
	jr nz,palya_generalas_casenext1319
	ld a, $0
	ld [cpclr], a
	ld hl,[po]
	ld [po3],hl
	call putimage_color
	jp palya_generalas_caseend1318
palya_generalas_casenext1319:
	ld a,[s]
	cp $1
	jr nz,palya_generalas_casenext1321
	
; // semmi -fekete kocka
	; generic assign 
	ld hl,$0
	; Integer assignment 
	; Loading pointer
	ld [ii],hl
	ld hl,[po]
	ld [po4],hl
	call putimage_a
palya_generalas_casenext1321:
palya_generalas_caseend1318:
	
; // fal kirajzolása
	; ;generic pointer/integer P:=P+(expr) add expression
	; RHS is pure 
	ld de,$4
	ld hl,[po]
	add  hl,de
	ld [po],hl
palya_generalas_forloopcounter1308:
palya_generalas_loopstart1309:
	ld a,[varPrefixed_i]
	add a,1
	ld [varPrefixed_i],a
	cp $10
	jr nz,palya_generalas_forloop1306
palya_generalas_forloopend1307:
palya_generalas_loopend1310:
	; ;generic pointer/integer P:=P+(expr) add expression
	; RHS is pure 
	; RHS is pure constant of $100
	ld b,$04
	ld a,[ po2+1]
	add a,b
	ld [ po2+1],a
palya_generalas_forloopcounter1284:
palya_generalas_loopstart1285:
	ld a,[j]
	add a,1
	ld [j],a
	cp $f
	jr nz,palya_generalas_forloop1282
palya_generalas_forloopend1283:
palya_generalas_loopend1286:
	
; // felső két kis szöveg kiírása
	ld a, $8
	ld [xx], a
	ld a, $8
	ld [yy], a
	ld a, $5
	ld [TXTsor], a
	call ir_BINszoveg
	ld a, $8
	ld [xx], a
	ld a, $10
	ld [yy], a
	ld a, $6
	ld [TXTsor], a
	call ir_BINszoveg
	ret
end_procedure_palya_generalas:
	
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
	; NodeProcedureDecl -1
	; ***********  Defining procedure : VARAKOZIK_BARMILYEN_BILLENTYU_LENYOMASRA
	;    Procedure type : User-defined procedure
VARAKOZIK_BARMILYEN_BILLENTYU_LENYOMASRA:
	; ****** Inline assembler section
	
		rst	$30
		db	$91// Várakozás billentyű lenyomásra
		ret
    
	ret
end_procedure_VARAKOZIK_BARMILYEN_BILLENTYU_LENYOMASRA:
	
; // letörli a képernyőt colorr színnel /byte-al
	; NodeProcedureDecl -1
	; ***********  Defining procedure : kepernyotorles
	;    Procedure type : User-defined procedure
po7: dw  0
ig7:	db	0
colorr:	db	0
kepernyotorles_block1325:
kepernyotorles:
	ld hl,$8000
	ld [po7],hl
	ld a, $0
	ld [ig7], a
kepernyotorles_forloop1326:
	; Updated fast fill
	ld bc,$40
	ld a,[colorr]
	ld hl,[po7]
	ld d,h
	ld e,l
	inc de
	ld (hl),a
	ldir
	; ;generic pointer/integer P:=P+(expr) add expression
	; RHS is pure 
	ld de,$40
	ld hl,[po7]
	add  hl,de
	ld [po7],hl
kepernyotorles_forloopcounter1328:
kepernyotorles_loopstart1329:
	ld a,[ig7]
	add a,1
	ld [ig7],a
	cp $f0
	jr nz,kepernyotorles_forloop1326
kepernyotorles_forloopend1327:
kepernyotorles_loopend1330:
	ret
end_procedure_kepernyotorles:
	
; // ---------------------------------------------
; // 2
	; NodeProcedureDecl -1
	; ***********  Defining procedure : programresz_LOGO
	;    Procedure type : User-defined procedure
programresz_LOGO:
	ld a, $f0
	ld [colorr], a
	call kepernyotorles
	ld a, $a
	ld [xx], a
	ld a, $46
	ld [yy], a
	ld a, $1
	ld [TXTsor], a
	call ir_BINszoveg
	ld a, $8
	ld [xx], a
	ld a, $c8
	ld [yy], a
	ld a, $4
	ld [TXTsor], a
	call ir_BINszoveg
	call VARAKOZIK_SPACE_LENYOMASRA
	ld a, $4
	ld [jatekmod], a
	ret
end_procedure_programresz_LOGO:
	
; // ---------------------------------------------
; // 4
	; NodeProcedureDecl -1
	; ***********  Defining procedure : programresz_FOKEPERNYO
	;    Procedure type : User-defined procedure
programresz_FOKEPERNYO:
	ld a, $f
	ld [colorr], a
	call kepernyotorles
	ld a, $8
	ld [xx], a
	ld a, $a
	ld [yy], a
	ld a, $2
	ld [TXTsor], a
	call ir_BINszoveg
	ld a, $8
	ld [xx], a
	ld a, $14
	ld [yy], a
	ld a, $3
	ld [TXTsor], a
	call ir_BINszoveg
	ld a, $8
	ld [xx], a
	ld a, $c8
	ld [yy], a
	ld a, $4
	ld [TXTsor], a
	call ir_BINszoveg
	call VARAKOZIK_SPACE_LENYOMASRA
	ld a, $6
	ld [jatekmod], a
	ld a, $0
	ld [colorr], a
	call kepernyotorles
	call palya_generalas
	ret
end_procedure_programresz_FOKEPERNYO:
	
; // ---------------------------------------------
; // 6
	; NodeProcedureDecl -1
	; ***********  Defining procedure : programresz_JATEK
	;    Procedure type : User-defined procedure
programresz_JATEK:
	; 'a:=a + const'  optimization 
	ld a,[fociklusx]
	add  a,$1
	ld [fociklusx], a
	; Binary clause core: EQUALS
	ld a,$3
	ld c, a
	ld b,$3
	ld a,[fociklusx]
	and  b
	cp c
	jr nz,programresz_JATEK_elsedoneblock1339
programresz_JATEK_ConditionalTrueBlock1337: ;Main true block ;keep :
	
; // 0..255
; // csak minden 4. ciklusban mozgatjuk az ellenfelet,
; // hogy kicsit lassabbak legyenek
; // gépi ellenfelek mozgatása(10 sprite lehet a képernyőn)
	ld hl,$7d14
	ld [mem],hl
	ld a, $0
	ld [fociklus], a
programresz_JATEK_forloop1349:
	; generic assign 
	ld hl,$c0
	; Integer assignment 
	; Loading pointer
	ld [ii],hl
	call objektum
	; ;generic pointer/integer P:=P+(expr) add expression
	; RHS is pure 
	ld de,$a
	ld hl,[mem]
	add  hl,de
	ld [mem],hl
programresz_JATEK_forloopcounter1351:
programresz_JATEK_loopstart1352:
	ld a,[fociklus]
	add a,1
	ld [fociklus],a
	cp $a
	jr nz,programresz_JATEK_forloop1349
programresz_JATEK_forloopend1350:
programresz_JATEK_loopend1353:
programresz_JATEK_elsedoneblock1339:
	
; // saját játékos mozgatása   
	ld hl,$7d00
	ld [mem],hl
	; generic assign 
	ld hl,$100
	; Integer assignment 
	; Loading pointer
	ld [ii],hl
	call objektum
	
; // billentyű lenyomást vizsgálja
	ld hl,$b53
	ld [mem],hl
	; Binary clause core: EQUALS
	ld a,$80
	ld c, a
	; Optimization : zp[0]
	ld hl,[mem]
	ld a,[hl]
	push af
	ld a,$80
	ld b,a
	pop af
	and  b
	cp c
	jr nz,programresz_JATEK_elsedoneblock1359
programresz_JATEK_ConditionalTrueBlock1357: ;Main true block ;keep :
	call palya_generalas
programresz_JATEK_elsedoneblock1359:
	; Binary clause core: EQUALS
	ld a,$40
	ld c, a
	; Optimization : zp[0]
	ld hl,[mem]
	ld a,[hl]
	push af
	ld a,$40
	ld b,a
	pop af
	and  b
	cp c
	jr nz,programresz_JATEK_elsedoneblock1365
programresz_JATEK_ConditionalTrueBlock1363: ;Main true block ;keep :
	
; //R
	ld a, $2
	ld [jatekmod], a
programresz_JATEK_elsedoneblock1365:
	ret
end_procedure_programresz_JATEK:
block1:
main_block_begin_:
	
; //Q
; // --------------------------------------------------
; // ------------- ITT kezdődik majd a program --------
; // --------------------------------------------------
	ld a, $1
	ld [mode], a
	call init_Graphics
	
; // 4 színű mód bekapcsolása
	call init_4colors
	
; // 4 szín beállítása
	ld a, $2
	ld [jatekmod], a
	; ****** Inline assembler section
	
	  NOP
START
	  HALT
	  NOP
    
	ld a,[jatekmod]
	cp $2
	jr nz,MainProgram_casenext1369
	
; // logo
	call programresz_LOGO
	jp MainProgram_caseend1368
MainProgram_casenext1369:
	ld a,[jatekmod]
	cp $4
	jr nz,MainProgram_casenext1371
	call programresz_FOKEPERNYO
	jp MainProgram_caseend1368
MainProgram_casenext1371:
	ld a,[jatekmod]
	cp $6
	jr nz,MainProgram_casenext1373
	call programresz_JATEK
MainProgram_casenext1373:
MainProgram_caseend1368:
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
	org $74fe
StartBlock74fe:
	org $74fe
TXTDATA:
	incbin	 "C:/D/TRSE_2022Oktober/trse_win/trse/OLI_CPC/OLI01///SZOVEG.BIN"
end_incbin_TXTDATA:
EndBlock74fe:
	org $78ff
StartBlock78ff:
	org $78ff
CARDATA:
	incbin	 "C:/D/TRSE_2022Oktober/trse_win/trse/OLI_CPC/OLI01///CAR2.BIN"
end_incbin_CARDATA:
EndBlock78ff:
	end

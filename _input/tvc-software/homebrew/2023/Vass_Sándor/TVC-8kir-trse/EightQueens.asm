	CPU Z80
	 org $19ef
    ; BASIC "header" / program starter code
    db    $0F,$0A,$0,$DD ; "10 PRINT" - basic token
    db    " USR"            ; " USR"
    db    $96               ; "("
    db    "6659"           ; "6659" <- decimal address
    db    $95,$FF        ; ")"
    db    0,0,0,0,0       ; BASIC header length is 20 bytes with this 5 zero bytes, and the code starting address is 6659 ($1A03)
    ; assembly code start
;    jp    $1A03            ; <- this is the decimal 6659 ($1A03) memory address.
CONSOLE_CURSOR_DOWN EQU $18
CONSOLE_CURSOR_LEFT EQU $13
CONSOLE_CURSOR_RIGHT EQU $04
CONSOLE_CURSOR_UP EQU $05
FALSE EQU $00
TRUE EQU $01
StartBlock19ef:
	jp block1
str_p1: dw  0
str_p2: dw  0
str_p3: dw  0
str_i:	db	0
str_j:	db	0
str_li:	db	0
str_b:	db	0
str_c:	db	0
str_num:	dw	0
	; Declaring string asmz80
str_chars:		db	"0123456789ABCDEF"
	db	0
Console_X:	db	0
Console_Y:	db	0
Console_len:	db	0
	qpos:	 ds 8
col:	db	0
varPrefixed_i:	db	0
found:	db	0
TIME equ $b1d
timeStamp:	dw	0
printTable:	db	0
	;*
; //
; //	Returns the length of a string. Note that
; //	this will only work for strings <256 bytes. 
; //
; 

	; ***********  Defining procedure : str_strlen
	;    Procedure type : User-defined procedure
 ; Temp vars section
	; Declaring string asmz80
MainProgram_stringassignstr160:		db	130
	db	"rjam ki a tal"
	db	144
	db	"latokat (i/n)\r\n> "
	db	0
	; Declaring string asmz80
MainProgram_stringassignstr169:		db	"I\r\n"
	db	0
	; Declaring string asmz80
MainProgram_stringassignstr172:		db	"N\r\n"
	db	0
	; Declaring string asmz80
MainProgram_stringassignstr262:		db	"."
	db	0
	; Declaring string asmz80
MainProgram_stringassignstr300:		db	"\r\n"
	db	0
	; Declaring string asmz80
MainProgram_stringassignstr302:		db	" megold"
	db	144
	db	"st tal"
	db	144
	db	"ltam "
	db	0
	; Declaring string asmz80
MainProgram_stringassignstr304:		db	"."
	db	0
	; Declaring string asmz80
MainProgram_stringassignstr308:		db	" sec alatt ("
	db	0
	; Declaring string asmz80
MainProgram_stringassignstr310:		db	" frames)\r\n"
	db	0
 ; Temp vars section ends
str_strlen_block2:
str_strlen:
	ld a, $0
	ld [str_li], a
str_strlen_while3:
str_strlen_loopstart7:
	; Binary clause core: NOTEQUALS
	; Compare with pure num / var optimization
	ld a,[str_li]
	ld e,a ; variable is 8-bit
	ld d,0 ;keep
	ld hl,[str_p3]
	add hl,de
	; TYPETEST : BYTE
	ld a,[hl]
	or a
	jr z, str_strlen_elsedoneblock6
str_strlen_ConditionalTrueBlock4: ;Main true block ;keep :
	; 'a:=a + const'  optimization 
	ld a,[str_li]
	add  a,$1
	ld [str_li], a
	jr str_strlen_while3
str_strlen_elsedoneblock6:
str_strlen_loopend8:
	ld a,[str_li]
	ret
end_procedure_str_strlen:
	;*
; // Reverses a string
; // 
; // *
	; ***********  Defining procedure : str_reverse
	;    Procedure type : User-defined procedure
str_reverse_block11:
str_reverse:
	; generic assign 
	; Loading pointer
	ld hl,[str_p2]
	ld [str_p3],hl
	call str_strlen
	ld [str_c], a
	; generic assign 
	; RHS is pure numeric optimisation
	sub  $1
	ld [str_j], a
	ld a, $0
	ld [str_i], a
str_reverse_while12:
str_reverse_loopstart16:
	; Binary clause core: LESS
	; Compare two vars optimization
	ld a,[str_j]
	ld b,a
	ld a,[str_i]
	cp b
	jr nc,str_reverse_elsedoneblock15
str_reverse_ConditionalTrueBlock13: ;Main true block ;keep :
	; generic assign 
	ld a,[str_i]
	ld e,a ; variable is 8-bit
	ld d,0 ;keep
	ld hl,[str_p2]
	add hl,de
	; TYPETEST : BYTE
	ld a,[hl]
	ld [str_b], a
	ld a,[str_j]
	ld e,a ; variable is 8-bit
	ld d,0 ;keep
	ld hl,[str_p2]
	add hl,de
	; TYPETEST : BYTE
	ld a,[hl]
	push af
	ld hl,[str_p2]
	; ;general 8-bit expression for the index
	ld d,0
	ld a,[str_i]
	ld e,a
	add hl,de
	pop af
	ld [hl],a
	ld hl,[str_p2]
	; ;general 8-bit expression for the index
	ld d,0
	ld a,[str_j]
	ld e,a
	add hl,de
	ld a,[str_b]
	ld [hl],a
	; 'a:=a + const'  optimization 
	ld a,[str_j]
	sub $1
	ld [str_j], a
	; 'a:=a + const'  optimization 
	ld a,[str_i]
	add  a,$1
	ld [str_i], a
	jr str_reverse_while12
str_reverse_elsedoneblock15:
str_reverse_loopend17:
	ret
end_procedure_str_reverse:
	;*
; //	Converts a number to a string in base b
; //	example:
; //	<code>
; //itoa(1234, p1, 16); 
; // coverts "1234" to a hexadecimal string stored in p1
; //	</code>
; //
; 

	; ***********  Defining procedure : str_itoa
	;    Procedure type : User-defined procedure
str_itoa_block20:
str_itoa:
	ld a, $0
	ld [str_i], a
	; Binary clause core: EQUALS
	; Binary clause INTEGER: EQUALS
	ld hl,$0
	push hl
	; Variable is 16-bit
	ld hl,[str_num]
	pop de
	xor a ; clear carry
	sbc hl,de
	jr nz,str_itoa_elsedoneblock24
str_itoa_ConditionalTrueBlock22: ;Main true block ;keep :
	ld hl,[str_p1]
	ld a,$30
	ld [hl],a
	
; // Simply 0
	ld hl,[str_p1]
	; ; index is pure number optimization
	ld de,$01
	add hl,de
	ld a,$0
	ld [hl],a
	ret
str_itoa_elsedoneblock24:
str_itoa_while27:
str_itoa_loopstart31:
	; Binary clause core: NOTEQUALS
	; Binary clause INTEGER: NOTEQUALS
	; Special case for integer<>0
	; Variable is 16-bit
	ld hl,[str_num]
	ld a,h
	or l
	jr z, str_itoa_elsedoneblock30
str_itoa_ConditionalTrueBlock28: ;Main true block ;keep :
	; Variable is 16-bit
	ld hl,[str_num]
	ld b,h
	ld c,l
	; Variable is 16-bit
	ld a,[str_b]
	ld e,a
	ld d,0
	call _Mod_16
	ld a,l
	ld e,a ; variable is 8-bit
	ld d,0 ;keep
	ld hl,str_chars
	add hl,de
	; TYPETEST : NADA
	ld a,[hl]
	push af
	ld hl,[str_p1]
	; ;general 8-bit expression for the index
	ld d,0
	ld a,[str_i]
	ld e,a
	add hl,de
	pop af
	ld [hl],a
	; 'a:=a + const'  optimization 
	ld a,[str_i]
	add  a,$1
	ld [str_i], a
	; generic assign 
	; Variable is 16-bit
	ld a,[str_b]
	ld l,a
	ld h,0
	ex de,hl
	; Variable is 16-bit
	ld hl,[str_num]
	ld a,h
	ld c,l
	call div_16x16
	ld h,a
	ld l,c
	; Integer assignment 
	; Loading pointer
	ld [str_num],hl
	jr str_itoa_while27
str_itoa_elsedoneblock30:
str_itoa_loopend32:
	ld hl,[str_p1]
	; ;general 8-bit expression for the index
	ld d,0
	ld a,[str_i]
	ld e,a
	add hl,de
	ld a,$0
	ld [hl],a
	
; // null-term string    
	; Loading pointer
	ld hl,[str_p1]
	ld [str_p2],hl
	call str_reverse
	ret
end_procedure_str_itoa:
	; ***********  Defining procedure : Console_GotoXY
	;    Procedure type : User-defined procedure
Console_GotoXY_block35:
Console_GotoXY:
	; ****** Inline assembler section
		ld A,[Console_X]
		ld B,A
		ld A,[Console_Y]
		ld C,A
		rst $30 		// TV-Computer ROM routine call
		db $23 		// CPOS - set position
	
	ret
end_procedure_Console_GotoXY:
	;*
; //Writes the text specified in the param to the current position.
; //Example: Write("TRSE CRT Tutorial");<br/><br/>
; //Uses the system (firmware) function.
; 

	; ***********  Defining procedure : Console_Write
	;    Procedure type : User-defined procedure
Console_Text: dw  0
Console_Write_block36:
Console_Write:
	ld a, $0
	ld [Console_len], a
Console_Write_while37:
Console_Write_loopstart41:
	; Binary clause core: NOTEQUALS
	; Compare with pure num / var optimization
	ld a,[Console_len]
	ld e,a ; variable is 8-bit
	ld d,0 ;keep
	ld hl,[Console_Text]
	add hl,de
	; TYPETEST : BYTE
	ld a,[hl]
	or a
	jr z, Console_Write_elsedoneblock40
Console_Write_ConditionalTrueBlock38: ;Main true block ;keep :
	; 'a:=a + const'  optimization 
	ld a,[Console_len]
	add  a,$1
	ld [Console_len], a
	jr Console_Write_while37
Console_Write_elsedoneblock40:
Console_Write_loopend42:
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	ld a,[Console_len]
	or a
	jr nz,Console_Write_elsedoneblock48
Console_Write_ConditionalTrueBlock46: ;Main true block ;keep :
	ret
Console_Write_elsedoneblock48:
	; ****** Inline assembler section
			ld DE,[Console_Text]	// text 
			ld B,0
			ld A,[Console_len]
			ld C,A
			rst $30 				// TV-Computer ROM routine call
			db $22 				// ED_BKOUT - write text
	
	ret
end_procedure_Console_Write:
	; ***********  Defining procedure : Console_WriteNum
	;    Procedure type : User-defined procedure
	Console_txtBuf:	 ds 6
Console_num:	dw	0
Console_WriteNum_block51:
Console_WriteNum:
	; generic assign 
	; Variable is 16-bit
	ld hl,[Console_num]
	; Integer assignment 
	; Loading pointer
	ld [str_num],hl
	ld hl,Console_txtBuf
	ld [str_p1],hl
	ld a, $a
	ld [str_b], a
	call str_itoa
	ld hl,Console_txtBuf
	ld [Console_Text],hl
	call Console_Write
	ret
end_procedure_Console_WriteNum:
	; ***********  Defining procedure : Console_ReadKey
	;    Procedure type : User-defined procedure
Console_ReadKey:
	; ****** Inline assembler section
		rst $30
		db $91
		ld a,c
	
	ret
end_procedure_Console_ReadKey:
	; ***********  Defining procedure : Console_WriteChar
	;    Procedure type : User-defined procedure
Console_c:	db	0
Console_WriteChar_block53:
Console_WriteChar:
	; ****** Inline assembler section
		ld a,[Console_c];
		ld c,a
		rst $30
		db $21
	
	ret
end_procedure_Console_WriteChar:
	; ***********  Defining procedure : checkStatus
	;    Procedure type : User-defined procedure
checkStatus:
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	ld a,[col]
	or a
	jr nz,checkStatus_elsedoneblock58
checkStatus_ConditionalTrueBlock56: ;Main true block ;keep :
	ld a,$1
	ret
	ret
checkStatus_elsedoneblock58:
	; generic assign 
	; RHS is pure numeric optimisation
	ld a,[col]
	sub  $1
	ld [varPrefixed_i], a
checkStatus_while61:
checkStatus_loopstart65:
	; Binary clause core: NOTEQUALS
	; Compare with pure num / var optimization
	ld a,[varPrefixed_i]
	cp $ff
	jp z, checkStatus_elsedoneblock64
checkStatus_ConditionalTrueBlock62: ;Main true block ;keep :
	; Binary clause core: EQUALS
	; Compare two vars optimization
	ld a,[col]
	ld e,a ; variable is 8-bit
	ld d,0 ;keep
	ld hl,qpos
	add hl,de
	; TYPETEST : BYTE
	ld a,[hl]
	ld c, a
	ld a,[varPrefixed_i]
	ld e,a ; variable is 8-bit
	ld d,0 ;keep
	ld hl,qpos
	add hl,de
	; TYPETEST : BYTE
	ld a,[hl]
	cp c
	jr nz,checkStatus_elsedoneblock90
checkStatus_ConditionalTrueBlock88: ;Main true block ;keep :
	ld a,$0
	ret
	ret
checkStatus_elsedoneblock90:
	; Binary clause core: EQUALS
	; Compare two vars optimization
	ld a,[col]
	ld e,a ; variable is 8-bit
	ld d,0 ;keep
	ld hl,qpos
	add hl,de
	; TYPETEST : BYTE
	ld a,[hl]
	push af
	ld a,[varPrefixed_i]
	ld b,a
	ld a,[col]
	sub  b
	ld b,a
	pop af
	sub  b
	ld c, a
	ld a,[varPrefixed_i]
	ld e,a ; variable is 8-bit
	ld d,0 ;keep
	ld hl,qpos
	add hl,de
	; TYPETEST : BYTE
	ld a,[hl]
	cp c
	jr nz,checkStatus_elsedoneblock96
checkStatus_ConditionalTrueBlock94: ;Main true block ;keep :
	ld a,$0
	ret
	ret
checkStatus_elsedoneblock96:
	; Binary clause core: EQUALS
	; Compare two vars optimization
	ld a,[col]
	ld e,a ; variable is 8-bit
	ld d,0 ;keep
	ld hl,qpos
	add hl,de
	; TYPETEST : BYTE
	ld a,[hl]
	push af
	ld a,[varPrefixed_i]
	ld b,a
	ld a,[col]
	sub  b
	ld b,a
	pop af
	add  a, b
	ld c, a
	ld a,[varPrefixed_i]
	ld e,a ; variable is 8-bit
	ld d,0 ;keep
	ld hl,qpos
	add hl,de
	; TYPETEST : BYTE
	ld a,[hl]
	cp c
	jr nz,checkStatus_elsedoneblock102
checkStatus_ConditionalTrueBlock100: ;Main true block ;keep :
	ld a,$0
	ret
	ret
checkStatus_elsedoneblock102:
	; 'a:=a + const'  optimization 
	ld a,[varPrefixed_i]
	sub $1
	ld [varPrefixed_i], a
	jp checkStatus_while61
checkStatus_elsedoneblock64:
checkStatus_loopend66:
	ld a,$1
	ret
	ret
end_procedure_checkStatus:
	; ***********  Defining procedure : PrintTable
	;    Procedure type : User-defined procedure
x:	db	0
y:	db	0
PrintTable_block105:
PrintTable:
	ld a, $0
	ld [x], a
PrintTable_forloop106:
	ld a, $0
	ld [y], a
PrintTable_forloop132:
	; generic assign 
	; RHS is pure numeric optimisation
	ld a,[x]
	add  a, $1
	ld [Console_X], a
	; generic assign 
	; RHS is pure numeric optimisation
	ld a,[y]
	add  a, $1
	ld [Console_Y], a
	call Console_GotoXY
	; Binary clause core: EQUALS
	; Compare two vars optimization
	ld a,[y]
	ld b,a
	ld a,[x]
	ld e,a ; variable is 8-bit
	ld d,0 ;keep
	ld hl,qpos
	add hl,de
	; TYPETEST : BYTE
	ld a,[hl]
	cp b
	jr nz,PrintTable_elseblock147
PrintTable_ConditionalTrueBlock146: ;Main true block ;keep :
	ld a, $2a
	ld [Console_c], a
	call Console_WriteChar
	jr PrintTable_elsedoneblock148
PrintTable_elseblock147:
	ld a, $2e
	ld [Console_c], a
	call Console_WriteChar
PrintTable_elsedoneblock148:
PrintTable_loopstart133:
	ld a,[y]
	add a,1
	ld [y],a
	cp $8
	jr nz,PrintTable_forloop132
PrintTable_loopend134:
PrintTable_loopstart107:
	ld a,[x]
	add a,1
	ld [x],a
	cp $8
	jr nz,PrintTable_forloop106
PrintTable_loopend108:
	ret
end_procedure_PrintTable:
	; ***********  Defining procedure : init
	;    Procedure type : User-defined procedure
init:
	ld a, $0
	ld [varPrefixed_i], a
init_forloop154:
	; Storing to array
	ld a,[varPrefixed_i]
	ld e,a
	ld d,0
	ld hl,qpos
	add hl,de
	ld a,$0
	ld [hl],a
init_loopstart155:
	ld a,[varPrefixed_i]
	add a,1
	ld [varPrefixed_i],a
	cp $8
	jr nz,init_forloop154
init_loopend156:
	ld a, $0
	ld [col], a
	ld [found], a
	; generic assign 
	; Variable is 16-bit
	ld hl,[TIME]
	; Integer assignment 
	; Loading pointer
	ld [timeStamp],hl
	ld [printTable], a
	ret
end_procedure_init:
block1:
main_block_begin_:
	call init
	; Assigning a string : Console_Text
	ld hl,MainProgram_stringassignstr160
	; Loading pointer
	ld [Console_Text],hl
	call Console_Write
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	call Console_ReadKey
	cp $69
	jr nz,MainProgram_elseblock163
MainProgram_ConditionalTrueBlock162: ;Main true block ;keep :
	ld a, $1
	ld [printTable], a
	; Assigning a string : Console_Text
	ld hl,MainProgram_stringassignstr169
	; Loading pointer
	ld [Console_Text],hl
	call Console_Write
	jr MainProgram_elsedoneblock164
MainProgram_elseblock163:
	; Assigning a string : Console_Text
	ld hl,MainProgram_stringassignstr172
	; Loading pointer
	ld [Console_Text],hl
	call Console_Write
MainProgram_elsedoneblock164:
MainProgram_while173:
MainProgram_loopstart177:
	; Binary clause core: NOTEQUALS
	; Comparing two non-equal numerical values
	jp MainProgram_ConditionalTrueBlock174
MainProgram_ConditionalTrueBlock174: ;Main true block ;keep :
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	ld a,[col]
	cp $8
	jr nz,MainProgram_elsedoneblock242
MainProgram_ConditionalTrueBlock240: ;Main true block ;keep :
	
; // found one!
	; 'a:=a + const'  optimization 
	ld a,[found]
	add  a,$1
	ld [found], a
	; Binary clause core: NOTEQUALS
	; Compare with pure num / var optimization
	ld a,[printTable]
	or a
	jr z, MainProgram_elseblock255
MainProgram_ConditionalTrueBlock254: ;Main true block ;keep :
	call PrintTable
	jr MainProgram_elsedoneblock256
MainProgram_elseblock255:
	; Assigning a string : Console_Text
	ld hl,MainProgram_stringassignstr262
	; Loading pointer
	ld [Console_Text],hl
	call Console_Write
MainProgram_elsedoneblock256:
	ld a, $7
	ld [col], a
	; Storing to array
	ld e,a ; variable is 8-bit
	ld d,0 ;keep
	ld hl,qpos
	add hl,de
	; TYPETEST : BYTE
	ld a,[hl]
	push af
	ld a,$1
	ld b,a
	pop af
	add  a, b
	push af
	ld a,[col]
	ld e,a
	ld d,0
	ld hl,qpos
	add hl,de
	pop af
	ld [hl],a
	jp MainProgram_loopstart177
MainProgram_elsedoneblock242:
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	ld a,[col]
	ld e,a ; variable is 8-bit
	ld d,0 ;keep
	ld hl,qpos
	add hl,de
	; TYPETEST : BYTE
	ld a,[hl]
	cp $8
	jp nz,MainProgram_elseblock265
MainProgram_ConditionalTrueBlock264: ;Main true block ;keep :
	; Storing to array
	ld a,[col]
	ld e,a
	ld d,0
	ld hl,qpos
	add hl,de
	ld a,$0
	ld [hl],a
	; 'a:=a + const'  optimization 
	ld a,[col]
	sub $1
	ld [col], a
	; Binary clause core: EQUALS
	; Compare with pure num / var optimization
	cp $ff
	jr nz,MainProgram_elsedoneblock287
MainProgram_ConditionalTrueBlock285: ;Main true block ;keep :
	
; // program done	
	jp MainProgram_loopend178
MainProgram_elsedoneblock287:
	; Storing to array
	ld a,[col]
	ld e,a ; variable is 8-bit
	ld d,0 ;keep
	ld hl,qpos
	add hl,de
	; TYPETEST : BYTE
	ld a,[hl]
	push af
	ld a,$1
	ld b,a
	pop af
	add  a, b
	push af
	ld a,[col]
	ld e,a
	ld d,0
	ld hl,qpos
	add hl,de
	pop af
	ld [hl],a
	jp MainProgram_elsedoneblock266
MainProgram_elseblock265:
	; Binary clause core: NOTEQUALS
	; Compare with pure num / var optimization
	call checkStatus
	or a
	jr z, MainProgram_elseblock293
MainProgram_ConditionalTrueBlock292: ;Main true block ;keep :
	; 'a:=a + const'  optimization 
	ld a,[col]
	add  a,$1
	ld [col], a
	jr MainProgram_elsedoneblock294
MainProgram_elseblock293:
	; Storing to array
	ld a,[col]
	ld e,a ; variable is 8-bit
	ld d,0 ;keep
	ld hl,qpos
	add hl,de
	; TYPETEST : BYTE
	ld a,[hl]
	push af
	ld a,$1
	ld b,a
	pop af
	add  a, b
	push af
	ld a,[col]
	ld e,a
	ld d,0
	ld hl,qpos
	add hl,de
	pop af
	ld [hl],a
MainProgram_elsedoneblock294:
MainProgram_elsedoneblock266:
	jp MainProgram_while173
MainProgram_elsedoneblock176:
MainProgram_loopend178:
	; generic assign 
	; Generic 16-bit binop
	; Variable is 16-bit
	ld hl,[timeStamp]
	ex de,hl
	; Variable is 16-bit
	ld hl,[TIME]
	xor a ; clear carry
	sbc hl,de
	; Integer assignment 
	; Loading pointer
	ld [timeStamp],hl
	; Assigning a string : Console_Text
	ld hl,MainProgram_stringassignstr300
	; Loading pointer
	ld [Console_Text],hl
	call Console_Write
	; generic assign 
	; Variable is 16-bit
	ld a,[found]
	ld l,a
	ld h,0
	; Integer assignment 
	; Loading pointer
	ld [Console_num],hl
	call Console_WriteNum
	; Assigning a string : Console_Text
	ld hl,MainProgram_stringassignstr302
	; Loading pointer
	ld [Console_Text],hl
	call Console_Write
	; generic assign 
	ld hl,$14
	ex de,hl
	; Variable is 16-bit
	ld hl,[timeStamp]
	ld a,h
	ld c,l
	call div_16x16
	ld h,a
	ld l,c
	; Integer assignment 
	; Loading pointer
	ld [Console_num],hl
	call Console_WriteNum
	; Assigning a string : Console_Text
	ld hl,MainProgram_stringassignstr304
	; Loading pointer
	ld [Console_Text],hl
	call Console_Write
	; generic assign 
	; Generic 16-bit binop
	; Swapping nodes
	; Generic mul
	; Node is pure : 0
	ld a,$a
	push af
	ld hl,$14
	ex de,hl
	; Variable is 16-bit
	ld hl,[timeStamp]
	ld a,h
	ld c,l
	call div_16x16
	ld h,a
	ld l,c
	ex de,hl
	ld hl,0
	ld c,0
	pop af
	call mul_16x8
	ex de,hl
	push de
	ld hl,$14
	ex de,hl
	push de
	; Generic mul
	; Node is pure : 1
	ld a,$a
	push af
	; Variable is 16-bit
	ld hl,[timeStamp]
	ex de,hl
	ld hl,0
	ld c,0
	pop af
	call mul_16x8
	ld a,h
	ld c,l
	pop de
	call div_16x16
	ld h,a
	ld l,c
	pop de
	xor a ; clear carry
	sbc hl,de
	; Integer assignment 
	; Loading pointer
	ld [Console_num],hl
	call Console_WriteNum
	; Assigning a string : Console_Text
	ld hl,MainProgram_stringassignstr308
	; Loading pointer
	ld [Console_Text],hl
	call Console_Write
	; generic assign 
	; Variable is 16-bit
	ld hl,[timeStamp]
	; Integer assignment 
	; Loading pointer
	ld [Console_num],hl
	call Console_WriteNum
	; Assigning a string : Console_Text
	ld hl,MainProgram_stringassignstr310
	; Loading pointer
	ld [Console_Text],hl
	call Console_Write
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
EndBlock19ef:
	end

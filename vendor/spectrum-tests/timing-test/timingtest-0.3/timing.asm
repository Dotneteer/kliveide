; instruction and contention timing test by Patrik Rak
; based on zxtests code by Jan Bobrowski

	org	40000

INIT	ld	bc,TEST
	ld	hl,TEST.name
	call	SETVAR

	call	INSTINT
	call	FRAMETIME
	ret

TEST	call	GETVAR
	db	"T",13
	push	bc
	call	GETVAR
	db	"CODE",13
	push	bc	
	pop	de
	pop	hl
	call	CODETIME
	ret

.name	db	"TEST",13

	include	codetime.asm
	include	frametime.asm

	include	interrupt.asm
	include delay.asm
	include getvar.asm
	include setvar.asm

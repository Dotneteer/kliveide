; set integer variable
; by Jan Bobrowski, license GPL
; hl="name\r", bc=value

SETVAR:
	push	hl
	call	2D2Bh		; STACK-BC
	ld	hl,(5C5Dh)	; CH-ADD
	ex	(sp),hl
	ld	(5C5Dh),hl
	call	28B2h		; LOOK-VARS
	pop	de
	ld	(5C5Dh),de	; CH-ADD

	jp	nc,2B6Ch	; L-EXISTS+6

	push	hl
	ld	bc,5
.l	inc	hl
	inc	bc
	ld	a,(hl)
	cp	20h
	jr	nc,.l
	ld	a,c
	ld	hl,(5C59h)	; E-LINE
	dec	hl
	call	1655h		; MAKE-ROOM
	ex	de,hl
	ld	hl,(5C4Dh)	; DEST
	ex	(sp),hl
	ld	(5C4Dh),hl	; DEST
	ex	de,hl
	call	2B31h		; L-SPACES + 8
	pop	hl
	ld	(5C4Dh),hl	; DEST
	ret

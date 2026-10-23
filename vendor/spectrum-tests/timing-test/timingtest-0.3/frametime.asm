; measure frame duration
; by Jan Bobrowski, license GPL
; adjusted little by Patrik Rak
; returns frame duration minus 32768 in hl and bc.

FRAMETIME:

	call	.test
	im	1
	ex	de,hl
	add	hl,bc
	ld	(FRAMET),hl
	ld	bc,hl
	ret

.test	ld	bc,.stage3
	push	bc
	push	bc
	push	bc
	push	bc
	ld	bc,.stage2
	push	bc
	ld	bc,.stage1
	push	bc
	ld	de,0
	ld	hl,0

	halt
	im	2
	halt
	rst	0

.stage1			; 46..49
.loop	inc	hl
	jp	.loop

.stage2
	add	hl,hl
	add	hl,hl
	add	hl,hl
	add	hl,hl
	ld	bc,46-16-32768
	add	hl,bc
	ld	bc,hl
	halt
	rst	0

.stage3			; 46..49
	push	bc
	call	DELAY
	ld	bc,32768-45-31
	call	DELAY
	pop	bc
	inc	e
	inc	e
	inc	e
	inc	e
	inc	e
	inc	e
	inc	e
	rst	0

FRAMET	dw	0

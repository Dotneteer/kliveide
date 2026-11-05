; measure duration of given code run at given time
; by Patrik Rak, license GPL
; based on code by Jan Bobrowski
; call code at de exactly at time stored in hl
; frametime - hl must be less than 65536
; the called code must not change de
; returns duration of executed code minus 10T for RET in hl and bc.

CODETIME:
	push	hl
	call	.test
	im	1
	ld	hl,(.delay)
	add	hl,de
	pop	bc
	add	hl,bc
	ex	de,hl
	ld	hl,(FRAMET)
	ld	bc,32768-10-46+1 ; (10 RET, 46 stage3 overhead, 1 ULA offset)
	add	hl,bc
	or	a
	sbc	hl,de
	ld	bc,hl
	ret

.test	ld	bc,-65+7
	add	hl,bc

	ld	a,4

.setup	ld	bc,.stage3
	push	bc
	push	de
	push	hl
	ld	bc,.align
	push	bc
	ld	bc,.try
	push	bc

	dec	a
	jr	nz,.setup

	ld	bc,.stage2
	push	bc

	ld	bc,.stage1
	push	bc
	push	de
	push	hl
	ld	bc,.align
	push	bc
	ld	bc,.try
	push	bc

	halt
	im	2
	halt
	rst	0

.try				; 46T+
	ld	bc,.try		; 56T+
	push	bc		; 67T+
	ld	bc,32667	; 77T+
	call	DELAY		; 32744T+
	ld	bc,(FRAMET)	; 32764T+
	call	DELAY		; FRAMET-32772 +
	nop			; FRAMET-32768 +
	pop	bc
	rst	0

.align				; 55T
	pop	bc		; 65T
	jp	DELAY		; 65T+DELAY-7T (CALL 17 JP 10)

.stage1				; X
	ld	hl,0		; X+10
.loop	inc	hl		; X+10+16*k
	jp	.loop

.stage2
	add	hl,hl
	add	hl,hl
	add	hl,hl
	add	hl,hl
	ld	bc,10-16-46
	add	hl,bc
	ld	(.delay),hl
	ld	de,0
	halt
	rst	0

.delay	dw	0

.stage3				; X
	ld	bc,(.delay)	; X+20
	dec	bc		; X+26
	ld	(.delay),bc	; X+46
	call	DELAY		; FRAMET-16+0..15
	inc	e
	inc	e
	inc	e
	inc	e
	inc	e
	inc	e
	inc	e
	rst	0

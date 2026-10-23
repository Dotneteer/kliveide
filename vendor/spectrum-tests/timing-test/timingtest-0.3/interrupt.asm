; Interrupt handler
; by Jan Bobrowski, license GPL
; modified slightly by Patrik Rak

INSTINT:
	ld	a,0xBF	; handler at 0xBFBF
	ld	d,a
	ld	e,a
	ld	hl,.int
	ld	bc,.intend-.int
	ldir
	inc	b
	ld	h,0xBE	; table at 0xBE00..0xBF01
	ld	l,c
	ld	d,h
	ld	e,b
	ld	(hl),a
	ld	a,h
	ldir
	ld	i,a
	ret

.int			; 20T+ (1T+ is ULA offset, 19T IM2 handling)
	inc	sp	; 26T+
	inc	sp	; 32T+
	ei		; 36T+
	ret		; 46T+
.intend

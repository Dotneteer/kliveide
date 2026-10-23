; get integer variable
; by Jan Bobrowski, license GPL
; call GETVAR : db "name",13
; bc = value

GETVAR:
	rst	18h
	ex	(sp),hl
	ld	(5C5Dh),hl	; CHADD
	call	2ACDh		; INT-EXP2
	rst	20h
	ex	(sp),hl
	jp	0091h		; SKIPS+1

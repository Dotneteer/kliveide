; Routine to delay for exactly HL (>=160) tstates

; Copyright 2007 Jan Bobrowski, with thanks to everyone else who contributed
; to the thread on WoS
; <http://www.worldofspectrum.org/forums/showthread.php?t=16320>
	
; This program is licensed under the GNU General Public License. See the
; file `COPYING' for details

delay
PROC

_b0	ld a, l
	rra
	jr c, _b1
	nop

; bit 0 set   : 20 T
; bit 0 reset : 19 T

_b1	rra
	jr nc, _b2
	jr nc, _b2		; never taken

; bit 1 set   : 18 T
; bit 1 reset : 16 T

_b2	rra
	jr nc, _b3
	ret nc
	nop

; bit 2 set   : 20 T
; bit 2 reset : 16 T

_b3	rra
	jr nc, _b4
	jr nc, _b4		; never taken
	dec de

; bit 3 set   : 24 T
; bit 3 reset : 16 T

_b4	rra
	jr nc, _prel
	jr nc, _prel		; never taken
	or a
	ld de,0

; bit 4 set   : 32 T
; bit 4 reset : 16 T
; carry flag reset

_prel	ex de,hl
	ld hl,191
	ld hl,191
	sbc hl,de
	ld de,32

; loop prep   : 49 T
; loop time = 11 + n*32 T (n = # times through loop)

_loop	ret nc
	add hl,de
	ccf
	jr _loop

ENDP

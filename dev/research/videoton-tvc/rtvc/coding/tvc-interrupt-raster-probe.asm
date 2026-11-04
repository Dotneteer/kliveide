BASIC_START
  DI
  LD A, C3H ; JP
  LD (0038H), A
  LD HL, INT_START
  LD (0039H), HL
  EI
  RET

INT_START:
  PUSH AF
  PUSH BC
  PUSH DE
  ; white border
  LD A,FFH
  OUT (00H),A

; one raster line is 200T states
; one loop 26T = one line 7.692 loop
; 100 lines = ~769 loops
  LD DE,769
DELAY_INNER:
  DEC DE
  LD A,D
  OR E
  JR NZ,DELAY_INNER

  ; black border
  LD A,00H
  OUT (00H),A
  POP DE
  POP BC
  LD A, 70H
  OUT (2), A
  ; not popping AF
  JP C412H

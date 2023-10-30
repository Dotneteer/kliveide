; Put your ZXBASM Z80 assembly code into code files
  org $8000
Start:
  ld a,2;	    ; upper screen
  call $1601    ; open the channel
  ld hl,Message ; HL points the the message string
NextCh:
  ld a,(hl)     ; get next character
  or a
  ret z         ; return when terminated
  rst $10       ; display character
  inc hl        ; next character
  jr NextCh     ; next loop

Message:
  defb $16, $0A, $06 ; AT 10, 4
  defb $11, $04      ; PAPER 4
  defm "ZXBASM with Klive IDE"
  defb $00           ; terminate

; @module   data
; @summary  DATA and READ: the item being read, between the program's item code and READ.
; @exports  DataPutNumber, DataPutString, DataNumber, DataString, DataNone
; @requires errors
;
; The compiler turns every DATA item into code that computes it (items may be expressions, evaluated
; when READ runs) and hands the value over here: a number as a Float, a String as a String the item
; owns. READ then takes it in the form its target needs; a String read into a number or a number
; into a String stops with "C Nonsense in BASIC". A program with no DATA left to read ends up at
; DataNone: "E Out of DATA".

; ------------------------------------------------------------------------------------------------
; An item's value: DataPutNumber takes a Float in A-E-D-C-B, DataPutString an owned String in HL.
; Change nothing else.
DataPutNumber:
    ld (DataNum),a
    ld (DataNum+1),de
    ld (DataNum+3),bc
    xor a
    ld (DataKind),a
    ld a,(DataNum)
    ret

DataPutString:
    ld (DataStr),hl
    push af
    ld a,1
    ld (DataKind),a
    pop af
    ret

; ------------------------------------------------------------------------------------------------
; READ into a number: the item as a Float in A-E-D-C-B. Changes F.
DataNumber:
    ld a,(DataKind)
    or a
    jr nz,DataMismatch
    ld a,(DataNum)
    ld de,(DataNum+1)
    ld bc,(DataNum+3)
    ret

; READ into a String: the item's String in HL, now the reader's. Changes AF.
DataString:
    ld a,(DataKind)
    dec a
    jr nz,DataMismatch
    ld hl,(DataStr)
    ret

DataMismatch:
    ld a,11                 ; "C Nonsense in BASIC"
    jp RaiseError

; ------------------------------------------------------------------------------------------------
; Where READ goes when there is no DATA to read. Does not return.
DataNone:
    ld a,13                 ; "E Out of DATA"
    jp RaiseError

DataKind:
    .defb 0
DataNum:
    .defs 5
DataStr:
    .defw 0

; @module   data
; @summary  DATA and READ: the item being read, between the program's item code and READ.
; @exports  DataPutNumber, DataPutString, DataNumber, DataString, DataNone
; @requires errors, heap
;
; The compiler turns every DATA item into code that computes it (items may be expressions, evaluated
; when READ runs) and hands the value over here: a number as a Float, a String as a String the item
; owns. READ then takes it in the form its target needs; a String read into a number or a number
; into a String gives 0 or the empty String and sets ERR_NR to 9 ("A Invalid argument"), and the
; program carries on, as ZX BASIC does (compatibility plan C3). READ after RESTORE to a label with no
; DATA after it reads DataNone: 0 or the empty String, with no error.

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
; READ into a number: the item as a Float in A-E-D-C-B. Changes F, HL.
DataNumber:
    ld a,(DataKind)
    or a
    jr nz,DataNumberNot
    ld a,(DataNum)
    ld de,(DataNum+1)
    ld bc,(DataNum+3)
    ret
DataNumberNot:              ; kind 1, a String: freed, 0 and ERR_NR 9; kind 2, no DATA: 0
    dec a
    jr nz,DataZero
    ld hl,(DataStr)
    call Free
    ld a,9                  ; "A Invalid argument"
    ld ($5c3a),a
DataZero:
    xor a
    ld e,a
    ld d,a
    ld c,a
    ld b,a
    ret

; READ into a String: the item's String in HL, now the reader's; a number gives the empty String and
; ERR_NR 9, no DATA the empty String. Changes AF.
DataString:
    ld a,(DataKind)
    cp 1
    jr nz,DataStringNot
    ld hl,(DataStr)
    ret
DataStringNot:
    or a
    jr nz,DataStringNone
    ld a,9                  ; "A Invalid argument"
    ld ($5c3a),a
DataStringNone:
    ld hl,0
    ret

; ------------------------------------------------------------------------------------------------
; The item READ reads when there is no DATA left: none (kind 2); __data_next stays here.
DataNone:
    ld a,2
    ld (DataKind),a
    ret

DataKind:
    .defb 0
DataNum:
    .defs 5
DataStr:
    .defw 0

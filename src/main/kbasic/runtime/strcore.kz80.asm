; @module   strcore
; @summary  Heap Strings: allocation, length and a one-character String, for every package.
; @exports  StrAlloc, StrLen, StrChr
; @requires heap
;
; A String value is a pointer to a heap block [length:2][characters], or 0 for the empty string
; (runtime-abi.md §2.2). These are the routines any runtime package needs to make or read one - the
; float module's STR$ and VAL, INKEY$, the tape's file names; the language packages build their own
; String operations on them (Klive BASIC's `strings`).

; ------------------------------------------------------------------------------------------------
; Allocates a String of BC characters and sets its length; the characters are not set.
; Out: HL = the String, or 0 when the heap is full. Changes AF, BC, DE.
StrAlloc:
    push bc
    ld hl,2
    add hl,bc
    ld b,h
    ld c,l                  ; BC = block payload size
    pop de                  ; DE = length
    jp c,AllocFailed        ; longer than a block can hold
    push de
    call Alloc
    pop bc                  ; BC = length
    ld a,h
    or l
    ret z
    ld (hl),c
    inc hl
    ld (hl),b
    dec hl
    ret

; ------------------------------------------------------------------------------------------------
; The length of String HL (0 for the empty String). Out: BC. Changes AF only.
StrLen:
    ld bc,0
    ld a,h
    or l
    ret z
    ld c,(hl)
    inc hl
    ld b,(hl)
    dec hl
    ret

; ------------------------------------------------------------------------------------------------
; CHR$: a String of the one character A. Out: HL; 0 when the heap is full. Changes AF, BC, DE.
StrChr:
    push af                 ; S: [char]
    ld bc,1
    call StrAlloc
    pop af                  ; A = char                             S: []
    ld c,a
    ld a,h
    or l
    ret z
    inc hl
    inc hl
    ld (hl),c
    dec hl
    dec hl
    ret

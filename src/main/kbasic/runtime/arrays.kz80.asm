; @module   arrays
; @summary  Array element addresses from descriptors, and local arrays' data on the heap.
; @exports  ArrayAddress, ArrayAlloc, ArrayInit, ArrayFreeStrings, ArrayLBound, ArrayUBound
; @exports  ArrayCopyStrings
; @requires arith16, heap, errors, strings
;
; A descriptor is four words (runtime-abi.md §2.3): the dimension table, the data, the lower-bound
; table (or 0: every lower bound is 0), the upper-bound table (or 0). The dimension table holds the
; number of dimensions - 1 (a word), the element count of dimensions 2..n (a word each), then the
; element size (a byte). Data is row-major: the last subscript varies fastest.
;
; ArrayAddress keeps its working values in memory, not on the stack, so it can walk the indices the
; caller pushed. It is therefore not re-entrant: an interrupt handler must not index an array whose
; code is interrupted in ArrayAddress.

; ------------------------------------------------------------------------------------------------
; The address of an element. In: HL = the descriptor; A = the number of indices; the indices on the
; stack under the return address, the first pushed first (so the last is on top). Out: HL = the
; element's address; the indices are removed. Changes AF, BC, DE.
ArrayAddress:
    ld (ArrDescriptor),hl
    pop hl
    ld (ArrReturn),hl       ; the indices are now on top of the stack
    ld (ArrLeft),a
    ld hl,0
    ld (ArrOffset),hl       ; the element number so far
    inc hl
    ld (ArrStride),hl       ; the elements one step of the current index moves
ArrayAddressLoop:           ; the index of dimension ArrLeft - 1 is on top of the stack
    ld hl,(ArrDescriptor)
    inc hl
    inc hl
    inc hl
    inc hl
    ld e,(hl)
    inc hl
    ld d,(hl)               ; DE = the lower-bound table, or 0
    pop hl                  ; HL = the index
    ld a,d
    or e
    jr z,ArrayAddressBased
    ld a,(ArrLeft)
    dec a
    add a,a
    add a,e
    ld e,a
    ld a,0
    adc a,d
    ld d,a                  ; DE = the lower bound's address
    ld a,(de)
    ld c,a
    inc de
    ld a,(de)
    ld b,a                  ; BC = the lower bound
    or a
    sbc hl,bc               ; HL = index - lower bound
ArrayAddressBased:
    ld de,(ArrStride)
    call Mul16              ; HL = (index - lower) * stride
    ld de,(ArrOffset)
    add hl,de
    ld (ArrOffset),hl
    ld a,(ArrLeft)
    dec a
    ld (ArrLeft),a
    jr z,ArrayAddressDone
    ; --- The stride grows by this dimension's element count (dimensions 2..n are in the table)
    ld c,a                  ; C = k, the 0-based dimension just done (k >= 1); its count is at table + 2k
    ld hl,(ArrDescriptor)
    ld e,(hl)
    inc hl
    ld d,(hl)               ; DE = the dimension table
    ex de,hl
    ld a,c
    add a,a
    ld e,a
    ld d,0
    add hl,de               ; HL = the address of dimension k's count
    ld e,(hl)
    inc hl
    ld d,(hl)
    ld hl,(ArrStride)
    call Mul16
    ld (ArrStride),hl
    jr ArrayAddressLoop
ArrayAddressDone:           ; the element number is in ArrOffset
    ld hl,(ArrDescriptor)
    ld e,(hl)
    inc hl
    ld d,(hl)               ; DE = the dimension table
    ex de,hl
    ld c,(hl)
    inc hl
    ld b,(hl)               ; BC = dimensions - 1
    inc hl
    add hl,bc
    add hl,bc               ; HL = the element size's address
    ld e,(hl)
    ld d,0
    ld hl,(ArrOffset)
    call Mul16              ; HL = the byte offset
    ex de,hl
    ld hl,(ArrDescriptor)
    inc hl
    inc hl
    ld a,(hl)
    inc hl
    ld h,(hl)
    ld l,a                  ; HL = the data
    add hl,de
    ld de,(ArrReturn)
    push de
    ret

; ------------------------------------------------------------------------------------------------
; A whole String array copied onto another of the same size: each of the BC target elements at DE
; is freed and becomes a copy of the source element at HL. Changes AF, BC, DE, HL.
ArrayCopyStrings:
    ld a,b
    or c
    ret z
    push bc                 ; S: [count]
    push de                 ; S: [dst][count]
    push hl                 ; S: [src][dst][count]
    ld a,(hl)
    inc hl
    ld h,(hl)
    ld l,a
    call StrDup             ; HL = a copy of the source element
    pop bc                  ; BC = src                              S: [dst][count]
    pop de                  ; DE = dst                              S: [count]
    push de
    push bc                 ; S: [src][dst][count]
    call StrStore           ; the target element takes the copy and frees its old value
    pop hl                  ; S: [dst][count]
    pop de                  ; S: [count]
    pop bc                  ; S: []
    inc hl
    inc hl
    inc de
    inc de
    dec bc
    jr ArrayCopyStrings

; ------------------------------------------------------------------------------------------------
; LBOUND and UBOUND of the array whose descriptor is HL, for dimension DE (from 1); dimension 0 gives
; the number of dimensions. A descriptor without a lower-bound table has every lower bound 0. (The
; compiler gives every array an upper-bound table when the program asks UBOUND of an array
; parameter.) Out: HL. Changes AF, BC, DE.
ArrayLBound:
    ld c,4
    jr ArrayBound
ArrayUBound:
    ld c,6
ArrayBound:                 ; C = the table pointer's offset in the descriptor
    ld a,d
    or e
    jr z,ArrayBoundCount
    ld b,0
    add hl,bc
    ld a,(hl)
    inc hl
    ld h,(hl)
    ld l,a                  ; HL = the table, or 0
    or h
    ret z
    dec de
    add hl,de
    add hl,de
    ld a,(hl)
    inc hl
    ld h,(hl)
    ld l,a
    ret
ArrayBoundCount:
    ld a,(hl)
    inc hl
    ld h,(hl)
    ld l,a                  ; HL = the dimension table
    ld a,(hl)
    inc hl
    ld h,(hl)
    ld l,a
    inc hl                  ; the number of dimensions
    ret

ArrDescriptor:
    .defw 0
ArrReturn:
    .defw 0
ArrOffset:
    .defw 0
ArrStride:
    .defw 0
ArrLeft:
    .defb 0

; ------------------------------------------------------------------------------------------------
; A local array's data: HL bytes from the heap, cleared. Out: HL = the data. When the heap is full
; the program stops with "4 Out of memory". Changes AF, BC, DE.
ArrayAlloc:
    push hl                 ; S: [bytes]
    ld b,h
    ld c,l
    call Alloc
    pop bc                  ; BC = bytes                           S: []
    ld a,h
    or l
    ld a,3                  ; ERR_NR 3: "4 Out of memory"
    jp z,RaiseError
    push hl                 ; S: [data]
ArrayAllocClear:
    ld a,b
    or c
    jr z,ArrayAllocDone
    ld (hl),0
    inc hl
    dec bc
    jr ArrayAllocClear
ArrayAllocDone:
    pop hl                  ; HL = data                            S: []
    ret

; ------------------------------------------------------------------------------------------------
; A local array's initial values: copies BC bytes from HL (the program's image of the `=> {...}`
; list) to the data at DE. Changes AF, BC, DE, HL.
ArrayInit:
    ldir
    ret

; ------------------------------------------------------------------------------------------------
; Frees BC String elements starting at HL, then the data block HL itself (a local String array at
; its routine's exit). Changes AF, BC, DE, HL.
ArrayFreeStrings:
    push hl                 ; S: [data]
ArrayFreeStringsLoop:
    ld a,b
    or c
    jr z,ArrayFreeStringsDone
    ld e,(hl)
    inc hl
    ld d,(hl)
    inc hl
    push hl                 ; S: [next][data]
    push bc                 ; S: [count][next][data]
    ex de,hl
    call Free
    pop bc                  ; S: [next][data]
    pop hl                  ; S: [data]
    dec bc
    jr ArrayFreeStringsLoop
ArrayFreeStringsDone:
    pop hl                  ; S: []
    jp Free

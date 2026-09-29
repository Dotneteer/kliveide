; @module   strings
; @summary  Core String routines: allocation, length, copy, concatenation, store and comparison.
; @exports  StrAlloc, StrLen, StrDup, StrConcat, StrStore, StrCompare, StrCopyChars
; @exports  StrSlice, StrLength, StrCode, StrChr, StrOverwrite
; @requires heap
;
; A String value is a pointer to a heap block [length:2][characters], or 0 for the empty string
; (runtime-abi.md §2.2). A String produced by an expression is a temporary: whoever consumes it frees
; it. The routines that take two Strings take "free after use" flags in A: bit 0 frees the first
; operand (HL), bit 1 the second (DE), after the result has been built.

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
; Copies the characters of String HL to DE. Out: DE = the address after the copy. Changes AF, BC, HL.
StrCopyChars:
    call StrLen
    ld a,b
    or c
    ret z
    inc hl
    inc hl
    ldir
    ret

; ------------------------------------------------------------------------------------------------
; A new copy of String HL (which is left alone). Out: HL = the copy; 0 for the empty String or when
; the heap is full. Changes AF, BC, DE.
StrDup:
    call StrLen
    ld a,b
    or c
    jr z,StrDupEmpty
    push hl                 ; S: [source]
    call StrAlloc
    pop de                  ; DE = source                          S: []
    ld a,h
    or l
    ret z
    push hl                 ; S: [copy]
    ex de,hl                ; HL = source, DE = copy
    inc de
    inc de
    call StrCopyChars
    pop hl                  ; HL = copy                            S: []
    ret
StrDupEmpty:
    ld hl,0
    ret

; ------------------------------------------------------------------------------------------------
; Concatenates Strings HL and DE. In: A = free flags. Out: HL = the new String; 0 when it is empty,
; longer than 65535 characters, or the heap is full. Changes AF, BC, DE.
StrConcat:
    push af                 ; S: [flags]
    push de                 ; S: [second][flags]
    push hl                 ; S: [first][second][flags]
    call StrLen             ; BC = first's length
    ex de,hl                ; HL = second
    push bc                 ; S: [len1][first][second][flags]
    call StrLen             ; BC = second's length
    pop hl                  ; HL = len1                            S: [first][second][flags]
    add hl,bc
    ld b,h
    ld c,l                  ; BC = total length
    ld hl,0
    jr c,StrConcatFree      ; too long
    ld a,b
    or c
    jr z,StrConcatFree      ; empty
    call StrAlloc
    ld a,h
    or l
    jr z,StrConcatFree      ; heap full
    ex de,hl                ; DE = result
    pop hl                  ; HL = first                           S: [second][flags]
    push hl                 ; S: [first][second][flags]
    push de                 ; S: [result][first][second][flags]
    inc de
    inc de
    call StrCopyChars
    ld hl,4
    add hl,sp
    ld a,(hl)
    inc hl
    ld h,(hl)
    ld l,a                  ; HL = second
    call StrCopyChars
    pop hl                  ; HL = result                          S: [first][second][flags]
StrConcatFree:              ; HL = result                          S: [first][second][flags]
    pop de                  ; DE = first
    pop bc                  ; BC = second
    ex (sp),hl              ; H = flags                            S: [result]
    ld a,h
    push bc                 ; S: [second][result]
    ex de,hl                ; HL = first
    call StrFreeOperands
    pop hl                  ; HL = result                          S: []
    ret

; Frees HL if bit 0 of A is set and the String under the return address if bit 1 is set, then drops
; that String from the stack. Changes AF, BC, DE, HL.
StrFreeOperands:
    pop bc                  ; BC = return address                  S: [second]
    ex (sp),hl              ; HL = second                          S: [first]
    push bc                 ; S: [ret][first]
    rra
    rra                     ; carry = bit 1
    push af                 ; S: [flags][ret][first]
    call c,Free             ; the second operand
    pop af                  ; S: [ret][first]
    pop bc                  ; BC = return address                  S: [first]
    pop hl                  ; HL = first                           S: []
    push bc                 ; S: [ret]
    rla                     ; carry = bit 0 (A was rotated right twice)
    ret nc
    jp Free                 ; the first operand

; ------------------------------------------------------------------------------------------------
; Stores String HL into the String variable at DE, taking ownership of HL, and frees the value the
; variable held. Changes AF, BC, DE, HL.
StrStore:
    ex de,hl                ; HL = variable, DE = new value
    ld c,(hl)
    ld (hl),e
    inc hl
    ld b,(hl)
    ld (hl),d               ; BC = old value
    ld h,b
    ld l,c
    jp Free

; ------------------------------------------------------------------------------------------------
; Compares Strings HL and DE character by character (unsigned); a String that is a prefix of the
; other is the smaller. In: A = free flags. Out: A = $FF (HL < DE), 0 (equal) or 1 (HL > DE), with
; the flags of "or a": Z when equal, S when less. Changes BC, DE, HL.
StrCompare:
    push af                 ; S: [flags]
    push de                 ; S: [second][flags]
    push hl                 ; S: [first][second][flags]
    call StrLen             ; BC = len1
    push bc                 ; S: [len1][first][second][flags]
    ex de,hl                ; HL = second, DE = first
    call StrLen             ; BC = len2
    pop hl                  ; HL = len1                            S: [first][second][flags]
    push hl                 ; S: [len1][first][second][flags]
    push bc                 ; S: [len2][len1][first][second][flags]
    or a
    sbc hl,bc
    jr nc,StrCompareN       ; len1 >= len2: compare len2 characters
    add hl,bc
    ld b,h
    ld c,l                  ; BC = len1
StrCompareN:                ; BC = characters to compare
    ld hl,4
    add hl,sp
    ld e,(hl)
    inc hl
    ld d,(hl)               ; DE = first
    inc hl
    ld a,(hl)
    inc hl
    ld h,(hl)
    ld l,a                  ; HL = second
    inc de
    inc de
    inc hl
    inc hl
StrCompareLoop:
    ld a,b
    or c
    jr z,StrCompareLengths
    ld a,(de)
    cp (hl)
    jr nz,StrCompareDiffer
    inc de
    inc hl
    dec bc
    jr StrCompareLoop
StrCompareDiffer:           ; carry: first < second
    sbc a,a                 ; A = $FF when less, else 0
    or 1                    ; A = $FF or 1
    pop bc
    pop bc                  ;                                      S: [first][second][flags]
    jr StrCompareDone
StrCompareLengths:
    pop bc                  ; BC = len2
    pop hl                  ; HL = len1                            S: [first][second][flags]
    or a
    sbc hl,bc
    ld a,0
    jr z,StrCompareDone
    sbc a,a                 ; $FF when len1 < len2
    or 1
StrCompareDone:             ; A = result                           S: [first][second][flags]
    pop hl                  ; HL = first
    pop de                  ; DE = second
    pop bc                  ; B = flags                            S: []
    push af                 ; S: [result]
    push de                 ; S: [second][result]
    ld a,b
    call StrFreeOperands
    pop af                  ; A = result                           S: []
    or a
    ret

; ------------------------------------------------------------------------------------------------
; A substring of String HL: characters BC to DE (0-based, inclusive; DE = $FFFF for "to the end").
; The upper bound is clipped to the last character; a lower bound past it gives the empty String.
; In: A = free flags (bit 0 frees HL). Out: HL = the new String; 0 when it is empty or the heap is
; full. Changes AF, BC, DE.
StrSlice:
    push af                 ; S: [flags]
    push hl                 ; S: [src][flags]
    push bc                 ; S: [from][src][flags]
    call StrLen             ; BC = length
    ld a,b
    or c
    jr z,StrSliceNone       ; the empty String
    dec bc                  ; BC = the last index
    ld h,d
    ld l,e
    or a
    sbc hl,bc
    jr c,StrSliceTo         ; to < last: keep it
    ld d,b
    ld e,c                  ; DE = to = last
StrSliceTo:
    pop bc                  ; BC = from                            S: [src][flags]
    ex de,hl                ; HL = to
    or a
    sbc hl,bc               ; HL = to - from
    jr c,StrSliceEmpty      ; from > to
    inc hl                  ; HL = the number of characters
    push bc                 ; S: [from][src][flags]
    push hl                 ; S: [count][from][src][flags]
    ld b,h
    ld c,l
    call StrAlloc           ; HL = the new String
    pop bc                  ; BC = count                           S: [from][src][flags]
    pop de                  ; DE = from                            S: [src][flags]
    ld a,h
    or l
    jr z,StrSliceDone       ; heap full: the empty String
    push hl                 ; S: [new][src][flags]
    push de                 ; S: [from][new][src][flags]
    ld hl,4
    add hl,sp
    ld e,(hl)
    inc hl
    ld d,(hl)               ; DE = src
    pop hl                  ; HL = from                            S: [new][src][flags]
    add hl,de
    inc hl
    inc hl                  ; HL = the first character to copy
    pop de                  ; DE = new                             S: [src][flags]
    push de                 ; S: [new][src][flags]
    inc de
    inc de
    ldir
    pop hl                  ; HL = new                             S: [src][flags]
    jr StrSliceDone
StrSliceNone:               ; S: [from][src][flags]
    pop bc
StrSliceEmpty:              ; S: [src][flags]
    ld hl,0
StrSliceDone:               ; HL = result                          S: [src][flags]
    pop de                  ; DE = src
    pop af                  ; A = flags                            S: []
    push hl                 ; S: [result]
    ex de,hl                ; HL = src
    rra                     ; carry = bit 0
    call c,Free
    pop hl                  ; HL = result                          S: []
    ret

; ------------------------------------------------------------------------------------------------
; LEN: the length of String HL. In: A = free flags (bit 0 frees HL). Out: HL = the length.
; Changes AF, BC, DE.
StrLength:
    push af                 ; S: [flags]
    call StrLen             ; BC = length
    pop af                  ; S: []
    push bc                 ; S: [length]
    rra                     ; carry = bit 0
    call c,Free
    pop hl                  ; HL = length                          S: []
    ret

; ------------------------------------------------------------------------------------------------
; CODE: the code of String HL's first character, 0 for the empty String. In: A = free flags (bit 0
; frees HL). Out: A. Changes F, BC, DE, HL.
StrCode:
    push af                 ; S: [flags]
    call StrLen
    ld e,0
    ld a,b
    or c
    jr z,StrCodeFree
    inc hl
    inc hl
    ld e,(hl)
    dec hl
    dec hl
StrCodeFree:
    pop af                  ; S: []
    push de                 ; S: [code]
    rra                     ; carry = bit 0
    call c,Free
    pop de                  ; S: []
    ld a,e
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

; ------------------------------------------------------------------------------------------------
; Substring assignment, in place: characters BC to DE (0-based, inclusive; DE = $FFFF for "to the
; end") of String HL take the value's characters. The range is clipped to the String; a shorter
; value is padded with spaces, a longer one cut; the String's length never changes. In: HL = the
; target String, BC, DE, A = free flags (bit 0 frees the value), the value String under the return
; address (removed). Changes AF, BC, DE, HL.
StrOverwrite:
    ld (StrOvFlags),a
    ld (StrOvFrom),bc
    ld (StrOvTo),de
    ld (StrOvTarget),hl
    pop hl
    ex (sp),hl              ; HL = the value                        S: [ret]
    ld (StrOvValue),hl
    ld hl,(StrOvTarget)
    call StrLen             ; BC = the target's length
    ld a,b
    or c
    jr z,StrOvDone
    dec bc                  ; BC = the last index
    ld hl,(StrOvTo)
    or a
    sbc hl,bc
    jr c,StrOvToKept
    ld (StrOvTo),bc         ; to = last
StrOvToKept:
    ld hl,(StrOvTo)
    ld de,(StrOvFrom)
    or a
    sbc hl,de
    jr c,StrOvDone          ; from > to: nothing to write
    inc hl
    ld b,h
    ld c,l                  ; BC = the characters to write
    ld hl,(StrOvTarget)
    inc hl
    inc hl
    add hl,de
    ex de,hl                ; DE = the first character to write
    ld hl,(StrOvValue)
    push bc                 ; S: [count]
    call StrLen             ; BC = the value's length
    inc hl
    inc hl                  ; HL = its characters
    ex (sp),hl              ; HL = count                            S: [value chars]
StrOvLoop:
    ld a,h
    or l
    jr z,StrOvCopied
    ld a,b
    or c
    ld a,' '
    jr z,StrOvPut           ; the value has run out: a space
    ex (sp),hl
    ld a,(hl)
    inc hl
    ex (sp),hl
    dec bc
StrOvPut:
    ld (de),a
    inc de
    dec hl
    jr StrOvLoop
StrOvCopied:
    pop hl                  ; S: [ret]
StrOvDone:
    ld a,(StrOvFlags)
    rra
    ret nc
    ld hl,(StrOvValue)
    jp Free

StrOvFlags:
    .defb 0
StrOvFrom:
    .defw 0
StrOvTo:
    .defw 0
StrOvTarget:
    .defw 0
StrOvValue:
    .defw 0

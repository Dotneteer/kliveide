; @module   heap
; @summary  The heap: first-fit allocation from an address-ordered free list, coalescing on free.
; @exports  HeapInit, Alloc, Free, AllocFailed, FreeList
; @requires errors
; @init     HeapInit
; @symbols  KB_CHECK_MEMORY
;
; The heap is HeapSize bytes at HeapStart (both defined by the linker). Every block starts with a
; 2-byte size that includes those two bytes; a program sees the payload that follows. A free block
; keeps the address of the next free block (0 at the end) in its first two payload bytes, so a block
; is at least 4 bytes. FreeList holds the first free block, and the free blocks are kept in address
; order with no two of them adjacent.
;
; An allocation that cannot be satisfied returns 0 (read as the empty string), or stops the program
; with "4 Out of memory" when the program was compiled with memory checking (KB_CHECK_MEMORY).

; ------------------------------------------------------------------------------------------------
; Makes the whole heap one free block. Changes AF, DE, HL.
HeapInit:
    ld hl,HeapSize
    ld de,4
    or a
    sbc hl,de
    ld hl,0
    jr c,HeapInitDone       ; too small for a block: no heap
    ld hl,HeapStart
    ld de,HeapSize
    ld (hl),e
    inc hl
    ld (hl),d
    inc hl
    xor a
    ld (hl),a
    inc hl
    ld (hl),a
    ld hl,HeapStart
HeapInitDone:
    ld (FreeList),hl
    ret

FreeList:
    .defw 0

; ------------------------------------------------------------------------------------------------
; Allocates BC bytes. Out: HL = the payload address, or 0 (see the module comment). The payload is
; not cleared. Changes AF, BC, DE.
;
; Takes the first free block that is large enough; the allocation is cut from its end, so a split
; block keeps its place in the list.
Alloc:
    ld hl,2
    add hl,bc               ; HL = BC + the size word
    jr c,AllocFailed
    ld a,h
    or a
    jr nz,AllocSized
    ld a,l
    cp 4
    jr nc,AllocSized
    ld l,4                  ; the smallest block
AllocSized:
    ld b,h
    ld c,l                  ; BC = block size needed
    ld hl,FreeList          ; HL = the link that points at the block being examined
AllocLoop:
    ld e,(hl)
    inc hl
    ld d,(hl)
    dec hl                  ; DE = block
    ld a,d
    or e
    jr z,AllocFailed        ; end of the list
    push hl                 ; S: [link]
    ex de,hl                ; HL = block
    ld e,(hl)
    inc hl
    ld d,(hl)
    dec hl                  ; DE = its size
    push hl                 ; S: [block][link]
    ex de,hl                ; HL = size
    or a
    sbc hl,bc               ; HL = what would remain
    jr nc,AllocFits
    pop hl                  ; HL = block                           S: [link]
    inc hl
    inc hl                  ; HL = the block's next-free field: the next link
    pop de                  ;                                      S: []
    jr AllocLoop
AllocFits:                  ; HL = remainder, BC = size needed     S: [block][link]
    ld a,h
    or a
    jr nz,AllocSplit
    ld a,l
    cp 4
    jr nc,AllocSplit
    pop hl                  ; remainder too small: take the whole block
    push hl                 ; HL = block                           S: [block][link]
    inc hl
    inc hl
    ld e,(hl)
    inc hl
    ld d,(hl)               ; DE = next free block
    pop hl                  ; HL = block                           S: [link]
    ex (sp),hl              ; HL = link                            S: [block]
    ld (hl),e
    inc hl
    ld (hl),d               ; link = next free block
    pop hl                  ; HL = block                           S: []
    inc hl
    inc hl                  ; HL = payload
    ret
AllocSplit:                 ; HL = remainder >= 4                  S: [block][link]
    ex de,hl                ; DE = remainder
    pop hl                  ; HL = block                           S: [link]
    ld (hl),e
    inc hl
    ld (hl),d               ; the free block shrinks to the remainder
    dec hl
    add hl,de               ; HL = the allocated block, at its end
    ld (hl),c
    inc hl
    ld (hl),b
    inc hl                  ; HL = payload
    pop de                  ;                                      S: []
    ret

; ------------------------------------------------------------------------------------------------
; Where every failed allocation ends: returns HL = 0, or stops with "4 Out of memory" under memory
; checking. Jump here (not call) with a balanced stack.
AllocFailed:
#ifdef KB_CHECK_MEMORY
    ld a,3
    jp RaiseError
#else
    ld hl,0
    ret
#endif

; ------------------------------------------------------------------------------------------------
; Frees the block whose payload HL points at; HL = 0 does nothing. Changes AF, BC, DE, HL.
Free:
    ld a,h
    or l
    ret z
    dec hl
    dec hl
    ex de,hl                ; DE = block
    ld hl,FreeList          ; HL = link
FreeFind:                   ; find the link to the first free block above the freed one
    push hl                 ; S: [link]
    ld a,(hl)
    inc hl
    ld h,(hl)
    ld l,a                  ; HL = next free block
    or h
    jr z,FreeInsert         ; end of the list
    push hl
    or a
    sbc hl,de
    pop hl
    jr nc,FreeInsert        ; it is above the freed block
    pop af                  ;                                      S: []
    inc hl
    inc hl                  ; HL = its next-free field
    jr FreeFind
FreeInsert:                 ; HL = next free block (or 0), DE = block S: [link]
    ex de,hl                ; HL = block, DE = next
    inc hl
    inc hl
    ld (hl),e
    inc hl
    ld (hl),d               ; block.next = next
    dec hl
    dec hl
    dec hl                  ; HL = block
    ex (sp),hl              ; HL = link                            S: [block]
    pop de                  ; DE = block                           S: []
    ld (hl),e
    inc hl
    ld (hl),d               ; link = block
    dec hl
    push hl                 ; S: [link]
    ex de,hl                ; HL = block
    call FreeMerge          ; merge it with the next free block
    pop hl                  ; HL = link                            S: []
    ld de,FreeList
    or a
    sbc hl,de
    ret z                   ; it is the first free block: nothing before it
    add hl,de
    dec hl
    dec hl                  ; HL = the previous free block
    ; fall through: merge the previous block with the freed one

; Merges free block HL with the free block after it, if they are adjacent. Changes AF, BC, DE, HL.
FreeMerge:
    ld c,(hl)
    inc hl
    ld b,(hl)               ; BC = its size
    inc hl
    ld e,(hl)
    inc hl
    ld d,(hl)               ; DE = next free block
    dec hl
    dec hl
    dec hl                  ; HL = block
    ld a,d
    or e
    ret z
    push hl                 ; S: [block]
    add hl,bc
    or a
    sbc hl,de
    pop hl                  ; HL = block                           S: []
    ret nz                  ; not adjacent
    push hl                 ; S: [block]
    ex de,hl                ; HL = next
    ld e,(hl)
    inc hl
    ld d,(hl)               ; DE = next's size
    inc hl
    ld a,(hl)
    inc hl
    ld h,(hl)
    ld l,a                  ; HL = the free block after next
    ex de,hl                ; HL = next's size, DE = the one after
    add hl,bc
    ld b,h
    ld c,l                  ; BC = merged size
    pop hl                  ; HL = block                           S: []
    ld (hl),c
    inc hl
    ld (hl),b
    inc hl
    ld (hl),e
    inc hl
    ld (hl),d
    ret

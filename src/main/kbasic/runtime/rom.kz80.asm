; @module   rom
; @summary  Calls into the 48K BASIC ROM with IY = $5C3A, restoring the caller's IY.
; @exports  RomCall, RomIn, RomOut
;
; The ROM is used only for the Float calculator, Float <-> text, tape and error reports (plan §6.3).
; On the 128K and the +3 the 48K BASIC ROM must be paged in for them: RomIn pages it in and RomOut
; puts back what the program had (the 128K: bit 4 of $7FFD, shadowed in BANKM; the +3: bit 2 of
; $1FFD too, shadowed in BANK678; the Next: MMU slots 0 and 1 set to the ROM and ROM 3 selected
; through NextReg $8E, which is readable, so the program's mapping is read rather than shadowed).
; They nest (only the outermost pair pages), and on the 48K they do nothing. The calculator
; (RST $28) reads its literals from the bytes after the restart, so it cannot go through RomCall: a
; calculator sequence gets its own stub that calls RomIn and RomOut and sets and restores IY around
; it.

; ------------------------------------------------------------------------------------------------
; Calls a ROM routine:
;       call core.RomCall
;       .defw <routine address>
; A, F, BC, DE and HL reach the routine and come back from it unchanged by the wrapper; IY is $5C3A
; while the routine runs and the caller's afterwards. Uses two stack words besides the routine's
; own; keeps no state in memory, so an interrupt handler may call it too.
RomCall:                    ; S: [ptr to the address word]
    call RomIn
    ex (sp),iy              ; IY = ptr                              S: [caller IY]
    inc iy
    inc iy                  ; IY = return address, past the word
    push iy                 ;                                       S: [ret][IY]
    push hl                 ;                                       S: [HL][ret][IY]
    ld l,(iy-2)
    ld h,(iy-1)             ; HL = routine address
    ld iy,RomCallReturn
    ex (sp),iy              ; IY = caller HL                        S: [RomCallReturn][ret][IY]
    push hl                 ;                                       S: [routine][RomCallReturn][ret][IY]
    push iy
    pop hl                  ; HL = caller HL
    ld iy,$5c3a
    ret                     ; into the routine, which returns to RomCallReturn
RomCallReturn:              ; S: [ret][caller IY]
    pop iy                  ; IY = ret                              S: [caller IY]
    ex (sp),iy              ; IY = caller IY                        S: [ret]
    jp RomOut

; ------------------------------------------------------------------------------------------------
; Pages the 48K BASIC ROM in (RomIn) and back out to what the program had (RomOut). Change nothing,
; the flags included.
RomIn:
#ifmod Spectrum128
    push af
    ld a,(RomDepth)
    inc a
    ld (RomDepth),a
    dec a
    jr nz,RomInDone
    push bc
    ld a,($5b5c)            ; BANKM
    ld (RomSavedBank),a
    or $10                  ; ROM 1: 48K BASIC
    ld ($5b5c),a
    ld bc,$7ffd
    out (c),a
    pop bc
RomInDone:
    pop af
#endif
#ifmod SpectrumP3
    push af
    ld a,(RomDepth)
    inc a
    ld (RomDepth),a
    dec a
    jr nz,RomInDone
    push bc
    ld a,($5b5c)            ; BANKM
    ld (RomSavedBank),a
    or $10
    ld ($5b5c),a
    ld bc,$7ffd
    out (c),a
    ld a,($5b67)            ; BANK678
    ld (RomSavedBank678),a
    or $04                  ; with bit 4 of $7FFD: ROM 3, 48K BASIC
    ld ($5b67),a
    ld b,$1f
    out (c),a
    pop bc
RomInDone:
    pop af
#endif
#ifmod Next
    push af
    ld a,(RomDepth)
    inc a
    ld (RomDepth),a
    dec a
    jr nz,RomInDone
    push bc
    ld bc,$243b
    ld a,$50
    out (c),a
    inc b
    in a,(c)                ; MMU0
    ld (RomSavedBank),a
    dec b
    ld a,$51
    out (c),a
    inc b
    in a,(c)                ; MMU1
    ld (RomSavedBank678),a
    dec b
    ld a,$8e
    out (c),a
    inc b
    in a,(c)                ; the 128K mapping: ROM select in bits 1 and 0
    ld (RomSaved8E),a
    and $f0                 ; bit 3 clear: the RAM banks stay; bit 2 clear: normal paging
    or $03                  ; ROM 3: 48K BASIC
    nextreg $8e,a
    nextreg $50,$ff         ; slots 0 and 1: the ROM
    nextreg $51,$ff
    pop bc
RomInDone:
    pop af
#endif
    ret

RomOut:
#ifmod Spectrum128
    push af
    ld a,(RomDepth)
    dec a
    ld (RomDepth),a
    jr nz,RomOutDone
    push bc
    ld a,(RomSavedBank)
    ld ($5b5c),a
    ld bc,$7ffd
    out (c),a
    pop bc
RomOutDone:
    pop af
#endif
#ifmod SpectrumP3
    push af
    ld a,(RomDepth)
    dec a
    ld (RomDepth),a
    jr nz,RomOutDone
    push bc
    ld a,(RomSavedBank)
    ld ($5b5c),a
    ld bc,$7ffd
    out (c),a
    ld a,(RomSavedBank678)
    ld ($5b67),a
    ld b,$1f
    out (c),a
    pop bc
RomOutDone:
    pop af
#endif
#ifmod Next
    push af
    ld a,(RomDepth)
    dec a
    ld (RomDepth),a
    jr nz,RomOutDone
    ld a,(RomSaved8E)
    and $f7                 ; bit 3 clear: only the ROM selection changes back
    nextreg $8e,a
    ld a,(RomSavedBank)
    nextreg $50,a
    ld a,(RomSavedBank678)
    nextreg $51,a
RomOutDone:
    pop af
#endif
    ret

RomDepth:
    .defb 0
RomSavedBank:
    .defb 0
RomSavedBank678:
    .defb 0
RomSaved8E:
    .defb 0

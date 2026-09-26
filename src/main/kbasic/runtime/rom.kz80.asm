; @module   rom
; @summary  Calls into the 48K BASIC ROM with IY = $5C3A, restoring the caller's IY.
; @exports  RomCall
;
; The ROM is used only for the Float calculator, Float <-> text, tape and error reports (plan §6.3).
; Paging the 48K BASIC ROM in on the 128K, +3 and Next is added with those targets (plan Phases 4
; and 6). The calculator (RST $28) reads its literals from the bytes after the restart, so it cannot
; go through RomCall: a calculator sequence gets its own stub that sets and restores IY around it.

; ------------------------------------------------------------------------------------------------
; Calls a ROM routine:
;       call core.RomCall
;       .defw <routine address>
; A, F, BC, DE and HL reach the routine and come back from it unchanged by the wrapper; IY is $5C3A
; while the routine runs and the caller's afterwards. Uses two stack words besides the routine's
; own; keeps no state in memory, so an interrupt handler may call it too.
RomCall:                    ; S: [ptr to the address word]
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
    ret

; @module   banking
; @summary  CODEBANK far calls (the ZX Spectrum Next): trampolines enter banked routines through here.
; @exports  FarCall, FarReturn, FarInit, FarMap, FarBank, FarSP
; @init     FarInit
;
; Klive's own implementation of the contract in .ai/kbasic/codebank-contract.md §4. A banked
; routine's resident trampoline is `call FarCall` followed by the logical bank (a byte) and the
; body's address (a word). The compiler defines FarReg (the NextReg of the window's first MMU slot),
; FarSlots (1 for an 8K window, 2 for 16K), FarDepth, the page table FarPages (a row per logical
; bank, row 0 the window's pages at start-up) and the shadow stack FarStack in core-open/core-close.
;
; The debugger pairs return slots holding FarReturn with shadow records from the oldest end, so
; FarCall writes its record before it replaces the slot, and FarReturn pops its record only after
; its slot has gone: between the two there is at most one record without a slot, always the newest.
;
; While a banked routine runs, the Z80 stack is exactly as after a direct call - the arguments, then
; one return-address slot - so frame offsets, G4 and the debugger's frame locator hold across banks
; (plan §9.2). On a cross-bank call the slot holds FarReturn and the shadow stack keeps
; {previous bank, real return address}; the debug info publishes FarReturn, FarBank and FarSP so
; the call stack can show the real caller (plan §9.4). Far calls preserve every register; only the
; window's MMU register(s) change. Not re-entrant: an interrupt handler must not far-call.

; ------------------------------------------------------------------------------------------------
; Enters a banked routine: called by its trampoline, with the bank and the body after the call.
FarCall:
    ld (FarSaveHL),hl
    ld (FarSaveDE),de
    ld (FarSaveBC),bc
    pop hl                  ; HL = the trampoline's bank byte       S: [return to the caller]...
    push af
    pop bc
    ld (FarSaveAF),bc
    ld a,(hl)               ; A = the wanted bank
    inc hl
    ld e,(hl)
    inc hl
    ld d,(hl)
    ld (FarJump+1),de       ; the body
    ld hl,FarBank
    cp (hl)
    jr z,FarGo              ; the same bank: straight in, the stack as after a direct call
    ld b,(hl)               ; B = the current bank
    ld (hl),a               ; the wanted one is current now
    pop de                  ; DE = the real return address (read, and put back unchanged)
    push de
    ld hl,(FarSP)
    ld (hl),b               ; the shadow record first: previous bank, real return address
    inc hl
    ld (hl),e
    inc hl
    ld (hl),d
    inc hl
    ld (FarSP),hl
    ld hl,FarReturn         ; then the return slot: the far return (one instruction, so at every
    ex (sp),hl              ; instruction boundary the records are the slots plus at most one newer)
    call FarMap             ; A = the wanted bank
FarGo:
    ld bc,(FarSaveAF)
    push bc
    pop af
    ld bc,(FarSaveBC)
    ld de,(FarSaveDE)
    ld hl,(FarSaveHL)
FarJump:
    jp 0

; ------------------------------------------------------------------------------------------------
; Where a banked routine called across banks returns: pops the shadow record, maps the caller's bank
; back and returns to the real caller with every register as the routine left it (the result may
; be in A, HL, DE:HL or A-E-D-C-B).
FarReturn:
    push af
    push de
    push hl
    ld hl,(FarSP)
    dec hl
    ld d,(hl)
    dec hl
    ld e,(hl)               ; DE = the real return address
    dec hl
    ld a,(hl)               ; A = the caller's bank
    ld (FarSP),hl
    ld (FarBank),a
    ld (FarJump2+1),de
    call FarMap
    pop hl
    pop de
    pop af
FarJump2:
    jp 0

; ------------------------------------------------------------------------------------------------
; Maps logical bank A (0: what the window held at start-up) into the window. Changes AF, DE, HL.
FarMap:
    ld hl,FarPages
    ld e,a
    ld d,0
    add hl,de
    ld a,FarSlots
    dec a
    jr z,FarMapOne
    add hl,de               ; a 16K window: two pages a row
    ld a,(hl)
    nextreg FarReg,a
    inc hl
    ld a,(hl)
    nextreg FarReg+1,a
    ret
FarMapOne:
    ld a,(hl)
    nextreg FarReg,a
    ret

; ------------------------------------------------------------------------------------------------
; Start-up: no bank is current, the shadow stack is empty, and the window's page(s) now are
; "bank 0", so returning to resident code restores what the loader mapped.
FarInit:
    xor a
    ld (FarBank),a
    ld hl,FarStack
    ld (FarSP),hl
    ld bc,$243b
    ld a,FarReg
    out (c),a
    inc b
    in a,(c)
    ld (FarPages),a
    ld a,FarSlots
    dec a
    ret z
    dec b
    ld a,FarReg+1
    out (c),a
    inc b
    in a,(c)
    ld (FarPages+1),a
    ret

FarBank:
    .defb 0                 ; the current logical bank (0: resident)
FarSP:
    .defw 0                 ; the shadow stack's top: 3 bytes per cross-bank call
FarSaveAF:
    .defw 0
FarSaveBC:
    .defw 0
FarSaveDE:
    .defw 0
FarSaveHL:
    .defw 0

; @module   program
; @summary  Program start-up state and END: what the prologue saves and END restores.
; @exports  End, EndHook, StopProgram, ProgramSP, SavedIY, SavedIX, SavedHL2
;
; The prologue the compiler emits (runtime-linker.ts, prologueSource) stores the caller's IY, IX,
; HL' and SP here, sets IY to $5C3A, calls the linked modules' initialisers and runs the main
; program. ProgramSP is also the main program's baseline SP for the debugger (plan §10.2.2): SP is
; this value at every statement entry of the main program.

; ------------------------------------------------------------------------------------------------
; END n. In: BC = n. Returns to whoever started the program (BASIC's USR returns BC), with SP, IY,
; IX and HL' as they were at the start. Does not return to its caller.
End:
    push bc
    ld hl,(EndHook)
    call EndCall            ; what a linked module leaves for BASIC (the print position)
    pop bc
    ld sp,(ProgramSP)
    ld iy,(SavedIY)
    ld ix,(SavedIX)
    exx
    ld hl,(SavedHL2)
    exx
    ret

; STOP: ends the program with ERR_NR = A, as ZX BASIC does - the program returns, and BASIC shows
; "9 STOP statement" when its own statement ends (compatibility plan C3). Does not return.
StopProgram:
    ld ($5c3a),a            ; ERR_NR
    ld bc,0
    jr End

EndCall:
    jp (hl)

; A module's routine End calls first: the print module puts PrintSave here.
EndHook:
    .defw EndNoHook
EndNoHook:
    ret

ProgramSP:
    .defw 0
SavedIY:
    .defw 0
SavedIX:
    .defw 0
SavedHL2:
    .defw 0

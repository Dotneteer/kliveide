; @module   program
; @summary  Program start-up state and END: what the prologue saves and END restores.
; @exports  End, ProgramSP, SavedIY, SavedIX, SavedHL2
;
; The prologue the compiler emits (runtime-linker.ts, prologueSource) stores the caller's IY, IX,
; HL' and SP here, sets IY to $5C3A, calls the linked modules' initialisers and runs the main
; program. ProgramSP is also the main program's baseline SP for the debugger (plan §10.2.2): SP is
; this value at every statement entry of the main program.

; ------------------------------------------------------------------------------------------------
; END n. In: BC = n. Returns to whoever started the program (BASIC's USR returns BC), with SP, IY,
; IX and HL' as they were at the start. Does not return to its caller.
End:
    ld sp,(ProgramSP)
    ld iy,(SavedIY)
    ld ix,(SavedIX)
    exx
    ld hl,(SavedHL2)
    exx
    ret

ProgramSP:
    .defw 0
SavedIY:
    .defw 0
SavedIX:
    .defw 0
SavedHL2:
    .defw 0

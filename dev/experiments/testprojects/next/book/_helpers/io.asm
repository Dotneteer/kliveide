;------------------------------------------------------------------------------
; ZX Spectrum Next I/O helper macros
;------------------------------------------------------------------------------

; Reads a ZX Spectrum Next hardware register value into A
; IN:
;   idx=Register index
; CHANGES: A, BC ($253B on return)
GetNextReg .macro(idx)
    ld a,{{idx}}
    ld bc,$243b             ; Next register select port
    out (c),a               ; Select the register
    inc b                   ; BC = $253B (Next register read port)
    in a,(c)                ; Read the register value into A
.endm
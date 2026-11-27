; Parity probe "im1" (Phase 1): staircases (timing.inc.asm) entered through IM 1 instead of IM 2. RAM
; replaces ROM0 in section A (LMPR = RAM0 | 31: page 31 in A, page 0 in B); the handler at 0038h reads
; STATUS at once (a longer path would miss the 128-T line pulse), ignores anything but the line
; interrupt and joins the staircase handler past its own status check. @use timing
ProbeMain:
    call TimingSetup
    ld a,$3F
    out ($FA),a
    ld hl,Im1Handler
    ld de,$0038
    ld bc,Im1HandlerEnd - Im1Handler
    ldir
    im 1
    ld hl,StairTab
    call StairTable
    ld a,$1F            ; ROM0 back in section A
    out ($FA),a
    im 2
    ret

; --- Copied to 0038h (relative jumps only, and an absolute one to StairIsrGo)
Im1Handler:
    push af
    in a,($F9)
    rra                 ; STATUS bit 0 (line) into carry
    jr c,Im1Ignore
    pop af
    jp StairIsrGo
Im1Ignore:
    pop af
    ei
    reti
Im1HandlerEnd:

StairTab:
    .defm "IM1EMP"
    .defw I_empty
    .defb I_empty_end - I_empty
    .defm "IM1PSH"
    .defw I_pushpop
    .defb I_pushpop_end - I_pushpop
    .defb 0

I_empty:
I_empty_end:
I_pushpop:
    push bc
    pop bc
I_pushpop_end:

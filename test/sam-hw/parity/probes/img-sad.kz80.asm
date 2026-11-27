; Parity probe "img-sad" (Phase 5): booted from the probe disk as a SAD image; reads and writes
; through that format, then the ALLOCT dump (alloct.inc.asm) as its result. @image sad @use timing @use alloct
ProbeMain:
    jp AlloctDump

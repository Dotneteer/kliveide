; Parity probe "img-edsk" (Phase 5): booted from the probe disk as an EDSK image; reads and writes
; through that format, then the ALLOCT dump (alloct.inc.asm) as its result. @image edsk @use timing @use alloct
ProbeMain:
    jp AlloctDump

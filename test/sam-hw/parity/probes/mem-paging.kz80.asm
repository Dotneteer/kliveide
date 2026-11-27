; Parity probe "mem-paging" (Phase 4): LMPR and HMPR over every page, the ROM bits, write protection, the
; page wrap and the paging registers read back, on the 512K model (paging.inc.asm). @use timing @use paging
ProbeMain:
    jp PagingTests

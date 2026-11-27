; Parity probe "fdc-drive2wp" (Phase 5): the second drive with its disk write-protected (drive2.inc.asm): the
; write is refused (status bit 6) and the sector keeps its bytes. @disk2wp @use timing @use fdc @use drive2
ProbeMain:
    jp Drive2Tests

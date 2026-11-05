---
type: fix
---

ZX Spectrum Next: three port decodes differed from the hardware. A write to an address such as
`$FFE9`, with address bit 2 clear, reached the AY chips, which answer only with bit 2 set; with the
`$1FFD` port switched off (NextReg `$82` bit 3), a `$1FFD` write did not page memory as `$7FFD` in 48K
and 128K timing; and with the +3 disk I/O trap on, a `$3FFD` write raised the trap but did not page
memory as `$7FFD` in 48K and 128K timing. All three now behave as on the Next.

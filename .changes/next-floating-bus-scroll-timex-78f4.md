---
type: fix
---

ZX Spectrum Next: the floating bus (a read of port `$FF` during the display) showed the bytes of the unscrolled standard screen at `$4000`, whatever the ULA's hardware scroll (NextRegs `$26`/`$27`) or Timex screen mode (port `$FF`); it now shows the bytes the ULA actually reads, as the hardware does.

---
type: fix
---

SAM Coupé: the colour bars on ROM 3.0's copyright screen stepped into the right border, because the
light-pen input (bit 5 of port 254) read high with no pen fitted; it now reads low, and the ROM
times each colour change into the blanking as on a real machine.

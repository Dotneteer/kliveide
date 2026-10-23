---
type: fix
---

ZX Spectrum 48K and 128K: a write to the screen memory reached the picture a few T-states too late against the ULA's reads, so beam-racing code that writes a cell just before the ULA reads it showed the old byte.

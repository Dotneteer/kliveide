---
type: fix
---

ZX Spectrum Next: switching memory contention off or on with NextReg `$08` bit 6 took effect at once.
The Next takes the bit over only from dot 256 of the current line, and reading NextReg `$08` back
returns the old bit until then; Klive now does the same.

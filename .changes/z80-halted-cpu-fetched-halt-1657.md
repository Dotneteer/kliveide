---
type: fix
---

Z80: a halted CPU fetched the HALT instruction's own address over and over instead of the byte after it, so on the ZX Spectrum a HALT at `$7FFF` was contended on every halted cycle. HALT2INT now matches its author's photos of real 48Ks.

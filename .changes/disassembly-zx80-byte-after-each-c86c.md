---
type: fix
---

Disassembly: on the ZX80, the byte after each `RST $08` in the 4K ROM was listed as an instruction,
which threw the following code out of step, and the 4K ROM was decoded with the ZX81 ROM's
calculator rules. The byte now shows as the error code with its report number; a ZX80 with the 8K
ROM keeps the ZX81 decoding.

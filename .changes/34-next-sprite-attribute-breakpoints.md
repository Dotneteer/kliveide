---
type: feature
issues: [1445]
---
**Sprite attribute breakpoints on the ZX Spectrum Next:** `bp-set sp:<sprite>` stops after an
instruction writes an attribute byte of that sprite, whether the CPU, the DMA or the Copper wrote
it, through port `$57` or the NextReg mirrors. The stop reports the byte, its old and new value,
and the writer, and `-attr` limits the breakpoint to some of the five bytes. You can also set one
from the breakpoint dialog or the Sprite Inspector's row menu.

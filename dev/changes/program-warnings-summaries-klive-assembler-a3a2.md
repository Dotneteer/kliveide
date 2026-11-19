---
type: feature
---

**`.dma` program warnings and summaries.** The Klive assembler now reads each `.dma` program the way the ZX Spectrum Next's DMA reads it and warns, without failing the build, about setups that compile but do not do what they say: a `wr0` or `wr4` whose omitted value has no `.dw` after it (Z0388), an enable without `.dma load` after new start addresses (Z0389), auto restart that never gives the bus back (Z0390), a prescaler in continuous mode (Z0391), and settings the Next ignores (Z0392). In the editor, a line above each program summarises where its bytes go, how many, the mode and the prescaler's rate, and hovering a `.dma` line decodes its register group.

---
type: feature
issues: [1444]
---

**Copper and DMA regions in `.NEX` annotations:** mark a range of a popped-out bank as a Copper
list or a zxnDMA program, and the listing shows it as `.copper` / `.dma` pragmas, with each
instruction's meaning in the comment column. Every row reassembles to the bytes it shows, and the
annotation file stays readable by older Klive versions.

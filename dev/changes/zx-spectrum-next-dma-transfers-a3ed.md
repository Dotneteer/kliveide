---
type: feature
---

**ZX Spectrum Next DMA Transfers.** A new **DMA Transfers** document (Debug › DMA Transfers, the DMA panel's **Open the transfers** link, or `show-dma-transfers`) lists every DMA transfer while it is open, from its enable to its end: the instruction that enabled it, its mode, what it read and wrote, the bytes moved, how long it held the bus and how it ended, with warnings for a lost frame interrupt and for an enable without a load. Selecting a transfer tints its bytes in the Memory panel: those it read, those it wrote and, while it runs, the next byte.

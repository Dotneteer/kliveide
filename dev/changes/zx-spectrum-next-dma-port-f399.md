---
type: feature
---

**ZX Spectrum Next DMA Port Log.** A new **DMA Port Log** document (Debug › DMA Port Log, the DMA panel's **Open the port log** link, or `show-dma-log`) records every write to and read from the DMA's ports `$6B` and `$0B` while it is open: the frame, the T-state, the PC of the instruction, and what the DMA did with each byte. Writes are grouped into setups that end with the enable, each byte is shown as the DMA took it (so a byte swallowed as a follow byte shows as one), clicking a PC opens the disassembly, and **Copy as .dma** turns a setup into `.dma` lines. A **Problems** filter shows the bytes the DMA ignored, the write that left it deaf, an enable without a load, and zxnDDMA commands sent to `$0B`.

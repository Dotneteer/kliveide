---
type: feature
---

**ZX Spectrum Next DMA stops and stepping.** Breakpoints can now stop on what the DMA does rather than at an address: `bp-set dma:enable`, `dma:load`, `dma:end` (a block's end), `dma:count:<n>` (after n bytes), `dma:write:<address>[-<address>]` (the DMA writes memory there), `dma:held:<T>` (it holds the bus longer than T T-states) and `dma:problem` (a setup mistake), or the **DMA event** type in the breakpoint dialog. Events inside a transfer stop there, before the CPU's next instruction, and continuing carries on with the next byte. While paused, the DMA panel's **Step byte**, **To end of block** and **Until the CPU has the bus** buttons (`step-dma`, `step-dma-block`, `step-dma-release`) run the DMA one step at a time.

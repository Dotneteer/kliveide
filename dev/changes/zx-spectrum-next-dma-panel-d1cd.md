---
type: feature
---

**ZX Spectrum Next DMA panel.** A new **DMA** panel in the Machine info activity shows the Next's DMA when the machine is paused: whether it is idle, waiting for its prescaler, holding the bus, deaf or locked; its dialect and mode; both ports' start and working addresses side by side; how many bytes the block has moved; the prescaler's exact byte period at the current CPU speed; the status byte and what the next read of the port returns; and, on core 3.03 models, the zxnDDMA settings. Warnings name the usual setup mistakes with their evidence, such as an enable without `$CF`, a register group still waiting for bytes, or auto restart that never gives the bus back. The `dma` command prints the same as text.

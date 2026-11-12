---
type: feature
---

**ZX Spectrum Next core 3.03.03 models:** two new Next models, KS2 and KS3 with core 3.03.03, boot
NextZXOS 2.10a from the System/Next 26.11a distribution, each from its own SD card. Both emulate the
zxnDDMA, the DMA's new commands on port `$6B`: physical addresses across the whole SRAM, rectangles, a
transparent colour, fill and Layer 2 X,Y positions. At 28 MHz a memory read no longer waits a clock,
for the CPU and the DMA alike. The KS3 model has the issue 5 board's 4 MB of SRAM, reached through the
zxnDDMA or NextReg `$04` in config mode.

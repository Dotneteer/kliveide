---
type: feature
---

**ZX Spectrum Next core 3.03.00 models:** two new Next models, KS2 and KS3 with core 3.03.00, boot
NextZXOS 2.10a from the 26.11 distribution, each from its own SD card. Both emulate the zxnDDMA, the
DMA's new commands on port `$6B`: physical addresses across the whole SRAM, rectangles, a transparent
colour, fill and Layer 2 X,Y positions. The KS3 model has the issue 5 board's 4 MB of SRAM, reached
through the zxnDDMA or NextReg `$04` in config mode. Core 3.03.00's 28 MHz speed without wait states is
not emulated yet.

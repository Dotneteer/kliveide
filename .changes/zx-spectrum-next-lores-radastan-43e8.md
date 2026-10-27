---
type: fix
---

On the ZX Spectrum Next, LoRes in Radastan mode with ULA+ on used the whole palette offset as the high nibble of each dot's colour index; it now takes the ULA+ palette's group as the hardware does (`11` and offset bits 1–0), so Radastan pictures under ULA+ show the right colours.

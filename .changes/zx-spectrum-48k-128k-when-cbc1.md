---
type: fix
---

ZX Spectrum 48K and 128K: when the I register pointed into contended memory, the CPU was held during the refresh at the end of every instruction fetch, which the ULA cannot do. Code running that way, such as IM 2 interrupt tables in the lower RAM, ran too slowly while the screen was drawn; IR Contention and ULA 128 Timing Test now draw the pictures real machines do.

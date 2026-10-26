---
type: fix
---

ZX Spectrum Next: with port `$123B` mapping Layer 2 into memory, a 16K part and a bank offset that added up to 8 or more wrapped round to the picture's first banks (part 2 with offset 7 reached bank +1 instead of +9); they now add up as on the hardware.

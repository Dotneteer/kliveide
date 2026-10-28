---
type: fix
---

ZX Spectrum Next: port `$FE` bit 6 kept reading 1 for up to 2,800 T-states after a program cleared the EAR bit, a delay copied from the 48K's analogue EAR pin that the Next does not have; it now drops with the write, as on the real machine.

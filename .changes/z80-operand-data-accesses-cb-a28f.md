---
type: fix
---

Z80: the operand and data accesses of CB-, ED-, DD- and FD-prefixed instructions (`LD (nn),BC`, `LD A,(IX+d)`, `BIT b,(HL)`...) happened one T-state early, so the ZX Spectrum contended them at the wrong T-state and code using them in contended memory ran at the wrong speed; a repeated DD/FD prefix also took 3 T-states instead of 4. ZX Spectrum Timing Tests 48K now passes every test.

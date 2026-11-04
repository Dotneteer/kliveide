---
type: fix
---

A banked ZX Spectrum 128 program exported as a tape with an auto-start loader (`expc -as`) but without `-c` reset the machine into 48 BASIC: the loader left the stack in the $C000 window it pages the banks into. The loader now always moves the stack below the program's code.

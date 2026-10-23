---
type: fix
---

Klive BASIC on the ZX Spectrum +3: a program could crash into the editor when an interrupt arrived while the runtime was switching to the 48K BASIC ROM (for Float arithmetic, SCREEN$ or print42). On models with a disk drive, the interrupt routine paged the wrong ROM in from the half-updated BANKM and BANK678 system variables. The switch now runs with interrupts disabled.

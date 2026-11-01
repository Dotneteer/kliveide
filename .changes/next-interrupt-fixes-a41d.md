---
type: fix
---

ZX Spectrum Next: four interrupt behaviours differed from the hardware. Writing NextReg `$22` with bit 7
set held the maskable interrupt line low, although that bit is read-only; a `RETI` released the
hardware IM2 daisy chain even when the CPU was not in IM 2; after a stackless NMI, a `RETI` returned
through NextRegs `$C2`/`$C3`, which only `RETN` uses; and the DRIVE key raised a DivMMC NMI while the
DivMMC port was switched off. All four now behave as on the Next.

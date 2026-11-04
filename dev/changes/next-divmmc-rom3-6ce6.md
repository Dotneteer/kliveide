---
type: fix
---

ZX Spectrum Next: the DivMMC's "ROM 3 only" entry points, the 48K ROM's tape traps among them, mapped
only when the slot held exactly `$FF` and the +3's ROM 3 was paged in. They now follow the Next's
rule: the current machine type's 48K BASIC (ROM 1 on a 128K type, the only ROM on a 48K type), any
page from `$E0` up, never in config mode, and the 48K alternate ROM when the alternate ROM is on.

---
type: fix
---

ZX Spectrum 48K and 128K: a border colour change could start in the middle of a character's width and landed up to 14 pixels to the right of where a real machine puts it. The border now changes once per 8 pixels, exactly where the hardware does.

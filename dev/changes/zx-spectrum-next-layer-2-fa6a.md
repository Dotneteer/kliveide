---
type: fix
---

ZX Spectrum Next: the Layer 2 picture viewer (`.sl2`, `.nxi`) and the `.scr` viewer refused files
that start with a 128-byte +3DOS header, the form +3 BASIC and NextBASIC save; they now skip the
header and show the picture.

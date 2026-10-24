---
type: fix
---

Memory dumps (the Disk Explorer's sector view and file previews, and other static dumps): when the
bytes did not fill the last row's section of eight, its characters were drawn too far left, out of
line with the rows above.

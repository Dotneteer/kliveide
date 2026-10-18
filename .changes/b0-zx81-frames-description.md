---
type: fix
issues: [1460]
---
ZX81: the description of the `FRAMES` system variable had bit 15 backwards; it is set in normal
running and clear while `PAUSE` counts.

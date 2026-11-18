---
type: fix
---

Emulator: stepping back while debugging could crash the emulator window with an "IndexSizeError"
when the redraw came before the screen size was known; the redraw now waits for the screen.

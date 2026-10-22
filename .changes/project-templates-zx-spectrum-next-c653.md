---
type: fix
---

Project templates: the ZX Spectrum Next's `default` template was a copy of the ZX Spectrum 48K's (`.model Spectrum48`, calls into the 48K ROM), so it did not work on the Next. It is now a Next program: it runs at 28 MHz, prints with the Next's pixel instructions and ends in a loop, as a `.nex` program must.

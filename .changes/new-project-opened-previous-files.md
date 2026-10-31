---
type: fix
---

New Project: creating a project while another one was open could open the previous project's files.
A new Videoton TVC project showed the open ZX Spectrum 48K project's `code/code.kz80.asm` until the
project was reopened or Klive restarted. The New Project dialog and `newp -o` now wait for the new
project to load before opening its build root.

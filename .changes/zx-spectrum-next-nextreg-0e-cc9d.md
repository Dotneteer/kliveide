---
type: fix
---

ZX Spectrum Next: NextReg `$0E` read sub-version `.00`, so the machine claimed core 3.02.00 while it
emulates 3.02.01, and the NEX viewer called a file that asks for core 3.02.01 unsupported.

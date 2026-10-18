---
type: fix
issues: [1445]
---
ZX Spectrum Next: while DivMMC or Multiface memory was paged in, Klive named the ROM underneath
it, so source lines, bank breakpoints and `page()` in conditions pointed at the wrong memory. They
now follow the memory the CPU actually reads.

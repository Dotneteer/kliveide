---
type: fix
issues: [1446]
---
ZX Spectrum 128K, Pentagon, Scorpion and +2A/+3/+3E: after a project with `.bank` segments was
started, the Memory, Disassembly, Watch and System Variables views showed the old bytes of a
paged-in bank until the next paging change or reset. The program itself ran correctly.

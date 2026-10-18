---
type: fix
issues: [1445]
---
Breakpoints: stepping counted a single visit to a hit-count breakpoint twice, once when the step
arrived at it and again when the next step left it. Each visit now counts once, in Reverse
Continue as well.

---
type: known-issue
issues: [1463]
---
Boriel BASIC programs have less debug information than Klive BASIC programs: stepping through
loops and conditions stops wherever `zxbc` put a statement boundary; constants, `FASTCALL`
parameters and the elements of dynamic arrays are not shown in the Variables panel; and inline
`ASM` blocks are stepped in the disassembly only.

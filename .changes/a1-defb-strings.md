---
type: fix
issues: [1437]
key: "Assembler: `DEFB` accepts strings."
---
Assembler: `DEFB` rejected string arguments unless the flexible-pragmas option was on, so
`defb 22,9,5,"TEXT"` failed with Z0601. A string argument now emits one byte per character, with
the same escapes as `DEFM`.

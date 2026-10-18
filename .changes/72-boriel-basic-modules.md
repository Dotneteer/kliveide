---
type: feature
issues: [1463]
---
**Boriel BASIC modules and banked programs:** a program can `USE` modules from its own folder or
the `include-path` option, and on the 128K and the Next the `'@split-modules` header option puts
each module in a RAM bank of its own. Klive runs and debugs such a program at source level, with
the call stack and stepping working across bank switches, and a banked 128K program exports as
`zxbc`'s own tape. A Boriel BASIC build that fails on `CODEBANK`, which is Klive BASIC syntax,
says so at that line.

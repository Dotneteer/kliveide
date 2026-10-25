---
type: feature
---

**One code generator for every language Klive compiles, and a source-level debugger for any language:** Klive BASIC's optimiser, Z80 code generator, runtime and debug-information builder are now a shared back end that Klive's future compilers (Pascal first) build on as they are, and the source-level debugger no longer assumes BASIC — it reads every compiler's debug information in one language-neutral form. As a first result, z88dk C programs get watch expressions in the Variables panel, with C's operators and meanings: `total / 2` divides whole numbers, `a == 3 && b != 0` gives 1 or 0, `&count` is an address. Klive BASIC programs compile to the same code as before; its `'@emit-ir` listing now names instructions in the back end's terms (`routine`, `localcall`, `exit`), and a program that uses `READ` is one byte shorter.

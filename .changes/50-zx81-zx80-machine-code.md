---
type: feature
issues: [1461]
---
**Machine code for the ZX81 and ZX80:** the assembler takes `.model ZX81` and `.model ZX80` (and
`#ifmod`), the `.defzx` pragma writes text in the machines' character sets, and code above `$7FFF`
gets a warning; a source with no `.model` is assembled for the running machine. **Run** and
**Debug** put the code into a `1 REM` line followed by `2 RAND USR <entry>` and type `RUN`, so the
code is debugged at source level as on the other machines, and **Inject** only writes the program.
Code that starts at the program's base is taken as a complete program. **Export** (or
`expc <file> -f p|o`) writes a `.p` or `.o` file, and on a `.p` file `-as` makes it run itself
once loaded. New **ZX81** and **ZX80** project templates print a welcome message, and `klive run`
works on these projects.

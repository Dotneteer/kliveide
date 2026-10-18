---
type: feature
issues: [1446]
---
**The `klive` command line,** for scripts and CI, needs nothing else installed and never opens a
window. `klive test` builds a project and runs its unit tests, with exit codes, pretty, plain or
TAP output, JUnit XML, and LCOV or `.kcov` coverage, giving the same results on every run.
`klive build` compiles a project to a flat binary or Intel HEX. `klive run` runs a project, a
tape, a snapshot, a state file, a NEX file or a ZX80/ZX81 program until a frame count, an exact
T-state count, an address, a HALT, a breakpoint or a timeout, then writes memory dumps, registers,
a PNG screenshot or a state file. On macOS, **Klive IDE › Install Command Line Tool...** puts
`klive` on the PATH; the Windows installer adds it there.

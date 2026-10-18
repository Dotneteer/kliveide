---
type: feature
issues: [1446]
highlight: "**Code coverage, a memory heat map and an exact profiler** on every Z80 machine."
---
**Code coverage and the memory heat map on every Z80 machine:** **Debug › Code Coverage** (or
`coverage on`) records which bytes of every bank ran, were read or were written, and how often, at
full speed as well as while stepping. The editor marks source lines as covered, partly covered or
not covered, and the Disassembly view marks the instructions that ran. The Memory view's **Heat**
selector draws execution, read or write counts as a heat map and outlines self-modified bytes;
`coverage smc` lists self-modifying code. `coverage export` writes LCOV, CSV or `.kcov` files,
`coverage load` merges a `.kcov` file, and **Debug › Reset Coverage** starts over.

---
type: feature
issues: [1434]
---
**The `.copper` pragma** writes Copper instructions in the Klive Z80 Assembler: `.copper wait`,
`move`, `nop`, `halt` and `word`, with highlighting, completion and hover. The Copper List matches
the live Copper memory back to these source lines, even when the list is uploaded at an offset or
patched at run time, and **Go to source** opens the line.

---
type: fix
---

- Assembler: a forward-referenced negative index offset (`ld a,(ix-Fwd)`) was assembled with a
  positive sign, and an index offset outside -128..127 (`(ix+200)`) wrapped silently; it is now an
  error.
- Assembler: `adc` and `sbc` with `hl,a`, `de,a`, `bc,a` or a 16-bit register and a value assembled as
  the ZX Spectrum Next's `add` instructions instead of being refused.
- Assembler: `.if`/`.elif` assembled the last true branch instead of the first, and a label on
  `.endif` was undefined when no branch was taken.
- Assembler: after a `.while` or a `.repeat` that stopped on errors, the following labels were no longer
  global, so `.ent` and other global-scope pragmas failed.
- Assembler: a structure field set inside a `.proc` from a later label was overwritten with the
  structure's default bytes.
- Assembler: a forward `jr` after a negative `.disp` was reported as out of range.
- Assembler: a string used where a number is expected (`.org "a"`, `jr "a"`) stopped the build with an
  internal error instead of reporting it on the line.
- Assembler: an empty string (`.defm ""`, `.defb 1,"",2`) emitted a zero byte.
- Assembler: absolute file names in `#include`, `.includebin` and `.comparebin` were looked up under the
  source file's folder, and `.includebin` refused a file that exactly fills a bank.
- Assembler: `.bank N noexport` banks were still written into the `.nex` file.
- Assembler: `$$` in a macro argument was turned into `$`.
- Assembler: `.tracehex` printed values from $10000 up with four digits only.

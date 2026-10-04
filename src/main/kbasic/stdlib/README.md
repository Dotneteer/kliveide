# Klive BASIC standard library

`#include <name.bas>` finds these files before the user's include path (plan §6.4). They are Klive's
own code, written from the documented API in `.ai/kbasic/stdlib-api.json`; nothing here is taken
from upstream ZX BASIC (see the provenance rule in `AGENTS.md`). `npm run kbasic:runtime` bundles
every `*.bas` file here into `runtime/generated/runtime-bundle.ts`; they are served under the path
`<kbasic-stdlib>/name.bas`.

## How the compiler treats library files

- **Only what is reached is compiled.** A library routine the program never calls is left out.
- **Library code is not the user's.** Warnings from it are dropped, and its statements are left out
  of the IDE's source map and list file (like the runtime's code).
- **Names match in any case.** A file switches `case_insensitive` on for its own declarations
  (`#pragma push(case_insensitive)` ... `pop`); a name declared while it is on is found in any case,
  even from a case-sensitive program (`LEFT`, `left`, `Left$`).
- **The libraries are zxbc's documented ones** (compatibility plan C6; the annex entry
  `library-coverage` lists them and the ones left out). A name upstream's documentation only shows
  as a listing gives E216 saying so; the list of documented names comes from `stdlib-api.json` at
  bundle time. Each library's behaviour is checked against zxbc by the `library` suite of
  `scripts/kbasic-compat.cjs`, which covers edges the documentation does not state.
- `sinclair-compatible` includes `sinclair.bas` (ATTR, POINT, SCREEN$) before the program's first
  line. A program that uses DRAW gets `__drawarc.bas` after its last line: DRAW's arc form calls
  `__kbDrawArc`.

## Writing a library file

- Start with `#pragma once`; declare every variable with a type and every parameter `BYVAL`, so a
  program's `explicit`, `strict` or `default_byref` does not change the library.
- Private names start with `__kb`. `__kbase.bas` holds what files share: `__kbStringBase` is the
  including program's string base, for code that indexes strings the program's way.
- Inline asm is zxbasm's dialect unless the file declares Klive's (`#pragma push(asm_dialect)`,
  `#pragma asm_dialect = klive`, `pop` at the end), as the older files do. In zxbasm's dialect a
  FASTCALL routine whose body is only asm has no frame (`hmirror.bas`, `zx0.bas`, `megalz.bas`): the
  first argument is in A/HL/DE:HL, the others on the stack under the return address. A library's
  asm labels are global: give them the file's `__kb` prefix.
- Inline asm may name runtime labels as `core.Label`; the block links the module that exports it.
  A FUNCTION with no locals keeps its result at `IX-1` (UByte) or `IX-2` (UInteger), which `pos.bas`
  and `csrlin.bas` rely on; `test/kbasic/codegen/stdlib.test.ts` would catch a change of frame.
- Data goes in a global array with explicit bounds (`DIM t(0 TO n) AS UByte => {...}`), so the
  program's `array_base` does not move it. `print64.bas`'s font is Klive's own 3 x 7 design, kept in
  `scripts/kbasic-font64.cjs`, which rewrites the table (`--check` verifies it). `print42.bas` needs no
  font: it squeezes the machine's own (CHARS) from six columns to five.
- **Read the font at CHARS with `__kbRomPeek` (`__kbase.bas`), never `PEEK`.** CHARS points into the
  48K BASIC ROM, and on the 128K, the +3 and the Next another ROM may be paged in (the +3's editor
  runs with ROM 0), so `PEEK` reads something else there. `__kbRomPeek` pages the 48K BASIC ROM in for
  an address below $4000 (the runtime's `RomPeek`); `screen.bas` and `print42.bas` use it.
- Test each routine in `test/kbasic/codegen/stdlib.test.ts` on the 48K harness, and add its
  behaviour to the `library` compatibility suite (`node scripts/kbasic-compat.cjs gen`, then
  `oracle library` where zxbc is installed). Test data for `zx0.bas` and `megalz.bas` comes from
  `scripts/kbasic-packers.cjs`.

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
- **A documented library not written yet** gives E216 "`<x.bas>` is not available in Klive BASIC
  yet"; the list of documented names comes from `stdlib-api.json` at bundle time.
- `sinclair-compatible` includes `sinclair.bas` (ATTR, POINT, SCREEN$) before the program's first
  line. A program that uses DRAW gets `__drawarc.bas` after its last line: DRAW's arc form calls
  `__kbDrawArc`.

## Writing a library file

- Start with `#pragma once`; declare every variable with a type and every parameter `BYVAL`, so a
  program's `explicit`, `strict` or `default_byref` does not change the library.
- Private names start with `__kb`. `__kbase.bas` holds what files share: `__kbStringBase` is the
  including program's string base, for code that indexes strings the program's way.
- Inline asm may name runtime labels as `core.Label`; the block links the module that exports it.
  A FUNCTION with no locals keeps its result at `IX-1` (UByte) or `IX-2` (UInteger), which `pos.bas`
  and `csrlin.bas` rely on; `test/kbasic/codegen/stdlib.test.ts` would catch a change of frame.
- Test each routine in `test/kbasic/codegen/stdlib.test.ts` on the 48K harness.

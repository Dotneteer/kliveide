# The runtime of the shared Z80 back end

The runtime every compiled program links: Klive-written Z80 in Klive's assembler dialect, one file
per module, in **packages** (`.plans/SHARED_Z80_BACKEND_PLAN.md` §3.2). It was written for Klive
BASIC (plan `.plans/ZXBASIC_COMPILER_PLAN.md` §6) and is **written from scratch** — no upstream runtime
file is opened, copied or converted (that plan's §0.1); interfaces come from `.ai/kbasic/runtime-abi.md`,
behaviour from the spec and the ROM documentation.

| Package | Folder | What it holds | May require |
| --- | --- | --- | --- |
| `core` | `core/` | start-up and END (`program`), errors, the heap, heap Strings (`strcore`), integer, Fixed and Float arithmetic, the ROM paging, the far-call runtime (`banking`) | `core` |
| `zx` | `zx/` | the Spectrum's screen, attributes, graphics, sound, tape, keyboard, random numbers | `core`, `zx` |
| a language's | e.g. `src/main/kbasic/runtime/` | what only that language needs (Klive BASIC: its String operations, arrays, DATA, USR) | `core`, `zx`, its own |

## How a module is linked

- A front end passes its own package to the back end (`runtimeLibrary([kbasicPackage])`); the linker
  (`runtime-linker.ts`) takes the modules that the program's runtime calls need, plus everything they
  `@requires`, and assembles them **inside one `.module core`**, after the program. So a module has no
  `.module`, `.moduleend` or `.org` of its own, labels are shared by all modules of every package (a
  private label must not clash with another module's: prefix it with its routine's name, or put it in a
  `.proc`), and the program calls `core.<label>`.
- The linker also defines, in `core`: `HeapStart` and `HeapSize` (the heap area).
- Units are parsed once and cached (`RuntimeUnitCache`), keyed by module, target model and defines.
- `scripts/runtime-index.cjs` embeds every module's text and header in its package's generated file
  (`generated/core-package.ts`, `generated/zx-package.ts`, and the language's own). **Run
  `npm run runtime:bundle` after changing a module**; `npm run build:check` fails while a generated
  file is stale.

## Header

The leading comment block, one tag per line (list tags may repeat):

```
; @module   heap                      the file name without .kz80.asm
; @summary  One line: what it is for.
; @exports  HeapInit, Alloc, Free     labels other code calls or reads (core.<label>)
; @requires errors                    modules whose labels this one uses
; @init     HeapInit                  called once by the program start-up, before the main program
; @symbols  KB_CHECK_MEMORY           compiler-defined symbols tested with #ifdef/#ifndef
; @abi      Free(hl)                  the register contract of an exported routine (one per line)
```

`@abi Name(regs)` says which register each argument of `core.Name` arrives in, in source order:
`a`, `b`, `c`, `d`, `e`, `h`, `l`, `bc`, `de`, `hl`, `dehl` (32 bits), `aedcb` (a Float), or `stack`
(the argument stays on the Z80 stack and the routine removes it; only leading arguments).
`Name!variant(regs)` is the same routine with its arguments evaluated in another order
(`StrStore!addressFirst`). Instruction selection reads the contract from here
(`RuntimeLibrary.argumentsOf`) for every `rtcall` the MIR makes; a routine without one cannot be
called from the MIR.

The generator rejects an unknown tag, a missing export label, an `@init` that is not exported, a
label exported twice (in any package), a module name used twice, an unknown `@requires`, a
requirement the package rule forbids, a requirement cycle, a `#ifdef` symbol not listed in `@symbols`
(or listed and never tested), and an `@abi` for a routine that is not exported or with an unknown
register.

## Conventions

- Every exported routine documents its inputs, outputs and the registers it changes. IX and IY are
  preserved unless the comment says otherwise; the alternate registers are free.
- The stack is balanced at every return, and nothing is left on it across a call into user code
  (plan §6.1, §10.2.2).
- Target variants use `#ifmod` (`SPECTRUM48`, `SPECTRUM128`, `SPECTRUMP3`, `NEXT`); option variants
  use `#ifdef` on the compiler's `KB_*` symbols.
- ROM calls go through a wrapper that sets IY to `$5C3A` and restores the caller's IY (plan §6.3).
- Every module has runtime-level tests on the 48K harness in `test/kbasic/runtime/`.
- A routine that takes operands on the stack says so (`ArrayAddress`: the indices; the `arith32`
  routines: the left operand, removed by the callee), because that is where the compiler's level-0
  stack machine has them. A routine that keeps working values in static memory (`ArrayAddress`,
  `arith32`, `PrintU32`) is not re-entrant and says so: an interrupt handler must not call it while
  the interrupted program is inside it.

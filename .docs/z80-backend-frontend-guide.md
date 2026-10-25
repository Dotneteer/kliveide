# Adding a language to the shared Z80 back end

Klive compiles every language it implements itself through one back end
(`src/main/z80-backend/`, `.plans/SHARED_Z80_BACKEND_PLAN.md`). A language is **a front end that
produces MIR**: it never optimises, selects instructions, writes Z80 text, runs the assembler or
builds debug tables of its own. Klive BASIC (`src/main/kbasic/`) is the first front end; the test-only
"mini" language (`test/z80-backend/minilang/mini.ts`, ~300 lines) is the smallest complete one and the
best place to start reading.

## 1. What a front end does

1. Read the source and its options (its own syntax: header comments, directives, settings).
2. Parse and check it; report its own diagnostics, in its own codes and words.
3. **Lower it to MIR** (`.docs/z80-backend-mir.md`), with `mir/builder.ts`.
4. Call `compileModule(mir, backendOptions, frontEndInfo)` (`link/compile-module.ts`).
5. Turn the back end's problems into its diagnostics (or use `problemMessage`), and hand the result to
   the IDE through the compiler shell (`compiler-shell/Z80LanguageCompiler.ts`).

## 2. What a front end may import

Only these back-end files (the boundary test, `test/architecture/boundaries.test.ts`, fails
otherwise):

| File | For |
| --- | --- |
| `mir/mir.ts` | the MIR's types |
| `mir/builder.ts` | building MIR |
| `mir/representations.ts` | which representation types are integers, reals |
| `mir/print.ts` | the MIR's text (an `emit-ir` artefact, tests) |
| `link/compile-module.ts` | `compileModule`, `FrontEndInfo`, `CompiledModule` |
| `options.ts` | `BackendOptions`, `effectiveLevel`, `DEBUG_PROFILE_LEVEL` |
| `problems.ts` | `BackendProblem`, `problemMessage` |
| `runtime/runtime-types.ts`, `runtime/runtime-linker.ts` | runtime packages; whether a label is a runtime export |
| `numeric/float40.ts` | folding and decoding the ROM's float |
| `compiler-shell/Z80LanguageCompiler.ts`, `compiler-shell/emit-files.ts` | the IDE side |

## 3. Lowering: the rules the back end relies on

- **Every instruction and terminator has a statement id.** A statement starts with a `stmt` marker
  (`builder.stmt(sid)`); its span is what the debugger highlights. Glue (a loop's jump back) uses -1.
- **Variables live in memory**: `load`/`store` through slots (`global` label, `frame` IX offset,
  `deref` pointer); temporaries are single-assignment vregs that, at levels 0-1, never leave their
  statement (S2).
- **Functions**: one `entry` (the program's start), `routine`s (a frame: parameters from IX+4, locals
  below IX, `prologue.end` after the prologue, an epilogue block starting with `epilogue.begin`, `ret`),
  `fragment`s (code called without a frame).
- **State every meaning that differs between languages** (`rounding`, `overflow`, `toInt`, `shift`,
  `truth`; `.docs/z80-backend-mir.md`, as-built note). The verifier rejects a missing one, and one
  the back end does not implement yet rather than using another. To add one: selector support, the
  folder, a MIR-level test (`test/z80-backend/mir/semantics.test.ts`), then list it in `opt/verify.ts`.
- **Runtime calls** are `rtcall core.X` with arguments in source order; the register contract comes
  from the runtime modules' `@abi` lines. A language's own routines go in its own runtime package.
- **Never write Z80 in an `asm` instruction** except the source's own inline assembly. A calling-
  convention or control-flow need the MIR cannot express is a new MIR operation in the back end
  (`param.reload`, `result.capture` and `jumpvia` were added this way for Klive BASIC).

## 4. Types and representations

MIR types are representations (`mir/representations.ts`): the integers, `bool` (0 or 1 in a vreg),
`ptr`, and the representations runtime packages implement — `fix` (16.16), `flt` (the ROM's float),
`str` (Klive BASIC's owned heap string). Map your language's types onto them; what your language
*means* by an operation is stated on the operation. A type that needs a new representation (a 6-byte
real, an inline short string) is a new entry in the table, with its runtime package and selector
support for its register class (`.plans/SHARED_Z80_BACKEND_PLAN.md` §8).

## 5. The runtime

Every program may link the back end's `core` and `zx` packages (`src/main/z80-backend/runtime/`,
README there). A language adds its own package — a folder of `*.kz80.asm` modules registered in
`scripts/runtime-index.cjs` — and passes it as `FrontEndInfo.packages`. A language module may require
`core` and `zx` modules; never the other way round.

## 6. Debug information

The back end builds the classic and source-level tables. The front end supplies, in the debugger's
vocabulary (`.docs/source-debugging-model.md`):

- `MModule.globals` and each routine's `vars`: variable descriptors — name as written, value
  representation (`i16`, `float40`, `str.heap`, …), the type's name in the language (`typeLabel`), and
  storage (a label, an address, a frame offset, a constant);
- `MFunction.returnLabel`: a result's type name;
- `FrontEndInfo.language` (the debugger's plugin key), `errorStop` (the routine its run-time errors go
  through and how they are named), `sourceLabelPrefix` (its labels for source line labels).

A language without a debugger plugin still steps, shows the call stack and the Variables panel; a
plugin (`src/renderer/appIde/debugger/languages/`) adds watch expressions and the language's way of
writing values.

## 7. The tests a language must have

- Programs compiled and **run on a machine core** at every optimisation level, checked by their
  output (Klive BASIC: `test/kbasic/corpus/`; mini: `test/z80-backend/minilang/mini-run.test.ts`).
- The debugger on them: breakpoints, stepping, the call stack and variables.
- Its diagnostics, including each back-end problem it maps.
- The boundary test passes unchanged.

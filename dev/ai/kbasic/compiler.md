# Klive BASIC: the compiler's durable record

> **Klive BASIC is switched off** (2026-11-04): Boriel BASIC builds every BASIC program, and the switch
> is commented out at every `KLIVE-BASIC-OFF:` marker. The compiler, runtime, stdlib, tests and corpus
> stay and keep passing. How to turn it back on: `dev/ai/klive-basic-switch.md`.

This note replaces the compiler's implementation plan, `.plans/ZXBASIC_COMPILER_PLAN.md`, which was
implemented and closed on 2026-11-04. The full plan, with its phase history, is in git history at
that path (`git log -- .plans/ZXBASIC_COMPILER_PLAN.md`). The compatibility plan that followed it,
`.plans/ZXBASIC_COMPATIBILITY_PLAN.md`, was closed earlier (commit `361b2b1fe1`); its decisions are
kept here too.

What is already written elsewhere is not repeated here:

| Topic | Where |
| --- | --- |
| The language (the only language reference) and the semantics annex (R8) | `dev/ai/zxbasic-syntax/` |
| Runtime interfaces, CODEBANK contract, integration map, library API | `dev/ai/kbasic/` (`README.md` and its files) |
| The shared back end a front end lowers to | `dev/patterns/z80-backend-frontend-guide.md`, `dev/patterns/z80-backend-{mir,lir-regalloc,optimiser,debug-builder}.md`, `.plans/SHARED_Z80_BACKEND_PLAN.md` |
| Lowering BASIC to MIR | `dev/patterns/kbasic-lowering.md` |
| String ownership | `dev/patterns/kbasic-string-ownership.md` |
| The language-neutral source-level debugger | `dev/patterns/source-debugging-model.md` |
| Runtime packages | `src/main/z80-backend/runtime/README.md`, `src/main/kbasic/runtime/` |
| The standard library | `src/main/kbasic/stdlib/README.md` |
| The 48K harness | `test/harness/sp48/README.md` |
| The user documentation (off the site while switched off) | `docs/authoring/klive-basic/` |

## Provenance (hard rule)

This is a hard requirement of the project author, not a style preference.

- **No code from upstream `boriel-basic/zxbasic`** (its AGPL compiler, its runtime, its libraries)
  **or from NextBuild's compiler fork** (`zxbasic1.18.7-nb10`) is copied, converted or translated
  into Klive. The upstream compiler is never read for design.
- Upstream may be read **only to discover language and interface facts**, which are recorded in
  Klive's own words (`dev/ai/zxbasic-syntax/`, `dev/ai/kbasic/runtime-abi.md`, `stdlib-api.json`,
  `codebank-contract.md`). Its published documentation (CC BY 4.0) may be paraphrased, with
  attribution.
- **Running an installed upstream `zxbc` as a behavioural oracle is allowed (D12)**: a developer runs
  it on Klive's own test programs and records only the observed results (screen, memory, ERR_NR,
  how the program ends). Never its generated code, tests or libraries, never a traceback (it quotes
  upstream's source), and **never in CI**.

| Source | Licence | How Klive may use it |
| --- | --- | --- |
| Upstream compiler (`src/` except `src/lib/`) | AGPL-3.0-or-later | Never read for design, never copied, never translated. Its behaviour is known only through `dev/ai/zxbasic-syntax/zxbasic-syntax.json` and the oracle. |
| Upstream runtime and stdlib (`src/lib/arch/*/runtime`, `stdlib`) | MIT by a README statement (most files carry no header), a few BSD | Not used (D2). Only interface facts (calling conventions, data layouts, documented signatures) from `dev/ai/kbasic/`. Do not open upstream runtime files while writing runtime code. |
| Upstream docs | CC BY 4.0 | Paraphrased into the spec, the API catalogue and Klive's help, with attribution. |
| The 48K ROM | Amstrad's long-standing permission; Klive ships it | Called at run time by the program, never copied into it. |
| NextBuild fork | AGPL-derived; its new runtime files have no licence header | CODEBANK is written from its documented contract (`codebank-contract.md`). Its `farcall.asm`/`farmem.asm` are not imported. |
| `dev/ai/zxbasic-syntax/` | MIT (Klive's own description) | The only language reference. |

The architecture is Klive's own and deliberately unlike upstream's: a hand-written recursive-descent
parser with Pratt expressions, a typed IR (the shared back end's MIR), tree-tiling instruction
selection and a rule-based optimiser over structured instructions. Upstream test programs are never
copied: the corpus is written for Klive. The same rule covers Boriel BASIC's kit: its runtime and
stdlib are never read to design Klive BASIC (`dev/ai/boriel/README.md`).

## Decisions

Closed. Do not revisit them without the project author.

### Compiler decisions (2026-09-26)

| # | Decision |
| --- | --- |
| D1 | ZX Spectrum Next first, classic Spectrum too: an architecture abstraction from day one; Next (Z80N, NEX, CODEBANK) primary, 48K/128K/+3 secondary. |
| D2 | Klive BASIC has its own runtime and standard library, written from scratch (revised from "reuse Boriel's MIT runtime"; the author chose not to rely on a README licence statement). Compatible at the interface level; the ROM is used only for Float maths, Float to and from text, tape and error reports. |
| D3 | IR, then Z80 instruction objects, then Klive's own assembler. The compiler does not encode machine code; the assembler encodes, places segments and writes NEX. |
| D4 | Inline `ASM ... END ASM` in Klive's native dialect. **Superseded by D-C4**: zxbasm's dialect is the default, Klive's is opted into. |
| D5 | Options through header comments, with new readable names ("Options as built"). |
| D6 | CODEBANK is part of the accepted language. |
| D7 | The unit of source stepping is the statement, not the line. |
| D8 | Header options use the `'@name value` form; NextBuild's `'!` is a compatibility alias. |
| D9 | Klive BASIC takes the `zxbas` language id; the external `zxbc` stays selectable by a setting (`zxbasic.compiler`). While Klive BASIC is switched off the setting is ignored. |
| D10 | zxbasm-dialect inline asm and libraries are accepted through a converter (`src/main/kbasic/asm/zxbasm.ts`) with an alias table to Klive runtime routines. Since D-C4 it is the default dialect. |
| D11 | `klive.debug` compiles with a **debug profile**: optimisation capped at level 1 unless the header sets `'@optimize`; full debug info. The build output shows the effective level. (`KBasicCompiler.ts`, `DEBUG_PROFILE_LEVEL`.) |
| D12 | Upstream `zxbc` may be run as a behavioural oracle (see "Provenance (hard rule)"). |

### Compatibility requirements and decisions (2026-09-27)

Klive BASIC is to be 100% compatible with ZX BASIC (zxbc 1.19), which overrode the compiler plan
where they disagreed.

| # | Requirement |
| --- | --- |
| K1 | **Acceptance**: Klive accepts a program exactly when zxbc does (a rejection is an error, not a warning). |
| K2 | **Behaviour**: an accepted program does the same observable things: screen, border, ERR_NR and how it ends, its result, the documented memory it touches, sound and tape blocks. |
| K3 | **Interfaces**: the same options and pragmas, library names and APIs, zxbasm-dialect inline asm, runtime entry points user asm may call, documented memory layout facts. |

Not required: identical binaries, addresses, timing or diagnostic wording. Klive's own additions
(source-level debugging, the optimiser, CODEBANK, `'@` header options) stay.

| # | Decision |
| --- | --- |
| D-C1 | Where zxbc **crashes** (constant division by zero, and three corpus programs), compile the program as the documentation defines it and record the crash in the annex. |
| D-C2 | Where zxbc's result **depends on leftover state or an upstream fault** (FASTCALL with a BASIC body, FUNCTION ending without RETURN, a BYREF Float), keep Klive's defined result. Named arguments are copied: passed by position, as zxbc does. |
| D-C3 | Klive extensions zxbc rejects (`#elif`, `=` in `#if`, `x ^ -1`, READ without DATA) are rejected. |
| D-C4 | Inline asm is zxbasm's dialect by default; Klive's with `'@asm-dialect klive` (or `#pragma asm_dialect`). The stdlib and tests that use Klive's declare it. |
| D-C5 | Runtime errors follow zxbc: the program returns to its caller with ERR_NR set; the debugger's error stop stays. |
| D-C6 | zxbc's *consistent* rules are copied even where they surprise (exact constant folding, MOD of magnitudes at run time, named arguments by position). Where its run-time arithmetic is simply wrong (Byte division dropping the sign, `Integer -100 SHR 1`, Float MOD, Fixed MOD precision, Float/Fixed division by zero giving 0), Klive keeps the correct result and the annex records an upstream fault (`test/kbasic/compat/faults.json`). Float and Fixed MOD at run time floor, as the ROM's n-mod-m. |

## Guarantees

The debug-info validator and the corpus runner check these on every compiled test program. They
hold for every MIR language (`dev/patterns/source-debugging-model.md` §2).

| # | Guarantee |
| --- | --- |
| G1 | Every statement with an id >= 0 has exactly one entry address, the first byte of its code, reached only by entering the statement. |
| G2 | No branch inside a statement targets its own entry; a loop that restarts a statement targets the entry of the statement it restarts. |
| G3 | A statement that generates no code is recorded with `endAddress = startAddress` and `elided: true`; the debugger never stops there. |
| G4 | Within one activation SP is the same at every statement entry (the baseline). Nothing (temporaries, argument pushes, FOR state, String temporaries) stays on the Z80 stack across a statement boundary. |
| G5 | Every user call (SUB, FUNCTION, GOSUB, ON ... GOSUB dispatch, CODEBANK far call) is one Z80 `call` whose return address is a recorded call site. Glue calls (sid -1, such as the NEX stub's `call __kbasic_start`) are exempt. |
| G6 | A FUNCTION's result is in its ABI registers when its `ret` runs (for a far call, the far-return runtime's final `ret`). |

Statement ids: >= 0 a statement, -1 runtime and compiler glue, -2 code shared by several statements
after optimisation. Colon-separated statements are always separate statements; a statement's column
range (0-based start, exclusive end) excludes the `:` separators, surrounding blanks and trailing
comments. Line numbers, labels, `DATA`, `DIM`/`CONST` without a run-time initialiser, `DECLARE`,
empty statements and comments get no id and are never a stop.

## Architecture as built

The pipeline: `runFrontEnd` (header options, lexer, preprocessor, parser, binder) then `lowerProgram`
(MIR) then the shared back end's `compileModule`, which selects, optimises, emits, links the runtime,
assembles with Klive's assembler (`parseSourceUnit` + `compileProgram`, no text round trip) and builds
the debug tables. `generateProgram` in `src/main/kbasic/codegen.ts` is the whole of it;
`KBasicCompiler.build` wraps it.

- `src/main/kbasic/` is the front end: `options/`, `syntax/`, `semantics/` (types, constant folding,
  symbols, binder, flow warnings, `codes.ts`), `ir/` (`lower.ts`, `types.ts` with BASIC's stated
  meanings, `debug-descriptors.ts`), `asm/zxbasm.ts`, `intel/`, `stdlib/`, `runtime/` (the `kbasic`
  runtime package: strings, arrays, data, usr), `KBasicCompiler.ts`, `breakpoints.ts`.
- `src/main/z80-backend/` is shared (MIR, optimiser, selection, emission, banking, debug builders,
  `core`/`zx` runtime, float40). The architecture test `test/architecture/boundaries.test.ts` keeps
  the boundary.
- The dispatcher `src/main/zxb-integration/ZxBasicDispatcher.ts` holds both compilers;
  `compilerChoiceOf` in `zxb-config.ts` is the one place the main process and the renderer ask.
- Foreground builds run in the main process, background checks in the compiler worker (front end
  only). Results must be structured-clone-safe, and a compiler must return errors, never throw (a
  throw in the worker is misreported as success). Never pass a flag through `compileFile`'s options:
  the Z80 assembler treats that object as its full option set.
- Float folding is ROM-exact (`numeric/float40.ts`, tested against the ROM running in the emulator);
  transcendental functions fold only when exact. Literal-only constant arithmetic is exact; anything
  typed wraps in its type as the program would.

## Options as built

Options are `'@name value` (or `REM @name value`) lines in the build root's leading comment block,
before the first code line. A header in an included file gives K012 and is ignored. An unknown name
is a warning with a suggestion (K010); a bad value is an error.

Precedence: IDE settings < project settings < header options < `#pragma` (from its line on) < the
debug profile (D11, only for the optimisation level and only when the header does not pin it).

The catalogue maps every `zxbc` option (target, optimize, optimize-for, origin, heap-size,
heap-address, array-base, string-base, case-insensitive, sinclair-compatible, require-declarations,
require-types, default-byref, check-memory, check-bounds, break-key, headerless, define,
include-path, disable-/enable-warning, expect-warnings, output, basic-loader, autorun, append-block,
emit-asm, emit-ir, emit-map, debug-info, asm-dialect, codebank-*, nex-*). The user reference is
`docs/authoring/klive-basic/reference/`. Dropped on purpose: `--parse-only`, `-e`, `-d`, `-F`,
`--save-config`, `--hide-warning-codes`, `--strict-bool`, `-o`, `--version`, `--help`.

NextBuild's `'!name=value` lines are aliases (`org`, `heap`, `opt`, `pc`, `sp`, `bmp`, `codebank`,
`codebankpages`, `codewindow`, `codewindowsize`, `codebankdepth`); unsupported ones give K011 each,
naming the Klive alternative. K013 marks a Boriel-only option (`@split-modules`).

`'@emit-asm`, `'@emit-ir`, `'@emit-map` write `<name>.kbasic.asm`, `.kbasic.ir` (a MIR dump),
`.kbasic.map` (`$ADDR name`, banked labels `B<n>:`) and, with CODEBANK, `<name>.banks.json`
(NextBuild's manifest shape) and `<name>.bank<n>.bin` beside the source
(`src/main/compiler-shell/emit-files.ts`).

## Diagnostic codes

`src/main/kbasic/semantics/codes.ts` is the single table. **A new code needs a case in
`test/kbasic/semantics/diagnostics.test.ts`, which fails on a code without one** (code-generation
errors go in its `CODEGEN_ERRORS`, compiled through `compileBasic`).

| Range | Meaning |
| --- | --- |
| E0xx, E1xx, E2xx, E3xx | options, lexer, preprocessor, parser |
| E401-E430 | the spec's semantic error classes |
| E450-E454 | CODEBANK source-level rules; W900-W920 its warnings |
| E455-E458 | CODEBANK code-generation errors: Z0411 in a bank (E455, names the bank's routines), a resident segment overlapping the window (E456), bad page plan (E457), CODEBANK off the Next (E458) |
| E501 | not generated (for example FARPTR of a routine); E503 an assembler error in an `ASM` block; E599 an internal error |
| W-codes | the spec's own; W150 and W170 whenever `optimize > 0` (default 2), as upstream |
| K-codes | Klive's own warnings and notes (K010-K013 options, K401-K408 semantic warnings, among them K406 constant division by zero) |

The binder runs only when the front end reported no error. `'@disable-warning` drops warnings at the
end of `runFrontEnd`. Library code's warnings are dropped.

## Runtime and ROM policy

The runtime is Klive-dialect assembly in packages (`core` and `zx` in the back end, `kbasic` in the
front end); each module's header declares its exports, requirements, initialiser and ABI
(`; @abi Name(regs)`), and the linker wraps every module in one `.module core` (the assembler cannot
reopen a module, Z0903), so private labels share one namespace. `npm run runtime:bundle` regenerates
the bundles; `build:check` fails on a stale one.

| Uses the ROM | Klive's own code |
| --- | --- |
| Float arithmetic, comparisons and maths through `rst $28` (IY = $5C3A; comparisons load B with the operation, BREG) | integer and Fixed arithmetic |
| Float to and from text (`PRINT`, `STR`, `VAL`: VAL is BASIC's own, `VAL("2*3")` = 6) | PRINT of text and integers, attributes, scrolling, BORDER, CLS |
| tape LOAD/SAVE/VERIFY (48K/128K/+3) | keyboard, PAUSE, BEEP, PLOT/DRAW/CIRCLE, heap, strings, arrays, DATA, far calls |
| error reports through RST 8 | |

`RomIn`/`RomOut` (a nesting counter) page the 48K BASIC ROM in on the 128K and +3; on the Next they
save MMU0/MMU1 and NextReg $8E and select ROM 3. NextZXOS's ROM 3 is not the 48K MAIN-4, so on the
Next `RaiseError` stores ERR_NR and jumps to `ReportError` (row 23, ends the program); a Next build
always links `program`, `errors` and `print`. An error report prints only while the ROM runs a BASIC
line (ERR_SP over MAIN-4, $1303); tests start programs through a stub that sets that up.

Float lives in A-E-D-C-B (exponent, then mantissa, sign in E bit 7); Float constants are 5-byte data
`__flt<n>`. Binary Float, 32-bit and Fixed runtime routines take the left operand on the stack
(callee removes it) and the right in registers. Names visible to inline asm: globals and routines
`_name`, labels `_label.x`, epilogues `_name.leave`, array descriptor `_a` and data `_a.data`, runtime
`core.X` (an asm block's `core.X` links X's module).

## CODEBANK as built

The design is Klive's own, from `codebank-contract.md` §4.

- A banked routine's body is `_name.__far` in its bank; its resident public label is a trampoline
  (`call core.FarCall / .defb bank / .defw _name.__far`), so call sites stay ordinary `call`s.
  Bank-local globals and arrays carry `bank`; a bank-local DIM with a run-time value becomes a
  one-statement routine `__kbinit<n>` in the bank. FARPTR is a 4-byte constant `__far<n>` loaded as a
  ULong (bank in bits 16-23).
- The emitter writes resident code and data, `__kbResidentEnd` (an `.equ $`: `.page` refuses a
  label), one `.page <page>, <window>[, 2]` section per bank, then `.org __kbResidentEnd`. Pages:
  `codebank-first-page + (bank-1) * slots`, or the `codebank-pages` list.
- `FarCall` writes its shadow record {previous bank, real return} **before** it replaces the return
  slot with `FarReturn`; `FarReturn` restores the bank and all registers. `FarAccess`/`FarRelease`
  (farmem) map a bank for one access and put back whatever the window held, so they never change
  `FarBank`. `FarInit` reads the window's boot page(s) into row 0.
- The debugger's stack contract: while a banked routine runs, the Z80 stack looks as after a direct
  `call`; the far-call state is only in the resident shadow stack. The locator pairs far-return slots
  with shadow records from the oldest end, so a record without its slot is always the newest.
- Bank-local rows in the Variables panel are read from the bank's pages and are read-only.

## Source-level debugging as built

The engine and model are language-neutral (`dev/patterns/source-debugging-model.md`); these are Klive
BASIC's facts.

- Source-level info reaches the emulator as plain JSON (`emuApi.setSourceDebugInfo`), sent before a
  debug run and again after injection. R6's compact encoding and version guard were not needed.
- The frame locator needs G4 and an IX frame for every routine (FASTCALL builds one too); the
  optimiser keeps both.
- When a call is the last thing in its statement, its return address is the next statement's entry:
  a step stops at the calling statement as a return point, then at once on the next statement.
- Interrupts: a step ignores stops while the interrupt depth is above its starting depth, unless
  `em-src on -i`. Every Z80 core exposes the interrupt depth.
- Just My Code is a `SourceDebugIndex` flag: the tables always hold the library's statements
  (`libraryFiles`), and with the flag on the index hides them. A library file opens as a read-only
  virtual document `<kbasic-stdlib>/x.bas`.
- Settings (`emuOptions.*`): `sourceStepStopsInInterrupts` (off), `stopOnRuntimeErrors` (on),
  `justMyCode` (on), read at every run.
- Runtime errors stop at `core.RaiseError` (A = ERR_NR) and at the ROM's RST 8 while a program
  statement is on the stack.
- Statement breakpoints carry a column; the identity key is `[resource]:line[:column]`. They re-anchor
  on edits inside the line by scanning for statement starts (`statementStartsOf`) without a compile.
- The NEX sidecar `<name>.nex.kbasic-debug.json` (`src/common/utils/source-debug-sidecar.ts`) carries
  the source-level info and the classic tables, keyed by the NEX's length and FNV-1a checksum.
  `nex-run -d` makes it the current build, so editor breakpoints fire in a launched NEX and the
  panels show its program.

## Testing and tools

- **The corpus** (`test/kbasic/corpus/<area>/<name>.zxbas`, 192 programs): `'@expect` header lines
  (vocabulary in `corpus-run.ts`'s header comment); the runner runs every program at every level
  (0-3), checks the validator's problems and G4 at every statement entry. `'@target next` programs
  run on the Next harness (`corpus-next.test.ts`), which also checks, for CODEBANK, that the bank is
  back at 0 and the shadow stack empty. `corpus-debugger.test.ts` checks the Call Stack, Variables
  and watches against each other.
- **The oracle** (D12): `node scripts/kbasic-oracle.cjs [area/name ...]` writes
  `test/kbasic/oracle/<area>/<name>.json` (178 results from zxbc 1.19.0); the corpus runner fails on
  an expectation upstream does not share unless the program says
  `'@expect oracle-differs <annex entry>`, and a mark on a program upstream agrees with fails too.
- **The compatibility suites**: `node scripts/kbasic-compat.cjs gen` / `oracle [suite]` with results
  in `test/kbasic/compat/` (`faults.json` lists upstream faults Klive does not copy, D-C6).
  `compat.test.ts` runs Klive over them in CI.
- **Execution tests** run on the real WASM cores: `test/harness/sp48/` (48K, real ROM, booted to
  BASIC) and `test/harness/zxnext/` (`prepareBasic()` for ROM-using code, `loadOutput` for banked
  segments). Stop the 48K harness at the program's return (`runTo(done)`): a deep stack can overwrite
  the $FF00 stub after it. Press two keys a frame apart.
- **The IDE check**: `node scripts/kbasic-ide-check.cjs` (build `out/` first; `KBASIC_IDE_ONLY=next|classic`).
  Each part runs in a fresh Klive with its own home; the Next part needs a copy of `~/Klive/ks2.cim`.
  While Klive BASIC is switched off, read `dev/ai/klive-basic-switch.md` before relying on it.
- The zxbc oracle install (the author's machine only) is described in `dev/ai/kbasic/README.md`.

## Readiness (R1-R18)

The plan's readiness items, as they stand at close.

| # | Item | State |
| --- | --- | --- |
| R1 | Persist the interface research | Done: `dev/ai/kbasic/`. Keep it current. |
| R2 | Spike converting upstream runtime | Superseded by D2. |
| R3 | Walking skeleton | Done and retired; its checks live in `test/kbasic/codegen/debugger.test.ts` and `scripts/kbasic-ide-check.cjs`. |
| R4 | ROM mapping facts, Next BASIC-ready mode | Done (`prepareBasic()`, harness README "Direct load"). |
| R5 | 48K execution harness | Done (`test/harness/sp48/`). |
| R6 | Debug-info transport | Done as plain JSON; compact encoding not needed at the sizes seen. |
| R7 | Runtime and stdlib packaging | Done; `npm run runtime:bundle`, staleness checked by `build:check`. |
| R8 | Semantics annex | Done: 82 entries, all `decided`, in `dev/ai/zxbasic-syntax/zxbasic-syntax.json`; checked by `test/ai-notes/zxbasic-syntax.test.ts`. |
| R9 | Behavioural oracle | Done (D12): `scripts/kbasic-oracle.cjs`, results committed. |
| R10 | Test corpus | Done (192 programs). |
| R11 | Stage design notes | Done and approved: `dev/patterns/z80-backend-mir.md` (R11-1), `z80-backend-lir-regalloc.md` (R11-2), `kbasic-string-ownership.md` (R11-3), `z80-backend-debug-builder.md` (R11-4), `z80-backend-optimiser.md`. |
| R12 | UI within Klive's theming rules | Done (Variables, Call Stack, toggles on the data-panel primitives). |
| R13 | Settings and templates | Done; the templates now target Boriel BASIC while Klive BASIC is off. |
| R14 | Ask upstream to confirm the runtime licence | Dropped (D2). |
| R15 | Point `AGENTS.md` and `dev/ai/README.md` at the rule | Done; they now point here. |
| R16 | Scheduled upstream check (`node scripts/zxbasic-syntax-check.cjs`) | Open: run by hand; on a new release refresh the spec, then review `runtime-abi.md` and `stdlib-api.json`. |
| R17 | Release milestones | Overtaken: everything shipped, then switched off. |
| R18 | User documentation | Done; now in `docs/authoring/klive-basic/`, off the site. |

## Open

Not built when the plan closed; none blocks anything while Klive BASIC is switched off.

- **Data breakpoints on variables** ("break when this variable changes" on a Variables row, a
  memory-write breakpoint over the variable's bytes, partition-qualified for bank-local data).
- **Conditions in BASIC terms.** Conditional breakpoints and hit counts exist for every language in
  Klive's machine-level expression language (registers, memory, labels); a condition written as a
  BASIC watch expression (`lives = 0`) is not built.
- **Mixed disassembly and the program map**: BASIC lines interleaved in the Disassembly panel, and a
  map of code, data, heap, stack and CODEBANK pages.
- The "optimised: statements merged" status while paused in merged code at levels 2-3.
- The CSpect-compatible label map of `'@emit-map` (Klive's own format is written).
- An interrupt-handler warning for banked routines; NEX asset packing (`'@nex-include`), future work.
- Optimiser work measured and not built for lack of gain: cross-block rules, further Z80N rules,
  Strings in the tree selector, tail calls, loop strength reduction, FASTCALL conversion, CSE, LICM
  (the census is in `dev/patterns/z80-backend-optimiser.md` §15-§16).
- R16 (above).
- Known limits: a module-level ASM block under `#pragma codebank = n` without a CODEBANK block stays
  resident; FARPTR with constant subscripts is not lowered; interrupt handlers must not far-call
  (documented, not checked); inside an epilogue, between `pop bc` and `push bc`, the frame locator
  cannot find the activation (every machine); the Next corpus runner does not check `'@expect heap`.

## Section map of the closed plan

Code comments and notes still say "plan §N" for the compiler plan's sections. Where that content
lives now:

| Plan section | Now |
| --- | --- |
| §0.1 | "Provenance (hard rule)" |
| §0.2-§0.3 (D1-D12) | "Decisions" |
| §2-§3 (survey, architecture, layout) | "Architecture as built"; `dev/ai/kbasic/klive-integration-map.md` |
| §4 (assembler: `compileProgram`, `.page`, `#line`) | the assembler itself; `docs/content/z80-assembly/{pragmas,directives}.mdx` |
| §5 (options) | "Options as built" |
| §6 (runtime, stdlib, ABI §6.7) | "Runtime and ROM policy"; `dev/ai/kbasic/runtime-abi.md`; the runtime and stdlib READMEs |
| §7 (optimisation) | `dev/patterns/z80-backend-optimiser.md` |
| §8 (debug information, §8.4 names and extensions, §8.5 sidecar, §8.6 debug profile) | "Guarantees", "Source-level debugging as built", D11; `dev/patterns/z80-backend-debug-builder.md`; `src/common/abstractions/SourceDebugInfo.ts` |
| §9 (CODEBANK) | "CODEBANK as built"; `dev/ai/kbasic/codebank-contract.md` |
| §10 (debugger: §10.2 stepping and G4-G6, §10.3 statements on a line, §10.4 partitions, §10.6-§10.8 panels, §10.10 error stops, §10.12 Just My Code) | "Guarantees", "Source-level debugging as built"; `dev/patterns/source-debugging-model.md`; `src/emu/machines/SourceStepDecision.ts` |
| §11 (editor) | done; language intelligence by the closed BASIC editor intelligence plan (`src/main/kbasic/intel/`) |
| §12 (integration, D9) | "Architecture as built" |
| §13 (testing, §13.2 harnesses, §13.5 validator) | "Testing and tools" |
| §14 (phases), §15 (name), §16 (risks) | git history only |
| §17 (readiness, R1-R18) | "Readiness (R1-R18)" |

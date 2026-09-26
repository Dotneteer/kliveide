# Klive BASIC — Implementation Plan

**Klive BASIC** is Klive's own ZX BASIC compiler, written in TypeScript and built into the IDE. It
compiles ZX BASIC compatible with Boriel ZX BASIC (plus NextBuild's `CODEBANK` extension) to Z80
and Z80N machine code, optimises the result, and emits debug information rich enough for
**source-level debugging** in Klive's debugger, which this plan also extends.

**Name:** Klive BASIC (chosen 2026-09-26, §15). Code prefix and folder: `kbasic`; the language it
compiles is still called "ZX BASIC", and documentation says "compatible with Boriel ZX BASIC".

**Status:** **Phase 0 done** (2026-09-26): assembler entry point, `.page` and `#line`; the runtime
foundations with their 48K runtime tests; `float40`, bit-exact against the ROM; the Next harness's
BASIC-ready mode. **Phase 1 (front end, §14) is next.** Decisions D1–D12 settled (§0.2–§0.3). See
**Handoff**, immediately below, before doing anything else.

---

## Handoff

Written 2026-09-26 for a new AI session with no prior context on this work. This plan is
self-contained; read it in full, then continue in this order:

1. **This file, start to finish.** It supersedes any summary of it you might be given.
2. `.ai/zxbasic-syntax/README.md`, then skim `zxbasic-syntax.json` — the ZX BASIC language
   reference (the only one to use; see the rule below).
3. `.ai/kbasic/README.md` and its four linked files — `runtime-abi.md`, `codebank-contract.md`,
   `klive-integration-map.md`, `stdlib-api.json` — the runtime interfaces, the CODEBANK contract,
   and where this compiler plugs into Klive's existing code.
4. `AGENTS.md`'s "Klive BASIC" section — the standing rule every session must follow, repeated
   next because it is the one thing that must never slip:

> **Never open, copy, convert or translate code from upstream `boriel-basic/zxbasic` (compiler or
> runtime) or from NextBuild's compiler fork `zxbasic1.18.7-nb10`.** Facts about the language or
> the runtime interface come only from the files above. Upstream itself may be consulted only as
> its published documentation (CC BY 4.0) or by *running* an installed `zxbc` as a behavioural
> oracle (D12) — never by reading its source. This is a hard requirement from the project author,
> not a style preference; §0.1 has the full table of what may and may not be used, and why.

**What already exists — verify it, do not redo it:**

| Thing | Where | Verify with |
| --- | --- | --- |
| The language spec and its upstream-change checker | `.ai/zxbasic-syntax/` | `node scripts/zxbasic-syntax-check.cjs` → should print "current" |
| The interface research (§17.1, R1) | `.ai/kbasic/` | read it |
| Two execution harnesses on the real WASM cores | `test/harness/sp48/` (new, has a README), `test/harness/zxnext/` | the commands below |
| A throw-away spike proving the debug-info approach end to end (§17.1, R3) | `test/kbasic/skeleton/walking-skeleton.ts`, `test/kbasic/walking-skeleton.test.ts` | the commands below; read it before Phase 3, then retire it — it is the shape Phase 3's real compiler follows, not a component to keep |
| Phase 0: assembler extensions (§4.1 `parseSourceUnit`/`compileProgram`, §4.2 `.page`, §4.4 `#line`) | `src/main/compiler-common/common-assembler.ts`; tests `test/z80-assembler/{compile-program,page-pragma,line-directive}.test.ts`; docs `docs/content/z80-assembly/{pragmas,directives}.mdx` | the assembler tests |
| Phase 0: runtime foundations (§6, R7) | `src/main/kbasic/runtime/` (read its `README.md`: module header, linking into one `.module core`, conventions), `scripts/kbasic-runtime-index.cjs`, `runtime-linker.ts`; runtime tests `test/kbasic/runtime/` | `npm run build:check` (fails on a stale bundle), the runtime tests |
| Phase 0: `float40` (§7.4) | `src/main/kbasic/semantics/float40.ts`; `test/kbasic/float40/` (the ROM itself is the oracle) | the float40 tests |
| Phase 0: Next harness BASIC-ready mode | `prepareBasic()` in `test/harness/zxnext/script/session.ts`, README "Direct load" | its self-test |
| Upstream `zxbc` 1.19.0, installed for the D12 oracle (§17.2, R9) | `~/zxbasic` (**outside this repository**, on the project author's machine only), its own Python 3.14 virtual environment at `~/zxbasic/.venv` | `~/zxbasic/.venv/bin/zxbc --version` → `zxbc 1.19.0`. Installed on the author's machine; a cloud session's fresh container does not have it (nothing before Phase 2 needs it). Only the oracle script (`scripts/kbasic-oracle.cjs`) remains to be written. |

Run before starting work, to confirm the environment matches this description:

```bash
npm run build:check                                                          # no new type errors
npx vitest run --config build/vitest.config.ts --project node \
  test/kbasic test/harness/sp48 test/ai-notes                                # 104 tests pass
node scripts/zxbasic-syntax-check.cjs                                        # "current" (or lists what changed upstream)
~/zxbasic/.venv/bin/zxbc --version                                           # zxbc 1.19.0
```

If any of these disagree with what is described above, trust the machine and update this plan
(and `.ai/kbasic/README.md` for the oracle install) to match before proceeding — do not silently
work around a stale assumption.

In a fresh cloud container (seen 2026-09-26): run `npm ci` first; build the Next core with
`npm run build:zxnext-wasm` before running `test/harness/zxnext` or `test/zxnext-hw` (its artifact is
not committed; the 48K core builds itself); `zxbasic-syntax-check.cjs` cannot reach the GitHub API
there (the container's `GITHUB_TOKEN` is refused, and unauthenticated calls hit the shared IP's rate
limit) — run it on a developer machine; and `zxbc` is not installed.

**Where to start:** Phase 1 in §14 (header options, lexer, preprocessor, parser, background
diagnostics), under `src/main/kbasic/options/` and `src/main/kbasic/syntax/` (§3.3). Phase 0's
pieces it will meet later: the compiler hands its program to the assembler as parsed units
(`parseSourceUnit`/`compileProgram`, §4.1) followed by `runtimeUnits(...)` from `runtime-linker.ts`;
constants fold through `float40`. Read `src/main/kbasic/runtime/README.md` before adding a runtime
module.

**Phase 0 facts a later phase must know:**

- A runtime module has no `.module` of its own: the linker wraps all of them in one `.module core`
  (the assembler cannot reopen a module, Z0903), so private labels share one namespace.
- The ROM's comparisons read their operation from BREG (B at calculator entry), as BASIC's evaluator
  sets it through `fp-calc-2`: a runtime stub that compares Floats must load B with the literal.
- An error report is only printed when the ROM runs a BASIC line (ERR_SP over MAIN-4, `$1303`);
  the 48K harness boots to the editor, so tests start programs through a stub that sets that up
  (`startAsRunningLine` in `test/kbasic/runtime/runtime-kit.ts`).
- The NEX writer now places a banked segment by its `bankOffset` (§4.2); for `.bank` followed by
  `.org` this matches `pragmas.mdx` and changed what the old `startAddress % 16384` rule produced.

**Decisions D1–D12 (§0.2–§0.3) are closed.** Do not revisit them without the project author. If a
question comes up that these decisions do not answer, check §17.2/§17.3 first (R8's semantics
annex exists for exactly this); if it is genuinely new, ask rather than assume.

---

## 0. Ground rules

### 0.1 Licence and provenance — read before writing any code

| Source | Licence | How this project may use it |
| --- | --- | --- |
| Upstream compiler (`boriel-basic/zxbasic`, `src/` except `src/lib/`) | AGPL-3.0-or-later | **Never read for design, never copied, never translated.** Its behaviour is known only through `.ai/zxbasic-syntax/zxbasic-syntax.json`. |
| Upstream runtime and stdlib (`src/lib/arch/*/runtime`, `stdlib`) | MIT by a README statement (most files carry no header), a few BSD | **Not used** (D2, revised). Klive BASIC's runtime and standard library are written from scratch; only interface facts — calling conventions, data layouts, documented library signatures — are taken, from `.ai/kbasic/runtime-abi.md` and `.ai/kbasic/stdlib-api.json`. Do not open upstream runtime files while writing runtime code. |
| Upstream docs (`docs/`) | CC BY 4.0 | Paraphrased into the spec, the stdlib API catalogue and Klive help, with attribution. |
| The 48K ROM (Amstrad) | Distributed with emulators under Amstrad's long-standing permission; Klive already ships it | **Called at run time** by the generated program, never copied into it: floating-point calculator, Float ↔ text, tape, error reports (§6.3). |
| NextBuild fork (`zxbasic1.18.7-nb10`) | AGPL-derived; its new runtime files have no licence header | CODEBANK is reimplemented from its **documented contract** (§9). Its `farcall.asm`/`farmem.asm` are **not** imported. |
| The language spec in `.ai/zxbasic-syntax/` | MIT (Klive's own description) | **The only language reference** for this work. |

The architecture below is Klive's own. It does not follow upstream's pipeline (upstream uses a
generated LALR/Lark parser, a quad-based intermediate code and a text peephole optimiser over
assembly); this plan uses a hand-written recursive-descent parser, a typed SSA-based IR, tree-tiling
instruction selection and a rule-based optimiser over structured instructions. The project author
asked explicitly that nothing be translated from the Python sources; that is a hard rule, not a
preference.

### 0.2 Decisions already made (2026-09-26, with the project author)

| # | Decision |
| --- | --- |
| D1 | **ZX Spectrum Next first, classic Spectrum too.** An architecture abstraction from day one; Next (Z80N, NEX, CODEBANK) is the primary target, 48K/128K/+3 (plain Z80) the secondary. |
| D2 | **Klive BASIC has its own runtime and standard library, written from scratch** (revised 2026-09-26; it replaces "reuse Boriel's MIT runtime through an adapter"). Most upstream runtime files carry no licence header and rely on a README statement; the project author chose not to depend on that, nor on asking for a confirmation that might never come. The runtime is compatible at the interface level — calling conventions, data layouts, documented library APIs — and uses the ROM only for Float maths, Float ↔ text, tape and error reports (§6). |
| D3 | **IR → Z80 instruction objects → Klive's own assembler.** The compiler does not encode machine code; Klive's assembler encodes, places segments and writes NEX. |
| D4 | **Inline `ASM … END ASM` uses Klive's native assembler dialect.** |
| D5 | **Options through header comments** in ZX BASIC comment syntax, with new, readable names (§5). |
| D6 | **CODEBANK** is part of the language the compiler accepts (§9). |
| D7 | **The unit of source stepping is the statement, not the line.** A line such as `a = 1 : b = 2 : PRINT a + b` is stepped one statement at a time, with the active statement highlighted within the line (§10.3). |

### 0.3 Decisions accepted from the plan's proposals (2026-09-26)

| # | Decision | Why |
| --- | --- | --- |
| D8 (was P1) | Header options use the `'@name value` form (§5.1). | `'!` belongs to NextBuild and is kept as a compatibility alias; `'#` looks like a preprocessor line. |
| D9 (was P2) | Klive BASIC takes over the `zxbas` language id; the external `zxbc` integration stays selectable through a setting (§12.1). | One file type, one editor, no user migration. |
| D10 (was P3) | Stdlib `.bas` files and user inline asm written in zxbasm dialect are accepted through the same converter that imports the runtime, behind `'@asm-dialect zxbasm` (§6.5). | Keeps D4 while still compiling existing libraries such as NextBuild's `nextlib`. |
| D11 (was P4) | `klive.debug` compiles with a **debug profile** that caps optimisation at level 1 unless the source asks otherwise (§8.6). | Source stepping stays trustworthy by default. |
| D12 | **Upstream `zxbc` may be run as a behavioural oracle** (2026-09-26, resolves R9). A developer may run a locally installed `zxbc` on Klive's own test programs and record the **observable results** (screen text, memory values, error reports). Running the tool is allowed; reading its source for design, or copying its output code, tests or libraries into Klive, is not. The oracle never runs in CI. |

---

## 1. Goals and non-goals

### Goals

1. Accept the ZX BASIC language described in `.ai/zxbasic-syntax/zxbasic-syntax.json` (upstream
   1.19.0), plus CODEBANK.
2. Generate Z80 code for 48K/128K/+3 and Z80N code for the Next; produce injectable segments, TAP
   and NEX through Klive's existing export paths.
3. Four optimisation levels with a size/speed strategy (§7).
4. Emit source-level debug information: statements with column ranges, callables, call sites,
   scopes, typed variables, banking (§8).
5. Extend Klive's debugger: source stepping, partition-aware source mapping, symbolic call stack,
   typed variable views, BASIC watch expressions, runtime-error stops (§10).
6. Options in the source header (§5), in project settings, and in IDE settings, with defined
   precedence.
7. Background diagnostics and language intelligence (hover, go-to-definition, outline, completion)
   for ZX BASIC in the editor (§11).

### Non-goals (for this plan)

- Byte-identical output with upstream `zxbc`. Compatibility means **the same programs compile and
  behave the same**, not the same machine code.
- The ZX81 (`zx81sd`) architecture.
- Upstream's `--save-config`/`--config-file` INI files, `-e` error files, verbosity flags: IDE
  features replace them.
- NextBuild's asset packing by scanning `LoadSDBank(` calls, HDF sync and NextBASIC loaders. A
  NEX-asset option is sketched in §9.7 as future work.

---

## 2. What exists in Klive today (facts this plan builds on)

Survey done 2026-09-26; file references are to HEAD `1c1365677`.

### 2.1 Compiler plumbing

- `IKliveCompiler` (`src/common/abstractions/CompilerInfo.ts:864-900`): `compileFile(filename,
  options)`, `lineCanHaveBreakpoint(line)`, optional `setAppState(state)`. Registered in
  `src/main/compiler-integration/compiler-registry.ts`, **keyed by language id**.
- Output types: `DebuggableOutput` (`segments`, `sourceFileList`, `sourceMap`, `listFileItems`,
  optional `sourceLevelDebug`) and the full `CompilerOutput` (adds `symbols`, `modelType`,
  `nexConfig`, …).
- **An unused source-level debug model already exists**: `SourceLevelDebugInfo`,
  `StatementDebugInfo`, `CallableDebugInfo` (`CompilerInfo.ts:620-805`), with a type guard
  `hasSourceLevelDebug()` that nothing calls. It came with a 1029-line plan that was later deleted
  (`git show 1d9f2856d:plan.md`, "Source-Code-Level Debugging — Implementation Plan"). This plan
  adopts that model and its stepping design (§8, §10) rather than inventing a parallel one.
- Foreground builds run **in the Electron main process**; background (diagnostics) builds run in a
  `worker_threads` worker (`compilerWorker.ts`) that receives an `AppState` snapshot. Results
  cross IPC/MessagePort, so they must be structured-clone-safe. A compiler that throws in the
  worker is misreported as success (`runWorker.ts`), so compilers must return errors, not throw.

### 2.2 Klive's assembler (`src/main/compiler-common`, `src/main/z80-compiler`)

- Full Z80 and Z80N instruction set (Z80N enabled only under `.model Next`, error `Z0414`
  otherwise).
- Modules (`.module`/`.moduleend`, dotted resolution, `::` for root-qualified symbols), `.proc`
  local scopes, macros, structs, `#if`-family directives, `.bank N[,offset]` (16K bank at `$C000`),
  `.savenex` pragmas, NEX V1.2 writer (`nex-file-writer.ts`).
- Only a **text** entry point: `compile(sourceText, options)` / `compileFile(filename)`.
- Source map: `sourceMap[address] = {fileIndex, line, startColumn, endColumn}` for every
  code-emitting line, and `listFileItems` (`fileIndex, lineNumber, address, segmentIndex,
  codeLength`).
- `#line` parses but is a no-op (`common-assembler.ts:455-457`). No numeric temporary labels
  (`1:`/`1f`/`1b`). No way to assemble code at one address into an **8K page** placed elsewhere.

### 2.3 The external ZX BASIC integration

`zxb-integration/ZxBasicCompiler.ts` runs upstream `zxbc` as a subprocess and returns only an
`InjectableOutput` — no source map, `lineCanHaveBreakpoint` always false, model always 48K. Settings
keys live in `zxb-config.ts` (`zxbasic.*`). The `zxbas` language provider has
`supportsBreakpoints: false`. Templates exist for sp48 and sp128 only.

### 2.4 Debugger

- Breakpoints: `BreakpointInfo` supports address, partition, bank-relative, source
  (`resource`+`line` → `resolvedAddress`/`resolvedPartition`), label-anchored, NextReg-write,
  memory and I/O. Source breakpoints resolve through `listFileItems` (first item for the line).
- Next partitions are **8K pages** (`getPartition(address)`); partition-qualified breakpoints fire
  correctly on the Next.
- Stepping is Z80-instruction level only (`DebugStepMode`: StepInto/Over/Out). The Next debug loop
  steps every instruction **from TypeScript** and calls the shared decision function
  `shouldStopAtDebugPoint` (`src/emu/machines/DebugStepDecision.ts`) — the hook source stepping
  needs.
- Execution-point highlighting (`MonacoEditor.tsx:1150-1231`) matches `address === pc` only: **not
  partition-aware**.
- Call stack = 16 raw words from SP. Watch panel = assembler symbols only, flat 64K, no types, no
  scopes.

### 2.5 Upstream's runtime (interface facts; full detail in `.ai/kbasic/runtime-abi.md`)

- Upstream's `zxnext` runtime is its `zx48k` runtime reused; it **calls the 48K ROM** for Float
  maths, PRINT, BEEP, PAUSE, INKEY and tape, and uses the system variables at `$5C00` — so it only
  works with the 48K BASIC ROM paged in and IY = `$5C3A`.
- 4 of its files say MIT, 5 say BSD, about 167 have no header and rely on the README's statement.
  This is why D2 was revised: Klive BASIC writes its own runtime.
- What Klive BASIC keeps from it are **interfaces**: the user-visible calling conventions, data
  layouts (5-byte Float, length-prefixed strings, array descriptors) and the documented library
  signatures, because programs, inline asm and libraries observe them.

### 2.6 Test harnesses (facts verified 2026-09-26)

- `test/harness/zxnext/` — `loadCode` maps pages `[$FF,$FF,10,11,4,5,0,1]` but leaves slots 0–1 on
  **whatever ROM hard reset selected, not the 48K BASIC ROM**, with no system variables and
  interrupts off (`core/load-nex-direct.ts`). A real `.nexload` hands over with NextZXOS's 48K BASIC
  ROM paged in.
- `test/harness/sp48/` — **new** (R5): a real 48K with the real ROM, booted to `$12AC`, with
  load/call/run-to, breakpoints through the emulator's own `DebugSupport`, and screen-text reading.

---

## 3. Architecture

```
                       ┌───────────────────────────── compile (main process or worker) ─────────────────────────────┐
 .zxbas ─► Header      ─► Lexer ─► Preprocessor ─► Parser ─► Binder / Type checker ─► Lowering ─► MIR (SSA, CFG)
 source    options       (token    (#include,     (recursive   (scopes, types,          (desugar      │
           (§5)          stream    #define,       descent +     constants, W-codes,      PRINT, loops,  ▼
                         with      #if, pragmas)  Pratt)        CODEBANK rules)          strings)     Optimiser passes (§7)
                         spans)                                                                         │
                                                                                                        ▼
 CompilerOutput ◄─ Debug-info ◄─ Klive assembler ◄─ Emitter ◄─ Peephole ◄─ Register ◄─ Instruction selection (per arch)
 (segments, NEX,    builder (§8)  (encode, place,   (LIR →     (rules on   allocation   (MIR → LIR: Z80 instruction
  debug info)       joins LIR     segments, NEX)    assembler   LIR)                     objects tagged with statement ids)
                    tags with                       program)
                    addresses                          ▲
                                                       └── Runtime modules (Klive-written, pre-parsed, cached) (§6)
```

### 3.1 Stages and their contracts

| Stage | Input → output | Notes |
| --- | --- | --- |
| Header options | first comment block → `CompileOptions` + diagnostics | §5. Runs before the preprocessor so it can set defines, include paths and the target. |
| Lexer | text → tokens `{kind, text, span}` | Case-insensitive keywords; case sensitivity of identifiers decided by options. Two modes: BASIC and "raw line" inside `ASM` blocks. Handles `/' '/` nesting, continuation (`_`/`\`), sigils, literal forms, string escapes. |
| Preprocessor | tokens → tokens | Token-level, not text-level: every output token keeps its **original span** plus a macro-expansion chain, so diagnostics and debug info point at real source. Include resolution through an injected file reader (works in the worker). |
| Parser | tokens → AST | Hand-written recursive descent for statements, Pratt parsing for expressions (precedence table from the spec). Error recovery at statement boundaries (`:`/NL) so one error does not hide the rest. Produces a lossless tree (keeps comment/trivia spans) so the editor features in §11 can reuse it. |
| Binder / checker | AST → typed AST + symbol tables | Scopes (global, routine, CODEBANK), declaration order rules, implicit typing (W100), `--explicit`/`--strict` equivalents, constant evaluation, all spec'd warnings (W100–W520) and CODEBANK rules (W900–W920 and errors). |
| Lowering | typed AST → MIR | Desugars control flow to a CFG; PRINT/INPUT/attribute statements to runtime-call sequences; string temporaries get explicit ownership and free points; array accesses to descriptor/element-address operations; DATA to tables. |
| MIR | per routine: CFG of basic blocks; typed virtual registers in SSA form | Instructions: arithmetic/logic per type, compare+branch, load/store (global, local, param, indirect, banked), call (user: stdcall/fastcall/far; runtime), phi. **Every instruction carries a statement id** (§8.2). |
| Optimiser | MIR → MIR | Pass list per level (§7.2). Passes that move or merge code must merge statement ids, not drop them. |
| Instruction selection | MIR → LIR | Tree/DAG tiling per architecture (`z80`, `z80n`). LIR = Z80 instructions as objects with operand kinds and statement ids. |
| Register allocation | LIR with virtual regs → physical | Z80 register classes (A; B C D E H L; BC DE HL; IX IY; the DE:HL pair for 32-bit; A+EDCB image for Float). Linear scan per routine with spill slots in the IX frame. Level 0 uses a simple stack-machine scheme instead (§7.1). |
| Peephole | LIR → LIR | Declarative rules (§7.3), flag- and liveness-aware. |
| Emitter | LIR + runtime closure → assembler program | Writes the program as assembler lines (§3.2), remembers `line → statement id`. Adds `.model`, `.org`, `.bank`/`.page`, `.savenex` lines for the target. |
| Assembler | program → `AssemblerOutput` | Klive's assembler, unchanged except for the extensions in §4. |
| Debug-info builder | assembler list items + line→statement table → `SourceLevelDebugInfo` + extensions | §8.3. |

### 3.2 How code reaches the assembler

The compiler builds the program as **assembler syntax-tree lines** and hands them to a new
assembler entry point (§4.1) — no text round trip. Two virtual source files are attached:

- `<name>.kbasic.asm` — the generated program. Its line numbers are LIR indices, so every
  `listFileItem` of that file maps back to one LIR instruction and therefore to a statement id.
- One virtual file per runtime module. Their list items map to statement id `-1` (runtime).

A **text dump of the same program** is always available (`'@emit-asm`, §5.3) for inspection and
for tests. The text form is a rendering of the tree, never parsed back in normal builds.

### 3.3 Code layout in the repository

```
src/main/kbasic/                     ← compiler (no Electron, no Node-only APIs except via injected FileReader)
  KBasicCompiler.ts                  ← IKliveCompiler implementation
  options/        header options, option model, precedence merge
  syntax/         lexer, preprocessor, parser, AST, spans
  semantics/      binder, types, constant evaluator, float40 (Sinclair 5-byte float), diagnostics
  ir/             lowering, MIR, CFG, SSA construction/destruction
  opt/            optimisation passes
  backend/        arch abstraction; z80/ and z80n/ instruction selection, regalloc, LIR, peephole, emitter
  debug/          debug-info builder and types
  codebank/       bank assignment, trampolines, far-call runtime (Klive-written), manifest
  runtime/        Klive-written runtime modules (Klive dialect) + generated index (§6)
  stdlib/         Klive-written standard library (`#include <…>`), documented APIs (§6.4)
src/common/abstractions/SourceDebugInfo.ts   ← shared debug-info types (extends CompilerInfo's model)
src/renderer/appIde/debugger/source/         ← source-level debugger UI logic (§10)
src/emu/machines/SourceStepDecision.ts       ← source-stepping decision (§10.2)
scripts/kbasic-runtime-index.cjs             ← generates runtime-index.json and the embedded module text (§6.2, R7)
test/kbasic/                                 ← unit, golden and execution tests (§13)
```

---

## 4. Assembler extensions (Phase 0)

Small, general-purpose changes to Klive's assembler; each is useful beyond this compiler and
tested on its own in `test/z80-assembler/`.

### 4.1 Programmatic entry point

`CommonAssembler.compileProgram(program: ProgramInput, options)` where `ProgramInput` is a list of
virtual source files, each an array of already-parsed assembly lines. It runs the same pipeline as
`doCompile` from the point after parsing. Parsed runtime modules are cached per session and reused
across builds (the runtime is ~170 small files; re-parsing it on every keystroke-triggered
background build would dominate build time).

### 4.2 8K page placement (Next)

A new pragma `.page <page8k>[, <address>]`: code assembled as if at `<address>` (default `$C000` or
`$E000` depending on the page's parity), stored in 8K page `<page8k>`. Produces a segment with
`bank = page >> 1`, `bankOffset = (page & 1) * $2000`, `startAddress = <address>`. The NEX writer
must place such segments by `bankOffset` rather than `startAddress % 16384` (today's rule), which
is the one behavioural change and gets its own test. Needed for CODEBANK (§9), where code runs at
`$6000` but lives in page 30+.

### 4.3 What the zxbasm-dialect converter needs (D10 only)

Klive BASIC's own runtime is written in Klive dialect and needs none of this. The converter for
user libraries in zxbasm dialect (§6.5) handles, **by rewriting rather than by extending the
assembler**: namespaces → `.module`; `PROC/LOCAL/ENDP` → `.proc` with renamed locals; numeric
temporary labels (`1:` with `1f`/`1b`) → generated unique labels; `#include once` → a dependency;
`#init` → an initialiser registration; `#ifdef` on compiler defines → Klive `#if`. Verified facts
for writing it: `getSymbol()` on an assembler output does not resolve dotted module names (use the
nested module), while dotted references in code do.

### 4.4 `#line`

Implement `#line` properly (it is a no-op today). The compiler does not rely on it (§3.2 maps
lines directly), but the `'@emit-asm` text dump uses it so that assembling the dump by hand still
reports BASIC locations.

---

## 5. Options

### 5.1 Header comment syntax

Options are written in the **leading comment block** of the build-root file: every line before the
first line that contains code. Blank lines and ordinary comments may be mixed in.

```
'@target        next
'@optimize      2
'@heap-size     4096
'@array-base    1
'@define        DEBUG, LEVEL=3
'@codebank-first-page 40

REM @break-key                  ← REM form is accepted too
' plain comments are ignored

PRINT "Hello"                   ← first code line: the header ends here
```

Grammar (Klive's own):

```
header-line = ( "'" | "REM" ) ws* "@" name [ ws* [ "=" ] ws* value ] [ ws* "'" comment ] ;
name        = letter { letter | digit | "-" } ;          (* case-insensitive *)
value       = flag | number | identifier | string | list ;
flag        = "on" | "off" | "true" | "false" | "yes" | "no" ;  (* a bare name means "on" *)
number      = decimal | "$" hex | "0x" hex | "%" binary ;
list        = item { "," item } ;
```

Rules:

- Only the build root's header is read. A header in an `#include`d file raises an info diagnostic
  and is ignored (libraries use `#pragma`, as upstream does).
- An unknown option name is a warning with a "did you mean" suggestion; a bad value is an error.
- `'@` inside the header is reserved for options: a comment that merely starts with `@` elsewhere
  in the file is an ordinary comment.
- Upstream `#pragma` lines keep working with their upstream names and semantics (they are part of
  the language). A header option and a pragma for the same setting: the pragma wins from its line
  onward, exactly as upstream.

### 5.2 Precedence

`IDE settings` < `project settings (.kliveproject)` < `header options` < `#pragma` (from its line
onward) < `debug profile override` (§8.6, only for the optimisation level and only when the header
does not pin it).

### 5.3 Option catalogue

Every `zxbc` option from the spec is mapped, dropped with a reason, or replaced by an IDE feature.

| Header option | Values (default) | Replaces `zxbc` | Notes |
| --- | --- | --- | --- |
| `target` | `next` \| `zx48k` \| `zx128k` \| `zxplus3` (from the machine type) | `--arch`, `-N/--zxnext` | Z80N instructions are allowed only for `next`. |
| `optimize` | `0`–`3` (2) | `-O/--optimize` | §7. |
| `optimize-for` | `speed` \| `size` \| `balanced` (balanced) | `--opt-strategy` | |
| `origin` | address (`$8000`) | `-S/--org` | |
| `heap-size` | bytes (4768) | `-H/--heap-size` | |
| `heap-address` | address (after the program) | `--heap-address` | |
| `array-base` | `0` \| `1` (0) | `--array-base` | Also `#pragma array_base`. |
| `string-base` | `0` \| `1` (0) | `--string-base` | |
| `case-insensitive` | flag (off) | `-i/--ignore-case` | |
| `sinclair-compatible` | flag (off) | `-Z/--sinclair` | Sets both bases to 1, case-insensitive, includes `sinclair.bas`. |
| `require-declarations` | flag (off) | `--explicit` | |
| `require-types` | flag (off) | `--strict` | |
| `default-byref` | flag (off) | `#pragma default_byref` | |
| `check-memory` | flag (off) | `--debug-memory` | |
| `check-bounds` | flag (off) | `--debug-array` | |
| `break-key` | flag (off) | `--enable-break` | |
| `headerless` | flag (off) | `--headerless` | |
| `define` | list of `NAME[=value]` | `-D/--define` | |
| `include-path` | list of folders, project-relative | `-I/--include-path` | |
| `disable-warning` / `enable-warning` | list of codes (`W150` or `150`) | `-W`/`+W` | |
| `expect-warnings` | count | `--expect-warnings` | |
| `output` | `bin` \| `tap` \| `tzx` \| `nex` \| `sna` \| `z80` (by target: `nex` for Next, `bin` otherwise) | `-f/--output-format` | Uses Klive's export paths. |
| `basic-loader` | flag | `-B/--BASIC` | |
| `autorun` | flag | `-a/--autorun` | |
| `append-block` | list of files | `--append-binary`, `--append-headless-binary` | `file` or `headless:file`. |
| `emit-asm` | flag | `-A`, `-f asm` | Writes `<name>.kbasic.asm` next to the build output. |
| `emit-ir` | flag | `-E`, `-f ir` | Writes the MIR dump; for compiler developers. |
| `emit-map` | flag | `-M/--mmap` | Label map; Klive's own format plus a CSpect-compatible one. |
| `debug-info` | `full` \| `lines` \| `none` (full) | — | New (§8). |
| `asm-dialect` | `klive` \| `zxbasm` (klive) | — | New (D10, §6.5). |
| `codebank-window` | address (`$6000`) | `--code-window` (fork) | §9. |
| `codebank-window-size` | `8k` \| `16k` (8k) | `--code-window-size` | |
| `codebank-first-page` | 8K page (30) | `--code-bank-base` | |
| `codebank-pages` | list of pages | `--code-bank-pages` | |
| `codebank-depth` | nesting depth (16) | `--code-bank-depth` | |
| `nex-entry` / `nex-stack` | address | NextBuild `'!pc`/`'!sp` | Next only; defaults: entry = program start, stack = below the heap. |
| `nex-loading-screen` | file | NextBuild `'!bmp` | Maps to `.savenex screen`. |
| `nex-core` | version (3.0.0) | — | Maps to `.savenex core`. |

Dropped, with reason: `--parse-only` (background diagnostics already do this), `-e/--errmsg`,
`-d/--debug`, `-F/--config-file`, `--save-config`, `--hide-warning-codes`, `--strict-bool`
(deprecated upstream), `-o/--output` (Klive's export dialog and project settings own the output
path), `--version`, `--help`.

### 5.4 NextBuild compatibility

`'!name=value` lines in the header are read as aliases (`org`→`origin`, `heap`→`heap-size`,
`opt`→`optimize`, `pc`→`nex-entry`, `sp`→`nex-stack`, `bmp`→`nex-loading-screen`,
`codebank`→`codebank-first-page`, `codebankpages`, `codewindow`, `codewindowsize`,
`codebankdepth`). Unsupported ones (`copy`, `exe`, `hdf`, `nb`, `nosys`, `module`, `master`,
`origin`, `asm`, `nonex`, `noemu`) produce one warning each naming the Klive alternative, if any.
This lets NextBuild projects be opened and built with at most header edits.

---

## 6. The Klive BASIC runtime

### 6.1 Principles

- **Written from scratch, for Klive** (D2). The sources are Klive-dialect assembly (plus Klive
  BASIC for parts of the standard library), MIT like the rest of Klive. No upstream runtime or
  library file is copied, converted or consulted while writing a routine; the contract comes from
  `.ai/kbasic/runtime-abi.md` (interfaces), `.ai/kbasic/stdlib-api.json` (documented library
  signatures), the spec, and Z80/ROM documentation.
- **Compatible where it is observable**: the user-visible ABI (§6.7), data layouts (Float, String,
  arrays), error report numbers, the behaviour of every statement and built-in in the spec, and the
  documented library APIs. **Free where it is not**: internal routine names, algorithms, the DATA
  stream format, the program layout order.
- **Minimal ROM dependency** (§6.3), so programs behave the same on the 48K and the Next and keep
  working when they page the ROM out for anything but Float maths.
- **Debugger-friendly by construction**: every runtime routine is plain code in module `core`
  (statement id `-1`), leaves the stack balanced at its return, and never keeps state on the Z80
  stack across a user call — the guarantees of §10.2.2 hold through it.

### 6.2 Layout, prologue and linking

- Sources live in `src/main/kbasic/runtime/` as one file per module (`heap`, `strings`, `print`,
  `arith16`, `arith32`, `fixed`, `float`, `arrays`, `input`, `graphics`, `sound`, `tape`, `data`,
  `errors`, `banking`, …). Each module declares, in a small comment header the index generator
  reads, the labels it exports, the modules it needs, its initialiser (if any) and the compiler
  symbols it tests.
- `scripts/kbasic-runtime-index.cjs` generates `runtime-index.json` from those headers (no
  hand-kept list) and the build embeds module text and index as generated TypeScript (R7, §17).
- The compiler emits its own prologue: save IY and SP, set IY to `$5C3A` (needed only around ROM
  calls, but set once for simplicity), store the **main program's baseline SP** for the debugger
  (§10.2.2 — proven in the walking skeleton, §17.1), call every initialiser of the linked modules
  (sorted), then the main program. `END [n]` restores and returns n in BC, as `USR` expects.
- Linking: the compiler records every runtime label it calls, computes the module closure from the
  index, and appends the modules' pre-parsed trees to the program (§4.1). Unused modules are never
  assembled.
- Targets: one source per module with `#if` sections on the predefined target symbol (`zx48k`,
  `zx128k`, `zxplus3`, `next`); the Next variants use Z80N instructions where they pay off
  (`mul d,e`, `ldirx`, `add hl,a`, barrel shifts).

### 6.3 ROM policy

| Uses the ROM | Klive's own code |
| --- | --- |
| Float arithmetic, comparison, maths functions (the calculator via `rst $28`) | Integer and Fixed arithmetic |
| Float ↔ text (`PRINT` of a Float, `STR`, `VAL`) | PRINT of text and integers, all 24 rows, AT/TAB/comma, embedded control codes, BOLD/ITALIC, scrolling, attributes, BORDER, CLS |
| Tape `LOAD`/`SAVE`/`VERIFY` (48K/128K/+3 only) | Keyboard (`INKEY`, key scanning), `PAUSE` (frame counter / HALT), `BEEP` (own beeper loop), `PLOT`/`DRAW`/`CIRCLE` |
| Error reports (`rst 8`), so `ERROR n` and runtime errors show the familiar report | Heap, strings, arrays, DATA/READ, far calls (CODEBANK) |

- ROM calls are wrapped: the wrapper makes sure the 48K BASIC ROM is paged in and IY = `$5C3A`
  for the call and restores the caller's state after it. On the Next the wrapper selects ROM 3 in
  slots 0–1 if a program has changed them (programs that deliberately map RAM there and then use
  Float are warned about in the docs; the wrapper makes it work rather than crash).
- The constant folder in the compiler emulates the ROM calculator's arithmetic bit-exactly
  (§7.4), because folded and run-time results must agree.

### 6.4 Standard library

- `#include <name.bas>` resolves to **Klive BASIC's own library** first, then the user's include
  path. The library implements the documented APIs in `.ai/kbasic/stdlib-api.json` (46 libraries,
  67 documented routines), written in Klive BASIC with Klive-dialect inline asm where speed needs
  it.
- Priority by expected use: `string.bas` (MID$, LEFT$, RIGHT$, INSTR, case, trim), `attr.bas`,
  `screen.bas`, `point.bas`, `input.bas`, `keys.bas`, `hex.bas`, `alloc.bas`, `memcopy.bas`,
  `random.bas`, `putchars.bas`, `print42.bas`/`print64.bas`, `scroll.bas`, `esxdos.bas`,
  `IM2.bas`, `sinclair.bas` (for `sinclair-compatible`), then the rest. `farmem.bas` comes with
  CODEBANK (§9).
- A library not yet written gives a clear diagnostic ("`<print64.bas>` is not available in Klive
  BASIC yet") instead of a missing-file error.

### 6.5 zxbasm-dialect libraries (D10)

User libraries written for upstream (NextBuild's `nextlib.bas`, community code) contain inline asm
in zxbasm dialect and may call upstream runtime entry points by name. `'@asm-dialect zxbasm` runs a
converter over each `ASM` block at compile time (namespaces → modules, `PROC/LOCAL` → `.proc`,
temporary labels → unique labels, directives → Klive forms). Calls to upstream runtime entry points
are mapped through an **alias table** to Klive runtime routines with the same register contract;
an entry point without an alias is a clear error naming it. The alias table grows per supported
library (nextlib first) and is tested against that library.

### 6.6 Runtime constraints the compiler must respect

- The Float calculator, Float ↔ text, tape and error reports need the 48K BASIC ROM and the
  system variables; the ROM-call wrappers (§6.3) take care of paging and IY.
- The compiler's conventions for user routines follow §6.7 exactly, so user code, the standard
  library and inline asm interoperate.
- The runtime must keep the stack balanced across its routines and leave no state on the Z80
  stack across a user call (§10.2.2); a runtime-level test checks it for every module.

### 6.7 ABI summary (the user-visible contract Klive BASIC keeps)

| Item | Rule |
| --- | --- |
| Type sizes | 8-bit 1, 16-bit 2, 32-bit 4, Fixed 4, Float 5, String 2 (heap pointer; 0 = empty) |
| STDCALL call | Arguments pushed last-first; bytes as `push af` (value in the high byte); 32-bit high word first; Float as 6 bytes. Callee pops. |
| STDCALL frame | `push ix; ld ix,0; add ix,sp`; saved IX at `(ix+0)`, return address at `(ix+2)`, first parameter at `(ix+4)`; locals at negative offsets, zeroed at entry. |
| FASTCALL | First parameter in A / HL / DE:HL / A-E-D-C-B; no frame, no locals; extra parameters on the stack, popped by the callee. |
| Results | A (8-bit), HL (16-bit, String), DE:HL (32-bit, Fixed), A-E-D-C-B (Float: A exponent, E-D-C-B mantissa, sign in bit 7 of E). |
| Strings | By-value String arguments are duplicated by the caller; the callee frees them. A returned String is freed by the caller. Temporaries are passed with "free after use" flags. |
| Arrays | Always by reference; the pushed value is the descriptor address. Descriptor: dimension table pointer, data pointer, lbound table pointer, ubound table pointer. |
| Naming | Global variables and routines `_name`; labels `_label.x`; routine epilogues `_name.leave`; runtime in module `core` (§8.4). Upstream runtime entry-point names exist only as aliases for zxbasm-dialect libraries (§6.5). |

---

## 7. Optimisation

### 7.1 Levels

| Level | Purpose | Code generation |
| --- | --- | --- |
| `0` | Debugging and compiler bring-up | No MIR optimisation. Stack-machine code generation: every expression result goes through a fixed register (A/HL/DE:HL/AEDCB) and the Z80 stack. Every statement starts at its own address and nothing crosses a statement boundary. |
| `1` | Debug-friendly speed-up | Local optimisations only, **statement boundaries are barriers**: constant folding, algebraic simplification, strength reduction, dead-code removal inside a statement, register allocation within a statement, peephole rules that do not cross a boundary. |
| `2` (default) | Release | Global: SSA constant/copy propagation, sparse conditional constant propagation, dead-code and dead-store elimination, common-subexpression elimination within a routine, branch folding, jump threading, unused-routine removal (W170), loop-invariant code motion for simple loops, full linear-scan register allocation, all peephole rules. |
| `3` | Aggressive | Adds inlining of small FUNCTIONs and SUBs, tail-call conversion (`call x; ret` → `jp x`), loop strength reduction (array index induction variables), FASTCALL conversion of internal leaf routines whose address is never taken, cross-block peephole. |

`optimize-for size` prefers shorter sequences and runtime calls over inline expansion;
`speed` prefers inline expansion (for example inline 16-bit multiplies by constants, unrolled
small loops); `balanced` chooses per construct.

### 7.2 MIR passes (in order, per level)

1. Constant evaluation and folding (all levels, including `0` for constant expressions required by
   the language, such as array bounds).
2. SSA construction (levels 2–3; level 1 works on per-statement expression trees).
3. Sparse conditional constant propagation; copy propagation.
4. Algebraic simplification and strength reduction: `x*2^n` → shifts, `x/2^n` for unsigned →
   shifts, `x MOD 2^n` → masks, comparisons against 0 → flag tests, boolean normalisation only
   where a 0/1 value is observable.
5. Type narrowing: operations whose operands and result provably fit in 8 bits are done in 8 bits
   (a large win on the Z80: FOR loops over UByte, attribute arithmetic, array indices).
6. Common-subexpression elimination (dominator-based within a routine).
7. Dead-code and dead-store elimination; unreachable-block removal (W180 where the source is
   reachable-looking).
8. Loop-invariant code motion; induction-variable strength reduction (level 3).
9. Inlining (level 3), followed by a second round of 3–7.
10. Unused routine and unused global removal.

### 7.3 LIR (machine-level) optimisation

Rules are data, not code paths: each rule names an instruction pattern, preconditions (register or
flag liveness, value ranges, the target's instruction set) and a replacement, plus a cost model for
size and T-states. The rule engine is written in TypeScript and tested per rule with before/after
cases and an execution check. Rule groups:

- Redundant load/store removal (`ld (x),a` … `ld a,(x)`).
- Register copy coalescing and `ex de,hl` use.
- Flag reuse (a compare already done by an `and`/`or`/`dec`).
- Branch shaping: `jp`→`jr` where in range (the compiler computes instruction sizes itself —
  `z80nInstructionLengths.ts` already has the table), `djnz` for byte-counted loops, branch
  inversion to remove jumps over jumps, jump-to-jump collapsing.
- Tail calls: `call x` + `ret` → `jp x`.
- Z80N-only (target `next`): `mul d,e` for 8×8 multiplies, `add hl,a`/`add de,a`/`add bc,a`,
  `add hl,nn`, `push nn`, `ldix`/`ldirx` for fills and copies, `swapnib`, `mirror`, `test n`,
  barrel shifts (`bsla`/`bsra`/`bsrl`/`bsrf`/`brlc`) for variable 16-bit shifts.
- Runtime-call specialisation: call a faster runtime entry when operands are known (for example an
  8-bit multiply by a constant as shifts and adds, a string compare against a constant length).

### 7.4 Constant folding and the ROM calculator

Integer and Fixed folding is exact. **Float folding must match the ROM**, because the program
computes the same values at run time through the ROM calculator. The compiler therefore has a
`float40` module that implements the Sinclair 5-byte format and the ROM's arithmetic for
`+ - * /`, comparison and integer conversion bit-exactly (verified against the ROM running in
Klive's own emulator, §13.3). Transcendental functions (`SIN`, `LN`, `^`, …) are **not** folded
unless their arguments make the result exact; they are left to run time.

### 7.5 Optimisation and debug information

Passes keep statement ids consistent (§8.2): merged code gets the id of the statement that dominates
it or `-2` ("shared by several statements"); hoisted loop-invariant code keeps the id of the
statement it came from but is flagged `hoisted`. The debugger (§10) treats `-2` like runtime code
when stepping and shows "optimised: several statements" when stopped there.

---

## 8. Debug information

### 8.1 Adopt the existing model

`SourceLevelDebugInfo`, `StatementDebugInfo` and `CallableDebugInfo` in `CompilerInfo.ts` are used
as they are. They already carry partitions, call targets, statement kinds, column ranges and a
banked address map. The compiler **extends** them in a new shared file
`src/common/abstractions/SourceDebugInfo.ts`; all fields stay JSON-serialisable (they cross IPC and
the worker boundary).

### 8.2 Statement ids and provenance

- A **statement** is one BASIC statement: `a = 1 : b = 2` on one line gives two statements with
  distinct column ranges. Multi-line statements (block headers such as `IF … THEN`, continued
  lines) record their full span.
- Block statements get separate ids for their parts that execute separately: the condition of an
  `IF`/`ELSEIF`/`WHILE`/`DO … LOOP UNTIL`, the `FOR` initialisation, the `NEXT` increment and test,
  `END SUB`/`END FUNCTION` (the epilogue), so stepping stops on the line where execution actually
  is.
- Ids flow from AST through MIR and LIR; every LIR instruction has exactly one id (≥ 0: a
  statement; `-1`: runtime and compiler glue such as the prologue; `-2`: shared after
  optimisation).
- Code produced by macro expansion is attributed to the statement containing the macro use, and
  the expansion chain is kept for diagnostics.
- **Colon-separated statements are always separate statements**, each with its own column range
  (0-based start inclusive, end exclusive, as `StatementDebugInfo` defines). The range covers the
  statement's text only: the separating `:` and surrounding blanks are excluded, and so are
  trailing `'`/`REM` comments. The lexer gives exact spans, so `:` inside a string literal or a
  comment never splits a statement.
- Things on a line that are **not** statements get no id and are never a stop: line numbers and
  labels, `DATA`, `DIM`/`CONST` without a run-time initialiser, `DECLARE`, empty statements
  (`::`), comments.

**Code-generation guarantees that make statement stepping reliable** (checked by a debug-info
validator in the tests, §13.5):

1. Every statement with an id ≥ 0 has exactly one **entry address**: the first byte of its code,
   reached only by entering the statement.
2. No branch *inside* a statement targets that statement's entry address. A loop that restarts a
   statement (`10 GOTO 10`, `DO : LOOP`, the `FOR`…`NEXT` back edge) targets the entry of the
   statement it restarts, which is the statement being entered, never an internal address.
3. A statement that generates no code (for example a constant assignment to a variable the
   optimiser removed) is recorded with `endAddress = startAddress` and `elided: true`; the debugger
   does not stop at it and the Variables panel explains why a value did not change.

Guarantees G4–G6 (stack balance at statement entries, every user call a recorded call site, return
values in registers at `ret`) belong to the same list; they are stated with the stepping design
they serve, in §10.2.2.

### 8.3 Building the tables after assembly

The assembler reports, for every line of the generated program, its address, length and segment.
Joining that with `line → statement id` gives exact address ranges **after all optimisation and
after branch relaxation**. The builder then produces:

- `statements[]` with `startAddress`/`endAddress` (the first and last byte of the statement's
  first contiguous run; a statement split by optimisation has further runs listed in an extension
  field `ranges`), `partition` for banked code;
- `addressToStatement` (ascending, `-1`/`-2` for runtime, glue and shared code) and, when banking
  is used, `partitionedAddressMap`;
- `callables[]` with entry address, `exitAddresses` (every `ret` and the jump into the shared exit),
  `bodyStart` (first address after the prologue) and `epilogueStart`;
- **the classic tables too**: `sourceFileList` (the BASIC files), `sourceMap` (statement start
  address → BASIC file and line and columns) and `listFileItems` (one per statement). This makes
  existing breakpoints and execution-point highlighting work **before** any debugger change
  (§10.1).

### 8.4 Extensions for variables, frames and banks

```ts
// src/common/abstractions/SourceDebugInfo.ts  (sketch; the implementation phase defines it exactly)
type BasicTypeName = "byte" | "ubyte" | "integer" | "uinteger" | "long" | "ulong"
                   | "fixed" | "float" | "string" | "boolean";

type VariableDebugLocation =
  | { at: "absolute"; address: number; partition?: number }   // globals, DIM AT, bank-local data
  | { at: "frame"; ixOffset: number }                           // locals (<0) and parameters (>=4)
  | { at: "fastcall-register"; register: "A" | "HL" | "DEHL" | "AEDCB"; validUntil: number }
  | { at: "constant"; value: number | string };

type VariableDebugInfo = {
  name: string;                 // as declared, without sigil; displayName keeps the sigil
  displayName: string;
  type: BasicTypeName;
  kind: "global" | "local" | "parameter" | "constant";
  byRef?: boolean;              // parameter passed by reference (holds an address)
  location: VariableDebugLocation;
  array?: { dimensions: { lower: number; upper: number }[]; descriptor: VariableDebugLocation;
            elementType: BasicTypeName };
  scope: { callableIndex: number; fromStatement: number; toStatement: number } | "global";
  declaredAt: { fileIndex: number; line: number; column: number };
  bank?: number;                // CODEBANK logical bank for bank-local data
};

type CallSiteDebugInfo = {
  returnAddress: number;        // address right after the CALL (or the far-call trampoline call)
  partition?: number;
  statementIndex: number;
  kind: "sub" | "function" | "gosub" | "on-gosub" | "far";
  calleeIndex?: number;         // user callable; absent for on-gosub (several targets)
  targets?: number[];           // on-gosub: the possible target callables/labels
  moreCallsFollow: boolean;     // the statement makes further user calls after this one (§10.2.3)
  order: number;                // evaluation order within the statement (Step Into Target, §10.2.4)
};

// Added to each CallableDebugInfo (as an extension record keyed by callable index)
type CallableFrameInfo = {
  callableIndex: number;
  convention: "stdcall" | "fastcall" | "entrypoint" | "gosub-target";
  returnSlotOffset?: number;    // bytes from the baseline SP to the return-address slot (§10.2.2)
  bodyStart: number;            // first address after the prologue (IX valid from here)
  epilogueStart: number;        // first address of the epilogue (IX still valid until the pop)
  returnType?: BasicTypeName;   // FUNCTIONs only
};

type KBasicDebugExtensions = {
  variables: VariableDebugInfo[];
  callSites: CallSiteDebugInfo[];
  frames: CallableFrameInfo[];
  mainBaselineSymbol: number;   // address of the word where the prologue stores the main program's baseline SP
  statementRanges?: { statementIndex: number; ranges: [number, number, number?][] }[];
  runtimeSymbols: { name: string; address: number }[];   // runtime entry points, for disassembly labels
  errorEntry?: number;          // address of the runtime error routine (§10.10)
  codebank?: { window: number; windowSize: number; farCallEntry: number; farReturnEntry: number;
               shadowStack: number; shadowStackPointer: number; currentBank: number;
               banks: { bank: number; pages: number[] }[] };
  optimizationLevel: number;
};
```

Names visible to inline asm (Klive dialect) are fixed by the compiler and recorded here, so the
disassembly view and inline asm agree: globals and routines `_name`, labels `_label.name` (or the
line number), routine epilogues `_name.leave`, runtime `core.X`. (These are Klive's own names; they
need not match upstream's, because inline asm is Klive dialect.)

### 8.5 Sidecar for NEX debugging

With `debug-info full`, a NEX build also writes `<name>.nex.kbasic-debug.json` beside the NEX. When
a NEX is launched on its own (the NEX debugging work in `.plans/NEX_DEBUGGING_PLAN.md`), the IDE
loads the sidecar and debugs at source level without rebuilding.

### 8.6 Debug profile (D11)

`klive.debug` compiles with a profile: optimisation capped at 1 unless the header sets
`'@optimize` explicitly; `debug-info full`. `klive.run`/export use the header or settings as they
are. The IDE shows the effective level in the build output so the user knows what they are
stepping through.

---

## 9. CODEBANK

### 9.1 Language (from the spec's `extensions.codebank`)

`CODEBANK n … END CODEBANK` blocks; `#pragma codebank = n`; `FARPTR x` (ULong: bank in bits
16–23, address in bits 0–15); the asm-level `CODEBANK n` pseudo-op; `#include <farmem.bas>` API
(`FarPeek`, `FarPeekW`, `FarPoke`, `FarPokeW`, `FarCopy`, `FarCopyTo`, `FarStr`). Semantics,
errors and warnings (W900 ByRef across banks, W910 data-only bank, W920 bare `@array`) as recorded
in the spec. The bank of a routine is the bank in force **at its definition**.

### 9.2 Klive's implementation (own design, same observable contract)

- **Bank assignment** happens in the binder: routines, bank-local `DIM`s and module-level `ASM`
  blocks get a bank; references are checked there (not in the assembler), so errors point at BASIC
  lines. The assembler-level check of hand-written inline asm uses symbol partitions from the
  assembler output and reports through the debug-info builder.
- **Trampolines**: each banked routine keeps a small resident stub at its public label that enters
  the far-call runtime with the target bank and body address. Call sites stay ordinary `call`s, so
  inline asm, `@routine` and the stdlib keep working.
- **Far-call runtime**: written for Klive from the contract (page the bank into the window through
  the MMU NextReg for the window slot, keep a shadow return stack of `{previous bank, return
  address}` in resident memory, redirect the callee's `ret` through a far-return routine that
  restores the bank and all registers, same-bank fast path). NextBuild's `farcall.asm` is not
  copied (its licence is unstated, §0.1). `farmem.bas` is likewise written for Klive.
- **Stack contract for the debugger**: while a banked routine runs, the Z80 stack must look exactly
  as it would after a direct `call` — arguments, then one return-address slot (holding the
  far-return entry on the slow path), nothing else. The far-call runtime keeps its own state only in
  the resident shadow stack. This keeps G4 and the frame locator (§10.2.2) valid across banks, and
  the far-return entry plus the shadow stack give the real return address.
- **Placement**: each bank is assembled into its 8K page(s) with `.page` (§4.2); the resident
  program must not overlap the window (checked; error).
- **Initialisation**: a prologue `#init`-style routine reads the page currently in the window slot
  (so "bank 0" restores what the loader mapped) and resets the shadow stack.
- **Options**: §5.3 (`codebank-*`).

### 9.3 Output

The NEX gets every bank page through the assembler's segments. A manifest equivalent to NextBuild's
`banks.json` is written only if `'@emit-map` is set, for tools that expect it.

### 9.4 Debugging banked code

All banked statements carry `partition` = their 8K page; §10 makes every lookup partition-aware.
The far-call runtime's shadow stack is described in the debug info (§8.4) so the call stack can
replace the far-return address on the Z80 stack with the real caller (§10.6).

### 9.5 Tests

Port **the scenarios, not the code** of NextBuild's CODEBANK examples: same-bank fast path,
cross-bank and nested calls, returns in every register class, 16K window, bank-local data and its
initialisation order, strings across banks, FARPTR/farmem, deep recursion, the interrupt rule.
Written fresh, run on the Next harness (§13.2).

### 9.6 Interrupts

Documented rule (not enforced): interrupt handlers must not call banked routines or touch
bank-local data. The compiler warns when a routine marked as an interrupt handler (a future
`'@interrupt-handler` attribute, or a routine installed through a recognised stdlib call) is in a
bank.

### 9.7 Future: NEX assets

A later option `'@nex-include file, page[, offset]` could pack data files into NEX pages and define
constants for their page numbers, replacing NextBuild's source scan of `LoadSDBank` calls with an
explicit declaration. Not part of this plan's phases.

---

## 10. Debugger extensions

Everything here works for **any** compiler that fills `SourceLevelDebugInfo` (Pasta 80 can adopt
it too); the ZX BASIC compiler is the first producer.

### 10.1 Stage 0: works with no debugger changes

With the classic tables from §8.3 (`sourceFileList`, `sourceMap`, `listFileItems`), BASIC
breakpoints, "unreachable breakpoint" markers and execution-point highlighting already work through
the existing code paths. The `zxbas` language provider switches `supportsBreakpoints` on and
`lineCanHaveBreakpoint` answers from the lexer (not blank, not comment-only, not a pure block end
such as `END IF`/`LOOP`/`NEXT` without code).

### 10.2 Source stepping and calls

#### 10.2.1 Modes and where the logic runs

- Add `SourceStepInto`, `SourceStepOver`, `SourceStepOut`, `SourceStepOverLine` (§10.3) and
  `SourceRunToFrame` (§10.2.5) to `DebugStepMode`.
- New pure function `shouldStopAtSourceStep(input)` in `src/emu/machines/SourceStepDecision.ts`,
  called from `shouldStopAtDebugPoint` when a source mode is active. User breakpoints are checked
  first and always win; a breakpoint hit ends the step.
- **One hook covers every target.** All Z80 machines (48K, 128K, +3, Next, and `MachineFrameRunner`
  for the TypeScript cores) already run their debug loop one instruction at a time in TypeScript
  and call `shouldStopAtDebugPoint` after each instruction (checked 2026-09-26:
  `ZxSpectrum48WasmV2Machine.ts:864`, `ZxSpectrum128WasmV2Machine.ts:918`,
  `ZxSpectrumP3eWasmV2Machine.ts:1231`, `ZxNextWasmV2Machine.ts:843`). Source stepping needs no
  core changes except the interrupt signal in §10.2.7.
- **Statement locator**: built once per debug-info version, per partition, as an `Int32Array`
  over the program's address range holding, for each address, the statement id and an "entry"
  bit. One array read per instruction.
- The decision needs, per instruction: PC, SP, the partition of PC, and the step's saved state
  (below). IX and memory are read only when a step starts (to locate frames), never per
  instruction.

#### 10.2.2 Activations and frames

Step over and step out are about **activations** — one execution of the main program, of a SUB or
FUNCTION, or of a GOSUB subroutine. Recursion gives several activations of the same routine, and
two calls on one line give two activations one after the other, so "which routine is PC in" is not
enough. The design works on the stack instead.

**Compiler guarantees** (added to §8.2 and checked by the debug-info validator, §13.5):

- **G4 — stack balance at statement entries.** Within one activation, SP has the same value at
  every statement entry: the activation's **baseline**. No expression temporary, argument push,
  `FOR` state or string temporary is left on the Z80 stack across a statement boundary. A callee's
  statements therefore always run *below* its caller's baseline (arguments, return address, saved
  IX and locals sit in between).
- **G5 — every user call is a recorded call site.** Each call of a SUB or FUNCTION, each `GOSUB`,
  each `ON … GOSUB` dispatch and each far call through a CODEBANK trampoline is one Z80 `call`
  whose return address is in the call-site table (§8.4) with its statement, its callee (or
  "several" for `ON … GOSUB`), its kind and whether the statement makes further user calls after
  it (`moreCallsFollow`). `ON … GOSUB` is emitted by the compiler as its own dispatch so its return
  address is precise, rather than going through an opaque runtime routine.
- **G6 — return values are in registers at the `ret`.** When a FUNCTION's `ret` executes (for a
  far call: when the far-return runtime's final `ret` executes), its result is in the ABI registers
  (§6.7). The epilogue may use the alternate registers and `ex af,af'` to preserve it, as the ABI
  already requires.

**Per-callable frame description** (debug info, §8.4): `convention` (`stdcall`, `fastcall`,
`entrypoint`), `returnSlotOffset` — the distance in bytes from the baseline SP to the slot holding
the return address (STDCALL: size of locals + 2 for the saved IX; FASTCALL: 0; the main program:
none) — `bodyStart`, `epilogueStart`, and `returnType`. The main program's baseline is stored by
the prologue in a known symbol (`mainBaselineSymbol`), because the program runs on whatever stack
its loader gave it.

**Frame locator** — shared by stepping and the call stack (§10.6). Input: PC, SP, IX, memory,
partitions, debug info. Output: the activation chain, innermost first, each as
`{callable, baseline, returnSlot, returnAddress, callSite, ix?}`. Method:

1. The innermost activation's callable comes from PC's statement (or, in runtime code, from the
   nearest user frame found in step 3).
2. Its return slot: for a STDCALL routine between `bodyStart` and `epilogueStart`, `IX + 2`
   (IX is valid there). Otherwise the first stack word at or above SP that equals a call-site
   return address whose callee is this callable (or "several").
3. Outer activations: continue scanning upward from the slot for the next matching call-site
   return address, checking that the callees chain up (the call site's statement must belong to the
   next activation's callable). For far calls, a slot holding the far-return entry is replaced by
   the real return address and bank from the CODEBANK shadow stack (§9.4). The chain ends at the
   main program, whose baseline comes from `mainBaselineSymbol`.
4. `baseline = returnSlot − returnSlotOffset` for each activation.

The scan is robust against stray words that happen to equal a return address, because every
candidate must chain consistently; STDCALL frames are also cross-checked against the saved-IX
chain.

#### 10.2.3 Step Over

At the start of the step the frame locator gives the current activation `A` (baseline `B`, return
slot `R`) and its caller `C`. Then, after every instruction:

1. **Still in `A` or deeper** (`SP ≤ R`): stop at a statement entry only if `SP ≥ B`. Entries
   reached at `SP < B` belong to callees (or to deeper recursive activations of the same routine)
   and are run through.
2. **`A` has returned** (`SP > R`, and PC is back in user code — far-return and other runtime
   glue are run through): this is a *return point* in `C`, in the middle of the calling statement.
   - If that call site has `moreCallsFollow` (for example the `f(1)` in `x = f(1) + g(2)`), stop
     here, so the user can step into the next call. The editor highlights the calling statement
     with a "returned from `f`" marker (§10.2.6).
   - Otherwise do not stop; the reference becomes `C` (`B := C.baseline`, `R := C.returnSlot`)
     and rule 1 continues from there, so the step ends at the caller's next statement.
3. **Stepping over from a return point** (paused mid-statement): `B` is the current activation's
   baseline from the frame locator, not the current SP, so the rest of the statement — including
   any remaining calls, run through — completes and the step ends at the next statement.

| Situation | Step Over stops at |
| --- | --- |
| `DrawBox 1, 2` (SUB call) | the next statement; `DrawBox` runs completely |
| `x = f(1) + g(2)` | the next statement; both functions run |
| `GOSUB 1000` | the statement after `GOSUB`; the subroutine runs to its `RETURN` |
| `ON k GOSUB 100, 200, 300` | the next statement |
| `n = n * Fact(n - 1)` inside `Fact` (recursion) | the next statement of *this* activation; deeper activations of `Fact` run through although they execute the same statements |
| the last statement of a SUB, or `END SUB` / `RETURN` | the caller's next statement (rule 2), or the return point if the caller's statement makes more calls |
| a breakpoint inside a called routine | the breakpoint (the step ends there) |
| a call that never returns (`END` inside the callee, a machine-code `USR` that does not return) | wherever execution next stops: a breakpoint, a runtime-error stop (§10.10), or the user's Pause |

#### 10.2.4 Step Into

1. After at least one instruction, stop at the next statement entry **at any depth** — the first
   statement of a called SUB, FUNCTION or GOSUB subroutine, or the next statement of the current
   activation.
2. Code without statements is run through: the runtime, compiler glue, `USR` machine code, and
   library code when Just My Code (§10.12) excludes it. A SUB whose body is an `ASM` block stops at
   that block (an `asm` statement); switching to Z80 stepping steps inside it.
3. If the current activation returns during the step, the return-point rule of §10.2.3 (rule 2)
   applies.
4. Interrupt handlers are excluded (§10.2.7).

`x = f(g(1))` steps into `g` first (evaluation order), then — after `g` ends — stops at the
return point (because `f` is still to come), and the next Step Into enters `f`.

**Step Into Target.** When the current statement calls several routines, a toolbar drop-down and a
context-menu item list its call targets in evaluation order (from the call-site table). Choosing
one runs every other call through and stops at the chosen routine's first statement, in an
activation deeper than the current one. Implemented as a session one-shot breakpoint on the
target's first statement entry, qualified by `SP < B`.

#### 10.2.5 Step Out

1. At the start, the frame locator gives the current activation's return slot `R`.
2. Run until `SP > R` and PC is back in user code (far-return glue run through).
3. Stop at the **return point**, always — also for a SUB call with nothing left in the statement —
   so the user sees where control came back. For a FUNCTION the returned value is shown (§10.2.6).
   A further Step Over finishes the calling statement.

| Situation | Step Out stops at |
| --- | --- |
| inside a SUB or FUNCTION (STDCALL or FASTCALL) | the return point in the caller's statement |
| inside a GOSUB subroutine | the return point of the `GOSUB` statement |
| inside a banked routine (CODEBANK) | the return point in the caller, after the far-return runtime has restored the caller's bank |
| inside a recursive activation of `Fact` | the return point in the *calling activation* of `Fact` (one level up), not the outermost caller |
| in the main program | nothing to return to: the command is disabled and the tooltip says so |
| paused in runtime code (after a Z80-level step) | the return point of the innermost *user* activation, found by the frame locator |

**Run to Frame.** Selecting a frame in the Call Stack panel and choosing "Run to this frame" runs
until the activation just inside it has returned (`SP >` that activation's return slot) and stops
at the return point in the selected frame. It is Step Out repeated, done as one run.

#### 10.2.6 Returned values

At every return-point stop the Variables panel shows a pseudo-entry "`f` returned" with the value
decoded from the registers by the callable's `returnType` (A; HL; DE:HL; A-E-D-C-B for Float; HL
as a String pointer). The registers are captured on the first instruction after `SP > R` (G6). After
a Step Over of a statement that made several calls, the same section lists the last value returned
by each called FUNCTION during the step (the decision function records them as it runs through the
return points).

#### 10.2.7 Interrupts

An interrupt taken during a step runs its handler **outside** the step: while a handler runs, no
statement entry counts as a stop — including BASIC SUBs installed as IM2 handlers — and the step
resumes when the handler returns. The cores already push interrupt entries onto their shadow return
stack; each core exposes an "interrupt depth" counter the same way `zxnextGetStepOutAddress`
exposes the shadow stack's top (a small addition per WASM core, done once in
`z80.c`). A setting "Stop in interrupt handlers while stepping" (default off) turns the exclusion
off. User breakpoints inside handlers always stop.

#### 10.2.8 Toolbar and keys

F11 Step Into, F10 Step Over, Shift+F11 Step Out, Shift+F10 Step Over Line (§10.3), Step Into
Target (drop-down on the Step Into button and a context-menu item), Run to Cursor, Run to Frame
(Call Stack context menu). A **Source / Z80** stepping toggle is enabled only when the current
program has source-level debug info and defaults to Source for BASIC; in Z80 mode the existing
instruction-level commands apply unchanged.

### 10.3 Stepping through several statements on one line (D7)

The stepping rules in §10.2 are defined on statement ids, so a line with three statements takes
three steps. This section makes the line-level behaviour explicit, including the cases a
"has the statement id changed?" rule alone would get wrong.

**The stop rule.** Source *step into* stops at the next **statement entry** (§8.2 guarantee 1)
reached after the first instruction has executed, **including re-entry of the statement the step
began in**. Precisely: after each instruction, stop if PC is the entry address of any statement
(`id ≥ 0`, in the current partition), subject to the activation rules of §10.2.3–§10.2.5 for step
over and step out. Stopping on *entries* rather than on "a different id" is what makes these work:

| Source | Steps (▸ = where execution stops) |
| --- | --- |
| `a = 1 : b = 2 : PRINT a + b` | ▸`a = 1` → ▸`b = 2` → ▸`PRINT a + b` → next line |
| `FOR i = 1 TO 3 : PRINT i : NEXT i` | ▸`FOR i = 1 TO 3` → ▸`PRINT i` → ▸`NEXT i` → ▸`PRINT i` → … → ▸`NEXT i` → next line. The `NEXT` back edge enters `PRINT i` again on the same line, and each pass stops. |
| `10 GOTO 10`, `DO : LOOP` | Each step stops again at the same statement (re-entry). A "different id" rule would run forever. |
| `IF x > 0 THEN a = 1 : b = 2 ELSE c = 3` | ▸`IF x > 0` (the condition, its own id) → then either ▸`a = 1` → ▸`b = 2`, or ▸`c = 3` → next line. The statements of the branch not taken are never stops. |
| `IF k$ = "" THEN GOTO 100 : REM wait` | ▸`IF k$ = ""` → ▸`GOTO 100` → line 100. The comment is not a stop. |
| `x = f(1) : y = f(2)` | Step over: ▸`x = f(1)` → ▸`y = f(2)`. Step into: ▸`x = f(1)` → first statement inside `f` → … → back to ▸`y = f(2)` (the return lands mid-statement, which is not an entry, so execution continues to the next entry). |
| `PRINT AT 0,0; a; b; c` | One statement: one step, however many runtime calls it makes. |

**Step over a whole line.** A separate command, **Step Over Line** (for example Shift+F10), runs
until the next statement entry on a *different* line or a re-entry of the current line's first
statement. It is for users who think in lines, and for long `:` chains they are not interested in.
Step Into/Over/Out stay statement-granular.

**Editor presentation.**

- The execution point highlights the **column range of the active statement** only, with the
  gutter arrow on its line. `createCurrentBreakpointDecoration` already takes start and end
  columns; the source-level path feeds it the statement's range (§10.5).
- When the line has several statements, the non-active ones stay unhighlighted and a subtle
  marker shows statement boundaries while paused (so it is obvious that more steps remain on this
  line).
- A multi-line statement (continued with `_` or `\`) highlights its whole span.

**Breakpoints on individual statements** (part of Phase 5, not a follow-up):

- A gutter click sets a breakpoint on the line's **first** statement, as today.
- **Inline breakpoint markers** (Monaco inline decorations, as VS Code shows them) appear before
  each further statement of a line that has more than one; clicking one sets a breakpoint on that
  statement only. A context-menu item "Add breakpoint at statement" does the same at the cursor.
- `BreakpointInfo` gains an optional `column`; a source breakpoint with a column resolves to the
  statement whose range contains it. The identity key becomes `[resource]:line[:column]`, so
  existing line breakpoints keep their keys and persisted projects stay valid. Line edits already
  shift breakpoints (`scrollBreakpoints`); edits within a line re-anchor column breakpoints to the
  statement that now starts nearest the old column, or drop the column if the statement is gone.
- Run to Cursor uses the statement under the cursor, not the line's first statement.

**Optimisation and statements on one line.** At levels 0 and 1 statement boundaries are barriers
(§7.1), so every statement keeps its own entry. At levels 2 and 3 the optimiser may merge code from
neighbouring statements; a statement that loses its own entry is marked `merged` in the debug info,
and stepping then stops at the first surviving entry. The status bar says "optimised: statements
merged" while paused in such code. The debug profile (§8.6) keeps level ≤ 1 by default, so this
only happens when the user asked for it.

**Classic-table fallback (§10.1, before the debugger changes land).** `listFileItems` and
`sourceMap` get one entry per statement, each with its columns, so breakpoints and highlighting
already work per statement when the program stops at a statement entry. Statement stepping itself
needs §10.2.

### 10.4 Partition-aware source mapping (fixes a general limitation)

A shared utility `locateSource(debugInfo, pc, partition)` replaces the `address === pc` matches in
`MonacoEditor.refreshCurrentBreakpoint` and `IdeEventsHandler.refreshCodeLocation`. For programs
without source-level info it falls back to today's behaviour. This matters for every banked
program, not only CODEBANK.

### 10.5 Execution point and breakpoints

- Highlight the **statement's column range** (`a = 1 : b = 2` highlights only the part about to
  run); multi-line statements highlight all their lines.
- Source breakpoints resolve to the **first statement starting on the line**, partition-qualified
  (the `resolvedPartition` path already exists); breakpoints with a column resolve to their own
  statement (§10.3).
- Run to cursor at statement level (reuses the session one-shot breakpoint from the NEX debugging
  work).

### 10.6 Symbolic call stack

The Call Stack panel shows the activation chain from the **frame locator** (§10.2.2) — the same
code stepping uses, so the panel and Step Out always agree. Each row: routine name (or "GOSUB 1000"
for a GOSUB subroutine), file, line and the statement's columns; for outer frames the calling
statement, with a marker at the call inside it. Recursive activations appear once per level.

Selecting a frame moves the editor there and switches the Variables panel to that frame's locals
(using the frame's IX for STDCALL routines). "Run to this frame" is in the row's context menu
(§10.2.5). Runtime frames above user code are collapsed into one "runtime" row that can be expanded
to raw return addresses.

### 10.7 Variables panel and typed watches

- A **Variables** panel with Locals (for the selected frame), Globals and Watch sections.
- Values are decoded by type: 8/16/32-bit signed and unsigned, Fixed 16.16, Float from the 5-byte
  format (the `float40` module is shared with the compiler), String by following the heap pointer
  (length + characters, shown with Spectrum character mapping and control codes escaped), Boolean.
- Arrays expand by dimension; large arrays page in chunks. String arrays expand to strings.
- Bank-local data is read **from its page**, not from whatever is currently mapped: the emulator's
  paged-memory read by partition is used, so values are right even when the bank is not paged in.
- Locals are shown only while the PC is inside their scope's statements; parameters of a FASTCALL
  routine only while `validUntil` holds.
- Editing a value writes memory (numbers only in the first version).

### 10.8 BASIC watch expressions

Watch entries accept a small BASIC expression language: variables, array elements with constant or
variable subscripts, `@var`, `PEEK(type, addr)`, arithmetic and comparisons. They are parsed with
the compiler's own expression parser and evaluated by a debugger-side evaluator over emulator
memory — no code is injected into the machine. The same evaluator later powers **conditional
breakpoints** ("stop at line 40 when `lives = 0`") and hit counts.

### 10.9 Data breakpoints on variables

"Break when this variable changes" on a Variables row creates a memory-write breakpoint over the
variable's bytes (existing `memoryWrite` breakpoints), partition-qualified for bank-local data.
For Strings, the breakpoint watches the pointer, with a note that in-place edits of the heap block
are not covered.

### 10.10 Runtime-error stops

The runtime raises BASIC errors (Out of memory, Subscript wrong, Number too big, BREAK …) through
one entry point (`errorEntry` in §8.4). An **exception breakpoint** option stops there and reports
the error name and the BASIC statement of the innermost user frame (§10.6), instead of letting the
ROM print a report and return to BASIC. Enabled by default in debug runs.

### 10.11 Mixed disassembly and program map

- The Disassembly panel shows BASIC source lines interleaved with the code of each statement and
  uses the compiler's symbols (`_name`, `core.X`) as labels.
- A **Program Map** view from the debug info: code, data, heap, stack and each CODEBANK page with
  its size and fill; heap usage from the heap's free list (read-only).

### 10.12 Just My Code

A setting (default on) that makes source stepping skip runtime and library code without debug info;
stepping into a stdlib `.bas` routine is allowed because stdlib files are compiled from source and
have statements.

---

## 11. Editor and language intelligence

1. **Background diagnostics** through the worker: lexer, parser and binder errors and warnings with
   exact column ranges. Klive's marker code currently ignores error columns
   (`MonacoEditor.tsx:337-470`); this plan changes it to use them when present.
2. **Language intelligence** for `zxbas`, reusing the `LanguageIntelData` payload that `kz80-asm`
   uses: hover (type, declaration, value of constants, doc summary for built-ins from the spec),
   go to definition and references (variables, routines, labels, `#define`s, across includes),
   document outline (routines, labels, CODEBANK blocks), completion (keywords, declared symbols in
   scope, stdlib routines of included files, header option names and values).
3. **Syntax colouring**: the Monarch grammar gains the header option lines, `CODEBANK`, `FARPTR`,
   and embeds `kz80-asm` (instead of `zxbasm`) inside `ASM` blocks.
4. **Templates**: `zxnext/zx-basic` (new), and the existing sp48/sp128 `zx-basic` templates get a
   header block showing the options.

---

## 12. Integration

### 12.1 Registration and coexistence (D9)

`KBasicCompiler` registers for language `zxbas`. A setting `zxbasic.compiler` = `klive` | `zxbc`
selects the implementation; `zxbc` keeps today's external integration. Default `zxbc` until the
compatibility milestone (end of Phase 4), `klive` after.

### 12.2 Output per target

- 48K/128K/+3: segments plus `entryAddress` and `modelType`, injected through the existing inject,
  run and debug flows; TAP/TZX export through the existing export dialog.
- Next: the generated program starts with `.model Next` and `.savenex` pragmas, so the existing
  NEX export and `.nexload` launch flow work unchanged.

### 12.3 Build performance

Foreground builds run in the main process, so the compiler yields to the event loop between stages
and per routine during code generation (as the assembler already does per 1000 lines). Budget: a
2,000-line program with the runtime closure builds in under a second at level 2 on a typical
laptop; background builds skip code generation entirely (front end only) unless the user enables
full background builds.

---

## 13. Testing

### 13.1 Unit and golden tests (`test/kbasic/`)

- Lexer, preprocessor, parser: one test file per construct family, built from the spec's EBNF;
  every EBNF form in `zxbasic-syntax.json` has at least one accepting and one rejecting case (a
  test asserts that coverage).
- Binder: every warning code and every error class in the spec.
- Optimiser: per-pass MIR before/after tests; per-rule LIR tests.
- Code generation goldens: small programs → LIR text; updated deliberately.

### 13.2 Execution tests

Programs are compiled and **run on Klive's own emulator**, on the real WASM cores:

- `test/harness/sp48/` (exists, R5) — the 48K with the real ROM, booted to BASIC. The default
  target for language, runtime and Float tests.
- `test/harness/zxnext/` — Next and Z80N code. Its `loadCode` does not page the 48K BASIC ROM or
  set up system variables (§2.6), so tests of ROM-using features on the Next need the
  **BASIC-ready mode** added in Phase 0 (§17.1, R4 follow-up); ROM-free tests (integer code, Z80N
  paths, CODEBANK) run as they are.

Each test program writes results to memory or the screen; the test reads them back. Levels 0–3
must produce the same results for every program (a matrix test).

### 13.3 ROM-exact floating point

The `float40` module is tested against the ROM calculator running in the emulator over a generated
set of operand pairs, including edge cases (small-integer form, overflow, underflow, rounding).

### 13.4 Behavioural comparison with upstream (D12)

`scripts/kbasic-oracle.cjs` (R9) compiles Klive's own corpus programs with a locally installed
`zxbc`, runs them on the 48K harness and commits only the **observed results**
(`test/kbasic/oracle/*.json`). The corpus runner compares Klive BASIC's behaviour with them. It
is a developer tool, not part of CI; upstream test programs are never copied into Klive — the
corpus is written for Klive.

### 13.5 Debugger tests

Stepping decisions (pure function, table-driven), statement locator, call-stack reconstruction
from recorded stacks, typed value decoding, watch-expression evaluation, CODEBANK far-frame
unwinding.

**Multi-statement lines** get their own set, run end to end on the emulator: every row of the
§10.3 table is a test that steps the compiled program and asserts the sequence of
`(line, startColumn, endColumn)` stops, at optimisation levels 0 and 1 (and at 2–3 asserting only
that every stop is a real statement entry). A **debug-info validator** runs on every compiled test
program and checks the §8.2 guarantees: one entry per statement, no internal branch to an entry,
column ranges inside the line and not overlapping, `:` and comments excluded from ranges.
Column-breakpoint tests cover key compatibility with existing line breakpoints and re-anchoring
after edits.

**Calls** get a scenario set run on the emulator, each asserting the exact stop sequence of Step
Into, Step Over and Step Out (and the returned value shown at return points): a SUB call; a
FUNCTION in an expression; two FUNCTIONs in one statement (`x = f(1) + g(2)`, including the
return-point stop between them); nested calls (`f(g(1))`); Step Into Target on each; recursion
(`Fact`), stepping over the recursive call and stepping out of an inner activation; `GOSUB`/
`RETURN` and `ON … GOSUB`; STDCALL with locals and FASTCALL; stepping over the last statement of a
SUB and over `END SUB`; a breakpoint inside a stepped-over callee; `USR` into machine code; a SUB
whose body is an `ASM` block; Just My Code on and off for a stdlib routine; an interrupt taken
mid-step with a BASIC IM2 handler; and, in Phase 6, the same set across CODEBANK banks. The frame
locator gets its own tests from recorded memory and register snapshots, including stray stack words
that equal a return address. The validator checks G4 (the SP at every statement entry of an
activation is identical) by running each test program under a tracing hook.

---

## 14. Phases

Each phase ends with tests green, `npm run build:check`, `npm run lint:renderer` where renderer
code changed, and a short status line at the top of this document.

| Phase | Content | Exit criterion |
| --- | --- | --- |
| **0 — Foundations** | Assembler: programmatic entry (§4.1), `.page` (§4.2), `#line` (§4.4). Runtime foundations (§6): module header format, `kbasic-runtime-index.cjs`, embedding (R7), prologue/`END`, ROM-call wrapper, heap, core string routines, text PRINT, 8/16-bit arithmetic; runtime-level tests on the 48K harness. `float40` with ROM-exact tests (§7.4). Next harness "BASIC-ready" mode (R4 follow-up, §17.1). | Foundation modules pass their runtime tests on the 48K harness (heap stress, string ownership, PRINT output, stack balance); `float40` matches the ROM on the test set. |
| **1 — Front end** | Header options (§5), lexer, preprocessor, parser, AST, background diagnostics in the editor, language-provider breakpoints flag. | The whole spec's syntax parses; diagnostics appear as you type. |
| **2 — Semantics** | Binder, types, constants, all W-codes and error classes, CODEBANK rules (no code generation yet). | Every spec'd warning and error has a test. |
| **3 — Core code generation** | MIR, level-0 code generator, emitter, runtime linking, debug-info builder with classic tables. Integers, Strings, PRINT and attributes, control flow, SUB/FUNCTION (both conventions), DIM/arrays, inline asm (Klive dialect), 48K target; the runtime modules these need (32-bit arithmetic, arrays, attributes, keyboard). Retire the walking-skeleton spike. | Core programs run on the 48K harness; breakpoints and execution point work in the IDE with no debugger changes (§10.1). |
| **4 — Full language** | Float and Fixed, DATA/READ/RESTORE, graphics, sound, I/O, tape, `ON GOTO/GOSUB`, all built-ins, `sinclair-compatible`, 128K/+3 — each with its runtime module. Standard library: the priority set of §6.4. Compatibility corpus. | The Klive test corpus passes; `zxbasic.compiler` default switches to `klive`. |
| **5 — Source-level debugger** | §10.2–§10.8, §10.10, §10.12: statement-granular stepping, Step Over Line and statement breakpoints (§10.3); step over/into/out across SUB, FUNCTION, GOSUB and recursion with return-point stops, Step Into Target, Run to Frame and returned values (§10.2); interrupt-depth signal in the cores (§10.2.7). | The §10.2 and §10.3 scenario tables pass as emulator tests; call stack, Variables panel and watches work on the corpus, 48K. |
| **6 — ZX Spectrum Next** | Z80N target, NEX output, Next template, CODEBANK (§9) with its debugger support (§10.6, §10.7 bank reads), NEX debug sidecar (§8.5). | CODEBANK scenario tests pass on the Next harness; banked code is debuggable at source level. |
| **7 — Optimiser** | Levels 1–3 (§7), debug profile (§8.6), optimisation/debug consistency tests. | All execution tests pass at every level; measurable size/speed gains on the corpus. |
| **8 — Polish** | Language intelligence (§11.2), data breakpoints (§10.9), conditional breakpoints, mixed disassembly and program map (§10.11), `asm-dialect zxbasm` with the runtime alias table, nextlib first (§6.5), NextBuild header compatibility (§5.4), the rest of the standard library (§6.4), docs site pages. | Feature-complete per this plan. |

Phases 5 and 6 can overlap once Phase 4's language work is past Float. Phase 7 is deliberately
late: optimisation is easier to trust once the debugger can show what it did.

---

## 15. Name

The name should be Klive's own and must not suggest that it is upstream's compiler (the language
stays "ZX BASIC", and docs say "compatible with Boriel ZX BASIC").

| Name | CLI / code prefix | Rationale |
| --- | --- | --- |
| **Kestrel** | `kestrel`, `kes` | A small, fast falcon; K for Klive; distinctive, easy to search, no clash in the Spectrum scene. |
| **Klive BASIC** | `kbasic`, `kbc` | Plain and obvious; the name says where it lives. |
| **Zebra** | `zebra`, `zb` | "ZX Enhanced BASIC for Retro Architectures"; memorable, and the Z of ZX. |
| **Kiln** | `kiln` | Where things are fired and hardened; short, fits a compiler. |
| **Quill** | `quill`, `ql` | A writing tool for a writing-era machine; gentle, but taken by an old Spectrum adventure-writing tool, so less distinctive. |

**Chosen: Klive BASIC** (2026-09-26). The other candidates are kept here only as a record.

---

## 16. Risks

| Risk | Mitigation |
| --- | --- |
| Writing the runtime from scratch is a large amount of Z80 work (heap, strings, PRINT, arrays, Fixed, graphics, sound). | The ROM keeps the hardest part (Float maths, Float ↔ text); modules are built in the phase that first needs them (§14), each with runtime-level tests on the 48K harness; the stdlib follows a priority list (§6.4). |
| Behavioural differences from upstream in corner cases (number formatting, heap exhaustion, PRINT edge cases). | The semantics annex (R8) decides each behaviour explicitly; the behavioural oracle (R9, if approved) finds the differences; the docs list the ones kept on purpose. |
| The zxbasm-dialect converter meets constructs that do not map cleanly (D10). | Fail loudly per construct; extend the assembler only for genuinely general features. D10 is Phase 8 and does not block the core. |
| ROM-exact Float folding is harder than expected. | Fold only what is proven exact; everything else runs at run time. Correctness first. |
| Source stepping per instruction slows the Next debug loop. | Constant-time locator; only active in source modes; measured in the existing Next WASM performance tests. |
| Optimised code confuses the debugger. | Debug profile (§8.6), statement-id discipline (§7.5), `-2` shared-code handling. |
| Library compatibility (nextlib and friends are zxbasm-dialect asm). | `asm-dialect zxbasm` (§6.5); NextBuild header aliases (§5.4). |
| Accidental reuse of upstream compiler code. | §0.1; the spec is the only reference; code review checks provenance; no upstream compiler files anywhere in the repository. |
| Main-process builds block the UI. | Stage-level yielding and the §12.3 budget, checked in a perf test. |

---

## 17. Readiness — resolving what blocks execution

First reviewed 2026-09-26 after D1–D11 were settled; the Phase 0 blockers were resolved the same
day (§17.1). Items are numbered R1–R18 for reference from other documents. Tick them off here as
they are done.

### 17.1 Phase 0 blockers — resolved

| # | Item | How it was resolved | Evidence | Follow-up |
| --- | --- | --- | --- | --- |
| R1 | **Persist the research** (runtime ABI, CODEBANK contract, integration map, library API) that existed only in a session scratchpad. | Written in Klive's words into `.ai/kbasic/`: `runtime-abi.md` (interfaces, with a "Klive BASIC:" decision per section), `codebank-contract.md`, `klive-integration-map.md`, `stdlib-api.json` (46 libraries, 67 documented routines from the CC BY docs), `README.md` (provenance rule). `.ai/README.md` and `AGENTS.md` point to them (R15). | The files. | Keep current as decisions change (the folder README says how). |
| R2 | ~~Spike: convert and assemble upstream runtime modules.~~ | **Superseded** by revising D2: Klive BASIC writes its own runtime, so nothing is converted. The question it asked — can runtime code in Klive's dialect be linked, called and debugged — is answered by R3. | R3's test. | The zxbasm converter for user libraries (D10) gets its own spike in Phase 8. |
| R3 | **Walking skeleton**: BASIC to a running 48K program that stops at BASIC breakpoints. | A throw-away pipeline (`test/kbasic/skeleton/walking-skeleton.ts`) splits `PRINT "…"` statements with exact columns (colons in strings and trailing comments handled), generates Klive assembly with every line tagged by statement id, appends a Klive-written runtime module (`.module core`), assembles with Klive's assembler, and builds the classic debug tables by joining list items with the tags. | `test/kbasic/walking-skeleton.test.ts` (3 tests, passing): the program prints `Hello`/`World`/`A:B`/`Done` on a real 48K; a **line** breakpoint resolved exactly as `refreshSourceCodeBreakpoints` does stops at the line's first statement with the IDE's execution-point columns `0..13`; a **statement** breakpoint stops at the second statement of the same line (`16..29`) with only `Hello` printed; SP is identical at both statement entries (G4) and equals the baseline the prologue stored. | The IDE-level check (clicking a gutter breakpoint in the running app) becomes part of Phase 3's exit criterion, where the compiler is registered. Retire the spike in Phase 3. |
| R4 | **ROM mapping facts.** | Read from the harness and loader code. **(a)** The Next harness's `loadCode` leaves slots 0–1 on whatever ROM hard reset selected, with no system variables and interrupts off. **(b)** A real `.nexload` hands over with NextZXOS's 48K BASIC ROM paged in (the direct loader lists this as a difference from `.nexload`). | `test/harness/zxnext/core/load-nex-direct.ts`, `script/session.ts`; recorded in `.ai/kbasic/klive-integration-map.md` §7 and §2.6 here. | Consequences taken into the design: the ROM policy (§6.3: ROM only for Float, Float ↔ text, tape, error reports, through wrappers that page ROM 3 in) and the **Next harness BASIC-ready mode**, steps below. |
| R5 | **48K/128K execution harness.** | `test/harness/sp48/` built on the pattern of the Next harness: real ROM, `bootToBasic()` to `$12AC`, `loadCode` (Klive assembler, returns the full output with list items), `call`/`runTo`/`step`, breakpoints through the emulator's own `DebugSupport` (`attachDebugSupport`, `callToBreakpoint`, `continueToBreakpoint`), `peek`/`poke`, `screenChar`/`screenLine` against the ROM font. README with the API table. | `test/harness/sp48/self-tests/session.test.ts` (4 tests, passing): boot (IY, RAMTOP), load-call-return, ROM-printed text read back, two breakpoints in sequence. | A 128K variant (`createSp128Session`, paging helpers) when Phase 4 adds the 128K target. |

**Steps for the Next harness BASIC-ready mode** (R4 follow-up, part of Phase 0):

1. Add `createSession({ basic: true })` (or `session.prepareBasic()`) to `test/harness/zxnext/`:
   select ROM 3 in slots 0–1 through the machine's own ports (the same `$7FFD`/`$1FFD` bits the
   ROM paging uses) and install a 48K-style system-variable area and calculator workspace in bank 5,
   taken from a snapshot of the 48K harness after `bootToBasic()` (both are the same 48K BASIC
   layout).
2. Self-test: the ROM calculator adds two Floats and `PR-STRING` prints, exactly as on the 48K
   harness — one assertion that fails if the mode silently did nothing.
3. Document the approximation (NextZXOS sets more state than this) in the harness README's "Direct
   load" differences, next to the existing list.
4. Keep the faithful route available for the rare test that needs it: booting NextZXOS from a
   cloned CIM in node already works ad hoc (harness README, "Candidates"); it needs an SD image on
   the developer's machine, so it stays out of CI.

### 17.2 Blocking a later phase — resolution plans

| # | Item | Needed by | Steps | Done when |
| --- | --- | --- | --- | --- |
| R6 | **Debug-info transport to the emulator.** Stepping decisions run in the emulator process; debug info is produced in the main process. | Phase 5 (first use in Phase 3 for the classic tables, which already travel) | 1. Define the payload `SourceDebugPayload = {version, programHash, info}` in `src/common/abstractions/SourceDebugInfo.ts` (JSON only). 2. Encode the big tables compactly: `addressToStatement` and per-partition maps as run-length pairs in a `Uint32Array`, sent as base64. 3. Add `emuApi.setSourceDebugInfo(payload \| null)` → `MainToEmuProcessor` → `MachineController`, stored with its version. 4. Send it after every foreground compile that produced source-level info, and clear it when the machine type changes or another build root is compiled. 5. Build the statement locator (§10.2.1) lazily in the emulator process on first use; drop it when the payload changes. 6. Guard: a step started under one version and finished under another ends as a plain stop, never a wrong one. | A round-trip test (payload → decode → locator answers); a size-budget test: a generated 5,000-statement program's payload stays under 300 KB; a stale-version test. |
| R7 | **Packaging of the runtime and standard library.** **Done 2026-09-26** (Phase 0): as below; the bundle is `src/main/kbasic/runtime/generated/runtime-bundle.ts`, `npm run kbasic:runtime` regenerates it, `build:check` runs the staleness check. The worker-side check waits for the compiler (Phase 1). | Phase 0 | 1. Runtime sources as `src/main/kbasic/runtime/*.kz80.asm` (editor highlighting for free), stdlib as `src/main/kbasic/stdlib/*.bas`. 2. `scripts/kbasic-runtime-index.cjs` reads the module headers and writes `src/main/kbasic/runtime/generated/runtime-bundle.ts` exporting the index and the text of every module and library file. 3. The compiler imports the bundle: no file I/O, identical in the main process, the worker and tests. 4. `npm run build:check` fails when the bundle is stale (the script runs in check mode and compares), the same ratchet style as the type baseline. | The compiler links a module in the worker and in the main process from the bundle; the staleness check fails on an edited-but-not-regenerated module. |
| R8 | **Semantics annex to the spec.** The spec records syntax; behaviour is partly open. | Phases 2–4 | 1. Add a `semantics` section to `.ai/zxbasic-syntax/zxbasic-syntax.json` (and to its contract test): one entry per question, with `decision`, `source` (`docs`, `oracle`, `klive-decision`) and `test` (the corpus test that pins it). 2. Seed it with the known questions: operand and argument evaluation order; integer overflow and wrap-around per type; integer division by zero; `MOD` sign; `FOR` (limit and step evaluated once or per iteration, the variable's value after the loop, negative and zero `STEP`, wrap-around of the loop variable's type); `PRINT` number formatting for every type and Fixed; `STR` and `VAL` edge cases; `INPUT` behaviour; string comparison of different lengths; heap exhaustion with and without memory checking; `RND` sequence after `RANDOMIZE n`; `READ` past the end; `ON … GOTO` out of range; the spec's "unverified" items (precedence under the 1.19 parser, `#elif`, multi-line strings, the \`` escape). Phase 0's runtime already chose, provisionally, for these (each stated in its module's header, to be confirmed or changed here): integer division by zero gives an all-ones quotient and the dividend as remainder; the remainder takes the dividend's sign; PRINT starts from BASIC's print position (S_POSN) and scrolls all 24 rows without a "scroll?" prompt; codes 165-255 print from the UDG area; INK 9 / PAPER 9 stop with "K Invalid colour"; a String concatenation longer than 65535 characters gives the empty String. 3. Resolve each before the phase that implements it (Phase 2: front-end questions; Phase 4: runtime questions). | Every seeded question has a decision and a test; the contract test fails on an entry without them. |
| R9 | **A behavioural oracle.** Settling R8 honestly needs observed behaviour. | Phases 2–4 | **Decided: yes (D12). Step 1 done 2026-09-26:** upstream `zxbc` 1.19.0 (commit `b8d3cd7`, matching the pinned spec) is installed at `~/zxbasic` (outside the repository) in its own Python 3.14 virtual environment, with no changes to the machine's other Python installs; `~/zxbasic/.venv/bin/zxbc` is verified working (compiled and ran a test program). See `.ai/kbasic/README.md` for the exact setup. **Remaining:** 2. Write `scripts/kbasic-oracle.cjs`, reading the install path from `KBASIC_ORACLE_ZXBC` (default `~/zxbasic/.venv/bin/zxbc`): for each corpus program (or the ones named on the command line), compile with `zxbc` to a `.bin` at `$8000` using the options mapped from the program's header (§5.3), load it on the 48K harness, run it with the same expectations runner as the corpus (R10), and write the **observed results** to `test/kbasic/oracle/<program>.json` (screen rows, peeked values, error report, `zxbc` version). 3. The corpus runner compares Klive BASIC's results with the oracle file when one exists and reports differences; a difference is either a Klive bug or a deliberate deviation recorded in R8 with `source: "klive-decision"`. 4. Guard rails: the script refuses to run in CI (`CI` set), never writes anything but the results JSON, and the results never contain generated code. | The script exists, oracle results are committed for the Phase 3 corpus, and at least the R8 questions tagged `oracle` are settled through it. |
| R10 | **The test corpus**, written from scratch (upstream's tests are AGPL). | Phase 3 onward | 1. Layout `test/kbasic/corpus/<area>/<name>.zxbas`, each with expectation lines in its header comment block (a test-only `'@expect` option family: `'@expect screen 0 "Hello"`, `'@expect peek $9000 42`, `'@expect error 2`). 2. One runner test that compiles every program at every optimisation level and checks the expectations on the 48K harness (Next-only programs on the Next harness). 3. Targets: Phase 3 — 60 programs (integers, strings, PRINT, control flow, SUB/FUNCTION, arrays); Phase 4 — +90 (Float, Fixed, DATA, graphics, sound, built-ins, stdlib); Phase 6 — the CODEBANK scenarios of `.ai/kbasic/codebank-contract.md` §6; plus three larger programs (a game loop, a text adventure, a banked program). 4. Every R8 decision points at a corpus program. | The runner exists and the Phase 3 target is met at the end of Phase 3. |
| R11 | **Stage design notes.** | Phase 3 (MIR, LIR, allocation, strings, debug builder); Phase 7 (optimiser) | Before coding each stage, write a short design note in `.docs/` (the implementation-pattern docs folder): `kbasic-mir.md` (instruction set, types, SSA form, statement-id rules), `kbasic-lir-regalloc.md` (instruction objects, register classes, allocation, spill slots, the level-0 stack scheme), `kbasic-string-ownership.md` (temporaries, free points, by-value parameters, returned strings — the part most likely to leak), `kbasic-debug-builder.md` (joining list items and tags, the §8.2 guarantees and their validator). Each note is reviewed by the project author before its code starts. | The four notes exist and are approved before Phase 3 coding. |
| R12 | **UI within Klive's rules.** | Phase 5 | 1. Read `.ai/ui-theming-intent-and-lessons.md` first. 2. Build the Variables panel, return-value rows, the Source/Z80 toggle, inline statement-breakpoint markers and the Program Map on the data-panel primitives (`@renderer/controls/data`: `DataPanel`, `DataRow`, `HexValue`, …) and theme tokens; no colour literals, no `em` font sizes, `ch` column widths, row heights from `rowSizes.ts` (the M1–M3 tests). 3. Verify geometry in the running app (the CDP recipe in the theming file), not in a replica. 4. Update the theming file with the durable rules the work teaches, in the same change. | The panels pass the mandate tests and the theming file records the new rules. |
| R13 | **Settings and templates.** | Phases 3–6 | 1. `zxbasic.compiler` (`klive` \| `zxbc`) in the settings UI and `zxb-config.ts`; the dispatcher registered under `zxbas` (D9). 2. `zxbas` language provider: `supportsBreakpoints: true`, `instantSyntaxCheck: true`, `ASM` blocks embed `kz80-asm`. 3. Templates: header option blocks in `sp48/zx-basic` and `sp128/zx-basic`; a new `zxnext/zx-basic` (Phase 6). 4. The docs site page for ZX BASIC (`docs/content/working-with-ide/zxb.mdx`) gains a Klive BASIC section. | A new ZX BASIC project on each machine builds and debugs with Klive BASIC by default after Phase 4. |

### 17.3 Before the first release

| # | Item | State |
| --- | --- | --- |
| R14 | ~~Ask the upstream author to confirm the runtime licence.~~ | **Dropped** (2026-09-26): no longer needed, because Klive BASIC uses no upstream runtime code (D2 revised). |
| R15 | Point `AGENTS.md` and `.ai/README.md` at this plan, `.ai/kbasic/` and the provenance rule (§0.1). | **Done** 2026-09-26. |
| R16 | Schedule the upstream check (`node scripts/zxbasic-syntax-check.cjs`); on a new release, refresh the spec, then review `.ai/kbasic/runtime-abi.md` and `stdlib-api.json` for interface changes the runtime must follow. | Open; can be a scheduled task. |
| R17 | First releasable milestone: Phases 0–5 on the 48K/128K targets (full language, source debugging, optimisation up to level 1); then Next and CODEBANK; then the optimiser. | Proposed. |
| R18 | User documentation on the docs site: header options, differences from upstream (Klive-dialect inline asm, dropped options, behaviours decided in R8), debugging BASIC. | Open (Phase 8). |

## 18. References

- `.ai/kbasic/` — runtime ABI (interfaces the Klive runtime keeps), CODEBANK contract, Klive
  integration map, documented standard-library API.
- `test/harness/sp48/` — the 48K execution harness; `test/kbasic/walking-skeleton.test.ts` — the
  Phase 0 spike (§17.1, R3).
- `.ai/zxbasic-syntax/` — the language specification, upstream fingerprint and refresh procedure.
- `.docs/nextbuild-studio-features.md` — NextBuild Studio feature inventory, including CODEBANK
  background (§6.1) and the CSpect conventions (§17.1).
- `src/common/abstractions/CompilerInfo.ts:620-805` — the source-level debug model adopted here.
- `git show 1d9f2856d:plan.md` — the earlier (deleted) source-level debugging plan whose stepping
  design §10.2 refines.
- `.plans/NEX_DEBUGGING_PLAN.md` — partition model (8K pages), one-shot session breakpoints, NEX
  launch.
- `test/harness/zxnext/README.md` — the execution-test harness.

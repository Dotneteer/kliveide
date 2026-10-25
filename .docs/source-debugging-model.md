# The source-level debugging model

Klive debugs every compiled language at source level through one model and one engine
(`.plans/SHARED_Z80_BACKEND_PLAN.md` Part B). The core knows machine and calling-convention facts only;
language specifics are data from the producer or a small plugin.

```
Producers: the shared Z80 back end (Klive BASIC, any MIR language), Boriel BASIC's .dbg adapter,
           z88dk's map/CDB adapter
   |  SourceLevelDebugInfo, model version 2 (@abstractions/CompilerInfo, SourceDebugInfo)
   v
Engine        src/emu/machines/SourceStepDecision.ts   stepping, frame locator, stop tracker
Presentation  src/renderer/appIde/debugger/source/     variables, values, call stack, watches
   ^
   |  by SourceLevelDebugInfo.language
Plugins       src/renderer/appIde/debugger/languages/   basic, c (registry.ts is the only importer)
```

## 1. The model (version 2)

| Concept | What it says |
| --- | --- |
| statements, callables | source ranges and the code each covers (address maps, per partition for banked code) |
| frames (`CallableFrameInfo`) | how to find an activation: `frame` (IX or a memory frame pointer), `entrypoint`, `fastcall` (frameless); `returns`: a result's representation, type name and registers (`a`, `hl`, `dehl`, `aedcb`) |
| call sites | every user `call`: `routine` (gets an activation) or `local` (runs in the caller's activation: BASIC's GOSUB), `dispatch`, `returnsValue` |
| activations | `entry`, `routine`, `local` |
| variables | name, `displayName` (as written), **representation** (`type`), the language's type name (`typeLabel`), location (absolute, frame offset, constant), arrays (`descriptor` or `inline` layout) |
| `errorStop` | the routine a program's run-time errors go through, where the code is (a register or a byte) and how it is named (`zx-rom` reports or the producer's own texts) |
| `codebank` | the bank window and the far-call runtime, with its record layout as data (`records`) |
| `labels`, `libraryFiles`, `runtimeSymbols` | named code addresses (local activations are named by them), Just My Code, runtime rows |

**Representations** are byte layouts, never language types: `i8`…`u32`, `bool` (`bool/ff` stores
true as 255), `char8`, `ptr16`, `fix16.16`, `float40`, `str.heap` (pointer to `[length][chars]`),
`str.c` (pointer to NUL-terminated chars), `str.short:N` (inline length byte, capacity N). A
representation without a decoder shows as hex bytes; a plugin may register decoders for its own.

**Compatibility:** the NEX debug sidecar's format version is the model version; a version-1 sidecar is
upgraded as it is read (`src/common/utils/source-debug-upgrade.ts`), and the same upgrade reads zxbc's
`.dbg` vocabulary.

## 2. What a producer guarantees

The guarantees of Klive BASIC's plan (`.plans/ZXBASIC_COMPILER_PLAN.md` §10.2) hold for every
producer: the same SP at every statement entry of an activation (G4), every user call a recorded
call site (G5), results in their registers at the `ret` (G6), and statement entries the debugger can
stop at (G1). The engine relies on them; the shared back end keeps them for every MIR language.

## 3. Language plugins

`DebugLanguageSupport` (`debugger/source/language-support.ts`): `parseWatch` into the neutral watch AST
(`watch-ast.ts`) with its built-ins, `formatValue`, `constantTypeLabel`, `arrayTypeLabel`,
`elementName`, `localActivationLabel`, `caseInsensitiveNames`, extra `decoders`. The watch AST states
every meaning that differs between languages — division (`real`, `trunc`, `floor`, `c`), remainder
(`trunc`, `floor`, `magnitude`), shifts, truth values, string `+` — and one evaluator implements them
all. Without a plugin the debugger works with neutral wording and no watch expressions.

## 4. Tests

- `test/debugger/producer-goldens.test.ts`: every producer's output, in full.
- `test/debugger/source-debug-upgrade.test.ts`: version-1 data of every producer upgrades to what it
  writes now.
- `test/debugger/language-support.test.ts`: representations, plugins, watches in each language.
- The engine and panels: `test/emu/debug-step-decision.test.ts`, the Klive BASIC `source-*` tests, the
  Boriel and z88dk debugger tests, `test/z80-backend/minilang/mini-run.test.ts` (a language with no
  plugin).
- `test/architecture/boundaries.test.ts`: the core imports no language or producer and names no
  language construct.

# Klive BASIC: the debug-info builder

Design note R11-4 of `.plans/ZXBASIC_COMPILER_PLAN.md` (§8, §10.1–§10.3, §13.5). **Status: draft,
awaiting the project author's approval. No Phase 3 code before that.**

The builder runs after assembly. It turns "which generated line belongs to which statement" plus
the assembler's addresses into the debug information the IDE reads: the **classic tables** that
make breakpoints and the execution point work with no debugger changes (Phase 3's exit criterion,
plan §10.1), the **source-level tables** (`SourceLevelDebugInfo`, `CompilerInfo.ts`), and the Klive
BASIC **extensions** (plan §8.4) that Phase 5's stepping needs. It also runs the **validator** that
checks the code generator kept the plan's guarantees G1–G6.

The approach is the one the walking skeleton proved (plan §17.1, R3,
`test/kbasic/skeleton/walking-skeleton.ts`): tag every generated line with a statement id, assemble,
join the list items with the tags.

## 1. Inputs

| Input | From | Content |
| --- | --- | --- |
| statement table | lowering (MIR note §4) | per sid: file, span, kind, function, and flags (`hoisted`, `merged` at levels ≥ 2) |
| line table | the emitter (LIR note §7) | per line of `<name>.kbasic.asm`: sid, and a call-site record or a frame marker (`prologue.end`, `epilogue.begin`, `ret`) when the line has one |
| function table | lowering | per function: name, kind, convention, header and `END` lines, its sids, its frame layout (slot → IX offset) |
| symbol table | the binder (`semantics/symbols.ts`) | variables, arrays, constants, with storage and bank (Phase 5) |
| assembler output | `compileProgram` | `listFileItems` (file index, line, address, length, segment), `symbols`, `segments` (with `bankOffset` and page for banked code) |

## 2. The statement table

Sids are assigned by lowering in source order, so the table's order is source order. Each entry is:

```ts
type StatementEntry = {
  sid: number;
  fileIndex: number;        // into the BASIC file list (§5)
  startLine: number; startColumn: number;   // 1-based line, 0-based column
  endLine: number; endColumn: number;       // end exclusive
  kind: StatementKind;      // CompilerInfo's: "assignment" | "call" | "if" | "loop" | ...
  functionIndex: number;
};
```

The span is the statement's own text (plan §8.2): no `:` separators, no trailing comments, the
whole span of a multi-line statement. Positions are the **reported** positions, after `#line`
(`SourceFile.location`), the same as diagnostics use (question D2). Code from a macro expansion
belongs to the statement that contains the macro use; the parser's spans already point there.

Things that are not statements get no sid and never appear in the tables: labels, line numbers,
`DATA`, `DECLARE`, `DIM`/`CONST` without run-time code, comments, empty statements.

## 3. Joining addresses to statements

For every list item of the generated file, `sid = lineTable[item.lineNumber - 1].sid`. Items of the
runtime modules and of lines with sid `-1` are glue; `-2` is shared code.

- A statement's **runs** are the maximal address ranges covered by consecutive list items with its
  sid. At levels 0–1 every statement has exactly one run (checked, §7).
- **Entry** (`startAddress`): the start of the run that begins with the statement's `stmt` marker
  line — the first code byte after the marker. **`endAddress`**: one past the end of that run.
  Further runs (levels ≥ 2) go to the `statementRanges` extension.
- A statement with no code (an **elided** statement, MIR note S5) gets `startAddress = endAddress =`
  the address of the next code byte after its marker, and the extension flag `elided`.
- Partitions: the partition of a banked segment is derived from its page exactly as
  `src/common/utils/source-breakpoint-partition.ts` does for source breakpoints, so the builder
  and the breakpoint resolver can never disagree.

## 4. The source-level tables

`SourceLevelDebugInfo` (`CompilerInfo.ts`, used as it is, plan §8.1):

| Field | Built from |
| --- | --- |
| `language` | `"basic"` |
| `files` | the BASIC files (§5) |
| `statements` | the statement table with addresses, **sorted by `startAddress`** (the type requires it), `callableIndex` from the function table, `callTargets` from the call-site records of the statement's lines |
| `callables` | one per function: `kind` `entrypoint` / `subroutine` / `function`; `entryAddress` = the first address after `prologue.end` (the existing type defines it as the first body instruction, after the frame setup — question D1); `exitAddresses` = every `ret` line of the function; `firstStatementIndex`/`lastStatementIndex` over the sorted statements (a function's code is contiguous, so its statements are a contiguous index range) |
| `usesBanking`, `partitionedAddressMap` | from the partitions (§3) |
| `addressToStatement` | every code byte of the program and runtime, as `[address, statementIndex]` range starts; runtime and glue `-1`, shared `-2` |

The extensions (plan §8.4, type `KBasicDebugExtensions` in the new
`src/common/abstractions/SourceDebugInfo.ts`):

| Field | Built from | Phase |
| --- | --- | --- |
| `callSites` | each line with a call-site record: `returnAddress` = its address + length | 3 (the validator needs it for G5) |
| `frames` | per function: `convention`, `bodyStart` (`prologue.end`), `epilogueStart` (`epilogue.begin`), `returnSlotOffset` from the frame layout (STDCALL: locals size + 2; FASTCALL: 0), `returnType`; the call address itself is the function's `_name` symbol | 3 |
| `mainBaselineSymbol` | the address of `core.ProgramSP` | 3 |
| `statementRanges`, `elided` and `merged` flags | §3 | 3 (levels ≥ 2 from Phase 7) |
| `runtimeSymbols` | the `core.*` symbols | 3 |
| `errorEntry` | `core.RaiseError` | 3 |
| `variables` | the symbol table and frame layouts: globals by address, locals and parameters by IX offset | 5 |
| `codebank` | the far-call runtime's symbols and the bank manifest | 6 |
| `optimizationLevel` | the options | 3 |

## 5. The classic tables (Phase 3's exit criterion)

The IDE's existing breakpoint and execution-point code (`refreshSourceCodeBreakpoints`,
`MonacoEditor.refreshCurrentBreakpoint`, `IdeEventsHandler.refreshCodeLocation`) reads these, so
filling them correctly is all Phase 3 needs for breakpoints to work:

- `sourceFileList`: the BASIC files only, in the statement table's file order. The generated file
  and the runtime modules are **not** listed, so the IDE never shows generated assembly when it
  looks for a source position. (`'@emit-asm` writes the generated file for users who want it.)
- `listFileItems`: **one item per statement**: `fileIndex`, `lineNumber` = the statement's start
  line, `address` = its entry, `codeLength` = its first run's length, `segmentIndex`. Breakpoint
  resolution takes the first item of a line, so a line breakpoint stops at the line's first
  statement (plan §10.3).
- `sourceMap`: entry address → `{fileIndex, line, startColumn, endColumn}`, so the execution point
  highlights the statement's own columns.

## 6. Where the builder sits

```
lowering ─ statement table, function table ─┐
emitter  ─ line table ──────────────────────┤
assembler ─ list items, symbols, segments ──┴─► builder ─► classic tables
                                                         ├─► SourceLevelDebugInfo + extensions
                                                         └─► validator (tests, debug builds)
```

A pure function: `buildDebugInfo(inputs) → { classic, sourceLevel, extensions, problems }`. Everything
it returns is JSON-serialisable (it crosses the worker boundary and IPC, plan §2.1).

## 7. The validator

Run on every compiled test program, and in the compiler's debug builds. Checks:

| Check | Plan | How |
| --- | --- | --- |
| G1 — one entry per statement | §8.2 | every sid ≥ 0 has exactly one `stmt` marker and, at levels 0–1, exactly one run |
| G2 — no branch into the middle of a statement | §8.2 | every `jp`/`jr`/`djnz`/`call` target (from the LIR, resolved to addresses) that lies inside statement S's range and comes from outside S is S's entry |
| G3 — elided statements are marked | §8.2 | a sid with no code has `elided` |
| G4 — the same SP at every statement entry of an activation | §10.2.2 | **dynamic**: the test harness runs the program with a tracing hook that records SP at each entry address, grouped by activation (call-site returns), and compares |
| G5 — every user call is a recorded call site | §10.2.2 | every `call` to a `_name` symbol, the GOSUB and ON GOSUB dispatch and every far-call trampoline has a call-site record |
| G6 — results in the ABI registers at `ret` | §10.2.2 | dynamic: at each FUNCTION `ret` under the tracing hook, the ABI registers hold the value the test expects |
| spans | §8.2 | column ranges inside their line, not overlapping on one line, excluding `:` and comments |
| sorted and complete | §8.1 | `statements` sorted by address; `addressToStatement` covers every code byte exactly once |

Static checks (G1–G3, G5, spans, sorting) report `problems`; a test fails on any. The dynamic
checks (G4, G6) belong to the harness-based tests of plan §13.5.

## 8. Tests

- Builder unit tests on hand-made inputs: runs, elided statements, partitions, sorting, the
  classic tables.
- End to end on the 48K harness (Phase 3's exit criterion): a program with several statements per
  line; a **line** breakpoint resolved exactly as `refreshSourceCodeBreakpoints` does stops at the
  line's first statement with the right columns; a program stopped at each statement shows the
  statement's own column range. The walking-skeleton test already does this for its toy language;
  it is retired when these pass (plan R3).
- The validator on every corpus program at every level.

## 9. Decisions for the author

| # | Question | Proposal |
| --- | --- | --- |
| D1 | `CallableDebugInfo.entryAddress`: the call target or the first body instruction? | The existing type says "after any prologue", so it is `bodyStart`; the call target (the `_name` label) is in the `frames` extension. The two differ only for STDCALL routines. |
| D2 | Positions before or after `#line`? | After (the reported positions, as diagnostics use). A `#line` that names a file the IDE cannot open leaves breakpoints unresolvable in it, which is what `#line` asks for. |
| D3 | `sourceFileList` without the generated assembly | Yes: the IDE then never navigates to generated code. The disassembly view and `runtimeSymbols` cover runtime code. |
| D4 | Phase 3 fills `callSites`, `frames` and the flags even though only Phase 5 reads them | Yes: they cost almost nothing at emission time, and the validator needs `callSites` for G5. `variables` waits for Phase 5. |

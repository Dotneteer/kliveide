# Source-level debug information for Boriel BASIC — a proposal

A summary of the debug information Klive BASIC emits, and a suggestion for how Boriel BASIC
(`zxbc`) could emit the same format. Written to be sent to Boriel; Klive-internal readers should
treat it as an outbound proposal, not a design note.

- Klive side: `src/common/abstractions/CompilerInfo.ts` (`SourceLevelDebugInfo`),
  `src/common/abstractions/SourceDebugInfo.ts` (`SourceDebugExtensions`),
  `src/common/utils/source-debug-sidecar.ts`, `.docs/kbasic-debug-builder.md`.
- Boriel side: `boriel-basic/zxbasic` v1.19.0, commit `ac9081d` (2026-09-24). Paths below are
  relative to that repository. They locate where a change would go; no upstream code is copied
  here, and nothing in this document was used to design Klive (provenance rule,
  `.plans/ZXBASIC_COMPILER_PLAN.md` §0).

## 1. Why one shared format

A source debugger needs four answers that a binary and a label map cannot give:

1. Which statement owns each code address, and where each statement starts.
2. Which routine is running, and how to find every activation on the stack (recursion included).
3. Where each variable lives — absolute address, IX-frame offset, or constant — and its type.
4. Which memory page holds banked code and data.

Klive BASIC answers them in one language-neutral JSON object. Klive BASIC's runtime is
ABI-compatible with Boriel BASIC (types, sizes, string and array layouts, STDCALL/FASTCALL), so
the variable and frame records describe Boriel programs without change. If `zxbc` wrote the same
file, Klive — and any other tool that adopts the format — could step Boriel BASIC programs at
statement level, show the call stack and show variables.

## 2. The format at a glance

One JSON object, `SourceLevelDebugInfo`. Everything is plain JSON (no maps, no classes).

| Field | Content |
| --- | --- |
| `language` | Optional tag, e.g. `"basic"` |
| `files` | Source files `{index, filename}`; `index` is the `fileIndex` used everywhere else |
| `statements` | Every statement, ascending by `startAddress` |
| `callables` | Every SUB, FUNCTION and the main program |
| `addressToStatement` | Sorted `[address, statementIndex]` pairs; each covers up to the next pair; `-1` = runtime/glue |
| `usesBanking`, `partitionedAddressMap` | The same map per memory page, for banked code |
| `extensions` | Frames, call sites, variables, runtime symbols, banking state |

For a standalone binary it is wrapped in a sidecar written beside it:

```json
{
  "format": "klive-source-debug",
  "version": 1,
  "nexLength": 23456,
  "nexChecksum": 2166136261,
  "sourceLevelDebug": { "files": [], "statements": [], "callables": [] }
}
```

The checksum is 32-bit FNV-1a over the binary. A reader ignores a sidecar whose length or checksum
does not match (another build's tables stop in the wrong places), and refuses a newer `version`.
For Boriel the key names would generalise to `binaryLength` / `binaryChecksum` (see §5).

### 2.1 Statements

The statement, not the line, is the unit of stepping: `10 PRINT a: PRINT b` is two statements, and
a breakpoint can sit on the second.

| Field | Meaning |
| --- | --- |
| `index` | Position in the array |
| `fileIndex`, `startLine`, `startColumn`, `endLine`, `endColumn` | Lines 1-based, columns 0-based, end exclusive; no `:` separators, no trailing comments |
| `startAddress`, `endAddress` | The single entry byte, and one past the last byte |
| `partition` | Memory page (RAM ≥ 0, ROM < 0); absent when unbanked |
| `kind` | `assignment`, `call`, `if`, `loop`, `switch`, `return`, `jump`, `compound`, `declaration`, `asm`, `other` |
| `callableIndex`, `callTargets` | Owning routine; user routines this statement calls |

Labels, line numbers, `DATA`, `DECLARE`, comments and `DIM` without run-time code are not
statements and are never stops.

### 2.2 Callables, frames and call sites

- `callables`: `name`, `kind` (`entrypoint`, `subroutine`, `function`), source span,
  `entryAddress`, `exitAddresses`, `partition`, first/last statement index.
- `extensions.frames`, one per callable: `convention` (`frame` = IX frame, `entrypoint` = main),
  `returnSlotOffset` (bytes from the baseline SP to the return address), `argBytes`,
  `startAddress` / `bodyStart` / `epilogueStart` / `endAddress` (where IX is valid), `returnType`,
  `library`.
- `extensions.callSites`, one per user `call`: `returnAddress` (the address after the `call`),
  `statementIndex`, `callerIndex`, `calleeIndex`, `kind` (`sub`, `function`, `gosub`, `on-gosub`,
  `far`), `moreCallsFollow`, `order`. `moreCallsFollow` lets `x = f(1) + g(2)` stop between the
  two calls and show `f`'s result.
- `extensions.mainBaselineSymbol`: address of the word where the main program's prologue stores
  its starting SP. `labels`, `runtimeSymbols` and `errorEntry` name addresses for the call stack,
  the disassembly and stopping on a runtime error.

### 2.3 Variables

`extensions.variables`: `name`, `displayName` (with sigil), `type` (`byte`, `ubyte`, `integer`,
`uinteger`, `long`, `ulong`, `fixed`, `float`, `string`, `boolean`), `kind` (`global`, `local`,
`parameter`, `constant`), `location` (`{at:"absolute", address}`, `{at:"frame", ixOffset}` —
the first byte of the value relative to IX — or `{at:"constant", value}`), `byRef`, `array`
(`elementType`, declared `dimensions`; `location` is the descriptor), `scope` (`"global"` or
`{callableIndex}`), `declaredAt`, `bank`.

### 2.4 Banking

Every address-bearing record carries an optional `partition`. `extensions.codebank` describes
Klive BASIC's far-call runtime (window, far call/return entries, current-bank byte, a shadow stack
of `{previous bank, return address}` records, each bank's 8K pages). Boriel BASIC has no banked
code today, so this layer can be ignored.

### 2.5 Code-generation guarantees

The tables are only trustworthy if the generated code keeps six rules. Klive BASIC checks them
with a validator on every test program, and checks G4 at run time.

| # | Guarantee | What breaks without it |
| --- | --- | --- |
| G1 | Each statement has exactly one entry address, reached only by entering the statement | Breakpoints fire mid-statement or never |
| G2 | No branch inside a statement targets its own entry (loops jump to the entry of the statement they restart) | Phantom stops |
| G3 | A statement with no code has `startAddress = endAddress` and is marked elided | Stops in the wrong statement |
| G4 | SP is the same at every statement entry of one activation | The frame locator cannot find return slots |
| G5 | Every user call is one Z80 `call` recorded in `callSites` | Step Over/Out and the call stack lose their place |
| G6 | A FUNCTION's result is in its ABI registers when `ret` executes | Return values cannot be shown |

## 3. Where Boriel BASIC stands today

| Need | What `zxbc` has now | Where |
| --- | --- | --- |
| Address → label | `-M/--mmap FILE`: sorted `HHHH: label` lines for global address labels | `src/zxbc/zxbc.py` (writer after assembly); `Memory.memory_map` in `src/zxbasm/memory.py` |
| Line numbers in the binary | Numbered BASIC lines become `.LABEL._<n>` labels, so they appear in the map; unnumbered lines leave no trace | `src/symbols/id_/ref/labelref.py`; `visit_LABEL` in `src/arch/z80/visitor/translator.py` |
| A per-line hook | `--enable-break` inserts a `CHKBREAK(lineno)` after each program line, calling a runtime break check with the line number | `make_break` in `src/zxbc/zxbparser.py`; `visit_CHKBREAK` in `translator.py` |
| File/line through preprocessing | `zxbpp` emits `#line N "file"`; both lexers honour it | `src/zxbpp/`; `src/zxbc/zxblex.py`; `src/zxbasm/asmlex.py` |
| Statements | Colon-separated statements are separate `SENTENCE` nodes inside a `BLOCK`, each with line and file | `make_sentence` and the `co_statements` rules in `zxbparser.py`; `src/symbols/sentence.py` |
| Columns | The lexer computes a column per token, but the parser's rule metadata keeps only the line, and `SENTENCE` stores none | `find_column` in `zxblex.py`; `LarkParserWrapper` / `MockMeta` in `zxbparser.py` |
| Line info in IR | None: quads carry an instruction and arguments only | `src/arch/interface/quad.py` |
| Address ↔ asm line | The assembler keeps the `Asm` objects at each address with their (generated-asm) line number, but writes no listing | `Memory.orgs` in `src/zxbasm/memory.py`; `src/zxbasm/asm.py` |
| Debug output | `-d` logs every assembled instruction and label to stderr; no machine-readable debug file | `src/api/debug.py`; `add_instruction` / `declare_label` in `memory.py` |

So Boriel BASIC already has most of the raw material: per-statement AST nodes, file/line on each,
column numbers in the lexer, final addresses in the assembler. What is missing is a thread that
carries a statement identity from the AST through the quads and the optimisers to an address.

## 4. Suggested adoption path, in Boriel BASIC's terms

Each step unlocks a debugger feature on its own, so the work can land in pieces.

### Step 0 — usable today with no compiler change

A debugger can read `--mmap` and treat each `.LABEL._<n>` as the start of line `n`, the `_name`
labels as global variables, and function labels as routine starts. This gives line breakpoints for
numbered programs only, no statement granularity and no locals. Useful as a fallback, not as the
target.

### Step 1 — statements and the address map

1. **Keep the column.** Carry the start/end position of each statement's first and last token into
   `SENTENCE` (the lexer already computes columns; the Lark wrapper currently drops them).
2. **Number the statements.** Give each `SENTENCE` a statement id in source order when the parser
   builds it.
3. **Emit a marker per statement.** In the translator's block walk
   (`visit_BLOCK`, `src/arch/z80/visitor/translator_visitor.py`), emit a marker quad before each
   statement's code. The backend turns it into a non-temporary label, e.g. `.__STMT_<id>`, which
   the assembler then resolves to the statement's entry address. Function bodies are emitted after
   the main program (`src/arch/z80/visitor/function_translator.py`); the markers travel with them.
4. **Make the marker survive optimisation.** This is the delicate part:
   - The peephole pass (`_output_join`, `src/arch/z80/backend/main.py`, patterns in
     `src/arch/z80/peephole/opts/`) slides across quad boundaries, and therefore across lines.
   - At `-O3` the flow optimiser (`src/arch/z80/optimizer/main.py`) threads jumps and merges or
     removes blocks.
   - The marker should be a label that both optimisers treat as a block boundary that cannot be
     removed or moved past. That costs little at `-O0`–`-O2`. At `-O3` it limits some merges; Klive
     BASIC accepts the same trade-off, and at its higher levels marks merged statements rather
     than guaranteeing G1. The existing `#pragma opt` pass-through and the `##ASMn` inline-asm
     placeholders show that non-code annotations can already cross the backend.
5. **Write the file after assembly.** Next to the `--mmap` writer in `src/zxbc/zxbc.py`, add an
   option such as `--debug-info FILE`. From `asmparse.MEMORY` it reads each `.__STMT_<id>` label's
   address. A statement's range runs to the next marker or to a non-statement label (epilogue,
   runtime), and runtime library ranges map to `-1`. Delete the marker labels from `--mmap` output
   if they clutter it.

`--enable-break`'s `CHKBREAK` is a precedent: a per-line node built in the parser and carried to
the backend. The marker is the same idea, emitted per statement and producing no code.

### Step 2 — callables

Each FUNCTION/SUB already has a fixed shape (`FunctionTranslator.visit_FUNCTION`):

- an entry label;
- the prologue (`_enter`, `src/arch/z80/backend/generic.py`);
- the body;
- a `<name>__leave` label;
- string and array frees;
- the epilogue (`_leave`).

Every `RETURN` jumps to `__leave`, so each routine has a single exit. The record needs:

- `startAddress`: the entry label.
- `bodyStart`: a marker after `_enter`.
- `epilogueStart`: the `__leave` label.
- `exitAddresses`: the epilogue's final `ret`.
- `endAddress`: a label after it.

The main program's start is `.core.__MAIN_PROGRAM__`.

### Step 3 — frames and call sites

- **STDCALL** builds exactly the IX frame the format's `frame` convention describes:
  - The prologue pushes IX, loads IX from SP and reserves the locals.
  - The return address is at IX+2, parameters start at IX+4, and locals sit at negative offsets.
  - The callee removes the arguments, so `argBytes` is the parameter list's total size.
  - `returnSlotOffset` is the locals' size + 2, provided G4 holds.
- **FASTCALL** has no frame and no locals; the return address is at SP+0 at every statement
  entry. The format needs a third `convention` value for it (proposed: `"fastcall"`,
  `returnSlotOffset: 0`).
- **Main baseline.** The prologue (`emit_prologue`, `backend/main.py`) already stores the starting
  SP in `.core.__CALL_BACK__`. That label's address is `mainBaselineSymbol`, unchanged.
- **Call sites.**
  - SUB/FUNCTION calls are plain `call`s.
  - `GOSUB` compiles to a plain `call` (`translator.py`), so G5 holds for it.
  - `ON … GOSUB` calls a runtime dispatcher that jumps to the target and leaves the original
    return address on the stack. Its call site is therefore the `call` of the dispatcher, recorded
    with kind `on-gosub` and no callee.
  - The translator knows the callee at each call. A label right after each `call` gives
    `returnAddress`.
- **To verify: G4.** Arguments and expression temporaries are pushed and popped within a
  statement. Whether *any* construct (e.g. `FOR` state, string temporaries) leaves bytes on the
  stack across a statement boundary needs checking. Klive's validator checks this by tracing SP at
  every statement entry; the same check can run on Boriel's test programs once markers exist.
- **Return values (G6).** These already match the format's types: A (8-bit), HL (16-bit, String),
  DE:HL (32-bit, Fixed), A plus BC/DE for Float.
  - The `return` code loads the result before jumping to `__leave`.
  - The epilogue must not disturb it.
  - Confirm this for the string/array free calls that run between `__leave` and `ret`.

### Step 4 — variables

The information is all in the symbol table; it only needs writing out.

- **Globals:**
  - Each global is an `_name` label between `.core.ZXBASIC_USER_DATA` and its end label (emitted
    by `src/arch/z80/visitor/var_translator.py`).
  - Its location is `{at:"absolute", address}` of that label.
  - Its type comes from the symbol entry.
- **Parameters:**
  - The offset comes from `SymbolPARAMLIST.append_child` (`src/symbols/paramlist.py`).
  - The access rule in `src/arch/z80/backend/_pload.py` gives `ixOffset` = 4 + offset, +1 for an
    8-bit or Float value: bytes are pushed as a word with the value in the high byte, and Float is
    padded to 6.
  - BYREF parameters get `byRef: true`.
- **Locals:**
  - The offset comes from `SymbolTable.compute_offsets` (`src/api/symboltable/symboltable.py`).
  - `ixOffset` = −offset.
- **Arrays:**
  - The descriptor at the array label is four words: dimension table, data, lower-bound table,
    upper-bound table.
  - The format already assumes this layout, so `location` is the descriptor and `dimensions`
    are the declared bounds.
- **Strings:** a 2-byte pointer to a heap block holding a 2-byte length followed by the
  characters. This is also the layout the format assumes.

### Step 5 — banking

Not needed now. If Boriel BASIC later places code in pages (e.g. for the Next), the `partition`
fields and `partitionedAddressMap` cover it, and `codebank` can describe whatever far-call scheme
it uses.

## 5. Open points to agree with Boriel

- **Format name.** Keep `klive-source-debug` or rename to a neutral name for a shared spec. The
  sidecar's `nexLength`/`nexChecksum` should become `binaryLength`/`binaryChecksum`, since
  `zxbc` writes TAP, TZX, SNA, Z80 and raw binaries, not NEX.
- **`fastcall` convention.** Add it to the frame record (§4, step 3).
- **Optimisation contract.** Agree what each `-O` level promises: Klive BASIC guarantees G1–G2 at
  levels 0–1 and marks merged statements above that.
- **Where statements start in `IF … THEN … ELSE` on one line, `FOR`/`NEXT`, and `DO`/`LOOP`.**
  These decide where loop back-edges jump (G2). The Klive BASIC plan's §10.3 table lists the
  stops Klive produces for each construct, and could be shared as a test list.

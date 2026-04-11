# Source-Code-Level Debugging — Implementation Plan

## 1. Problem Statement

Klive IDE currently supports debugging at the **Z80 instruction level**. For Z80 Assembly, this works perfectly because each source line maps to exactly one Z80 instruction. The existing `sourceMap` (address → `FileLine`) and `listFileItems` provide a 1:1 mapping.

High-level languages compiled to Z80 (PASTA-80/Pascal, C, BASIC, …) break this assumption:

- A single source line may contain **multiple statements** (e.g., `a := 1; b := 2;`).
- A single statement may **span multiple source lines** (e.g., a multi-line `if` expression).
- A single statement compiles to **many Z80 instructions** (dozens or hundreds).
- User-defined subroutines/functions differ from raw Z80 `CALL` instructions — they involve stack-frame setup, parameter passing, and cleanup code spanning many Z80 instructions.

The IDE must support **two independent stepping modes**:

1. **Binary (Z80) stepping** — unchanged from today; steps one Z80 instruction at a time.
2. **Source-code-level stepping** — steps one source *statement* at a time, understanding call/return boundaries.

---

## 2. Current Architecture (Summary)

### 2.1 Debug Information Types

| Type | Location | Purpose |
|------|----------|---------|
| `sourceMap` | `Record<number, FileLine>` | Maps Z80 address → source file + line |
| `listFileItems` | `ListFileItem[]` | Per-address list of file index, address, line number |
| `sourceFileList` | `SourceFileItem[]` | Ordered list of source files involved |

```typescript
// src/common/abstractions/CompilerInfo.ts

export type FileLine = {
  fileIndex: number;  // index into sourceFileList
  line: number;       // 1-based line number
  startColumn?: number;
  endColumn?: number;
};

export type ListFileItem = {
  fileIndex: number;
  address: number;    // Z80 address of the first byte for this line
  lineNumber: number; // 1-based line number
  segmentIndex?: number;
  codeStartIndex?: number;
  codeLength?: number;
  sourceText?: string;
  isMacroInvocation?: boolean;
};

// SourceFileItem (used inside CompilerOutput)
type SourceFileItem = {
  readonly filename: string;
  parent?: SourceFileItem;
  readonly includes: SourceFileItem[];
};

// DebuggableOutput — the minimum for source-aware debugging
export type DebuggableOutput = InjectableOutput & {
  readonly sourceFileList: ISourceFileItem[];
  readonly sourceMap: Record<number, FileLine>;
  readonly listFileItems: ListFileItem[];
  // --- new (see §3) ---
  readonly sourceLevelDebug?: SourceLevelDebugInfo;
};
```

### 2.2 Stepping Implementation

- **`DebugStepMode`** enum: `NoDebug`, `StopAtBreakpoint`, `StepInto`, `StepOver`, `StepOut`
- **`MachineFrameRunner.checkBreakpoints()`** — runs after each Z80 instruction, decides whether to pause.
  - `StepInto`: stops after 1 Z80 instruction.
  - `StepOver`: if current instruction is CALL-like, sets `imminentBreakpoint` at the return address and runs until it's hit; otherwise acts like StepInto.
  - `StepOut`: runs until `stepOutAddress` (top of the Z80 call stack) is reached.
- **`MachineController`** — exposes `stepInto()`, `stepOver()`, `stepOut()` methods.
- **`Toolbar.tsx`** — sends `stepInto`/`stepOver`/`stepOut` commands.

### 2.3 Current PASTA-80 Debug Output

The `Pasta80Compiler` currently parses an `.sld` JSON file with this structure:

```json
{
  "files": ["main.pas", "utils.pas"],
  "statements": [
    { "address": 32768, "file": 0, "line": 5, "column": 1 }
  ]
}
```

This is fed into the same `sourceMap`/`listFileItems` that Z80 Assembly uses. It provides basic "address → line" mapping but **no statement-level granularity**, **no call-graph information**, and **no address-range information**.

### 2.4 Breakpoint Resolution

`refreshSourceCodeBreakpoints()` in `breakpoints.ts` resolves source breakpoints:

1. Finds the `fileIndex` in `sourceFileList` by matching filename.
2. Finds the matching `listFileItem` by `fileIndex` + `lineNumber`.
3. Uses the item's `address` as the resolved breakpoint address.

### 2.5 Execution Point Highlighting

`IdeEventsHandler.refreshCodeLocation()`:

1. Gets current PC from emulator.
2. Looks up `sourceMap[pc]` to get `FileLine`.
3. Navigates the editor to that file and line.

`MonacoEditor.refreshCurrentBreakpoint()`:

1. Finds `listFileItem` matching current file + PC address.
2. Creates a highlight decoration at that line number.

---

## 3. New Debug Information: `SourceLevelDebugInfo`

### 3.1 Overview

We introduce a new optional field `sourceLevelDebug` on `DebuggableOutput` that any high-level language compiler (PASTA-80, a C compiler, a BASIC compiler, …) can populate alongside the existing `sourceMap`/`listFileItems`. The existing fields remain for backward compatibility and binary-level debugging. The new structure adds **statement-level** granularity in a **language-agnostic** way.

All types are defined in `src/common/abstractions/CompilerInfo.ts`.

### 3.2 Type Definitions

```typescript
// -----------------------------------------------------------------------
// Language-agnostic statement kind.
// Compilers use "other" for constructs not explicitly listed.
// -----------------------------------------------------------------------
export type StatementKind =
  | "assignment"   // variable = expr  /  x := expr  /  LET x = expr
  | "call"         // standalone subroutine / procedure call
  | "if"           // conditional branch
  | "loop"         // while, for, repeat-until, do-while, NEXT, WEND, …
  | "switch"       // case-of, switch-case, ON-GOTO, …
  | "return"       // return, exit, function-result assignment
  | "jump"         // goto, break, continue
  | "compound"     // begin..end, { }, block
  | "declaration"  // variable / constant declaration with an initialiser
  | "asm"          // inline assembly block
  | "other";

// -----------------------------------------------------------------------
// Language-agnostic callable kind.
// -----------------------------------------------------------------------
export type CallableKind =
  | "entrypoint"   // main program body / module initialisation
  | "subroutine"   // procedure, void function, SUB — no return value
  | "function"     // function returning a value
  | "method"       // OOP instance or class method
  | "constructor"  // OOP constructor
  | "destructor"   // OOP destructor
  | "lambda";      // anonymous function / closure

// -----------------------------------------------------------------------
// Source file entry.
// -----------------------------------------------------------------------
export type SourceFileEntry = {
  /** Position in the files array — used as a fileIndex key everywhere else. */
  readonly index: number;
  /** Absolute path to the source file. */
  readonly filename: string;
};

// -----------------------------------------------------------------------
// Single source-level statement — the atomic unit of source-level stepping.
// -----------------------------------------------------------------------
export type StatementDebugInfo = {
  /** Unique index (position in SourceLevelDebugInfo.statements). */
  readonly index: number;
  /** Source file index. */
  readonly fileIndex: number;
  /** 1-based line where the statement starts. */
  readonly startLine: number;
  /** 0-based column where the statement starts (inclusive). */
  readonly startColumn: number;
  /** 1-based line where the statement ends. */
  readonly endLine: number;
  /** 0-based column where the statement ends (exclusive). */
  readonly endColumn: number;
  /** Z80 address of the first machine-code byte for this statement. */
  readonly startAddress: number;
  /** Z80 address one past the last machine-code byte for this statement. */
  readonly endAddress: number;
  /**
   * Memory partition (bank) where this statement's code resides.
   * Uses the same numbering as getPartition(): negative = ROM pages,
   * non-negative = RAM banks. Absent = flat / unbanked address space.
   */
  readonly partition?: number;
  /**
   * Indices (into SourceLevelDebugInfo.callables) of user-defined callables
   * invoked by this statement. Absent/empty = no user-defined calls.
   * Built-in / runtime calls are not tracked here.
   */
  readonly callTargets?: readonly number[];
  /** Semantic kind of the statement. */
  readonly kind: StatementKind;
  /** Index of the callable that contains this statement. */
  readonly callableIndex: number;
};

// -----------------------------------------------------------------------
// Callable unit: subroutine, function, method, or entry point.
// -----------------------------------------------------------------------
export type CallableDebugInfo = {
  /** Unique index (position in SourceLevelDebugInfo.callables). */
  readonly index: number;
  /** Display name shown in the call stack (e.g. "main", "Factorial"). */
  readonly name: string;
  /** Kind of callable. */
  readonly kind: CallableKind;
  /** Source file index where this callable is defined. */
  readonly fileIndex: number;
  /** 1-based line of the callable's declaration / header. */
  readonly startLine: number;
  /** 1-based line of the callable's closing delimiter. */
  readonly endLine: number;
  /**
   * Z80 address of the callable's entry point (first instruction of the
   * body, after any prologue / stack-frame setup).
   */
  readonly entryAddress: number;
  /**
   * Z80 addresses of every instruction that exits this callable
   * (RET, JP to a shared epilogue, etc.). Used by source-level Step-Out.
   */
  readonly exitAddresses: readonly number[];
  /**
   * Memory partition (bank) where this callable's code resides.
   * Same numbering convention as StatementDebugInfo.partition.
   * Absent = flat / unbanked address space.
   */
  readonly partition?: number;
  /** Index of the first statement in this callable's body. */
  readonly firstStatementIndex: number;
  /** Index of the last statement in this callable's body (inclusive). */
  readonly lastStatementIndex: number;
  /**
   * Index of the enclosing callable for nested routines.
   * Absent for top-level callables and the entry point.
   */
  readonly parentCallableIndex?: number;
};

// -----------------------------------------------------------------------
// Top-level container — language-agnostic, JSON-serialisable.
// -----------------------------------------------------------------------
export type SourceLevelDebugInfo = {
  /**
   * Optional source-language identifier (e.g. "pascal", "c", "basic").
   * Used for language-specific UI hints; not required for core debugging.
   */
  readonly language?: string;
  /** Ordered list of source files; each entry's index is its fileIndex. */
  readonly files: SourceFileEntry[];
  /** All statements in ascending startAddress order. */
  readonly statements: StatementDebugInfo[];
  /** All callable units (subroutines, functions, the entry point, etc.). */
  readonly callables: CallableDebugInfo[];
  /**
   * When false or absent, the code is in a flat 64 KB address space;
   * addressToStatement is the authoritative lookup.
   * When true, the code spans multiple memory banks / pages;
   * use partitionedAddressMap for lookups instead.
   */
  readonly usesBanking?: boolean;
  /**
   * Flat address-range → statement-index map (non-banked code).
   * Array of [address, statementIndex] pairs in ascending address order.
   * Each pair covers the range [address, nextPair.address).
   * statementIndex = -1 means runtime/glue code with no source statement.
   * Ignored when usesBanking is true.
   */
  readonly addressToStatement: ReadonlyArray<[number, number]>;
  /**
   * Partition-qualified address-range → statement-index map (banked code).
   * Present and authoritative when usesBanking is true.
   * Each entry covers one memory bank / partition.
   * partition uses getPartition() numbering: negative = ROM, ≥0 = RAM bank.
   * Within each entry the addressToStatement array is sorted and follows
   * the same -1 sentinel convention as the flat variant.
   */
  readonly partitionedAddressMap?: ReadonlyArray<{
    readonly partition: number;
    readonly addressToStatement: ReadonlyArray<[number, number]>;
  }>;
};
```

### 3.3 JSON Example

#### Pascal Source (`demo.pas`)

```pascal
program Demo;

var
  x, y: integer;

function Double(n: integer): integer;
begin
  Double := n * 2;
end;

begin
  x := 10;
  y := Double(x);
  if y > 15 then
    writeln('Big')
  else
    writeln('Small');
end.
```

#### Debug Info JSON (produced by PASTA-80)

```json
{
  "files": [
    { "index": 0, "filename": "/home/user/project/demo.pas" }
  ],

  "statements": [
    {
      "index": 0,
      "fileIndex": 0,
      "startLine": 8,
      "startColumn": 2,
      "endLine": 8,
      "endColumn": 18,
      "startAddress": 32800,
      "endAddress": 32810,
      "kind": "assignment",
      "callableIndex": 1,
      "comment": "Double := n * 2"
    },
    {
      "index": 1,
      "fileIndex": 0,
      "startLine": 12,
      "startColumn": 2,
      "endLine": 12,
      "endColumn": 10,
      "startAddress": 32820,
      "endAddress": 32826,
      "kind": "assignment",
      "callableIndex": 0,
      "comment": "x := 10"
    },
    {
      "index": 2,
      "fileIndex": 0,
      "startLine": 13,
      "startColumn": 2,
      "endLine": 13,
      "endColumn": 19,
      "startAddress": 32826,
      "endAddress": 32842,
      "callTargets": [1],
      "kind": "assignment",
      "callableIndex": 0,
      "comment": "y := Double(x)"
    },
    {
      "index": 3,
      "fileIndex": 0,
      "startLine": 14,
      "startColumn": 2,
      "endLine": 14,
      "endColumn": 15,
      "startAddress": 32842,
      "endAddress": 32852,
      "kind": "if",
      "callableIndex": 0,
      "comment": "if y > 15 then"
    },
    {
      "index": 4,
      "fileIndex": 0,
      "startLine": 15,
      "startColumn": 4,
      "endLine": 15,
      "endColumn": 19,
      "startAddress": 32852,
      "endAddress": 32870,
      "kind": "call",
      "callableIndex": 0,
      "comment": "writeln('Big')"
    },
    {
      "index": 5,
      "fileIndex": 0,
      "startLine": 17,
      "startColumn": 4,
      "endLine": 17,
      "endColumn": 21,
      "startAddress": 32870,
      "endAddress": 32890,
      "kind": "call",
      "callableIndex": 0,
      "comment": "writeln('Small')"
    }
  ],

  "callables": [
    {
      "index": 0,
      "name": "Demo",
      "kind": "entrypoint",
      "fileIndex": 0,
      "startLine": 11,
      "endLine": 18,
      "entryAddress": 32820,
      "exitAddresses": [32895],
      "firstStatementIndex": 1,
      "lastStatementIndex": 5
    },
    {
      "index": 1,
      "name": "Double",
      "kind": "function",
      "fileIndex": 0,
      "startLine": 6,
      "endLine": 9,
      "entryAddress": 32800,
      "exitAddresses": [32815],
      "firstStatementIndex": 0,
      "lastStatementIndex": 0,
      "parentCallableIndex": 0
    }
  ],

  "addressToStatement": [
    [32800, 0],
    [32810, -1],
    [32820, 1],
    [32826, 2],
    [32842, 3],
    [32852, 4],
    [32870, 5],
    [32890, -1]
  ]
}
```

> **Note:** `addressToStatement` value of `-1` means "this address range belongs to compiler-generated runtime/glue code (stack setup, cleanup, etc.) with no corresponding source statement." When the PC is in such a range during source-level stepping, the debugger continues running rather than stopping.

#### Example with banking (PASTA-80 on ZX Spectrum 128K, `--ovr`)

When `usesBanking: true`, `addressToStatement` is replaced by `partitionedAddressMap`. Each entry covers one RAM bank. Partition values match what Klive's `getPartition()` returns at runtime (0–7 for the paged-in RAM bank at `$C000`):

```json
{
  "language": "pascal",
  "usesBanking": true,
  "files": [ { "index": 0, "filename": "/project/main.pas" } ],
  "statements": [
    { "index": 0, "fileIndex": 0, "startLine": 12, "startColumn": 2,
      "endLine": 12, "endColumn": 10, "startAddress": 32768, "endAddress": 32774,
      "partition": 0, "kind": "assignment", "callableIndex": 0 },
    { "index": 1, "fileIndex": 0, "startLine": 20, "startColumn": 2,
      "endLine": 20, "endColumn": 15, "startAddress": 49152, "endAddress": 49170,
      "partition": 3, "kind": "call", "callTargets": [1], "callableIndex": 0 }
  ],
  "callables": [
    { "index": 0, "name": "Main", "kind": "entrypoint", "fileIndex": 0,
      "startLine": 11, "endLine": 30, "entryAddress": 32768, "partition": 0,
      "exitAddresses": [32900], "firstStatementIndex": 0, "lastStatementIndex": 1 },
    { "index": 1, "name": "Overlay1", "kind": "subroutine", "fileIndex": 0,
      "startLine": 40, "endLine": 55, "entryAddress": 49152, "partition": 3,
      "exitAddresses": [49300], "firstStatementIndex": 2, "lastStatementIndex": 5 }
  ],
  "addressToStatement": [],
  "partitionedAddressMap": [
    {
      "partition": 0,
      "addressToStatement": [ [32768, 0], [32774, -1] ]
    },
    {
      "partition": 3,
      "addressToStatement": [ [49152, 1], [49170, -1] ]
    }
  ]
}
```

> `partition` values correspond to Klive's `getPartition()` return values: 0–7 are RAM banks paged into the `$C000–$FFFF` window on a ZX Spectrum 128K.

### 3.4 Multi-Statement Lines and Multi-Line Statements

#### Multiple statements on one line (Pascal example)

```pascal
begin a := 1; b := 2; c := 3; end;
```

Produces **three** separate `StatementDebugInfo` entries (`kind: "assignment"`), all with `startLine: N` but differing `startColumn`/`endColumn`. During source-level Step-Into, the debugger stops at each statement individually and the editor highlights the precise column range.

Equivalent C:
```c
{ a = 1; b = 2; c = 3; }
```
Produces the same structure — the language in the JSON is `"c"` but the shape of the data is identical.

#### One statement spanning multiple lines (Pascal example)

```pascal
if (x > 0) and
   (y > 0) then
  writeln('Both positive');
```

The `if` check is one `StatementDebugInfo` (`kind: "if"`) with `startLine: N, endLine: N+1`. The `writeln` is a separate statement. Step-Into on the `if` highlights lines N through N+1.

---

## 4. Integration into Existing Types

### 4.1 Extending `DebuggableOutput`

Add an optional field to `DebuggableOutput`:

```typescript
export type DebuggableOutput = InjectableOutput & {
  // ... existing fields ...

  /**
   * Optional source-level debug info for high-level language compilers.
   * When present, the IDE enables source-level stepping.
   */
  readonly sourceLevelDebug?: SourceLevelDebugInfo;
};
```

The existing `sourceMap` and `listFileItems` fields remain and continue to be populated (they are still used for binary-level debugging, breakpoint gutter markers, and other features). The `sourceLevelDebug` is an **additive** extension.

### 4.2 Detecting Source-Level Debug Availability

Add a helper function:

```typescript
export function hasSourceLevelDebug(output: KliveCompilerOutput): output is DebuggableOutput & {
  sourceLevelDebug: SourceLevelDebugInfo;
} {
  return (
    isDebuggableCompilerOutput(output) &&
    !!(output as DebuggableOutput).sourceLevelDebug
  );
}
```

---

## 5. Stepping Modes: Binary vs. Source

### 5.1 New `DebugStepMode` Values

Extend the existing enum:

```typescript
export enum DebugStepMode {
  NoDebug = 0,
  StopAtBreakpoint,

  // --- Z80-level (existing, unchanged) ---
  StepInto,
  StepOver,
  StepOut,

  // --- Source-level (new) ---
  SourceStepInto,    // Run until PC enters a different statement
  SourceStepOver,    // Run until PC enters a different statement,
                     //   but skip over user-callable calls
  SourceStepOut      // Run until current callable returns
}
```

### 5.2 How Source-Level Stepping Works

The key difference: instead of counting Z80 instructions, the debugger compares **statement indices**.

Before executing, it records:
- `currentStatementIndex` — looked up from `addressToStatement` for the current PC.
- `currentCallableIndex` — from `statements[currentStatementIndex].callableIndex`.

#### Source Step-Into

**Goal:** Stop when the PC enters a *different* statement.

```
Algorithm:
1. Record currentStatementIndex from addressToStatement[PC].
2. Run Z80 instructions.
3. After each Z80 instruction, look up newStatementIndex from addressToStatement[PC].
4. If newStatementIndex !== currentStatementIndex AND newStatementIndex !== -1:
   → STOP.
5. If newStatementIndex === -1 (runtime code), continue running.
```

**Example flow** — stepping through `y := Double(x)` (statement 2):

```
PC=32826 → statement 2 (y := Double(x))    ← current statement
  ... executes parameter-push Z80 instructions ...
PC=32832 → statement 2                     ← still same statement, continue
  ... executes CALL to Double ...
PC=32800 → statement 0 (Double := n * 2)   ← different statement! STOP.
```

The user sees: stepped from `y := Double(x)` **into** the `Double` function body.

#### Source Step-Over

**Goal:** Stop when the PC enters a different statement *at the same or higher callable level* (i.e., skip calls into user-defined procedures/functions).

```
Algorithm:
1. Record currentStatementIndex and currentCallableIndex.
2. If statements[currentStatementIndex].callTargets is non-empty:
   a. Compute "returnStatementIndex" — the statement whose startAddress is
      immediately after the current statement's endAddress.
   b. Set imminentBreakpoint addresses = [statements[returnStatementIndex].startAddress].
   c. Also set breakpoints at all standard breakpoint addresses (user BPs).
   d. Run until PC hits an imminent breakpoint OR a user breakpoint.
3. If no callTargets (simple statement):
   → Behave like Source Step-Into.
```

**Example flow** — stepping over `y := Double(x)` (statement 2):

```
PC=32826 → statement 2 (y := Double(x))    ← current statement
  Step-Over detects callTargets = [1] (Double function)
  Sets imminent breakpoint at statement 3's startAddress = 32842
  RUN ...
  ... executes push params, CALL Double, Double body, RET, pop result ...
PC=32842 → statement 3 (if y > 15 then)    ← STOP.
```

The user sees: jumped from `y := Double(x)` directly to `if y > 15 then`.

#### Source Step-Out

**Goal:** Return from the current callable and stop at the first statement after the call site.

```
Algorithm:
1. Record currentCallableIndex.
2. Look up callables[currentCallableIndex].exitAddresses.
3. Set imminent breakpoints at all exitAddresses BUT the actual stop
   condition is: PC enters a statement whose callableIndex !== currentCallableIndex
   AND the Z80 stack depth is back to the caller's level.
4. In practice (simpler approach): use the existing Z80 stepOutStack mechanism
   to find the return address, then keep running until the PC lands on a
   statement with index !== -1 (i.e., a real Pascal statement, not runtime glue).
```

**Example flow** — Step-Out inside `Double` (callable 1):

```
PC=32800 → statement 0 (Double := n * 2)   ← inside Double
  Step-Out: use Z80's markStepOutAddress() to get return address ≈ 32836.
  RUN until Z80 step-out fires (PC reaches return address in caller).
PC=32836 → addressToStatement → statement 2 (still inside y := Double(x))
  BUT: the Z80 Step-Out has already returned.
  Continue running until PC reaches a new statement.
PC=32842 → statement 3 (if y > 15 then)    ← STOP.
```

The user sees: returned from `Double` and stopped at `if y > 15 then`.

### 5.3 Toolbar Integration

The toolbar currently has three buttons: Step Into, Step Over, Step Out. Two approaches:

**Recommended approach — Mode Toggle:**

Add a toggle button or dropdown in the toolbar: **"Z80" / "Source"**. The state is stored in the app state as `debugSteppingLevel: "z80" | "source"`.

- When **Z80** is selected, Step Into/Over/Out behave as today (unchanged).
- When **Source** is selected, Step Into/Over/Out send `sourceStepInto`/`sourceStepOver`/`sourceStepOut` commands.
- The toggle is only enabled when `sourceLevelDebug` is available. If not, it is forced to "Z80" and greyed out.

For Z80 Assembly projects, the toggle is hidden (or locked to "Z80").

---

## 6. Breakpoints

### 6.1 Source-Level Breakpoint Resolution

Currently `refreshSourceCodeBreakpoints()` resolves a breakpoint (file + line) to a Z80 address using `listFileItems`. With source-level debug info available, the resolution should prefer `sourceLevelDebug.statements`:

```
Algorithm:
1. Find all statements where fileIndex matches and startLine <= bp.line <= endLine.
2. Pick the statement with the smallest startAddress (first statement that covers this line).
3. Resolve bp.address = statement.startAddress.
```

This ensures that when a breakpoint is set on a line that has multiple statements, the emulator stops at the **first** statement on that line.

### 6.2 Conditional and Multi-Statement Line Breakpoints

For lines with multiple statements (`a := 1; b := 2;`), the initial implementation resolves to the first statement. A future enhancement could allow column-level breakpoints.

---

## 7. Execution Point Highlighting

### 7.1 Current Behavior

`refreshCodeLocation()` uses `sourceMap[pc]` to get the line number and navigates the editor there.

`refreshCurrentBreakpoint()` highlights the entire line.

### 7.2 Enhanced Behavior with Source-Level Debug

When `sourceLevelDebug` is available:

1. Look up the statement index from `addressToStatement` for the current PC.
2. If the statement has a precise column range (`startColumn`..`endColumn`), highlight **only that range** instead of the whole line.
3. If the statement spans multiple lines, highlight all lines from `startLine` to `endLine`.

This provides precise visual feedback showing *which* statement is about to execute, especially important when a line contains multiple statements.

---

## 8. Call Stack Display

### 8.1 Current State

The IDE currently has no source-level call stack display (only the raw Z80 SP/PC).

### 8.2 Enhancement

With `CallableDebugInfo`, the IDE can reconstruct a source-level call stack:

1. Use the Z80 `stepOutStack` (the circular buffer of return addresses).
2. For each return address, look up `addressToStatement` → get `statementIndex` → get `callableIndex`.
3. Display the callable's `name` and the source location.

This gives users a familiar "Call Stack" panel:

```
Double (demo.pas:8)
Demo (demo.pas:13)
```

---

## 9. Implementation Steps

Each step is designed to be independently implementable and unit-testable.

### Step 1: Define New Types

**Files:** `src/common/abstractions/CompilerInfo.ts`

- Add `StatementKind`, `CallableKind`, `SourceFileEntry`, `StatementDebugInfo`, `CallableDebugInfo`, `SourceLevelDebugInfo` types (language-agnostic).
- Add `sourceLevelDebug?: SourceLevelDebugInfo` to `DebuggableOutput`.
- Add `hasSourceLevelDebug()` helper to `src/renderer/appIde/utils/compiler-utils.ts`.
- **Tests:** Unit tests that construct sample `SourceLevelDebugInfo` objects and validate the types, check `hasSourceLevelDebug()` returns correctly for outputs with/without the field.

### Step 2: Build the Address-to-Statement Lookup

**Files:** New file `src/common/utils/source-level-debug.ts`

- Implement `buildAddressToStatementMap(info: SourceLevelDebugInfo): (pc: number) => number` — builds an efficient lookup from the sorted `addressToStatement` pairs (binary search).
- Implement `getStatementForAddress(info: SourceLevelDebugInfo, pc: number): StatementDebugInfo | undefined`.
- Implement `getCallableForAddress(info: SourceLevelDebugInfo, pc: number): CallableDebugInfo | undefined`.
- **Tests:** Unit tests with the demo.pas example data: look up addresses at statement boundaries, in the middle of statements, in runtime-code gaps (`-1`), at the very first and last address.

### Step 3: Parse Enhanced SLD Output in Pasta80Compiler

**Files:** `src/main/pasta80-integration/Pasta80Compiler.ts`

- Update the `.sld` JSON parsing to read the new `statements`, `callables`, `addressToStatement` fields when present.
- Populate `sourceLevelDebug` on the returned `DebuggableOutput`.
- Fall back gracefully if the `.sld` file has the old format (no `statements` field).
- **Tests:** Unit tests with mock `.sld` JSON in both old and new formats, verify the returned output has/doesn't have `sourceLevelDebug`.

### Step 4: Extend DebugStepMode Enum

**Files:** `src/emu/abstractions/DebugStepMode.ts`

- Add `SourceStepInto`, `SourceStepOver`, `SourceStepOut` values.
- **Tests:** Verify the enum values don't collide with existing ones.

### Step 5: Add Source-Level Debug State to Execution Context

**Files:** `src/emu/abstractions/IExecutionContext.ts` (or wherever `ExecutionContext` is defined), `src/emu/machines/DebugSupport.ts`

- Add `sourceLevelDebug?: SourceLevelDebugInfo` to the debug support.
- Add `addressToStatementLookup` (the compiled binary-search function).
- Add `sourceStepState` — transient state for tracking in-progress source-level steps:
  ```typescript
  type SourceStepState = {
    startStatementIndex: number;
    startCallableIndex: number;
    imminentStatementAddress?: number;
  };
  ```
- **Tests:** Construct a debug support with source-level debug, verify lookups work.

### Step 6: Implement Source-Level Stepping Logic in MachineFrameRunner

**Files:** `src/emu/machines/MachineFrameRunner.ts`

- In `checkBreakpoints()`, add handling for the three new `DebugStepMode` values.
- **SourceStepInto:** After each Z80 instruction, look up the statement index for the new PC. Stop if it differs from the starting statement index and is not `-1`.
- **SourceStepOver:** If the current statement has `callTargets`, set an imminent breakpoint at the next statement's `startAddress` and run. Otherwise behave like SourceStepInto.
- **SourceStepOut:** Combine the Z80 `stepOutStack` mechanism with a check that the PC is on a statement in a different (parent) callable.
- **Tests:** Create a mock machine + debug support with a known `SourceLevelDebugInfo`. Simulate sequences of PC values and verify that `checkBreakpoints()` returns `true` at the correct points for each mode.

### Step 7: Wire Source-Level Commands in MachineController

**Files:** `src/emu/machines/MachineController.ts`

- Add `sourceStepInto()`, `sourceStepOver()`, `sourceStepOut()` methods.
- These set up `sourceStepState` and call `this.run()` with the appropriate `DebugStepMode`.
- **Tests:** Verify controller methods set correct debug step mode and source step state.

### Step 8: Add Machine Commands for Source Stepping

**Files:** `src/renderer/appEmu/MainToEmuProcessor.ts` (or wherever `issueMachineCommand` is handled)

- Handle `"sourceStepInto"`, `"sourceStepOver"`, `"sourceStepOut"` commands.
- **Tests:** Verify commands are dispatched to the correct controller methods.

### Step 9: Add Stepping-Level Toggle to App State

**Files:** `src/common/state/AppState.ts`, `src/common/state/actions.ts`, `src/common/state/emulator-state-reducer.ts`

- Add `debugSteppingLevel: "z80" | "source"` to emulator state (default: `"z80"`).
- Add action to toggle it.
- **Tests:** Verify state transitions.

### Step 10: Update Toolbar

**Files:** `src/renderer/controls/Toolbar.tsx`

- Add a toggle button/dropdown for "Z80" / "Source" stepping level.
- When Source is selected, Step Into/Over/Out buttons send `sourceStepInto`/`sourceStepOver`/`sourceStepOut`.
- The toggle is visible/enabled only when `sourceLevelDebug` is present.
- **Tests:** Component tests verifying correct command dispatch based on stepping level.

### Step 11: Update Menu

**Files:** `src/main/app-menu.ts`

- Update Step Into/Over/Out menu items to check the current stepping level and dispatch either Z80 or source-level commands.
- **Tests:** Verify menu item click dispatches correct command based on app state.

### Step 12: Enhanced Breakpoint Resolution

**Files:** `src/common/utils/breakpoints.ts`

- When `sourceLevelDebug` is available, resolve breakpoints using the `statements` array instead of `listFileItems`.
- Find the first statement covering the breakpoint's line and use its `startAddress`.
- **Tests:** Unit tests with sample debug info, resolve breakpoints on various lines (empty lines, multi-statement lines, multi-line statements).

### Step 13: Enhanced Execution Point Highlighting

**Files:** `src/renderer/appIde/DocumentPanels/MonacoEditor.tsx`, `src/renderer/appIde/IdeEventsHandler.tsx`

- When `sourceLevelDebug` is available, use statement column ranges for highlighting instead of whole-line highlighting.
- For multi-line statements, highlight the full range.
- **Tests:** Verify correct decoration ranges for single-line, multi-statement, and multi-line statement scenarios.

### Step 14: Call Stack Panel (Future Enhancement)

**Files:** New panel component

- Display source-level call stack using Z80 step-out stack + `addressToStatement` mapping.
- Show callable name, file, and line for each frame.
- **Tests:** Construct test scenarios with nested calls, verify call stack entries.

### Step 15: `lineCanHaveBreakpoint` for PASTA-80

**Files:** `src/main/pasta80-integration/Pasta80Compiler.ts`

- Currently returns `false`. Implement it using the compiled `sourceLevelDebug` data to check if any statement starts on the given line.
- Alternatively, do a simple syntactic check (e.g., lines containing `:=`, `if`, `while`, `for`, `writeln`, etc., can have breakpoints).
- **Tests:** Verify various Pascal lines are correctly identified as breakpointable or not.

---

## 10. What the Compiler Developer Needs to Know

This section uses PASTA-80 as a concrete example, but the same format applies to any high-level language compiler targeting Z80 (C, BASIC, etc.).

### Summary for a high-level language compiler developer

The compiler should produce an extended `.sld` JSON file (or write an equivalent file in any name/format, then have the Klive integration layer load it). The JSON must contain:

1. **`language`** *(optional)* — string identifying the source language, e.g. `"pascal"`, `"c"`, `"basic"`.
2. **`files`** — array of `{ index, filename }` for all source files.
3. **`statements`** — array of `StatementDebugInfo` objects (see §3.2), one per source statement, in ascending `startAddress` order.
4. **`callables`** — array of `CallableDebugInfo` objects (see §3.2), one per subroutine / function / entry point.
5. **`addressToStatement`** — array of `[address, statementIndex]` pairs mapping every Z80 address range to a statement (or `-1` for compiler-generated glue code).

### Key rules

- **Every Z80 address** in the emitted code must be covered by `addressToStatement`. Gaps are expressed with index `-1`.
- `statements` must be in ascending `startAddress` order.
- `addressToStatement` must be in ascending address order.
- Source ranges use 1-based lines and 0-based columns. Record them precisely so the IDE can highlight the exact active statement.
- `callTargets` should list only **user-defined** callables; built-in / runtime calls (e.g. `writeln`, standard library) are not tracked.
- `exitAddresses` must list every Z80 address where a `RET` (or a jump to a shared epilogue) effectively returns from the callable.
- `CallableKind` values to use: `"entrypoint"` for the main program body, `"subroutine"` for procedures / void functions / SUBs, `"function"` for value-returning functions, `"method"` / `"constructor"` / `"destructor"` / `"lambda"` for OOP or functional constructs.
- Use `StatementKind` values as described in §3.2. Use `"other"` for language-specific constructs not listed.

### PASTA-80 specific note

For PASTA-80, emit the extended sld when `--klive` is passed. The old flat `statements` format (address + file + line + column) should remain so that the existing `sourceMap`/`listFileItems` fallback in `Pasta80Compiler.ts` continues to work when `sourceLevelDebug` is absent.

### Recommended approach

Emit the JSON in two stages:
1. During code generation, record a `StatementDebugInfo` entry as each statement's machine code is emitted.
2. After code generation, emit `callables` and `addressToStatement` from the accumulated data.

---

## 11. Additional Considerations

### 11.1 Runtime Library Code

Addresses belonging to runtime library or compiler-generated glue code should have `addressToStatement` entries with index `-1`. When the user issues Source Step-Into and the PC enters such code, the debugger keeps running. The user can switch to Z80 stepping mode to inspect the runtime instruction by instruction.

### 11.2 Optimisation Impact

When the compiler's optimiser is enabled, the mapping between statements and addresses may change. The compiler must produce the debug info **after** optimisation so that addresses are accurate. If optimisation makes it impossible to attribute some instructions to a specific statement, those addresses should map to `-1`.

### 11.3 Multi-File Projects

Compilers that support multi-file projects (e.g., Pascal `uses`/`unit`, C `#include`, BASIC `MERGE`) assign each file its own `fileIndex`. The debugger already supports multi-file navigation; the new types extend this naturally since `StatementDebugInfo.fileIndex` and `CallableDebugInfo.fileIndex` identify the file.

### 11.4 Inline Assembly

Some languages support inline assembly blocks. Statements with `kind: "asm"` should be treated as a single source-level statement. In source-level stepping mode the entire inline block is one step; users can switch to Z80 mode to step through individual instructions inside it.

### 11.5 Exception / Error Handling

If the Z80 PC enters an address that is **not covered** by `addressToStatement` at all (e.g., the emulator jumps to ROM code or to an address outside the compiled program), the source-level debugger should fall back gracefully: clear the source highlight, and let the user switch to Z80 mode to inspect what happened.

### 11.6 Performance Considerations

The `addressToStatement` lookup is called after **every Z80 instruction** during source-level stepping. It must be efficient:

- Build a `Uint32Array` or `Int32Array` mapping address → statement index for the code range. This gives O(1) lookup at the cost of ~64KB memory (for a 16-bit address space using 32-bit indices).
- Alternatively, use binary search on the sorted `addressToStatement` pairs — O(log n) per lookup, acceptable for typical code sizes.

### 11.7 Debugging Multiple Statements on One Line — UX

When stepping through `a := 1; b := 2; c := 3;` (or equivalent in any language) on a single line:

- The editor should highlight the **column range** of the current statement (not the whole line).
- The debugger status bar should show the statement kind and source text.
- The "current line" indicator in the gutter should remain on the same line but the inline highlight should move.

### 11.8 Interaction with Existing Z80 Breakpoints

Users can set both source-level breakpoints (on source lines) and Z80-level breakpoints (on addresses, in the Disassembly panel). Both types are checked during execution. The existing `breakpointFlags` array handles address-based breakpoints. Source breakpoints resolved via `statements` produce the same address-based breakpoints. No conflict.

### 11.9 Banking / Memory Paging

Some targets (ZX Spectrum 128K, ZX Next) page different 16 KB banks into the upper address window at runtime. The same 16-bit address can mean completely different code depending on which bank is currently paged in.

**Impact on debug info:**
- A code location is uniquely identified by `(address, partition)`, **not** by address alone.
- Set `usesBanking: true` in `SourceLevelDebugInfo` for any program that uses overlays, bank-switched modules, or paged libraries.
- Populate `partitionedAddressMap` instead of (or in addition to fallback for) `addressToStatement`. Each entry groups the address–statement map for one partition.
- Every `StatementDebugInfo` and `CallableDebugInfo` must carry its `partition` value.

**Partition numbering:** use the values that Klive's `getPartition(address)` returns at runtime. For ZX Spectrum 128K, this is 0–7 for the RAM bank paged at `$C000–$FFFF`, and negative values for ROM pages. For ZX Next, 8 KB slots follow a different numbering — consult the machine implementation. The Klive integration layer (e.g. `Pasta80Compiler.ts`) is responsible for translating the compiler's internal bank numbers to Klive partition values before populating the debug info.

**Impact on the address-to-statement lookup (Step 2):**
- When `usesBanking` is true, the lookup function must also accept the current partition:
  ```typescript
  function getStatementForAddress(
    info: SourceLevelDebugInfo,
    pc: number,
    partition: number | undefined
  ): StatementDebugInfo | undefined
  ```
  It finds the matching `partitionedAddressMap` entry, then binary-searches within it.

**Impact on breakpoint resolution (Step 12):**
- Resolved breakpoints must carry a `partition` so `DebugSupport.resolveBreakpoint()` can store a partition-qualified address. The existing `BreakpointInfo.resolvedPartition` field is already designed for this.

**Impact on execution-point highlighting (Step 13):**
- When looking up the source location from PC, also pass the current partition from `machine.getPartition(pc)` to the statement lookup.

---

## 12. Testing Strategy

### Unit Tests

| Test Suite | Location | What It Tests |
|------------|----------|---------------|
| Source-level debug types | `test/debug/source-level-debug-types.test.ts` | Type construction, validation, helpers |
| Address-to-statement lookup | `test/debug/address-to-statement.test.ts` | Binary search, edge cases, -1 gaps |
| SLD parsing | `test/debug/sld-parsing.test.ts` | Old format, new format, malformed JSON |
| Breakpoint resolution | `test/debug/source-breakpoint-resolution.test.ts` | Line → address resolution with statements |
| Source stepping logic | `test/debug/source-stepping.test.ts` | Step-into/over/out with mock PC sequences |
| State management | `test/debug/debug-state.test.ts` | Stepping level toggle, action dispatch |

### Integration Tests

| Test | What It Tests |
|------|---------------|
| Full compilation + debug info | Compile a real `.pas` file with PASTA-80, verify the output contains valid `sourceLevelDebug` |
| End-to-end stepping | Start emulation, set a breakpoint, verify step-into lands on the correct statement |
| Mode switching | Toggle between Z80 and Source mode during a debug session, verify correct behavior |

---

## 13. Migration & Backward Compatibility

- **Z80 Assembly** projects are **completely unaffected**. The new `sourceLevelDebug` field is optional. All existing code paths check `isDebuggableCompilerOutput()` which does not require the new field.
- **PASTA-80** without the new SLD format continues to work with the existing line-level `sourceMap`. Source-level stepping is simply unavailable until the compiler is updated.
- **ZXBasic / SjasmPlus** compilers are unaffected. They can optionally adopt the same `SourceLevelDebugInfo` format in the future.
- The stepping level toggle defaults to "Z80", so existing users see no difference until they explicitly enable Source mode.

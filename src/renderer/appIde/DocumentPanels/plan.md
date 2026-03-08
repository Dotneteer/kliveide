# Plan: Z80 Assembly Language Intelligence for Monaco Editor

## Implementation Workflow

Each step follows this process before being marked complete:

1. **Verify existing tests pass** — Run `npm run test` (unit tests only, no Playwright e2e tests) and confirm all pass before touching anything.
2. **Implement the changes** — Modify or create source files as described in the step.
3. **Check for lint/build issues** — Run `npm run build:check` to ensure no TypeScript or lint errors in updated files.
4. **Create new unit tests** — Write test file(s) as specified for the step.
5. **Ensure new tests pass** — Run the new test file(s) with `npm run test`; fix implementation or tests if needed.
6. **Ensure all existing tests still pass** — Run `npm run test` again and confirm nothing regressed.
7. **Mark step complete** — Update status in this plan.
8. **Request approval** — Ask the user to approve before proceeding to the next step.

> **Test command:** `npm run test` — runs all unit tests only. Do NOT run `npx vitest` or `playwright` directly.

---

## Goal

Add rich editor features (autocomplete, hover, go-to-definition, outlining, find references) for Z80 Assembly in the Monaco editor. Rather than running a separate LSP server process, we implement Monaco language providers directly in the renderer, powered by compilation data from the existing background compilation pipeline.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  RENDERER (Monaco Editor)                               │
│                                                         │
│  ┌──────────────────────────────────────────────┐       │
│  │ Monaco Language Providers                     │       │
│  │  • CompletionItemProvider                     │       │
│  │  • HoverProvider                              │       │
│  │  • DefinitionProvider                         │       │
│  │  • ReferenceProvider                          │       │
│  │  • DocumentSymbolProvider (Outline)           │       │
│  └────────────────┬─────────────────────────────┘       │
│                   │ queries                              │
│  ┌────────────────▼─────────────────────────────┐       │
│  │ LanguageIntelService (cache in renderer)      │       │
│  │  • symbolTable: Map<name, SymbolDefinition>   │       │
│  │  • symbolReferences: Map<name, Location[]>    │       │
│  │  • documentSymbols: Map<file, Symbol[]>       │       │
│  │  • completionCandidates (instructions, regs,  │       │
│  │    pragmas, symbols)                          │       │
│  └────────────────▲─────────────────────────────┘       │
│                   │ updated on each background compile   │
│                   │                                      │
└───────────────────┼──────────────────────────────────────┘
                    │ IPC (extended CompilationCompleted)
┌───────────────────┼──────────────────────────────────────┐
│  MAIN PROCESS     │                                      │
│  ┌────────────────┴─────────────────────────────┐        │
│  │ runWorker.ts (extract intel data from output) │        │
│  └────────────────▲─────────────────────────────┘        │
│                   │                                      │
│  ┌────────────────┴─────────────────────────────┐        │
│  │ Z80Assembler (extended to emit intel data)    │        │
│  │  • symbolDefinitions with locations           │        │
│  │  • symbolReferences with locations            │        │
│  │  • documentOutline (labels, macros, procs)    │        │
│  └──────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────┘
```

---

## Current State Assessment

### What the compiler already provides
- **Full AST** with `NodePosition` on every node (line, startColumn, endColumn, fileIndex)
- **Symbol table** (`SymbolInfoMap`) — name → value, type, module-local/short-term flags
- **Source map** (address → `{fileIndex, line}`) and **address map** (source → addresses)
- **Errors** with precise source locations (file, line, column range, message)
- **Macros & structs** with `DefinitionSection` (`firstLine`, `lastLine`)
- **List file items** — per-line: address, code bytes, source text
- **Source file list** — all files involved in compilation

### What the compiler is missing
| Missing | Needed For | Details |
|---------|-----------|---------|
| Symbol definition location | Go-to-definition, hover | `IAssemblySymbolInfo` stores name/value but not fileIndex/line/column |
| Symbol reference tracking | Find references, rename | No record of where symbols are *used* (only where they're *defined*) |
| Full output through IPC | All features | `runWorker.ts` discards everything except errors — symbols, sourceMap, etc. never reach the renderer |
| Monaco providers | All features | No `registerCompletionItemProvider`, `registerHoverProvider`, etc. registered |

### Key files to modify

| File | Change |
|------|--------|
| `src/main/compiler-common/abstractions.ts` | Extend `IAssemblySymbolInfo` with location fields |
| `src/main/compiler-common/assembly-symbols.ts` | Store location when creating symbols |
| `src/main/compiler-common/common-assembler.ts` | Pass location to symbol creation in `addSymbol()` |
| `src/main/compiler-integration/runWorker.ts` | Forward full compilation intel to renderer |
| `src/common/state/AppState.ts` | Extend `CompilationState` with intel data type |
| `src/common/state/actions.ts` | New action for intel data |
| `src/common/abstractions/CompilerInfo.ts` | New `LanguageIntelData` type (serializable subset of compiler output) |
| `src/renderer/appIde/DocumentPanels/MonacoEditor.tsx` | Register Monaco providers in `ensureLanguage()` |
| New: `src/renderer/appIde/services/LanguageIntelService.ts` | Cache intel data, serve queries |
| New: `src/renderer/appIde/services/z80-providers.ts` | Monaco provider implementations |

---

## Implementation Steps

### Phase 1: Extend the compiler to track symbol locations

#### Step 1.1 — Add location fields to `IAssemblySymbolInfo` ✅ COMPLETE

**Files:** `src/main/compiler-common/abstractions.ts`, `src/main/compiler-common/assembly-symbols.ts`

Add optional location fields to the symbol interface and implementation:

```typescript
// In IAssemblySymbolInfo:
readonly fileIndex?: number;
readonly line?: number;
readonly startColumn?: number;
readonly endColumn?: number;
```

Update `AssemblySymbolInfo.createLabel()` and `createVar()` to accept and store location.

**Test:** New test file `test/z80-assembler/symbol-location.test.ts`
- Compile a program with labels; assert each symbol in `output.symbols` has correct `line`, `fileIndex`, `startColumn`.
- Test labels at different positions: first line, mid-file, inside modules, inside procs.
- Test `.equ` and `.var` definitions have correct location.
- Test module-local (`@label`) and short-term (`` `label ``) symbols.

**Verification:** Run `npx vitest test/z80-assembler/symbol-location.test.ts`

---

#### Step 1.2 — Pass location data in `addSymbol()` ✅ COMPLETE

**Files:** `src/main/compiler-common/common-assembler.ts`

The `addSymbol(symbol, line, value)` method already receives the `AssemblyLine` with full location. Change the `AssemblySymbolInfo.createLabel(symbol, value)` call to also pass `line.fileIndex`, `line.line`, `line.startColumn`, `line.endColumn`.

Do the same for every other place symbols are created (`.equ`, `.var`, struct fields, macro args, proc labels, etc.). Search for all `createLabel` and `createVar` calls in the codebase.

**Test:** Extend `test/z80-assembler/symbol-location.test.ts`
- Compile a multi-file program (using `.include`). Assert symbols from the included file have the correct `fileIndex`.
- Compile a program with `.equ` directives; verify the location points to the `.equ` line.
- Compile a `.var` directive; verify location.

**Verification:** `npx vitest test/z80-assembler/symbol-location.test.ts`

---

#### Step 1.3 — Track symbol references (usage locations) ✅ COMPLETE

**Files:** `src/main/compiler-common/common-assembler.ts`, `src/main/compiler-common/abstractions.ts`

Add a `symbolReferences` map to `AssemblyModule`:

```typescript
readonly symbolReferences: Map<string, Array<{ fileIndex: number; line: number; startColumn: number; endColumn: number }>>;
```

Populate it whenever a symbol is *resolved* during expression evaluation or instruction operand processing. The key code path is in the expression evaluator where `getSymbolValue` / `resolveSimpleSymbol` / `resolveCompoundSymbol` is called — add a recording hook.

**Test:** New test file `test/z80-assembler/symbol-references.test.ts`
- Compile: `MyLabel: ... ld a,(MyLabel) ... jp MyLabel`. Assert `symbolReferences["mylabel"]` contains 2 entries with correct lines.
- Test cross-module references.
- Test references inside macro invocations.

**Verification:** `npx vitest test/z80-assembler/symbol-references.test.ts`

---

### Phase 2: Get compilation intel data to the renderer ✅ COMPLETE

#### Step 2.1 — Define the `LanguageIntelData` type ✅ COMPLETE

**File:** `src/common/abstractions/CompilerInfo.ts`

Define a serializable data structure that carries the subset of compiler output needed for language intelligence:

```typescript
export interface SymbolLocationInfo {
  name: string;
  type: "label" | "var" | "equ" | "macro" | "struct" | "proc" | "module";
  fileIndex: number;
  line: number;
  startColumn: number;
  endColumn: number;
  value?: number;
  description?: string; // e.g., "= $6000" for .equ
}

export interface SymbolReferenceInfo {
  symbolName: string;
  fileIndex: number;
  line: number;
  startColumn: number;
  endColumn: number;
}

export interface DocumentOutlineEntry {
  name: string;
  kind: "label" | "macro" | "struct" | "proc" | "module";
  fileIndex: number;
  line: number;
  endLine: number;
  children?: DocumentOutlineEntry[];
}

export interface LanguageIntelData {
  symbolDefinitions: SymbolLocationInfo[];
  symbolReferences: SymbolReferenceInfo[];
  documentOutline: DocumentOutlineEntry[];
  sourceFileList: { index: number; filename: string }[];
}
```

**Test:** Unit test that constructs instances of these types and validates serialization/deserialization (since they cross the IPC boundary).

**Verification:** `npx vitest test/z80-assembler/intel-data-types.test.ts`

---

#### Step 2.2 — Extract intel data from compiler output ✅ COMPLETE

**File:** New file `src/main/compiler-integration/extractIntelData.ts`

Create a function `extractLanguageIntelData(output: KliveCompilerOutput): LanguageIntelData` that:
1. Iterates `output.symbols` (and nested module symbols recursively) → builds `symbolDefinitions[]`
2. Iterates `output.symbolReferences` (from Step 1.3) → builds `symbolReferences[]`
3. Iterates macros, structs, procs → builds `documentOutline[]` with hierarchy
4. Maps `output.sourceFileList` → `sourceFileList[]`

**Test:** New test file `test/z80-assembler/extract-intel-data.test.ts`
- Compile a Z80 program with labels, macros, structs, modules.
- Call `extractLanguageIntelData(output)`.
- Assert `symbolDefinitions` contains all expected symbols with correct locations.
- Assert `documentOutline` has the expected hierarchy.

**Verification:** `npx vitest test/z80-assembler/extract-intel-data.test.ts`

---

#### Step 2.3 — Send intel data through IPC ✅ COMPLETE

**Files:**
- `src/main/compiler-integration/runWorker.ts` — Extract intel data after compilation and dispatch it
- `src/common/state/AppState.ts` — Add `languageIntel?: LanguageIntelData` to `CompilationState`
- `src/common/state/actions.ts` — Add `setLanguageIntelAction`
- `src/common/state/compilation-reducer.ts` — Handle the new action

Modify `runWorker.ts` worker message handler:
```typescript
worker.on("message", (result: KliveCompilerOutput) => {
  // Existing: dispatch error results
  const backgroundResult = ...;
  mainStore.dispatch(endBackgroundCompileAction(backgroundResult));

  // NEW: extract and dispatch intel data
  const intelData = extractLanguageIntelData(result);
  mainStore.dispatch(setLanguageIntelAction(intelData));
});
```

**Test:** This step is harder to unit test directly (IPC + Redux). Create a test that:
- Instantiates the Z80 compiler directly (no worker).
- Compiles code, calls `extractLanguageIntelData()`, verifies the result.
- Verifies the Redux reducer processes the action correctly (test the reducer in isolation).

**Verification:** `npx vitest test/z80-assembler/intel-ipc-flow.test.ts`

---

### Phase 3: Build the renderer-side language intelligence service ✅ COMPLETE

#### Step 3.1 — Create `LanguageIntelService` ✅ COMPLETE

**File:** New `src/renderer/appIde/services/LanguageIntelService.ts`

A class that:
- Subscribes to `state.compilation.languageIntel` changes
- Maintains indexed maps for fast lookup:
  - `symbolByName: Map<string, SymbolLocationInfo>` — for autocomplete + hover
  - `symbolsByFile: Map<number, SymbolLocationInfo[]>` — for document symbols
  - `referencesBySymbol: Map<string, SymbolReferenceInfo[]>` — for find references
  - `outlineByFile: Map<number, DocumentOutlineEntry[]>` — for outline
  - `fileIndexToPath: Map<number, string>` and reverse — for resolving files
- Provides query methods:
  - `getSymbolAtPosition(fileIndex, line, column): SymbolLocationInfo | null`
  - `getCompletionCandidates(prefix: string): SymbolLocationInfo[]`
  - `getSymbolDefinition(name: string): SymbolLocationInfo | null`
  - `getSymbolReferences(name: string): SymbolReferenceInfo[]`
  - `getDocumentOutline(fileIndex: number): DocumentOutlineEntry[]`

**Test:** New test file `test/z80-assembler/language-intel-service.test.ts`
- Construct a `LanguageIntelData` manually.
- Feed it to `LanguageIntelService`.
- Query: `getCompletionCandidates("My")` → returns `["MyLabel", "MyMacro"]`.
- Query: `getSymbolDefinition("MyLabel")` → returns location.
- Query: `getSymbolReferences("MyLabel")` → returns 2 reference locations.
- Query: `getDocumentOutline(0)` → returns hierarchy.

**Verification:** `npx vitest test/z80-assembler/language-intel-service.test.ts`

---

#### Step 3.2 — Static completion candidates (instructions, registers, pragmas) ✅ COMPLETE

**File:** New `src/renderer/appIde/services/z80-completion-data.ts`

Define static completion items that don't depend on compilation:
- Z80 instructions: `ld`, `add`, `sub`, `jp`, `jr`, `call`, `ret`, `push`, `pop`, `nop`, `halt`, etc. (full list from `z80-token-traits.ts`)
- Z80 Next instructions: `nextreg`, `mirror`, `mul`, `test`, etc.
- Registers: `a`, `b`, `c`, `d`, `e`, `h`, `l`, `hl`, `de`, `bc`, `sp`, `ix`, `iy`, `af`, etc.
- Pragmas/directives: `.org`, `.equ`, `.var`, `.db`, `.dw`, `.ds`, `.macro`, `.proc`, `.struct`, `.module`, `.if`, `.else`, `.endif`, etc.
- Preprocessor: `#ifdef`, `#ifndef`, `#define`, `#undef`, `#include`, `#line`, etc.

Each entry includes:
- `label` (the keyword)
- `kind` (Keyword, Function, Variable, etc.)
- `detail` (one-line description)
- `insertText` (snippet with placeholders where appropriate)

**Test:** `test/z80-assembler/z80-completion-data.test.ts`
- Assert all Z80 instruction mnemonics are present.
- Assert all registers are present.
- Assert all supported pragmas are present.
- Assert no duplicates.
- Assert each entry has valid kind/label/detail.

**Verification:** `npx vitest test/z80-assembler/z80-completion-data.test.ts`

---

### Phase 4: Register Monaco providers ✅ COMPLETE

#### Step 4.1 — CompletionItemProvider ✅ COMPLETE

**File:** New `src/renderer/appIde/services/z80-providers.ts`

Register with `monaco.languages.registerCompletionItemProvider("kz80-asm", provider)` inside `ensureLanguage()` or `initializeMonaco()`.

The provider:
1. Returns static candidates (instructions, registers, pragmas) always.
2. Returns dynamic candidates (symbol names from `LanguageIntelService`) filtered by the current prefix.
3. For symbol completions, sets `detail` to the symbol's type and value (e.g., `"label = $6000"`).
4. Uses `triggerCharacters: [".", "#", "@"]` for contextual completion:
   - After `.` → pragma completions
   - After `#` → preprocessor directive completions
   - After `@` → module-local symbols

**Test:** `test/z80-assembler/z80-completion-provider.test.ts`
- Create a mock `LanguageIntelService` with known symbols.
- Call the provider's `provideCompletionItems()` with a mock model/position.
- Assert it returns both static instruction completions and dynamic symbol completions.
- Assert filtering by prefix works.
- Assert `.` trigger returns only pragmas.

**Verification:** `npx vitest test/z80-assembler/z80-completion-provider.test.ts`

---

#### Step 4.2 — HoverProvider ✅ COMPLETE

**File:** `src/renderer/appIde/services/z80-providers.ts`

Register `monaco.languages.registerHoverProvider("kz80-asm", provider)`.

The provider:
1. Gets the word at the hover position from the Monaco model.
2. Queries `LanguageIntelService.getSymbolDefinition(word)`.
3. If found, returns a hover with:
   - Symbol name, type, value (formatted as markdown)
   - E.g., `**MyLabel** (label) = $6000 — defined in main.asm:15`
4. If the word is an instruction mnemonic, returns a brief description from a static table.
5. If the word is a register, returns register info.

**Test:** `test/z80-assembler/z80-hover-provider.test.ts`
- Mock `LanguageIntelService` with known symbols.
- Call `provideHover()` at a position where a symbol is.
- Assert the returned hover contains the symbol name, value, and definition file.
- Call for a register name → get register description.
- Call for an instruction → get instruction description.
- Call for whitespace → null.

**Verification:** `npx vitest test/z80-assembler/z80-hover-provider.test.ts`

---

#### Step 4.3 — DefinitionProvider (Go-to-Definition) ✅ COMPLETE

**File:** `src/renderer/appIde/services/z80-providers.ts`

Register `monaco.languages.registerDefinitionProvider("kz80-asm", provider)`.

The provider:
1. Gets the word at the cursor position.
2. Queries `LanguageIntelService.getSymbolDefinition(word)`.
3. If found, returns a `Location` with the definition's URI and range.
4. Resolves `fileIndex` → actual file path via `sourceFileList`.

**Test:** `test/z80-assembler/z80-definition-provider.test.ts`
- Mock service with a symbol defined at file 0, line 10.
- Call `provideDefinition()` for that symbol name.
- Assert it returns a location pointing to line 10.
- Call for an unknown word → null.
- Call for a register name → null (registers have no definition).

**Verification:** `npx vitest test/z80-assembler/z80-definition-provider.test.ts`

---

#### Step 4.4 — ReferenceProvider (Find All References) ✅ COMPLETE

**File:** `src/renderer/appIde/services/z80-providers.ts`

Register `monaco.languages.registerReferenceProvider("kz80-asm", provider)`.

The provider:
1. Gets the word at cursor.
2. Queries `LanguageIntelService.getSymbolReferences(word)`.
3. Optionally includes the definition location if `context.includeDeclaration` is true.
4. Returns all reference locations.

**Test:** `test/z80-assembler/z80-reference-provider.test.ts`
- Mock service: symbol "MyLabel" defined at line 5, referenced at lines 10 and 20.
- Call `provideReferences()` for "MyLabel" with `includeDeclaration: true`.
- Assert 3 locations returned (definition + 2 references).
- With `includeDeclaration: false`, assert 2 locations.

**Verification:** `npx vitest test/z80-assembler/z80-reference-provider.test.ts`

---

#### Step 4.5 — DocumentSymbolProvider (Outline / Breadcrumbs) ✅ COMPLETE

**File:** `src/renderer/appIde/services/z80-providers.ts`

Register `monaco.languages.registerDocumentSymbolProvider("kz80-asm", provider)`.

The provider:
1. Determines the current file's `fileIndex`.
2. Queries `LanguageIntelService.getDocumentOutline(fileIndex)`.
3. Maps `DocumentOutlineEntry` → `monaco.languages.DocumentSymbol`:
   - Labels → `SymbolKind.Function` (or `Constant` for `.equ`)
   - Macros → `SymbolKind.Function`
   - Structs → `SymbolKind.Struct`
   - Modules → `SymbolKind.Module`
   - Procs → `SymbolKind.Function`
4. Returns hierarchical structure (modules contain labels, procs contain local labels).

**Test:** `test/z80-assembler/z80-document-symbol-provider.test.ts`
- Mock service with an outline: module "Utils" → labels "Init", "Clear"; macro "MyMacro".
- Call `provideDocumentSymbols()`.
- Assert hierarchical structure: module has 2 children.
- Assert symbol kinds are correct.

**Verification:** `npx vitest test/z80-assembler/z80-document-symbol-provider.test.ts`

---

### Phase 5: Wire everything together in MonacoEditor.tsx ✅ COMPLETE

#### Step 5.1 — Register providers during Monaco initialization ✅ COMPLETE

**File:** `src/renderer/appIde/DocumentPanels/MonacoEditor.tsx`

In `initializeMonaco()`, after `ensureLanguage()`:
1. Import and call provider registration functions from `z80-providers.ts`.
2. Providers should be registered once (check `monacoInitialized` guard).
3. Pass the `LanguageIntelService` instance to providers (or use a singleton).

**Test:** Integration-level — verify that after `initializeMonaco()`, `monaco.languages.getLanguages()` includes `kz80-asm` and providers are registered (mock Monaco API).

---

#### Step 5.2 — Update intel data on background compile ✅ COMPLETE

**File:** `src/renderer/appIde/DocumentPanels/MonacoEditor.tsx`

Add a `useEffect` that subscribes to `state.compilation.languageIntel`:
```typescript
const languageIntel = useSelector((s) => s.compilation.languageIntel);
useEffect(() => {
  if (languageIntel) {
    languageIntelService.update(languageIntel);
  }
}, [languageIntel]);
```

**Test:** Mock the Redux store with language intel data; verify `LanguageIntelService.update()` is called.

---

### Phase 6: Polish and edge cases

#### Step 6.1 — Handle multi-file projects

Ensure go-to-definition works across files (e.g., jumping from `main.asm` to an included `utils.asm`). The `fileIndex` → `filePath` mapping from `sourceFileList` must be used to create the correct Monaco URI.

**Test:** Compile a project with `.include`. Assert go-to-definition for a symbol defined in the included file returns the correct file URI.

---

#### Step 6.2 — Handle stale data gracefully

When the user is typing and the last compilation had errors, the intel data may be stale. Providers should:
- Return whatever data is available (last successful compile).
- Not crash on missing data.
- Show a subtle indicator if data is stale (optional).

**Test:** Feed `LanguageIntelService` with data, then set it to `undefined`. Assert providers return empty results.

---

#### Step 6.3 — Performance: debounce and incremental updates

Background compilation is already debounced (triggered on each edit via `startBackgroundCompile`). Ensure:
- Intel data extraction doesn't block the main process.
- Large projects with thousands of symbols don't cause UI jank.
- Provider queries are O(1) or O(log n) via indexed maps.

**Test:** Create a synthetic `LanguageIntelData` with 10,000 symbols. Measure `getCompletionCandidates()` latency — should be < 10ms.

---

#### Step 6.4 — Register providers for other assembly languages

Once Z80 works, extend to `sjasm-z80`, `zxb-asm`, `asm-6510` by:
- Reusing the same provider framework.
- Providing language-specific static completion data.
- Ensuring the `extractIntelData` function works with their respective compiler outputs.

**Test:** Ensure provider registration works for each language ID.

---

## Summary: Test Files Created

| Step | Test File | What It Tests |
|------|-----------|---------------|
| 1.1 | `test/z80-assembler/symbol-location.test.ts` | Symbols store definition location |
| 1.2 | (extends above) | Multi-file, .equ, .var location |
| 1.3 | `test/z80-assembler/symbol-references.test.ts` | Symbol usage tracking |
| 2.1 | `test/z80-assembler/intel-data-types.test.ts` | LanguageIntelData type serialization |
| 2.2 | `test/z80-assembler/extract-intel-data.test.ts` | Intel extraction from compiler output |
| 2.3 | `test/z80-assembler/intel-ipc-flow.test.ts` | Redux reducer for intel actions |
| 3.1 | `test/z80-assembler/language-intel-service.test.ts` | LanguageIntelService queries |
| 3.2 | `test/z80-assembler/z80-completion-data.test.ts` | Static completion data coverage |
| 4.1 | `test/z80-assembler/z80-completion-provider.test.ts` | CompletionItemProvider behavior |
| 4.2 | `test/z80-assembler/z80-hover-provider.test.ts` | HoverProvider behavior |
| 4.3 | `test/z80-assembler/z80-definition-provider.test.ts` | DefinitionProvider behavior |
| 4.4 | `test/z80-assembler/z80-reference-provider.test.ts` | ReferenceProvider behavior |
| 4.5 | `test/z80-assembler/z80-document-symbol-provider.test.ts` | DocumentSymbolProvider behavior |

## Execution Order & Dependencies

```
Phase 1 (Compiler)          Phase 2 (IPC)           Phase 3 (Service)        Phase 4 (Providers)      Phase 5 (Wiring)
Step 1.1 ───┐               Step 2.1                Step 3.1 ────────────┐   Step 4.1                 Step 5.1
Step 1.2 ───┤──► Step 2.2 ──► Step 2.3              Step 3.2             ├── Step 4.2                 Step 5.2
Step 1.3 ───┘                                                            ├── Step 4.3
                                                                         ├── Step 4.4
                                                                         └── Step 4.5
```

- Steps 1.1–1.3 can be worked on independently and are the foundation.
- Step 2.1 can be done in parallel with Phase 1 (it's just type definitions).
- Steps 2.2–2.3 depend on Phase 1 being complete.
- Step 3.1 depends on 2.1 (types) but NOT on 2.2–2.3 (can mock data).
- Step 3.2 is independent (static data).
- Phase 4 steps depend on 3.1 (service) and 3.2 (static data) but can be done in any order.
- Phase 5 depends on Phase 4 being complete.
- Phase 6 is polish and can happen any time after Phase 5.

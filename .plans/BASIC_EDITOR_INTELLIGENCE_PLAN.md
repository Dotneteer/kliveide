# BASIC Editor Intelligence Plan: Hover, Definition, Completion, Rename and Outline for `.zxbas`

Status: **implemented** (2026-10-03): Phases 0–6 done; see §9 for measurements and what changed
from the design.
Base plan: [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md), §G8 (features **G8.1–G8.5**).
Also delivers §11.1–§11.2 of [ZXBASIC_COMPILER_PLAN.md](ZXBASIC_COMPILER_PLAN.md) (its Phase 8,
"Language intelligence"); that plan's §0 ground rules apply here.
**Depends on** nothing unfinished: the Klive BASIC front end (lexer, preprocessor, parser, binder) is
on main and is the only source of symbols.

> **Standing rule (from the base plan):** when this ships, update §2 (the "Editor with language
> intelligence" row) and §4 (gap **W8**) of
> [LANDING_PAGE_COMPETITIVE_ANALYSIS.md](LANDING_PAGE_COMPETITIVE_ANALYSIS.md), and mark G8.x done in
> the base plan, in the same change.

> **Provenance:** everything shown to the user comes from Klive's own sources: the bound program,
> Klive's standard library (`src/main/kbasic/stdlib/*.bas`), Klive's spec
> (`.ai/zxbasic-syntax/zxbasic-syntax.json`) and the documented-API catalogue
> (`.ai/kbasic/stdlib-api.json`). Both JSON files paraphrase CC BY 4.0 upstream documentation, so
> their attribution travels with any data generated from them (§4.4). Upstream code is never read
> for this work.

---

## 1. What is being added

Editing a `.zxbas` file gets the same kind of help as editing Klive assembly:

| Feature | Roadmap | What the user sees |
|---|---|---|
| Hover | G8.1 | Variables: type, storage (global/local/parameter), `BYREF`, implicit or declared. Constants: type and value. Arrays: element type and bounds. `SUB`/`FUNCTION`: signature, calling convention, the doc comment above it, and the file it is in. Labels. Keywords and built-in functions: syntax and a one-line description. |
| Go to definition | G8.2 | For variables, arrays, constants, `SUB`s, `FUNCTION`s, parameters, labels, line numbers and `#define`s, across `#include`d files, standard-library files included. `#include` file names open the file. |
| Find references | G8.2 | Every use of the symbol under the cursor, scope-correct (a local `x` is not the global `x`). |
| Completion | G8.3 | Keywords and types; symbols in scope at the cursor; labels after `GOTO`/`GOSUB`; library routines, which add their `#include` line when it is missing; preprocessor directives and pragmas; header option names and values in `'@` lines; `#include <…>` file names. |
| Rename | G8.4 | Cross-file rename of user symbols, scope-correct, sigils preserved. |
| Signature help | G8.5 | Parameter hints while typing a call, for user routines, built-in functions and library routines. |
| Outline | G8.5 | `SUB`s and `FUNCTION`s (with parameters and locals as children), labels, constants, global `DIM`s, `CODEBANK` blocks. |
| Folding | G8.5 | Block statements (`SUB`, `FUNCTION`, multi-line `IF`, `FOR`, `WHILE`, `DO`, `ASM`, `CODEBANK`), `#if` regions and runs of comment lines; plus matching block keyword highlight. |

### 1.1 What the code already has (survey, 2026-10-03)

**The asm side (the pattern to follow).**

- `src/renderer/appIde/services/z80-providers.ts` (≈1600 lines) holds Monaco-free `compute*()`
  functions plus one `registerZ80Providers()` that wraps them, hard-coded to `kz80-asm`. It registers
  link, colour, completion, hover, definition, references, rename, document symbols, folding, block
  highlight and semantic tokens. It does no IPC at request time.
- The providers read `languageIntelSingleton` (`LanguageIntelService.ts`), a name-keyed cache built
  from `LanguageIntelData` (`src/common/abstractions/CompilerInfo.ts:544`). Its symbol kinds are
  assembler kinds, and its references are recorded **by name, not resolved**.
- The data flow is as follows:
  1. An edit saves the file to disk, and `BackgroundCompileScheduler` debounces it (1200 ms).
  2. `startBackgroundCompile` compiles **the build root** (`MonacoEditor.tsx:1790`) in a fresh
     worker thread (`runWorker.ts`).
  3. The worker calls `compiler.checkFile`, then `extractLanguageIntelData` (`extractIntelData.ts`).
  4. The result goes to `setLanguageIntelAction` and is stored at `compilation.languageIntel`.
  5. A forwarded action reaches the renderer, and `MonacoEditor.tsx:282` calls
     `languageIntelSingleton.update()`.
- `runWorker.ts:50` publishes intel **only when `result.errors` is empty, and warnings are in that
  array**. A program with any warning, such as W100 (implicit variable), never gets intel.
- The document-symbol provider is wired with `getFileIndex = () => 0`, so the outline of an
  `#include`d file shows the root's symbols.

**The BASIC side.**

- `zxBasLanguageProvider.ts` has a Monarch grammar and **an empty `options: {}`**. That means no
  comment toggling, brackets, auto-closing or word pattern.
- `zxbas` has no providers at all. Diagnostics flow as above: `KBasicCompiler.checkFile` returns
  only `{ errors }`. Its successful background check therefore **overwrites the shared asm intel
  with an empty snapshot**.
- `runFrontEnd` (`KBasicCompiler.ts:157`) is pure: the file reader is injected and it does no fs.
  It returns `{ sources, preprocessed, program, diagnostics, options, bound? }`.
  - **`bound` is undefined whenever any lexer, preprocessor or parser error exists** (line 186).
  - The parser recovers (`synchronize`) and still builds a partial AST.
- **Positions.** Every AST node has a `Span { file, start, end }` (character offsets), and so does
  every identifier (`NameRef`).
  - `SourceFile.position()` and `location()` give line and column; `#line` is honoured.
  - Each `#include`d file is its own `SourceSet` entry. Library files have virtual paths
    `<kbasic-stdlib>/name.bas` (`isLibraryPath`).
  - Tokens produced by a macro carry the span of the outermost macro use (`siteSpan`), not their own.
- **Symbols** (`semantics/symbols.ts`):
  - `VariableSymbol`, `ArraySymbol`, `ConstSymbol` (with its folded value) and `RoutineSymbol`
    (params, return type, convention, `declaredAt`, `definedAt`, body `scope`).
  - `ParamSymbol`; `LabelSymbol` (labels and line numbers, in `BoundProgram.labels`).
  - Every symbol has a declaration `span` and **`uses: Span[]`**, which is the references list,
    already resolved.
  - Scopes are two levels: globals, plus one per routine. There is no block scope.
  - **Not yet recorded as uses (to verify):** named-argument names (`s(c := 7)`) and the variable
    after `NEXT`.
  - `#define` macros are private to the `Preprocessor`.
- **Other inputs available:**
  - `Program.comments: Span[]` exists "for outline, folding and hover".
  - `OPTION_SPECS` (`options/options.ts:121`) describes every header option.
  - The renderer already imports the BASIC lexer and parser (`watch-expression.ts`), so sharing
    `src/main/kbasic/syntax` with the renderer is an established practice.
- **Help data:**
  - The spec JSON has 115 `keywords`, 46 `statements` and 27 `functions`, with EBNF syntax and
    descriptions.
  - `stdlib-api.json` has 47 libraries and 74 `routines`, with parameters and summaries.
  - Nothing in `src/` reads either file. The Monarch word lists are a separate hand-written copy of
    `syntax/keywords.ts`.
- **Tests:**
  - `test/kbasic/semantics/bind-kit.ts` (`bindText` with an in-memory reader) makes extractor tests
    cheap.
  - `test/z80-assembler/language-intel-service.test.ts` is the model for service tests.

---

## 2. Design decisions

| # | Decision | Why |
|---|---|---|
| E1 | **A BASIC-specific payload, `BasicIntelData`**, not `LanguageIntelData`. Symbols get numeric ids and every reference points at an id. | BASIC has scopes (a local `x` shadows a global `x`) and optional case sensitivity. A name-keyed table cannot answer "which `x` is this?". The binder has already resolved every use, so name lookup would throw that work away. |
| E2 | **The producer is main-side, in the existing background-check worker.** `KBasicCompiler.checkFile` returns `{ errors, basicIntel }`, built from `KBasicFrontEndResult` by a pure extractor (`src/main/kbasic/intel/extract.ts`). | It keeps one compile per edit, one source of diagnostics and intel, and the settings and include reading the build already does. The alternative, a renderer-side front end, is discussed in Q1. |
| E3 | **A separate state slot and service.** The payload is stored at `compilation.basicIntel`; the renderer has `basicIntelSingleton` (`BasicIntelService.ts`). The asm slot is untouched by a BASIC check, and the reverse. | Today a BASIC check wipes the asm intel. Two languages may be open in one project (an asm library next to a BASIC root). |
| E4 | **Last good snapshot.** A check with errors keeps the previous `basicIntel`. Warnings never block publishing; the `runWorker` rule changes to "no error-severity item". | Intel must survive a half-typed line. Warnings are normal in BASIC programs (W100). The asm side gets the same fix (Q2). |
| E5 | **Stale positions are guarded by the word under the cursor.** The service answers position queries from the snapshot's line and column. A hit counts only if the snapshot span's text, as recorded, equals the word at that position in the live model. Otherwise it falls back to a scope-aware name lookup: the routine whose recorded line range contains the cursor, then globals. | The snapshot is up to 1.2 s plus a compile behind the model, or older while there are errors. A wrong answer is worse than no answer. |
| E6 | **Providers follow the asm split**: Monaco-free `compute*()` functions in `basic-providers.ts` and a thin `registerBasicProviders(monaco, …)` for language `zxbas`. Registered in `monacoBootstrap.ts` next to `registerZ80Providers`. | Node-project tests without Monaco, as for asm. |
| E7 | **Structure-only features are text-based**: folding, block-match highlight and the completion context (what is being typed where). Symbol features use the snapshot. | They must work while the file does not parse and before the first check finishes. |
| E8 | **Static help data is generated, not hand-written.** `npm run kbasic:help` writes `src/common/kbasic/help-data.generated.ts` from the spec JSON and `stdlib-api.json`, with the attribution line. A test fails when the generated file is out of date. The Monarch keyword lists come from the same data. | One source of truth. It also removes the third hand-kept keyword list. |
| E9 | **For library routines, the bound routine wins; the catalogue fills gaps.** An included library routine is shown from its `RoutineSymbol` plus Klive's own doc comment. A routine from a library that is not included is completed from `stdlib-api.json`. Accepting it inserts the `#include <lib.bas>` line if it is missing (`additionalTextEdits`). | The bound routine is exact (types, defaults). The catalogue is the only source for what is not yet included. |
| E10 | **Library symbols are read-only.** Definition and hover work in `<kbasic-stdlib>` files: definition opens a read-only model with the bundled text (Q4). Rename refuses library symbols, and refuses renames that would collide with one. | Users must not edit the bundle. Reading the code is still valuable. |
| E11 | **Macro-expanded uses are excluded from rename and highlighted only as references.** A use counts as editable only if its span's text, case-folded and sigil-stripped, equals the symbol's name. | `siteSpan` gives a macro use the span of the whole macro call. Renaming there would corrupt it. |
| E12 | **Case follows the program.** Identifier comparisons in completion filtering and rename collision checks use the program's `case-insensitive` option, which is carried in the payload. Keywords are always case-insensitive. | `case-insensitive` and `#pragma case_insensitive` change identifier identity. |
| E13 | **zxbc mode gets static features only.** With `zxbasic.compiler = zxbc` there is no `basicIntel`. Keyword hover, keyword and library completion, signature help for built-ins, folding and block highlight still work. | The external compiler produces no symbols. Static help costs nothing to keep. |
| E14 | **The open file is analysed even when the root does not include it** (Q3). When the active `zxbas` file is not in the root's `sources`, the scheduler also checks that file as its own root. Its intel is keyed by root path, and the service picks the snapshot that contains the active file. | Otherwise a library file being written in the project gets nothing until it is included. |

---

## 3. The payload — `BasicIntelData`

It lives in `src/common/abstractions/BasicIntel.ts`. It is plain data, safe for IPC, and positions
are 0-based like `SymbolReferenceInfo`.

```ts
type BasicIntelData = {
  readonly rootFile: string;               // the file this snapshot was compiled from
  readonly caseInsensitive: boolean;       // E12
  readonly files: ReadonlyArray<{ index: number; path: string; library: boolean; virtual: boolean }>;
  readonly symbols: BasicSymbolInfo[];     // index = symbol id
  readonly occurrences: BasicOccurrence[]; // declarations and uses, sorted by (file, line, column)
  readonly scopes: BasicScopeInfo[];       // [0] = globals; one per routine body
  readonly outline: BasicOutlineEntry[];   // per file, nested
  readonly defines: BasicDefineInfo[];     // #define definitions (Phase 1, §4.1)
};

type BasicSymbolInfo = {
  readonly id: number;
  readonly name: string;                    // as declared, no sigil
  readonly kind: "variable" | "array" | "const" | "sub" | "function" | "param" | "label" | "lineNumber";
  readonly scopeId: number;                 // the scope it is declared in
  readonly declaration: BasicLocation;      // definedAt for routines
  readonly forwardDeclaration?: BasicLocation; // DECLARE
  readonly typeText?: string;               // typeText(KType), e.g. "UByte", "String"
  readonly detail: string;                  // one-line signature used by hover, outline and completion
  readonly storage?: "global" | "local" | "param";
  readonly byref?: boolean;
  readonly implicit?: boolean;              // created by a use (W100)
  readonly constValue?: string;             // formatted folded value
  readonly arrayBounds?: string;            // "(0 TO 9, 1 TO 3)"
  readonly params?: BasicParamInfo[];       // routines: name, typeText, byref, isArray, default text
  readonly returnType?: string;
  readonly convention?: string;             // FASTCALL / STDCALL
  readonly doc?: string;                    // the ' comment block directly above the declaration
  readonly bank?: number;                   // CODEBANK, 0 = resident
};

type BasicOccurrence = BasicLocation & {
  readonly symbolId: number;
  readonly role: "declaration" | "use";
  readonly editable: boolean;               // E11: false for macro-site and other non-exact spans
};

type BasicScopeInfo = {
  readonly id: number;
  readonly routineId?: number;              // absent for globals
  readonly fileIndex: number;
  readonly startLine: number;               // header line
  readonly endLine: number;                 // END SUB / END FUNCTION line
  readonly symbolIds: number[];             // declared here, in declaration order
};

type BasicLocation = { fileIndex: number; line: number; startColumn: number; endColumn: number };
```

The rules for building it:

- **Lines** are physical lines (`SourceFile.position`), not `#line`-mapped ones. The editor shows
  physical lines.
- **What is left out.**
  - Symbols declared in library files but **not referenced** from user files are dropped.
  - So are names that start with `__`, which are library internals.
  - This keeps the payload small: `zx0.bas` alone is 3000 lines.
  - Library routines that *are* used keep their declaration, so go-to-definition works.
- **Budget.** A target of under 200 KB serialised for the largest corpus program. It is measured in
  Phase 1 and recorded in §9.

---

## 4. Design

### 4.1 The producer (`src/main/kbasic/intel/extract.ts`)

`extractBasicIntel(result: KBasicFrontEndResult): BasicIntelData | undefined` returns `undefined`
when `result.bound` is undefined. It works as follows:

1. **Symbols and scopes.** Walk `bound.globals`, then every `RoutineSymbol.scope`, assigning ids.
   - Parameters come from `routine.params`. Their body variable (`ParamSymbol.symbol`) maps to the
     **same id**, so uses inside the body resolve to the parameter.
   - Labels and line numbers come from `bound.program.labels`.
2. **Occurrences.** For each symbol, add its declaration `span` and every span in `uses`.
   - Convert each span with `SourceFile.position`.
   - Mark `editable` by comparing the span text with the name (E11). For an implicit variable, the
     first use is its "declaration".
3. **Routine end lines.** Take them from the AST's `end` node of each `SUB`/`FUNCTION`. They become
   the scope ranges used for completion and the E5 fallback.
4. **Doc comments.** A run of whole-line `'` or `REM` comments immediately above a declaration line,
   with no blank line between, found through `program.comments`. Klive's stdlib already writes them
   this way (`attr.bas`).
5. **`detail`** strings come from `typeText` and the routine shape, e.g.
   `FUNCTION ATTR(BYVAL row AS UByte, BYVAL col AS UByte) AS UByte`.
6. **Outline**, per file:
   - routines, with params and locals as children;
   - labels (not line numbers, which would flood a classic program);
   - constants and global `DIM`s;
   - `CODEBANK` blocks.

**Gaps to close in the front end in this phase:**

- **Named-argument names and the `NEXT` variable** are recorded as uses if the survey's suspicion
  holds. The binder then calls `noteUse` for them. This needs test coverage either way.
- **`#define` definitions.** `PreprocessResult` gains
  `defines: { name, span, uses: Span[], body: string, params?: string[] }[]`.
  - It is collected only when a flag asks for it, so builds pay nothing.
  - These feed hover (the body), definition and references. Rename of macros is out of scope (§8).
- **Header options for hover.** The extractor records each `'@name` line's span and resolved value,
  so hovering `'@heap-size` shows the option's `describe` text and its effective value.

### 4.2 Transport and state

- `KBasicCompiler.run(filename, background = true)` returns `{ errors, basicIntel }`.
  `SimpleAssemblerOutput` gets an optional `basicIntel?` field.
- In `runWorker.ts`:
  - publish when there is no error-severity item (E4);
  - dispatch `setBasicIntelAction(intel)` when the output has `basicIntel`;
  - otherwise use the existing asm path.
  - A BASIC check never dispatches `setLanguageIntelAction`.
- State is `compilation.basicIntel: Record<rootFile, BasicIntelData>`.
  - Normally there is one entry; E14 can add a second.
  - The entry is cleared when the project closes or the build root changes.
  - Reducer tests go next to the existing `compilation-reducer` tests.
- E14 (the open file is not in the root's sources): `startBackgroundCompile` already knows the
  active file. If the last snapshot's `files` does not contain it, the scheduler queues a second
  check of that file. That is one extra compile, only for such files.

### 4.3 The renderer service (`src/renderer/appIde/services/BasicIntelService.ts`)

The interface is `IBasicIntelService`, with a singleton subscribed like `languageIntelSingleton`.

- **Indexes:**
  - occurrences per file, sorted, with binary search by (line, column);
  - symbols by id;
  - scopes per file by line range;
  - path to file index, case-normalised on Windows.
- **Queries:**
  - `symbolAt(path, line, column, wordAtCursor)`, which applies the E5 guard;
  - `definition(id)`, `references(id, includeDeclaration)`;
  - `visibleSymbols(path, line)`: the routine scope's symbols, then globals not shadowed;
  - `outline(path)` (fixing the asm `() => 0` problem for BASIC);
  - `routineByName(name, path, line)`, used by signature help.
- **Snapshot choice:** the entry whose `files` contains the active path, preferring the build root's.

### 4.4 Static help data (`src/common/kbasic/help-data.generated.ts`)

Generated by `scripts/kbasic-help-data.cjs` (`npm run kbasic:help`) from:

- **Spec `keywords`, `statements`, `functions`, `types` and `preprocessor`.** Each entry gets
  `{ name, kind, display, summary }`.
  - `display` is a readable form derived from the EBNF. The generator strips the production name
    and the quotes and keeps `[ ]` for optional parts: `BORDER expr`, `ABS(expr)`.
  - An entry whose EBNF does not reduce cleanly is reported by the generator. It gets a
    hand-written override in `scripts/kbasic-help-overrides.json`, which is reviewed and small.
- **`stdlib-api.json` `libraries` and `routines`:** name, include line, parameters, returns and
  summary.
- **The attribution line** from both files' headers, emitted as a comment and as an exported
  constant. Hover shows it in the footer of keyword and library help (Q5).

`test/kbasic/help-data.test.ts`:

- regenerates the file in memory and compares it with the committed one;
- checks that every `KEYWORDS` entry has help;
- checks that the Monarch word lists in `zxBasLanguageProvider.ts` are built from it (E8).

Header-option completion and hover read `OPTION_SPECS` directly (the renderer can already import
`src/main/kbasic` syntax-layer code). That module must stay free of Node imports, which a test
checks.

### 4.5 The language configuration (`zxBasLanguageProvider.ts` `options`)

- `comments: { lineComment: "'" }`.
- Brackets `()`.
- Auto-closing and surrounding pairs `()` and `""`.
- A `wordPattern` that keeps a trailing `$` sigil and `@` address-of out of the word but treats
  `name$` as one word for the E5 check.
- `onEnterRules` / `indentationRules` that indent after block openers and outdent `END …`, `NEXT`,
  `LOOP`, `WEND`, `ELSE` and `ELSEIF`.

This is cheap, and the folding and block-match features need the same block table (§4.6).

### 4.6 The providers (`src/renderer/appIde/services/basic-providers.ts`)

All logic is in Monaco-free functions; `registerBasicProviders` only adapts them.

| Provider | Function | Data |
|---|---|---|
| Hover | `computeBasicHover` | Symbol → `detail`, type and storage line, const value, doc comment, file (relative, "standard library" for virtual files). If there is no symbol, use keyword or function help from §4.4. In a header line, use the option help. A number gets the asm side's numeric hover (`computeNumericHover`, reused, extended to the literal forms listed in the spec's `lexical.numeric_literals`). |
| Definition | `computeBasicDefinition` | `#include` target first (file or `<lib.bas>`), then symbol → declaration. A routine with a `DECLARE` returns both locations. `#define` → its line. |
| References | `computeBasicReferences` | Symbol → occurrences, honouring `includeDeclaration`. |
| Document highlight | `computeBasicHighlights` | Symbol occurrences in this file (read/write kinds are not tracked; plain highlights), or the matching block keywords (E7) when the cursor is on one. |
| Completion | `computeBasicCompletions` | Context from text (§4.7), then candidates. |
| Signature help | `computeBasicSignatureHelp` | Call context from text (§4.7), then a user routine (`routineByName`), a built-in from help data, or a library routine. Triggers: `(`, `,` and space (for paren-less `SUB` calls and statements). |
| Rename | `computeBasicRenameEdits` / `computeBasicRenameValidation` | §4.8. |
| Document symbols | `computeBasicDocumentSymbols` | `outline(path)`. |
| Folding | `computeBasicFoldingRanges` | Text only (E7). |
| Links | `computeBasicIncludeLinks` | `#include "x"` / `#include <x>` → `klive.openIncludeFile`, as asm does. |

### 4.7 The text context scanner

`scanBasicContext(lineText, column, previousLines)` is pure and table-driven. It knows strings,
`'`/`REM` comments, `:` statement separators and `ASM … END ASM` regions, which get no BASIC
completion. It returns one of:

- `header-option` — in an `'@` line before the first code line;
- `directive` — after `#`;
- `pragma` — after `#pragma`;
- `include-path` — inside `#include <` or `"`; offers library names from help data and project
  `.bas`/`.zxbas` files;
- `type` — after `AS`;
- `label` — after `GOTO`, `GOSUB`, `RESTORE` or `ON … GOTO`;
- `statement-start` — keywords valid as statements plus callable `SUB`s;
- `expression` — functions, variables, constants and arrays in scope;
- `call(name, argIndex)` for signature help. It counts nested parentheses and commas outside
  strings, and treats `name arg, arg` at statement start as a paren-less call when `name` is a
  `SUB`.

Snippets for `SUB`, `FUNCTION`, `FOR`, `IF … END IF`, `DO … LOOP` and `WHILE … WEND` are offered at
`statement-start`.

**Keyword case:** completion inserts keywords in upper case unless the user has typed a lower-case
prefix, in which case lower case (Q6).

### 4.8 Rename

The rename is validated in this order:

1. **The target.** It must be a user symbol in a non-library file: a variable, array, constant,
   routine, parameter or label. Line numbers are not renamable. `#define`s are out of scope (§8).
2. **The new name.** It must be a valid identifier per the spec's `lexical.identifiers` (sigil rules
   included: a `String` variable may carry `$`, and the sigil is not part of the new name). It must
   not be a keyword (`KEYWORDS`).
3. **Collisions**, compared with E12 rules:
   - no symbol of the same name visible in the target's scope, or in any routine scope where one of
     its uses sits;
   - no library routine of that name.

The edits are:

- every `editable` occurrence (E11), replacing only the name part and keeping any sigil the
  occurrence had;
- edits in the current file go back as a Monaco workspace edit; edits in other files go through the
  existing `applyExternalEdits` callback, as asm does.

The rename is **refused** when any occurrence is non-editable. The message names the macro use, so
nothing is renamed half-way.

---

## 5. Phases

Each phase ends green on its focused tests, `npm run build:check` and, when renderer React code is
touched, `npm run lint:renderer`. Sizes are this plan's estimates.

### Phase 0 — groundwork that needs no symbols (S)

This phase delivers part of G8.5:

- the §4.5 language configuration;
- the text-based folding and block-match highlight;
- the `runWorker` warnings rule (E4), for the asm side too (Q2), each with a test;
- the help-data generator, overrides and test (§4.4);
- the Monarch lists switched to the generated data.

Folding and the scanner get node tests over the corpus. Every corpus file must fold without an
unmatched block.

### Phase 1 — the producer (M)

- `BasicIntelData` and `extractBasicIntel`.
- Uses for named arguments and `NEXT`.
- `#define` collection behind a flag.
- Doc comments and header-option spans.

The tests use `bind-kit` with in-memory readers. They cover:

- shadowing (local `x` vs global `x`);
- parameters resolving to one id;
- an implicit variable;
- `DECLARE` + definition;
- a label and a line number;
- a use inside a macro expansion (`editable: false`);
- a library routine used and one included but unused (dropped);
- `case-insensitive` on and off;
- `#line`.

Measure the payload size and the check time on the largest corpus programs, and record both in §9.

### Phase 2 — transport, state, service (S–M)

- `checkFile` returns intel; the `runWorker` branch; the `compilation.basicIntel` slot, actions and
  reducer.
- `BasicIntelService` and its E5 guard.
- E14 second check.

Service tests are modelled on `language-intel-service.test.ts`. They include stale-snapshot cases:
a line inserted above the symbol, the symbol renamed in the live text, and a snapshot from before an
error.

### Phase 3 — hover, definition, references, outline (M)

This is the roadmap's low-hanging pair, plus outline. It covers G8.1, G8.2 and the outline part of
G8.5:

- the providers, with links and highlights;
- registration in `monacoBootstrap.ts`;
- `MonacoEditor.tsx` feeding `basicIntelSingleton`;
- read-only library models (Q4).

There are node tests for every `compute*` function, plus the running-app check (§7).

### Phase 4 — completion and signature help (M)

This covers G8.3 and the signature-help part of G8.5:

- the scanner contexts;
- candidates, snippets, the auto-`#include` edit (E9);
- signature help for user, built-in and library routines;
- header options.

### Phase 5 — rename (S–M, after Phase 3)

This covers G8.4: §4.8 validation and edits, cross-file through `applyExternalEdits`. The tests
cover:

- a sigil kept;
- a collision in a routine scope;
- a library-name collision;
- a refused macro case;
- a case-insensitive program;
- a rename across an `#include`.

### Phase 6 — docs, roadmap, lessons (S)

- **The user guide.** `docs/content/working-with-ide/zxb.mdx` gets a section "Editing ZX BASIC"
  with what each feature does, plus a note on zxbc mode (E13).
  - Code fences use only registered languages.
  - Run `npm run doc:build && npm run doc:check`.
- **The roadmap.** Mark G8.1–G8.5 done in the base plan, update §2 and §4 (W8) of the competitive
  analysis, and mark §11.1–§11.2 done in the compiler plan.
- **Scripts.** Extend `scripts/kbasic-ide-check.cjs` with hover, definition and completion probes
  in the running IDE.
- **Theming.** Any new hover markdown styling goes into `.ai/ui-theming-intent-and-lessons.md` (the
  standing rule). None is expected: hovers use Monaco's markdown.

---

## 6. Risks

- **R1 — freshness.** Intel lags the text by the debounce plus a worker spawn plus a full front-end
  run, and freezes while the file has errors.
  - E5 keeps answers correct, not fresh.
  - If Phase 1's measurement shows checks over ~300 ms on real programs, the follow-ups are:
    a persistent worker (no spawn per check), caching lexed library files by content hash, or
    Q1's renderer-side front end.
- **R2 — any parse error disables binding.** While a line is half-typed, the snapshot is the last
  good one. New symbols declared since then are unknown to completion until the file parses again.
  Error-tolerant binding (binding the recovered AST and skipping failed statements) is the real
  fix. It is deferred (§8, Q7) because it touches every binder error path.
- **R3 — EBNF to display text.** Some spec forms will not reduce to a readable line. The generator
  reports them instead of guessing, and the override file stays small and reviewed.
- **R4 — payload size.** Programs that include large libraries could push large snapshots through
  a forwarded Redux action on every check. Dropping unused library symbols (§3) and the measured
  budget address this. If it is still too large, the renderer could fetch the snapshot on demand
  instead of receiving it in state.
- **R5 — paren-less calls in signature help.** `mySub a, b` is a call only when `mySub` is a `SUB`.
  The scanner asks the service. Without a snapshot it offers nothing rather than guess.

---

## 7. Verification

- **Unit (node project):**
  - extractor, front-end use gaps, `#define` collection;
  - help-data freshness;
  - service and E5 guard;
  - every `compute*` function;
  - scanner contexts;
  - rename validation;
  - folding over the corpus.
- **Reducer:** the `basicIntel` slot is kept on an error and replaced on success; a BASIC check
  leaves `languageIntel` untouched, and the reverse.
- **In the IDE** (`scripts/kbasic-ide-check.cjs`; CDP recipe in `.ai/ui-theming-intent-and-lessons.md`):
  - On a sp48 BASIC template project:
    - hover a local, a global, a const, a `FUNCTION` with a doc comment, `PRINT` and `'@optimize`;
    - Go to Definition into an included library file;
    - find references of a shadowed name;
    - complete after `AS`, after `GOTO`, a library routine that adds its `#include`, and a header
      option value;
    - signature help in a nested call;
    - rename across two files and undo;
    - fold a `SUB`;
    - check the outline of an included file.
  - Type an error and confirm that hover still works on unchanged symbols.
  - Switch to `zxbc` and confirm that keyword help remains.

---

## 8. Out of scope

- **Language features in `ASM … END ASM` blocks.** They are `zxbasm` today and become `kz80-asm`
  per the compiler plan. Asm intel for them would need the BASIC symbols exported to the asm side.
- **Semantic tokens** for BASIC (colouring routines, constants and parameters differently). This
  is a natural follow-up on the same payload, but not in the roadmap's list.
- **Error-tolerant binding** (R2, Q7).
- **Renaming `#define` macros**, line numbers and library symbols.
- **Code actions and quick fixes**, for example "declare this implicit variable" for W100, or "add
  the missing `#include`" from a diagnostic. These are good follow-ups.
- **Inlay hints**, such as parameter names at call sites.
- **Formatting.**
- **Workspace-wide symbol search** across files not reachable from any checked root.
- **NextBuild header names** (compiler plan §5.4) in header-option completion until that lands.

---

## 9. Implementation notes

**Where the code is.**

| Part | Files |
|---|---|
| Payload | `src/common/abstractions/BasicIntel.ts` |
| Producer | `src/main/kbasic/intel/extract.ts`; `KBasicCompiler.checkFile` and `analyseFile`; `runFrontEnd(..., { collectDefines })` |
| Transport | `src/main/compiler-integration/backgroundIntel.ts` (E3/E4 rule), `compilerWorker.ts` (E14), `compilation.basicIntel` + `SET_BASIC_INTEL` |
| Service | `src/renderer/appIde/services/BasicIntelService.ts` (`basicIntelSingleton`) |
| Text structure | `basic-structure.ts` (folding, block match, indentation), `basic-context.ts` (scanner) |
| Providers | `basic-providers.ts`, registered in `monacoBootstrap.ts` |
| Help data | `scripts/kbasic-help-data.cjs`, `scripts/kbasic-help-overrides.json`, `src/common/kbasic/help*.ts` |
| Tests | `test/kbasic/intel/` (74 node tests); `scripts/kbasic-ide-check.cjs` part `intel` (22 probes in the running IDE) |

**Measurements (Phase 1).** Over the 190 corpus programs, the largest snapshot is 25 KB serialised
(`codebank/many-banks.zxbas`, 31 symbols), well under the 200 KB budget. The slowest front end plus
extraction is 22.5 ms, for a program including seven libraries (zx0, string, print64, print42,
input, megalz, fmath); corpus programs take 0.4–5 ms. R1's 300 ms threshold is far away, so the
follow-ups (persistent worker, renderer-side front end) are not needed.

**Front-end gaps found and closed.**
- The suspicion held: named-argument names and the `NEXT` variable were not uses. `NEXT i` is now
  pushed to the loop variable's `uses` (not through `noteUse`, so it adds no bank reference).
  Named-argument names go to a separate `BindResult.paramUses`, because adding them to the
  parameter variable's `uses` would silence its unused-variable warning.
- `#define`s: `PreprocessResult.defines` behind `collectDefines`, with uses from expansions,
  `#ifdef`, `#ifndef` and `#undef` (deduplicated: a macro body's uses repeat with each expansion).
- Header options: `KBasicFrontEndResult.header`; the effective value is found by applying the
  option's spec to a copy of the defaults and seeing which field changes.

**Design changes made while building.**
- **E11 is stricter than written.** A use counts as editable only when its text is the name under
  the program's case rule (exact in a case-sensitive program), *and* it is not a recorded macro-use
  site. Case-folding alone would have let `#define X x` rename the macro's use of `X`.
- **Uses wider than the name** (`@x`, an array element's span) are narrowed to the name, so they
  stay editable.
- **Rename refuses on a stale snapshot.** Found in the running IDE: after edits shift lines, the
  E5 fallback finds the right symbol but the snapshot's positions are old, so edits would land in
  the wrong place. The rename now checks that every occurrence in the current file still reads as
  the name, and asks to try again otherwise.
- **E14 runs in the same worker**, not as a second scheduled check: the renderer passes the open
  `.zxbas` file, and the worker analyses it only when the build root's snapshot does not contain it.
  With no build root at all, the open file is checked as the root (so it also gets diagnostics).
- **E4 for BASIC lives in the compiler:** `checkFile` omits the snapshot of a root with errors, so
  `runWorker` publishes whatever snapshots arrive; for the assembler the rule is
  `hasErrorSeverity()`. `SET_LANGUAGE_INTEL` was missing from `ActionTypes` (a baseline type error);
  it is added.
- **Library tabs:** the existing `nav <kbasic-stdlib>/x.bas` read-only tab (from the debugger work)
  serves Q4. Monaco's `Uri.file` puts a slash before `<kbasic-stdlib>`; the editor opener strips it.
- **The outline includes implicit variables** (created by a use, W100), at their first use; §4.1
  said "global `DIM`s". In a classic-style program most variables are implicit, and Go to Symbol
  listing none of them was the first thing a user reported.
- **Outline of a library file** lists all its routines (not only the used ones), since the outline
  entries cost little and the tab is for reading.
- **The Monarch word lists dropped words Klive BASIC does not know** (Sinclair-only `CAT`, `CLEAR`,
  `LIST`…, and NextBuild statements such as `LAYER`, `SPRITE`). They are no longer coloured as
  keywords; library routines Klive has (`ATTR`, `HEX16`, `print64`…) now are, as functions.

**Overrides.** `scripts/kbasic-help-overrides.json` holds 28 keyword entries and one directive:
the block statements (whose EBNF spans lines: `ASM`, `DO`, `FOR`, `FUNCTION`, `IF`, `SUB`, `WHILE`),
the keywords that are only parts of other statements (`AS`, `AT`, `BYREF`, `THEN`, `TO`…), the
CODEBANK extension, `SIZEOF` and `#define`. The generator reports any new keyword without a summary.

**Error-tolerant binding (Q7): what users run into.** While a file does not parse, symbols declared
since the last good check are unknown to completion and hover; the IDE check confirms hover on
unchanged symbols keeps working. Nothing else surfaced during this work.

---

## 10. Questions

### 10.1 Answered by the project author (2026-10-03)

All seven suggested answers were accepted.

| Q | Question | Answer | Where |
|---|---|---|---|
| Q1 | Where does the analysis run? | Main-side, in the existing background check. A renderer-side front end on the unsaved text is revisited only if Phase 1's measurement fails the R1 threshold. | E2, R1 |
| Q2 | Apply the "warnings don't block intel" fix to the asm side too? | Yes, in Phase 0, with a test. | E4, Phase 0 |
| Q3 | Check the open file on its own when the build root does not include it? | Yes. | E14, §4.2 |
| Q4 | How are library files shown? | A read-only editor tab named `<kbasic-stdlib>/name.bas`. | E10, Phase 3 |
| Q5 | Attribution and upstream links in keyword and library hovers? | The CC BY attribution goes in the hover footer. No external link until a page on Klive's own docs site covers the keyword. | §4.4 |
| Q6 | Keyword case in completion? | Upper case, unless the typed prefix is lower case. | §4.7 |
| Q7 | Error-tolerant binding? | Left out. What users run into is recorded in §9. | R2, §8 |

### 10.2 Still open

Nothing.

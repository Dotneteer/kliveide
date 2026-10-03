# Source Assertions, Watchpoints And One-Shot Breakpoints Plan (G1.5, G1.6)

Status: **draft** (2026-10-03). Nothing is implemented.
Base plan: [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md), §G1, decision D3. This plan covers
**G1.6** (temporary / one-shot breakpoints) and **G1.5** (DeZog-compatible `ASSERTION` and `WPMEM`
source comments), plus a link between WPMEM watchpoints and Klive's Watch panel.
Builds on: [CONDITIONAL_BREAKPOINTS_PLAN.md](CONDITIONAL_BREAKPOINTS_PLAN.md) (the condition engine;
its §4.8 says a DeZog expression is turned into that engine's tree, not run by a second engine) and
[BREAKPOINT_CONDITIONS_IN_C_PLAN.md](BREAKPOINT_CONDITIONS_IN_C_PLAN.md) (E9: the stop decision,
one-shots included, stays in TypeScript).
G1.4 (LOGPOINT) is **not** in scope, but the comment scanner and the DeZog expression front end
built here (Phases 3 and 4) are the ones G1.4 reuses.

> **Standing rule (from the base plan):** when this ships, update §2 and §4 of
> [LANDING_PAGE_COMPETITIVE_ANALYSIS.md](LANDING_PAGE_COMPETITIVE_ANALYSIS.md) and mark G1.5/G1.6
> done in the base plan, in the same change. Any visual change also updates
> `.ai/ui-theming-intent-and-lessons.md`.

> **Provenance (D3):** only DeZog's *conventions* are adopted. No DeZog code is copied, converted or
> translated. §2 records the conventions in Klive's own words.

---

## 1. What is being added

1. **One-shot breakpoints (G1.6).** A breakpoint that removes itself the first time it actually
   stops the machine. Users can create one from both gutters (Shift+click), from menus, from the
   Breakpoint dialog and with `bp-set … -once`. One-shots are never saved with the project.
2. **ASSERTION comments (G1.5).** `; ASSERTION A < 5` in a source file becomes a breakpoint that
   stops when the expression is **false**, and the Output pane says which assertion failed and with
   what values.
3. **WPMEM comments (G1.5).** `; WPMEM fill_colors, 5, w` becomes a memory watchpoint (a memory
   read and/or write breakpoint) over a byte range.
4. **Watch ↔ watchpoint link.** A Watch panel row can create a watchpoint over the watched bytes and
   shows when its bytes are already watched, whether that watchpoint came from WPMEM or not.
   (DeZog 3.8.0 added the same idea: data watchpoints from its WATCH pane.)

The gestures were agreed with a clickable mockup on 2026-10-03; §4.2 records them.

### 1.1 What the code already has (survey, 2026-10-03)

- **`BreakpointInfo.oneShot` exists** (`src/common/abstractions/BreakpointInfo.ts`). It is documented
  as "removed the first time it fires, never persisted, always paired with `owner: {kind:"session"}`".
  It has three internal users: run-to-cursor (`RunToCursorCommand.ts`), the NEX entry-point stop
  (`NexLaunchCommand.ts`) and Z88 snapshot load (`z88SnapshotLoad.ts`). Users cannot create one.
- **Consumption.** `DebugStepDecision.ts` calls `debugSupport.consumeOneShotsAt(pc, partition)`
  whenever the machine stops at an execution address, inside the re-trigger guard.
  `consumeOneShotsAt` removes **every** enabled one-shot at that address, so:
  - **Bug B1:** a one-shot whose own condition or hit rule did not pass is still consumed when a
    *different* breakpoint stops the machine at the same address.
  - Memory and I/O one-shots are never consumed. That is harmless today, because nothing creates one.
- **Bug B2 (suspected; Phase 0 pins it).** The storage key (`getBreakpointStorageKey`) is location +
  kind only; owner and `oneShot` are not part of it. `DebugSupport.addBreakpoint` replaces whatever
  holds that key. So `run-to $8000` while the user has a breakpoint at `$8000` replaces the user's
  breakpoint with a session one-shot, which is then consumed: the user's breakpoint is silently
  lost.
- **Ownership.** `BreakpointOwner` has `nex` and `session`; absent means the project.
  `BreakpointScope` decides which subset an operation may replace wholesale. A build-owned set
  (§4.4) is a third owner of the same kind.
- **Several definitions per address** are already supported, with one hit counter per definition
  (partition entries, bank-relative projections; CONDITIONAL_BREAKPOINTS_PLAN §4.5, C12).
- **Memory breakpoints are one address each** (flags in a 64K table). There is no range.
- **Disassembly gutter** (`BreakpointIndicator.tsx`): right-click sets/removes, Cmd/Ctrl+click runs
  here, double-click edits, and **plain click does nothing**. The disassembly row has an
  `onContextMenu` prop (`DisassemblyRow.tsx`) but no row menu in the live view. The NEX plan §10.4
  already names a row menu as the better home for these gestures.
- **Editor gutter** (`MonacoEditor.tsx`): left-click toggles, and right-click opens the margin menu
  (`marginBreakpointMenu.ts`: Edit Condition…, Edit Hit Count…, Enable/Disable, Reset Hit Count,
  Remove, and Add, Add Conditional…). The editor's own context menu has the "klive-debug" group:
  Toggle Breakpoint at Statement, Run to Cursor, Step Into *target*.
- **Glyphs:** `bp-conditional.svg` (dot with "=" knocked out) and `bp-inactive.svg` (hollow), with
  matching Monaco mask classes in `MonacoEditor.module.scss`. Source breakpoints are
  `--color-breakpoint-code`, binary ones `--color-breakpoint-binary`.
- **Klive assembler comments.** `common-asm-parser.ts` attaches the end-of-line comment to each line
  node, and comment-only lines become line nodes too, so the comment text is available at emit time,
  where the line's address is known.
- **sjasmplus.** `SjasmPCompiler.ts` reads the `.sld` file but keeps only `T` (trace) records.
- **Watches.** `WatchInfo` = `symbol`, `type` (`b w l -w -l f a s`), `length`, `direct`. They are
  stored in the project's `debugger.watchExpressions` and resolved by the Watch panel against the
  last build's `compRes.symbols`. A watch shows memory at a symbol. It is not a watchpoint.
- **Project file.** `DebuggerState` in `src/main/projects.ts` holds `breakpoints` and
  `watchExpressions`; that is where the per-project toggles go (§4.8). The settings registry has no
  project-bound settings.
- **Breakpoints panel** has a toolbar (Add, Group by kind, Remove all).
- **The condition grammar**: names are case-insensitive; flags are `ZF`, `CF`, …; memory reads are
  `b[…]` / `w[…]`; labels are looked up in the last build's symbols, and reserved names that clash
  with a label are written in backticks.

---

## 2. DeZog's conventions (researched 2026-10-03)

Source: DeZog's `documentation/Usage.md` and `CHANGELOG.md` (latest entry 3.8.0), sections
"ASSERTION", "WPMEM", "LOGPOINT", "vscode breakpoint", "WATCHes", "Supported Assemblers". Where the
docs were silent, the fact was checked against DeZog's behaviour as described in its sources;
nothing was copied.

### 2.1 ASSERTION

- **Form:** a comment containing the keyword `ASSERTION` followed by an expression. The keyword may
  come after other comment text, and a later `;` ends the expression:
  `ld de,hl ; ASSERTION A < 5 && hl != 0 ; trailing note`.
- **Meaning:** stop when the expression is **false**. It is a breakpoint with the negated condition.
- **Bare `ASSERTION`** (no expression) means "assert false": it always stops.
- **Address:**
  - On an instruction's line, the check runs **before** that instruction runs, so
    `ld a,c ; ASSERTION a < 7` checks A's old value.
  - On a line of its own, it takes the next emitted address, which is effectively "after the line
    above". DeZog recommends this form.
- **Expressions:** registers (8- and 16-bit), labels and arithmetic on them, `== != < <= > >=`, `&`,
  `&& ||`, parentheses, and `b@(…)` / `w@(…)` memory reads. ZEsarUX spellings (`=`, `OR`, `peek()`)
  are also accepted.
  - Numbers appear as `0x12FA` and `7Fh`.
  - sjasmplus labels need their full dot notation.
  - **No flag names are documented.**
- **Failure report:** the stop reason reads "Assertion failed: <expr>" with the values substituted.
- **History:** the keyword was `ASSERT` before DeZog renamed it to avoid sjasmplus's own `ASSERT`.
  Klive accepts only `ASSERTION`.

### 2.2 WPMEM

- **Form:** `WPMEM [addr [, length [, access]]]` inside a comment.
  - `addr`: an expression, default the line's own address.
  - `length`: bytes, default 1.
  - `access`: `r`, `w` or `rw`, default `rw`.
- **No condition argument.**
- **Examples:**
  - `fill_colors: ; WPMEM, 5, w`: note the comma straight after `WPMEM` when `addr` is omitted;
  - `; WPMEM 0x0000, 0x4000`: a range, here a ROM write guard;
  - `defw 0 ; WPMEM, 2`: a stack guard.
- **Banks:** an omitted `addr` means the line's *banked* address; an explicit `addr` is a 64K
  address.

### 2.3 Switching them on

- DeZog 3.x removed the `-assertion` / `-wpmem` console commands. Each group is now a checkbox
  (exception-breakpoint filter) in VS Code's Breakpoints pane, and **all start off**.
- Klive deliberately differs: on by default, per project (decision S6).

### 2.4 Where DeZog reads them

- **sjasmplus:** from the SLD file. The source must contain
  `SLDOPT COMMENT WPMEM, LOGPOINT, ASSERTION`, or sjasmplus leaves the comments out of the SLD.
- **Other assemblers:** from the list file.
- Comments in code that was not assembled (a false `IF`) are skipped with sjasmplus only.

### 2.5 Not verified

- DeZog's operator precedence for `&` against `==`. If expressions follow JavaScript, `&` binds
  *looser* than `==`, the opposite of Klive's C3.
- Whether `$`-prefixed numbers work in conditions.
- The exact SLD record type and layout for the keyword comments.
- The exact WPMEM stop message.

Phase 4 settles the precedence by testing against a real DeZog installation (a behavioural oracle;
only Klive's own inputs and the observed results are recorded). Phase 3 settles the SLD layout
with a real sjasmplus.

---

## 3. Design decisions

### 3.1 One-shot breakpoints (G1.6)

| # | Decision | Why |
|---|---|---|
| O1 | **Shift+click** in a gutter creates a one-shot, in both the source editor and the disassembly view. On an existing regular breakpoint it turns it into a one-shot; on a one-shot it removes it. Plain click and right-click keep today's meanings. | Decided by the author (mockup). Plain click on the disassembly gutter is unused, so Shift+click is free in both views. |
| O2 | **Session only.** A user one-shot is `owner: {kind:"session"}`, is never saved and is dropped when the machine changes. Turning it back into a regular breakpoint ("Keep after it stops") makes it project-owned again. | Decided by the author. It matches run-to-cursor and the NEX entry stop. |
| O3 | **"First hit" means the first time it stops the machine.** A one-shot with a condition or a hit rule is consumed only when its own filters pass. `-once -hit 10` stops on the tenth hit and is then gone. | The only reading under which a filter combined with `-once` makes sense. Fixes B1. |
| O4 | **Run-to targets get their own key namespace** and never replace a user breakpoint. A user one-shot shares the location key with a regular breakpoint, because it is the same breakpoint with a flag. | Fixes B2. Run-to is the IDE's transient stop, not the user's breakpoint. |
| O5 | A one-shot can be any kind: execution, memory, I/O or NextReg. Consumption covers all of them. | Uniform model. A "break on the next write to `score`" is a natural one-shot. |
| O6 | **Glyph:** the breakpoint dot with a "1" knocked out (`bp-once.svg`), the same technique as the "=" mark. **Precedence when shapes compete:** inactive (hollow) > conditional (=) > one-shot (1). The Breakpoints panel always shows a `once` tag, whatever the glyph. | The gutter has room for one shape. Whether a breakpoint can fire matters more than whether it will last. Open question Q1. |

### 3.2 Source comments (G1.5)

| # | Decision | Why |
|---|---|---|
| S1 | ASSERTION and WPMEM breakpoints are **owned by the build** (`owner: {kind:"build"}`). They are never saved, and the whole set is replaced after every successful build. They are re-applied from the last build when the machine changes. | They are a projection of the source, as the build's symbols are. |
| S2 | **Their own key namespace** (`directive:<resource>:<line>:<n>`), so they sit alongside a user breakpoint at the same address. The machine stops if any of them stops it. | A user breakpoint on the instruction an assertion guards must not replace the assertion, or the reverse. |
| S3 | They **cannot be deleted** from the IDE, only disabled. `bp-del` on one says which comment created it. A disabled state survives rebuilds while the comment stays on the same line. | Deleting something the next build recreates would be a lie. Remove the comment to remove it. |
| S4 | **DeZog expressions go through a DeZog front end that builds Klive's condition tree.** The existing checker binds and compiles that tree as usual. The panel shows the original DeZog text, with the Klive form in the tooltip. | CONDITIONAL_BREAKPOINTS_PLAN §4.8. It also contains the precedence difference (§2.5) in one place. |
| S5 | An expression that does not translate becomes a **build warning on the comment's line**: shown in the Problems list and as a Monaco marker. That comment creates no breakpoint. An unknown label makes the breakpoint *inactive* (hollow), exactly as for a hand-written condition (C14). | The comment is source code, so its errors belong with build diagnostics. |
| S6 | **Per-project toggles, on by default:** `debugger.sourceComments.assertion` and `.wpmem` in the project file, where absent means on. They are switched from two toolbar buttons in the Breakpoints panel and with the `bp-comments` command. | Decided by the author. Someone who wrote assertions wants them, which is why Klive starts with them on where DeZog starts with them off. |
| S7 | **Sources:** the Klive Z80 assembler and sjasmplus. Klive BASIC, ZX BASIC, z88dk and Pasta80 are out of scope (§8). | These are the two assemblers DeZog projects use that Klive integrates. |
| S8 | Comments in code that is **not assembled** (a false `IF` branch) are ignored by both assemblers. Comments inside a **macro body** produce one breakpoint per expansion. | The address only exists where code is emitted. This matches sjasmplus, which DeZog-annotated projects are mostly written for. |
| S9 | **sjasmplus without `SLDOPT COMMENT`:** if the sources contain ASSERTION/WPMEM comments but the SLD has none, the build prints one warning with the line to add. Klive does not rewrite the source. | A silent nothing is the worst outcome. Inserting the directive behind the user's back is the second worst. |
| S10 | **WPMEM ranges become first-class:** a memory breakpoint gains an optional `length` (1–65 536, no wrap past `$FFFF`). `rw` creates a read definition and a write definition. `bp-set` gains `-len <n>`. | `WPMEM 0x0000, 0x4000` would otherwise be 32K definitions. The Watch link needs ranges too. |
| S11 | **Stop reports** go to the Output pane and name the source line: `ASSERTION failed at main.asm:42: A < 5  (A=$07)` and `WPMEM write at $8002 (fill_colors+2) by PC $8123, main.asm:40`. | DeZog reports the values. The Output pane is where Klive already explains stops. |

### 3.3 Watch ↔ watchpoint (two-way link)

| # | Decision | Why |
|---|---|---|
| W1 | **Terminology:** a *watch* shows a value; a *watchpoint* is a memory breakpoint. The UI and the docs use the two words that way. | The two features share a word in DeZog and in Klive. |
| W2 | A Watch row's context menu offers **Break on write / Break on read / Break on access / Remove watchpoint**. Each creates a user (project-owned) memory breakpoint covering the watch's bytes: `b`/`f` = 1, `w`/`-w` = 2, `l`/`-l` = 4, `a`/`s` = `length`. The items are disabled for a direct (`>`) watch, which has no memory. | Decided by the author (two-way link). Mirrors DeZog 3.8.0. |
| W3 | A watchpoint created from a watch is **anchored to the symbol** and re-resolved after every build, like a source breakpoint. If the symbol is gone, it is inactive. | A rebuild that moves the label must not leave the watchpoint on old bytes. |
| W4 | A Watch row shows a **watchpoint indicator** (the existing `bp-mem-read`/`bp-mem-write` glyphs) when any enabled memory breakpoint overlaps its bytes, whether user-made, watch-made or WPMEM. The tooltip lists them. Clicking the indicator reveals the row in the Breakpoints panel. | The panel and the watch then read as one feature. |
| W5 | The reverse direction: a memory breakpoint row in the Breakpoints panel offers **Add to Watch** when a build symbol starts at its address and no watch covers it. WPMEM never adds watches by itself. | Two-way without the Watch list filling up on its own. |
| W6 | Watches stay value displays: `w-add` and the Watch panel's refresh are unchanged. | Small, reviewable change; no new state in `WatchInfo`. |

---

## 4. Design

### 4.1 One-shot model and consumption

- **Model.** The documented pairing in `BreakpointInfo.oneShot` changes:
  - a *user* one-shot is a normal breakpoint (any kind, any binding, filters allowed) with
    `oneShot: true` and `owner: {kind:"session"}`;
  - a *run-to target* additionally has `runTo: true` and its own key prefix (O4).
  - Update the field docs.
- **Consumption (O3, O5).** The slow path (`decideFiltered` / `passesFilters`) already evaluates
  each definition at an address.
  - It records the keys of the definitions that **passed** for this stop.
  - `consumeOneShotsAt(address, partition)` becomes `consumeFiredOneShots()`, which removes exactly
    the one-shots among them.
  - Memory, I/O and NextReg stops take the same path, so their one-shots are consumed too.
  - The call stays inside the re-trigger guard in `DebugStepDecision.ts`, for the reason its comment
    gives.
- **The fired-definitions list** is also what S11's stop report needs. Expose it to the IDE as part
  of the stop information: which definition stopped the machine.
- **Run-to (O4).** `RunToCursorCommand`, the NEX entry stop and Z88 snapshot load set `runTo: true`.
  The storage key for `runTo` definitions is prefixed, so it never equals a user key.
- **Persistence.** The project save already skips session-owned breakpoints. Converting a
  breakpoint to a one-shot therefore takes it out of the next save, and converting it back puts it
  in.

### 4.2 Gestures (agreed with the mockup)

| Where | Gesture | Effect |
|---|---|---|
| Editor glyph margin | Shift+click | Add a one-shot; regular → one-shot; one-shot → removed |
| Editor inline statement marker | Shift+click | The same, for a statement (column) breakpoint |
| Editor margin menu (`marginBreakpointMenu.ts`) | right-click, empty line | New item **Add One-Shot Breakpoint** (hint "Shift+Click") between Add and Add Conditional |
| Editor margin menu | right-click, breakpoint | New toggle **Remove After It Stops** / **Keep After It Stops**, above Enable/Disable |
| Editor context menu ("klive-debug") | right-click in code | New action **Stop Here Once**, after Toggle Breakpoint at Statement |
| Disassembly gutter (`BreakpointIndicator`) | Shift+click | As in the editor glyph margin |
| Disassembly row | right-click outside the gutter | **New row menu:** Add/Remove Breakpoint, Add One-Shot Breakpoint, Run to Here (Cmd/Ctrl+click), Edit Breakpoint… (double-click) |
| Breakpoint dialog | checkbox | **Remove after it stops**, next to Enabled |
| Command | `bp-set <spec> -once …` | `-once` before `-hit`/`-if`. `bp-list` prints it, so a listed line pastes back |
| Breakpoints panel | row | `once` tag; context menu gains the same Remove/Keep toggle |

Tooltips gain "Shift-click to stop here once". The right-click on the disassembly gutter keeps its
toggle; only the rest of the row gets the menu. Monaco treats Shift+mousedown as "extend selection",
so the glyph-margin handler must `preventDefault` before Monaco sees it (R6).

### 4.3 Directive scanning

- **New module** `src/common/utils/source-directives/`, with no React and no Node:
  - `scanComment(text)` finds `ASSERTION`, `WPMEM` (and, for G1.4 later, `LOGPOINT`) as whole words
    anywhere in a comment. It ends the argument text at the next `;` and returns
    `{ directive, argsText, argsColumn }`.
  - `parseWpmemArgs(argsText)` handles the leading-comma form and the defaults.
- **Klive assembler.** When a line is emitted, a line node whose comment holds a directive adds a
  `SourceDirective` `{ fileIndex, line, column, directive, argsText, address, partition? }` to the
  output. The address is the assembly address at that line, which is the next instruction's address
  for a comment-only line (§2.1). Lines in a false `IF` are not emitted (S8).
- **sjasmplus.** Read the SLD's keyword-comment records alongside the `T` records and map them to the
  same `SourceDirective`, with the page from the SLD for the banked default address (§2.2). The
  record layout is confirmed with a real sjasmplus in Phase 3 (§2.5). S9 adds the missing-`SLDOPT`
  warning: Klive scans the source files it already lists for the keywords.
- **Output.** `DebuggableOutput` gains an optional `sourceDirectives?: SourceDirective[]`. Other
  compilers leave it absent.

### 4.4 Generated breakpoints

- **Where they are built.** `refreshSourceCodeBreakpoints` already runs after every build path and
  owns the condition symbols. A new step there turns `sourceDirectives` into breakpoints and
  replaces the build-owned set in one call: `resetBreakpointsTo` with a new scope `{kind:"build"}`.
- **Toggles.** The step reads the project's toggles (S6) and emits nothing for a group that is off.
- **ASSERTION.** An execution breakpoint at the directive's address (and partition), with
  `condition = !(<translated>)`, or no condition for a bare ASSERTION. It also carries `resource` and
  `line` for display and `directive: "assertion"`.
- **WPMEM.**
  - `addr` is evaluated at build time by the same DeZog front end, constant-folded against the
    build's symbols.
  - One memory definition per access kind, with `length` (S10).
  - The `partition` comes from the directive when `addr` was omitted, and is absent otherwise.
- **Disabled state.** It is held by the IDE in a session map keyed `resource:line:directive` and
  re-applied after each rebuild (S3).
- **Machine change.** The new machine inherits the symbol table and receives the build-owned set
  again from the last compilation.

### 4.5 The DeZog expression front end

- **Module:** `src/common/utils/breakpoint-condition/dezog-condition.ts`. It parses the DeZog
  expression grammar (§2.1) and produces the **same syntax-tree nodes** as `condition-parser.ts`,
  then hands them to `condition-checker.ts`.
- **Translation table:**
  - registers: same names, case-insensitive;
  - `b@(e)` → `b[e]`, `w@(e)` → `w[e]`, `peek(e)` → `b[e]`;
  - `=` → `==`, `OR`/`AND` → `||`/`&&`;
  - `0x…`, `…h`, `$…` → numbers;
  - an identifier that is not a register → a label node, dotted names included.
- **Precedence** follows whatever Phase 4 observes in DeZog (§2.5). The front end is the only place
  that knows it, and the printed Klive form is fully parenthesised.
- **Printer.** A Klive-syntax printer for the tooltip and for `bp-list`. Labels that the Klive
  lexer would not read back (dots, reserved names) are printed in backticks; R3 checks that
  backticks accept dots.

### 4.6 Memory ranges

- **Model.** `BreakpointInfo.length?: number` for memory breakpoints only. It is part of the
  identity: the key reads `$8000+5:W`, and the display key and `getBreakpointAddressSpec` follow.
- **`DebugSupport`** sets the kind flag on every address in the range. Removal clears only flags
  that no other definition still needs; a reference count per address and kind avoids rescanning.
- **The access specials** `VAL`/`ADDR` already give the accessed byte and address, so a condition
  on a range breakpoint works unchanged.
- **The dialog** gets a Length field for memory kinds. `bp-set` gets `-len`.

### 4.7 Watch link

- **`WatchPanel`** gains a row context menu (W2). The destructive delete moves into it, and the
  icon's right-click keeps its delete for compatibility.
- **The watchpoint** it creates is `{ memoryWrite|memoryRead, length, watchSymbol: "<symbol>" }`,
  project-owned. `refreshSourceCodeBreakpoints` resolves `watchSymbol` to `address` after each
  build (W3), and an unresolved one is inactive.
- **The indicator (W4)** comes from `listBreakpoints`: the panel already refreshes on
  `breakpointsVersion`, and an overlap test runs per row.
- **The Breakpoints panel** row menu gains **Add to Watch** (W5): `w-add <symbol>:<type>`, with
  the type chosen from the range length (1 → `b`, 2 → `w`, 4 → `l`, otherwise `a:<len>`).

### 4.8 Toggles, panel and editor

- **Project file:** `debugger.sourceComments?: { assertion?: boolean; wpmem?: boolean }`, where
  absent means on. Additive field, no schema bump.
- **Breakpoints panel toolbar:** two toggle `IconButton`s, "Break on ASSERTION comments" and
  "Break on WPMEM comments", with `selected` showing the state. Two new icon files in
  `src/renderer/assets/icons/`.
- **Command:** `bp-comments [assertion|wpmem] [on|off]` prints or sets the state and saves the
  project.
- **Grouping by kind** adds an **Assertions** group and puts WPMEM rows under memory breakpoints
  with a `WPMEM` tag. The row shows `main.asm:42` and the DeZog text; the menu offers
  Enable/Disable and **Go to Comment**, and no Remove (S3).
- **Editor.** A directive line gets a margin decoration while its group is on and the build is
  current:
  - an assertion mark;
  - the memory-write glyph for WPMEM.
  - Clicking it toggles that generated breakpoint's disabled state.
  - It shows on the *comment's* line, even when the breakpoint's address belongs to the next
    instruction. The hover says which address it guards.

---

## 5. Phases

Each phase ends green on its focused tests and `npm run build:check`, plus `npm run lint:renderer`
when it touches renderer React code.

### Phase 0 — pin the two bugs

- **B1:** a test where a conditional one-shot and a regular breakpoint share an address, the
  condition is false, and the regular breakpoint stops the machine. Today the one-shot is consumed.
- **B2:** a test where `run-to` targets an address holding a user breakpoint. Today the user's
  breakpoint is lost.
- Both go in `test/debug/` against `DebugSupport`, and are marked expected-to-fail until Phase 1.

### Phase 1 — one-shot core (no UI)

- Fired-definitions list and `consumeFiredOneShots` for all breakpoint kinds (§4.1).
- The `runTo` flag and key prefix; migrate the three internal users.
- `bp-set -once`, `bp-list` output, and the dialog checkbox.
- Tests: B1/B2 turn green; a one-shot with `-hit 3` stops once on the third pass and is gone; a
  memory-write one-shot is consumed; conversion regular ↔ one-shot changes what the project save
  writes. Add a real-machine test in `test/emu/` on the sp48 harness and register it in
  `build/e2e-tests.ts`.

### Phase 2 — one-shot UI

- `bp-once.svg` and its Monaco mask class, with the glyph precedence of O6.
- Shift+click in the editor glyph margin, the statement markers and the disassembly indicator.
- The margin-menu items (unit-tested in `marginBreakpointMenu.ts`'s style), the "Stop Here Once"
  action, the disassembly row menu, and the panel `once` tag.
- Update `.ai/ui-theming-intent-and-lessons.md`.
- Verify in the running app over CDP (the recipe in that file).

### Phase 3 — directive scanning

- `source-directives` module and its tests: the keyword anywhere in a comment, `;` termination, the
  WPMEM leading comma, defaults, and malformed arguments.
- Klive assembler collection: comment-only lines, an instruction line, a false `IF`, macro
  expansions, and an included file.
- sjasmplus: run a real sjasmplus on a fixture with `SLDOPT COMMENT …` and record the observed SLD
  layout in this plan (§2.5). Then read the records and add the S9 warning.

### Phase 4 — DeZog expression front end

- Run a small set of Klive-authored expressions through a real DeZog + zsim to settle precedence
  and `$` numbers. Record only inputs and outcomes, in §2.5.
- Then build `dezog-condition.ts`, the printer and a translation table test, covering every row of
  §4.5, precedence, dotted labels, and errors with column ranges.

### Phase 5 — generated breakpoints

- The build owner and scope, the key namespace, and the step in `refreshSourceCodeBreakpoints`.
- Negated ASSERTION conditions; the disabled-state map; re-applying after a machine change.
- Memory ranges (§4.6) with `-len` and the dialog's Length field.
- Stop reports (S11), toggles (§4.8) and the command.
- Panel groups and menus, and editor decorations.
- Tests:
  - unit tests for each;
  - Klive BASIC is untouched;
  - Klive asm fixtures in `test/` drive the sp48 harness, so an assertion stops with the right
    report and WPMEM catches a write inside a 5-byte range and not one past it;
  - IDE check over CDP.

### Phase 6 — Watch link

- The Watch row menu, `watchSymbol`-anchored watchpoints, the overlap indicator, and Add to Watch in
  the Breakpoints panel.
- Tests for the size-by-type mapping, re-resolution after a rebuild that moves the label, and the
  inactive state.

### Phase 7 — docs and roadmap

- **User docs** (`docs/content/`): one-shot breakpoints; "DeZog-compatible source comments" with
  the sjasmplus `SLDOPT` note and the precedence result; watches vs watchpoints.
- **Checks:** `npm run doc:build && npm run doc:check`.
- **Roadmap:** mark G1.5 and G1.6 done in the base plan, and update §2/§4 of
  LANDING_PAGE_COMPETITIVE_ANALYSIS.md (standing rule).

---

## 6. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | The sjasmplus SLD keyword-record layout is unverified. | Phase 3 starts by observing a real sjasmplus. |
| R2 | DeZog's `&`-vs-`==` precedence is unverified. A wrong guess makes `A & $80 == 0` mean something else. | Phase 4 settles it against a real DeZog. Translation is fully parenthesised. |
| R3 | Dotted sjasmplus labels may not survive a print → re-parse round trip through Klive's lexer. | Labels stay label nodes in the tree. Phase 4 tests whether backticks take dots and extends the lexer if not. |
| R4 | Several definitions at one address (user + ASSERTION + run-to) interacting with hit counts and the re-trigger guard. | Each definition keeps its own counter (C12). Phase 1 and Phase 5 test all three together. |
| R5 | A large WPMEM range plus the per-access memory recording (CONDITIONAL_BREAKPOINTS_PLAN Phase 0) could slow hot loops. | Flags make the no-hit path free. Measure a 16K ROM guard on the sp48 harness, as R1 of that plan did. |
| R6 | Monaco takes Shift+mousedown on the glyph margin as a selection extension. | Handle and `preventDefault` in `handleEditorMouseDown` before Monaco; covered by the CDP check. |
| R7 | `BREAKPOINT_CONDITIONS_IN_C_PLAN` changes the slow path concurrently. | E9 keeps the decision in TypeScript, so the fired-definitions list sits beside it. Sequence Phase 1 after that plan's slow-path change lands, or rebase onto it. |
| R8 | Users may expect DeZog's "off by default". | The toggle is visible in the panel toolbar, and the first stop by an assertion says how to turn assertions off. |

---

## 7. Verification

- Focused unit tests per phase, then `npm test`; `npm run test:e2e` for the harness tests.
- `npm run build:check`, `npm run lint:renderer`, and
  `npx electron-vite build --config build/electron.vite.config.ts` after any file moves.
- Running-app checks over CDP (Phase 2, 5 and 6):
  - Shift+click in both gutters;
  - a one-shot disappearing after its stop;
  - an assertion stop with its Output-pane report;
  - a WPMEM stop;
  - a Watch row creating and showing a watchpoint.
- Docs: `npm run doc:build && npm run doc:check`.

---

## 8. Out of scope

- **G1.4 LOGPOINT**, apart from leaving room in the scanner and front end.
- Directives in Klive BASIC, ZX BASIC, z88dk and Pasta80 sources.
- DeZog's unit-test conventions (G5.5) and its `UNITTEST_*` macros.
- Assertions and watchpoints during reverse debugging (G4): DeZog skips them there too.
- A watchpoint with a condition from a WPMEM comment (DeZog has none). Users can add one to an
  equivalent hand-made breakpoint.

---

## 9. Open questions

- **Q1 (O6):** when a breakpoint is both conditional and one-shot, should the gutter show the
  "=" (proposed) or the "1"? Or a combined glyph, such as a dot with a "1" and an underline?
- **Q2 (S3):** should a disabled generated breakpoint stay disabled across a restart of Klive?
  Proposed: no, session only.
- **Q3 (§4.8):** should the editor decoration on a directive line also let users jump to the guarded
  instruction in the disassembly view?
- **Q4 (W5):** should a WPMEM comment's breakpoint row offer Add to Watch even when the symbol has no
  build label, by address only? Proposed: no; a watch needs a symbol.

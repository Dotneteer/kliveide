# Source Assertions, Watchpoints And One-Shot Breakpoints Plan (G1.5, G1.6)

Status: **done — Phases 0–6 implemented and verified** (2026-10-03). G1.5 and G1.6 are marked done
in the base plan. §10 records what was built and where it departs from the design. Q6 was answered
by the author afterwards (yes) and is implemented too.
Base plan: [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md), §G1, decision D3. This plan covers
**G1.6** (temporary / one-shot breakpoints) and **G1.5** (DeZog-compatible `ASSERTION` and `WPMEM`
source comments), plus a link between WPMEM watchpoints and Klive's Watch panel.
Builds on: [CONDITIONAL_BREAKPOINTS_PLAN.md](CONDITIONAL_BREAKPOINTS_PLAN.md) (the condition engine;
its §4.8 says a DeZog expression is turned into that engine's tree, not run by a second engine) and
[BREAKPOINT_CONDITIONS_IN_C_PLAN.md](BREAKPOINT_CONDITIONS_IN_C_PLAN.md) (E9: the stop decision,
one-shots included, stays in TypeScript).
**Depends on** [LOGPOINTS_PLAN.md](LOGPOINTS_PLAN.md) (G1.4) for the G1.5 part. That plan builds
the shared pieces: the `annotation` owner and scope (L10), the build's `debugAnnotations` collection
and its Klive assembler and sjasmplus readers (§4.7 there), and the DeZog expression dialect
(§3.4 there). G1.5 adds the `ASSERTION` and `WPMEM` annotation kinds to them and builds nothing
parallel. The G1.6 part (Phases 0–2) depends on neither plan and can go first.

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
  `BreakpointScope` decides which subset an operation may replace wholesale. LOGPOINTS_PLAN adds a third,
  `annotation`, which this plan reuses (S1).
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
  LOGPOINTS_PLAN Phase 4 adds the `K` (keyword comment) records and symbols from the `L` records.
- **LOGPOINTS_PLAN** (merged 2026-10-03, not implemented) owns the comment pipeline that G1.5
  extends. Its `SourceAnnotation.kind` already reserves `"ASSERTION" | "WPMEM"`.
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
"ASSERTION", "WPMEM", "LOGPOINT", "vscode breakpoint", "WATCHes", "Supported Assemblers", and
sjasmplus's `documentation.xml` (*SLDOPT*, *SLD data*). Only the conventions are recorded, in Klive's
own words; no DeZog code is copied. The DeZog expression conventions shared with LOGPOINT are in
LOGPOINTS_PLAN §1.2 and §3.4 and are not repeated here.

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
  `&& ||`, parentheses, and `b@(…)` / `w@(…)` memory reads. DeZog also accepts ZEsarUX spellings
  (`=`, `OR`, `peek()`); Klive does not (LOGPOINTS_PLAN §3.4).
  - Numbers appear as `0x12FA` and `7Fh`.
  - sjasmplus labels need their full dot notation.
  - **No flag names are documented.**
- **Failure report:** DeZog shows the failed expression with the values involved (changelog:
  "ASSERTIONs show the failure values").
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
  `SLDOPT COMMENT WPMEM, LOGPOINT, ASSERTION`, or sjasmplus leaves the comments out of the SLD. They
  appear as type-`K` records. Per sjasmplus's docs only **end-of-line** comments are exported and the
  keywords are **case-sensitive** (LOGPOINTS_PLAN §1.2).
- **Other assemblers:** from the list file.
- Comments in code that was not assembled (a false `IF`) are skipped with sjasmplus only.

### 2.5 Settled elsewhere, and still unverified

- **Settled by LOGPOINTS_PLAN §3.4:**
  - The DeZog dialect uses **C precedence**: relational binds tighter than bitwise, so
    `A & 0x80 == 0` is `A & (0x80 == 0)` there, unlike in Klive's own dialect (C3). The dialect
    parser builds the tree that way, and the Klive text Klive prints for it is parenthesised.
  - Literal forms beyond `0x…`, `…h` and decimal are checked against DeZog's docs in that plan's
    Phase 2; anything undocumented is rejected with a message.
- **Still unverified:**
  - Whether a keyword comment on a line of its own produces a `K` record, and at which address.
    sjasmplus documents end-of-line comments only. LOGPOINTS_PLAN Phase 4 checks it with a real
    sjasmplus, and DeZog's recommended "assertion on its own line" form depends on the answer.
  - DeZog's exact WPMEM stop message. Klive writes its own (S11), so this is informational only.

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
| O6 | **Glyphs:** the breakpoint dot with a "1" knocked out (`bp-once.svg`), the same technique as the "=" mark. A breakpoint that is both conditional and one-shot gets a **combined glyph** (`bp-once-conditional.svg`), decided by the author (Q1). It is the one-shot "1" over a single bar (a shortened "="), candidate A of the 2026-10-03 sketch (Q5). The rejected candidate B put a "1" stem beside the "="; at 14px its three thin bars merged. **Inactive (hollow) still wins over all of them.** The Breakpoints panel always shows a `once` tag. | Both facts matter at a glance: that it will stop only under a condition, and that it will then be gone. Whether a breakpoint can fire at all matters most. |

### 3.2 Source comments (G1.5)

| # | Decision | Why |
|---|---|---|
| S1 | ASSERTION and WPMEM breakpoints are **annotation-owned** (`owner: {kind:"annotation"}`, LOGPOINTS_PLAN L10), exactly like LOGPOINT comments: never saved, replaced as one set after every successful build, cleared when the machine changes and back after the next build. | They are a projection of the source. One owner and one lifetime rule for all three comment kinds. |
| S2 | **Their own keys**, in the pattern of LOGPOINTS_PLAN §4.1: `AS:[resource]:line@<address>` for an assertion and `WP:[resource]:line@<address>+<length>:R`/`:W` for a watchpoint. They never collide with a user breakpoint at the same place. The machine stops if any definition there stops it. | A user breakpoint on the instruction an assertion guards must not replace the assertion, or the reverse. The address in the key gives one breakpoint per macro expansion. |
| S3 | They **cannot be deleted** from the IDE, only disabled. `bp-del` on one says which comment created it. A disabled state survives rebuilds while the comment stays on the same line, but **lasts for the session only**: it is not saved, and a restart of Klive enables them all again (Q2, decided by the author). | Deleting something the next build recreates would be a lie. Remove the comment to remove it, or switch the whole group off with its toggle. |
| S12 | **A directive's margin mark:** a plain click toggles its disabled state. The hover names the guarded instruction ("checked before `ld (ix+3),a`, line 43, `$800D`"). Right-click opens a small menu: Disable/Enable and **Show in Disassembly**, which lists each address when a macro expanded the comment more than once (Q3). | Click keeps one meaning. The hover answers "which instruction?" without a jump, because the guarded instruction is usually the next source line. The jump matters where the source does not show the code: macros and banked code. |
| S4 | **ASSERTION and WPMEM expressions use LOGPOINTS_PLAN's DeZog dialect** (§3.4 there), which builds Klive's condition tree; the existing checker binds and compiles it. The panel shows the original DeZog text, with the parenthesised Klive form in the tooltip. | One DeZog parser for all three comment kinds, as CONDITIONAL_BREAKPOINTS_PLAN §4.8 requires. |
| S5 | A malformed ASSERTION or WPMEM is a **build warning on the comment's line**, never an error, and that comment creates no breakpoint. An unknown label makes the breakpoint *inactive* (hollow), as for a hand-written condition (C14). | The same rule as LOGPOINTS_PLAN L13: a debugging aid must not break a build. |
| S6 | **Per-project switches, on by default**, one for ASSERTION comments and one for WPMEM comments. They are stored next to LOGPOINTS_PLAN's `logpointGroups` as `sourceComments: { assertion?: boolean; wpmem?: boolean }`, absent when both are on. They are switched from the checkbox on each group's header row in the Breakpoints panel, as the "LOGPOINT comments" group is, and with `as-en [-d]` / `wp-en [-d]`, mirroring `lp-en`. | Decided by the author: per-project toggles in the Breakpoints panel, on by default. Placing them like the logpoint groups keeps the three comment kinds alike. |
| S7 | **Sources:** the Klive Z80 assembler and sjasmplus, through LOGPOINTS_PLAN §4.7's readers. Klive BASIC, ZX BASIC, z88dk and Pasta80 are out of scope (§8). | These are the two assemblers DeZog projects use that Klive integrates. |
| S8 | Comments in code that is **not assembled** (a false `IF` branch) produce nothing; a comment inside a **macro body** produces one breakpoint per expansion. | LOGPOINTS_PLAN §4.7's rules, inherited unchanged. |
| S9 | **sjasmplus without `SLDOPT COMMENT`:** LOGPOINTS_PLAN's warning is extended to look for `ASSERTION` and `WPMEM` too, and names the full `SLDOPT COMMENT WPMEM, LOGPOINT, ASSERTION` line. Klive never adds the option itself (its Q6). | A silent nothing is the worst outcome. Inserting the directive behind the user's back is the second worst. |
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

### 4.3 Annotations from the build

LOGPOINTS_PLAN §4.7 defines `SourceAnnotation` and both readers. G1.5 adds:

- **Kinds:** `"ASSERTION"` and `"WPMEM"`, found by the same case-sensitive whole-word scan as
  `LOGPOINT`, with `text` = everything after the keyword up to the next `;`.
- **WPMEM arguments.** `parseWpmemArgs(text)` in `src/common/utils/breakpoint-condition/dezog/`:
  - `[addr [, length [, access]]]`, including the leading-comma form `WPMEM, 5, w`;
  - `addr` and `length` are DeZog-dialect expressions, constant-folded against the build's symbols;
  - `access` is `r`, `w` or `rw`.
- **Banked default address.** An omitted `addr` uses the annotation's own `address` and `partition`
  (§2.2). An explicit `addr` is a 64K address with no partition.
- **The `SLDOPT` warning** looks for the two new keywords too (S9).

### 4.4 Generated breakpoints

- **One install for all three kinds.** The `annotation` scope replaces the whole annotation-owned
  set, so ASSERTION, WPMEM and LOGPOINT breakpoints are built together in LOGPOINTS_PLAN's
  after-build step and installed with **one** `resetBreakpointsTo(list, {kind:"annotation"})`. Two
  separate installs would each delete the other's breakpoints.
- **Switches.** The step leaves out a kind whose switch is off (S6).
- **ASSERTION.** An execution breakpoint at the annotation's address (and partition), with
  `condition = !(<expr>)` built on the dialect's tree, or no condition for a bare ASSERTION. It
  carries `resource` and `line` for display and click-to-source, and `annotationKind: "ASSERTION"`.
- **WPMEM.** One memory definition per access kind (`rw` gives two), with `length` (S10).
- **Disabled state.** Held by the IDE in a session map keyed `resource:line:kind` and re-applied at
  every install. It is never written to disk (S3).

### 4.5 Printing the DeZog form

The dialect itself is LOGPOINTS_PLAN's. This plan needs one addition, if that plan does not already
provide it: a printer from the tree to Klive-dialect text, for the tooltip and for `bp-list`. It
parenthesises every binary operation, so the C-precedence reading survives into Klive's (C3) grammar.
Dotted labels are printed in backticks (R3).

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

- **Project file:** `sourceComments?: { assertion?: boolean; wpmem?: boolean }` next to
  `logpointGroups`, absent when both are on. Additive field, no schema bump.
- **Breakpoints panel:** an **"ASSERTION comments"** group and a **"WPMEM comments"** group,
  alongside LOGPOINTS_PLAN's "LOGPOINT comments" group. Each header row has the switch's checkbox
  (S6). Each row shows `main.asm:42` and the DeZog text; its menu offers Enable/Disable,
  **Go to Comment** and Show in Disassembly, and no Remove (S3).
- **Commands:** `as-en [-d]` and `wp-en [-d]` set the switches and save the project. LOGPOINTS_PLAN's
  `lp-groups` listing grows a line for each of the two.
- **Editor.** A directive line gets a margin decoration while its group is on and the build is
  current:
  - an assertion mark;
  - the memory-write glyph for WPMEM.
  - It shows on the *comment's* line, even when the breakpoint's address belongs to the next
    instruction.
  - Click, hover and right-click behave as S12 says.
- **Show in Disassembly** needs a "reveal address" entry point on the live disassembly view. Today
  only the NEX bank views have a "Show in Disassembly", and it targets a bank dump. The entry point
  is built so other views can reuse it.

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

- `bp-once.svg`, `bp-once-conditional.svg` (Q5: the "1" over a single bar) and their Monaco mask
  classes, with inactive winning as in O6.
- Shift+click in the editor glyph margin, the statement markers and the disassembly indicator.
- The margin-menu items (unit-tested in `marginBreakpointMenu.ts`'s style), the "Stop Here Once"
  action, the disassembly row menu, and the panel `once` tag.
- Update `.ai/ui-theming-intent-and-lessons.md`.
- Verify in the running app over CDP (the recipe in that file).

### Phase 3 — the ASSERTION and WPMEM annotation kinds

Starts after LOGPOINTS_PLAN Phases 1, 2 and 4 (owner, dialect, build integration) have landed.

- The two kinds in both readers, and the extended `SLDOPT` warning.
- `parseWpmemArgs` and its tests: defaults, the leading comma, expressions, banked defaults, and
  malformed arguments as build warnings.
- The tree printer of §4.5, unless LOGPOINTS_PLAN already provides one.
- Fixtures: an assertion on an instruction line and, depending on LOGPOINTS_PLAN Phase 4's finding,
  on its own line; a false `IF`; a macro expansion; an included file; a sjasmplus SLD with all three
  keywords.

### Phase 4 — generated breakpoints

- The keys of S2 and the shared install of §4.4: one `resetBreakpointsTo` for all annotation kinds.
- Negated ASSERTION conditions, and the disabled-state map.
- Memory ranges (§4.6) with `-len` and the dialog's Length field.
- Stop reports (S11), the switches (§4.8) and `as-en` / `wp-en`.
- Panel groups and menus, editor decorations (S12), and the live disassembly view's "reveal
  address" entry point.
- Tests:
  - unit tests for each;
  - a test that installing annotations keeps LOGPOINT, ASSERTION and WPMEM breakpoints together;
  - Klive asm fixtures drive the sp48 harness, so an assertion stops with the right report and
    WPMEM catches a write inside a 5-byte range and not one past it;
  - IDE check over CDP.

### Phase 5 — Watch link

- The Watch row menu, `watchSymbol`-anchored watchpoints, the overlap indicator, and Add to Watch in
  the Breakpoints panel.
- Tests for the size-by-type mapping, re-resolution after a rebuild that moves the label, and the
  inactive state.

### Phase 6 — docs and roadmap

- **User docs** (`docs/content/`): one-shot breakpoints; ASSERTION and WPMEM added to the "DeZog
  comments" section that LOGPOINTS_PLAN starts, with the `SLDOPT` line and the C-precedence note;
  watches vs watchpoints.
- **Checks:** `npm run doc:build && npm run doc:check`.
- **Roadmap:** mark G1.5 and G1.6 done in the base plan, and update §2/§4 of
  LANDING_PAGE_COMPETITIVE_ANALYSIS.md (standing rule).

---

## 6. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | A comment-only sjasmplus line may produce no `K` record (§2.5), which would break DeZog's recommended own-line ASSERTION form for sjasmplus users. | LOGPOINTS_PLAN Phase 4 finds out. If so, the docs say to write the assertion at the end of the next instruction's line, and say what that means (checked *before* that instruction). |
| R2 | Users may read a DeZog-dialect expression with Klive's precedence. `A & $80 == 0` means different things in the two dialects. | The tooltip and `bp-list` show the parenthesised Klive form (§4.5), and the docs carry the example. |
| R3 | Dotted sjasmplus labels may not survive a print → re-parse round trip through Klive's lexer. | Labels stay label nodes in the tree. Phase 3 tests whether backticks take dots and extends the lexer if not. |
| R4 | Several definitions at one address (user + ASSERTION + LOGPOINT + run-to) interacting with hit counts and the re-trigger guard. | Each definition keeps its own counter (C12). Phase 1 and Phase 4 test them together. |
| R5 | A large WPMEM range plus the per-access memory recording (CONDITIONAL_BREAKPOINTS_PLAN Phase 0) could slow hot loops. | Flags make the no-hit path free. Measure a 16K ROM guard on the sp48 harness, as R1 of that plan did. |
| R6 | Monaco takes Shift+mousedown on the glyph margin as a selection extension. | Handle and `preventDefault` in `handleEditorMouseDown` before Monaco; covered by the CDP check. |
| R7 | `BREAKPOINT_CONDITIONS_IN_C_PLAN` changes the slow path concurrently. | E9 keeps the decision in TypeScript, so the fired-definitions list sits beside it. Sequence Phase 1 after that plan's slow-path change lands, or rebase onto it. |
| R8 | Users may expect DeZog's "off by default". | The switch is visible on the group's header row in the Breakpoints panel, and the first stop by an assertion says how to turn assertions off. |
| R9 | G1.5 waits on LOGPOINTS_PLAN, which itself waits on the conditional plan's phases. | G1.6 (Phases 0–2) has no such dependency and goes first. If LOGPOINTS_PLAN slips, its owner/dialect/reader phases could be done on their own before its logging phases. |

---

## 7. Verification

- Focused unit tests per phase, then `npm test`; `npm run test:e2e` for the harness tests.
- `npm run build:check`, `npm run lint:renderer`, and
  `npx electron-vite build --config build/electron.vite.config.ts` after any file moves.
- Running-app checks over CDP (Phases 2, 4 and 5):
  - Shift+click in both gutters;
  - a one-shot disappearing after its stop;
  - an assertion stop with its Output-pane report;
  - a WPMEM stop;
  - a Watch row creating and showing a watchpoint.
- Docs: `npm run doc:build && npm run doc:check`.

---

## 8. Out of scope

- **G1.4 LOGPOINT** itself; it is LOGPOINTS_PLAN's.
- Directives in Klive BASIC, ZX BASIC, z88dk and Pasta80 sources.
- DeZog's unit-test conventions (G5.5) and its `UNITTEST_*` macros.
- Assertions and watchpoints during reverse debugging (G4): DeZog skips them there too.
- A watchpoint with a condition from a WPMEM comment (DeZog has none). Users can add one to an
  equivalent hand-made breakpoint.

---

## 9. Questions and answers

### 9.1 Answered by the project author (2026-10-03)

- **Gesture:** Shift+click (O1).
- **One-shot persistence:** session only (O2).
- **Watch and WPMEM:** a two-way link (W2–W5).
- **Toggles:** per project, on by default (S6).
- **Q1:** a conditional one-shot gets a **combined glyph** (O6).
- **Q2:** a disabled generated breakpoint stays disabled for the **session only** (S3).
- **Q3:** the margin mark's hover names the guarded instruction, and its right-click menu offers
  **Show in Disassembly** (S12). Confirmed by the author.
- **Q4:** **no** Add to Watch by address only; a watch needs a build symbol (W5).
- **Q5:** the combined glyph is **candidate A**, the "1" over a single bar (O6).

### 9.2 Answered after implementation

- **Q6 (S12): yes** (the author, 2026-10-03). A LOGPOINT comment's mark behaves like an ASSERTION or
  WPMEM mark: a click disables the comment's logpoint for the session (the same `resource:line:kind`
  map, kind `LOGPOINT`), right-click offers Disable/Enable and Show in Disassembly, and the
  Breakpoints panel's LOGPOINT comment rows get the same row menu. Still no Remove. LOGPOINTS_PLAN
  §4.5 is amended to match. `commentKindOf` (`source-annotations.ts`) names the kind of every
  comment-made breakpoint, LOGPOINT included, so no call site special-cases it.

---

## 10. Implementation notes (2026-10-03)

**Verification.** `npm run test:all` (unit and both e2e tiers; the five failures it surfaced were
tests asserting the old menus, dialog and usage text, all updated), `npm run build:check` (no new
type errors), `npm run lint:renderer` (0 errors), the Vite build, `npm run doc:build && npm run
doc:check`. Checked in the running app with the Playwright harness against a throwaway sp48 project:
`compile` lists the ASSERTION and WPMEM comments; `bp-set $8003 -once` stopped once and was gone;
the assertion stopped with `ASSERTION failed at code.kz80.asm:8: a < 4  (a=$04)` and the switch-off
hint; after `as-en -d` the WPMEM watchpoint stopped with `WPMEM write at $800E (buf) by PC $8009`;
the Breakpoints panel showed the `once` tags, the "ASSERTION comments - off" header and the WPMEM
section; the Watch row menu's **Break on write** created `WS:buf -w -len 2` and the row's mark; the
disassembly row menu listed its four items; Shift+click in the disassembly gutter and in the editor
margin each made a one-shot, drawn with the "1" glyph. Hover tooltips and the click-to-toggle on a
comment mark were not driven in the app (both are unit-tested through `marginBreakpointMenu.ts`).

**Departures from the design.**
- **Consumption.** Every one-shot (and every annotation breakpoint) sets `COND_BP`, so its address
  takes the slow path, where `handleHit` records each definition whose filters passed. The decision
  consumes them (`consumeFiredOneShots`) inside the re-trigger guard; the machine controller calls
  it again on every debug stop, which is how memory, I/O and NextReg one-shots are spent (a no-op
  after an execution stop). `lastStopBreakpoints` / `lastStopAccesses` are the stop information.
- **Run-to key.** `RT:` + the ordinary key; `resolveBreakpoint` resolves both keys of a source line,
  and `getBreakpointAddressSpec` drops the prefix, so commands still name the place.
- **Ranges** are re-derived per address from the definitions (`claimedAddressesOf` +
  `refreshFlagsAt`) instead of a reference count per address and kind - the same "derive, never
  patch" rule the flag word already follows. A 16K range costs one walk of the definitions per byte
  at install time only.
- **The ASSERTION condition is evaluated in the DeZog dialect** (`conditionDialect: "dezog"`,
  `condition = !(<expr>)`), compiled by `DebugSupport` with `compileConditionWith(...,
  parseDezogExpression)`. The §4.5 printer (`dezog/dezog-printer.ts`) is display-only: the tooltip
  and `bp-list`'s `read as:`. R3 holds: backticks take dots, tested.
- **Watch-anchored watchpoints** are keyed `WS:<symbol>` and resolved by `DebugSupport` itself from
  the symbol table it already receives after every build (`setConditionSymbols`), not by
  `refreshSourceCodeBreakpoints`. `WS:<symbol>` is also a `bp-*` address spec, so `bp-list` lines
  paste back and the gutter indicator can remove one; `-len` joined the indicator's commands for
  every range.
- **Stop reports.** The values come from `describeDezogValues`, which renders a transient DeZog
  template (`A=${A}`, ...) through the core's condition store. The WPMEM PC is
  `DebugSupport.lastDecisionPc` (the decision runs before every instruction), because the 48K, 128K
  and +3E cores do not maintain `opStartAddress`; the report names the comment's line, not the
  writing instruction's (it has no source map in the emulator).
- **Reveal in the Breakpoints panel (W4)** is a small listener channel (`breakpoint-reveal.ts`): the
  Watch mark expands the panel and asks; the panel scrolls to the row and tints it for two seconds.
- **"Show in Disassembly"** is `show-disass [<address>]`, reusing the live view's `revealLocator`.
- **The switches** live in the shared store (`AppState.sourceComments`, `SET_SOURCE_COMMENTS`),
  persisted as `debugger.sourceComments`; a switch change reinstalls the build's comment
  breakpoints at once (`reinstallAnnotationBreakpoints`), no rebuild. A switched-off kind's section
  header stays in the panel as the way back on.
- **Warning codes:** `AS001` (ASSERTION), `WP001` (WPMEM); `LP002` (the `SLDOPT` warning) now names
  the missing kinds and the full line.

**Where things are.** Model: `BreakpointInfo.runTo/length/annotationKind/annotationText/
conditionDialect/watchSymbol`, `SourceCommentSwitches`; keys in `breakpoints.ts`. Emulator:
`DebugSupport` (`consumeFiredOneShots`, ranges, `resolveWatchSymbols`, `describeDezogValues`),
`DebugStepDecision.ts`, `MachineController.describeCommentStop`. Build: `source-annotations.ts`
(`annotationsInComment`, `annotationBreakpoints`), `dezog/wpmem-args.ts`, `dezog/dezog-printer.ts`,
the Klive assembler's `emitSingleLine`, `SjasmPCompiler` (`sldAnnotations`,
`annotationKindsInSource`, `sldoptWarning`). IDE: `BreakpointCommands.ts` (`-once`, `-len`, `WS:`,
`as-en`, `wp-en`), `breakpoint-form.ts` + `BreakpointDialog.tsx`, `marginBreakpointMenu.ts`,
`MonacoEditor.tsx`, `BreakpointIndicator.tsx`, `disassemblyRowMenu.ts` + `DisassemblyPanel.tsx`,
`BreakpointsPanel.tsx` + `breakpoint-grouping.ts`, `annotation-state.ts`, `watch-watchpoints.ts`,
`WatchPanel.tsx`, `breakpoint-reveal.ts`, `ToolCommands.ts` (`show-disass`). Glyphs: `bp-once.svg`,
`bp-once-conditional.svg`, `bp-assertion.svg`. Tests: `test/debug/one-shot-breakpoints.test.ts`,
`test/commands/one-shot-commands.test.ts`, `test/z80-assembler/assertion-wpmem-annotations.test.ts`,
`test/renderer/assertion-watch-ui.test.ts`, `test/emu/one-shot-real-machine.test.ts`,
`test/emu/assertion-wpmem-real-machine.test.ts`, and additions to the margin-menu, dialog, form,
SLD, project-save and step-decision tests.


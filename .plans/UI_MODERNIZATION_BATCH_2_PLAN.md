# UI Modernization — Batch 2: The Surfaces Phases 6–13 Did Not Reach

*Audit date: 2026-09-13. Baseline commit: `4fe66d1de` ("NEX viewer disassembly annotations
modernized", #1341).*

This plan continues `.plans/UI_MODERNIZATION_PLAN.md`, which runs to Phase 13. Phase numbering
continues from there so the two documents read as one sequence. **Read `AGENTS.md`, then
`.ai/ui-theming-intent-and-lessons.md`, then §3 and §10–13 of the main plan before starting any
phase here.** Everything that file calls settled intent stays settled; nothing below re-litigates it.

The scope is the three registries plus the dialogs that no registry owns:

- `sideBarPanelRegistry` and `toolPanelRegistry` (`src/renderer/registry.ts:142` and `:268`)
- `documentPanelRegistry` (`src/renderer/registry.ts:325`)
- `ideDialogRegistry` / `emuDialogRegistry`, and the eleven dialogs opened outside both

---

## 1. What the audit found

Of **19 sidebar and tool panels**, 8 are done, 6 are partial, 5 are untouched.
Of **25 document panels**, 3 are done (Memory, Disassembly, BIN), 8 are partial, 7 are one-line
stubs, 5 are untouched, 2 are Monaco (out of scope).
Of **24 dialogs**, 15 are done; the 7-dialog NEX annotation family plus `Z88ExportCardDialog` and
`SetMemoryDialog` are not.

Three findings reframe the work, and they are why this plan does not simply start at the first
unconverted panel.

### 1.1 M1 and M2 are documented as enforced. They are not.

`AGENTS.md` says: *"Three rules have tests that will fail you: no `em` font sizes (M1), no px column
widths — use `ch` (M2), and no component-private row-height constants (M3)."* §3.4 of the main plan
says the same.

Only **M3** exists — `test/theming/row-size-contract.test.ts`, which walks `src/renderer` and greps
for `const …ROW…SIZE = <n>`. There is no test anywhere in `test/` that looks at a `font-size` or a
column width. `test/theming/token-contract.test.ts` only checks that `var(--…)` names resolve, so an
`em`, a px column and a raw `rgb()` all pass CI today.

The consequence is measurable: **54 `em` font sizes survive across 28 files** (Phase 14 counted them
exactly: 53 declarations in 27 stylesheets plus one inline `fontSize` prop), and the largest single
block of them — 19 — is in the seven NEX annotation dialogs, written *last commit*, years after the
mandate. A rule with no test does not decay slowly; new code re-opens it at full rate. This is the
same diagnostic as the `AttachedShadow` trap in the lessons file (*"a feature can be fully wired up,
running, and drawing nothing"*), arriving from the other side: a rule fully written down, fully
believed, and enforcing nothing.

**Phase 14 fixes this first**, because every phase after it is otherwise a fix with no ratchet.

### 1.2 One `em` in one shared file sets the type size of five document panels

`GenericViewerPanel.module.scss:5` declares `.panelFont { font-size: 0.8em }`, and
`GenericFilePanel.tsx:172` applies it to the root of every file viewer built on it — the NEX viewer,
the Z80 viewer, SCR, PAL/NPL and the sprite editor. Against the 16px root that is 12.8px, not the
12px the scale intends, and `NexFileViewerPanel.module.scss:95,111` then *compounds* `0.92em` and
`0.84em` off it. This is precisely the case `MemoryPanel.tsx:347` records as fixed for the memory
dump and that nothing propagated outward.

One line fixes the type size of five panels. It is the highest-leverage edit in this document.

### 1.3 The `width` prop means `ch` or px depending on which wrapper you pass it to

`controls/data`'s cells read a bare number as **`ch`** (`controls/data/index.tsx:319`).
`controls/layout`'s `Label`/`Value` read the identical number as **px** (`controls/layout/cssWidth.ts:12`),
and `LabelSeparator` emits it as a raw React style number, i.e. px
(`controls/layout/LabelSeparator.tsx:15`).

Two panels have already fallen in. `VicPanel.tsx:19-20` declares `LAB_WIDTH = "7ch"` and
`BIFLAG_GAP = 10` four lines apart, the second landing as 10px through `LabelSeparator`.
`BlinkPanel.tsx:11` has `const LAB_WIDTH = 7; // ch, not px (M2)` — and the comment is *correct
there*, because that number goes to `DataLabel`. A reader cannot tell the two apart without opening
the wrapper. Any M2 sweep has to resolve this fork before it can trust its own survey, which is the
lessons file's *"survey with the right pattern"* rule with a unit attached.

---

## 2. Master order

Stages are ordered by leverage, then by cost. **Stages 2–5 are independent of one another and may be
reordered freely**; Stage 1 is not — it changes what "done" means for everything after it.

Paths below are as they stand today. Phase 15b renames `SideBarPanels/` → `SideBarPanels/`, so every
`SideBarPanels/` path in this document is pre-rename; read it as the new spelling once 15b has landed.

| # | Phase | Surface | Verdict | Why here |
|---|---|---|---|---|
| **Stage 1 — Foundations** ||||
| 14 | Enforcement | M1/M2 tests + shrinking baseline | — | Nothing after this holds without it |
| 15 | Shared shells | `GenericFilePanel`, the width fork, `DialogProvider` guard | — | One edit each, many surfaces |
| 15b | Misspelling sweep | `flagDecriptions`, `SideBarPanels/`, 3 more | — | A rename must precede the phases that edit those files |
| 16 | Regression pass | Watch, Next Registers, Call Stack, Breakpoints, ULA | shipped-modern | Live bugs in panels already called done |
| **Stage 2 — Sidebar panels** ||||
| 17 | PSG (AY-3-8912) | `SideBarPanels/PsgPanel.tsx` | NOT | 94 lines, cheapest panel, has a data bug |
| 18 | 6510 CPU | `SideBarPanels/M6510CpuPanel.tsx` | PARTIAL | Colour grant given (§4); ~15 lines |
| 19 | VIC | `SideBarPanels/VicPanel.tsx` | PARTIAL | Largest unconverted colour surface; the density test |
| 20 | BLINK | `SideBarPanels/BlinkPanel.tsx` | PARTIAL | Same treatment as 19, Z88 |
| 21 | NEC UPD 765 Log | `SideBarPanels/NecUpd765Panel.tsx` | PARTIAL | Console palette in a data panel |
| 22 | Scripting History | `SideBarPanels/ScriptingHistoryPanel.tsx` | NOT | Dead conditional, forever-polling |
| 23 | Open Editors | `features/openEditors/OpenEditorsPanel.tsx` | NOT | 260 lines, a11y |
| 24 | Klive Project | `features/explorer/ExplorerPanel.tsx` | NOT | 891 lines, the largest sidebar item |
| **Stage 3 — Tool panels** ||||
| 25 | Commands + Output | `ToolArea/CommandPanel.tsx`, `OutputPanel.tsx` | PARTIAL | Both small; one shared strip |
| **Stage 4 — Document panels** ||||
| 26 | Unknown file viewer | `DocumentPanels/UnknownFileViewerPanel.tsx` | NOT | 15 lines; sets the "nothing here" treatment 27 inherits |
| 27 | The seven stubs | `Next/{Sna,Shc,Shr,Slr,Sl2,Vid,Nxi}*.tsx` | STUB | **Cheapest item here: 7 surfaces × 1 line.** "Not implemented yet"; no implementations (§4) |
| 28 | Command Result + Script Output | `CommandResult.tsx`, `ScriptOutputPanel.tsx` | PARTIAL | Identical defects; one phase |
| 29 | Image viewer | `DocumentPanels/ImageViewerPanel.tsx` | PARTIAL | Unhandled load error |
| 30 | TAP/TZX viewer | `DocumentPanels/TapViewerPanel.tsx` | NOT | Re-parses the tape every render |
| 31 | DSK viewer | `DocumentPanels/DskViewerPanel.tsx` | NOT | The one crash path found |
| 32 | PAL/NPL editor | `Next/PalFileEditorPanel.tsx`, `PaletteEditor.tsx` | NOT | Colour literals in TSX |
| 33 | SCR viewer | `Next/ScrFileViewerPanel.tsx` | PARTIAL | Small; dead parse |
| 34 | NEX file viewer | `Next/NexFileViewerPanel.tsx` | PARTIAL | 894 lines, newest code |
| 35 | Static Memory Dump | `features/memory/StaticMemoryDump.tsx` | PARTIAL | 2165 lines; hosts Stage 5's dialogs |
| 36 | Sprite editor | `features/sprite-editor/` | PARTIAL | 3222 lines; token-clean already |
| 37 | Z80 snapshot viewer | `Next/Z80FileViewerPanel.tsx` | DEAD → **revive** | Complete parser, switched off by accident (§4.1) |
| **Stage 5 — Dialogs** ||||
| 38 | Z88 Export Card | `appEmu/dialogs/Z88ExportCardDialog.tsx` | NOT | 36 lines, a shipped visible bug |
| 39 | Set Memory | `appIde/dialogs/SetMemoryDialog.tsx` | PARTIAL | Last raw hex in any dialog |
| 40 | SjasmPlus integration | `appIde/dialogs/sjasmplus/` | PARTIAL | The MVC reference lags on visuals |
| 41 | NEX annotation family | `Next/Nex*Dialog.tsx` (×7) | NOT | 1795 lines, the largest dialog block |
| 42 | Dialog cross-cuts | `Modal.tsx`, dead props, width scale | — | Cleanup once 38–41 have landed |
| **Stage 6 — Emulator shell leftover** ||||
| 43 | Z88 Tool Area | `appEmu/machines/Z88ToolArea.tsx` | NOT | The one Phase 9 surface still unconverted |

**If only three things get done:** Phase 14 (the ratchet), Phase 15 (five panels for three edits),
Phase 26 (seven blank rectangles become honest panels for seven lines).

---

## 3. The phases

Every phase carries the exit criteria in §5. Only what is specific to a phase is written out here.

### Stage 1 — Foundations

#### Phase 14 — The enforcement gap

Give M1 and M2 the tests `AGENTS.md` already promises, as one file scanning `src/renderer` the way
`row-size-contract.test.ts` does.

**M1** — no `font-size` whose value carries `em`, in a `.module.scss` or an inline style. Comments
must be blanked before matching, as `NexAnnotationDialogConsistency.test.ts:23` already does, or the
prose in `Data.module.scss:8` and `Button.module.scss:14` describing the old violations will fail the
rule they document.

**M2** — no px width on a *tabular* measure. This one cannot be a blanket ban: `DocumentTab.module.scss:43`
`max-width: 360px` is chrome geometry and legitimately px. Scope it, and say in the test why the line
is drawn where it is. **Both scopings this plan proposed turned out to be wrong — see the exit below.**

**Both take a baseline, not a clean slate.** 54 M1 violations exist across 28 files; failing CI on all
of them fails the build before a single panel is converted. Follow `scripts/check-types.cjs`: record
the current offenders, fail on anything *new*, and have each phase below delete its own entries.
A phase that does not shrink the baseline has not finished. Wire the baseline file into the repo the
way `build/type-errors-baseline.json` is.

Correct the claim in `AGENTS.md` and main-plan §3.4 in the same change — until Phase 14 lands they are
wrong, and after it they should describe the baseline rather than implying a clean rule.

##### Phase 14 exit *(2026-09-13)*

- `test/theming/type-scale-contract.test.ts` (node project, 7 tests) and
  `build/style-mandate-baseline.json`: **57 recorded violations in 30 entries** — 54 M1 (53
  declarations across 27 stylesheets, plus the inline `fontSize="0.8em"` at
  `StaticMemoryDump.tsx:1651`) and 3 M2 in 2 files. `npm run style:baseline` regenerates it.
- **Both halves of the ratchet were watched failing before being trusted**, per the lessons file. A
  probe `font-size: 0.77em` added to `Checkbox.module.scss` produced
  `controls/Checkbox.module.scss::M1: 0 known -> 1 now`; tokenizing `Z88ToolArea`'s `0.65em` produced
  `appEmu/machines/Z88ToolArea.module.scss::M1: 1 recorded -> 0 actual`. Both probes reverted.
- Full suite green: **20,576 tests / 686 files**, 0 failures. `npm run build:check` unchanged at 126
  known type errors. `npm run lint:renderer` 0 errors. `electron-vite build` succeeds.
- `AGENTS.md`, main-plan §3.4 and `.ai/ui-theming-intent-and-lessons.md` updated.

**Two things the plan got wrong, both about M2.**

**The scoping this section proposed does not work, in either form.** *px widths in stylesheets that
name `--monospace-font` or `--panel-font-size`* gave 16 hits of which ~3 were real — the rest
swatches, icons, a 2px prompt rail, a 1px divider. *Bare-number `width` on `controls/data` and
`controls/layout` cells* gave 21 hits of which **19 were `<LabelSeparator width={8} />`**, whose own
doc comment calls it "a spacer, not a label". Both were dropped: a rule that is 80% false positives
teaches people to add allowlist entries instead of fixing code. What shipped is the one shape a regex
can settle — a numeric **literal** on a cell that reserves a column — which finds exactly **3**
violations app-wide. The honest reason is in the test's header: every other column width is routed
through a named constant, and whether that is `ch` or px depends on its *type*. **This is a compiler
problem wearing a linter's clothes**, and Phase 15 is where it is actually solved. When the number
half of the `width` prop is gone, delete M2 from that test rather than keeping it as decoration.

**And the fork in §1.3 is worse than "two wrappers disagree" — all three layout cells documented the
wrong one.** `Label.tsx:10`, `Value.tsx:16` and `Secondary.tsx:8` each said *"A number is `ch` (M2);
a string is a CSS length"* while `cssWidth` renders a number as **px**. That is how
`NecUpd765Panel.tsx:75` acquired `width={16}`: an author read the prop's own documentation and got
16px. Corrected in this phase, because shipping a test that codifies the opposite of the doc comment
beside it would be incoherent. It also raises Phase 15's priority — the doc was wrong for as long as
it existed, and only a type change stops it being wrong again.

#### Phase 15 — The shared shells

Five edits across three files, each fixing many surfaces at once.

| Fix | File | Effect |
|---|---|---|
| `.panelFont` `0.8em` → `var(--panel-font-size)` | `helpers/GenericViewerPanel.module.scss:5` | Type size of 5 document panels |
| `.invalid` `1em` → the scale; `--console-ansi-bright-red` → `--status-error` | same, `:13-16` | The console palette does not belong in a document panel (lessons file, *"do not spend the console's ANSI palette on a data panel"*) |
| The invalid body → `EmptyState`, and fix the grammar | `GenericFilePanel.tsx:178` | `File content is not a valid: {fileError}` has shipped |
| Delete `helpers/GenericViewerPanel.tsx` | — | 92 dead lines; nothing imports it, only its stylesheet is still read |
| `dialogOptionKeys` += `iconName`, `danger` | `controls/overlay/DialogProvider.tsx:85-95` | Both are declared on `DialogOptions:43-46` and consumed by `ManagedDialog:272`, but absent from the guard, so `isDialogOptionsShape` returns `false` for them and a two-argument custom-render `open()` that passes either is misrouted to the managed overload. Latent — no call site passes them yet — and it will not stay latent, because Phases 38–41 add exactly those call sites |

**Resolve the `width` unit fork (§1.3) in this phase**, before Stages 2 and 4 start surveying for M2.

This does not need designing — `controls/layout/cssWidth.ts` already carries the decision in its own
doc comment: *"The number therefore stays px here while the tabular call sites move to explicit `ch`
strings. When none are left, this helper and the number half of the `width` prop go with it."* The
plan is written; nobody has executed it. What Phase 15 adds is the order: move the remaining tabular
call sites to `ch` strings **before** Phase 14's M2 test tries to survey them, because a bare number
tells the test nothing about which wrapper it reached, and the note explains exactly why reading them
as `ch` wholesale would inflate a `width={160}` column to 960px.

Do not merge `controls/data` and `controls/layout` on the strength of this. The lessons file's
*"never merge two things because they resemble each other"* has already cost this project three
consolidations, and `controls/layout` exists to add `TooltipFactory` behaviour that `controls/data`
deliberately does not have.

#### Phase 15b — The misspelling sweep

§4, decision 5. Sub-numbered because it is mechanical and belongs in Stage 1 for one reason: **a
rename must land before the phases that edit those files**, or every later phase carries avoidable
conflicts. Do it in one commit, touching nothing else, so the diff stays reviewable.

| Misspelling | Scope | Note |
|---|---|---|
| `flagDecriptions` → `flagDescriptions` | 6 files: `common/abstractions/SysVar.ts`, `ZxNextSysVars.ts` (×6), `ZxSpectrum48SysVars.ts` (×5), `ZxSpectrum128SysVars.ts` (×2), `SysVarsPanel.tsx` (×2), `test/controls/SysVarsPanel.test.tsx` | The field is declared on a **type** in `SysVar.ts`, so this is a typed rename the compiler checks end to end — the safest item here |
| `spceified` → `specified` | `appIde/commands/DialogCommands.ts:20` | **User-visible** in command help |
| `lenght` → `length` | `z80-disassembler/zx-spectrum-48-disassembler.ts:117,119,121` (a local), `KliveCompilerCommands.ts:296` (a comment) | Local scope; no API change |
| `Sitebar` → `Sidebar` | `theming/theme.ts:150` | A comment |
| `SideBarPanels/` → `SideBarPanels/` | The **directory**, plus 7 importers | See below |

The directory rename is the only non-trivial one, and it is worth doing precisely because the
correctly spelled `SideBar/` sits next to it — two directories one letter apart, one right and one
wrong, is a standing invitation to import from the wrong one.

Follow `AGENTS.md`: *"After moving or deleting component files, scan both alias and relative imports,
then run `npx electron-vite build`"* — a path-only break type-checks clean and fails at Vite's import
analysis. Use `git mv` so history follows, and check `registry.ts`, which imports fourteen panels
from that folder.

**Do not batch anything else into this phase.** A mechanical rename is reviewable only while it is
provably mechanical; one behavioural change hidden in a 200-line path diff is invisible.


##### Phases 15, 15b, 16 exit *(2026-09-13)*

**Phase 15.** `.panelFont` and `.invalid` are on the scale with declared leading; the invalid body is
an `EmptyState` showing the loader's own sentence (the wrapper text produced "File content is not a
valid: Invalid file size, …"); `GenericViewerPanel.tsx` and `cssWidth.ts` deleted;
`dialogOptionKeys` completed and made self-maintaining.

Two things went further than planned, both for the same reason — the fix as written would have been
incoherent with what was already there:

- **`EmptyState` gained a `tone`.** The plan said "use `EmptyState`", but the invalid body is a
  *failure* and `EmptyState` renders `--data-secondary` — so the conversion as specified would have
  demoted a parse error to neutral grey. An absence and a failure are different facts. `tone="error"`
  (`--status-error`) is the distinction, and five upcoming phases (28, 30, 31, 33) need it too.
- **The option guard is now a `Record<keyof Required<DialogOptions>, true>`.** Adding the two missing
  keys to a `Set` would have left the next key to go missing the same way; a `Set<keyof T>` only
  constrains what goes in and cannot require completeness. This fails the build instead.

**The width fork closed differently than §1.3 proposed.** Removing the bare-number form from the
three layout cells breaks eleven call sites, all in panels owned by later phases — and converting
their px measures to `ch` is a *visual* decision belonging to those phases. So every numeric became
an explicit `"Npx"` string: nothing moved on screen, the unit is now written where it is read, and
Phase 14's M2 rule was extended to match px strings and px-valued `*WIDTH` constants so the debt is
tracked rather than hidden. `LayoutPrimitives.test.tsx` gained the case that proves it mattered —
written as `width={40}`, the number now reaches `controls/data` and renders **320px**.

**Phase 15b.** Five renames landed, including two the plan had not found: the `--bgcolor-sitebar`
token and the `SiteBar` component exported from `SideBar.tsx`. `SiteBarPanels/` → `SideBarPanels/`
went through `git mv` with all 7 importers updated; `electron-vite build` is the gate that proves it,
since a path-only break type-checks clean.

**Phase 16.** Ten defects across five panels. Three are worth naming:

- **Breakpoints** kept its disassembly in a ref filled in place across an `await` per breakpoint,
  while `bps` still held the previous list — so any render landing in that window drew new
  instructions against old rows. Fixed by construction rather than by ordering: one state value
  holding `BreakpointInfo & { instruction }`, one update.
- **`FlagFieldRow`'s double tooltip**, recorded as known-and-unfixed in main-plan §12.3, is fixed —
  one row tooltip whose content follows the pointer, using the `onHoverBit` prop Phase 12 added for
  exactly this. §12.3 deferred it because it touched five panels nobody had asked about; Phases 19
  and 20 are that ask for two of them.
- **Watch's `|| []`** needed reading before fixing. `WatchBadge` and the lessons file both call
  selecting the *items* correct for the panel, so the answer was not a count — only the fresh-literal
  fallback was wrong (`?? EMPTY_ARRAY`).

`test/controls/Phase16Regressions.test.tsx` (4 tests) pins the Watch fetch guard and the Call Stack
empty state; both were watched failing with the fix reverted.

#### Phase 16 — The panels already called done

Live bugs in shipped-modern panels. These come before any new conversion because a converted panel
that is wrong is worse than an unconverted one — it carries the authority of the new treatment.

| Panel | Defect | Note |
|---|---|---|
| Watch | `WatchPanel.tsx:45` `useSelector((s) => s.watchExpressions \|\| [])` allocates a fresh `[]` per store update while empty, so referential equality never holds, the panel re-renders on every unrelated update and re-runs the effect at `:117-119` that has `watchExpressions` in its deps | **Read the nuance before "fixing" it.** `WatchBadge.tsx:13-16` and the lessons file both call this form *correct for the panel* — the panel needs the items, the badge needs a count. So the answer is **not** to select a length here. It is the `\|\| []` fallback alone that is wrong: a fresh literal where a stable one belongs. `EMPTY_ARRAY` is in `utils/stablerefs.ts` and `ExplorerPanel.tsx:15` already uses it |
| Watch | `:121-125` fetches all 64K at ~1.3 Hz with zero watches defined | `SysVarsPanel.tsx:332` guards with an early return; the same guard belongs here |
| Watch | `:141-147` `try { displayedWatches[idx] } catch` — indexing does not throw; the catch is unreachable and hides real render errors | Same dead pattern at `BreakpointsPanel.tsx:~415` |
| Next Registers | `:248`, `:254`, `:262` bind three `TooltipFactory`s per row, and `SliceRow:130` a fourth | `MemMappingPanel.tsx:105-121`'s `TipRow` is the settled one-per-row pattern, in the same folder |
| Next Registers | `:145` module-level `nextRegDescriptors` cache, effect deps `[emuApi]` only — a machine switch keeps the previous machine's slice descriptors | `SysVarsPanel.tsx:315` re-fetches on `machineId`; §12.1 of the main plan is the rationale |
| Next Registers | `:218` `regVals[idx]` unguarded in a virtualized row | `NecUpd765Panel.tsx:45` and `ScriptingHistoryPanel.tsx:75` both guard |
| Call Stack | `EmptyState` shows only while `refreshed === false`; a refresh landing with `frames === []` renders an empty list silently (`:95-108`) | |
| Call Stack | `refreshMemoryMappingState` (`:71`) is a copy-paste name from `MemMappingPanel`; it fetches the call stack | |
| Breakpoints | `:~352` looks the disassembly up by **row index** into a separately maintained ref array, not by breakpoint identity — any reorder between fetch and render shows the wrong instruction against the wrong breakpoint, silently | The most serious item in this phase |
| ULA | `:29` `{ ...ulaState, keyLines: [...ulaState?.keyLines] }` — the `?.` protects the read, `[...undefined]` throws | The `?.` says the author expected `null` to be reachable |

Also reap the dead CSS the audit found: `.listArea` (`BreakpointsPanel.module.scss:92`), `.editor`
(`ExplorerPanel.module.scss:180`, which also carries the only hardcoded colour in the sidebar),
`.flags`/`.rows`/`.cols` (`PsgPanel.module.scss:7,13,20`).

### Stage 2 — Sidebar panels

Each phase converts one panel to `controls/data`, clears its M1/M2 baseline entries, and fixes the
bugs listed against it. The treatment is §11.2 and §12.1 of the main plan; do not invent a new one.

#### Phase 17 — PSG (AY-3-8912)

94 lines, the cheapest panel in the backlog, and it has a **shipped data bug**: `PsgPanel.tsx:60`
labels a row `CntC` and reads `psgState?.cntB`, so channel C's counter displays channel B's value.
`cntC` exists and is populated (`emu/machines/zxSpectrum128/PsgChip.ts:241`). Fix that first and
separately, so it is not buried in a conversion diff.

Then: `LabeledValue`/`LabeledFlag` → `DataPanel` + `SimpleValue`/`FlagValue`; an `EmptyState` for
`psgState === null` (today 33 rows of blanks); the three dead CSS classes.

#### Phase 18 — 6510 CPU · Phase 19 — VIC · Phase 20 — BLINK

These three are **structurally converted and chromatically not**: zero `valueXclass` and zero
`iconFill` between them (25 `SimpleValue`, 46 `FlagValue` and 3 `Bit16Value` in VIC alone), against
22 and 13 in `Z80CpuPanel` and 11 and 3 in `UlaPanel`. That is why the C64 and Z88 debug sidebars
read as unfinished beside the Spectrum one.

**The grant is given** (§4, decision 1): these three take the same colouring *principles* as the Z80
CPU and ULA panels. That wording matters — apply §10.3's reasoning, not a find-and-replace. The
payload takes `--color-state-value`, the place it lives takes `--color-state-value-alt`, and flag
glyphs take `iconFill="--color-state-value"`, each decided per row the way `Z80CpuPanel` and
`UlaPanel` decided theirs.

VIC is the density test. 74 accented values in one panel is more than three times the Z80's 22, and
if the converted panel reads as uniformly loud, the answer is a sharper primary/alt split — not
reversing the grant, and not reaching for the secondary accent, which §5 reserves for one case this
is not.

Beyond the colour grant:

- **VIC** `:20` `BIFLAG_GAP = 10` reaches `LabelSeparator` as 10px (§1.3). Convert after Phase 15.
- **BLINK** `:236` passes a native `title` to `DataLabel` — unstyled, on the browser's clock, and it
  fires alongside the row tooltip. This is the pattern §12.0 removed from `SysVarsPanel`.
- **Both** still carry `FlagFieldRow`'s double tooltip, recorded as known-and-unfixed in main-plan
  §12.3. It is now fixable from the `onHoverBit` prop Phase 12 added
  (`controls/data/registers.tsx:327-355`). §12.3 left it alone because *"changing it changes five
  panels the author has not asked about"* — Phases 19 and 20 are that ask for two of them.


##### Phases 17–20 exit *(2026-09-13)*

**Phase 17 (PSG)** fixed the shipped data bug — `CntC` read `psgState.cntB` — and the fix is
structural, not a one-character edit: the three channels were three hand-copied seven-row blocks,
which is the shape that defect lives in, and they are now one parameterised `PsgChannel`. A copy
cannot carry the bug. `test/controls/PsgPanel.test.tsx` gives each channel a distinct counter so a
wrong read is visible rather than plausible, and was watched failing against `cntB`.

The panel also lost its stylesheet entirely. It had one rule, `@include side-panel-content` — which
`DataPanel` now supersedes, and whose `display: block` would have overridden the flex column
`DataPanel` lays its rows out in. An empty class is stripped at build time, so keeping it as a
"DOM hook" would have been a comment describing something that does not exist.

**Phases 18–20 (6510 CPU, VIC, BLINK)** took the colour grant: 12/54/13 `iconFill`s and 9/28/1
`valueXclass`es. The §10.3 split does the work — payload on `--color-state-value`, labels on
`--data-label` — which is what keeps VIC's 74 values a hierarchy rather than a wall.

Also in these: BLINK's native `title` (the last one in the sidebar) became the app's tooltip, and
its `LAB_WIDTH = 7` — a bare number that reaches `DataLabel` as `ch` with nothing at the call site
saying so — is now `"7ch"`. VIC's `BIFLAG_GAP` stays px and says so: it feeds a `LabelSeparator`,
which is a spacer, and M2 governs columns.

#### Phase 21 — NEC UPD 765 Log

`:51,55,59,63` paint the log's icons from `--console-ansi-white` / `-bright-cyan` /
`-bright-magenta` — the console palette in a sidebar data panel, the pattern `WatchPanel.tsx:19-27`
documents removing from itself. The icon switch (`:48-65`) has no `default`, so an unknown `opType`
reaches `<Icon iconName={undefined}>`. `:25-35` re-pulls and wholesale-replaces the entire log at
~1.3 Hz; the log is append-only, so a length check suffices. Finish the `controls/layout` →
`controls/data` move (`DataRow` and `EmptyState` are already in).

#### Phase 22 — Scripting History

- `:45` `{scripts.length >= 0 && (…)}` is always true, so there is **no empty state** — an empty
  history renders a bare "Scripts displayed: 0".
- `:36-41` a 5-second `setInterval` that never clears. It exists to advance elapsed durations, but
  every completed script has a fixed `endTime` (`:134-149`), so once nothing is pending it is a
  forced re-render of the whole virtualized list, forever. Clear it when no script is pending.
- `:108` `let to = new Date()` during render — the same state renders differently twice.
- `:79`/`:156` `itemKey` is passed down and applied as `key` on the row's own root element, which
  React ignores. A re-render hack with no effect; delete it.
- `:104-112` `initialized` state that is never read, costing one extra render per visible row.
- Console ANSI as status colour (`:120-148`, `.module.scss:50,76`); px columns
  (`.module.scss:49,61,80,89` — including a **400px fixed column in a sidebar that is often
  narrower than that**).
- A `SideBarBadge` for pending/failed scripts is meaningful here and absent. Per §11.3's convention a
  badge states a fact worth watching, and a running script is exactly that.

#### Phase 23 — Open Editors

Three `0.9em` (`.module.scss:15,100,120`), a hardcoded `height: 26px` (`:25`) that ignores the user's
font-size setting, hand-rolled rows and empty state, two native `title` tooltips per row (`:80`,
`:124`), and `e.code` in the key handler (`:84`) so `NumpadEnter` does not activate a row. Every row
is `role="button"` with no enclosing list role, so a screen reader hears N unrelated buttons.

#### Phase 24 — Klive Project (Explorer)

The largest sidebar item at 891 lines. Carries `color: white` (`.module.scss:183`) — though that rule
is dead and should be deleted rather than tokenized — three `em` sizes, `height: 26px`, three
`!important`s fighting the `Icon` primitive (`:164,167,171`), a dead `onClick={() => {}}` (`:397`),
and px glyph constants (`ExplorerProjectItem.tsx:28-29`, and `LabelSeparator width={7}` at `:106`).

The real defect is a **missing empty state**: `:407-408` returns `null` when a folder is open but
`visibleNodes` is empty, so a project whose contents are all excluded renders a blank panel with no
explanation. `ExplorerEmptyState` covers only the no-folder-at-all case.


##### Phases 21–24 exit *(2026-09-13)*

**Phase 21 (NEC UPD 765).** The console palette came off — but as a *redraw*, not a deletion. Read
Data and Read MSR were the same left arrow told apart by cyan versus white, so stripping the colour
would have merged two operations into one; the status read now takes the circled arrow, and four
operations are four marks in one neutral tone. The switch became a lookup with an explicit unknown
fallback (it had no `default`, so an unrecognised `opType` reached `<Icon iconName={undefined}>`),
and the append-only log is compared by length instead of being replaced wholesale ~1.3×/s.

**Phase 22 (Scripting History).** The always-true `scripts.length >= 0` is gone, along with the two
redundant wrappers it needed, and an empty history now says so. The five-second timer runs only while
a script is pending — every other status has a fixed end time, so it was re-rendering the list for
ever to recompute numbers that cannot change. The dead `itemKey` (applied as `key` on a component's
own returned element, where React ignores it) and the unread `initialized` state are gone; `now` is
read once per panel render and passed down, so the same state cannot draw twice differently. Status
colours moved from the console's ANSI palette to `--status-*`; the build-script *type* icon went
neutral, per the other half of §5.2's rule. A `ScriptingHistoryBadge` counts running scripts —
`accent`, because unlike Watch and Breakpoints this is "something is happening now" rather than a
standing fact.

**Phase 23 (Open Editors)** and **Phase 24 (Explorer)** cleared their `em` sizes and private 26px row
heights, and the Explorer's three `!important` fills became a doubled class — the deterministic way
to outrank a single-class selector from another file, and the convention already used elsewhere here.
The Explorer's opened-but-empty case, which returned `null`, now explains itself.

**Open Editors is where the tests earned their keep.** Two of my changes were wrong and its suite
caught both:

- `role="list"` + `role="listitem"` reads better in the abstract, but ARIA's `list` requires
  `listitem` children — so announcing the rows as a list means giving up the `button` role that says
  what they *do*. It is a `role="group"` with a label instead.
- `aria-label` carrying the file path **replaced** the accessible name that the row's own content was
  already supplying, so a screen reader would have read `/proj/src/a.asm` where the eye reads
  `a.asm`. The path belongs in the tooltip; the unsaved state is named on the marker, where it
  appends to the row's name instead of displacing it.

Two native `title`s per row became one styled tooltip, and the key handler moved from `e.code` to
`e.key` — `code` is the physical key, so the keypad's Enter reported `NumpadEnter` and could not
activate a row. There is now a test for that.

### Stage 3 — Tool panels

#### Phase 25 — Commands + Output

**Commands** — `.module.scss:112` sets `font-size: var(--panel-font-size)` on `.prompt` with no
`line-height`, and `.promptPrefix:95` pairs it with a magic `line-height: 1`. This is exactly the
survey the lessons file says to re-run after adding a panel (*"a panel that is not a `DataPanel` gets
no declared leading, and nothing tells you"*) — the grep that file calls clean is not clean any more.
Also: `:45` `inputRef?.current.focus()` guards the wrong side of the chain; `:39` puts `inputRef.current`
in a dependency array, where it does nothing; the history index is never reset after a command runs,
so the next ArrowUp resumes mid-history; `e.code` and `e.key` are mixed in one handler (`:79`, `:95`).

**Output** — a fourth independent empty-state treatment (`:91-100`). That one is defensible: the hints
carry `<code>` markup and `EmptyState`'s `message` is string-only (`controls/data/index.tsx:85`).
Either widen `EmptyState` to take a node or record why it stays private. Plus `Dropdown width={140}`
(`:127`), an off-scale `padding: 1px 5px` (`.module.scss:91`), and a stale `isEmpty` that the header's
Clear button bypasses.

### Stage 4 — Document panels

#### Phase 26 — Unknown file viewer

15 lines, `font-size: 0.8em`, and a hand-rolled div where `EmptyState` belongs — but it is the app's
canonical "there is no viewer for this" screen, so whatever it becomes is the treatment Phase 27's
seven stubs copy. That is the only reason it goes first.

#### Phase 27 — The seven stub viewers

`Sna`, `Shc`, `Shr`, `Slr`, `Sl2`, `Vid`, `Nxi` are identical 14-line bodies that render a
`PanelHeader` **and nothing else**. Opening a `.sna` gives a title bar over an empty rectangle with
nothing saying the viewer is unimplemented. Each destructures `({}: DocumentProps)` and drops the
`contents` the factory threads in.

One `EmptyState` reading **"Not implemented yet"** each, reusing Phase 26's treatment (§4, decision
2 — no implementations). Seven surfaces, seven lines, and it is the cheapest item in this document.

Use the same words in all seven, and take them from one shared constant rather than typing the
string seven times: these panels are the strongest candidate in the app for someone later adding an
eighth by copying a seventh, which is exactly how the NEX dialog family (Phase 41) drifted.

#### Phase 28 — Command Result + Script Output

One phase because the defects are identical: a hand-rolled `.panel` root with `font-size: 0.8em`
(`:8` in both) instead of `DataPanel`, and a **dead `.header` block** in both stylesheets (`:13-20`,
`fix-height-panel(30px)`) left behind when `PanelHeader` replaced the private header.
`CommandResult.tsx:31` reads `buffer` with `?.` then calls `buffer.getBufferText()` unguarded at
`:50`. `ScriptOutputPanel.tsx:192` renders the literal string `Lines: undefined` before the buffer
resolves.

#### Phase 29 — Image viewer

`<img>` at `:214-223` has `onLoad` and no `onError`, so a corrupt image leaves a blank pane with a
live zoom control and no message. `:49` declares any unrecognised extension `image/png`. Effect deps
at `:104` and `:120` omit the document identity, so renaming keeps the stale MIME type. Plus
`0.85em` (`.module.scss:38`), `min-width: 32px` on a text measure (`:36`), and an inline
`cursor: grab` (`:193`) duplicating what `:87`/`:202` set imperatively.

#### Phase 30 — TAP/TZX viewer

`readTapeFile(contents)` runs in the render body (`:32`), so the whole tape is re-parsed on every
render — including every `DataSection` expand, which dispatches a hub state change that re-renders
this component. The error path (`:38-44`) renders a bare red bar and discards what the parser knew.
`TzxNotImplementedBlockUi` (`:334`) declares a `block` prop it never uses, so it cannot say which
block it failed on; `:79-82` prints `(unknown section 0x..)` for 17 TZX ids that have no renderer.

Its private `ValueLabel` (`:174-176`) is a byte-for-byte duplicate of `DskViewerPanel.tsx:277-279` —
do Phases 30 and 31 in that order and the second inherits the shared one.

#### Phase 31 — DSK viewer

The one crash found in the document set: `:186` indexes
`ti.sectors[selectedSectorIdx - 1].sectordata.length` with no `sectors.length` guard, while the
logical view at `:227` has one. A zero-sector track throws.

Also: `readDiskData` + `createDiskSurface` in the render body inside `catch { /* Intentionally
ignored */ }` (`:40-45`) — the whole disk surface is re-materialised every render and any parse error
is discarded, leaving "Invalid disk file format" with no reason. `:129` and `:135` render
`floppyInfo.bytesPerTrack` under **two different labels** (`B/T` and `TLen`). `:115` hardwires
"Write protected" to `true`, `:117` "Has weak sectors" to `false`, `:120` "Total:" to `0`. `:32-35`'s
`showPhysical` initializer always evaluates `false` because `docState` is `{}` at that instant.
`:93` is a permanently empty div; `:203-223` is 21 commented-out lines.

#### Phase 32 — PAL/NPL palette editor

`PaletteEditor.module.scss:16` and `:18` set `font-size` twice in the same block (`0.8em` then
`1em`); the first is dead and both violate M1. Raw colour literals in TSX: `:65-66` and `:432`
`midColor = … ? "white" : "black"`, applied inline at `:244` and `:448`. Console ANSI borrowed for
the R/G/B channel headings via inline styles (`:262,287,312`). px column widths on a tabular colour
grid (`:43,52,64`).

Note `PalFileEditorPanel.tsx:28` distinguishes `.npl` from `.pal` by sniffing the document **id**
string, even though the two are separate registry ids (`registry.ts:416`, `:421`) pointing at one
factory. Give the factory the flag instead.

#### Phase 33 — SCR viewer

`loadScrFileContents` (`:82-94`) splits pixels and attributes into a `ScrFileContents` that is never
read — `:53` passes raw `contents` on and `createScrPixelData` re-splits at `:106`. The parse exists
only as a length check; say so or delete it. **The colour table (§4.2): the labels are correct, the word `ARGB` is not.** These are ABGR as
written, which is what reaches the canvas as RGBA bytes. Fix the comment in `:138`, and fix the
byte-identical copy in `emu/machines/CommonScreenDevice.ts:122`. Better: delete the viewer's
duplicate and read the machine's table, so the next change happens once.

`:39` uses the legacy `--color-value`.

#### Phase 34 — NEX file viewer

The most-converted of the Next viewers and the newest code in the repo — `--color-state-value`,
`--accent-text` and `--text-secondary` are all correct, with rationale comments. What is left is
type: `0.92em` and `0.84em` (`.module.scss:95,111`) compounding off Phase 15's inherited `0.8em`,
`em` metrics at ten more sites, a `minmax(280px, 1fr)` grid for a column of monospace values, and
four legacy tokens (`--color-value`, `--bgcolor-errorLabel`, `--bgcolor-toolbar`,
`--color-toolbar-separator`). Headings are a private `HeaderAttributeGroup` (`:656,677,700,718`)
where `SectionHeader` belongs.

#### Phase 35 — Static Memory Dump

2165 lines carrying the static dump, the NEX annotated disassembly, six dialog integrations and a
context menu. It already uses `PanelHeader`, `useRowSizes()`, `DisassemblyRow` and
`MemoryDumpSection`, but `:1651` passes `fontSize="0.8em"` — the literal pattern
`MemoryPanel.tsx:347` was changed away from — and `:1763`/`:2138` hand-roll zebra and hover on the
legacy `--bgcolor-disass-even-row` / `--bgcolor-disass-hover` instead of `DataRow` and
`--color-memory-*`.

Splitting this file is worth costing but is not a modernization task; if it happens, it should
happen before Phase 41, which touches the seven dialogs it hosts.

#### Phase 36 — Sprite editor

Already token-clean on type — `var(--font-size-100)` / `--font-size-50` throughout, no `em`, no hex.
What it does not have is a single `controls/data` import across 15 files: `SpritePaletteHeader`,
`SpriteStageHeader`, `SpriteSheetToolbar` and `SpriteStatusBar` are four private headers where
`PanelHeader`/`SectionHeader` belong.

Two real bugs. `ColorSample.tsx:23` is an `<svg viewBox="0 0 16 16">` with no `width`/`height` and no
`svg` rule in the stylesheet, so it takes the replaced-element default **300×150** inside a 20×20
swatch — the same defect Phase 13 fixed in the palette grid, in a file that phase did not reach.
And `SpriteEditor.tsx:735-748` passes `floating={{ … }}` as a fresh object literal every render, so
`memo(SpriteEditorGrid)` (`:658`, default shallow compare) never hits while a paste is in the air and
the 256-cell grid re-renders on every parent render — the same "memo keyed on an identity that
changes every render" as §13.2's swatch.

#### Phase 37 — Z80 snapshot viewer

913 complete, working, unreachable lines: `Z80_VIEWER` is registered (`registry.ts:380`) but the
`.z80` `fileTypeRegistry` entry is commented out (`registry.ts:621-629`), so nothing routes a file to
it. **Revive it** — §4.1 has the research and the reasoning.

In order:

1. **Verify the PASTA/80 artifact first.** Build a `.pas` with `PASTA80_KEEP_TEMP_FILES` on and read
   the first bytes of the `<stem>.z80` it leaves behind (`Pasta80Compiler.ts:102`). A real snapshot
   means the route is a feature. A raw binary means the registry needs a content sniff, because
   dispatching on extension alone is then wrong for two different producers of the same suffix.
2. Uncomment `registry.ts:621-629`, **dropping `iconFill: "--console-ansi-bright-magenta"`** —
   `test/theming/doc-icon-neutrality.test.ts` pins the no-tinted-doc-icons rule with source text
   included, so restoring that line verbatim fails CI. That is the gate working as designed.
3. M2 pass: `:13-14` `REG_LABEL_WIDTH = 32` / `REG_PAIR_VALUE_WIDTH = 108` are px on a register
   table. Needs Phase 15's `ch` treatment before the rest of the conversion.
4. Then the panel itself: no stylesheet, no `controls/data`, everything on
   `Row`/`LabeledText`/`ExpandableRow`.

**This phase needs tests that the other document phases do not.** The viewer has been dark since
March 2026, so nothing has exercised its v1/v2/v3 branches or its `ED ED xx yy` decompressor in that
time. Fix the routing and the panel renders whatever the parser produces, correct or not. Pin the
decompressor and the three header versions against real files before trusting the display.

##### Stage 4 exit — Phases 26–37 *(2026-09-13)*

All twelve document panels done. **M2 is now zero**; the M1/M2 baseline is **57 → 31**, all M1, and
`build/type-errors-baseline.json` went 126 → 125 (one error cleared, locked in). Full suite
**20,592 passed / 0 failures**; `electron-vite build` succeeds; lint 0 errors.

**Two findings changed what a phase did.**

**§4.2's SCR correction went further than a comment.** The plan had this as "fix the word `ARGB` in
two files". Doing it exposed the real problem: the sixteen-entry table existed *twice*, in
`CommonScreenDevice` and in the SCR viewer, each with its own copy of the wrong heading — a palette
two files state independently is one that will eventually disagree with itself. It is now
`emu/machines/spectrum-colors.ts`, stating the byte order once and explaining how to check it, with
`test/renderer/Stage4Regressions.test.ts` asserting it on the entries whose channels actually
differ. A grey or a white passes under either reading; red and blue do not.

**Phase 37's PASTA/80 check could not be performed here** — it needs the external compiler, which is
not installed. So the phase was made safe rather than left blocked: `loadZ80FileContents` walked
straight into the 30-byte header and would run off the end of anything shorter, so a non-snapshot
`.z80` would have thrown. It now reports. That guard is what makes re-enabling the route correct
whatever PASTA/80's temp file turns out to contain, and it is worth having regardless — the parser
had been unreachable for six months, so nothing had exercised it.

The re-enabled entry also proved a gate works: restoring it verbatim brings back
`iconFill: "--console-ansi-bright-magenta"`, which `doc-icon-neutrality.test.ts` rejects with source
text included. Dropped, and pinned by a test of its own.

**The rest, briefly.**

- **26–27** — the Unknown viewer sets the treatment, the seven stubs share one
  `NOT_IMPLEMENTED_MESSAGE` constant rather than seven copies of a string. Eight blank rectangles
  now say what they are.
- **28** — both console panels lost their hand-rolled roots and their dead 30px `.header` blocks;
  `CommandResult` no longer throws when a document arrives with no buffer, and `ScriptOutputPanel`
  no longer renders the literal text `Lines: undefined`.
- **29** — the image viewer gained `onError` (a corrupt file left a blank pane beside a live zoom
  control), stopped declaring unrecognised extensions `image/png`, and now rebuilds its blob URL
  when a rename changes the extension.
- **30–31** — the tape and disk viewers each re-parsed their whole file *in the render body*, on
  every `DataSection` expand. Both are memoised, both surface the reader's own message instead of a
  bare red bar, and their byte-identical private `ValueLabel` is now one shared component. The DSK
  viewer's `Total:` (`0`), `Write protected` (`true`) and `Has weak sectors` (`false`) were
  hardcoded: two are now derived from the surface and the third is deleted, because nothing in the
  data carries it and a field that is always the same value is not a field. `B/T` and `TLen` showed
  the same number under two labels. The crash — an unguarded sector index in the physical view,
  twice on consecutive lines — is guarded once, around the block that needs it.
- **32** — the palette editor's `"white"`/`"black"` inks are named `inkForSwatch` and justified as
  the §13.2 exception they are (contrast against user data has no theme answer). Its R/G/B headings
  went **neutral**: they are the words "Red", "Green" and "Blue", so the console-ANSI hue restated
  what the text already said. And `.npl` is now distinguished from `.pal` by `document.type` — the
  editor id the registry assigned — rather than by sniffing the document id for a suffix a path need
  not end in.
- **34** — the NEX viewer's `0.92em`/`0.84em` were compounding off `GenericFilePanel`'s `0.8em`, so
  the real size was 11.8px; four legacy tokens repointed; its eight px widths converted to `ch`,
  which is what took M2 to zero.
- **35** — `fontSize="0.8em"`, the literal pattern the two reference panels were changed away from.
  Its zebra rows are **not** converted to `DataRow`: that is a real change to a 2165-line file that
  also hosts Stage 5's seven dialogs, and it belongs with splitting that file rather than bolted
  onto a type fix. Recorded rather than half-done.
- **36** — `ColorSample`'s `<svg viewBox>` with no `width`/`height` took the replaced-element
  default of **300×150** inside a 20px swatch, the same defect §13.2 fixed in the palette grid in a
  file that phase did not reach. And `SpriteEditor` passed `floating` as a fresh object literal, so
  `memo(SpriteEditorGrid)` never hit while a paste was in the air.

### Stage 5 — Dialogs

`.plans/DIALOG_MVC_REFACTOR_PLAN.md` is complete and its exclusions are deliberate; this stage does
not reopen them. It covers the eight dialogs that plan never mentions, plus visual debt.

#### Phase 38 — Z88 Export Card

36 lines with a bug that has shipped:

```
title={`Export the Content of Z88 Card in Slot ${slot}
iconName="repo-push"`}
```

The closing backtick is misplaced, so `iconName="repo-push"` sits **inside the title template
literal**. The header renders that text as part of its title and, because no `iconName` prop reaches
`Modal`, never draws its accent chip.

The body says "This function is not implemented yet" while the footer still offers an enabled **Ok**
that fires `onExport?.({ slot })` into a live result path. Either `primaryVisible={false}` or a
disabled primary. No tests exist for this dialog.

#### Phase 39 — Set Memory

`:80` `style={{ color: "#ff6b6b", … }}` — the last raw hex colour in any dialog; the ROM warning
wants `--status-error`. `bigEndian` (`:47`) is never reset when `sizeOption` returns to `-b8`, so
picking "4 bytes", ticking big-endian, then returning to "1 byte" submits `-be` from a disabled
checkbox. `validate()` (`:49-52`) awaits a command and handles only `success === false`; a throw
escapes `DialogForm`'s `await onSubmit()` as an unhandled rejection with no error surface.

#### Phase 40 — SjasmPlus integration

The MVC reference implementation, and the one place where axis B is done and axis A is not: raw
`<input type="radio">` (`View:30,40,52,66`) where `RadioGroup` exists, raw `<select>` and
`<input type="checkbox">` (`SourcePanelOnline:46,61,78`) where `Dropdown` and `Checkbox` exist, the
**section-divider** token `--border-modal-section` on field boxes (`.module.scss:113,131`) where
`--border-input` belongs, and four body buttons with no `variant` so Refresh, Select folder…,
Download… and Browse all render as filled primaries.

#### Phase 41 — The NEX annotation family

Seven dialogs, 1795 lines, written in sequence last commit, each copying the last. Their defects are
systematic rather than individual, which is what makes them one phase:

1. **None of the seven passes `iconName`** — `StaticMemoryDump.tsx:988,1037,1079,1156,1203,1272,1407`
   pass only `{ title, width }`, so none gets a header chip.
2. **Hand-rolled `<input>`/`<textarea>` throughout** where `TextInput` exists.
3. **Those fields carry `border: none`** — the exact "a control that distinguishes itself only by
   fill is invisible in light" case `--border-input` was introduced for.
4. **No `variant="secondary"` anywhere.** Every footer is two or more filled primaries. The
   mechanism is worth naming: `variant="secondary"` appears in only two files in the whole app,
   `DialogForm.tsx:58` and `Modal.tsx:333,345`. A dialog that uses the shell's footer gets the
   distinction free; these seven are the only dialogs that draw their own band via `DialogFooter`,
   so they are the only ones that lost it. `Button.tsx:11-15` documents this exact failure.
5. **19 `em` font sizes**, the largest M1 block in the repo — a third of every M1 violation that
   existed when Phase 14 counted them.
6. **No `role="alert"` on any error**, where `BreakpointDialog.tsx:167,226` and `DialogField.tsx:32`
   both do it correctly.
7. **`NexRegionsDialog` and `NexLabelsDialog` have no `<form>`**, so their autofocused search inputs
   swallow Enter, unlike their five siblings.

Escape and focus-trapping are fine — they come from `Modal.tsx:145-193`, not from these dialogs.

**Extend `test/renderer/NexAnnotationDialogConsistency.test.ts` before making the changes.** That file
already scans the folder for six conventions and is the right shape — *"assert the conventions over
the folder rather than over the dialogs someone remembered to check, which is the only way an eighth
dialog inherits them."* It does not yet cover items 2–6 above. Add those rules, watch them go red
against the current tree, then fix. A test written after the fix is worth nothing until it has been
seen to fail.

#### Phase 42 — Dialog cross-cuts

- `Modal.tsx:118-131` — `const close = await onPrimaryClicked?.(); if (!close) doClose();`. The
  variable named `close` means *keep open*. Four MVC containers each carry a comment correcting it
  (`SjasmplusIntegrationDialog:99`, `ExcludedProjectItemsDialog:95`, `Z88ChangeRamDialog:67`,
  `Z88InsertCardDialog:87`). Four copies of one clarifying comment is the signal; invert the name.
- `Modal.tsx:181-195` computes `isTopModal(modalId)` twice.
- Dead props: `isFolder` on `RenameDialog:11` and `DeleteDialog:7` (both passed by
  `ExplorerPanel:242,268`), `machineId` passed at `useBreakpointDialog.ts:69` and undeclared on
  `BreakpointDialog`'s props, and a dead `Modal` import at `NewItemDialog.tsx:2`.
- `useBreakpointDialog.ts:42-47` — `Promise.all` of four `emuApi` calls with no failure path; a
  rejection escapes unhandled and the dialog silently never opens. This is defect class #6 that
  `DIALOG_MVC_REFACTOR_PLAN.md:1338-1340` records as fixed for two other dialogs.
- `FirstStartDialog.tsx:41,46` dispatches `startScreenDisplayedAction()` twice on the website path.
- `DialogCommands.ts:20` — "Displays the spceified dialog", user-visible in command help.
- Dialog widths are 12 distinct bare pixel literals with no shared scale. Decide whether that
  deserves a scale or is genuinely per-dialog; do not introduce one silently.

##### Stage 5 exit — Phases 38–42 *(2026-09-13)*

All five dialog phases done. Full suite **20,605 passed / 0 failures**; the type baseline went
**125 → 123** (two more errors cleared, locked in); the style baseline is **31 → 12**, all M1 and
none of it in a dialog. `electron-vite build` succeeds, lint 0 errors.

**Phase 41 was done test-first, and that is what made it safe.** The five new rules in
`NexAnnotationDialogConsistency.test.ts` were written before any fix and **all five were red across
the whole family** — which is the point of asserting over the folder rather than over the dialogs
someone remembered to check. The seven dialogs now share the app's `TextInput` and `RadioGroup`,
carry `--border-input` on their fields, size their type from the scale, distinguish their committing
button, and announce their errors.

Three things came out of that work that were not in the plan:

- **`TextInput` gained `placeholder` and `ariaLabel`.** Their absence is plausibly *why* these
  dialogs hand-rolled inputs in the first place: a search box cannot use a shared control that
  cannot say "Search labels". Adding the props to the shared control is the fix; adding a seventh
  bare `<input>` was the workaround.
- **The `<textarea>` rule was narrowed rather than satisfied.** There is no shared multi-line
  control, and pressing single-line `TextInput` into service for the synopsis comment would be a
  functional regression to satisfy a lint. The one textarea still gets its border, type size and
  focus treatment from the other rules. A shared `TextArea` is the real fix and is **deferred**.
- **Four dead field classes per stylesheet** (`.input`, `.search`, `.scopeOption(s)`,
  `.typeOption(s)`) went with the conversion.

**The `Checkbox` fix in Phase 39 is the one worth reading.** Its label and input were siblings with
no `htmlFor`/`id` between them, so the control had **no accessible name at all** — invisible in use,
because the label carried its own `onClick`. Associating them then created the opposite hazard: with
`htmlFor` in place the browser forwards a label click to the input, so the label's own handler would
have fired alongside it and toggled twice per click. `test/controls/Checkbox.test.tsx` pins both
directions, and the double-toggle case is the one that would have shipped.

**Phase 42's dead props were not all dead in the same way.** `machineId` was passed to
`BreakpointDialog`, which declares no such prop — it reached the component and was dropped, and
survived only because `dialogs.open`'s generics infer props from the object rather than checking
them against the component. A test asserted it, so removing it turned a passing test red: that test
now asserts `machineSetup.banksView`, the same claim made where it actually lands. `isFolder` split
the other way — genuinely dead in `RenameDialog` (renaming a folder and a file have the same
consequence) and worth *using* in `DeleteDialog`, where a folder takes everything inside it and the
confirmation should say so.

Also: `Modal`'s `onPrimaryClicked` contract is documented and its `close` variable renamed to
`keepOpen` (the four MVC containers' correcting comments stay — they are accurate where the value is
written; four copies of one clarification was the *symptom*, and the name was the cause);
`FirstStartDialog` dispatched `startScreenDisplayedAction` twice on one click; `useBreakpointDialog`
had four IPC calls in a `Promise.all` with no failure path, so an emulator that did not answer meant
no dialog, no error and nothing to click.

**Phase 40 stopped short of one item, deliberately.** The two `<select>`s in the SjasmPlus dialog
stay native: the tests drive them with `toHaveValue`, and swapping in the Radix-backed `Dropdown` is
a behavioural change, not the visual pass this phase is. What *was* visual is fixed — they carried
`--border-modal-section`, the section-*divider* token, where the field token belongs, so they did
not match a `Dropdown` beside them. Recorded as deferred rather than done.

### Stage 6

#### Phase 43 — Z88 Tool Area

`appEmu/machines/Z88ToolArea.module.scss` is the one emulator-shell surface Phase 9 did not reach:
`font-size: 0.65em`, `width: 122px` / `197px`, a hardcoded `line-height: 18px` and an untokenized
`border-radius: 4px` / `padding: 4px 8px`.

---

## 3a. Stage 6 exit, and Phase 40 revisited *(2026-09-13)*

**Phase 43 (Z88 Tool Area)** closes the plan's 31 phases. Only its type was a real mandate
violation: `--bgcolor-display` / `--color-display` are **device** colours and correctly
theme-invariant, and the two px card widths are chrome geometry, which the M2 rule deliberately
excludes — `ch` would also be the wrong unit on a surface with no monospace family. The
`line-height: 18px` stays and now says why: it is sized for the row's 12–14px glyphs, not for its
10px text, so deriving it from the type would collapse the row.

### Phase 40's deferral was right, and then stopped being right

Stage 5 left the SjasmPlus dialog's two `<select>`s native, on the grounds that swapping them was
behavioural rather than visual. Revisiting it found the actual blocker, which was not the tests:
**`Dropdown` had no way to be disabled.** Both selects disable while a release refresh is in flight,
and the shared control had no `disabled`/`enabled` prop at all.

That reframes the deferral as a *gap in the primitive*, and the gap had a second victim:
`StartModeSelector` wrapped its dropdown in `style={{ pointerEvents: "none", opacity: .4 }}` — which
is a **visual-only disable**. It greys the trigger and blocks the mouse, and leaves it in the tab
order: a keyboard user could open a control the UI was presenting as unavailable and change the
machine's start mode. That is a real bug, and it was hiding inside a workaround for the missing prop.

So: `Dropdown` gained `enabled` (named to match `Checkbox`, `RadioGroup` and `Button`) wired to
Radix's own `disabled`, plus a `[data-disabled]` rule at the same 0.4 opacity the workaround used —
so nothing looks different where it was already in use, and the keyboard now agrees with the
appearance. `StartModeSelector` uses it, the two selects became `Dropdown`s, and `.selectBox` went
with them.

**This is the third time in this batch that a hand-rolled control turned out to be working around a
missing prop** — `TextInput` had no `placeholder`, `Dropdown` no `enabled`, `Checkbox` no label
association. The pattern is worth naming: when call sites keep avoiding a shared primitive, the
question is what it is missing, not why they were careless.

Two tests asserted the old behaviour and both were corrected rather than deleted:
`Toolbar.test.tsx` pinned the `pointer-events` wrapper — the exact defect — and now asserts the
trigger is genuinely disabled; its `Dropdown` stub was dropping `enabled`, so the new assertion
would have passed against a control that was not disabled.

### The other judgement call stands

`machineId` and `isFolder` were resolved in Phase 42 and nothing is outstanding. Recorded here only
because the split between them was a decision rather than a rule: `machineId` was removed (the
component declares no such prop, so it was reaching it and being dropped), while `isFolder` was
removed from `RenameDialog` and **used** in `DeleteDialog` — renaming a folder and a file have the
same consequence; deleting them do not, and a destructive confirmation should say which it is about.

---

## 4. Decisions — settled by the author, 2026-09-13

1. **The colour grant for 6510 CPU, VIC and BLINK (Phases 18–20): granted.** *"Use the same colouring
   principles as for the Z80 CPU and ULA panels."* Note the word is **principles**, not values — the
   §10.3 split (payload takes `--color-state-value`, the place it lives takes `-alt`) and
   `iconFill="--color-state-value"` on flag glyphs, applied by the same reasoning the Z80 and ULA
   panels used, not a mechanical find-and-replace. VIC's 74 values are the density test: if the panel
   reads as uniformly loud once converted, that is a signal about the *split*, not a reason to
   reverse the grant.

2. **The seven stub viewers (Phase 27): "Not implemented yet".** No implementations. `EmptyState`
   with that message, sharing Phase 26's treatment.

3. **The Z80 snapshot viewer (Phase 37): revive it, and modernize it.** Researched — see §4.1.

4. **The SCR colour table (Phase 33): the labels are right and the comment is wrong.** Researched —
   see §4.2. The fix is one word, and it is needed in two files, not one.

5. **Misspellings: fix them.** Scoped in Phase 15b.

6. **A shared dialog width scale (Phase 42)** — twelve bare literals today. Still open.

### 4.1 Why the Z80 viewer is revived rather than deleted

Three things settle it, and none of them was visible from the code alone.

**The format is the ecosystem's most widely supported.** World of Spectrum's own reference calls
`.z80` *"arguably the most widely supported by emulators across all platforms"*. It is not a legacy
curiosity; it is the format a Spectrum user is most likely to have on disk. Three versions exist —
v1 (30-byte header), v2 (+23) and v3 (+54/55) — with v2/v3 signalled by a zero PC at bytes 6–7, and
memory stored in an `ED ED xx yy` run-length encoding.

**The viewer already implements all of it.** `Z80FileViewerPanel.tsx` is a complete 913-line reader
with its own decompressor (`appIde/utils/compression/z80-file-compression.ts`), border colour, video
sync mode, joystick type and hardware-mode handling. This is not a stub that was abandoned; it is
finished work that nothing routes to.

**It was switched off by accident, not by decision.** The `.z80` entry went in live in January 2024
(`d69a2c087`) and was commented out in March 2026 by `88d97dced`, *"Experimental PASTA/80
integration"* — a Pascal-compiler feature with no relationship to snapshot viewing. PASTA/80 writes
`<stem>.z80` beside its `.bin` and `.brk` (`Pasta80Compiler.ts:102`) as a **temp artifact that is
deleted unless `PASTA80_KEEP_TEMP_FILES` is set** (`:209-217`). So the collision it was avoiding only
occurs for a user who has explicitly opted into keeping temp files.

**One thing to check before re-enabling** rather than assume: open a PASTA/80 `.z80` output with temp
files kept and read its first bytes. If it is a real snapshot, routing it to the viewer is a
*feature* — inspecting the compiler's output is exactly what the panel is for. If it is a raw binary,
the route needs a content sniff rather than an extension match, and that is the real fix for a
registry that today dispatches on filename alone.

Phase 37 therefore becomes: verify the PASTA/80 artifact, uncomment `registry.ts:621-629` (dropping
its `iconFill: "--console-ansi-bright-magenta"`, which
`test/theming/doc-icon-neutrality.test.ts` would reject anyway), then modernize the panel — its
register table is px-sized at `:13-14` and needs the Phase 15 `ch` treatment first.

### 4.2 The SCR colour table: the comment is wrong, not the labels

The audit reported the labels as contradicting the header. Reading the write path settles it the
other way.

`ScreenCanvas.tsx:73` does `shadowImageData.data.set(imageBuffer8)`, where `imageBuffer8` is a byte
view over the `Uint32Array` the palette is written into. Canvas `ImageData` is **RGBA byte order**, so
on a little-endian host the `u32` `0xffaa0000` reaches the canvas as bytes `00 00 aa ff` — R=0, G=0,
B=0xaa. That is **blue**, which is exactly what the label says. Every entry checks out the same way:
`0xff0000aa` → R=0xaa → red; `0xffaaaa00` → G=0xaa, B=0xaa → cyan; `0xff00aaaa` → R=0xaa, G=0xaa →
yellow. The order is the standard ZX Spectrum one (black, blue, red, magenta, green, cyan, yellow,
white), and index 8 "Bright Black" is correctly still black.

So the sixteen labels are right and the values are right. The word `ARGB` is the error: written as a
`u32` these are **ABGR**, which is the name this repo already uses for the same convention at
`controls/data/index.tsx:71` (*"converted from the ABGR entries in…"*).

Two consequences the audit missed:

- **The same wrong comment is in the emulator.** `emu/machines/CommonScreenDevice.ts:122` heads a
  byte-identical table with the identical "ARGB colors" sentence. The viewer's table is a copy of the
  machine's. Fix both, or the next reader finds the corrected one and the wrong one and has to redo
  this analysis.
- **A 16-entry palette should not be duplicated between the emulator and a viewer at all.** Phase 33
  should read the machine's table rather than restate it. That is the durable fix; renaming the
  comment in two places is the minimum one.

---

## 5. Exit criteria — every phase

Non-negotiable, from `AGENTS.md` and the main plan's §7:

- Focused tests first, then `npx tsc --noEmit -p build/tsconfig.web.json` — **diff by message, not by
  count or line**, per the lessons file — then `npm run lint:renderer`, then
  `npx electron-vite build --config build/electron.vite.config.ts` to catch Vite import-analysis
  errors the type-checker does not see.
- **The phase deletes its own entries from Phase 14's M1/M2 baseline.** A phase that leaves the
  baseline the size it found it has not finished.
- **Verified in the running app over CDP, in both tones**, the way Phase 13 was and Phase 11 was not.
  Read `getComputedStyle`, do not trust the screenshot; relaunch rather than trusting HMR; assert no
  stale Electron instance holds port 9222 first. The recipes are in
  `.ai/ui-theming-intent-and-lessons.md` § "Verify Geometry In The Running App".
- **New tests for every bug fixed, seen to fail first.** Restore the old line and watch red.
- **`.ai/ui-theming-intent-and-lessons.md` updated in the same change** — the author's standing
  instruction. Record the durable rule, fold it into the existing sections, keep no history.
- A phase that turns up work outside its scope records it here rather than absorbing it, and
  re-reviews the remaining phases before moving on (main plan §6.0).

## 6. What this plan deliberately does not do

- It does not re-open `.plans/DIALOG_MVC_REFACTOR_PLAN.md`'s exclusions. `DeleteDialog`,
  `RenameDialog`, `NewItemDialog`, `AboutDialog`, `SetMemoryDialog`, `FirstStartDialog` and
  `Z88ExportCardDialog` are recorded as deliberately left on the plain pattern. Phases 38 and 39
  touch the last two for *visual* and *correctness* defects only.
- It does not convert `BreakpointDialog` to MVC. Its rules already live React-free in
  `appIde/utils/breakpoint-form.ts` with tests; it has the Model and no Controller, which is a
  reasonable resting place. Only its unhandled `Promise.all` is in scope (Phase 42).
- It does not touch Monaco (`CODE_EDITOR`, `TEXT_EDITOR`). That is main-plan §8.1 and
  `.plans/SYNTAX_PALETTE_REVISION_PLAN.md`.
- It does not merge `controls/data` and `controls/layout`.

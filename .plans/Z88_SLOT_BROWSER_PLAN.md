# Z88 Slot Browser Plan

Status: **Complete — all five phases done** (see §8 for what differed from the draft)
Scope: Replace the `.z88` snapshot viewer's per-card sections with one **Slots** browser built on the
NEX viewer's bank browser concepts (a bank list, a details pane, and pop-out documents). Make a
popped-out Z88 bank disassemble as Z88 code.
Builds on: `.plans/Z88_SNAPSHOT_PLAN.md`. This **reverses** its Phase 5 decision, recorded under
"What differed from the plan", to use a dropdown instead of a `NexBankBrowser` clone.
Sample: `test/z88/snapshot/fixtures/` (the issue's `mm+jsw-oz5.z88`: OZ 5 on a 512K AMD flash in
slot 0, 128K internal RAM, 32K EPROMs in slots 2 and 3, SR3 = `$BF`).

---

## 1. What is being added, and why

The `.z88` viewer shows each card as its own collapsed `ExpandableRow` with a bank **dropdown** and a
`MemoryDumpViewer` preview. Finding where code lives means opening sections one at a time and stepping
through a dropdown with nothing to say which banks are empty, which bank is paged in, or where PC is.

The NEX viewer solved the same problem with `NexBankBrowser`. Its list says which bank is which at a
glance, its details pane describes the selected bank, and every bank pops out as its own document.
This plan gives the Z88 viewer the same browser for its slots, without the NEX-only parts.

### 1.1 Decisions

| # | Decision |
| --- | --- |
| D1 | **One browser for all slots.** A single "Slots" section replaces the per-card sections. Bank rows are grouped under a header per card (slot 0 ROM, internal RAM, slots 1–3), with a slot filter and a details pane. |
| D2 | **A shared shell.** The list/details/keyboard/pop-out structure is extracted from `NexBankBrowser` into a generic `BankBrowser`. The NEX viewer and the Z88 viewer both use it. The NEX-only content is supplied by the NEX caller. |
| D3 | **Banks only** pop out: each 16K bank, in **Memory** or **Disassembly**. Whole cards do not. |
| D4 | **Z88-correct disassembly** in a popped-out Z88 bank: `Z88CustomDisassembler` (OZ calls after `RST 20h`), **no** Next extended opcodes, **no** Spectrum system-variable names. This holds whichever machine is selected in the emulator. |
| D5 | **No annotations and no sprites.** No sidecar, comments, labels, regions, content mix or Sprites view for Z88 banks. |

### 1.2 Out of scope

- Popping out a whole card (D3).
- Z88 annotations of any kind (D5).
- Live machine bytes in a popped-out Z88 bank. A `.z88` bank document shows the **file's** bytes,
  unlike a NEX bank, which can follow the running Next (`useNexLiveBankBytes`). Following a running
  Z88 would need the bank→document identity this plan establishes (§4.4) and is a natural follow-up.
- Importing OZvm breakpoints into Klive's breakpoint set (still out of scope, as in
  `Z88_SNAPSHOT_PLAN.md` §1.2). They are only *shown* (§4.3).

---

## 2. How the NEX viewer does it today

| Concern | Where | What it does |
| --- | --- | --- |
| Browser | `DocumentPanels/Next/NexBankBrowser.tsx` (583 lines) + `.module.scss` (460) | A heading (title, `n banks · KB` summary, All / Non-empty / Annotated filter buttons). A `listbox` of rows: `$NN`, marks (BP chip, PC/SP chips), comment or "empty", mix bar, and a row pop-out icon. A details `aside`: title + marks, a **split button** ("Pop out · *last view*" + chevron menu of views), a `dl` of facts, then Content mix, Comment and Labels sections, and a hint. Keyboard: arrows, PgUp/PgDn, Home/End move the selection; Enter pops out. Double-click pops out. The row's context menu has Pop Out plus the comment items. |
| Items | `NexFileViewerPanel.tsx` `bankItems` | One `NexBankBrowserItem` per bank, computed by the viewer. The browser decides nothing about files or documents; it gets summaries and callbacks. |
| Pop-out | `NexFileViewerPanel.tsx` `openBankDump` | `openStaticMemoryDump(hub, nexBankDumpId(fullPath, bank), nexBankDumpTitle(...), bytes, { disassemblyEnabled, disassOffset, decimalView, viewMode, nexAnnotation* })`, wrapped in `navigationHistoryService.recordJump("nexBank", …)` so **Go Back** returns to the viewer. |
| Document identity | `Next/nexBankDocument.ts` | The id is keyed by the file's **full path**, never its project path: every opener (viewer, debugger reveal, go-to-definition) must agree, or one bank opens as two documents. |
| Pop-out document | `features/memory/StaticMemoryDump.tsx` | A generic 16K dump with Memory / Disassembly (and Sprites for a NEX bank). The NEX behaviour switches on only when `nexAnnotationBank` is set. |
| Persisted state | NEX viewer `viewState` | `selectedBank`, `bankFilter`. The last pop-out view is kept per bank in the sidecar. |

### 2.1 The Z88 viewer today

`DocumentPanels/Z88/Z88SnapshotViewerPanel.tsx` has the sections Snapshot, Z80 Registers, Blink,
Address Space at PC, **one `CardSection` per card**, and Breakpoints. `z88SnapshotView.ts` holds the
React-free logic. `z88ViewedCards` lists the cards and their banks; hybrids get RAM banks at the slot
base and flash banks at base + `$20`. `z88BankDisassemblyBase` finds where a bank is paged in
**through the card's mirrors**. `z88BankOwner` and `z88PagedRanges` describe the paging. A card's
bank pops out through `MemoryDumpViewer` with id `z88SnapshotBank${projectPath}-${bank}`.

---

## 3. The traps

1. **The pop-out disassembles as a ZX Next** (D4). `StaticMemoryDump`'s un-annotated path builds
   `new Z80Disassembler(..., { allowExtendedSet: true, operandLabelResolver: sysVarLabelResolver })`
   with no custom disassembler. `sysVarLabelResolver` comes from `useSysVarOperandLabelResolver`,
   which follows the **emulator's current machine**. So a Z88 bank today shows Next-only opcodes and
   Spectrum system-variable names, and an OZ call reads as `rst $20` followed by data bytes
   disassembled as instructions.
2. **Document id from the project path.** The Z88 id uses `document.node?.projectPath ?? document.id`.
   That is exactly the mistake `nexBankDocument.ts` documents. Key the id by the full path from the
   start (§4.4).
3. **Mirrors.** A 32K card in slot 2 *is* banks `$80–$81`, but SR3 = `$BF` pages `$81`. Rows list the
   card's real banks. "Paged in", the PC chip and the disassembly base must all be computed through
   the mirrors, as `z88BankDisassemblyBase` already does. An exact SR comparison misses the sample.
4. **"Empty" depends on the card.** Erased EPROM and flash read `$FF`, while RAM reads `$00`. NEX's
   "all zero" test would call every blank EPROM bank full. Define empty per card type (§4.2).
5. **Hybrid cards** (types 8, 9, 12) have two bank runs in one slot: RAM at the base, flash at
   base + `$20`. They are not loadable but are still shown (`Z88_SNAPSHOT_PLAN.md` D1). Their rows
   must say which half they belong to.
6. **Extracting the shell must not change the NEX browser.** `test/renderer/NexBankBrowser.test.tsx`
   (8 tests) guards it, and the extraction is done first with those tests unchanged (Phase 1).
7. **`recordJump` kinds.** `navigationHistoryService.recordJump("nexBank", …)` takes a kind. Check
   whether it is a closed union before adding `"z88Bank"`.
8. **Style rules.** The shared stylesheet moves with the shell, and the M1/M2/M3 contracts still apply
   (`ch` widths, no `em`, row heights from `rowSizes.ts`). Any style change updates
   `.ai/ui-theming-intent-and-lessons.md` in the same change (house rule). Verify the geometry in the
   running app, not in a replica.

---

## 4. Design

### 4.1 Shared shell — `src/renderer/controls/bankBrowser/BankBrowser.tsx`

Extracted from `NexBankBrowser`. It owns everything both viewers share:

- the heading: a title, a summary string from the caller, and filter buttons from a caller-supplied
  `filters: { value, text }[]`;
- the `listbox`, its keyboard handling (arrows, PgUp/PgDn, Home/End, Enter), double-click and the
  row pop-out icon;
- **optional group headers** in the list (new; NEX passes none). A header is not an option, and the
  keyboard skips it;
- the details `aside` frame: the title, the **split pop-out button** over a caller-supplied `views`
  list, and the "last used" marking;
- the row context menu frame: "Pop Out in *view*", then caller-supplied extra items.

The caller supplies, as render props or slots:

- `renderMarks(item, where: "row" | "details")` for chips. NEX passes its BP/PC/SP chips; Z88 passes
  its own (§4.3);
- `renderRowText(item)` for the row text: NEX's comment or "empty";
- `renderRowExtra(item)` for NEX's mix bar (Z88 passes nothing);
- `renderDetails(item)` for everything below the details head: NEX's facts, mix, comment and labels;
  Z88's facts (§4.3);
- `rowMenuItems(item)` for NEX's comment items.

The item type is generic: `BankBrowserItem = { key: string; bank: number; lastView: V }` plus the
caller's own fields. `key` is unique across the list. A Z88 bank number is unique too, but `key`
keeps the shell from assuming that.

`NexBankBrowser` becomes a thin NEX wrapper over `BankBrowser`, keeping its exported name and props,
so `NexFileViewerPanel` and its tests do not change. `filterBanks`, `VIEW_NAMES` and the
`NexBankView` / `NexBankFilter` types stay exported from it. `NexBankBrowser.module.scss` is split:
the shell's classes move to `BankBrowser.module.scss`, and the NEX-only ones (BP chip, mix bar,
legend, labels, comment) stay.

### 4.2 Z88 items — `z88SnapshotView.ts` (React-free)

New `z88SlotBrowserItems(info): Z88BankItem[]`, one per bank of every card from `z88ViewedCards`, in
order (ROM, RAM, slot 1–3):

| Field | Meaning |
| --- | --- |
| `key`, `bank` | `bank.toString()`, the bank number |
| `cardKey`, `group` | The card's `key` and title, used for the group header and the slot filter |
| `half` | `"RAM"` / `"flash"` for a hybrid card's banks, otherwise absent |
| `size` | 16K, or less for a short final image bank |
| `empty` | Every byte is the card's erased value: `$FF` for EPROM and flash (ROM area included), `$00` for RAM |
| `pagedAt` | The segments (0–3) the snapshot pages this bank into through its mirrors, plus `COM.RAMS` for bank `$20` at `$0000` |
| `pc` / `sp` | Set when PC / SP falls in a segment this bank is paged into |
| `breakpoints` | The number of the snapshot's OZvm breakpoints in this bank (bank compared through mirrors) |
| `mirrors` | The bank range this bank answers for in its slot, e.g. `$81, $83, …, $BF` summarised as "every odd bank `$81–$BF`", for the details pane |
| `listedAt` | `z88BankDisassemblyBase(...)` |
| `lastView` | From the viewer's view state, else `"disassembly"` for a code card (ROM, EPROM, flash) and `"memory"` for RAM |

`z88BankDisassemblyBase` is generalised into `z88BankPagedSegments` (all segments, not just the
first match). The base keeps its current rule: SR3 first, otherwise `$C000`.

Filters: **All**, **Non-empty**, **Paged in**, plus one per present card
(`ROM`, `RAM`, `Slot 1–3`).

### 4.3 Z88 browser — `Z88SlotBrowser.tsx` beside the viewer

A thin wrapper over `BankBrowser` with `views = ["memory", "disassembly"]` (no Sprites). It supplies:

- **Row**: `$NN`, chips, the text ("empty", or the hybrid half), and the pop-out icon.
- **Chips**: `PC $HHHH`, `SP $HHHH` (reusing the shell's chip style), `SR*n*` for each segment the
  bank is paged into, and a plain `BP *n*` count when the snapshot has breakpoints there. It is a
  text chip, not the NEX kinds chip, because these are OZvm's breakpoints, not Klive's.
- **Group headers**: the card title, OZvm type, size, and "loads as …" or the reason it cannot load.
  This is today's `CardSection` heading and `meta`, so nothing that was visible is lost.
- **Details facts**: Bank (hex and decimal), Card, Size, Paged in (segments, or "no"), Mirrors,
  Listed at, Last view, and Contents ("Erased" or "All zero" when empty), followed by the OZvm
  breakpoints in the bank as `$BB:$HHHH stop/display`.

The Address Space at PC and Breakpoints sections stay. The Breakpoints section could later link each
entry to its bank row; that is not in scope.

### 4.4 Pop-out — identity and options

New `src/renderer/appIde/DocumentPanels/Z88/z88BankDocument.ts`, mirroring `nexBankDocument.ts`:

- `z88BankDumpId(fullPath, bank)` returns `z88BankDump${fullPath}:${bank}`, keyed by the **full path**
  (trap 2);
- `z88BankDumpTitle(fullPath, bank, projectFolder)` returns `<relative path> - Bank $NN`, reusing the
  relative-path rule from `nexDocumentSourceName`. Move that function to a shared helper rather than
  importing NEX code into Z88 code.

The viewer's `openBankDump(bank, view)` calls `openStaticMemoryDump` with
`{ disassemblyEnabled: true, disassOffset: listedAt, viewMode: view, disassemblyFlavor: "z88" }`
inside `recordJump("z88Bank", …)`. It records the view as the bank's `lastView` in the view state.
The 64K "at PC" documents keep their id but also pass `disassemblyFlavor: "z88"`.

### 4.5 Z88-correct static disassembly — `StaticMemoryDump`

A new view-state field `disassemblyFlavor?: "z88"` (absent means today's behaviour), set by the
opener and persisted with the document. When it is `"z88"`, the un-annotated path:

- builds `Z80Disassembler` with `allowExtendedSet: false`;
- calls `setCustomDisassembler(new Z88CustomDisassembler())`;
- passes **no** `operandLabelResolver`, because there is no Z88 system-variable table today. The
  "System variable names" toggle is hidden for such a document;
- keeps the screen-area switch off. It is NEX-only already (`screenAreaApplies` needs `isNexBank`).

The flavor is not inferred from the current machine on purpose. The document's bytes come from a
`.z88` file and stay Z88 code whichever machine is running (trap 1).

### 4.6 View state

`Z88SnapshotViewState` gains `selectedBank?: number`, `slotFilter?: string` and
`bankView?: Record<number, "memory" | "disassembly">`. It drops `cardExpanded` and `cardBank`. Old
documents that still hold those keys are harmless, because unknown keys are ignored. It keeps a
`slotsExpanded` for the section.

---

## 5. Phases

### Phase 1 — extract `BankBrowser` (NEX only, no visible change)

- Create `controls/bankBrowser/BankBrowser.tsx` and `BankBrowser.module.scss`, rewrite
  `NexBankBrowser` over them, and update consumers to direct imports (AGENTS rule; no re-export
  wrapper files).
- `test/renderer/NexBankBrowser.test.tsx` passes **unchanged**.
- New `test/controls/BankBrowser.test.tsx` covers the shell with a minimal item type: selection,
  keyboard, Enter / double-click / icon pop-out, the split-button views and "last used", group headers
  skipped by the keyboard, and caller-supplied menu items.
- Compare the NEX viewer before and after in the running app (CDP recipe in
  `.ai/ui-theming-intent-and-lessons.md`).

### Phase 2 — Z88-correct static disassembly

- `disassemblyFlavor: "z88"` in `StaticMemoryDump` and `openStaticMemoryDump` (§4.5).
- Tests: a Z88-flavored dump of `RST 20h` + an OZ call operand renders the OZ call name (the
  `Z88CustomDisassembler` output) and not the operand bytes as instructions; a Next-only opcode (e.g.
  `ED 27` `test n`) is **not** decoded; no system-variable names appear; the toggle is hidden. A
  document without the flavor is unchanged.

### Phase 3 — Z88 items (React-free)

- `z88SlotBrowserItems`, `z88BankPagedSegments`, the per-card erased value, mirrors, breakpoints per
  bank, and the filters (§4.2).
- Extend `test/z88/snapshot/z88-snapshot-view.test.ts` against the sample: slot 2's `$81` is paged at
  SR3 and carries the PC chip; blank EPROM banks are empty with `$FF`; internal RAM `$20` is paged at
  `$0000` with `COM.RAMS`; a hybrid's halves; the breakpoint counts; and the mirror description.

### Phase 4 — the Z88 browser in the viewer

- `Z88SlotBrowser`, `z88BankDocument.ts`, `openBankDump` with `recordJump`, and the view state
  (§4.3, §4.4, §4.6). Remove `CardSection`.
- Rewrite `test/renderer/Z88SnapshotViewerPanel.test.tsx`'s card test. Add tests that the browser
  lists every card's banks under group headers, that filters work, that selecting shows the details,
  that pop-out opens `z88BankDumpId(fullPath, bank)` with the right `disassOffset`, view and flavor,
  that re-popping the same bank focuses the existing document, and that Go Back returns to the viewer.
- Check it in the running app with `_experiments/testprojects/oz5-08/mm+jsw-oz5.z88`.

### Phase 5 — docs

- `docs/content/howto/z88-snapshots.mdx`: replace "one section per card" with the Slots browser and
  its pop-out. Regenerate any screenshot with `scripts/doc-shots/` (read
  `.ai/doc-screenshots-guide.md`).
- Mark `Z88_SNAPSHOT_PLAN.md` Phase 5's dropdown decision as superseded by this plan.
- `npm run doc:build && npm run doc:check`.

Each phase ends with focused tests, `npm run build:check` and `npm run lint:renderer`. After Phase 1
(files moved), also run `npx electron-vite build --config build/electron.vite.config.ts`.

---

## 6. Risks

- **The shell over-abstracts.** If the render props grow past what both callers need, stop and keep
  NEX-only behaviour in the NEX wrapper. The test is that `BankBrowser` imports nothing from
  `DocumentPanels/Next/`.
- **A long list.** Slot 0's 512K ROM is 32 banks, 512K of RAM is 32 more, and three 1M cards would
  add 192: 256 banks at the absolute maximum, about twice a full NEX (112 banks), which the list
  already handles. Rendering 256 plain rows is not a concern; if it becomes one, virtualise the list
  in the shell, which then benefits both viewers.
- **Existing Z88 bank documents** opened with the old `z88SnapshotBank…` id are not migrated. They
  were not persisted in the project beyond open tabs, and reopening the bank creates the new one.

## 7. Open questions

None blocking. Two small defaults are taken here and can be changed during review:

- the default pop-out view (Disassembly for code cards, Memory for RAM);
- showing OZvm breakpoints as a per-bank count chip (read-only).

---

## 8. What was built, and what differed

**Phase 1 — `BankBrowser`.** `src/renderer/controls/bankBrowser/BankBrowser.tsx` +
`.module.scss`, with building blocks `BankChip`, `BankRowText`, `BankFacts`, `BankDetailsSection`
and `BankGroupLabel`. `NexBankBrowser` is a wrapper over it, with the same exports and props, and
its 8 tests pass unchanged. The NEX stylesheet keeps only the BP chip, mix, comment and labels.
Shell tests: `test/controls/BankBrowser.test.tsx` (6). The caller passes the already-filtered
`visibleItems` and its own `summary`, rather than the shell filtering, because the two viewers
filter differently.

**Phase 2 — Z88 static disassembly.** `disassemblyFlavor: "z88"` in `StaticMemoryDump` and
`openStaticMemoryDump`, as §4.5 describes. Tests are in `test/controls/StaticMemoryDump.test.tsx`
("a Z88 listing").

**Phase 3 — items.** `z88SlotBrowserItems`, `z88BankPlacements` (rather than
`z88BankPagedSegments`: it returns the five ranges, including the fixed lower 8K as `$0000`),
`z88BankMirrors`/`formatZ88Mirrors`, `z88ErasedValue`, `filterZ88Banks` and `z88SlotFilters`. A
hybrid card's halves do not mirror each other. 11 new tests in `z88-snapshot-view.test.ts`.

**Phase 4 — the browser.** `Z88SlotBrowser.tsx`, `z88BankDocument.ts`, the `SlotsSection` in the
viewer, and the shared `helpers/documentSourceName.ts` (`nexBankDocument.ts` calls it directly; the
NEX-named function is gone). `"z88Bank"` was added to `NavigationReason`, the history list's labels
and the `nav -r` docs. The browser sits in the viewer directly, like the NEX one, so there is no
`slotsExpanded`. Checked in the running app (Playwright harness, `oz5-08`): the list, group
headers, chips, details, the pop-out and Go Back.

The in-app check found five things the unit tests had not:

- **Go Back had nowhere to go.** The `.z88` viewer had no navigation adapter, so only the popped-out
  bank was recorded. It is now registered with `fileDocumentNavigationAdapter`, like the NEX viewer
  (`test/navigation/popOutViewerNavigation.test.ts`).
- **A closed Z88 bank was not reopened by Go Back**, while a NEX bank was. The static-dump adapter
  now reads it back from the `.z88` file (`readZ88BankBytes`, `parseZ88BankDocumentId`) and reopens
  it as Z88 code.
- **Custom-disassembler items ignored the address offset.** OZ calls in a bank listed at `$C000`
  were numbered `$0029`. This was in `Z80Disassembler`, so it also affected the live Disassembly view
  showing a single bank, and every custom disassembler (ZX Spectrum 48, Next, Z88). Fixed in the
  disassembler's API.
- **A custom item's bytes were appended to the previous instruction's.** The byte array was reset
  only for built-in instructions, and the previous item kept a reference to it. Fixed by resetting
  it before the custom disassembler is asked. Both are covered in
  `test/z80-disassembler/z88-custom-offset.test.ts`.
- (Expected) the NEX viewer looked and behaved as before.

**Phase 5 — docs.** `docs/content/howto/z88-snapshots.mdx` (the Slots browser and pop-out) and
`working-with-ide/navigation.mdx` (Z88 banks in the history, reopened when closed). The page has no
screenshots, so none was regenerated. `.ai/ui-theming-intent-and-lessons.md` gained "A Bank Browser
Has One Shell".


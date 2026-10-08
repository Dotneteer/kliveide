# Trace Export Plan: Saving the Execution History as a Text or CSV Trace

Status: ✅ **done** (2026-10-08). D1–D14 are the decisions; the author accepted the suggested
answers to all §8 questions, which the decisions already assumed. All four phases are implemented;
§9 records where the implementation settled details the decisions left open.

Scope:
- [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md) **G4.5**: save a range of the execution
  history as a text or CSV trace, so two runs can be compared with any diff tool.

Builds on:
- [EXECUTION_HISTORY_VIEWER_PLAN.md](EXECUTION_HISTORY_VIEWER_PLAN.md) (G4.1): the record format, the
  reader, the pure row formatter (`src/common/history/historyRow.ts`, whose header already names
  G4.5 as a consumer), and the `history [n]` command, which is a text trace of the newest *n* records
  written to the output pane.
- [EXECUTION_HISTORY_ALL_CORES_PLAN.md](EXECUTION_HISTORY_ALL_CORES_PLAN.md) (G4.2): every Z80 core
  records, so export works on every machine with `MF_EXEC_HISTORY` from day one.
- [LITE_STEP_BACK_PLAN.md](LITE_STEP_BACK_PLAN.md) (G4.3): range endpoints use its target syntax
  (`-42`, `#1234`, `parseHistoryTarget`) and its interrupt-service spans.
- [REVERSE_DEBUGGING_PLAN.md](REVERSE_DEBUGGING_PLAN.md) (G4.4): only for D17's rule that the ring is
  the present's; nothing in this plan needs a timeline.

Not in scope:
- Exporting more than the ring holds by replaying older keyframe intervals (G4.4). §1.2 keeps the
  hook.
- A built-in diff viewer. The output is designed for `diff`, `git diff --no-index`, Beyond Compare,
  VS Code's compare, or a spreadsheet; Klive does not compare traces itself (Q5).
- Importing a trace back into Klive.

---

## 1. What is being added, and why

A trace is the classic way to answer "where did these two runs part ways?": record a good run and
a bad run, export both, diff them, and the first differing line is the bug. ZEsarUX writes a CPU
transaction log to a file; MAME has `trace`; DeZog can show its history but not save it. Klive
already records every instruction of a debug session (G4.1/G4.2) and already formats one record as
one line (`formatHistoryRow`); what is missing is:

1. choosing a **range** (not only "the newest *n*");
2. a **file** instead of the output pane or the clipboard;
3. a **CSV** form for spreadsheets and scripts;
4. a **diff-friendly** form: the viewer's columns are made for reading, not for comparing. Its step
   numbers (`−1`, `−2`, …) and sequence numbers shift between two runs, and absolute frame numbers
   differ whenever the runs started at different moments, so every line of a naïve export would
   differ.

### 1.1 Decisions

| # | Decision |
| --- | --- |
| D1 | **One pure exporter, two formats.** `src/common/history/historyExport.ts` turns decoded records plus caller-supplied resolvers (instruction text, source location, partition label) into lines. **Text** is the fixed-width form of `formatHistoryRow` with selectable columns; **CSV** is RFC 4180 (comma, `"` quoting, CRLF line ends, a header row). The format follows the file extension (`.txt`/`.log`/`.trace` → text, `.csv` → CSV), as `zx-snapshot-save` does (G2.4 D2); `-format` overrides it. No other formats (Q2). |
| D2 | **Columns are chosen, with a diff-friendly default.** Column ids: `seq`, `step`, `frame`, `tact`, `addr`, `bytes`, `instr`, `source`, `changes`, `regs`, `flags`, `ctx`. The default set is `frame tact addr bytes instr changes`, with `frame` **relative to the first exported record** (D3). The viewer's set (`step tact addr bytes instr source changes`) is `-columns viewer`; everything is `-columns all`. |
| D3 | **Time is relative by default.** `frame` is written as `frame − firstFrame` and `seq` as `sequence − firstSequence` unless `-absolute` is given. Two runs that start the range at "the same" point (a breakpoint, see D5) then produce identical lines up to the divergence. `tact` is always the frame-relative tact the record holds; on the Next it stays in 28 MHz ticks, as the viewer shows it, and the header says so (`historyContextDecoder().frameTactUnit`). |
| D4 | **`regs` is the full register set *before* the instruction** (the record's own state, G4.1 D3): `AF BC DE HL AF' BC' DE' HL' IX IY SP I R WZ` in that order, hex, plus `IFF1 IFF2 IM` in `flags`. Text joins them with spaces; CSV gives each register its own column (`AF`, `BC`, …) so a spreadsheet can filter on one. `changes` stays the viewer's `registerDiff` form ("after" from the next record, the live CPU for the newest), which is the most compact thing to diff. |
| D5 | **The range is a pair of history targets, inclusive, in G4.3's syntax.** `-from` and `-to` take `-42` (a step back from the present) or `#1234` (a sequence number); defaults are the oldest and the newest record. `-count n` takes the newest *n* (or *n* from `-from`). Two more anchors make "the same point in both runs" easy: `-from bp` (the newest record whose PC is the address of the last breakpoint stop, i.e. the previous visit) is **not** built (Q3); instead the documented recipe is "stop at the breakpoint, then `history-export run1.txt`", which exports everything up to the stop. |
| D6 | **Event rows follow the viewer's rules, with switches.** INT/NMI and Next DMA-hold records are separator lines (`— IM 2 interrupt, vector $FF —`); a HALT is one `HALT ×n` line; a ZX80/81 display run is one `Display NOPs ×n` line. **`-repeats` off by default:** the `×n` counts of HALT and display runs are written as `×*`, because they depend on how long the machine waited, which is exactly the kind of noise that should not make two otherwise identical runs differ (Q4). `-repeats` writes the counts. In CSV the count is its own `repeat` column, empty unless `-repeats`. |
| D7 | **Interrupt service can be left out.** `-nointerrupts` drops whole INT/NMI … `RETI`/`RETN` spans, using the same `findServiceSpans` the viewer folds with (`src/common/history/serviceSpans.ts`); a span still open at the range's end is dropped from its INT on. A one-line marker (`… interrupt service, 312 instructions …`) replaces each dropped span unless `-nomarkers`. The default **keeps** them, because the bug is often in the handler; the docs show `-nointerrupts` as the first thing to try when two runs differ only in where the frame interrupt landed. |
| D8 | **The filter is the viewer's.** `-filter <text>` uses `parseHistoryFilter` / `historyRowMatches` (`features/history/historyViewModel.ts`), so a range of addresses, a label or free text selects the same rows as the document's filter field. The pure parts move to `src/common/history/` if they are not already free of React (§2). |
| D9 | **A header block, kept out of the diff's way.** Text files start with comment lines beginning `;` (Klive asm's comment character, so a trace pasted into a source file is inert): Klive version, machine and model, the range (`#first..#last`, *n* records, frames), the columns, the tact unit, the export options, the compilation's main file when there is one. **`-noheader`** omits it. The header never contains the export time, so two exports of the same run are byte-identical. CSV has the column row only; its metadata goes to the output pane (Q6). |
| D10 | **Only a paused machine exports.** The ring changes on every instruction; a Running machine is refused with "Pause the machine first" (the document already says "Running — history updates at the next stop"). A Stopped machine exports what the ring still holds. With a G4.3/G4.4 history cursor set, the export still covers the present's ring (G4.4 D17), and the header names the cursor's step so the reader knows where the IDE was. |
| D11 | **Reads in bulk, written once.** The command reads the range in pages of 8,192 records (the document's `BULK_READ`), decodes, formats into an array of strings and writes the joined text with one `mainApi.saveTextFile`. The worst case, the Next's 131,072 records with `-columns all`, is about 30 MB of text: acceptable for one write, and far below the IPC limits already used by state files. If a page reports `gone` (impossible while paused, but the reader supports it), the export fails rather than writing a trace with a hole. |
| D12 | **Disassembly and source are the viewer's.** `HistoryDisassemblyCache` (Z80N on the Next) with `historyLabelLookup` over the current compilation's symbols, and `locateSource` with the record's partition. As in the viewer (G4.1 T12), labels and source lines come from the **current** compilation, not the one the run was made with; the header records the main file so a reader can tell. |
| D13 | **Three entry points, one command.** The command `history-export` (alias `hexp`); **Debug → Export Execution History…** (enabled with `MF_EXEC_HISTORY`, like Debug → Execution History) opening a save dialog in main and running the command with `-f`, the state-menu pattern (`src/main/machine-menus/state-menus.ts`); and an **Export…** button in the Execution History document's header strip plus a context-menu item **Export rows from here to the newest…**, which carry the document's filter and fold state into the command (`-filter`, `-nointerrupts`). The document entry needs a save dialog the IDE renderer can open: a new `MainApi.showSaveFileDialog({ title, defaultPath, filters })` (Q7). |
| D14 | **"Copy rows as text" uses the exporter.** The context menu's existing copy (`ExecutionHistoryPanel.tsx`'s `copyRows`, at most 10,000 rows) and the `history [n]` command switch to `historyExport.ts` with the viewer's column set, so there is one formatter. Their output does not change (a golden test proves it). |

### 1.2 Out of scope, and the hooks left for later

- **A trace longer than the ring.** With a G4.4 timeline the past beyond the ring can be regenerated
  by replaying keyframe intervals (`Timeline.landAt` already does it for one landing). A later
  `-timeline` option could stream the whole timeline interval by interval, writing each regenerated
  ring segment and restoring the present's ring afterwards (G4.4 D17). The exporter takes an async
  iterable of record pages, not one array, so that option needs no exporter change.
- **Memory accesses per instruction** (the 8-entry `z80AccessLog`): not in the record (G4.1 §1.2), so
  not in the trace.
- **A streaming file writer** for traces above ~100 MB: only needed with the timeline option above.

---

## 2. Current code paths this touches

| Concern | Where |
| --- | --- |
| Record decode | `src/common/history/historyRecord.ts` (`decodeHistoryRecord`, `decodeHistoryPage`, `HistoryKind`, `encodeHistoryRecord` for fixtures) |
| Row formatting | `src/common/history/historyRow.ts` (`HistoryRowInput`, `historyRowCells`, `formatHistoryRow`, `historyEventText`, `isSeparatorRecord`) |
| Register diff | `src/common/history/registerDiff.ts` (`registerDiff`, `formatRegisterDiff`) |
| Interrupt spans | `src/common/history/serviceSpans.ts` (`findServiceSpans`) |
| Context decoders | `src/common/history/contexts/` (`historyContextDecoder(machineId)`: `partitionFor`, `describe`, `frameTactUnit`) |
| Reading | Emu API `getHistoryInfo`, `getHistoryRecords(from, count)`, `getHistoryServiceSpans`, `getPartitionLabels`, `getCpuState({ present: true })` (`src/common/messaging/EmuApi.ts`; handlers in `MainToEmuProcessor.ts`) |
| Today's text trace | `HistoryCommand` (`src/renderer/appIde/commands/HistoryCommands.ts`, `history [n]`), `parseHistoryTarget`, `requireHistory` |
| Disassembly | `src/renderer/features/history/historyDisassembly.ts` (`HistoryDisassemblyCache`, `historyLabelLookup`) |
| Source | `src/renderer/appIde/utils/source-location.ts` (`locateSource`) |
| Filter, folding | `src/renderer/features/history/historyViewModel.ts` (`parseHistoryFilter`, `historyRowMatches`, `foldedHistoryRows`) |
| The document | `src/renderer/appIde/DocumentPanels/ExecutionHistoryPanel.tsx` (header strip, context menu, `copyRows`, `BULK_READ`) |
| File writing | `MainApi.saveTextFile` (`src/common/messaging/MainApi.ts`; main side `RendererToMainProcessor.ts`); existence check as in `SpectrumSnapshotSaveCommand.ts` |
| Save dialogs | `dialog.showSaveDialog` in `src/main/machine-menus/state-menus.ts`, `rzx-menus.ts` |
| Menu | `src/main/menus/debug-menu.ts` (Execution History item, gated on `MF_EXEC_HISTORY`) |
| Registration | `src/renderer/appIde/IdeCommands.ts` |

---

## 3. The traps

1. **T1: Diff noise from numbering.** Steps, sequence numbers and absolute frames differ between
   runs even when the instructions do not. D2/D3 leave them out or make them relative by default.
2. **T2: Diff noise from waiting.** A HALT repeat count, a ZX80/81 display-run length and a Next DMA
   hold's T-states depend on timing, not on the program path. D6 masks the counts by default. A DMA
   hold's separator text includes the held T-states, so the masked form drops them too
   (`— DMA held the bus ($4000 → $C000, 0 left) —`).
3. **T3: Diff noise from interrupts.** The frame interrupt lands at a different instruction whenever
   the two runs drifted by a few T-states, which shifts a whole handler's worth of lines. D7's
   `-nointerrupts` removes it. The `tact` column has the same problem and is in the default set on
   purpose: when the paths agree but the timing does not, the first differing `tact` is the answer.
   The docs explain both, and `-columns` drops `tact` when only the path matters.
4. **T4: The newest record's "after".** `changes` for the newest record needs the live CPU
   (`getCpuState({ present: true })`), not the cursor's registers; G4.3 made `getCpuState()` answer
   from the cursor. The `history` command already asks for `present: true`.
5. **T5: Partitions differ from bank labels.** The address prefix is a partition label from
   `getPartitionLabels()` (`R0`, `0A`, Next `-23..-1`), not a raw MMU value; machines without
   partitions (Z88, ZX80/81, 48K) write a bare address. In CSV the partition gets its own `part`
   column so a script can split on it.
6. **T6: CSV injection.** A spreadsheet treats a cell starting with `=`, `+`, `-` or `@` as a formula.
   Step numbers (`−42`) and some disassembly (`-` in an operand only after a comma, but labels can
   contain anything a source allows) could start with them. Cells are quoted and a leading `=`, `+`,
   `@` (and `-`, unless the column is numeric) is prefixed with `'` — the OWASP rule. A test covers a
   label named `=CMD`.
7. **T7: Unicode in text.** The viewer uses `−` (U+2212) for steps and `—` in separators. Text files
   keep them (UTF-8, no BOM); CSV writes ASCII `-` for numbers so spreadsheets parse them, and keeps
   `—` only in the instruction column. The header and the files are UTF-8; CSV gets a BOM only with
   `-bom` (Excel on Windows needs one to read UTF-8; Q6).
8. **T8: Disassembly of `bytesTruncated` records.** The flag (bit 5) is defined but never set today
   (G4.1 §9.3). If a core sets it later, the exporter writes the bytes it has and `?` for the
   instruction rather than a wrong decode.
9. **T9: Large selections in the document.** "Export rows from here" on the oldest row of a full Next
   ring is 131,072 records; the disassembly cache is per PC + bytes, so a loop costs little, but the
   first export of a big, varied ring takes a moment. The command reports progress in the output pane
   every 16,384 records, and the document's button shows a busy state.

---

## 4. Design

### 4.1 Pure exporter (`src/common/history/historyExport.ts`)

```ts
export type TraceColumn = "seq" | "step" | "frame" | "tact" | "part" | "addr" | "bytes" | "instr"
  | "source" | "changes" | "regs" | "flags" | "ctx" | "repeat";

export type TraceExportOptions = {
  format: "text" | "csv";
  columns: TraceColumn[];
  absolute: boolean;          // D3
  repeats: boolean;           // D6
  interrupts: "keep" | "drop" | "dropWithMarkers"; // D7
  header: boolean;            // D9
  bom: boolean;               // T7
};

export type TraceResolvers = {
  instruction(record: HistoryRecord): Promise<{ text: string; length: number } | undefined>;
  source(record: HistoryRecord): string | undefined;      // "file.asm:123"
  partitionLabel(record: HistoryRecord): string | undefined;
  describeContext(record: HistoryRecord): string;         // historyContextDecoder().describe
};

export async function* exportTrace(
  pages: AsyncIterable<HistoryRecord[]>,
  meta: TraceMeta,                 // version, machine, range, tact unit, newest "after" registers
  spans: HistoryServiceSpan[],
  options: TraceExportOptions,
  resolvers: TraceResolvers
): AsyncGenerator<string>;         // lines, header first
```

- An async generator over pages (§1.2's hook), but the command collects it into one string (D11).
- `historyRowCells` gains the masked-repeat form (`repeats: false`) and the DMA-hold text without the
  T-states (T2); its existing callers pass `repeats: true` and do not change (D14).
- CSV quoting and the formula guard live in a tiny `csv.ts` beside it (none exists in `src` today).
- `formatHistoryRow` becomes `exportTrace`'s text line for the viewer column set; D14's golden test
  pins the `history` command's and "Copy rows as text" output.

### 4.2 Command (`HistoryCommands.ts`)

```
history-export <file> [-from <-n|#seq>] [-to <-n|#seq>] [-count <n>]
               [-format text|csv] [-columns default|viewer|all|<id,id,...>]
               [-absolute] [-repeats] [-nointerrupts] [-nomarkers] [-filter <text>]
               [-noheader] [-bom] [-f]
alias: hexp
```

- `requireHistory`; refuse while Running (D10); no history → the same messages as `history`.
- Resolve the range from `getHistoryInfo()` with `parseHistoryTarget`; an endpoint older than the
  ring is clamped to the oldest record with a warning ("the ring starts at #…; 3,412 earlier
  records are gone").
- Existence check and `-f` as in `zx-snapshot-save`; write with `saveTextFile`; print
  "Exported 12,345 records (frames 0–41) to run1.txt".
- The relative path rules are `saveTextFile`'s (`project:`, `home:` …).

### 4.3 Menu, dialog and document

- `MainApi.showSaveFileDialog({ title, defaultPath, filters })` → `string | undefined`, implemented in
  `RendererToMainProcessor.ts` with `dialog.showSaveDialog` on the IDE window; remembers its folder in
  `appSettings.folders["historyExport"]` like the state menus.
- **Debug → Export Execution History…** in `debug-menu.ts`, enabled when the machine has
  `MF_EXEC_HISTORY` and is not Running; it uses the main-side dialog directly and runs
  `history-export "<path>" -f` through `getIdeApi().executeCommand`.
- **Document:** an **Export…** icon button in the header strip (after Clear) and the context-menu item
  **Export rows from here to the newest…**. Both call `showSaveFileDialog` and then run the command
  with `-filter` and `-nointerrupts` matching the document's current filter and fold state, so the
  file holds what the user sees. The button is disabled while Running.
- Docs: a section "Exporting a trace" in `docs/content/working-with-ide/execution-history.mdx` with
  the two-run diff recipe (stop at the same breakpoint in both runs, export both, diff; then add
  `-nointerrupts` or drop `tact` if the noise is interrupts or timing), and the command reference.

---

## 5. Phases

| Phase | Work | Done when |
| --- | --- | --- |
| 1 | Pure exporter and CSV helper (§4.1); `historyRowCells` repeat masking; D14 switch of `history` and `copyRows` | `node` tests: text and CSV goldens per record kind and per machine context (Next partitions, 128K, ZX81 display runs, DMA holds), relative/absolute, masking, interrupt dropping with and without markers, T6 formula guard, T7 encoding; the `history` command's output unchanged |
| 2 | `history-export` command (§4.2) | `test/commands/HistoryExportCommand.test.ts` with a faked Emu API: ranges, clamping, Running refusal, overwrite guard, `-columns` parsing errors |
| 3 | `MainApi.showSaveFileDialog`, Debug menu item, document button and context item (§4.3) | `jsdom` test of the document's export (filter and fold state carried into the command); the menu's enablement |
| 4 | Machine test and docs | e2e (`test/emu/`): two debug runs of the same 48K program to the same breakpoint, one with a key pressed a frame later, exported with the defaults — the files are equal up to the frame of the key, and differ after it; with `-nointerrupts` on a program whose two runs differ only in interrupt timing, the files are equal. Docs page, command reference, roadmap and competitive analysis (§7) |

---

## 6. Tests

- **Pure** (`test/common/history/history-export.test.ts`): fixtures from `encodeHistoryRecord`;
  every column; every kind; masking; spans; header contents (no timestamp: two exports identical);
  CSV parsed back with a minimal RFC 4180 reader and compared cell by cell.
- **Command** (`test/commands/`): as Phase 2.
- **UI** (`jsdom`): as Phase 3.
- **Machine** (`test/emu/history-export-controller.test.ts`, listed in `build/e2e-tests.ts` because it
  runs a core): as Phase 4.

---

## 7. Effort and the standing rule

**S** (the roadmap's estimate holds): about a week. Phase 1 is the bulk; the rest follows patterns
that exist (`zx-snapshot-save`, the state menus, the document's context menu).

When it lands: mark G4.5 done in [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md), and update
[LANDING_PAGE_COMPETITIVE_ANALYSIS.md](LANDING_PAGE_COMPETITIVE_ANALYSIS.md) §2 (the "Reverse
debugging / execution history" row: "export a range as a text or CSV trace") and §4 (W2's text).
No visual change beyond one header button and one menu item, both from existing primitives; if the
button needs an icon, it comes from `src/renderer/assets/icons/` and
`.ai/ui-theming-intent-and-lessons.md` gets a line only if a new rule is learned.

---

## 8. Questions (all answered, 2026-10-08: the suggested answers)

1. **Q1 — Command name.** `history-export` / `hexp` (suggested, matches `history-clear` / `hclr`), or
   `export-history`?
2. **Q2 — Formats.** Text and CSV only (suggested), or also JSON Lines for scripts? JSON Lines is a
   few lines more in the exporter but another format to keep stable.
3. **Q3 — Range anchors.** Only `-from`/`-to`/`-count` with G4.3's targets (suggested), or also an
   anchor such as "the last visit to address X" (`-from @$8000`)? The recipe in D5 covers the common
   case without it.
4. **Q4 — Repeat counts masked by default?** Suggested yes (D6), because the trace is for diffing;
   `-repeats` restores them. The alternative is to keep the viewer's text by default and add
   `-diff` for the masked, relative, header-less form.
5. **Q5 — A diff inside Klive?** Suggested no for G4.5: external tools do it well. A later item
   could open two traces in Monaco's diff editor, which the IDE already bundles.
6. **Q6 — CSV metadata and BOM.** Suggested: no metadata rows in CSV (they break naive parsers), the
   header goes to the output pane; no BOM unless `-bom`.
7. **Q7 — Save dialog from the IDE renderer.** Suggested: a general `MainApi.showSaveFileDialog`,
   which other features (G7.6 export as source) will want too. The alternative is to route the
   document's button through the main-process menu action, which avoids a new API but cannot carry the
   filter and fold state without one.

---

## 9. Implementation notes (2026-10-08)

- **Where things live.** The exporter is `src/common/history/historyExport.ts` (with
  `formatHistoryRow`, which moved there from `historyRow.ts`: D14's single formatter), the CSV cell
  rules are `src/common/history/csv.ts`, the renderer's resolvers are
  `src/renderer/features/history/historyTrace.ts`, the command is `HistoryExportCommand` in
  `HistoryCommands.ts`, the save dialog is `src/main/save-file-dialog.ts`, and the menu's export is
  `src/main/history-export.ts`. D8's filter functions were already free of React and stayed in
  `historyViewModel.ts`.
- **Repeat text** is one switch on `historyRowCells`/`historyEventText` (`repeats: "show" | "mask" |
  "omit"`): text writes `×*` when masked; CSV always omits the count from the text and writes it in
  the `repeat` column with `-repeats`. The Next's `describeEvent` takes `withTime` for T2.
- **Columns** are always written in the canonical order of D2, whatever order `-columns` lists them
  in; `part` and `repeat` are CSV-only columns that come with `addr` and `instr`. A separator or a
  marker line keeps the `seq`/`step`/`frame`/`tact` columns and puts its text after them, which is
  exactly `formatHistoryRow`'s old separator layout for the viewer columns.
- **Relative time** counts from the range's first record, even when `-nointerrupts` drops it.
- **Markers are left out of a filtered trace**: a filter's trace has gaps anyway, and a marker
  would not pass an address filter.
- **A service still running** at the range's end is dropped from its INT on, and its marker says
  `unfinished`; a span that began before the range is dropped from the range's first record.
- **CSV cells**: text cells are always quoted; numeric columns (`seq`, `step`, `frame`, `tact`,
  `repeat`, `IFF1`, `IFF2`, `IM`) are bare so a spreadsheet parses them. The formula guard (T6)
  applies to text cells only, so a negative step is never prefixed.
- **A file name without a known extension** from a save dialog is exported as text (`-format text`).
- **Command output from the document** goes to the Build output pane, as the menu's does
  (`MainToIdeProcessor.executeCommand`); a failure is also shown in a message box.

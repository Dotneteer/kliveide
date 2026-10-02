# Tape Viewer Modernization Plan (`.tap` / `.tzx`)

Status: **built** — all seven phases (§8 records what differed from the design). The author chose
**Option A (split browser) plus a timeline strip** from three mockups (§1.2).

Read first: `AGENTS.md`, `.ai/ui-theming-intent-and-lessons.md`, and `.plans/Z88_SLOT_BROWSER_PLAN.md`.
The Z88 plan is the template for this one. It extracted the shared `BankBrowser` shell, and the tape
viewer reuses that shell.

## 1. What is being added, and why

The current `TapViewerPanel.tsx` is a single long scroll. Each block is a `DataSection` holding a few
`Secondary` text lines and a full `StaticMemoryView` hex dump. A tape with a few hundred blocks
becomes a wall of hex. You cannot see the file structure (header + data = one file). BASIC is shown
only as bytes. You cannot load the tape into the machine from the viewer.

This plan has three goals:

1. **Modernize the UI.** Use the NEX/Z88 pattern: a summary strip, then a `BankBrowser` with the
   block list on one side and the selected block's details on the other. Any block can be popped
   out into its own document.
2. **Recognize and show BASIC.** A data block that follows a *Program* header is decoded into a
   listing, with line numbers, tokens, hidden 5-byte numbers skipped, and the variables area told
   apart. The listing is shown inline and can also be popped out.
3. **Load the tape into the machine** from the viewer's tab command bar and from the Explorer's
   context menu. This works on ZX Spectrum 48K, 128K and +2E/+3E, and is disabled on the ZX
   Spectrum Next and every other machine.

### 1.1 Decisions (confirmed)

| # | Decision | Choice |
|---|---|---|
| D1 | Layout | **Chosen: Option A plus a timeline strip.** A summary strip, a thin tape timeline (§4.4.1), and then the shared `BankBrowser`, with no `ExpandableRow` around the browser (Z88 plan decision). TZX metadata blocks (`$30`, `$32`, `$33`) feed the summary strip. They also stay in the list as rows. |
| D2 | Grouping | A **file** is a standard header followed by its data block, and it is one `groupOf` group, labelled `Program "name"` or `Bytes "name"`. Headerless data, custom-loader runs and metadata get their own groups. |
| D3 | Block number display | Use the decimal `#n`, not `$NN`. This needs a small generalization of `BankBrowser` (§4.1). |
| D4 | Machine guard | Allow `MI_SPECTRUM_48`, `MI_SPECTRUM_128` and `MI_SPECTRUM_3E`. Check the allow-list itself, not `MF_TAPE_SUPPORT`, because the Next also has tape support through its own menu. |
| D5 | Load modes | **Load and run**: reset, then auto-type `LOAD ""` (48K) or pick *Tape Loader* (128K/+2/+3). **Insert**: attach the tape without a reset. **Load and debug**: like Load and run, in debug mode, so the user's breakpoints are armed. |
| D6 | One loading path | Every entry point runs one new IDE command, `tape-load`. It goes through **main's `setSelectedTapeFile`**, so the media state, the Eject menu and the saved folder stay correct. Calling `emuApi.setTapeFile` directly would skip all three. |
| D7 | BASIC decoder | Move `createListing` out of `BasicPanel.tsx` into a pure function. The live BASIC panel and the tape viewer then share it, so there is still only one detokenizer. |

### 1.2 Layout options considered

Three layouts were mocked up with the same example tape. The author chose A, with B's timeline added
as a thin strip.

| Option | Shape | Why it was not chosen alone |
|---|---|---|
| **A, split browser** (chosen) | The block list, grouped by file, on the left and the selected block's details on the right. The NEX and Z88 shell. | Not rejected. It shows nothing of loading order or timing, so B's strip is added. |
| B, timeline | A strip with each block's width proportional to its play time, and the selected block's details below it. | Short blocks (headers, pauses, text) are slivers, and a TZX with hundreds of blocks is unreadable without zoom. No room for names or file groups. Needs a new, complex control. |
| C, expandable table | A dense table whose rows open in place. A modernized version of today's viewer. | Opening a block pushes the rest of the tape down, the current "wall of hex" again. Does not reuse `BankBrowser`, so keyboard, pop-out and Go Back would be built again. |

### 1.3 Out of scope

- Editing tapes, or writing TAP/TZX back out.
- Playing TZX blocks that Klive does not play today (`$13`, `$14`, `$15`, `$19`, and others). The
  viewer *shows* them and marks them "not played" (§4.7). Playing them is a separate emulator change.
- ZX81 `.p`/`.tzx`. There is no ZX81 machine id. The viewer should still open such a file without
  crashing, and the load buttons stay disabled.
- Loading on the Next. NextZXOS has its own tape path (`zx-next-menus.ts`).

## 2. What exists today

**Viewer.** `src/renderer/appIde/DocumentPanels/TapViewerPanel.tsx`
- `readTapeFile` (`src/renderer/utils/tape-utils.ts`) returns `{ data, type: "tap" | "tzx", error }`.
- A per-block switch draws `0x10`, `0x11`, `0x12`, `0x20`, `0x21`, `0x22` and `0x30`. All other
  blocks show "not implemented".
- Registered at `registry.ts` (`TAP_VIEWER`, about :412), with no `navigation` adapter. The `.tap`
  and `.tzx` patterns (about :633-650) have no `documentTabRenderer` and no `contextMenuInfo`.

**Bank browser.** `src/renderer/controls/bankBrowser/BankBrowser.tsx`
- `BankBrowserItem = { key, bank: number, lastView }`.
- Props: `visibleItems`, `selectedKey`, `heading`, `summary`, `filters`, `filter`,
  `onFilterChange`, `views`, `viewNames`, `onSelect`, `onPopOut`, `groupOf`, `renderRow`,
  `renderDetailsMarks`, `renderDetails`, `renderRowMenuItems`, `hint`.
- Exports the helpers `BankChip`, `BankRowText`, `BankFacts`, `BankDetailsSection` and
  `BankGroupLabel`.

**Pop-out.**
- `openStaticMemoryDump(hub, id, title, bytes, { disassemblyEnabled, disassOffset, viewMode, ... })`
  in `features/memory/StaticMemoryDump.tsx` (about :1717).
- It runs inside `navigationHistoryService.recordJump(reason, ...)`.
- A closed pop-out is reopened by `createStaticDumpNavigationAdapter` in
  `appIde/navigation/addressNavigationAdapters.ts`. That adapter parses the document id and
  re-reads the bytes through `readNexBankBytes` / `readZ88BankBytes`.

**Launch-menu templates.**
- `features/documents/NexLaunchContextMenu.tsx` and `Z88SnapshotLaunchMenu.tsx`. Each has a
  `get…ContextMenuInfo(services)` and a `…CommandBarRenderer(path)`.
- Both use a shared guard that returns a refusal string, and both execute an IDE command.
- The command template is `appIde/commands/Z88SnapshotCommand.ts`. It is registered in
  `IdeCommands.ts` (about :198).

**Tape loading.**
- Main: `setSelectedTapeFile(filename)` (`src/main/machine-menus/zx-specrum-menus.ts:171`) does the
  following, in order:
  1. dispatches `setMediaAction(MEDIA_TAPE)`
  2. saves the folder setting
  3. reads the file
  4. calls `getEmuApi().setTapeFile`
- Emu: `MainToEmuProcessor.setTapeFile` (about :138) does the following:
  1. tries the TZX reader, then falls back to TAP
  2. reduces the blocks to `TapeDataBlock[]` with `getDataBlock()`
  3. calls `mediaStore.addMedia`
  4. calls `setMachineProperty(MEDIA_TAPE)`
- **There is no IDE command for tapes.**

**Auto-typing.**
- The `CodeInjectionFlow` steps are `ReachExecPoint`, `Start`, `QueueKey`, `WaitKeyQueue`, `Wait`
  and others. They run in `MachineController`.
- Each WASM host has a `getCodeInjectionFlow`:
  - `ZxSpectrum48WasmHost`
  - `ZxSpectrum128WasmHost` (it reaches `SP128_MAIN_WAITING_LOOP`)
  - `ZxSpectrumP3eWasmHost`
- These flows are only reachable through code injection, and they always inject code.

**BASIC.**
- `BasicPanel.tsx` `createListing` (about :72-280) is the only detokenizer.
- It reads live memory: PROG is at `$5C53` and VARS at `$5C4B`.
- It writes into `BasicProgramBuffer` (`BasicLine.ts`). The output is rendered by
  `BasicLineDisplay`.
- Token text comes from `ZxSpectrumChars` (`src/common/machines/char-codes.ts`).

## 3. The traps

1. **Header names are read off by one.** The current `HeaderBlock` loops over `i = 1..10`, which
   includes the type byte and drops the last character. The name is at offsets 2 to 11. Fix this
   first, with a test.
2. **`SpectrumTapeHeader`'s constructor ignores its `header` argument.** It always fills the header
   with zeros, so it cannot parse a real header. Either fix it to copy `header`, which needs a check
   that no writer depends on the zero-fill, or write a separate pure `parseTapeHeader`. Prefer the
   fix, and add a test that round-trips a real header from `test/testfiles/floatspy.tap`.
3. **Names can contain control codes.** For example, the `_input/A Yankee in Iraq` tape name begins
   `16 01 00` (AT 1,0). Show such names through the ZX charset with control codes escaped
   (`\AT 1,0`). Never pass them through `String.fromCharCode`.
4. **BASIC block payload versus the TAP block.** The block is laid out as flag byte, payload,
   checksum. The program is `payload[0 .. header.par2)`. `par2` is the *variables offset*, and the
   variables run from there to the header's data length. `par1` is the autostart line, and a value
   of 32768 or more means "none". A data block with no header in front cannot be called BASIC from
   its bytes alone. Offer an "Interpret as BASIC" menu item for that case. Never guess.
5. **Data block length versus header length.** Protected tapes put headers in front of data blocks
   that do not match them. Pair a header with the next block only if `data.length - 2 ==
   header.length`. Otherwise show a warning chip ("length mismatch") and still decode up to the
   available bytes.
6. **`BankBrowser` hard-codes "Bank".** It appears in the row number (`$NN`), the details title,
   aria labels and the empty-filter text. Generalize it without any visible change to NEX or Z88
   (§4.1). `BankBrowser.test.tsx` pins this.
7. **The pop-out reason is a closed union.** Add `"tapeBlock"` to both `NavigationReason` and
   `NAVIGATION_REASONS`.
8. **Media state.** Loading has to go through main (D6). Otherwise *Eject Tape* and the restore at
   startup (`src/main/index.ts:385`) disagree with what the machine actually holds.
9. **Fast load needs the 48K ROM.** `TapeDevice` traps `$056C` only when the 48K ROM is paged. On a
   128K or +3 machine, the *Tape Loader* menu pages that ROM in, so the trap works. Typing `LOAD ""`
   in 128 BASIC also works, but is slower to reach. Use the menu.
10. **TZX blocks dropped on load.** `getDataBlock()` exists only for `$10`, `$11`, `$12` and `$20`.
    A tape whose loader relies on `$14` or `$19` loads silently wrong. The viewer must say so before
    the user loads (§4.7).

## 4. Design

### 4.1 Generalize `BankBrowser` (no visible change to NEX or Z88)

Add two optional props:

- `itemNoun?: string` (default `"Bank"`). Used in the details title, aria labels, the empty-filter
  text and the pop-out tooltip.
- `formatNumber?: (item) => string` (default `$NN`). Used for the row number and the details title.
  The decimal value in brackets is shown only when the default is used.

Keep `bank: number`. The tape viewer stores the block index there. Do not rename the type: that
would touch every NEX and Z88 call site for no gain.

### 4.2 Tape model: `tapeView.ts` (no React)

Place it next to the viewer in `src/renderer/appIde/DocumentPanels/Tape/`. Pure functions, all
unit-tested on `floatspy.tap` and a small hand-built TZX:

- `analyzeTape(contents) => TapeAnalysis`. Builds on `readTapeFile` and returns:
  - `blocks: TapeBlockInfo[]`. Each block has an `index`, its `kind`, the raw `bytes`, `flag`,
    `checksumOk`, `header?` (a parsed `SpectrumTapeHeader`), `role`, `timing?` (pilot, sync and bit
    lengths in T-states), `pauseMs`, `durationMs` and `playable` (is `getDataBlock()` defined?).
    - `kind` is one of: header, data, tone, pause, group, text, archive, hardware, other.
    - `role` is one of: basic, code, screen, numArray, charArray, headerless or none.
  - `files: TapeFile[]`, each being a header + data pair (D2).
  - `summary`. Format and version, size, block and file counts, the total play time, and the TZX
    archive fields: title, publisher, year, authors.
- `tapeBlockGroups`, `tapeFilters` and `filterTapeBlocks`. The filters are All / Data / BASIC /
  Code / Not played.
- `roleOf(header, dataLength)`:
  - type 0 is `basic`
  - type 3 with start `$4000` and length 6912 is `screen`
  - other type 3 blocks are `code`
  - types 1 and 2 are the two array kinds

### 4.3 BASIC decoder: `src/common/zxbasic/detokenize.ts` (or `renderer/utils`)

- Move `createListing`'s loop out of `BasicPanel.tsx` into
  `decodeBasicProgram(bytes, { progLength, charSet, showCodes }) => BasicLine[]`.
- `BasicPanel` calls it with the live PROG..VARS bytes. The tape viewer calls it with
  `payload.subarray(0, par2)`.
- Keep `BasicProgramBuffer` and `BasicLineDisplay` as they are. Both views render through the
  shared `BasicLineDisplay`, so the *Codes* and *ZX font* toggles behave the same in both.
- `decodeBasicVariables(bytes)`. Lists the variables area: numbers, strings, arrays and FOR
  control variables. It is a stretch goal for Phase 3b.
- Corruption check: if a line number is above 9999, or line numbers go down, the listing stops with
  a marker row instead of throwing. This reuses BasicPanel's existing rule.
- **Provenance:** this is the ZX Spectrum ROM's token format, not Klive BASIC/zxbasic. The rule in
  `AGENTS.md` does not apply. Token text comes only from `char-codes.ts`.

### 4.4 Viewer: `Tape/TapeViewerPanel.tsx` (+ `TapeBlockBrowser.tsx`)

This replaces `TapViewerPanel.tsx`. Update the import in `registry.ts` and delete the old file.

**Summary strip.**
- One `Row` of `LabeledText`: Format, Size, Blocks, Files (with role chips), Play time.
- For a TZX, it adds Title, Publisher and Year from the `$32` block.
- Below the strip, banners appear when needed:
  - a parse error (the existing `EmptyState`)
  - "N blocks will not play in Klive" (§4.7)
- Between the strip and the browser sits the **timeline strip** (§4.4.1).

#### 4.4.1 Timeline strip: `Tape/TapeTimeline.tsx`

A thin bar that shows the whole tape in play order, with the selected block marked. It adds a sense
of loading order and timing to Option A without becoming a second way to browse.

- **Geometry.** One row, about 6px high, across the full viewer width. Each block is a segment whose
  width is proportional to `durationMs`. A tick row is not drawn; the summary strip already gives the
  play time.
- **Minimum width.** Every block that carries signal gets at least 2px, so headers and short pauses
  stay visible. The minimum is taken out of the widest segments. Non-signal blocks (text, archive,
  group, and other metadata) get no segment.
- **Colour by role, through tokens.** Header, BASIC, code, screen, tone/pause and "not played" each
  have one token. The default is neutral; only "not played" uses `--status-error` and BASIC, the
  accent. Add the tokens at L4 (`componentAliases.ts`), never as literals in the stylesheet.
- **Selection.** The selected block's segment gets an accent outline that is drawn outside the bar,
  so it stays visible on a 2px segment. Selecting a block in the list moves the mark, and clicking a
  segment selects that block in the list. Both directions go through the same `selectedBlock` view
  state, so there is one source of truth.
- **Hover.** The tooltip gives `#n`, the kind, the file name and `start – end` times.
- **Keyboard.** The strip is not a separate tab stop. The list's keyboard already moves the
  selection, and the strip follows it. An `aria-hidden` bar avoids repeating the list to screen
  readers.
- **Large tapes.** Above about 500 blocks, adjacent segments narrower than 1px merge into one
  neutral segment. Clicking it selects its first block. Render the bar as one `<canvas>` or a few
  `<div>`s per merged run, never one DOM node per block.
- **Data.** `tapeTimeline(analysis, widthPx) => Segment[]` lives in `tapeView.ts` and has no React.
  Its tests cover the proportional widths, the 2px minimum, the merging and the absence of segments
  for metadata.
- **No playback feedback.** The strip is static: it does not follow the tape while the machine
  loads (§7, Q4).

**Browser.** A `BankBrowser` with `itemNoun="Block"` and `formatNumber = #n`.
- **Row:** the role or TZX id chip, then a short text, then the length on the right.
  - The text is the program's `LINE n`, the code start address, or the pause or tone parameters.
  - A warning chip appears for a checksum failure or a length mismatch.
- **Details marks:** the role chip, `flag $XX`, the checksum state, and `turbo` for `$11`.
- **Details body:** `BankFacts`, then the sections below.
  - **Header facts.** The name (escaped, trap 3), type, length, then `Autostart` / `Variables at`,
    or `Start address`, or the array variable name.
  - **Timing facts** (TZX `$11`, `$12`, `$13`, `$14`). Pilot, sync, bits, pause and duration.
  - **BASIC listing.** The first ~40 lines inline, rendered with `BasicLineDisplay`, then a
    "… n more lines" footer that pops the listing out.
  - **Code preview.** The first 64 bytes as hex.
  - **Screen preview** (role `screen`). A 256×192 thumbnail, made with the existing SCR renderer
    that `ScrFileViewerPanel` uses.
  - **Text, archive and hardware blocks.** Their fields.
- **Views:** `memory`, `disassembly`, `basic` and `screen`. The pop-out menu greys out any view
  that does not apply to the block's role.
- **Row menu extras:** "Interpret as BASIC…" for headerless data, and "Disassemble from…", which
  changes the address the block is disassembled at.

**View state.** The document view state holds `selectedBlock`, `blockFilter`,
`blockView: Record<number, View>` and `basicShowCodes`. Drop the old per-index `expanded` map.

### 4.5 Pop-out

The document id is `tapeBlockDump${fullPath}:${index}`, together with `tapeBlockDocumentId`,
`parseTapeBlockDocumentId` and `readTapeBlockBytes(path, index, readBinaryFile)`. These keep a
one-path cache, the same way `nexBankReveal.ts` does.

Each view opens as follows:

- **memory** and **disassembly** open `openStaticMemoryDump`, with `disassOffset` set as follows:
  - the header's start address for code
  - `$5CCB` (the usual PROG) for BASIC
  - otherwise the "Disassemble from…" value
- **basic** opens a new read-only document type, `TAPE_BASIC_VIEWER`. It reuses the
  `BasicLineDisplay` listing with the panel's toolbar (Codes, ZX font) and *no* live refresh. This is
  the one new document type. **Popping out the BASIC listing is a confirmed requirement (§7, Q3);**
  only *how* is open. The alternative is to give `BasicPanel` a `source: "live" | bytes` mode
  instead of a new type. Decide in Phase 5 after reading `BasicPanel`'s refresh coupling.
- **screen** opens the SCR viewer on the block's 6912 bytes.

Registration:
- Register `TAP_VIEWER` with `navigation: fileDocumentNavigationAdapter`, so Go Back returns to it.
- Add a `readTapeBlockBytes` dependency and branch to `createStaticDumpNavigationAdapter`, so a
  closed pop-out can be reopened.

### 4.6 Loading: the `tape-load` command, MainApi and auto-run

**Guard.** `tapeLoadGuard(state): string | undefined`. It is shared by the command, the command bar
and the context menu (§7, Q1).
- On any machine other than the ZX Spectrum 48K, 128K or +2E/+3E (the Next, the Z88, the C64, and
  any machine added later), **all three command bar buttons and all three Explorer menu entries are
  disabled**. The machine is never switched automatically.
- The command bar buttons keep their tooltips while disabled, with the reason appended, for example
  "Load and run this tape (requires a ZX Spectrum 48K, 128K or +2/+3 machine)". Explorer menu
  entries are only greyed out, since `ContextMenuInfo` has no tooltip.
- The UI reads `emulatorState.machineId` through `useSelector`, so the buttons enable and disable as
  soon as the machine changes, with the viewer still open.
- It refuses unless `machineId` is in `[MI_SPECTRUM_48, MI_SPECTRUM_128, MI_SPECTRUM_3E]`.
- The refusal text is "requires a ZX Spectrum 48K, 128K or +2/+3 machine".
- It does *not* refuse an invalid tape. The command explains that case, the same way the Z88
  snapshot command does.

**Command.** `appIde/commands/TapeLoadCommand.ts`: `id = "tape-load"`, alias `tapeload`.
- `tape-load "<file>"` inserts the tape only.
- `-r` resets and runs it, by auto-typing `LOAD ""` or choosing Tape Loader.
- `-d` does the same as `-r`, in debug mode.
- Validation: the extension must be `.tap` or `.tzx`, `-r` and `-d` cannot be combined, and the
  guard must pass.
- It is registered in `IdeCommands.ts` and documented in `docs/content/commands-reference.mdx`.

**MainApi.** Add `MainApi.setTapeFile(path)` → `RendererToMainProcessor` → `setSelectedTapeFile`
(D6).

**Auto-run.** Add `EmuApi.startTapeLoad({ debug })` → `MainToEmuProcessor` → a
`MachineController` flow with no `Inject` step:
- **48K:** `Start`, `ReachExecPoint(SP48_MAIN_ENTRY)`, `QueueKey(J)`,
  `QueueKey(SymShift+P) ×2`, `QueueKey(Enter)`.
- **128K and +2E/+3E:** `Start`, `ReachExecPoint(SP128_MAIN_WAITING_LOOP or
  SPP3_MAIN_WAITING_LOOP)`, `QueueKey(Enter)`. Tape Loader is the first menu item. Check that the
  +3E menu's first item is still Tape Loader.

Add an optional `getTapeLoadFlow()` to each host, beside `getCodeInjectionFlow`. That way, a machine
with no flow refuses cleanly.

**Insert on a tape that is already inserted** reloads the file and rewinds to block 0, which is what
the emulator's *Select Tape File…* menu does (§7, Q2).

**Fast load.** The tooltip says whether `SETTING_EMU_FAST_LOAD` is on. Nothing changes the setting.

**UI.** `features/documents/TapeLaunchMenu.tsx` provides `getTapeLaunchContextMenuInfo` and
`tapeLaunchCommandBarRenderer`. The buttons are play (Load and run), eject (Insert) and debug
(Load and debug), each followed by `TabButtonSpace`. Wire them into both registry patterns (`.tap`
and `.tzx`).

### 4.7 Blocks that will not play

`playable === false` is set for any block that carries signal but has no `getDataBlock()`. Such a
block gets a red "not played" chip, appears under a filter, and shows in a summary banner. The load
buttons stay enabled; the tooltip carries the warning. Fixing the emulator is out of scope (§1.3).

## 5. Phases

Each phase is reviewable on its own and ends green on focused tests, `npm run build:check` and
`npm run lint:renderer`. After any file moves, also run `npx electron-vite build --config
build/electron.vite.config.ts`.

### Phase 1: fixes and the React-free model
- `tapeTimeline` segment builder (§4.4.1), with tests.
- Fix the header name offset (trap 1) and `SpectrumTapeHeader` (trap 2), with tests.
- `Tape/tapeView.ts`: `analyzeTape`, files and groups, filters, roles, durations.
- Tests in `test/renderer/tape/tapeView.test.ts`, using `floatspy.tap` and a synthesized TZX with
  blocks `$10`, `$11`, `$12`, `$20`, `$30`, `$32` and `$19`.

### Phase 2: generalize `BankBrowser`
- Add `itemNoun` and `formatNumber` (§4.1).
- `BankBrowser.test.tsx` gains noun and number cases. The NEX and Z88 snapshots stay unchanged.

### Phase 3: the BASIC decoder
- 3a. Extract `decodeBasicProgram` from `BasicPanel`, with no change to the live panel. Add a test
  that decodes `floatspy.tap` line 10 to `BORDER 1: PAPER 1: INK 9: CLEAR 49151`.
- 3b. (Optional) `decodeBasicVariables`.

### Phase 4: the new viewer
- `TapeViewerPanel` and `TapeBlockBrowser`: the summary strip, the browser and the details renderers.
- `TapeTimeline` (§4.4.1) and its role tokens, with click-to-select and selection sync tests.
- Delete `TapViewerPanel.tsx` and its `.module.scss`.
- Put any new colour through tokens. Role chips use existing chip styles, and a block that will not
  play takes `--status-error`. Update `.ai/ui-theming-intent-and-lessons.md` (standing
  instruction).
- Verify in the running app with the CDP recipe, not a replica.

### Phase 5: pop-outs and navigation
- Add the ids, the `readTapeBlockBytes` cache, the adapter branch and the `"tapeBlock"` reason.
- Add the `basic` view's pop-out (required; pick the document type or the `BasicPanel` mode, §4.5)
  and the `screen` view.
- Extend `test/navigation/popOutViewerNavigation.test.ts`.

### Phase 6: loading
- Add `tapeLoadGuard`, `TapeLoadCommand`, `MainApi.setTapeFile` and `EmuApi.startTapeLoad`, plus a
  tape-load flow for each host.
- Add `TapeLaunchMenu.tsx` and wire it into the registry.
- Command tests: validation, the guard on each machine id (the Next, Z88 and C64 refused), and option
  exclusivity.
- UI tests: the command bar buttons are disabled, with the reason in the tooltip, and the Explorer
  entries are disabled, for each refused machine id. Both re-enable when the machine changes to
  sp48, sp128 or spp3e.
- Harness test (`test/harness/sp48/`): insert `floatspy.tap`, run the 48K flow, and assert that
  PROG has the program and that the autostart line ran. Do the same on 128K through Tape Loader.

### Phase 7: docs and screenshots
- `docs/content/getting-started/tapes.mdx`, `working-with-ide/project-explorer.mdx` and
  `commands-reference.mdx`.
- A `scripts/doc-shots/` recipe for the viewer (see `.ai/doc-screenshots-guide.md`).
- `npm run doc:build && npm run doc:check`.

## 6. Risks

- **Auto-typing timing.** The 48K flow depends on reaching `SP48_MAIN_ENTRY` after the copyright
  screen. The existing `getCodeInjectionFlow` already does this, so reuse its steps rather than new
  waits.
- **Coupling between `BasicPanel` and the live machine.** The extraction (3a) may show that
  `createListing` reads `useCodes.current` and machine state partway through. Pass both in as
  parameters, and fix the `showCodes` / `useCodes` mix-up at :116/:138 as part of that.
- **Large TZX files.** Thousands of `$15` direct-recording blocks. `BankBrowser`'s list is
  virtualized only by its scroll container. Measure a 2,000-block file in Phase 4. If it is slow,
  put the row list behind the existing virtualized list.
- **Timeline accuracy.** Play time for `$15`, `$18` and `$19` blocks is estimated, not exact. Mark those
  segments' tooltips "approx." rather than computing exact pulse timing, which is the emulator's job.
- **Media state drift** if anything calls `emuApi.setTapeFile` directly. Add a test that the command
  only ever calls `mainApi.setTapeFile`.

## 7. Resolved questions

Answered by the author.

1. **Machines other than the 48K, 128K and +2/+3.** The command bar buttons and the Explorer menu
   entries are disabled. The machine is not switched automatically. A disabled command bar button's
   tooltip says why (§4.6).
2. **Insert on a tape that is already inserted** reloads the file and rewinds it (§4.6).
3. **The BASIC listing can be popped out** into its own document (§4.5). Only the implementation is
   still to be chosen, in Phase 5.
4. **No feedback while the tape plays.** The viewer does not mark the block being loaded (§4.4.1).

## 8. What was built, and what differed

Everything in §4 shipped. Verified by the unit suite (892 files green), `npm run build:check`, the
Vite build, `doc:build` + `doc:check`, and in the running app through `scripts/doc-shots/recipes/
tapes.cjs`, which asserts the viewer's rows, timeline and BASIC preview before photographing them,
then runs `tape-load -r` and captures the 48K running the loaded program.

**Where it lives.** `src/renderer/appIde/DocumentPanels/Tape/` — `tapeView.ts` (the model, no
React), `zxText.ts`, `TapeViewerPanel.tsx`, `TapeBlockBrowser.tsx`, `TapeTimeline.tsx`,
`TapeBlockViewerPanel.tsx` (the BASIC/screen pop-out, `TAPE_BLOCK_VIEWER`), `tapeBlockDocument.ts`.
The decoder is `DocumentPanels/basicListing.ts`. Loading: `commands/TapeLoadCommand.ts`,
`features/documents/TapeLaunchMenu.tsx`, `emu/machines/tapeLoadFlows.ts`,
`MachineController.runTapeLoad`, `EmuApi.startTapeLoad`, `MainApi.setTapeFile`. The old
`TapViewerPanel.tsx` is deleted.

**Differences from the design.**

- **Headers do not pop out.** Their nineteen bytes are all in the details already; a pop-out of them
  was a document with nothing to add. Their rows keep a placeholder where the icon would be.
- **The BASIC pop-out is its own document type** (§4.5's open choice), which also hosts the screen
  view. `BasicPanel` is built around the live machine (refresh, the state listener, persisting into
  the project); the two share the decoder and `BasicLineDisplay` instead.
- **"Interpret as BASIC…" became a "Read as BASIC" toggle** in the row menu (a headerless block has
  no VARS offset to ask for, so it reads the whole payload), and **"Disassemble from…" became an
  inline "List at:" address box** in the details, which needs no dialog.
- **`readTapeBlockBytes` keeps no cache.** A tape is small and a reopen is one user action; a cache
  would only add a way to show stale bytes.
- **`tape-load` resolves a relative path against the project folder.** The main process would
  otherwise resolve it against the app's public folder.
- **The 48K harness test lives in `test/tape/`**, with two new session methods (`insertTape`,
  `typeFlowKeys`). It types the flow's own `QueueKey` steps, so it tests the keys the IDE sends. The
  ROM ignores a repeat of a key until it has been up for about five interrupts: the harness needs an
  8-frame gap for the two quotes, which the flow's 250 ms between keys already gives the IDE.
- **There is no 128K/+2/+3 end-to-end test**; no harness exists for those machines. The menu flows
  are tested at controller level (`test/emu/MachineControllerTapeLoad.test.ts`) and reuse the waiting
  loops the code-injection flows already reach.

**Bugs found and fixed on the way.**

- `TzxGeneralizedBlock.readFrom` ($19) wrote to an empty array and read the data stream as PRLE
  pairs, so any TZX containing one **failed to open at all**; `TzxSymDef.readFrom` read no pulse
  lengths. Rewritten to TZX 1.20, always ending at the block's declared length.
- `TzxBlockBase.readWords` computed `(lo + hi) << 8`, garbling every `$13` pulse length and `$26`
  offset.
- `TzxCswRecordingBlock` ($18) subtracted 4 bytes for its 2-byte pause, misaligning every block after it.
- `SpectrumTapeHeader` ignored the header it was given; the old viewer read names from offset 1.
- The BASIC decoder never consumed TAB's two argument bytes (and wrote `$17` twice with codes on).
- `createScrPixelData` dropped BRIGHT from the ink colour.

**Turbo playback, fixed after the first pass.** `TzxTurboSpeedBlock.getDataBlock` put the pilot
pulse *count* in `endSyncPulseLength` and left `pilotPulseCount` unset, so a turbo block played the
ROM's default pilot and then an end pulse thousands of T-states long. Fixing that exposed a second,
older bug in **both** tape players (`zx-spectrum-tape.c` for the WASM cores, `TapeDevice.ts`): they
set absolute EAR levels (SYNC1 low, SYNC2 high, each bit low then high), which is right only after an
odd pilot. The ROM's pilots (8063, 3223) are odd, so nothing noticed; a turbo block with an even
pilot made no edge into SYNC1 and failed with "R Tape loading error". Both players now XOR every level
after the pilot with the pilot's parity. `test/tape/turbo-block-playback.test.ts` loads turbo blocks
on the real 48K core with fast load off and checks the load time tracks the block's own pilot;
`test/tape/tape-device-polarity.test.ts` covers the TypeScript player. Both were mutation-tested.

**Still not played.** A pure tone ($12) has no data, and the WASM player treats a block with no data
as a pause, so it is skipped; the viewer marks it "not played" with $13, $14, $15, $18 and $19. All of
them belong to custom loaders, which need the player to learn those blocks (§1.3).

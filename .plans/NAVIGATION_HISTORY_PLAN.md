# Navigation History (Go Back / Go Forward) Plan

Status: **implemented** — Phases 0-4 complete. Persistence across sessions is deferred (§7).
Scope: renderer (`src/renderer`), one main-process menu block (`src/main/app-menu.ts`), one Redux
slice field, icons, one docs page
Prototype: `navigation-history-lab.html` (repo root, open in a browser). It shows the chosen
design and the history rules. Per `.ai/ui-theming-intent-and-lessons.md`, a replica never proves the
app works; verify in the running app.
Related docs: `.ai/interactive-command-notes.md`, `.ai/ui-mvc-guide.md`,
`.plans/DOCUMENT_MANAGEMENT_REFACTOR_PLAN.md`, `.plans/NEX_DEBUGGING_PLAN.md`

## 1. Problem

Klive has many ways to *jump* — Go to Definition, clicking a build error, clicking a breakpoint,
the debugger revealing the PC line, Go to address in Memory/Disassembly, NEX label definitions and
bank pop-outs — and no way to get *back* to where you were. After three Go to Definitions in a row
the only route home is remembering the file and scrolling.

**Goal:** a single, IDE-wide history of *locations* that jumps record, walked with **Go Back** and
**Go Forward** (VS Code semantics), where each **document type declares whether and how** it takes
part: what a "location" means for it, how to capture the current one, and how to restore one.

**Non-goals**

- Not an undo stack for edits, not a per-tab scroll history.
- Not recording every cursor move or scroll, or debugger pauses. Only *jumps* and tab switches (§4.4).
- Not persisted across sessions (yet, §7).
- No change to what `nav`, `openStaticMemoryDump` or the go-to handlers *do*; they gain a recording
  step around what they already do.

## 2. What exists today (verified)

There is **no** back/forward code in the repo (`goBack`, `navigateBack`, `backStack`,
`NavigationHistory` — no hits). The pieces a history plugs into:

| Concern | Where | Notes |
| --- | --- | --- |
| Tab activation | `DocumentHubService.setActiveDocument` (`appIde/services/DocumentHubService.ts:236`) | Every tab switch goes through it. |
| Multiple hubs (split areas) | `ProjectService` `_docHubServices` / `_activeDocHub` (`:62-64`), `DocumentAreaGrid.tsx` | One document object can be shown by several hubs. |
| Per-document view state | `get/setDocumentViewState` (`DocumentHubService.ts:498/507`) | **Read once on mount** — writing it does not move a mounted view. |
| Per-document API | `DocumentApi` (`abstractions/DocumentApi.ts`) via `setDocumentApi` | Has `revealAddress?` (NEX banks only). |
| Source jumps | `nav "<file>" [line] [col]` — `NavigateToDocumentCommand` (`commands/DocumentCommands.ts:20`) | The funnel for almost every text jump. |
| Go to Definition / include link / references | `z80-providers.ts:1147,1282,1320` → `registerEditorOpener` (`monacoBootstrap.ts:71`) → `nav` | Same-file definitions also go through `nav`. **Column is dropped** (`getNavigationLine`, `monacoBootstrap.ts:166`). |
| Build-error / output links | `ConsoleOutput.tsx:255-265` (`@navigate` spans) | → `nav file line col+1` |
| Breakpoints panel | `BreakpointsPanel.tsx:464` | → `nav` |
| Debugger pause → source | `IdeEventsHandler.tsx:176` `refreshCodeLocation` | → `nav` (automatic, fires on every pause) |
| Debugger pause → NEX bank | `IdeEventsHandler.tsx:143` `revealNexBankForPc` → `openStaticMemoryDump` | automatic |
| Monaco jump API | `EditorApi.setPosition` (`MonacoEditor.tsx:652`) | `revealLineInCenter` + `setPosition` + focus. |
| Memory view go-to | `MemoryPanel.tsx:267` `handleGoToAddress`, segment at `:274` | State is local; `topIndex` is a *row*, not an address. No `DocumentApi`. |
| Disassembly go-to / Go to PC | `DisassemblyPanel.tsx:448-455` (`setToScroll`) | Local state; Follow PC moves `topAddress` on every tick. No `DocumentApi`. |
| NEX bank documents | `openStaticMemoryDump` (`StaticMemoryDump.tsx:1303`), id `memoryDump-bankDump<path>:<bank>` | Already re-points open docs via `revealAddress`. Not persisted in the workspace. |
| NEX Go to Definition / labels / regions | `NexAnnotationEditorController.ts:461,478-488,591` → ports `navigateToAddress` / `revealAddressInBank` | same-bank vs other-bank. |
| Commands | `IdeCommandBase`, registered in `appIde/IdeCommands.ts:96-114` | `DocumentAreaCommandBase` is the template. |
| Menu / accelerators | `src/main/app-menu.ts` (step shortcuts read from `shortcuts.*` settings, `:256-261`) | No Go/Navigate menu exists. |
| Toolbar | `controls/Toolbar.tsx` (IDE branch) | `IconButton` + `ToolbarSeparator`. |
| Workspace persistence | `DocumentAreaGrid.tsx:330-375` → `workspaceSettings` → `klive.project` | A new key can ride along. |

**Bank document id mismatch (confirmed, fixed in Phase 0).** The NEX viewer's pop-out built the
bank document id from `document.node.projectPath`, which is project-relative (`ScrollNutter.nex`).
The PC reveal and go-to-definition use the host path `nex-run` records, which is the node's full path
(`/project/ScrollNutter.nex`). So one bank opened as two documents. All three now build the id with
`nexBankDumpId(fullPath, bank)` (`DocumentPanels/Next/nexBankDocument.ts`).

## 3. Concepts

### 3.1 Location

```ts
// src/renderer/abstractions/NavigationLocation.ts
export type NavigationLocator =
  | { kind: "text"; line: number; column: number }
  | { kind: "address"; address: number; segment?: number | null; fullView?: boolean;
      viewMode?: "memory" | "disassembly" }
  | { kind: "document" }; // participates, but has no finer position (e.g. a sprite sheet)

export type NavigationLocation = {
  documentId: string;          // file path or special id ($memory, memoryDump-…)
  documentType: string;        // DocumentRendererInfo.id — selects the adapter on restore
  title: string;               // tab title at capture time (for the history list)
  iconName?: string;
  hubId?: number;              // area the location was *seen* in — a hint, not a requirement
  locator: NavigationLocator;
  preview?: string;            // one-line context: source line text, "LD A,(HL)", symbol name
  reopen?: unknown;            // adapter-private data needed to reopen a closed document
};

export type NavigationReason =
  | "definition" | "reference" | "include" | "outputLink" | "breakpoint"
  | "memoryGoTo" | "disassemblyGoTo" | "nexLabel" | "nexBank"
  | "tabSwitch" | "explorer" | "command";

export type NavigationEntry = NavigationLocation & { reason: NavigationReason; time: number };
```

### 3.2 Document types opt in — the adapter

The user requirement is that *the document type states whether it supports navigation*. That
belongs on the renderer registration, not the mounted instance, because restoring a location must
work **after the document was closed**, when there is no instance to ask.

```ts
// src/renderer/abstractions/DocumentRendererInfo.ts  (added field)
navigation?: DocumentNavigationAdapter;

// src/renderer/abstractions/DocumentNavigationAdapter.ts
export type DocumentNavigationAdapter = {
  /** Two locations closer than this collapse into one entry (e.g. ±10 lines, ±$40 bytes). */
  isNear(a: NavigationLocator, b: NavigationLocator): boolean;
  /** Can a location in a *closed* document be reopened? (NEX banks: only while the file exists.) */
  canReopen(loc: NavigationLocation, services: AppServices): boolean;
  /** Open (or activate) the document in `hub` and move to the locator. false = gone/stale. */
  restore(loc: NavigationLocation, hub: IDocumentHubService, services: AppServices): Promise<boolean>;
  /** Short label for the history list: "line 120", "$8000 · bank 12", "PC $C004". */
  describe(loc: NavigationLocation): string;
};
```

And on the **mounted** instance (current position is only known live):

```ts
// src/renderer/abstractions/DocumentApi.ts  (added members)
/** Where the view is now, or undefined if this document does not take part. */
getNavigationLocator?: () => NavigationLocator | undefined;
/** Move an already-mounted view. Generalises `revealAddress`. */
revealLocator?: (locator: NavigationLocator) => void;
```

A document type **without** `navigation` never produces entries and is skipped by Back/Forward —
that is the opt-out. The adapters shipped in this plan:

| Document type | Locator | Capture | Restore | Near |
| --- | --- | --- | --- | --- |
| Code / text editor (`CodeEditorPanel`, `TextEditorPanel`) | `text` | Monaco `getPosition()` | `nav` path: open via `projectService`, then `EditorApi.setPosition` | same doc, ±10 lines |
| Memory (`$memory`) | `address` | `topIndex * bytesPerRow`, `currentSegment`, `isFullView` | `show-memory`, then `revealLocator` | ±1 screen |
| Disassembly (`$disassembly`) | `address` | `topAddress`, segment, full view | `show-disass`, then `revealLocator` (turns Follow PC **off** — restoring a place you *left* must not be overridden next tick) | ±1 screen |
| NEX bank (`StaticMemoryDumpViewer`) | `address` + `viewMode` | `topAddress`, `viewMode` | `openStaticMemoryDump` with `reopen = {path, bank, disassOffset, annotationPath}`; contents re-read from the `.nex` | ±$40 |
| NEX file viewer | `document` | — | reopen file | always |
| Sprite editor, script output, BASIC defs … | *(none — opted out)* | | | |

### 3.3 The history model (pure, no React, no services)

`src/renderer/appIde/navigation/NavigationHistory.ts` — a plain class, unit-testable without
rendering, following `.ai/ui-mvc-guide.md`:

```ts
class NavigationHistory {
  constructor(opts: { limit: number /* 50 */; isNear: (a, b) => boolean });
  readonly entries: readonly NavigationEntry[];
  readonly index: number;            // the entry we are "at"
  get canGoBack(): boolean; get canGoForward(): boolean;
  record(from: NavigationEntry | undefined, to: NavigationEntry): void;
  back(): NavigationEntry | undefined;    // moves index, returns target
  forward(): NavigationEntry | undefined;
  goTo(i: number): NavigationEntry | undefined;   // for the dropdown list
  remove(pred: (e) => boolean): void;             // closed project / deleted file
  rekey(oldId: string, newId: string): void;      // rename
  onChanged: ILiteEvent<void>;
}
```

**`record(from, to)` rules** (the whole feature's behaviour lives here and is table-tested):

1. Drop everything *after* `index` (a new jump forks history, like a browser).
2. `from` (the location being left), when the document takes part:
   - list empty → push it;
   - **same document** as `entries[index]` but not near → **replace `entries[index]` with `from`**
     (the user moved away from where they arrived — Back must return to where they *left*, not where
     they *landed*);
   - **different document** (the user switched there without a recorded jump, e.g. tab-switch
     recording off) → push it.
3. If `to` is near `entries[index]` → replace it (no duplicate "jump to the same place").
4. Otherwise push `to`, trim the oldest beyond `limit`, set `index` to the end.
5. `to` undefined (jumped into an opted-out document) → only step 2 applies.

**`back()` rules:** capture the current location first.
- If it is **not in the document of `entries[index]`**, or there is none (an opted-out document is
  active), Back goes to `entries[index]` itself — "take me back to where I was".
- Otherwise, if it is not near `entries[index]`, replace that entry with it (so Forward returns
  here), then move to `index - 1`.
- `forward()` does the same same-document update, then moves to `index + 1`.

The prototype (`navigation-history-lab.html`, `class NavigationHistory` + `goBack`/`goForward`)
implements exactly these rules and is a usable source for the unit-test table.

**Debugger pauses never record (decided, §9).** A step or breakpoint hit moves the view but does not
call `recordJump`. The rules above already make that work:
- Pressing Back while paused somewhere else returns to the last recorded location, the place the
  user was before debugging.
- A Go to Definition from the paused location captures that location as `from`, in a different
  document from `entries[index]` or not near it. So Back from the definition returns to the line
  the debugger stopped on.

### 3.4 The service

`src/renderer/abstractions/INavigationHistoryService.ts` + `appIde/services/NavigationHistoryService.ts`,
added to `AppServices` (`abstractions/AppServices.ts`). It owns one `NavigationHistory` per project,
knows the adapters (via `documentPanelRegistry`), and is the only thing that talks to hubs.

```ts
interface INavigationHistoryService {
  /** Capture the current location (active hub, active doc), run the jump, capture the new one. */
  recordJump<T>(reason: NavigationReason, jump: () => Promise<T>): Promise<T>;
  captureCurrent(): NavigationEntry | undefined;
  goBack(): Promise<boolean>;
  goForward(): Promise<boolean>;
  goTo(index: number): Promise<boolean>;
  getEntries(): { entries: readonly NavigationEntry[]; index: number };
  clear(): void;
  readonly isRestoring: boolean;     // recordJump is a no-op while true
}
```

- **Re-entrancy:** while `goBack/goForward` restores, `isRestoring` is set, so the `nav`/reveal
  calls the adapter itself makes don't record new entries.
- **Stale entries:** if `adapter.restore` returns false (file deleted, NEX not loaded), the entry
  is removed and the service continues to the next one in that direction — one keypress never
  "does nothing".
- **Which area:** restore into `hubId` if that hub still exists; else into a hub where the
  document is already open; else the active hub.
- **UI state:** after every change dispatch `setNavigationHistoryStateAction({ canBack, canForward,
  version })` into `ideView` (`common/state/actions.ts`, `AppState.ts`, `ide-view-reducer.ts`) so
  the toolbar and the **main-process menu** (which reads the shared store) can enable/disable.
- **Lifecycle:** clear on `projectClosed`; `rekey` on `itemRenamed` and
  `DocumentHubService.renameDocument`; `remove` on `itemDeleted` (`IProjectService.ts:58-76`).
  Closing a document does **not** remove its entries — Back reopens it, as VS Code does.

## 4. Recording points

### 4.1 Source jumps — through `nav`

Add a named option to `NavigateToDocumentCommand`: `nav <file> [line] [col] [-r <reason>]`
(`namedOptions`, see `.ai/interactive-command-notes.md`). When `-r` is present the command wraps its
body in `navigationHistoryService.recordJump(reason, …)`. **Callers opt in explicitly**, so internal
uses (new project, explorer file creation) do not record by accident.

| Caller | File | Reason |
| --- | --- | --- |
| Monaco editor opener (definition / references / include) | `MonacoEditor.tsx:240-244` handler | `definition` |
| Output pane `@navigate` links | `ConsoleOutput.tsx:255-265` | `outputLink` |
| Breakpoints panel | `BreakpointsPanel.tsx:464` | `breakpoint` |
| Explorer open | `ExplorerPanel.tsx:202-208` | `explorer` (tab-switch setting, §4.4) |

**Not recorded:** the debugger pause call at `IdeEventsHandler.tsx:198` (`refreshCodeLocation`)
keeps calling plain `nav` without `-r`.

The dropped column was fixed in Phase 0: the editor opener passes Monaco's column to `nav`, so a
definition lands on the symbol.

### 4.2 Memory and Disassembly

- Register a `DocumentApi` in both panels (neither does today) with `getNavigationLocator` and
  `revealLocator`. `revealLocator` = set segment + full view, then the existing
  `handleGoToAddress` / `setToScroll` path.
- Wrap the **user-initiated** go-to handlers (`MemoryPanel.tsx:267`, `DisassemblyPanel.tsx:448-455`,
  including Go to PC) in `recordJump("memoryGoTo" | "disassemblyGoTo")`.
- **Never** record Follow PC ticks or `useDisassemblyRefresh` scrolls — those are the view following
  the machine, not the user jumping.

### 4.3 NEX debugging

- `StaticMemoryDump` extends its existing `revealAddress` into `getNavigationLocator` /
  `revealLocator` (keep `revealAddress` as a thin alias for the PC reveal).
- `NexAnnotationEditorController.goToDefinition` / label go-to / region go-to: wrap the
  `ports.navigateToAddress` and `ports.revealAddressInBank` calls → reason `nexLabel`. The
  controller stays pure: add a `ports.recordJump` port, faked in the controller tests.
- Viewer bank pop-out (`NexFileViewerPanel.tsx:441`, `:317`) → `nexBank`.
- `IdeEventsHandler.revealNexBankForPc` is **not recorded**: it is a debugger pause, like the source
  reveal.
- Adapter `reopen` data: `{ nexPath, bank, disassOffset, annotationPath }` — enough to rebuild the
  bank document from the `.nex` file after it was closed. `canReopen` = the file still exists.

### 4.4 Tab switches (setting)

Tab switches are recorded (decided, §9), as in VS Code. `SETTING_IDE_NAV_RECORD_TAB_SWITCH`
(default **on**, so users who find it noisy can turn it off) makes `setActiveDocument` calls originating from a tab click, the Open Editors panel
or the explorer record with reason `tabSwitch`. Hook at the *call sites*
(`DocumentsHeader.tsx:228-235`, `OpenEditorsPanel.tsx:44`), **not** inside `setActiveDocument`,
which also runs for restore, drag between areas and programmatic activation.

## 5. Commands, shortcuts, menu

| Command | Aliases | What |
| --- | --- | --- |
| `nav-back` | `nb` | Go Back |
| `nav-forward` | `nf` | Go Forward |
| `nav-history` | `nh` | Print the list, `>` marks the current entry |
| `nav-clear` | | Clear history |

In `appIde/commands/NavigationCommands.ts`, registered in `IdeCommands.ts`.

**Shortcuts** (settings `shortcuts.navigateBack` / `shortcuts.navigateForward`, defaults as VS Code):

| | macOS | Windows / Linux |
| --- | --- | --- |
| Back | `Ctrl+-` | `Alt+Left` |
| Forward | `Ctrl+Shift+-` | `Alt+Right` |
| Mouse | buttons 3 / 4 (`mouseup` in `IdeApp`, `app-command` `browser-backward/forward` on Windows) | same |

Monaco swallows keys: rebind through `editor.addCommand` exactly as `monacoDebugShortcuts.ts`
does for the F-keys. Check `Alt+Left/Right` against Monaco's word-navigation on Windows (Monaco
uses `Ctrl+Left` there, so no clash expected — verify).

**Menu:** a `Go` submenu in the IDE menu (`app-menu.ts` `IDE_MENU`, `:1069`): *Back*, *Forward*,
separator, *Clear Navigation History*. `enabled` from `ideView.navHistory.canBack/canForward`,
click → `executeIdeCommand(window, "nav-back", …)`.

## 6. UI

**Decided: Option A** (prototyped in `navigation-history-lab.html`).

- **Toolbar controls.** Back, a narrow history chevron, and Forward as `IconButton`s at the **start**
  of the IDE branch of `controls/Toolbar.tsx`, followed by a `ToolbarSeparator` and then the
  execution controls. Enabled state comes from Redux. Tooltips name the target
  ("Back to `main.asm` · line 42 (Ctrl+-)").
- **History list popover** (opened by the chevron; `nav-history` prints the same data): newest at
  top.
  - Rows: document icon, title, locator description, reason chip, one-line preview.
  - The current entry is marked with the accent. Entries *ahead* (Forward) are dimmed above it.
  - Click = `goTo(i)`.
  - Stale rows (can't reopen) are struck through and removed when visited.
  - The header has a Clear button; the footer shows the two shortcuts.

**Not chosen:** B (buttons in each document header) and C (a Navigation sidebar panel). C can be
reconsidered if the popover proves too transient.

Icons: add `arrow-left.svg`, `arrow-right.svg`, `history.svg` (Lucide, `currentColor`) to
`src/renderer/assets/icons/` — do **not** reuse `branch-back`/`branch-forward`, which mean
disassembly branch direction. Colours from tokens only (current entry `--accent-*`, reason chips
neutral). **Any style change updates `.ai/ui-theming-intent-and-lessons.md` in the same change.**

## 7. Persistence — deferred

**Decided (§9): history is session-only for now.** It lives in memory and is cleared when the project
closes. The sketch below is kept for when this is revisited; it is **not** part of any phase.

Save the history into `workspaceSettings.navHistory` next to `DOCS_WORKSPACE`
(`DocumentAreaGrid.tsx:330-375`), `{version: 1, index, entries}`, only entries whose adapter
`canReopen` and whose document is under the project folder (same filter as
`useDocumentWorkspacePersistence.ts:124-138`). Capped at 50. Restore after
`restoreLastOpenDocuments`.

Line drift (applies in-session too, so it stays in Phase 4): while a Monaco model is alive, attach a sticky decoration per text entry
(`model.deltaDecorations`, `TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges`) and read the
line back from it on restore; closed models fall back to the stored line.

## 8. Phases

### Phase 0 — prerequisites ✅ done
- **NEX bank id.** The mismatch was real (§2). New `DocumentPanels/Next/nexBankDocument.ts`
  (`nexBankDumpId`, `nexLayer2ScreenDumpId`) is used by `NexFileViewerPanel` (bank header pop-out,
  `MemoryDumpViewer` idFactory, Layer 2 pop-out), `IdeEventsHandler.revealNexBankForPc` and
  `StaticMemoryDump.revealAddressInBank`. The pop-out guard checks `fullPath` instead of
  `projectPath`.
  - **Left alone:** tab titles still differ by opener. The viewer uses the project path, the reveals
    the full path, and whichever opens the bank first names the tab. Unify them when the history
    list shows titles (Phase 2).
  - **Still quietly does nothing:** the in-row `MemoryDumpViewer` pop-out keeps its `projectPath`
    guard, so it does nothing for a NEX outside the project folder.
- **Column.** The position logic moved from `monacoBootstrap.getNavigationLine` to
  `monacoGlobals.getMonacoNavigationPosition`, which returns `{line, column?}`.
  `navigateMonacoToFile` and the navigation handler take an optional column.
  - `MonacoEditor` passes `column + 1` to `nav`. **`nav`'s column is one higher than Monaco's**: it
    subtracts one before `setPosition`, and output-pane links add one to match. Phase 1's recording
    must keep that convention, or fix both sides together.
  - The include-link path (`z80-providers.ts:1149`) still opens at line 1, with no column.
- **Tests:**
  - `NexFileViewerAnnotations.test.tsx` now expects the full-path id.
  - `MonacoEditorRefactor.test.ts` covers the position extraction, the column passing through the
    globals, and the bootstrap's editor opener.
  - The `test/renderer`, `test/controls` and `test/commands` suites pass (1838 tests).
  - `build:check` reports no new errors. `lint:renderer` shows no warnings on the changed lines.

### Phase 1 — model + service + text documents ✅ done

**What was built**

- **Types** (`src/renderer/abstractions/`): `NavigationLocation.ts` (locator, reason,
  `NAVIGATION_REASONS`, entry), `DocumentNavigationAdapter.ts`, `INavigationHistoryService.ts`.
  `DocumentApi.getNavigationLocator?`, `DocumentRendererInfo.navigation?`,
  `AppServices.navigationHistoryService`.
- **Model:** `appIde/navigation/NavigationHistory.ts` implements the §3.3 rules. Back and Forward
  are two steps, `prepareBack`/`prepareForward` then `moveTo`/`removeAt`, so the service can drop an
  entry it fails to restore.
- **Service:** `appIde/services/NavigationHistoryService.ts`.
  - It is constructed by `navigationHistoryServiceFactory.ts`, which is the only file that imports
    the panel registry.
  - It clears on `projectClosed`, re-keys on `itemRenamed` (folders too, by path prefix) and removes
    entries on `itemDeleted`.
  - It publishes `ideView.navHistory` (`NavigationHistoryState`, action `SET_NAV_HISTORY_STATE`) only
    when the state changes.
- **Text adapter:** `appIde/navigation/textNavigationAdapter.ts`, registered on `CODE_EDITOR` and
  `TEXT_EDITOR`. Two lines are the same place within ±10 lines. Restore makes the target area
  active, then runs `nav "<id>" line column+1`.
  - `MonacoEditor`'s API reports the live cursor position, or undefined once the editor is
    disposed.
- **`nav -r <reason>`:** a named option, validated against `NAVIGATION_REASONS`. The document
  activation and cursor move now live in a private `navigate()`, wrapped in `recordJump` when `-r` is
  given. The usage string became an array, which also fixed the `projeFile` typo.
- **Recording points:**
  - Monaco's editor opener (`-r definition`, which also covers `#include` links), output-pane links
    (`-r outputLink`) and the Breakpoints panel (`-r breakpoint`).
  - Tab clicks and the tab overflow list (`DocumentsHeader.tabClicked`) and `OpenEditorsPanel.activate`
    record `tabSwitch`.
  - `ExplorerPanel` single click, Enter/Space and double click record `explorer`.
- **Setting:** `SETTING_IDE_NAV_RECORD_TAB_SWITCH` (`ideBehavior.navRecordTabSwitches`, default on).
  It silences `tabSwitch` and `explorer`, and is also in the IDE menu under IDE Settings.
- **Commands** (`appIde/commands/NavigationCommands.ts`): `nav-back` (`nb`), `nav-forward` (`nf`),
  `nav-history` (`nh`), `nav-clear`. Having nowhere to go is a success with a message, not an error.

**Deviations from the design above**

- `DocumentNavigationAdapter` gained `capture(document, hub)`, used when the mounted view reports no
  position. `canReopen` was dropped: `restore` returning false covers it.
- The `reference` and `include` reasons were dropped. Both reach Klive through the same editor opener
  as a definition, so nothing can tell them apart.
- A jump nested inside a recorded jump is not recorded separately (`_recording` guard).

**Known limits, for Phase 2**

- **`canGoBack` can go stale.** It is computed when the history changes. Leaving the current entry's
  document without a recorded jump (a debugger pause, or the tab-switch setting off) does not
  republish it. The toolbar should recompute from the history plus `documentHubState` rather than
  trust the published flag alone.
- **Tab clicks in another area.** `DocumentAreaPane` activates the clicked area on pointer-down,
  before the click. So `from` for a tab click in another area is that area's active document, not
  the one the user was typing in.
- **Pre-existing, not caused by this work:** the status bar's `Ln/Col` is not updated when switching
  to a document whose restored cursor equals its saved one (no cursor-change event). A plain tab click
  shows it too.

**Verification**

- `test/navigation/NavigationHistory.test.ts` (21) and `NavigationHistoryService.test.ts` (14, with
  the text adapter).
- `test/commands/NavigationCommands.test.ts` (6).
- `nav -r` cases in `test/commands/DocumentCommands.test.ts`, and `-r outputLink` in
  `test/controls/ConsoleOutput.test.tsx`.
- Existing mocks gained `navigationHistoryService` (`mock-context.ts`, `ExplorerPanelDialogs`,
  `EffectCleanup`, `OpenEditorsPanel`, `ProviderHooks`).
- Full suite: 21754 passed. `build:check`: no new errors. `lint:renderer`: nothing new on changed
  lines. `electron-vite build` succeeds.
- **Driven in the running app** with `scripts/doc-shots/harness.cjs`, from a throwaway script that is
  not committed.
  - Three `nav` jumps, then `nav-history`, then Back ×3 (the third a no-op), Forward ×2, a tab
    click, then Back.
  - Every step landed on the right tab, and the editor's active line number matched.

### Phase 2 — shortcuts, menu, toolbar UI ✅ done

**What was built**

- **Shortcuts.** `src/common/utils/navigationShortcuts.ts`, shared by the main process and the
  renderer, holds:
  - the VS Code defaults;
  - `readNavigationShortcuts` (user/project settings `shortcuts.navigateBack` /
    `shortcuts.navigateForward`, read through `SettingsReader`, so the two scopes merge shallowly as
    for the stepping shortcuts);
  - an Electron-accelerator parser and `matchesAccelerator`. It matches by `KeyboardEvent.code`
    ("-" with Shift arrives as key "_") and requires exactly the accelerator's modifiers.
- **Who handles the key.** `features/navigation/useNavigationShortcuts.ts`, mounted in `IdeApp`,
  listens on `window` in the capture phase. It handles the key before Monaco or any input sees it and
  calls `preventDefault`, which is what keeps Electron from also running the menu accelerator (the
  page gets first refusal on a key). It also handles mouse buttons 3/4 on `mouseup` and suppresses
  their `mousedown` default. No `editor.addCommand` rebinding was needed.
- **Menu.** A `Go` submenu in the IDE menu (`app-menu.ts`): Back, Forward, and Clear Navigation
  History.
  - Accelerators come from `readNavigationShortcuts`; enabled state from `ideView.navHistory`.
  - The accelerator is what makes the shortcut work while the emulator window has focus.
- **Keeping availability current.** `NavigationHistoryService` now also:
  - re-publishes when `ideView.documentHubState` changes, which fixes Phase 1's stale `canGoBack`
    for the menu. Dispatches only on a real change, so it cannot loop.
  - offers `canGoBack()`, `canGoForward()`, `peekBack()`, `peekForward()` (backed by
    `NavigationHistory.peekBack`) and `preview(entry)`.
  - `DocumentNavigationAdapter` gained an optional `preview`. The text adapter reads the line from
    the cached document contents.
- **Toolbar (Option A).** `features/navigation/NavigationControls.tsx` renders Back, a 12px chevron
  and Forward at the start of the IDE toolbar, then a separator.
  - Enabled state and tooltips come live from the service ("Back to beta.asm · line 40 (⌃-)").
  - Icons: `arrow-left.svg`, `arrow-right.svg` (Lucide); `history.svg` was added but is unused.
- **History popover.** `features/navigation/NavigationHistoryPopover.tsx` and
  `NavigationControls.module.scss`.
  - Layout: newest first. The current row is marked with the accent, rows ahead are dimmed, and each
    row shows the document icon, title, position, preview line and a reason chip.
  - Header: title, count and a Clear button. Footer: both shortcuts.
  - Keyboard: focus starts on the current row; arrows move, Enter chooses, Escape closes. A press
    outside also closes it.
  - The rules it follows are recorded in `.ai/ui-theming-intent-and-lessons.md` ("A Menu-Like List
    With A Header", and a row in Settled Intent).
- **Phase 0 leftover.** `nexBankDumpTitle` / `nexLayer2ScreenDumpTitle` give every opener of a NEX
  bank the same tab title: project-relative inside the project, full path otherwise.

**Verification**

- **New tests:**
  - `test/common/navigationShortcuts.test.ts` (7).
  - `test/navigation/NavigationControls.test.tsx` (13): tooltips, disabled states, back/forward,
    popover order, marks and focus, choosing, arrow keys and Escape, outside press, Clear; the hook's
    capture-phase handling and `defaultPrevented`; mouse buttons; a configured shortcut;
    `formatAccelerator`.
  - `test/navigation/nexBankDocument.test.ts` (4).
  - `NavigationHistoryService.test.ts` gained live availability, republish-on-activation and
    text-preview cases.
- **Existing tests updated:** the toolbar tests (`test/controls/ToolbarDocumentPanels.test.tsx`,
  `test/phase8/Toolbar.test.tsx`) mock `NavigationControls`.
- **Checks:** full suite passes; `build:check` reports no new errors; `lint:renderer` shows nothing new
  in touched files; `electron-vite build` succeeds.
- **Driven in the running app** with a throwaway harness script, in dark and light themes. After three
  jumps:
  - toolbar tooltips named the right targets and Forward was disabled;
  - toolbar Back landed on beta.asm:40;
  - the popover listed three rows with the current one marked and previews shown, and choosing the
    oldest landed on alpha.asm:5 and closed it;
  - with focus in Monaco, `⌃⇧-` and `⌃-` moved forward and back without typing into the editor.
  - Screenshots of the popover in both themes were reviewed.

**Not verified in the app**

- Playwright's key events are synthetic, so they do not reach native menu accelerators. That the
  accelerator does not fire *in addition* to the renderer handler rests on Electron's
  page-first key routing, the same routing the existing F10/F11 Monaco bindings rely on. The service's
  `_restoring` guard also drops a second trigger that arrives while a restore is running. **Check
  once by hand on macOS and Windows.**
- The mouse side buttons (Playwright cannot press them) are covered by the jsdom test only.
- The Go menu itself (native menu) has no automated test.

### Phase 3 — Memory, Disassembly, NEX ✅ done

**What was built**

- **Adapter contract.** `NavigationLocator`'s address kind gained `base` (a dump's disassembly
  offset). `DocumentApi` gained `revealLocator`. `DocumentNavigationAdapter.restore` takes a fourth
  argument, `NavigationAdapterEnvironment` (`store`, `readBinaryFile`); the factory builds
  `readBinaryFile` from the renderer messenger through `createMainApi`.
- **Adapters** (`appIde/navigation/addressNavigationAdapters.ts`):
  - `memoryNavigationAdapter` and `disassemblyNavigationAdapter`. Same place = same segment and 64K
    switch, within $100 (memory) or $80 (disassembly). Capture falls back to the saved view state
    (`topIndex × bytes per row`, `topAddress`). Restore makes the area active, runs `show-memory` /
    `show-disass`, and calls `revealLocator` once the view registers its API.
  - `createStaticDumpNavigationAdapter({ openStaticMemoryDump, readNexBankBytes })`. Same place =
    within $40, whichever listing. An open dump gets its view state pointed at the address first
    (a view that mounts reads it once), is activated, then revealed. A closed dump is reopened only
    if it is a NEX bank: path and bank are parsed from its id (`memoryDump-bankDump<path>:<bank>`),
    the bank bytes re-read from the `.nex`, and the bank reopened at `base`, the address and the
    listing. Other dumps cannot be reopened, so their entries are dropped.
  - `fileDocumentNavigationAdapter` (`kind: "document"`, restored through `nav`) is on `NEX_VIEWER`,
    so Back from a popped-out bank returns to the viewer.
  - Registered in `registry.ts` on `MEMORY_EDITOR`, `DISASSEMBLY_EDITOR`,
    `STATIC_MEMORY_DUMP_VIEWER` and `NEX_VIEWER`.
  - `nexBankReveal.ts` exports `readNexBankBytes`, the existing cached reader.
- **Views.** `MemoryPanel`, `DisassemblyPanel` and `StaticMemoryDump` register
  `getNavigationLocator` / `revealLocator`. Where the view is lives in refs set synchronously by
  jumps and by scroll-end, because the history captures `to` before any state has rendered.
  - A jump's exact address is kept while its row is still the top one.
  - `DisassemblyPanel`'s reveal turns Follow PC **off** and waits for the listing to be rebuilt
    (keyed on `refreshVersion`). If an in-flight Follow PC refresh lands first without covering the
    address, it waits one more refresh.
- **Recording points:**
  - Memory Go To (`memoryGoTo`).
  - Disassembly Go To and Go to PC (`disassemblyGoTo`).
  - The dump's memory Go To, disassembly Go To and Go to PC.
  - NEX viewer bank and Layer 2 pop-outs (`nexBank`, through `MemoryDumpViewer.openThrough` and the
    viewer's own pop-out).
  - The annotation editor's Go to Definition (same bank and other bank) and Go To in the Labels and
    Regions lists (`nexLabel`).
- **Not recorded, by design:** Follow PC and `IdeEventsHandler.revealNexBankForPc`, which move the
  view but never call `recordJump`.

**Deviations from the design**

- **No `ports.recordJump`.** The annotation editor's jumps are recorded where `StaticMemoryDump` hosts
  the editor (`navigateToAddressRecorded`, `revealAddressInBankRecorded`). The controller and its
  ports are unchanged, and all three of its navigations are the user going somewhere.
- **Reasons.** Region Go To uses the `nexLabel` reason; there is no separate region reason.

**Bugs found by driving the app**

- **`IDocumentHubService.waitOpen` doesn't work for these views.** It resolves to the document from
  the *project file cache*, so it answers `undefined` for Memory, Disassembly and dumps even when
  they are open with an API. The first version of every address restore failed, and the entry was
  dropped. `revealWhenMounted` now polls `isOpen` + `getDocumentApi(...).revealLocator` itself
  (5s timeout).
- **`nav` held every jump to an API-less viewer for the full 5s timeout.** It always waited for a
  document API, and the NEX file viewer registers none. It now waits only when it has a line to
  move to, which also speeds up plain `nav "<file>"` everywhere.

**Verification**

- **New:**
  - `test/navigation/addressNavigationAdapters.test.ts` (15): capture from view state, near rules,
    describe, restore into the chosen area, waiting for a late API, the timeout, open-dump restore
    in this and another area, closed NEX bank reopen with exact arguments, non-NEX / missing bank /
    read failure, id parsing, the file-document adapter.
  - Panel tests added to existing suites:
    - `MemoryPanelRefactor`: Go To recorded and `to` = the new address; reveal scrolls; API
      unregistered on unmount.
    - `DisassemblyPanelRefactor`: Go To recorded; reveal turns Follow PC off and scrolls after the
      rebuild; Follow PC ticks not recorded.
    - `StaticMemoryDump`: Go To recorded with `base`; reveal switches listing; Labels Go To recorded
      as `nexLabel` at `disassOffset + value`.
    - `NexFileViewerAnnotations`: the pop-out is recorded as `nexBank`.
    - `DocumentCommands`: `nav` waits for the API only with a line.
- **Checks:** full suite 21804 passed; `build:check` no new errors; `lint:renderer` at the same 44
  warnings as before; `electron-vite build` succeeds.
- **Driven in the running app** (throwaway harness script, with a copy of
  `_experiments/testprojects/disann/ScrollNutter.nex`):
  - Memory: Go To $5B00 → Back to $0000 → Forward to $5B00; then `hide-memory`, and Back reopened
    Memory at $5B00.
  - NEX: opened the viewer and popped out bank 5 → Back to the viewer → Forward to the bank; then
    closed the bank tab, and Back reopened bank 5 from the file at $4000 in disassembly view.

**Not verified in the app**

- Cross-bank Go to Definition needs a running NEX program, so it is covered only through the
  controller's existing tests plus the recording wrapper.
- The Disassembly panel restore was covered by jsdom only.

### Phase 4 — polish ✅ done

**Line drift**

- `DocumentNavigationAdapter` gained two optional hooks: `track(entries)` and `resolve(entry)`.
  - `NavigationHistoryService.syncTracking` runs on every publish (every history change and every
    document activation) and hands each tracking adapter all entries of its type.
  - `resolved(entry)` is used for near-checks, `describe`, `preview` and `restore`. So "the same
    place", the history list and Back all see where the code is now.
- `createTextNavigationAdapter({ getModel })` (`textNavigationAdapter.ts`) follows each text entry
  with a point decoration (`stickiness: NeverGrowsWhenTypingAtEdges`) while the file has a Monaco
  model.
  - The editor keeps models across tab switches (`keepCurrentModel`), so every file opened this
    session is covered. Line and column are clamped into the model.
  - Entries that leave the history lose their decoration.
  - On `onWillDispose`, positions are written back into the entries.
  - A model that appears later (the file is opened) starts being followed at the next sync.
  - `preview` reads the live model, unsaved edits included.
- `monacoTextModels.getMonacoTextModel` finds the model as `Uri.parse(documentId)`, the name
  `@monaco-editor/react` gives it. It takes Monaco from `loader.__getMonacoInstance()` rather than
  importing `monaco-editor`: the registry imports it, and a static import broke
  `AppShellStartup.test.tsx` (jsdom cannot load Monaco). One adapter instance is shared by
  `CODE_EDITOR` and `TEXT_EDITOR`, since it holds the tracking state. `textNavigationAdapter` (no
  model lookup) remains for tests.
- **Behaviour to know:** moving the cursor within a document before leaving it still replaces the
  current entry with where you left (§3.3). Drift applies to entries you are *not* sitting on.

**Docs and changelog**

- New page `docs/content/working-with-ide/navigation.mdx` ("Navigating Back and Forward"), added to
  `_meta.ts` after Editing Code. It covers shortcuts, toolbar, menu, commands, the history list,
  what is and is not remembered (debugger stops, Follow PC), line drift, reopening closed
  documents, dropped places, and the tab-switch setting and shortcut settings (`set -u`).
- `commands-reference.mdx`: `nav` usage fixed (`projectFile`, `-r reason` with the reason list);
  new `nav-back`, `nav-forward`, `nav-history`, `nav-clear` sections. `editing-code.mdx` links the
  include-file jump to the new page.
- `.plans/docs-routes.golden.txt` gained only `/working-with-ide/navigation/index.html`.
  `/contribute/wasm-toolchain/index.html` was already missing from it before this work and is left
  for whoever owns that page.
- `CHANGELOG.md` (Unreleased):
  - Features: Go Back / Go Forward.
  - Fixes: the NEX bank open twice (Phase 0), Go to Definition dropping the column (Phase 0), `nav`
    taking five seconds for viewers without an editor API (Phase 3).

**Verification**

- `test/navigation/textLineDrift.test.ts` (9), with a fake model that moves decorations on
  insert/delete:
  - following insertions and deletions above the entry, and nothing for lines after it;
  - no model → the recorded line; a model that appears later; clamping;
  - untracking removes decorations; dispose writes back; preview from the live model;
  - service level: describe and Back use the moved line, and near-checks use it too.
- Full suite 21813 passed; `build:check` no new errors; `lint:renderer` 44 warnings (unchanged);
  `electron-vite build` succeeds; `doc:build` succeeds; `doc:check` links and highlighting OK, routes
  OK apart from the pre-existing wasm-toolchain note.
- **Driven in the running app** (throwaway harness script), after the loader change too:
  - recorded `alpha.asm:50` → `beta.asm:10`;
  - opened alpha without recording and typed five new lines at its top, then returned to beta;
  - `nav-history` listed alpha at **line 55**, and `nav-back` landed on alpha line 55.

## 9. Decisions

| # | Question | Decision |
| --- | --- | --- |
| 1 | Global or per-area history | **Global**, one history for the IDE; the area is only a restore hint (§3.4). |
| 2 | Debugger stepping | **No entries for pauses** (source reveal or NEX bank reveal). Go to Definition — Monaco and NEX labels — **is** recorded. |
| 3 | Tab switches | **Recorded**, default on, behind a setting (§4.4). |
| 4 | Placement | **Option A**: toolbar controls with a history popover (§6). |
| 5 | Persistence | **Not yet**: session-only (§7). |
| 6 | Shortcuts | **VS Code**: macOS `Ctrl+-` / `Ctrl+Shift+-`; Windows/Linux `Alt+Left` / `Alt+Right` (§5). |

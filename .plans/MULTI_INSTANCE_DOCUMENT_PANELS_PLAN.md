# Multi-Instance Document Panels Plan

## Goal

Make document renderers that were built around one visible instance safe and predictable in a multi-document-area workspace. Each visible instance must own its view state through its document hub, while machine data remains shared. Toolbar and command behavior must target the active document area instead of inferring global panel visibility.

## Current Findings

- `DocumentHubService` already stores view state by document ID per hub. This is the correct ownership boundary for separate Memory, Disassembly, BASIC, and file-viewer instances.
- The Memory, Disassembly, and BASIC panels also read and write type-wide workspace keys (`Memory`, `Disassembly`, and `Basic`). Those writes make the last changed instance become the default for every other instance.
- Their persistence helpers call `saveActiveDocumentState`, even though the renderer already receives its document. A direct `setDocumentViewState(document.id, state)` is safer and makes ownership explicit.
- Multi-area workspace persistence can serialize a per-hub `viewState`, but it currently excludes special documents because their IDs (`$memory`, `$disassembly`, `$basic`) are not project paths. Restoration currently reopens only code editors.
- The Memory and Disassembly toolbar buttons are selected from the global `ideView.volatileDocs` map. This cannot represent whether the active hub, another hub, or several hubs contain a panel.
- `show-memory`, `hide-memory`, `show-disass`, `hide-disass`, and the matching main-to-IDE messages operate on the active hub, which is the right command target. Their global volatile-state updates are the inconsistent part.

## Recommended Semantics

- A toolbar button means **show or hide this panel in the active document area**. It is selected only when that document is open in the active hub. A copy in another area does not affect the button state.
- `show-*` is idempotent for the active hub: it activates an existing tab there, otherwise opens one. `hide-*` closes only the active hub's copy.
- Memory, Disassembly, and BASIC have fully per-view state: scroll location, bank/segment, display options, refresh mode, and filters. Splitting clones the source state once; subsequent changes stay independent.
- Live emulator contents, breakpoints, compilation data, and project file contents remain shared and refresh every applicable instance.
- Persist special document tabs and their `viewState` per area in `docsWorkspace`. During migration, a legacy type-wide workspace value may seed a missing state once; it must never remain a live synchronization channel.

## Scope

Primary panels:

- `Memory` (`$memory`)
- `Disassembly` (`$disassembly`)
- `BASIC Listing` (`$basic`)

Audit in the final slices:

- Static memory dumps, command results, script output, and file viewers that accept a `viewState`.
- Renderers or controls that resolve `projectService.getActiveDocumentHubService()` instead of their provider hub.
- Other global UI state keyed only by a document ID, especially volatile-document and toolbar state.

## Implementation Steps

### 1. [Completed] Characterize Multi-Instance Behavior Before Changing It

Add narrowly scoped tests that open the same special document ID in two hubs and exercise independent state changes.

- Use lightweight hub fakes for view-state tests and existing panel harnesses where interaction coverage is useful.
- Document the expected split behavior: initial state copied, later changes isolated.
- Capture the command target rule: show/hide affects only the active hub.

Acceptance:

- Tests demonstrate the current global workspace-key collision.
- Tests describe the desired per-hub state and active-hub command behavior before implementation begins.

Tests:

- Extend `test/controls/MemoryViewState.test.tsx`.
- Extend `test/controls/DisassemblyViewState.test.tsx`.
- Add a focused BASIC view-state test file or extend its panel test.
- Extend `test/commands/ToolCommands.test.ts`.

### 2. [Completed] Centralize Special Document Definitions

Create a small, pure special-document descriptor module for Memory, Disassembly, and BASIC.

- Define each stable ID, renderer type, title, icon metadata, and whether it is workspace-restorable.
- Expose `createSpecialDocument(id)` and an `isWorkspaceRestorableDocument(document)` predicate.
- Replace repeated document literals in `ToolCommands` and `MainToIdeProcessor` with this descriptor.

Acceptance:

- All entry points construct the same special document metadata.
- Unknown volatile documents are not accidentally persisted or restored.

Tests:

- Descriptor creation and lookup tests.
- Existing tool-command tests continue to verify document metadata.

### 3. [Completed] Make Special-Panel Presence Hub-Aware

Replace the global volatile-document flag as the Memory/Disassembly toolbar source of truth.

- Add a small selector/helper that checks `projectService.getActiveDocumentHubService().isOpen(documentId)` and refreshes from that hub's version.
- Keep `volatileDocs` only where it is still genuinely global, or remove the two special-panel entries after consumers migrate.
- Make the toolbar selected state and tooltip wording reflect the active-area semantics.

Acceptance:

- Opening Memory in area A selects its button only while A is active.
- Switching to area B where Memory is absent clears the selected state without closing A's tab.
- Closing Memory in A does not affect a copy in B.

Tests:

- Add an isolated Toolbar test with two hubs.
- Test active-area switching and active-hub-only toggle behavior.

### 4. [Completed] Align Commands And Main-to-IDE Messages With The Active Hub

Update `show-memory`, `hide-memory`, `show-disass`, `hide-disass`, and `showBasic`/related IPC handlers to use the special-document descriptor and only the active hub.

- Remove global `setVolatileDocStateAction` updates for these panels.
- Await close/open operations in message handlers where ordering matters.
- Preserve idempotent show behavior and avoid closing a matching tab in another hub.

Acceptance:

- Toolbar, command palette, scripts, and main-process notifications use the same target semantics.
- Multiple hubs may contain the same special document ID concurrently.

Tests:

- Command tests with active and inactive hub fakes.
- Processor tests for show/hide operations.

### 5. [Completed] Move Memory View State Fully To The Rendered Document Hub

Refine `MemoryPanel` and `useMemoryViewState` so the panel uses only its own document's per-hub state at runtime.

- Pass the document ID to persistence and use `setDocumentViewState(document.id, state)`.
- Remove live reads/writes of `workspaceSettings[MEMORY_EDITOR]`.
- Preserve the existing debounce, cleanup, project-save, and refresh behavior.
- Keep a one-time legacy-state input only for migration, not normal rendering.

Acceptance:

- Two Memory views may hold different top rows, bank selections, and display options without overwriting each other.
- Splitting copies state once and later changes stay independent.

Tests:

- Persistence writes the explicit document ID in the supplied hub.
- Two hub fakes receive different payloads.
- No global memory workspace setting is dispatched after migration.

### 6. [Completed] Move Disassembly View State Fully To The Rendered Document Hub

Apply the same pattern to `DisassemblyPanel` and `disassemblyViewState`.

- Use the document ID for saving state.
- Remove live `workspaceSettings[DISASSEMBLY_EDITOR]` fallback and writes.
- Keep machine data shared while top address, Follow PC/refresh options, bank choice, number format, and display filters are per view.

Acceptance:

- Two Disassembly views can follow different addresses/banks and retain their own options.
- Updating one view does not alter the other view's persistence payload.

Tests:

- Explicit-document state writes and two-hub isolation.
- Existing scroll-debounce and unmount-cleanup coverage remains green.

### 7. [Completed] Move BASIC View State Fully To The Rendered Document Hub

Give BASIC the same explicit per-hub ownership.

- Use the document prop and `setDocumentViewState` rather than the active-document shortcut.
- Remove live `workspaceSettings[BASIC_EDITOR]` fallback and writes.
- Preserve shared emulator refresh data while top row and display options are per view.

Acceptance:

- Two BASIC listings can scroll and configure display options independently.
- A background/inactive hub never receives state intended for another view.

Tests:

- Add a BASIC persistence harness with two hubs.
- Verify state-copy-on-split and later independent updates.

### 8. [Completed] Persist And Restore Special Documents Per Area

Extend multi-area workspace persistence so the supported special documents are serialized with their per-hub view state and restored through the descriptor module.

- Update `createDocumentAreaWorkspace` to include project files plus explicitly workspace-restorable special documents.
- Update `restoreLastOpenDocuments` to reopen those descriptors in each saved area and apply the saved `viewState` before activation.
- Migrate legacy Memory/Disassembly/BASIC workspace values only when a restored special document has no saved state; after the next save, retain only the per-area payload.
- Keep command results, static dumps, and arbitrary volatile documents out unless the audit gives them an explicit persistence contract.

Acceptance:

- A workspace with two Memory or Disassembly views restores both areas with their own state.
- Existing project-file workspace restoration remains compatible.
- Legacy single-area workspace data migrates without losing the user's last view settings.

Tests:

- Workspace payload includes only approved special documents.
- Restore recreates special documents in the correct hubs with independent state.
- Migration tests cover legacy workspace values and a multi-area saved payload.

### 9. [Completed] Audit Remaining Document Renderers And Global UI Assumptions

Review every `documentPanelRegistry` renderer and supporting control for hidden single-instance coupling.

- Search for `getActiveDocumentHubService`, `saveActiveDocumentState`, module-level mutable renderer state, and type-wide workspace view-state keys.
- For each result, classify it as shared domain data, per-view state, global preference, or intentionally singleton UI.
- Convert per-view findings to explicit document-ID hub state; keep shared machine/project data shared.
- Record deferred items in this plan with a reason and test gap.

Acceptance:

- No visible document renderer silently persists per-view state through a global type-wide key.
- The audit leaves an explicit list of intentional shared state.

Tests:

- Add focused tests only for discovered behavior changes.
- Run the renderer's existing focused suite after each small conversion.

### Audit Results

- Converted GenericViewer, Command Result, Script Output, and Image Viewer state saves from the active-document shortcut to their rendered document ID.
- Converted the SCR viewer and embedded memory/screen dump controls to use their document-hub provider when opening another document.
- Generic file editors/viewers, TAP/DSK viewers, and the special panels already use explicit document IDs and per-hub state.
- Explorer, toolbar, status bar, and document-area layout code intentionally use the active hub because they control the active area rather than render a document view.
- Static memory dumps, command results, and script outputs intentionally remain non-restorable: their data comes from transient output or a non-durable snapshot and has no safe workspace persistence contract.
- No remaining visible document renderer uses `saveActiveDocumentState` or a type-wide workspace view-state key.

### 10. [Completed] Integration Verification And Manual Matrix

Exercise the actual multi-area workflow after the focused changes land.

Manual checks:

- Open Memory, Disassembly, and BASIC; split each; change a distinct option and position in each area.
- Toggle Memory/Disassembly from the toolbar after changing the active area.
- Invoke show/hide through commands and main-process notifications with duplicate instances open.
- Restart with multiple special panels open and verify area placement and state restoration.
- Close one instance and verify the remaining instance continues refreshing normally.

Verification:

- Focused Memory, Disassembly, BASIC, command, toolbar, workspace, and document-area tests.
- `npm run lint:renderer`
- `npm run build:check`
- `npx electron-vite build --config build/electron.vite.config.ts`

## Suggested Delivery Order

1. Characterization tests and special-document descriptor.
2. Hub-aware toolbar state and active-hub commands.
3. Memory, then Disassembly, then BASIC per-view persistence.
4. Workspace persistence/restoration migration.
5. Broader renderer audit and manual integration matrix.

## Definition Of Done

- Multiple visible instances of Memory, Disassembly, and BASIC never overwrite each other's view state.
- Toolbar buttons accurately describe and control the active document area only.
- Commands and IPC do not close or activate a panel in another area.
- Approved special panels restore per-area state after restart.
- All remaining shared state is intentional, documented, and covered by focused tests.

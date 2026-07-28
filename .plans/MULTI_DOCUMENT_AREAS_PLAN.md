# Multiple Document Areas Plan

## Goal

Add VS Code-style document areas to Klive IDE so users can work with more than one tab group at a time. A document can be opened in more than one area, giving each area its own view state, cursor/scroll position, and active tab while sharing the underlying file contents and dirty state.

## Current Architecture Notes

- `ProjectService` already supports multiple `DocumentHubService` instances through `createDocumentHubService`, `getDocumentHubServiceInstances`, `setActiveDocumentHubService`, and `closeDocumentHubService`.
- `DocumentHubService` already owns per-hub open tabs, active tab index, renderer APIs, and document view state.
- `ProjectDocumentState` instances are shared through the project service cache, and `usedIn` tracks which hubs reference a document. This is a good fit for shared contents plus multiple views.
- `DocumentArea` currently renders only `projectService.getActiveDocumentHubService()`.
- `DocumentsHeader` and `DocumentsContainer` already consume the hub from `DocumentHubServiceProvider`, so they can mostly be reused once `DocumentArea` receives an explicit hub.
- `MonacoEditor` currently reads `projectService.getActiveDocumentHubService()` when saving/restoring view state and edit position. That will be wrong when a non-active or newly focused area renders the same document.
- Workspace persistence currently stores one `docsWorkspace` tab list and active document. It needs a compatible multi-area format with migration from the existing single-area payload.

## Product Shape

Initial feature set should match the core editor-group workflow:

- Split active document area right and down.
- Open the active document into a new area, preserving shared file contents but starting with an independent view state.
- Move the active tab to another area.
- Move a tab by dragging it from one tab strip to another.
- Activate an area when its header, tab, or document body receives focus.
- Close a tab in an area, close all tabs in an area, and remove empty areas while keeping one empty-capable root area alive.
- Restore the document area layout after restart.

Defer these until the core is stable:

- Arbitrary nested drag-to-edge area creation.
- Splitting left/up as first-class commands if right/down plus move commands cover the first workflow.
- Pinned tabs, editor group locking, and preview-tab configuration.
- Moving entire areas around without moving their tabs.

## Data Model

Introduce a small layout model independent of React component state:

```ts
type DocumentAreaId = string;

type DocumentAreaLayout =
  | {
      type: "leaf";
      areaId: DocumentAreaId;
    }
  | {
      type: "split";
      direction: "horizontal" | "vertical";
      first: DocumentAreaLayout;
      second: DocumentAreaLayout;
      size?: string;
    };
```

Keep each leaf associated with exactly one `IDocumentHubService`. The layout model controls placement; the hub controls tabs and active document state.

Persist a versioned workspace payload:

```ts
type DocumentAreasWorkspaceV2 = {
  version: 2;
  layout: SavedDocumentAreaLayout;
  areas: Record<DocumentAreaId, SavedDocumentArea>;
  activeAreaId?: DocumentAreaId;
};

type SavedDocumentArea = {
  hubId?: number;
  documents: SavedDocumentInfo[];
  activeDocumentId?: string;
};
```

Migration rule: if `docsWorkspace` has the existing `{ documents, activeDocumentId }` shape, restore it into one leaf area.

## Implementation Slices

### 1. [Completed] Pin Existing Hub Behavior With Tests

Add focused `DocumentHubService` tests for behavior the feature will rely on:

- The same document can be opened in two hubs.
- Closing a document in one hub keeps it cached while another hub still uses it.
- View state for the same document ID is independent per hub.
- Document APIs for the same document ID are independent per hub.
- Closing the last tab in a non-last hub requests hub closure.

Acceptance:

- No behavior changes yet.
- Tests document current multi-hub semantics before UI work starts.

Tests:

- `npm test -- --project node test/controls/DocumentHubService.test.ts`
- `npm run build:check`

### 2. [Completed] Make DocumentArea Render An Explicit Hub

Change `DocumentArea` from "always render the active hub" to "render the hub passed by props", with a small wrapper preserving current behavior.

Targets:

- `src/renderer/features/documents/DocumentArea.tsx`
- `src/renderer/appIde/IdeApp.tsx`
- Existing `DocumentArea` tests or a new `DocumentArea` test

Suggested shape:

- Add `DocumentAreaView` or `DocumentAreaPane` that receives `hub: IDocumentHubService`.
- Keep `DocumentArea` as a temporary compatibility component that resolves the active hub and renders one `DocumentAreaPane`.
- Activate the passed hub on pointer/focus inside the pane, but keep this behavior narrowly tested.

Acceptance:

- Current single-area UI behaves unchanged.
- `DocumentsHeader` and document renderers receive the correct hub via `DocumentHubServiceProvider`.
- Focus/click in a rendered area makes that hub the active hub.

Tests:

- Render a pane with a provided hub and verify header/container use that hub.
- Verify clicking or focusing a pane calls `projectService.setActiveDocumentHubService`.
- `npm test -- --project jsdom test/controls/DocumentArea.test.tsx`
- `npm run lint:renderer`
- `npm run build:check`

### 3. [Completed] Move Monaco View-State Writes To The Hub Context

Fix editor panels that still use the active project hub instead of the rendered hub.

Primary target:

- `src/renderer/features/editor/monaco/MonacoEditor.tsx`

Work:

- Use `useDocumentHubService()` inside `MonacoEditor`.
- Save view state through the context hub.
- Restore view state through the context hub.
- Save edit position through the context hub.
- Keep file content save operations on `projectService`.

Acceptance:

- Two views of the same Monaco document can keep different scroll/cursor view state.
- Saving the file still updates the shared document contents and dirty counts.

Tests:

- Extend Monaco editor mocks to assert view state is saved/restored against the provider hub, not `projectService.getActiveDocumentHubService()`.
- `npm test -- --project node test/controls/MonacoEditorRefactor.test.ts`
- `npm run lint:renderer`
- `npm run build:check`

### 4. [Completed] Add A Document Area Layout Reducer

Create pure helpers for area layout changes before wiring UI.

Suggested file:

- `src/renderer/features/documents/documentAreaLayout.ts`

Helpers:

- `createSingleAreaLayout(areaId)`
- `splitArea(layout, targetAreaId, newAreaId, direction, placement)`
- `removeArea(layout, areaId)`
- `findAreaIds(layout)`
- `getAdjacentAreaId(layout, areaId, direction)` if needed for move commands
- `normalizeDocumentAreaLayout(layout)` to collapse empty split parents

Acceptance:

- Layout operations are pure and independently testable.
- Removing a leaf collapses the parent split.
- The last remaining leaf is never removed by the pure helper.

Tests:

- New focused reducer/helper test file.
- `npm test -- --project node test/controls/DocumentAreaLayout.test.ts`
- `npm run build:check`

### 5. [Completed] Render Multiple Areas With Existing SplitPanel

Introduce a `DocumentAreaGrid` that renders the layout tree recursively.

Targets:

- `src/renderer/features/documents/DocumentAreaGrid.tsx`
- `src/renderer/features/documents/DocumentArea.tsx`
- `src/renderer/features/documents/DocumentArea.module.scss`
- `src/renderer/appIde/IdeApp.tsx`

Work:

- Keep one initial area using the existing active hub.
- Use `SplitPanel` for split nodes.
- Render `DocumentAreaPane` for leaf nodes.
- Track `areaId -> hub` in a small hook local to the grid.
- Create a new hub only when a split operation creates a new leaf.

Acceptance:

- With one leaf, the UI is visually equivalent to today.
- With a test-provided two-leaf layout, two independent tab strips render.
- Focusing either pane activates its hub.

Tests:

- `DocumentAreaGrid` renders one and two leaves.
- A supplied right-side hub is passed to its rendered pane.
- `npm test -- --project jsdom test/controls/DocumentAreaGrid.test.tsx`
- `npm test -- --project jsdom test/controls/DocumentArea.test.tsx`
- `npm run lint:renderer`
- `npm run build:check`

### 6. [Completed] Implement Split Active Area Right And Down

Add command/service methods that split the active area and open the active document in the new area.

Work:

- Add grid API methods and document header buttons for "Split Right" and "Split Down".
- For each split, create a new hub, insert it into the layout, and open the current active document in the new hub.
- Copy the current hub view state for the active document into the new hub as the initial view state.
- Activate the new area after the split.

Acceptance:

- Splitting a source file produces two views of the same document.
- Editing in either view updates the same dirty state.
- Cursor/scroll changes after the split remain independent.
- Splitting an empty area creates an empty area without errors, or is disabled. Pick one behavior and test it.

Tests:

- Split right creates a second hub and opens the same document.
- Split down creates a vertical split.
- Initial view state is supplied to the new hub.
- `npm test -- --project jsdom test/controls/DocumentAreaGrid.test.tsx`
- `npm test -- --project node test/controls/DocumentHubService.test.ts`
- `npm run lint:renderer`
- `npm run build:check`

### 7. [Completed] Move Tabs Between Areas

Support explicit move commands before drag-and-drop.

Work:

- Add a service-level helper or grid-level coordinator:
  - `moveDocumentToArea(sourceHub, targetHub, documentId)`
  - `copyDocumentToArea(sourceHub, targetHub, documentId)` if "open to side" needs a separate path
- Ensure the source hub calls `beforeDocumentDisposal` only when closing the last view of a dirty document, not when moving/copying a view.
- Move the source hub's document view state to the target hub when moving.
- Preserve shared `ProjectDocumentState` identity.

Acceptance:

- Move active tab to next/previous area.
- Move active tab to newly split area.
- Moving the last tab removes the empty source area unless it is the last remaining area.
- Closing one of two views does not force-save or dispose the other view.

Tests:

- Moving a tab removes it from source hub and adds it to target hub.
- Moving last tab collapses source area.
- Dirty document remains dirty and open in the target hub.
- `npm test -- --project node test/controls/DocumentHubService.test.ts`
- `npm test -- --project jsdom test/controls/DocumentAreaGrid.test.tsx`
- `npm run build:check`

### 8. Add Cross-Area Tab Drag And Drop

Extend `DocumentTabs` events so a tab can be dropped onto another tab strip.

Targets:

- `src/renderer/features/documents/DocumentTabs.tsx`
- `src/renderer/features/documents/DocumentsHeader.tsx`
- `src/renderer/features/documents/DocumentAreaGrid.tsx`

Work:

- Include source `areaId` and document ID in tab drag data.
- Keep existing within-strip reorder behavior.
- When dropped on another strip, move the document into that hub at the requested tab position.
- Add an empty-strip drop target when an area has no tabs.

Acceptance:

- Existing tab reorder behavior remains unchanged.
- Dragging a tab to another area moves it there.
- Dragging to an empty area works.
- Drop affordances do not resize tab elements.

Tests:

- Existing `DocumentsHeaderRefactor` drag tests still pass.
- New cross-area drag tests cover source and target hub calls.
- `npm test -- --project jsdom test/controls/DocumentsHeaderRefactor.test.tsx`
- `npm test -- --project jsdom test/controls/DocumentAreaGrid.test.tsx`
- `npm run lint:renderer`
- `npm run build:check`

### 9. Persist And Restore Area Layout

Replace single-area persistence with versioned multi-area persistence, while keeping migration from existing workspaces.

Targets:

- `src/renderer/features/documents/useDocumentWorkspacePersistence.ts`
- `src/renderer/appIde/restoreLastOpenDocuments.ts`
- New layout persistence helpers

Work:

- Save layout tree, active area ID, and per-area tab lists.
- Save per-area active document IDs.
- Save per-area edit positions/view state where already available.
- Restore all areas as unloaded tabs first, then activate the saved area and active document.
- Migrate old `docsWorkspace` shape into one area without changing the setting key unless a new key is clearly safer.

Acceptance:

- Existing users with old workspace data restore into a single area.
- New multi-area sessions restore all areas and active tabs.
- Missing files are skipped without breaking the layout; empty leaves are normalized.

Tests:

- Old workspace migration.
- New workspace save payload.
- Restore two areas with overlapping document IDs.
- Restore skips missing project nodes.
- `npm test -- --project jsdom test/controls/DocumentsHeaderRefactor.test.tsx`
- `npm test -- --project jsdom test/controls/DocumentAreaWorkspace.test.ts`
- `npm run build:check`

### 10. Add Command Surface And Header Controls

Expose the feature in a small, discoverable UI.

Commands:

- `Document: Split Right`
- `Document: Split Down`
- `Document: Move Editor To Next Area`
- `Document: Move Editor To Previous Area`
- `Document: Close Editor Area`
- `Document: Close Editors In Other Areas`

UI:

- Keep and refine icon buttons in the document header command area for split right/down.
- Add tab context menu entries for move/copy to another area once command behavior is tested.
- Keep button labels in tooltips, not visible explanatory text.

Acceptance:

- Commands operate on the currently active area.
- Buttons are disabled when no active document exists, unless the command intentionally creates an empty area.
- Keyboard shortcuts can be registered later without changing command behavior.

Tests:

- Command tests mock active area state and verify service calls.
- Header control tests verify disabled/enabled states.
- `npm test -- --project jsdom test/commands/DocumentCommands.test.ts`
- `npm test -- --project jsdom test/controls/DocumentsHeaderRefactor.test.tsx`
- `npm run lint:renderer`
- `npm run build:check`

### 11. Polish Focus, Status, And Edge Cases

Close the gaps that show up only once the flow is usable.

Work:

- Ensure `IdeStatusBar` reflects the active area's active document.
- Audit all `projectService.getActiveDocumentHubService()` call sites and decide whether each should remain global-active or use `useDocumentHubService`.
- Ensure project-close cleanup closes all hubs.
- Ensure reload/external file changes update all views of a file.
- Confirm debugger lock state updates across all views.

Acceptance:

- Clicking a view updates status bar/document commands to that view.
- Closing a project releases all hub event handlers.
- External reload updates every open view that is not dirty.
- No obvious stale active-hub assumptions remain in renderer panels.

Tests:

- Focus changes active hub and status-facing active document.
- Project close disposes secondary hubs.
- External reload still walks `getDocumentHubServiceInstances`.
- `npm test -- --project jsdom test/controls/EffectCleanup.test.tsx`
- `npm test -- --project jsdom test/controls/ExplorerPanelDialogs.test.tsx`
- `npm run lint:renderer`
- `npm run build:check`

## Suggested Delivery Order

1. Hub behavior tests.
2. Explicit-hub `DocumentAreaPane`.
3. Monaco context-hub fix.
4. Pure area layout helpers.
5. Recursive area grid rendering.
6. Split right/down commands.
7. Move tab between areas.
8. Cross-area tab drag/drop.
9. Versioned workspace persistence.
10. Command and header UI.
11. Focus/status/project-close polish.

## Validation Matrix

Run after most renderer slices:

- `npm test -- --project jsdom test/controls/DocumentsHeaderRefactor.test.tsx`
- `npm test -- --project node test/controls/DocumentHubService.test.ts`
- `npm run build:check`
- `npm run lint:renderer`

Run after command slices:

- `npm test -- --project jsdom test/commands/DocumentCommands.test.ts`

Run after import moves or new feature files:

- `npx electron-vite build --config build/electron.vite.config.ts`

## Definition Of Done

- Users can split the document area and see independent views of the same document.
- Tabs can be moved between areas without losing dirty state or forcing premature saves.
- Active area focus drives commands, status bar state, and editor view-state persistence.
- Workspace restore supports both old single-area data and new multi-area layouts.
- Focused tests cover hub behavior, layout helpers, split/move commands, cross-area drag/drop, and persistence migration.

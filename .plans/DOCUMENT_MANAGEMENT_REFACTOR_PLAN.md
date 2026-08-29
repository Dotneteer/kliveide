# Document Management Refactor Plan

## Goal

Make the document-management React area easier for human readers to understand and safer for React maintenance, without changing document behavior. The work should add useful synopsis comments, remove small React risks, reduce obvious duplication, and keep every slice narrow enough to review comfortably.

## Scope

Primary files:

- `src/renderer/features/documents/DocumentArea.tsx`
- `src/renderer/features/documents/DocumentsHeader.tsx`
- `src/renderer/features/documents/DocumentTabs.tsx`
- `src/renderer/features/documents/DocumentTab.tsx`
- `src/renderer/features/documents/DocumentCommandBar.tsx`
- `src/renderer/features/documents/DocumentsContainer.tsx`
- `src/renderer/features/documents/ScriptingCommandBar.tsx`
- `src/renderer/features/documents/useDocumentWorkspacePersistence.ts`
- `src/renderer/appIde/services/DocumentServiceProvider.tsx`
- `src/renderer/appIde/services/DocumentHubService.ts`
- `src/renderer/abstractions/IDocumentHubService.ts`

Primary tests:

- `test/controls/DocumentsHeaderRefactor.test.tsx`
- `test/controls/DocumentHubService.test.ts`
- `test/controls/EffectCleanup.test.tsx`
- `test/commands/DocumentCommands.test.ts`

## Non-Goals

- Do not redesign document hub behavior.
- Do not replace the document service with React state.
- Do not move broad service contracts unless a focused test already pins the behavior.
- Do not rewrite document panel renderers.
- Do not churn persisted workspace payloads or document IDs.

## Current Review Notes

- `DocumentArea` still mixes hub lookup, active-document derivation, lock-state updates, view-state lookup, data passing, and document API registration. The main React risk is the effect that uses `documentHubService` and `projectService` without listing them as dependencies.
- `DocumentsHeader` is much leaner than before, but still stores `dirtyStates`, `selectedIsBuildRoot`, and `editorInfo` as state even though they are derived from current inputs. This adds effect surface area and makes comments work harder than the code.
- `DocumentsHeader` schedules visibility checks with `requestAnimationFrame` and several timeouts. This is pragmatic UI behavior, but it deserves a named helper/hook and cleanup bookkeeping so future readers can tell it is intentional.
- `DocumentTabs` owns drag-and-drop state and tab naming. Duplicate-name display currently scans `openDocs` for every tab. That is small, but a precomputed name map would be clearer and cheaper.
- `DocumentTab` contains rendering, context menu wiring, tooltip refs, pointer tracking, and drag callbacks. The module-level pointer position is intentional but surprising, so it needs either a compact comment or extraction to a tiny helper hook.
- `DocumentCommandBar` has a clean small surface now. `BuildRootCommandBar` can receive a synopsis comment and a small command helper to make the compile/inject/run/debug flow more readable.
- `DocumentsContainer` has two low-risk cleanup targets: an unused `instanceId` ref backed by a module-level counter, and render-time mutation of `document.iconName` / `document.iconFill`. Render should not mutate props.
- `ScriptingCommandBar` duplicates run/stop/show-output command behavior with `getScriptingContextMenuIfo`. The component effect also reads `scriptService` without listing it in dependencies.
- `useDocumentWorkspacePersistence` has a clear purpose. It can use a slightly richer comment around the project-scoped filtering rule and can catch/report `saveProject` failure if the local error-handling style supports it.
- `DocumentHubService` is service code rather than component code. Any cleanup here should be small, tested, and mostly comment/typing oriented. Candidate fixes include typo comments, bounds guards in `moveActiveToRight`, and removing `moveActiveToLeft`/`moveActiveToRight` only if no commands or tests still depend on them.

## Refactor Slices

### 1. Add Component Synopsis Comments

Add short file-level or component-level comments that explain responsibility and ownership, not line-by-line mechanics.

Targets:

- `DocumentArea`: "selects the active document hub, derives the active document snapshot, and mounts the active renderer under the hub provider."
- `DocumentsHeader`: "renders the tab strip and command bar, bridges tab actions to the document hub, and keeps the active tab/workspace visible and persisted."
- `DocumentTabs`: "maps open document state to draggable tab items and reports tab reorder requests."
- `DocumentTab`: "renders one tab, including close affordances, badges, tooltips, context menu, and drag/drop events."
- `DocumentCommandBar`: "renders document-level commands supplied by the active editor and project build-root state."
- `DocumentsContainer`: "selects and mounts the registered renderer for the active document."
- `ScriptingCommandBar`: "exposes script run/stop/output commands for script-capable document tabs."
- `useDocumentWorkspacePersistence`: expand the existing comment with the project-folder filtering rule.

Acceptance:

- Comments explain "why this component exists" and "what it owns".
- No comments merely restate JSX or assignments.
- No behavior changes in this slice.

Tests:

- `npm run build:check`

### 2. Derive Header State Instead Of Mirroring It

Replace effect-driven derived state in `DocumentsHeader` where practical:

- Compute `dirtyStates` with `useMemo` from `openDocs` and `editorVersion`.
- Compute `activeDoc`, `activeNode`, `selectedIsBuildRoot`, and `editorInfo` from the current `openDocs`, `activeDocIndex`, `buildRoots`, and `store`.
- Keep `openDocs`, `activeDocIndex`, and `awaiting` as real state.

Acceptance:

- Remove the effects whose only job is copying derived values into state.
- Preserve the null-before-load shape for `openDocs` and `activeDocIndex`.
- Keep existing command bar behavior unchanged.

Tests:

- `npm test -- --project jsdom test/controls/DocumentsHeaderRefactor.test.tsx`
- `npm run build:check`
- `npm run lint:renderer`

### 3. Isolate Active Tab Visibility Scheduling

Extract the visibility scheduling logic from `DocumentsHeader` into a small local hook or helper:

- Keep the existing immediate/animation-frame/timeout timing behavior.
- Track scheduled frame/timeouts and clear them on unmount.
- Preserve the `ScrollViewerApi` and tab element ref model.

Acceptance:

- `DocumentsHeader` reads as orchestration rather than timer management.
- Visibility behavior remains covered by the current active-tab tests.
- No broad ScrollViewer changes.

Tests:

- Existing active-tab visibility tests in `test/controls/DocumentsHeaderRefactor.test.tsx`
- Add one cleanup-oriented test only if the extracted helper exposes a clean seam for it.
- `npm run build:check`

### 4. Clean Up DocumentArea Hook Dependencies

Make `DocumentArea` safer without changing rendering behavior:

- Include `documentHubService` and `projectService` in the active-document effect dependencies, or extract a stable helper that makes the dependency list honest.
- Avoid mutating the document object for lock state if a small derived copy is practical. If that risks identity-sensitive behavior, leave the mutation and add a short comment explaining the service-owned object update.
- Type `handleApiLoaded` as `(api: DocumentApi) => void`.
- Keep the `DocumentsContainer` key behavior unchanged.

Acceptance:

- No new hook lint warning in `DocumentArea`.
- Active document API registration and edit-position restore still run when the renderer loads.

Tests:

- Add or update a focused `DocumentArea` test if existing mocks cover it cheaply.
- `npm run lint:renderer`
- `npm run build:check`

### 5. Make DocumentTabs Naming And Drag Logic Easier To Read

Keep drag/drop behavior intact while simplifying the render loop:

- Precompute duplicate display names with `useMemo`.
- Extract `getDocumentTabName(document, duplicateNameSet)` or similar.
- Keep `getDropPlacement` local unless a testable helper meaningfully reduces complexity.
- Add a synopsis comment for the drag state: source tab ID plus current hover placement.

Acceptance:

- No change to duplicate-name behavior.
- No change to before/after drop behavior.
- JSX for each `DocumentTab` becomes easier to scan.

Tests:

- Existing duplicate-name and drag/drop tests in `test/controls/DocumentsHeaderRefactor.test.tsx`
- `npm run build:check`

### 6. Split DocumentTab Into Named Render Helpers, Not New Files

Keep this conservative and local:

- Add a synopsis comment to the module-level pointer variable explaining that it preserves hover affordance when tabs shift under a stationary pointer.
- Extract small local render helpers only if they reduce noise: read-only badge, locked badge, context menu.
- Keep `CloseMode` and tab event prop names stable.
- Consider disabling or guarding "Reveal in Finder/File Explorer" when `path` is missing, but only with a focused test.

Acceptance:

- `DocumentTab` remains in one file.
- No behavior change unless the missing-path reveal guard is explicitly tested.
- Pointer tracking behavior remains covered.

Tests:

- Existing pointer-hover test in `test/controls/DocumentsHeaderRefactor.test.tsx`
- Add a context-menu test only if changing reveal disabled behavior.
- `npm run build:check`

### 7. Remove Render-Time Mutation From DocumentsContainer

Clean the renderer selection boundary:

- Remove the unused `containerInstanceCounter` and `instanceId`.
- Stop assigning `document.iconName` and `document.iconFill` inside render.
- Prefer deriving local `iconName` / `iconFill` earlier in the service when a document is opened, or add a tiny helper that returns renderer metadata without mutating props. Choose the smaller tested path.

Acceptance:

- `DocumentsContainer` has no render-time side effects.
- Document icons still appear in tabs for registered document types.

Tests:

- Add a focused test if no current test protects icon metadata.
- `npm test -- --project jsdom test/controls/DocumentsHeaderRefactor.test.tsx`
- `npm run build:check`

### 8. Deduplicate Script Command Logic

Reduce duplication between `ScriptingCommandBar` and `getScriptingContextMenuIfo`:

- Extract helper functions in the same file: `runScript`, `stopScript`, `showScriptOutput`, and `findRunningScript`.
- Include `scriptService` in the effect dependencies.
- Keep command strings and the 100ms startup delay unchanged.
- Add a synopsis comment explaining that the command bar and context menu intentionally share command helpers.

Acceptance:

- No duplicated command sequence for run/stop/show output.
- No new hook lint warning in `ScriptingCommandBar`.

Tests:

- Add focused tests for helper behavior if practical, or cover through command bar/context-menu mocks.
- `npm run build:check`
- `npm run lint:renderer`

### 9. Service Boundary Polish

Only after the component slices are stable:

- Fix typos in `IDocumentHubService` and `DocumentHubService` comments.
- Review `moveActiveToLeft` and `moveActiveToRight` now that the header buttons are gone. Remove them only if no commands, tests, or external service users need them.
- Add a bounds guard in `moveActiveToRight` if retaining it: it should not swap with an out-of-range slot when active index is already the last tab.
- Keep `moveDocument` as the primary UI reorder path.

Acceptance:

- Service API remains compatible unless removal is proven safe by search and tests.
- Service behavior is covered by `DocumentHubService.test.ts`.

Tests:

- `npm test -- --project jsdom test/controls/DocumentHubService.test.ts`
- `npm test -- --project jsdom test/commands/DocumentCommands.test.ts`
- `npm run build:check`

## Suggested Order

1. Synopsis comments only.
2. `DocumentsHeader` derived-state cleanup.
3. Active-tab visibility scheduling helper.
4. `DocumentArea` hook dependency cleanup.
5. `DocumentTabs` naming/drag readability.
6. `DocumentTab` local readability helpers.
7. `DocumentsContainer` render-side-effect cleanup.
8. `ScriptingCommandBar` command helper deduplication.
9. Service comment and small API polish.

## Validation Matrix

Run these after each slice unless the slice is comments-only:

- `npm test -- --project jsdom test/controls/DocumentsHeaderRefactor.test.tsx`
- `npm run build:check`
- `npm run lint:renderer`

Run these after service-boundary changes:

- `npm test -- --project jsdom test/controls/DocumentHubService.test.ts`
- `npm test -- --project jsdom test/commands/DocumentCommands.test.ts`

Run this after moving/deleting files or changing imports:

- `npx electron-vite build --config build/electron.vite.config.ts`

## Definition Of Done

- Affected components have concise synopsis comments.
- Touched files add no new React hook lint warnings.
- Derived values are not mirrored in React state unless there is a clear lifecycle reason.
- Render paths do not mutate props or module state.
- Repeated command flows are extracted only when the helper is simpler than the duplication.
- Each PR-sized slice has focused tests and avoids unrelated formatting churn.

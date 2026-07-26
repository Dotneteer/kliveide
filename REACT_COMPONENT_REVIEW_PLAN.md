# React Component Review And Refactor Plan

## Goals

- Modernize renderer React code without changing behavior.
- Fix hook lifecycle/dependency risks before larger component moves.
- Simplify component composition around stable layout primitives.
- Add focused regression tests before and after each refactor slice.
- Keep each change reviewable: one concern, one test cluster, one behavior surface.

## Current Signals

- Renderer code is split across `appIde`, `appEmu`, `controls`, `controls/generic`, `controls/new`, and empty `common` component files.
- Tests already use Vitest, jsdom, Testing Library, and custom provider helpers in `test/react-test-utils.tsx`.
- Large React files need staged extraction: `MonacoEditor.tsx`, `MemoryPanel.tsx`, `SpriteEditorGrid.tsx`, `ExplorerPanel.tsx`, `IdeApp.tsx`, keyboard components, and `SplitPanel.tsx`.
- Hook linting is not enforced through a visible npm script/config, despite many effects and custom hooks.
- Several components mix rendering, service orchestration, persistence, IPC setup, and global/module state.

## Review And Refactor Steps

1. Add frontend guardrails.
   - Add an npm lint script for renderer TypeScript/React.
   - Add or update ESLint flat config with `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps`.
   - Keep temporary suppressions explicit and ticketed in comments.
   - Tests: run `npm run build:check` and existing React tests before behavior changes.

2. Lock down provider hooks.
   - Review `RendererProvider.tsx`, `DocumentServiceProvider.tsx`, and `AppServicesProvider.tsx`.
   - Fix stale dependencies in `useSelector`, `useGlobalSetting`, and `useDocumentHubServiceVersion`.
   - Add invariant errors for missing providers instead of returning undefined context.
   - Stabilize `AppServicesProvider` service creation with lazy refs/memoized setup.
   - Tests: selector changes when selector props change, unsubscribe on unmount, missing-provider errors.

3. Fix obvious effect cleanup bugs.
   - `DocumentsHeader.tsx`: return the project event cleanup function; currently it is declared but not returned.
   - Replace `setAwaiting.bind(false)` with `() => setAwaiting(false)`.
   - `EmuApp.tsx`: create one `AudioContext`, read its sample rate, and close that same instance.
   - Tests: event handlers detach on unmount, tab close/click resets awaiting, audio context close is called once.

4. Move module-level IPC registration out of app render files.
   - Extract `MainToIde` and `MainToEmu` listener registration into renderer lifecycle helpers.
   - Ensure listener removal for hot reload/tests and avoid duplicate listeners.
   - Tests: listener registers once, returns NotReady without cached services, unregisters on cleanup.

5. Normalize layout primitives.
   - Choose one shared layout home, likely `src/renderer/controls/layout`.
   - Move `FullPanel`, `HStack`, `VStack`, `Row`, `Column`, separators, and basic text/value primitives there.
   - Replace empty `src/renderer/common/Stack.tsx`, `HStack.tsx`, and `VStack.tsx`.
   - Deprecate duplicate `controls/generic` vs `controls/new` imports with a compatibility barrel first.
   - Tests: layout primitives render class/style props, orientation, hover styling, and children consistently.

6. Harden shared controls before consumers.
   - `SplitPanel.tsx`: use `React.Children.toArray`, include callback dependencies, test visibility restore, drag bounds, and cleanup.
   - `VirtualizedList.tsx`: type items generically, include `apiLoaded`/`renderItem` dependencies, and define empty-row behavior.
   - `Modal`, `ContextMenu`, `Tooltip`, `ClickAwayListener`: verify document/window listeners always clean up.
   - Tests: pointer/mouse interactions, keyboard dismissal, outside click, and listener cleanup.

7. Split app shells from app initialization.
   - In `IdeApp.tsx` and `EmuApp.tsx`, extract `useIdeStartup`, `useEmuStartup`, dialog registry, command registration, and persisted splitter settings.
   - Convert conditional dialog rendering in IDE to the same registry pattern already used by EMU.
   - Tests: initial actions dispatch once, dialogs render from registry, last-project loading waits for synced settings.

8. Refactor document header and explorer in thin slices.
   - `DocumentsHeader.tsx`: extract tab list, command bar, workspace persistence hook, and build-root command bar.
   - `ExplorerPanel.tsx`: extract tree loading/cache hook, context menu component, project item row, and file operations.
   - Remove duplicated tree refresh effects where `explorerViewVersion` is handled twice.
   - Tests: active tab visibility, workspace save payload, context menu availability, folder refresh, add/rename/delete flows with mocked APIs.

9. Refactor emulator panel around side-effect hooks.
   - Review `EmulatorPanel.tsx`, `useEmulatorScreen`, `useEmulatorAudio`, and `useEmulatorKeyboard` together.
   - Make controller callbacks stable and avoid stale `controller`, `audioSampleRate`, and recording refs.
   - Keep render output small: host, display, overlay, canvas, machine tools.
   - Tests: machine state transitions update overlay/audio/recording, instant screen setting behavior, keyboard listeners detach.

10. Create feature folders for complex document panels.
    - Suggested shape:
      - `src/renderer/features/editor/monaco`
      - `src/renderer/features/explorer`
      - `src/renderer/features/documents`
      - `src/renderer/features/emulator`
      - `src/renderer/features/memory`
      - `src/renderer/features/sprite-editor`
    - Keep domain services under `appIde/services` until the component moves are stable.
    - Use barrel exports sparingly; prefer direct imports inside a feature.
    - Tests move with behavior clusters under matching `test/renderer/...` or keep current folders with clear names during transition.

11. Tame `MonacoEditor.tsx` last.
    - First add tests/mocks around editor API behavior, breakpoint decoration updates, external rename edits, and navigation callbacks.
    - Extract Monaco worker/bootstrap code, language registration, breakpoint actions, editor API adapter, and persistence effects.
    - Keep module-level Monaco singletons isolated in one bootstrap module.
    - Tests: initialization idempotency, API methods, breakpoint toggle, rename edit dispatch, cleanup of DOM listeners.

12. Remove low-value noise and type weak spots.
    - Replace renderer `console.log` diagnostics with a debug logger or remove them.
    - Replace local `any` in UI event handlers and component props with React/event/domain types.
    - Fix typos while touching nearby code only.
    - Tests: no separate tests unless behavior changes; rely on lint/build.

## Suggested Order Of Work

1. Guardrails and provider hooks.
2. Cleanup bugs and shared-control tests.
3. Layout primitive consolidation.
4. App shell extraction.
5. Documents/explorer refactors.
6. Emulator refactors.
7. Monaco and specialized editor panels.

## Regression Test Matrix

- `npm run build:check` after every slice.
- `npm test -- --project jsdom test/controls test/phase8 test/IconButton.test.tsx test/Icon.test.tsx` for shared UI changes.
- Add focused tests beside existing clusters before refactoring each feature.
- Use fake store/messenger APIs from `test/react-test-utils.tsx`; add richer mocked `mainApi`, `emuApi`, and app services helpers before app-shell tests.
- Add listener-cleanup tests with `vi.spyOn(window, "addEventListener")`, `removeEventListener`, and fake project-service events.
- Avoid broad snapshots; prefer semantic DOM assertions and mocked service call assertions.

## Definition Of Done Per Slice

- Behavior covered by one or more focused tests before refactor when practical.
- No new hook lint suppressions without a short reason.
- No unrelated formatting churn.
- Component files trend smaller or have clearer responsibility boundaries.
- Imports use the chosen layout/control structure.
- Existing node and jsdom tests still pass for the touched area.

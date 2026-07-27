# Renderer Modal Dialog Refactor Plan

## Problem Statement

Renderer dialogs currently look like modal dialogs, but the modal behavior is scattered across components and only partially implemented. `src/renderer/controls/Modal.tsx` renders its own portal content and exposes a small button API, while callers decide whether a dialog is open with either local `useState` flags or the global `ideView.dialogToDisplay` Redux field. This makes dialogs difficult to open imperatively, hard to compose with other portals, and fragile around keyboard and focus behavior.

The target is one shared overlay system for modal dialogs and related portal UI, with a small imperative API that can open a dialog, await its result, and close it safely.

## Current Findings

- `Modal` portals to `document.getElementById("appMain") ?? document.body`. This keeps the dialog inside the app shell rather than a dedicated overlay root under `#themeRoot`, and it competes with `BackDrop`, context menus, tooltips, Radix Select portals, and app layout stacking.
- `Modal` dispatches `dimMenuAction(isOpen)` itself and the app shells also render a separate `<BackDrop visible={dimmed} />`. The visual dimming state is global, but ownership is inside each modal instance.
- Keyboard handling is dialog-local: `Escape` is handled on `onKeyUp` of the focused dialog container. If focus is inside a nested portal, a native file picker returns focus elsewhere, or focus escapes the dialog, Escape can miss the modal.
- Focus handling is incomplete. The dialog container focuses itself, buttons and inputs each have ad hoc `focusOnInit`, there is no focus trap, no restoration to the invoker, no tab loop, and no shielding of background content.
- Accessibility metadata is static and incomplete. `aria-labelledby="dialogTitle"` and `aria-describedby="dialogDesc"` reference IDs that are not rendered, and the dialog lacks `aria-modal`.
- Outside-click close is implemented with `mousedown`/`mouseup` state on the overlay element, but dismissal policy is not configurable per dialog. Dangerous dialogs such as `DeleteDialog` can still close by outside click or Escape through the base component.
- `ModalApi` is not a real dialog-control API. It can enable buttons and trigger handlers after a dialog is already rendered, but it cannot open a dialog, close by ID, close the top dialog, or return a typed result to the caller.
- Callers mix several open/close models:
  - `IdeApp` and `EmuApp` read `ideView.dialogToDisplay` and use `IdeDialogHost` / `EmuDialogHost`.
  - `ExplorerPanel` owns local booleans for `RenameDialog`, `DeleteDialog`, and `NewItemDialog`.
  - `MemoryPanel` owns local state for `SetMemoryDialog`.
  - Emulator tool buttons dispatch numeric dialog IDs through `displayDialogAction`.
- Existing tests cover button triggers, dimming, Escape on the dialog element, and outside-click close, but not focus trap, focus restore, nested portals, stacked dialogs, or typed imperative open/close.

## Design Principles

- One overlay owner per renderer process. Dialogs, popovers, context menus, and tooltips should have a common portal root and z-index strategy.
- Modal behavior belongs to the infrastructure, not each dialog body.
- Opening a dialog should be a command with a result, not a local boolean plus callbacks.
- Dialog content should remain ordinary React. Existing dialogs should mostly become forms that receive `close`, `resolve`, and `reject`/`cancel` helpers.
- Shell-level IPC and command compatibility should be preserved while migrating callers.
- Tests should lock down behavior before large caller migrations.

## Target Architecture

### Overlay Root

Create an overlay host under the themed root, likely inside `ThemeProvider` or directly below `AppServicesProvider` in `src/renderer/main.tsx`.

Suggested files:

- `src/renderer/controls/overlay/OverlayProvider.tsx`
- `src/renderer/controls/overlay/OverlayRoot.tsx`
- `src/renderer/controls/overlay/useOverlayRoot.ts`
- `src/renderer/controls/overlay/overlayStack.ts`

The provider should create or locate a single DOM node, for example `#overlayRoot`, inside `#themeRoot`. Every shared portal component should default to this node. Keeping the root inside `#themeRoot` preserves theme variables, while separating it from `#appMain` avoids layout clipping and stacking conflicts.

### Dialog Service

Add a typed dialog service exposed through React context:

```ts
type DialogOptions<TResult> = {
  title?: string;
  width?: number;
  fullWidth?: boolean;
  fullScreen?: boolean;
  dismissible?: boolean;
  initialFocus?: "first" | "primary" | "cancel" | "none";
  restoreFocus?: boolean;
  ariaLabel?: string;
};

type DialogControls<TResult> = {
  close: (result: TResult) => void;
  cancel: (result?: TResult) => void;
  reject: (error?: unknown) => void;
};

type DialogService = {
  open<TResult, TProps>(
    component: DialogComponent<TResult, TProps>,
    props: TProps,
    options?: DialogOptions<TResult>
  ): Promise<TResult | undefined>;
  closeTop: (result?: unknown) => void;
  cancelTop: () => void;
  closeById: (id: string, result?: unknown) => void;
};
```

Use `useDialogs()` in renderer code and, where non-React command handlers need access, provide a small bridge owned by app startup. Avoid storing unresolved Promise callbacks in Redux.

### Modal Component

Split the current `Modal` into two layers:

- `ModalFrame`: presentational layout, title/header/body/footer/button rendering.
- `ModalLayer`: modal behavior around the frame: portal, focus trap, Escape, outside dismissal, `aria-modal`, background shielding, scroll lock if needed, focus restore, and stack registration.

`ModalFrame` can keep the current visual styling and button labels. It should receive explicit action props instead of publishing a mutable `ModalApi` through `onApiLoaded`.

### Accessibility And Focus

The modal infrastructure should:

- Render `role="dialog"` or `role="alertdialog"` and `aria-modal="true"`.
- Generate stable IDs for title and optional description.
- Capture the active element before opening and restore it after close when possible.
- Focus the requested initial target, then the first focusable element, then the dialog frame as fallback.
- Trap `Tab` and `Shift+Tab` inside the topmost modal.
- Listen for Escape at the document level and only let the topmost dismissible modal react.
- Prevent pointer and focus interaction with background UI while a modal is open.
- Treat nested non-modal portals, especially Radix Select content, as allowed descendants of the same overlay root so dropdowns inside dialogs remain usable.

### Dismissal Policy

Use an explicit policy instead of universal dismissal:

- Normal forms: Escape and outside click cancel.
- Dangerous confirmations: Escape may cancel, outside click should be disabled by default.
- Busy dialogs: Escape, outside click, and close button can be disabled while a primary action is running.
- First-start/setup dialogs: choose policy explicitly instead of inheriting a default accidentally.

### Result Model

Each user-visible dialog should resolve one typed result:

- `NewItemDialog`: `{ name: string; isFolder: boolean }` or just `string` if the folder/file choice stays in props.
- `RenameDialog`: `string`.
- `DeleteDialog`: `true` or a delete-confirm result.
- `SetMemoryDialog`: address/value result.
- `CreateDiskDialog`: filename/folder result.
- Export dialogs: either perform the export internally and resolve success/cancel, or return export settings and let the caller execute the command. The second option is cleaner long term.

This removes the current pattern where `onPrimaryClicked` returns a boolean whose meaning is inverted enough to require rereading: handlers return `true` to keep the dialog open and `false` to close.

## Existing Modal Inventory

These are the current renderer components that directly render `Modal` and must be migrated or explicitly preserved through compatibility.

| Dialog | Current opener | Main behavior | Migration result | Focused tests |
| --- | --- | --- | --- | --- |
| `src/renderer/appIde/dialogs/NewItemDialog.tsx` | `ExplorerPanel` local `isNewItemDialogOpen` | Creates a file or folder under the selected explorer node | Resolve `string` or `{ name, isFolder }`; caller runs `addExplorerItem` | Valid and duplicate names, Enter submits, invalid name blocks primary, focus returns to explorer |
| `src/renderer/appIde/dialogs/RenameDialog.tsx` | `ExplorerPanel` local `isRenameDialogOpen` | Renames selected explorer node | Resolve `string`; caller runs `renameExplorerNode` | Initial value, unchanged/invalid name blocks primary, Enter submits, rename service called once |
| `src/renderer/appIde/dialogs/DeleteDialog.tsx` | `ExplorerPanel` local `isDeleteDialogOpen` | Confirms deletion of selected node | Resolve `true`; caller runs `deleteExplorerNode` | Danger primary, cancel/no outside click policy, delete called only on confirm, focus returns |
| `src/renderer/appIde/dialogs/SetMemoryDialog.tsx` | `MemoryPanel` local `isMemoryDialogOpen` | Edits memory value/size/endian, or shows ROM read-only message | Resolve `{ value, sizeOption, bigEndian }` for RAM; cancel/close for ROM | ROM mode hides primary, async numeric validation, dropdown works inside modal, Enter submits valid RAM edit |
| `src/renderer/appIde/dialogs/NewProjectDialog.tsx` | `IdeDialogHost` via `displayDialogAction(NEW_PROJECT_DIALOG)` | Creates project, opens folder, loads workspace, navigates build root | Prefer resolve project settings; first migration may keep internal side effects | Template loading, path/name validation, folder picker, dropdown-in-modal, success closes, failure stays open |
| `src/renderer/appIde/dialogs/ExportCodeDialog.tsx` | `IdeDialogHost` via `displayDialogAction(EXPORT_CODE_DIALOG)` | Persists export settings and runs export command | Prefer resolve export settings; first migration may keep internal side effects | Settings persistence, path/name/start address validation, dropdown-in-modal, success/error message handling |
| `src/renderer/appIde/dialogs/ExcludedProjectItemsDialog.tsx` | `IdeDialogHost` via `displayDialogAction(EXCLUDED_PROJECT_ITEMS_DIALOG)` | Removes project exclude entries and saves project | Resolve selected exclude IDs or save internally during compatibility | Loads global excludes, removes project item, OK dispatches and saves, tooltip portal does not break modal focus |
| `src/renderer/appIde/dialogs/FirstStartDialog.tsx` | `IdeDialogHost` and `EmuDialogHost` via first-start IDs | Shows welcome, marks start screen displayed, optional website open | Resolve `"ok"` or `"website"`; caller dispatches start-screen action | OK closes and dispatches, website button opens site and dispatches, no cancel button, focus behavior |
| `src/renderer/appEmu/dialogs/CreateDiskDialog.tsx` | `EmuDialogHost` via `displayDialogAction(CREATE_DISK_DIALOG)` | Creates a disk file and displays success/error message | Prefer resolve disk settings; first migration may keep internal side effects | Disk type dropdown, folder/file validation, folder picker, Enter submits, failure stays open |
| `src/renderer/appEmu/dialogs/Z88InsertCardDialog.tsx` | `Z88ToolArea` via `displayDialogAction(Z88_INSERT_CARD_DIALOG, slot)` | Inserts/replaces Z88 card and may load/validate card file | Resolve card slot state; caller applies machine config | Slot data passed, card type controls primary enablement, file picker validation, slot 0 requires file, flap closes on close |
| `src/renderer/appEmu/dialogs/Z88RemoveCardDialog.tsx` | `Z88ToolArea` via `displayDialogAction(Z88_REMOVE_CARD_DIALOG, slot)` | Confirms card removal and updates slot/config | Resolve `true`; caller applies card removal | Slot data passed, dangerous confirm policy, remove applies state, slot 0 updates machine type, flap closes |
| `src/renderer/appEmu/dialogs/Z88ExportCardDialog.tsx` | `Z88ToolArea` via `displayDialogAction(Z88_EXPORT_CARD_DIALOG, slot)` | Placeholder, not implemented | Keep compatibility; resolve `"ok"` or remove once feature decision is made | Renders placeholder with slot, OK closes, no service side effects |
| `src/renderer/appEmu/dialogs/Z88ChangeRamDialog.tsx` | `Z88ToolArea` via `displayDialogAction(Z88_CHANGE_RAM_DIALOG)` | Changes Z88 internal RAM size and writes emulator output | Resolve selected RAM size; caller applies machine config | Initial size from config, warning shown while running, unchanged size is no-op, changed size updates config and output |

## Small Testable Migration Plan

Work in small slices. Each slice should leave the app usable, keep existing dialogs rendering, and have focused tests before broader migrations.

### Step 1: Inventory Guard Test

- Add or update a test that imports the IDE and EMU dialog registries and asserts every numeric dialog ID still resolves to a renderer.
- Add a lightweight modal inventory test or comment in the plan update PR so future additions to `Modal` are visible.
- Verification: `npm test -- --project jsdom test/controls/AppShellStartup.test.tsx`.

### Step 2: Shared Overlay Root

- Add `src/renderer/controls/overlay/OverlayProvider.tsx`.
- Add `src/renderer/controls/overlay/useOverlayRoot.ts`.
- Render one `#overlayRoot` inside the themed tree, under `ThemeProvider`.
- Keep existing `Modal`, `Tooltip`, `ContextMenu`, and Radix `Dropdown` behavior unchanged except for using the shared root where possible.
- Tests:
  - Overlay root is rendered under `#themeRoot`.
  - A portal child inherits themed CSS variables.
  - Unmount removes provider-owned DOM state.
- Verification: focused overlay tests, then `npm run build:check`.

### Step 3: Modal Portal Compatibility

- Change `Modal` to default to the shared overlay root instead of `#appMain`.
- Keep `portalTo` as an escape hatch for now.
- Preserve `ModalApi`, `isOpen`, and all current props.
- Tests:
  - Existing `Modal` open/close tests still pass.
  - Modal DOM appears under `#overlayRoot`.
  - Existing app shell registry tests still pass.
- Verification: `npm test -- --project jsdom test/controls/Modal.test.tsx test/controls/AppShellStartup.test.tsx`.

### Step 4: Modal Accessibility Baseline

- Generate stable title/description IDs instead of hard-coded `dialogTitle` and `dialogDesc`.
- Add `aria-modal="true"`.
- Add optional `role="alertdialog"` for dangerous confirmations.
- Add `closeOnEscape` and `closeOnOutsideClick` props with current behavior as the compatibility default.
- Tests:
  - Dialog has valid `aria-labelledby`.
  - Dangerous dialog can render `alertdialog`.
  - Outside click can be disabled.
  - Escape can be disabled.
- Verification: modal tests and `npm run lint:renderer`.

### Step 5: Focus Management

- Capture the active element when the top modal opens.
- Focus the requested target, the first focusable child, or the dialog container as fallback.
- Trap `Tab` and `Shift+Tab` within the top modal.
- Restore focus on close when the opener still exists.
- Tests:
  - Initial focus works for input, primary, and cancel cases.
  - Tab wraps from last to first and Shift+Tab wraps from first to last.
  - Focus returns to the opener after close.
  - Focus stays in the top modal when two modals are stacked.
- Verification: modal focus tests; manually check one IDE dialog and one EMU dialog in dev mode.

### Step 6: Topmost Keyboard And Stack Behavior

- Add modal stack registration.
- Move Escape handling to document-level capture for the top modal only.
- Ensure nested portals under the overlay root, especially Radix `Dropdown`, do not cause the modal to miss Escape or outside-click decisions.
- Tests:
  - Escape closes only the top modal.
  - Escape from an input closes/cancels according to policy.
  - Dropdown inside `ExportCodeDialog` or a test fixture remains clickable and keyboard usable.
- Verification: `npm test -- --project jsdom test/controls/Modal.test.tsx`.

### Step 7: Imperative Dialog Service

- Add `DialogProvider` or extend `OverlayProvider`.
- Add `useDialogs()` with `open`, `closeTop`, `cancelTop`, and `closeById`.
- Add a test-only sample dialog that resolves a Promise from primary, cancel, and close paths.
- Ensure unresolved dialog Promises settle on provider unmount.
- Tests:
  - `open` renders a dialog and resolves with a typed result.
  - `cancelTop` resolves `undefined`.
  - `closeById` closes the intended dialog.
  - Provider unmount cancels pending dialogs.
- Verification: new dialog service test file plus `npm run build:check`.

### Step 8: Registry Compatibility Bridge

- Keep Redux `displayDialogAction` temporarily.
- Replace direct `IdeDialogHost` and `EmuDialogHost` rendering internals with a compatibility component that opens registered dialogs through `useDialogs()`.
- Closing a compatibility dialog must dispatch `displayDialogAction()` so existing state is cleared.
- Tests:
  - `NEW_PROJECT_DIALOG`, `EXPORT_CODE_DIALOG`, `EXCLUDED_PROJECT_ITEMS_DIALOG`, and `FIRST_STARTUP_DIALOG_IDE` still open from IDE registry.
  - `FIRST_STARTUP_DIALOG_EMU`, `CREATE_DISK_DIALOG`, `Z88_REMOVE_CARD_DIALOG`, `Z88_INSERT_CARD_DIALOG`, `Z88_EXPORT_CARD_DIALOG`, and `Z88_CHANGE_RAM_DIALOG` still open from EMU registry.
  - Dialog data such as Z88 slot numbers survives the bridge.
- Verification: `npm test -- --project jsdom test/controls/AppShellStartup.test.tsx`.

### Step 9: Migrate Explorer Dialogs

- Convert `NewItemDialog`, `RenameDialog`, and `DeleteDialog` to result-based dialog bodies.
- Replace `ExplorerPanel` local dialog booleans with `await dialogs.open(...)`.
- Keep add/rename/delete service calls in `ExplorerPanel`.
- Tests:
  - Existing explorer add/rename/delete tests pass.
  - New tests cover focus restoration to the explorer tree and disabled outside click for delete.
- Verification: focused explorer tests and `npm run lint:renderer`.

### Step 10: Migrate Memory Dialog

- Convert `SetMemoryDialog` to a result-based dialog body.
- Replace `MemoryPanel` local `isMemoryDialogOpen` with `await dialogs.open(...)`.
- Fix the current validation race where `enablePrimaryButton(valueValid)` can use stale state after `validate(val)`.
- Tests:
  - RAM edit resolves value, size option, and endian flag.
  - ROM view hides primary and only closes.
  - Async validation updates primary enablement correctly.
  - Dropdown portal works inside the modal.
- Verification: focused memory tests and `npm run build:check`.

### Step 11: Migrate IDE Shell Dialogs

- Convert `NewProjectDialog`, `ExportCodeDialog`, `ExcludedProjectItemsDialog`, and `FirstStartDialog`.
- Prefer pure result dialogs where practical, but keep side effects internal if extracting them would make the slice too large.
- Tests:
  - New project validates machine/template/folder/name and handles create success/failure.
  - Export validates all fields, persists settings, and handles success/error export output.
  - Excluded items load, remove, save, and dispatch the expected project excludes.
  - First start resolves OK and website actions, dispatching `startScreenDisplayedAction`.
- Verification: app shell tests, focused dialog tests, `npm run lint:renderer`, `npm run build:check`.

### Step 12: Migrate EMU Shell Dialogs

- Convert `CreateDiskDialog`, `Z88InsertCardDialog`, `Z88RemoveCardDialog`, `Z88ExportCardDialog`, and `Z88ChangeRamDialog`.
- Move machine/file side effects to callers when the result shape is simple; otherwise leave side effects in place for the first pass and remove them in a follow-up slice.
- Tests:
  - Create disk validates fields, handles success/failure, and keeps dropdown usable.
  - Z88 insert passes slot, validates card type/file, handles slot 0 replacement, and closes the flap on close.
  - Z88 remove passes slot, applies removal, handles slot 0 config, and uses confirmation dismissal policy.
  - Z88 export placeholder opens and closes without side effects.
  - Z88 RAM change derives initial size, shows running warning, updates config/output when changed, and no-ops when unchanged.
- Verification: app shell tests, new EMU dialog tests, `npm run build:check`.

### Step 13: Remove Legacy Modal API

- Remove `ModalApi`, `onApiLoaded`, `triggerPrimary`, `triggerSecondary`, `triggerCancel`, and button-enable mutation methods.
- Replace Enter-key imperative triggers with form submit or explicit dialog controls.
- Delete tests that only exercise the legacy API after equivalent dialog service tests exist.
- Verification: `rg "ModalApi|onApiLoaded|triggerPrimary|triggerSecondary|triggerCancel|enablePrimaryButton|enableSecondaryButton|enableCancel" src test` returns no active production usages.

### Step 14: Remove Redux Dialog State

- Remove `ideView.dialogToDisplay`, `ideView.dialogData`, `displayDialogAction`, `IdeDialogHost`, and `EmuDialogHost` only after command/menu/IPC callers no longer need the compatibility bridge.
- Update `DialogCommands` to call the dialog service bridge directly, or deliberately keep a command-specific compatibility registry outside Redux.
- Tests:
  - Public `display-dialog <dialogId>` behavior is replaced or intentionally removed with a release note.
  - Z88 toolbar actions open dialogs without Redux dialog state.
  - No reducers/actions reference dialog state.
- Verification: `rg "dialogToDisplay|dialogData|displayDialogAction|IdeDialogHost|EmuDialogHost" src test`.

### Step 15: Final Cross-Renderer Verification

- Run focused jsdom tests for controls, app shell, explorer, memory, and dialog-specific coverage.
- Run `npm run lint:renderer`.
- Run `npm run build:check`.
- Run `npx electron-vite build --config build/electron.vite.config.ts`.
- Manually smoke-test one IDE dialog and one EMU dialog in `npm run dev`.

## Proposed Test Matrix

- Unit tests for overlay stack ordering, topmost dismissal, and provider unmount cleanup.
- `ModalLayer` jsdom tests for Escape, Tab wrapping, focus restore, `aria-modal`, generated label IDs, disabled outside click, and close button policy.
- Integration tests for `ExplorerPanel` add/rename/delete, including focus returning to the tree after close.
- Integration tests for `MemoryPanel` set-memory dialog.
- App shell tests for IDE and EMU registered dialogs using the compatibility bridge.
- A regression test for a Radix `Dropdown` inside a modal, since `ExportCodeDialog` already contains one.

## Open Decisions

- Whether to use Radix Dialog primitives directly or keep a local implementation. Radix Select is already installed and brings focus-scope/dismissable-layer dependencies through its tree, but `@radix-ui/react-dialog` is not a direct dependency today. A local implementation avoids a new dependency; Radix Dialog would reduce subtle focus and accessibility risk.
- Whether global menu dimming should remain in Redux for main-process menu coordination, or become overlay-derived renderer state with a separate main-process notification only when needed.
- Whether `ExportCodeDialog` should continue executing export side effects internally or become a pure settings/result dialog.
- Whether non-modal overlays such as context menus should participate in the same stack for Escape handling, or only share the portal root and z-index allocator.

## Recommended Starting PRs

Start with three compatibility PRs before changing any dialog caller:

1. Inventory guard test for IDE and EMU dialog registries.
2. Shared overlay root with portal compatibility.
3. Modal accessibility and focus baseline behind the current `Modal` props.

These PRs fix the most user-visible modal flaws while keeping every existing dialog caller working. The result-based dialog service and per-dialog migrations should begin only after those foundations are covered by tests.

## Completion Status

Completed on 2026-07-26.

- Renderer dialogs now share `OverlayProvider` and `DialogProvider`.
- `Modal` owns portal, accessibility, focus, topmost Escape, and focus-restore behavior without the legacy mutable `ModalApi`.
- IDE, EMU, Explorer, and Memory dialog callers open dialogs through the dialog service or renderer dialog request bridge.
- Redux dialog state was removed: no `displayDialogAction`, `dialogToDisplay`, `dialogData`, `IdeDialogHost`, or `EmuDialogHost` remain.
- Main-process menus and public `display-dialog` command now route through renderer API/bridge calls.
- Step 15 verification passed with focused jsdom suites, renderer lint, type check, and Electron/Vite build.

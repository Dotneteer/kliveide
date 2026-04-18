# React Component Quality Refactoring Plan

## Refactoring / Fixing Flow

For each step, apply the following process:

1. **Change the files** according to the plan
2. **Create new test files** covering the changed behaviour
3. **Check linting** — ensure all new/updated files are free from Problems panel errors
4. **Run new tests** — fix failures before proceeding
5. **Run all tests** — fix any regressions before proceeding
6. **Mark the step complete** in this document
7. **Ask for approval** before moving on to the next step

---

## Executive Summary

Deep analysis of the React components in `/src/renderer/` reveals systematic quality issues across five categories: unnecessary rendering, performance problems, broken hook patterns, low reusability, and duplicated patterns. The most impactful issue is the custom `useSelector` implementation that creates new object references on every store dispatch, causing unnecessary re-renders across the entire application.

This plan is organized into **phases**, each containing self-contained, independently testable refactoring steps.

---

## Phase 0: Testing Infrastructure Setup

The project uses Vitest but has no React component tests (existing `Icon.test.tsx`, `IconButton.test.tsx`, `Stack.test.tsx` are empty). React Testing Library is not installed.

### Step 0.1 — Install React Testing Library

Install `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, and `jsdom`.

**Test**: Run `npm test` — existing tests should still pass.

### Step 0.2 — Configure Vitest for React component tests

- Add `environment: 'jsdom'` to `build/vitest.config.ts` (or create a separate config for component tests).
- Update `test/vitest.setup.ts` to import `@testing-library/jest-dom/vitest`.
- Extend the test include glob to also match `*.test.tsx` files.
- Verify the existing path aliases (`@controls`, `@renderer`, etc.) work for component imports.

**Test**: Write a trivial smoke test that renders a `<div>` and asserts it's in the document.

### Step 0.3 — Create test helpers

Create `test/react-test-utils.tsx` with:
- A `renderWithProviders()` wrapper that provides the custom store, theme context, and app services context — the minimum context most components need.
- A mock store factory (`createMockStore()`) using the existing `createAppStore("test")` from `redux-light.test.ts`.

**Test**: Render a simple component that calls `useSelector` and `useDispatch` inside the provider wrapper.

---

## Phase 1: Critical Bugs (Correctness)

These are bugs that cause incorrect behavior, not just performance issues.

### ✅ Step 1.1 — Fix `Modal.tsx` copy-paste bug

**File**: `src/renderer/controls/Modal.tsx`  
**Issue**: `triggerSecondary` and `triggerCancel` in the modal API both call `primaryClickHandler` instead of `secondaryClickHandler` and `cancelClickHandler` respectively.

```tsx
// BROKEN (current)
triggerSecondary: (result?: any) => primaryClickHandler(result),
triggerCancel: (result?: any) => primaryClickHandler(result),

// FIXED
triggerSecondary: (result?: any) => secondaryClickHandler(result),
triggerCancel: (result?: any) => cancelClickHandler(result),
```

**Test**: Unit test `Modal` with `onSecondaryClicked` and `onCancelClicked` callbacks. Trigger each via the API and verify the correct callback fires.

### ✅ Step 1.2 — Fix `Modal.tsx` useEffect with no dependency array

**File**: `src/renderer/controls/Modal.tsx`  
**Issue**: `useEffect(() => { store.dispatch(dimMenuAction(isOpen), messageSource); })` has no dependency array — it dispatches a Redux action on every render.

**Fix**: Add `[isOpen]` dependency array.

**Test**: Render `Modal` in a test, verify `dimMenuAction` is dispatched once on open and once on close, not on every re-render.

### ✅ Step 1.3 — Fix `Modal.tsx` cancelButtonEnabled dependency bug

**File**: `src/renderer/controls/Modal.tsx`  
**Issue**: The sync effect `[primaryEnabled, secondaryEnabled, cancelButtonEnabled]` lists the *state variable* `cancelButtonEnabled` instead of the *prop* in the dependency array, creating a self-referential loop.

**Fix**: Rename the prop or the state variable to avoid the naming collision, and use the prop in the dependency array.

**Test**: Render `Modal` with changing `cancelEnabled` prop; verify the cancel button enables/disables correctly.

### ✅ Step 1.4 — Fix `EmuStatusBar` event listener memory leak

**File**: `src/renderer/appEmu/StatusBar/EmuStatusBar.tsx`  
**Issue**: `useEffect` subscribes to `controller.frameCompleted` but never unsubscribes in the cleanup function. Each re-render adds another listener.

**Fix**: Return a cleanup function that calls `controller.frameCompleted.off(onFrameCompleted)`.

**Test**: Mount/unmount the component and verify no stale listeners remain (mock the controller).

### ✅ Step 1.5 — Fix `AttachedShadow` ResizeObserver leak

**File**: `src/renderer/controls/AttachedShadow.tsx`  
**Issue**: Creates a new `ResizeObserver` on `parentElement` change but only calls `unobserve`, not `disconnect`. Missing cleanup return.

**Fix**: Return a cleanup function that calls `observer.disconnect()`.

**Test**: Mount with a mock element, update `parentElement`, verify `disconnect()` is called on the old observer.

### ✅ Step 1.6 — Fix stale closure in keyboard `setVersion`

**Files**: `src/renderer/appEmu/Keyboard/Sp48Keyboard.tsx`, `Sp128Keyboard.tsx`, `NextKeyboard.tsx`, `Z88Keyboard.tsx`  
**Issue**: `setVersion(version + 1)` captures `version` from the closure, which may be stale.

**Fix**: Use functional updater: `setVersion(v => v + 1)`.

**Test**: Simulate rapid key presses and verify the version increments correctly each time.

### ✅ Step 1.7 — Fix `SplitPanel` Splitter event listener leak

**File**: `src/renderer/controls/SplitPanel.tsx`  
**Issue**: `move` and `endMove` are recreated each render. If the component re-renders while dragging, `removeEventListener` tries to remove a different function reference.

**Fix**: Store `move` and `endMove` in `useRef` or use `useCallback`.

**Test**: Render `SplitPanel`, simulate drag start, trigger a re-render mid-drag, verify mouse-up properly cleans up the listener.

---

## Phase 2: Core Performance — `useSelector` Fix

This is the single highest-impact change. Every component that calls `useSelector` is affected.

### ✅ Step 2.1 — Add shallow equality check to `useSelector`

**File**: `src/renderer/core/RendererProvider.tsx`  
**Issue**: The subscription callback always creates new references via `{...mappedState}` or `.slice(0)`, causing every subscriber to re-render on every dispatch regardless of whether their selected state changed.

**Fix**: Implement a `shallowEqual` comparator. Only call `setState` when the new mapped state differs from the previous value:

```tsx
export function useSelector<Selected>(
  stateMapper: (state: AppState) => Selected
): Selected {
  const store = useStore();
  const [state, setState] = useState(() => stateMapper(store.getState()));
  const prevRef = useRef(state);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const storeState = store.getState();
      if (!storeState) return;
      const nextState = stateMapper(storeState);
      if (!shallowEqual(prevRef.current, nextState)) {
        prevRef.current = nextState;
        setState(nextState);
      }
    });
    return () => unsubscribe();
  }, [store]);

  return state;
}
```

**Test**: 
- Unit test: create a store, subscribe with `useSelector(s => s.emuLoaded)`, dispatch an unrelated action, verify the component does NOT re-render.
- Unit test: dispatch a relevant action, verify the component DOES re-render with the new value.
- Run existing `redux-light.test.ts` to verify store behavior is unaffected.

### ✅ Step 2.2 — Fix `useDispatch` memoization

**File**: `src/renderer/core/RendererProvider.tsx`  
**Issue**: `dispatcher` is defined outside `useMemo`, so a new closure is created every call. The `useMemo` memoizes a reference to an already-stale function.

**Fix**: Move the dispatcher definition inside `useMemo`:

```tsx
export function useDispatch() {
  const store = useStore();
  return useMemo(
    () => (action: Action) => store.dispatch(action, messageSource),
    [store, messageSource]
  );
}
```

**Test**: Render a component that uses `useDispatch`, verify the returned dispatcher is referentially stable across re-renders.

---

## Phase 3: Hook Pattern Fixes

### ✅ Step 3.1 — Add dependency arrays to `useInitializeAsync` / `useInitialize`

**File**: `src/renderer/core/useInitializeAsync.ts`  
**Issue**: Both hooks have `useEffect` with no dependency array, running on every render (guarded by a ref).

**Fix**: Add `[]` as the dependency array.

**Test**: Render a component using `useInitializeAsync`, verify the callback runs exactly once.

### ✅ Step 3.2 — Fix `useEffect` dependency arrays in `useMachineController`

**File**: `src/renderer/core/useMachineController.ts`  
**Issue**: First `useEffect` has no dependency array. Also, cleanup sets `mounted.current = false` on every render.

**Fix**: Add `[]` dependency array to the mount effect. Ensure cleanup only runs on unmount.

**Test**: Mount a component using `useMachineController`, trigger re-renders, verify the setup code runs once and cleanup runs once on unmount.

### ✅ Step 3.3 — Fix `useResizeObserver` to accept stable callbacks

**File**: `src/renderer/core/useResizeObserver.ts`  
**Issue**: The dependency array includes `callback`, so if the caller passes an inline function, the observer is destroyed and recreated every render.

**Fix**: Store the callback in a ref so the observer is only recreated when the element changes:

```tsx
export function useResizeObserver(ref, callback) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const element = ref?.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => callbackRef.current(entries));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref?.current]);
}
```

**Test**: Render a component passing an inline callback to `useResizeObserver`, verify the observer is NOT recreated on re-render.

### ✅ Step 3.4 — Fix ref.current in useEffect dependency arrays

**Files**: `src/renderer/controls/VirtualizedList.tsx`, `ScrollViewer.tsx`, `Button.tsx`, `TextInput.tsx`, `IconButton.tsx`, `TabButton.tsx`, `src/renderer/appIde/SideBar/SideBar.tsx`, `SideBarPanel.tsx`  
**Issue**: `useEffect` depending on `ref.current` — ref mutations don't trigger re-renders, so these effects may not fire when expected.

**Fix**: Use a callback ref pattern or `useCallback` ref to trigger effects when the DOM element is assigned.

**Test**: For each affected component, render it and verify the effect's logic executes (e.g., tooltip registration, scroll behavior).

### ✅ Step 3.5 — Fix `ScriptingHistoryPanel` polling anti-pattern

**File**: `src/renderer/appIde/SiteBarPanels/ScriptingHistoryPanel.tsx`  
**Issue**: `useEffect` with no dependency array creates a manual polling loop via `setTimeout` and `setVersion(version + 1)`.

**Fix**: Use `useEffect` with `[]` and `setInterval` inside it, or create a `useInterval` custom hook.

**Test**: Mount the panel, verify it polls at the correct interval without runaway re-renders.

### ✅ Step 3.6 — Fix `ThemeProvider` setState inside useMemo

**File**: `src/renderer/theming/ThemeProvider.tsx`  
**Issue**: `setStyleProps(...)` is called inside `useMemo`, which is a state update during render — an anti-pattern.

**Fix**: Move the `setStyleProps` call to a `useEffect` that depends on the memoized theme value.

**Test**: Change the theme, verify styles are applied without double-render warnings in strict mode.

---

## Phase 4: Memoization for High-Impact Components

### Step 4.1 — Memoize `Icon` component ✅

**File**: `src/renderer/controls/Icon.tsx`  
**Issue**: Used hundreds of times, is a pure function of props, but not wrapped in `React.memo`.

**Fix**: Wrap with `React.memo`.

**Test**: Render an `Icon`, re-render the parent with unchanged props, verify `Icon` does not re-render (use React Profiler or render count ref).

### Step 4.2 — Memoize `IconButton` component ✅

**File**: `src/renderer/controls/IconButton.tsx`  
**Issue**: Used dozens of times in `Toolbar` alone, not memoized.

**Fix**: Wrap with `React.memo`. Extract inline event handlers into `useCallback`.

**Test**: Render `IconButton` inside a parent that re-renders, verify `IconButton` only re-renders when its props change.

### Step 4.3 — Memoize keyboard key components ✅

**Files**: `src/renderer/appEmu/Keyboard/Sp48Key.tsx`, `Sp128Key.tsx`, `Z88Key.tsx`  
**Issue**: 40-60 keys re-render on every keystroke (~960 new function allocations per render in Sp48Key alone).

**Fix**:
1. Wrap each Key component with `React.memo`.
2. Consolidate 5-6 `useState` hover states into CSS `:hover` pseudo-classes.
3. Extract inline SVG event handlers into `useCallback`.

**Test**: Render a keyboard, simulate pressing one key, verify only that key re-renders (not all 40+).

### Step 4.4 — Memoize `NextPaletteViewer` items ✅

**File**: `src/renderer/controls/NextPaletteViewer.tsx`  
**Issue**: 256 `PaletteItem` components all re-render when `selected` state changes.

**Fix**:
1. Wrap `PaletteItem` and `PaletteRow` with `React.memo`.
2. Lift inline callbacks (`onSelection`, `onRightClick`, `onPriority`) out of the `.map()` into `useCallback`.

**Test**: Render the palette viewer, change selection, verify only the previously-selected and newly-selected items re-render.

### Step 4.5 — Add useCallback to Toolbar handlers ✅

**File**: `src/renderer/controls/Toolbar.tsx`  
**Issue**: ~20 `IconButton` instances receive new `clicked` arrow functions every render.

**Fix**: Extract the inline `clicked` handlers into `useCallback` hooks. Consider splitting the Toolbar into sub-components (Play/Debug controls, View controls, etc.) to reduce the number of selectors per component.

**Test**: Render the Toolbar, dispatch an unrelated store action, verify IconButtons with unchanged state don't re-render.

---

## Phase 5: Eliminate Unnecessary State

### Step 5.1 — Convert derived state to useMemo/inline computation ✅

Replace `useState` + `useEffect` sync patterns with direct computation in these files:

| File | State to remove | Replace with |
|------|----------------|--------------|
| `VirtualizedList.tsx` | `itemsCount` | `const itemsCount = items?.length ?? 0` |
| `IdeStatusBar.tsx` | `machineState`, `compileStatus` | `useMemo` from `execState`/`compilation` |
| `ToolArea.tsx` | `activeInstance` | `useMemo(() => tools.find(...), [tools, activeTool])` |
| `ScrollViewer.tsx` | `customTheme` | `useMemo` from theme + `thinScrollBar` |
| `Dropdown.tsx` | `selectedValue` | Use `initialValue` prop directly or `useMemo` |
| `Toolbar.tsx` | `currentStartOption` | Derive from `startMode` inline |
| `EmulatorArea.tsx` | `currentKeyboardPanelHeight` | Use setting value directly |

**Test**: For each change, verify the component renders the same output before and after. Write a unit test for `VirtualizedList` with varying `items` arrays.

### Step 5.2 — Consolidate `MemMappingPanel` state ✅

**File**: `src/renderer/appIde/SiteBarPanels/MemMappingPanel.tsx`  
**Issue**: 11 separate `useState` calls for values from a single API response.

**Fix**: Replace with a single `useState<MemMappingState | null>(null)` and set the whole object from the API response.

**Test**: Render the panel, verify all mapping values display correctly.

### Step 5.3 — Replace hover useState with CSS :hover ✅ (ToolTab done; ActivityButton and keyboard keys deferred — icon fill is JS-driven via theme API, CSS-only not feasible)

**Files**: `src/renderer/appIde/ActivityBar/ActivityButton.tsx`, `ToolArea/ToolTab.tsx`, `src/renderer/appEmu/Keyboard/Sp48Key.tsx` (and similar)  
**Issue**: `[pointed, setPointed] = useState(false)` with `onMouseEnter`/`onMouseLeave` can be replaced with CSS.

**Fix**: Use CSS `:hover` pseudo-class for visual hover effects. Remove the state and event handlers.

**Test**: Verify hover styling still works visually (manual check), and verify reduced re-renders via profiling.

---

## Phase 6: Deduplicate Patterns

### Step 6.1 — Consolidate `Labels.tsx` and `generic/` component sets

**Files**: `src/renderer/controls/Labels.tsx` vs `src/renderer/controls/generic/Label.tsx`, `Value.tsx`, `Text.tsx`, `Flag.tsx`, `LabeledFlag.tsx`, `LabeledText.tsx`  
**Issue**: Two parallel sets of the same components with slightly different APIs.

**Fix**:
1. Audit all import sites for both sets.
2. Pick one set (prefer `generic/` as the canonical version).
3. Add any missing features from the old set to the canonical version.
4. Migrate all imports to the canonical version.
5. Delete `Labels.tsx` and the old individual files.

**Test**: Run full test suite after migration. Write smoke tests for the canonical components.

### Step 6.2 — Merge `BankDropdown` and `NextBankDropdown`

**Files**: `src/renderer/controls/new/BankDropdown.tsx`, `NextBankDropdown.tsx`  
**Issue**: ~80% identical code.

**Fix**: Create a single `BankDropdown` component that accepts an optional `specialItems` prop for ROM/DivMMC entries.

**Test**: Render both configurations and verify the dropdown shows the correct items.

### Step 6.3 — Extract `useThemeRoot` hook

**Files**: `src/renderer/controls/Dropdown.tsx`, `new/BankDropdown.tsx`, `new/NextBankDropdown.tsx`  
**Issue**: Identical `useEffect` to get `document.getElementById("themeRoot")` is duplicated 3 times.

**Fix**: Extract a `useThemeRoot()` custom hook.

**Test**: Use the hook in a test, verify it returns the theme root element.

### Step 6.4 — Extract keyboard boilerplate into a shared hook

**Files**: `Sp48Keyboard.tsx`, `Sp128Keyboard.tsx`, `NextKeyboard.tsx`, `Z88Keyboard.tsx`  
**Issue**: All four share identical mount/keystatus/version logic.

**Fix**: Create a `useKeyboard()` custom hook encapsulating `mounted`, `keystatus`, `version`, and the `api` object creation.

**Test**: Write unit tests for the hook using `renderHook()` from React Testing Library.

### Step 6.5 — Remove redundant `useEmuStateListener` + `useEffect` dual pattern

**Files**: 6+ sidebar panels (BreakpointsPanel, CallStackPanel, SysVarsPanel, NextRegPanel, MemMappingPanel, NecUpd765Panel)  
**Issue**: `useEffect` on `[machineState]` is redundant when `useEmuStateListener` already fires on state changes.

**Fix**: Remove the redundant `useEffect` on `[machineState]` in each panel.

**Test**: For each panel, verify data refreshes on machine state change with only `useEmuStateListener`.

### Step 6.6 — Replace renderer wrapper functions with component references

**Files**: All `*Panel.tsx` sidebar and tool panels  
**Issue**: Each exports a trivial `() => <Panel />` renderer function, creating a new component instance per call.

**Fix**: Register the component reference directly in the registry instead of wrapping in an arrow function.

**Test**: Verify panels still render in the sidebar after the registry change.

---

## Phase 7: Decompose God Components

### Step 7.1 — Split `EmulatorPanel` into sub-components

**File**: `src/renderer/appEmu/EmulatorArea/EmulatorPanel.tsx` (~600 lines, ~30 refs, ~10 state vars)  
**Issue**: Mixes screen rendering, keyboard handling, audio, recording, disk I/O, and machine state.

**Fix**: Extract into:
- `useEmulatorScreen()` — canvas rendering, dimensions
- `useEmulatorAudio()` — AudioContext management
- `useEmulatorKeyboard()` — key mapping, key event handlers
- `EmulatorOverlay` — pause/recording overlays

**Test**: Each extracted hook gets its own unit test. The `EmulatorPanel` integration test verifies all pieces work together.

### Step 7.2 — Split `Toolbar` into sub-components

**File**: `src/renderer/controls/Toolbar.tsx` (~400 lines, 15+ selectors)

**Fix**: Extract logical groups:
- `ExecutionControls` — play/pause/stop/debug buttons
- `ViewControls` — clock multiplier, sound toggle, etc.
- `StartModeSelector` — dropdown and related logic

**Test**: Each sub-component gets a unit test verifying it renders the correct buttons and responds to state changes.

### Step 7.3 — Replace `EmuApp` dialog if/else chain with registry

**File**: `src/renderer/appEmu/EmuApp.tsx`  
**Issue**: Growing if/else chain for dialog rendering.

**Fix**: Create a `dialogRegistry` mapping dialog type strings to component references, and render via `const DialogComponent = dialogRegistry[dialogType]`.

**Test**: Verify each dialog still renders when its type is dispatched.

---

## Phase 8: Component Testing Coverage

With the infrastructure from Phase 0, write component tests for the most critical components. Prioritize components that were refactored in earlier phases.

### Step 8.1 — Test `Modal` component

Test: open/close lifecycle, primary/secondary/cancel triggers, button enable/disable, keyboard escape, dim menu dispatch.

### Step 8.2 — Test `useSelector` hook

Test: initial value, updates on relevant dispatch, no update on irrelevant dispatch, cleanup on unmount.

### Step 8.3 — Test `SplitPanel` component

Test: renders two panes, splitter drag updates sizes, callback fires on resize complete.

### Step 8.4 — Test `Toolbar` sub-components (post-split)

Test: each button group renders correct icons, responds to clicks, disables when machine state requires it.

### Step 8.5 — Test `ScrollViewer` component

Test: renders children, scroll events propagate, theme changes apply.

### Step 8.6 — Test `VirtualizedList` component

Test: renders visible items, scrolling updates visible range, handles empty list.

### Step 8.7 — Test `Dropdown` component

Test: opens/closes, selects items, keyboard navigation.

### Step 8.8 — Test keyboard hook and key components

Test: key press/release calls correct handlers, rapid input works, visual feedback on hover.

---

## Priority Summary

| Priority | Phase | Impact | Risk |
|----------|-------|--------|------|
| **P0** | Phase 0 (Test infra) | Enables all other phases | Very Low |
| **P0** | Phase 1 (Bugs) | Fixes incorrect behavior | Low |
| **P1** | Phase 2 (useSelector) | Fixes app-wide unnecessary re-renders | Medium — touches core state hook |
| **P1** | Phase 3 (Hook fixes) | Prevents memory leaks and stale state | Low per fix |
| **P2** | Phase 4 (Memoization) | Reduces render cost in hot paths | Low |
| **P2** | Phase 5 (State cleanup) | Simplifies component logic, fewer re-renders | Low |
| **P3** | Phase 6 (Dedup) | Reduces maintenance burden | Medium — many files touched |
| **P3** | Phase 7 (Decompose) | Improves maintainability and testability | Medium — structural change |
| **P4** | Phase 8 (Tests) | Prevents regressions, builds confidence | Very Low |

---

## Notes

- **No E2E tests planned** — all tests are unit/component-level using Vitest + React Testing Library + jsdom.
- Each step is independently deployable and testable.
- Steps within a phase can generally be done in any order, except Step 0.1-0.3 which are sequential.
- After completing Phase 2, re-profile the application to measure the improvement before proceeding with Phase 4 memoization (the useSelector fix may eliminate much of the need).

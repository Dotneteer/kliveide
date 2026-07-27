# Memory View Refactor Plan

## Goals

- Make the live memory view faster and more predictable.
- Split `MemoryPanel.tsx` into small, testable view-model, refresh, persistence, toolbar, and rendering pieces.
- Consolidate the duplicate dump-section implementations without changing existing binary/static dump behavior accidentally.
- Preserve persisted memory editor settings, including legacy `twoColumns` view state.
- Add focused regression tests before changing behavior-heavy code.

## Current Findings

- `src/renderer/features/memory/MemoryPanel.tsx` mixes service access, machine setup, view-state migration, debounced project saves, emulator refresh, scrolling, toolbar rendering, bank selection, dialog opening, and virtualized row rendering.
- The panel stores memory bytes in a mutable ref. When `refreshMemoryView()` replaces `memory.current`, React does not always get a state update that forces visible rows to re-render. Refreshes triggered from `machineState` can update bytes without changing `memoryItems`, labels, or `scrollVersion`.
- Live `DumpSection` memoization compares bytes through `prev.memory[...]` and `next.memory[...]`, but both props can point to the same mutated `Uint8Array`. That makes byte-change detection unreliable.
- `MemoryPanel.tsx` lives in `features/memory`, but imports live `DumpSection` from `@renderer/appIde/DocumentPanels/DumpSection`. The feature folder also has a simpler `DumpSection.tsx`, so two components now have the same name and overlapping purpose.
- Machine initialization is coordinated through refs and polling (`machineSetupComplete`, `isInitializing`, `while` + `setTimeout`). This is fragile, hard to test, and can race with machine changes or unmount.
- Refreshes are dropped while one refresh is in progress. There is no trailing refresh/coalescing when a second refresh request arrives during an active emulator query.
- Several async effects and delayed callbacks do not have cancellation/cleanup. Bank selection waits three seconds before clearing the jump highlight; machine setup awaits emulator API calls after machine changes.
- `OptionsBar` is declared inside the panel and recreates handlers on every render. Some handlers use captured values such as `scrollVersion` and `topIndex` instead of functional updates.
- Row-address generation is stored in state even though it is derived from memory length and row size. `createDumpSections()` only compares generated array length, not the actual row bytes or source parameters.
- `src/renderer/appIde/DocumentPanels/DumpSection.tsx` measures text width by creating/removing DOM nodes in `useLayoutEffect` for each mounted row section. This is a likely performance hotspot and can be replaced with deterministic monospace geometry or a cached per-format measurement.
- Tooltip cache and character set are module-level globals in both dump-section implementations. They should be derived from the active machine character set in a hook or pure helper so tests and machine switches do not leak state.
- `src/renderer/features/memory/StaticMemoryDump.tsx` derives `items` through state/effects, but this can be pure memoized data. `MiniMemoryDump` omits `length` from its effect dependencies.

## Target Shape

Suggested files after the refactor:

- `src/renderer/features/memory/memoryViewTypes.ts`
- `src/renderer/features/memory/memoryViewModel.ts`
- `src/renderer/features/memory/useMemoryViewState.ts`
- `src/renderer/features/memory/useMemoryMachineSetup.ts`
- `src/renderer/features/memory/useMemoryRefresh.ts`
- `src/renderer/features/memory/MemoryToolbar.tsx`
- `src/renderer/features/memory/MemoryBankToolbar.tsx`
- `src/renderer/features/memory/MemoryRows.tsx`
- `src/renderer/features/memory/MemoryDumpSection.tsx`
- `src/renderer/features/memory/StaticMemoryDump.tsx`

Keep services under `appIde/services` unless a separate service migration is intended.

## Refactor Steps

1. Add characterization tests for pure memory helpers.
   - Extract `resolveViewMode`, bytes-per-row calculation, row-address generation, top-index conversion across view modes, bank option creation, partition selection, and pointed-register mapping into `memoryViewModel.ts`.
   - Preserve legacy `twoColumns` migration behavior.
   - Tests: `test/controls/MemoryViewModel.test.ts`.
   - Verification: `npm test -- --project node test/controls/MemoryViewModel.test.ts`.

2. Add renderer harness tests around current panel behavior.
   - Mock `VirtualizedList` to render a small visible window.
   - Mock `useEmuApi`, `useMainApi`, `useAppServices`, `useDocumentHubService`, and `useEmuStateListener`.
   - Cover initial 64K render, banked render, view mode changes, go-to address, set-memory dialog command, and refresh after paused/stopped emulator state.
   - Tests: `test/controls/MemoryPanelRefactor.test.tsx`.

3. [Completed] Extract and test persisted view-state handling.
   - Add `useMemoryViewState` or a pure view-state loader/saver around `BankedMemoryPanelViewState`.
   - Use the `document` prop rather than the current active document where practical.
   - Debounce save with cleanup and functional state updates.
   - Keep project save/version dispatch behavior unchanged.
   - Tests: legacy `twoColumns`, workspace defaults, debounce cancellation, save payload.

4. [Completed] Replace machine setup polling with a cancellable hook.
   - Extract `useMemoryMachineSetup(machineId, emuApi)` returning bank capability, bank matrix mode, ROM flags, partition labels, segment options, and default segment.
   - Use a request sequence or cancellation flag so stale async responses cannot update state after machine changes.
   - Stop overwriting a valid persisted/current segment unless the machine actually requires a different default.
   - Tests: ROM-only, RAM-bank-only, Z88/ZX Next matrix, stale request ignored.

5. [Completed] Extract refresh orchestration and make refreshes coalesced.
   - Add `useMemoryRefresh` that owns memory snapshot state, labels, pointed registers, and refresh status.
   - Move partition calculation into a pure helper.
   - If a refresh request arrives during an active refresh, record a pending request and run one trailing refresh afterward.
   - Expose a `memoryVersion` or immutable row snapshot so visible rows update when bytes change.
   - Tests: correct partition argument, pointed registers only while paused/stopped, byte-only refresh causes a row update, concurrent refreshes coalesce.

6. [Completed] Simplify row-address data.
   - Replace `memoryItems` state with `useMemo(() => createRowAddresses(memoryLength, bytesPerRow), [memoryLength, bytesPerRow])`.
   - Remove `cachedItems` unless profiling shows it is needed.
   - Tests: 64K/16K row counts for `8x1`, `8x2`, and `16x1`; switching view mode preserves approximate address.

7. [Completed] Extract toolbar components.
   - Move the primary controls to `MemoryToolbar`.
   - Move bank/full-view controls to `MemoryBankToolbar`.
   - Pass explicit values and callbacks; keep `allowRefresh` handling in a small controller hook or callbacks from the parent.
   - Use functional `setScrollVersion((v) => v + 1)` where a version bump remains necessary.
   - Tests: toggles call the right callbacks, dropdown open pauses refresh, address entry calculates the correct row.

8. [Completed] Replace the live dump-section import with a feature-owned component.
   - Move `src/renderer/appIde/DocumentPanels/DumpSection.tsx` to `src/renderer/features/memory/MemoryDumpSection.tsx`, or extract shared internals there and update direct imports.
   - Keep static/binary viewers on a compatibility-free direct import path, per feature-folder guidance.
   - After the move, scan alias and relative imports.
   - Verification: `npm run build:check` and `npx electron-vite build --config build/electron.vite.config.ts`.

9. [Completed] Make dump-section rendering byte-snapshot based.
   - Pass `bytes: readonly number[]` or a small `MemoryRowSection` object instead of the whole mutable `Uint8Array`.
   - Memoize rows by address, display options, pointed hints, ROM flag, jump highlight, and row bytes.
   - Remove memo comparators that inspect a mutable shared array.
   - Tests: changed byte re-renders only the affected section; unchanged row props do not re-render.

10. [Completed] Remove per-row DOM text measurement.
    - Prefer CSS `ch` units and fixed monospace geometry for byte hit-testing and overlays.
    - If exact measurement is still required, cache one measurement per display format/font instead of doing it per mounted `HexValues`.
    - Tests: hover index and context-menu address calculation in hex and decimal modes.
    - Manual check: hover highlight aligns in `8x1`, `8x2`, and `16x1`.

11. [Completed] Localize character-set and tooltip cache.
    - Add a `useMemoryCharacterInfo()` hook or pure `buildByteTooltipCache(charset)` helper.
    - Default safely when the active machine has no charset yet.
    - Remove module-level `characterSet` mutation from both dump-section implementations.
    - Tests: machine charset switch updates char dump/tooltip; missing charset does not throw.

12. [Completed] Clean up static memory dumps.
    - Make `StaticMemoryDump` and `MiniMemoryDump` derive row addresses with `useMemo`.
    - Include `length` in dependencies.
    - Use the `item` argument from `VirtualizedList.renderItem` instead of recomputing `16 * idx`.
    - Reuse the consolidated dump-section primitive in read-only mode.
    - Tests: static dump row count, go-to address scroll request, mini dump length changes.

13. Add performance guardrails.
    - Add a focused render-count test with mocked rows for byte-only refresh and toolbar changes.
    - Add an optional development-only measurement helper around refresh latency and visible row render count.
    - Keep thresholds loose enough for jsdom but strict enough to catch whole-list rerenders.

14. Final cleanup and verification.
    - Remove dead styles and unused props such as dump-section classes that no longer render.
    - Run `rg "console\\.log" src/renderer -n` and keep renderer cleanup rules.
    - Run focused memory tests, `npm run lint:renderer`, `npm run build:check`, and Electron/Vite build.
    - Smoke-test live memory view in `npm run dev`: initial open, pause refresh, running refresh cadence, bank switch, go-to, set memory, static dump.

## Suggested PR Order

1. Pure view-model helpers and tests.
2. Current-behavior `MemoryPanel` harness tests.
3. View-state and machine-setup hooks.
4. Refresh coalescing and memory snapshot/version state.
5. Toolbar extraction.
6. Dump-section consolidation and import cleanup.
7. Dump-section performance rewrite.
8. Static dump cleanup and final verification.

## Definition Of Done

- `MemoryPanel.tsx` composes hooks and child components instead of owning the whole workflow.
- Visible rows update reliably when memory bytes change, even when row counts and labels stay the same.
- Live and static memory dumps share one tested row/section renderer or clearly separated wrappers around the same primitive.
- Machine changes, unmounts, and delayed jump-highlight timers cannot update stale components.
- `npm run lint:renderer`, `npm run build:check`, focused memory tests, and Electron/Vite build pass.

# Disassembly Panel Optimization Plan

## Goals

- Add clarifying comments to the refactored Memory view code without changing behavior.
- Remove first-scroll flicker and scrollbar-drag churn from `DisassemblyPanel`.
- Bring `DisassemblyPanel` closer to the newer Memory view architecture: small helpers/hooks, stable virtualized rows, and focused tests.
- Keep every step small, reviewable, and testable.

## Current Findings

- `src/renderer/features/memory/MemoryPanel.tsx` now has several non-obvious performance choices:
  - `VirtualizedList` receives `itemSize` and `revealUnmeasuredItems`.
  - Scroll position is tracked in a ref during scroll and committed on scroll end.
  - Live rows use `MemoryDumpSectionView` directly to avoid per-row service/context reads.
  - Live row byte ranges use `subarray()` to avoid copying during fast virtualized row creation.
  These should be documented with short explanatory comments.
- `src/renderer/appIde/DocumentPanels/DisassemblyPanel.tsx` still mixes service access, machine/bank setup, view-state persistence, refresh orchestration, toolbar rendering, scroll handling, breakpoint lookup, and virtualized row rendering.
- `DisassemblyPanel` calls `setTopAddress(...)` inside `VirtualizedList.onScroll`.
  This can force React parent rerenders during every scrollbar-drag tick.
- The same `topAddress` state also participates in view-state persistence. This can trigger active document state saves, workspace setting updates, project saves, and project version increments during scrolling.
- The disassembly list does not pass `itemSize` or `revealUnmeasuredItems` to `VirtualizedList`.
- Breakpoint lookup is done with `breakpoints.current?.find(...)` inside every rendered row.
- Row display values such as partition label, opcode string, address text, label text, and breakpoint state are calculated inline in `renderItem`.
- `refreshDisassembly()` drops refresh requests while a refresh is active and uses several captured values that can go stale.
- Machine/bank setup and segment option creation duplicate patterns that have already been cleaned up in the Memory view.

## Refactor Steps

1. [Completed] Add MemoryPanel architecture comments.
   - Add short comments around:
     - service and machine-state setup
     - loaded/persisted view state
     - machine setup and refresh orchestration
     - `pendingScrollTopIndex` and `onScrollEnd`
     - `itemSize` and `revealUnmeasuredItems`
     - `MemoryDumpSectionView` and `subarray()` in the hot row-render path
   - Keep comments explanatory rather than line-by-line narration.
   - Verification: `npm run build:check`, `npm run lint:renderer -- --quiet`.

2. [Completed] Add DisassemblyPanel characterization tests.
   - Mock `VirtualizedList` to render a small visible window.
   - Mock `useEmuApi`, `useMainApi`, `useDocumentHubService`, `useSelector`, `useDispatch`, and `useEmuStateListener`.
   - Cover:
     - initial disassembly render
     - bank/full-view controls
     - Go To and PC scroll requests
     - breakpoint indicator inputs
     - scroll-position tracking
     - refresh after paused/stopped emulator state
   - Tests: `test/controls/DisassemblyPanelRefactor.test.tsx`.

3. [Completed] Move Disassembly scroll tracking out of the hot scroll path.
   - Replace `setTopAddress(...)` in `onScroll` with a ref update.
   - Commit `topAddress` only from `onScrollEnd`.
   - Avoid document/workspace/project persistence during native scroll ticks.
   - Tests:
     - scroll event does not rerender visible rows or save project state
     - scroll end commits the top address once
     - saved view state contains the final top address

4. [Completed] Give Disassembly stable virtualized rows.
   - Pass `itemSize` to `VirtualizedList`.
   - Use `revealUnmeasuredItems` for the fixed-height disassembly list.
   - Set a stable row height in the row wrapper/style.
   - Tests:
     - list receives `itemSize`
     - list receives `revealUnmeasuredItems`
     - first rendered rows keep the expected content

5. [Completed] Extract disassembly view-state persistence.
   - Add a hook similar to Memory view persistence.
   - Debounce saves and clean up pending timers on unmount.
   - Use the document prop directly where practical.
   - Keep workspace setting and project version behavior unchanged.
   - Tests:
     - initial state loads from document/workspace
     - save payload is correct
     - rapid changes coalesce into one save
     - unmount cancels delayed saves

6. [Completed] Extract machine and bank setup.
   - Add `useDisassemblyMachineSetup(machineId, emuApi)` or pure helpers for:
     - `allowViews`
     - ROM/bank availability
     - bank matrix mode
     - partition labels
     - segment options
     - default segment behavior
   - Use cancellation or request sequencing so stale async labels cannot update after machine changes.
   - Tests:
     - no-bank/no-ROM full view
     - ROM-only
     - RAM-bank-only
     - Z88 and ZX Next bank matrix modes
     - stale request ignored

7. [Completed] Extract refresh orchestration.
   - Add `useDisassemblyRefresh` that owns:
     - `items`
     - `breakpoints`
     - `pausedPc`
     - `mem64kLabels`
     - refresh status/version
   - Coalesce overlapping refresh requests with one trailing refresh, like Memory view.
   - Build memory sections in pure helpers.
   - Keep custom disassembler support.
   - Tests:
     - full-view partition argument
     - banked partition argument
     - Follow PC one-KB section behavior
     - manual sections from `getDisassemblySections`
     - custom disassembler wiring
     - overlapping refresh coalescing

8. [Completed] Optimize row rendering.
   - Build a breakpoint lookup map once per refresh.
   - Extract row display derivation to a pure helper:
     - partition label
     - address text
     - opcode text
     - label text
     - breakpoint/current-PC flags
   - Extract `DisassemblyRow` and memoize it by item identity, breakpoint entry, view flags, partition label, and PC.
   - Tests:
     - breakpoint lookup by address and resolved address
     - opcode formatting in hex/decimal
     - partition label formatting in hex/decimal
     - changed breakpoint/PC updates only affected visible rows where practical

9. [Completed] Extract toolbar components.
   - Add `DisassemblyToolbar` and `DisassemblyBankToolbar`.
   - Pass explicit values and callbacks.
   - Use functional state updates where version bumps remain.
   - Tests:
     - toggles call the expected callbacks
     - Refresh button triggers refresh and status message
     - Go To submits the correct address
     - bank/offset dropdown changes call the expected callbacks

10. [Completed] Final cleanup and verification.
    - Remove duplicated or outdated comments.
    - Remove unused imports and dead styles.
    - Run `rg "console\\.log" src/renderer -n`.
    - Run focused Disassembly and Memory tests.
    - Run `npm run build:check`.
    - Run `npm run lint:renderer -- --quiet`.
    - Run `npx electron-vite build --config build/electron.vite.config.ts`.
    - Manual smoke:
      - open Disassembly view
      - quickly drag scrollbar to the bottom on first open
      - scroll back up
      - toggle Follow PC
      - use Go To
      - switch bank/full view
      - refresh manually

## Suggested PR Order

1. MemoryPanel comments only.
2. Disassembly characterization tests.
3. Scroll hot-path fix and stable virtualized row sizing.
4. View-state persistence extraction.
5. Machine/bank setup extraction.
6. Refresh hook extraction.
7. Row rendering extraction and breakpoint lookup map.
8. Toolbar extraction and final cleanup.

## Definition Of Done

- MemoryPanel has concise comments explaining the new performance-sensitive structure.
- Disassembly scrolling does not update React state or save project state on every scroll tick.
- Disassembly uses stable virtualized row sizing and reveals fixed-height unmeasured rows immediately.
- Refresh requests are coalesced and stale async updates are ignored.
- Breakpoint and row display derivation are not recomputed expensively inside every row render.
- Focused tests cover the scroll fix, row rendering, refresh behavior, and view-state persistence.
- `npm run build:check`, `npm run lint:renderer -- --quiet`, focused tests, and Electron/Vite build pass.

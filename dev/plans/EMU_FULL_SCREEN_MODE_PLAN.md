# Emulator Full Screen Mode Plan

**Status: approved (2026-11-14).** Nothing is implemented yet. The decisions are in §3 (Q1-Q4, all
settled by the project author); Q2 still has to be confirmed by the Phase 0 spike.

A full screen mode for the emulator window that shows only the machine: the emulator picture and, when
it is switched on, the virtual keyboard. The toolbar, the status bar and the machine's tool strip (the
media strip and its relatives) are gone. The toolbar slides in when the mouse reaches the top edge of
the screen, and the status bar slides in when it reaches the bottom edge, whether the View menu has them
switched on or off. One shortcut key enters the mode and the same key leaves it.

## 1. What exists today

| Part | Where | Notes |
|---|---|---|
| Window layout | `src/renderer/appEmu/EmuApp.tsx` | `FullPanel` column: `Toolbar` (if `SETTING_EMU_SHOW_TOOLBAR`), `EmulatorArea`, `EmuStatusBar` (`show={SETTING_EMU_SHOW_STATUS_BAR}`), `BackDrop`. |
| Picture and keyboard | `src/renderer/features/emulator/EmulatorArea.tsx` | `SplitPanel`: `KeyboardPanel` at the bottom (`SETTING_EMU_SHOW_KEYBOARD`, per-machine heights), `EmulatorPanel` above. |
| Tool strip ("media information") | `EmulatorPanel.tsx` (`styles.toolArea`), registry in `src/renderer/appEmu/tool-registry.tsx` | Spectrum-family/HT-1080Z/TVC media strip (`SETTING_EMU_SHOW_MEDIA_INFO`), the Z88's slot cards (always on), the Next's Layers strip (`SETTING_EMU_SHOW_NEXT_LAYERS`). |
| OS full screen | `src/main/menus/view-menu.ts`, `toggle_full_screen` | **View › Toggle Full Screen**, accelerator `shortcuts.fullScreen` (default `Ctrl+Shift+F9`, `src/main/app-menu.ts`). Calls `setFullScreen` on the focused window only; the chrome stays. |
| Window state | `src/main/WindowStateManager.ts` | Saves and restores `isFullScreen` for the emulator window. |
| Fit commands | `view-menu.ts`, `src/main/emu-window-sizing.ts` | Already disabled / no-op while the window is full screen. |
| Renderer-side hotkeys | `useEmulatorMouse.ts` (Ctrl/Cmd+M) | Pattern for a chord the machine must never see: `stopImmediatePropagation`, hook order matters. |
| Motion tokens | `src/renderer/theming/tokens/dimensions.ts` | `--duration-fast` (80ms), `--duration-base` (140ms), `--ease-standard`, `--ease-out`; `Z.overlay`. |
| Popups from the toolbar | `ToolbarSplitButton.tsx`, `Dropdown.tsx` | Rendered through portals, outside the toolbar's DOM: the reveal logic must count them as "inside". |

## 2. Behaviour (the specification)

### 2.1 Entering and leaving

- **Shortcut**: View › Toggle Full Screen (`shortcuts.fullScreen`, default `Ctrl+Shift+F9`, Q1) toggles
  the mode while the emulator window has focus.
- Entering: remember whether the window was already OS full screen, then `emuWindow.setFullScreen(true)`
  and switch the renderer to the mode.
- Leaving with the shortcut or the menu item: switch the renderer back, and leave OS full screen only if
  the window was not full screen before entering.
- Leaving by any other route (macOS green button, `Ctrl+Cmd+F`, the OS's own gesture, `Toggle Full
  Screen`) also ends the mode: the main process listens to the window's `leave-full-screen` event.
- **Escape does not leave the mode.** It is a machine key (BREAK/EDIT on several keyboards); taking it
  would break programs. The shortcut is the only key.
- While the machine has the mouse captured (Ctrl/Cmd+M) the mode still toggles; the capture is kept.

### 2.2 What is shown

| Part | In the mode |
|---|---|
| Emulator picture | Shown; fills all the room the window has (minus the keyboard). |
| Virtual keyboard | Follows `SETTING_EMU_SHOW_KEYBOARD` as now, with its saved height. View › Virtual Keyboard still toggles it. |
| Tool strip | Hidden, whatever its setting: the media strip, the Z88's cards and the Next's Layers strip (Q3). |
| Toolbar | Not in the layout. Slides in over the top of the picture on demand (§2.3), even when `SETTING_EMU_SHOW_TOOLBAR` is off. |
| Status bar | Not in the layout. Slides in over the bottom on demand, even when `SETTING_EMU_SHOW_STATUS_BAR` is off. Performance info follows `SETTING_EMU_SHOW_PERFORMANCE_INFO` as now. |
| Overlays (pause/debug pill, beam position, recording state, layer overlay) | Unchanged: they belong to the picture. |

None of the settings change: leaving the mode restores exactly the layout the settings describe.

The revealed bars **overlay** the picture; they never push it. The picture must not rescale when a bar
appears, or the emulated screen would jump every time the mouse touches an edge.

### 2.3 Revealing the bars

- **Hot zones**: a strip at the top and a strip at the bottom of the window, a few pixels high (start
  with 4px; a named constant, tuned in Phase 3). With the keyboard shown, the bottom zone is still the
  bottom edge of the window, and the status bar slides over the keyboard.
- **Reveal**: the pointer stays in a zone for a short dwell (start with ~120ms) so a mouse crossing the
  edge on its way elsewhere does not flash the bar. The bar slides in (`transform: translateY`, ~140ms,
  `--ease-out`).
- **Stay**: while the pointer is over the bar, or a popup opened from it (split-button menu, dropdown,
  overflow menu) is open, or a dialog opened from it is up (`dimMenu`).
- **Hide**: after the pointer leaves the bar and its popups, with a grace delay (start with ~600ms),
  sliding out. Leaving the window (pointer out of the document) hides at once.
- **Captured mouse**: no reveal while the mouse is captured (the pointer does not move on screen, and
  machine mouse movement must not open the bars). A bar already shown hides on capture.
- **Reduced motion**: with `prefers-reduced-motion: reduce` the bars appear and disappear without sliding.
- **Focus**: clicking a toolbar button must not leave keyboard focus on the toolbar: the machine keeps
  receiving keys (check how the normal toolbar already behaves; match it).
- **Cursor**: no change in this plan (an idle-cursor auto-hide is a possible follow-up, not part of it).

### 2.4 Persistence

The mode is a session state, not a setting (Q4). The OS full screen state keeps being saved and restored
by `WindowStateManager` exactly as today.

## 3. Decisions

- **Q1. Which shortcut? Decided (2026-11-14): reuse it.** View › Toggle Full Screen and its
  `shortcuts.fullScreen` key (`Ctrl+Shift+F9`): on the emulator window it now enters and leaves this
  mode; on the IDE window it stays plain OS full screen. One item, one key, no new setting. The emulator
  window has no plain OS full screen command any more (the OS's own controls still give one, and using
  them while in the mode ends the mode, §2.1).
- **Q2. macOS menu bar. Decided (2026-11-14): `setSimpleFullScreen` on macOS**, subject to the Phase 0
  spike. In native macOS full screen, the pointer at the top edge also slides down the system menu bar
  over our toolbar; simple full screen (no separate Space, presentation options under our control) avoids
  that. The mode enters and leaves with `setSimpleFullScreen` on macOS and `setFullScreen` elsewhere; the
  "was already full screen" check and the external-exit handling cover both. If the spike shows simple
  full screen misbehaves, fall back to native full screen with the toolbar placed under the menu bar
  while it shows, and record why here.
- **Q3. Which strips hide? Decided (2026-11-14): all of the tool strip** (the media strip, the Z88's slot
  cards, the Next's Layers strip).
- **Q4. Remember the mode across restarts? Decided (2026-11-14): no.** The window comes back OS full
  screen (as today) with the normal chrome. Simple full screen on macOS is not saved by
  `WindowStateManager` (it reads `isFullScreen()`), so a Mac window quit in the mode comes back in its
  normal size: acceptable, and Phase 1 checks the saved bounds are the pre-mode ones, not the screen's.

## 4. Design

### 4.1 State

- `AppState.emuFullScreenMode?: boolean` with `setEmuFullScreenModeAction(flag)` in
  `src/common/state/actions.ts` and its reducer, like `dimMenu`. The main process owns it; the emulator
  renderer reads it with `useSelector`. The menu builder reads it for the checkbox.
- Main-process module `src/main/emu-full-screen-mode.ts`: `toggleEmuFullScreenMode(emuWindow)`,
  `exitEmuFullScreenMode(...)`, the "was already full screen" memory, and the `leave-full-screen`
  listener registered where the emulator window is created (`src/main/index.ts`). On macOS, the Q2
  decision lives here too.

### 4.2 Reveal model (pure, testable)

`src/renderer/appEmu/fullScreen/fullScreenChromeModel.ts`: a reducer-style model with no DOM:
inputs are pointer position + window height + time, pointer-over-bar, popup-open, dialog-open,
captured, window-leave; outputs are `{ toolbar: "hidden" | "pending" | "shown" | "leaving", statusBar: ... }`
and the next timer deadline. Constants (zone height, dwell, grace) exported from here.

`useFullScreenChrome()` hook wires it to `document` `mousemove`/`mouseleave`, a single timer, and the
captured-mouse state. The popup-open signal comes from the existing toolbar popups (a small context or a
`data-` attribute check on the overlay root; decide in Phase 2 after reading `ToolbarSplitButton`,
`ToolbarOverflow` and `Dropdown`).

### 4.3 Layout

`EmuApp.tsx` branches on the mode:

- normal: unchanged.
- full screen: `EmulatorArea` fills the window; `Toolbar` and `EmuStatusBar` are rendered inside two
  absolutely positioned slide containers (`FullScreenChrome.module.scss`), `z-index` from `Z.overlay`
  layer tokens, transitions from the motion tokens, no colour literals (tokens only).
- `EmulatorPanel` gets a `hideToolStrip` input (or reads the mode itself) so the tool strip is not
  rendered, and its dimension calculation sees the extra room.
- `EmuStatusBar` gets rendered with `show` forced on inside the slide container. The status bar's
  stats subscription runs only while it is revealed (it already skips work when hidden: keep that).

The bars must keep their normal height and width behaviour; the toolbar's overflow measuring must work
in the overlay (it spans the window width).

### 4.4 Menu

- `view-menu.ts` (Q1): the existing `toggle_full_screen` item keeps its label and accelerator; its click
  calls `toggleEmuFullScreenMode(emuWindow)` when the emulator window has focus and `setFullScreen` on
  the IDE window otherwise. No second item.
- New UI text through `t()` in `src/common/i18n/locales/en/menu.json` with translator context, then
  `npm run i18n:keys`.

## 5. Phases

### Phase 0: spike (no shipped code)

- On macOS, Windows and Linux: native `setFullScreen` vs macOS `setSimpleFullScreen`; what the top edge
  does; whether `mousemove` reaches the page at `clientY = 0` and at the last row in full screen; the
  `leave-full-screen` event for each exit route. Record the results here and confirm Q2 (or take its
  fallback).

### Phase 1: the mode without reveal

- State, action, reducer; `emu-full-screen-mode.ts`; menu item and shortcut; `leave-full-screen`
  handling; renderer layout without toolbar, status bar and tool strip.
- Tests: reducer; menu structure (`test/main/app-menu-structure.test.ts` style) for the item, its
  visibility and checked state; the main-process toggle logic with a fake window (enter/leave, "was
  already full screen", external exit); jsdom render of `EmuApp` in both modes (bars and strip absent,
  keyboard follows its setting).

### Phase 2: reveal

- `fullScreenChromeModel.ts` + `useFullScreenChrome`; slide containers and styles; popups and dialogs
  keep the bar; captured mouse suppresses; reduced motion.
- Tests: the model exhaustively with fake time (zone entry, dwell cut short, grace, popup open, capture,
  window leave, both bars independent); jsdom: a revealed bar renders even with its setting off.

### Phase 3: polish and verification

- Tune zone/dwell/grace in the running app on all three platforms; check every machine's picture does
  not rescale on reveal; check the Z88 and Next with their strips; keyboard shown and hidden; mouse
  capture on the Next; recording overlay.
- Docs: `docs/content/en/guides/emulator/emulator-window.mdx` (View menu section and a short "Full
  screen" section) and `docs/content/en/guides/customizing/shortcuts.mdx`; a generated screenshot via a
  `guides-*` doc-shot recipe if a picture helps.
- `dev/ai/ui-theming-intent-and-lessons.md`: the durable rule (chrome that overlays the picture never
  resizes it; motion from the tokens; reduced motion respected).
- Changeset (`feature`) with the commit that completes the plan; `npm run lint:renderer`,
  `npm run build:check`, `npm test`.

## 6. Risks

- **Picture rescale on reveal**: guarded by overlaying, and by a test that the emulator area's size does
  not depend on the reveal state.
- **Keys leaking to the machine**: the shortcut is a menu accelerator; confirm the chord does not reach
  `useEmulatorKeyboard` as machine keys (F9 is unmapped on current keyboards; check the key mappings).
- **macOS menu bar collision**: Q2 / Phase 0.
- **Portal popups** closing the bar under the pointer: explicit popup-open signal (§4.2).

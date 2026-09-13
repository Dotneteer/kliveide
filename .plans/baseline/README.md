# Phase 0.0 — Visual baseline

Captured **2026-09-06**, before any Phase 0 change. Reference for every later phase's screenshot
diff (§6.0, §7). Nothing in CI catches visual regressions, so these are the only "before" we get.

## Conditions — reproduce these exactly or the diffs are meaningless

| | |
|---|---|
| Branch / commit | `dotneteer/ui-modernize` @ `3aa8abc5e` |
| Project loaded | `~/KliveProjects/sp48-1`, machine `sp48` / model `pal` |
| Machine state | **Stopped** ("Not yet started" overlay) — deterministic; a running machine changes every frame |
| IDE window | **1280 × 860** (CSS viewport 1280 × 828) |
| Emu window | **720 × 860** (CSS viewport 720 × 828) |
| Device pixel ratio | 2 — PNGs are 2560 × 1656 and 1440 × 1656 |
| Open document | `code/code.kz80.asm`, cursor Ln 23 Col 33 |

## Files

| File | Shows |
|---|---|
| `ide-dark-01.png` / `ide-light-01.png` | Toolbar, activity bar, Explorer sidebar, tab strip, editor, OUTPUT tool tab, status bar |
| `ide-dark-02-debug.png` / `ide-light-02-debug.png` | Debug sidebar — Z80 CPU, Call Stack, ULA & I/O, Watch, Breakpoints. **The Phase 6–7 target.** |
| `ide-dark-03-commands.png` | COMMANDS tool tab with the command prompt |
| `emu-dark-01.png` / `emu-light-01.png` | Emulator toolbar, screen area, keyboard, status bar |

**Missing: `ide-light-03-commands.png`.** The CDP connection wedged after repeated attach/detach
cycles and would not recover without restarting the app; the dark equivalent exists, and the light
shell is covered by `ide-light-01/02`. Capture it at the start of Phase 0.1 if a light-mode command
prompt reference is wanted — see the flakiness note below.


## Capture state is a fixture — drive to it explicitly

Every image below was taken in a specific UI state, and comparing across mismatched states produces
differences of 20%+ that look like catastrophic regressions but are not (this cost real time in
Phase 0.3). **Before capturing, drive the app to the state you want rather than inheriting whatever
the previous step left behind.** Three specific traps:

- **Clicking an already-active activity-bar button collapses the sidebar** (VS Code behaviour).
  Check `className` for `active` before clicking, or you will remove a 212px column.
- **The sidebar activity and the tool-area tab survive a theme switch**, so a light capture inherits
  whatever the dark run selected.
- **Monaco's minimap slider and scrollbar render only on mouse interaction**, so an image captured
  after mouse movement differs from one captured cold. Roughly 0.6% of the IDE frame.

State per image: `*-01` = Explorer sidebar + OUTPUT tool tab. `*-02-debug` = Debug sidebar
(Z80 CPU / Call Stack / ULA & I/O / Watch / Breakpoints) — dark with OUTPUT, **light with COMMANDS**.
`ide-dark-03-commands` = Explorer + COMMANDS.

Diffing: `.plans/baseline/imgdiff.py <a.png> <b.png> [crop.png]` reports changed-pixel count, max
channel delta and a bounding box. **The renderer is deterministic — the noise floor is zero**, so a
non-zero diff is either a real change, an unsettled capture, or a state mismatch. Never write one off
as antialiasing.

## How to re-capture

`screencapture` is **not** usable here — this environment lacks macOS Screen Recording permission
("could not create image from display"). Capture goes through Electron's own remote debugging
instead, which needs no OS permission and grabs the renderer directly.

```bash
npx electron-vite dev --config build/electron.vite.config.ts --remoteDebuggingPort=9222
node .plans/baseline/capture.mjs <outDir> <suffix>          # both windows
node .plans/baseline/drive.mjs ide '<js>' <outFile> <waitMs> # click, then capture
```

**Theme switching must go through the application menu**, not the settings file: the app rewrites
`~/Klive/klive.settings` during startup, so a hand-edited `theme` value is silently reverted. Use:

```bash
osascript -e 'tell application "System Events" to tell process "Electron" to click menu item "Light" of menu 1 of menu item "Themes" of menu 1 of menu bar item "View" of menu bar 1'
```

(The app must be frontmost first — `set frontmost of process "Electron" to true`.)

**Back up `~/Klive/klive.settings` before capturing** and restore it afterwards; window sizes are
persisted there and the capture changes them.

**CDP flakiness.** Repeated connect/disconnect cycles can wedge the DevTools endpoint: `/json/list`
keeps answering but new WebSocket sessions never complete a command. Both scripts now end with an
explicit `process.exit(0)` so a stray node process cannot hold a session open, but if commands start
hanging, kill any `drive.mjs`/`capture.mjs` processes and restart the app rather than retrying.
Prefer **one script invocation per app launch** doing all its clicks and captures in sequence.

## What the baseline already confirms

Every one of these was found by reading code in §2; the screenshots are the visual proof:

- **The `EmuStatusBar` font-size collision (§2.3)** is plainly visible — `00.000 / 00.000` and
  `PC: 0000` render at 16px next to `ZX Spectrum 48K (3.500 MHz)` at 12.8px, in the same bar.
- **The activity bar's active item is a solid blue fill** of the whole 48px cell, not an accent
  stripe (§4.1).
- **The emulator screen has no bezel, radius or shadow** — a bare canvas on flat `#606060` (§4.5).
- **The keyboard is a black slab in light mode**, near-identical to dark — which §8.2.1 now ratifies
  as intentional device surfacing rather than treating as a bug.
- **The "Not yet started" overlay stays dark with green text in light mode** — the hardcoded
  `#303030` / `lightgreen` that ignores the theme (§2.4).
- **The Z80 CPU panel is clipped mid-row**, and its amber labels (`AF`, `BC`, `DE`…) sit beside blue
  values — the exact `--color-label` / `--color-value` pairing that §5.2 re-casts as a hierarchy.
- **Empty states render in green** (`No watch expressions defined`, `No breakpoints defined`),
  reaching for `--console-ansi-*` instead of a semantic token (§2.4).

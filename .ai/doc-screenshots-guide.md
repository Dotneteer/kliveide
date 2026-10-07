# Driving Klive For Screenshots And Verification

How to launch Klive under program control, put it into a chosen state, and capture exactly
the region you want. Written for documentation screenshots, but the launch-and-drive half
is the general answer to "check this in the running app" and is cheaper than the CDP
recipe in `ui-theming-intent-and-lessons.md`.

Everything below was verified in a working session, not inferred. Where something was
*not* tested, it says so.

## The harness

`scripts/doc-shots/` — `harness.cjs` (launch, drive, capture), `run.cjs` (runner),
`recipes/` (one file per docs page). Requires a build in `out/`; it does not build for
you, and a stale `out/` silently screenshots old code.

```bash
npx electron-vite build --config build/electron.vite.config.ts   # out/ must be current
node scripts/doc-shots/run.cjs scripting                         # one recipe, or all
```

Output stages to `.doc-shots/` (gitignored) for review. `DOC_SHOTS_OUT=docs/public/images`
publishes over the committed assets; git diff is then the review.

## Why Playwright's Electron driver

`_electron.launch({ executablePath: require("electron"), args: ["out/main/index.js"] })`
returns each `BrowserWindow` as a Playwright `Page`. It needs no CDP port, no hand-launched
dev server, and no macOS Screen Recording permission — which matters, because
`screencapture` is permission-blocked in this environment and window-id targeting is
fragile besides.

It complements, and does not replace, `.plans/baseline/`:

| | `.plans/baseline/` (CDP) | `scripts/doc-shots/` (Playwright) |
|---|---|---|
| Target | An app you launched by hand | Launches its own isolated instance |
| State | Whatever your profile holds | Seeded, reproducible |
| Capture | Whole window | Any element, by selector |
| Best for | Poking at a session already open | Repeatable shots, before/after comparison |

`playwright` is a root devDependency. Install it with
`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` — only the Electron driver is used, never a bundled
browser. `sharp` is resolved from `docs/node_modules` (docs tooling; not duplicated at the
root), so `npm run doc:install` must have run.

## Determinism: seed the settings file before launch

`KLIVE_SETTINGS_FILE` (absolute path; `src/main/settings-path.ts`) points the process at a
throwaway settings file. **Write that file before launching and the app honours it.** This
pins, all verified by measurement:

- `theme` — seeding `"light"` vs `"dark"` moved mean window brightness from 26/255 to
  246/255.
- `accent` — seeding `phosphorGreen` vs `sinclairBlue` flipped the dominant channel of the
  window from blue to green. A real but small shift; accent touches few pixels.
- `globalSettings.ideViewOptions.sideBarWidth` / `.toolPanelHeight` — CSS strings
  (`"260px"`, `"33%"`). Visibly resized the captured tool area from 160 to 260 logical px.
- `globalSettings.editorOptions` / `.panelOptions` — `fontFamily` and `fontSize`, so a
  developer's font settings cannot change a screenshot's line wrapping.
- `startScreenDisplayed: true` — **required.** Without it the first-start dialog opens a
  modal backdrop that swallows every click, and recipes fail in a way that looks like a
  broken selector.

> **This corrects a claim in `ui-theming-intent-and-lessons.md`** ("Operational
> Knowledge") that `klive.settings` is rewritten at startup and cannot be used to set the
> theme or accent. That holds for editing the *live* `~/Klive/klive.settings` of an
> instance that is running or has run — it writes its own state back. It does not hold for
> a fresh file created before launch and pointed at by `KLIVE_SETTINGS_FILE`, which is what
> the harness does. Use the menu for a running app; seed the file for a scripted one.

Geometry that is not in settings is set through `app.evaluate` on the `BrowserWindow`:
`setContentSize(1280, 820)`, `setPosition`, `focus()`, and `hide()` on the EMU window so it
cannot overlap the IDE. Screenshots come out at the display's DPR — 2x on a retina Mac,
matching the 144 dpi of the hand-captured assets.

## Drive through the IDE's command prompt, not the mouse

The single most useful discovery. The interactive prompt
(`input[class*="_prompt_"]`) accepts the IDE's full command set, so a recipe is a list of
typed commands rather than a pile of coordinates that rot when the layout moves:

| Command | Does |
|---|---|
| `newp <machineId> <name> [<template>] -p <folder> -o` | Creates a project and opens it. The folder is the **named option `-p`**, not positional. The template is a folder name under `src/public/project-templates/<machineId>/` (`zx-basic`, `sjasmplus`, …; `default` when omitted). `-o` is what opens it. |
| `open <folder>` | Opens an existing folder |
| `outp <paneId>` | Selects an output pane *and* switches the tool area to the OUTPUT tab. Pane ids: `emu`, `build`, `scripting` — **not** the `SCRIPT_OUTPUT_VIEWER` constant, which is a document id. |
| `script-run <path>` | Runs a script |
| `cls` | Clears the command pane, so shots start clean |
| `set [-u|-p] <key> <value>` | User/project settings — **not global ones.** Panel sizes live in `globalSettings` and must be seeded; `set -u ideViewOptions.toolPanelHeight` looks like it succeeds and changes nothing. |

Machine ids are in `src/common/machines/constants.ts` (`sp48`, …). The full command list is
`src/renderer/appIde/commands/`.

## Selectors

CSS-module class names carry a content hash that changes with the stylesheet
(`_toolArea_vexl8_9`), so **always match by prefix**: `[class*="_toolArea_"]`. There are
only ~26 `data-testid`s in the renderer, none on the tool area. Useful anchors found so
far: `_toolArea_`, `_commandPanel_`, `_outputWrapper_`, `_prompt_`, `_sideBarPanel_`,
`_toolsHeader_`, `_backDrop_` (a visible one means a modal is eating your clicks).

Prefer `locator.screenshot()` over a clipped page shot: the crop then follows the layout
instead of being a pixel rectangle that silently goes wrong.

## Driving the emulator itself

Learned scripting the Cambridge Z88 app pass (`scripts/z88-app-pass.cjs`), which drives both backends
of a machine through the same session and compares them:

- **The EMU window is a second `Page`.** `app.windows().find(w => w.url().includes("?emu"))`. Show
  and focus it through `app.evaluate` on its `BrowserWindow` before sending keys; the harness hides it.
- **Choose a machine or model through the application menu**, not the dialogs:
  `Menu.getApplicationMenu().getMenuItemById("machine_z88_OZ50-wasm").click()` inside
  `app.evaluate`. Machine-specific items (`z88_reset`, `z88_640_320`, `z88_de_layout`, ...) are there
  too. **The app rebuilds its menu after state changes**, so an item can be missing or disabled for a
  moment: poll for it (the pass retries for 10 s) instead of failing on the first look.
- **Hold emulated keys for several frames.** `keyboard.press` releases at once, and a machine that
  scans its keyboard on an interrupt (the Z88: every 10 ms) never sees it. `keyboard.down`, wait
  ~120 ms, `keyboard.up`. Host keys map to machine keys through the machine's `KeyMappings`
  (Z88: F1 Help, F2 Index, F3 Menu).
- **The activity bar and the toolbars are found by `aria-label`**: `button[aria-label="Debug"]`,
  `"Show Memory Panel"`, `"Show/Hide keyboard"`. `getByRole(..., { name })` clicks on them timed out
  on actionability checks; `locator('button[aria-label="..."]').click({ force: true })` works.
- **Dialogs use a combobox**: `getByRole("combobox")` opens it, `getByRole("option", { name })` picks,
  then the button by its text (`Ok`).
- **The EMU status bar names the model** and shows the PC, so reading it after each step proves a
  rebuild kept the selected model. A paused machine shows a
  `Paused (PC: $xxxx)` overlay on the screen - the proof a breakpoint stopped it.
- **Two runs of the same script are not the same machine run.** Keys and menu clicks land on
  different emulated frames, so timers, R and the tact counter differ a little between two runs.
  Compare pictures and panel text for equality, and read a difference as a bug only
  when it is not time-dependent; exact machine state is the golden tests' job (`test/wasm/z88/`).

## Fixture projects live under `~/KliveProjects`, guarded

Screenshots show absolute paths, so a temp-folder fixture puts
`/var/folders/6l/y2qnxq.../MyFirstKliveProject` in front of the reader. Fixtures are
therefore created where a real user's project would be — and `fixtureProjectFolder()`
**refuses to run if the folder already exists**, never opening, writing or deleting it.

This is not hypothetical. The author's own `~/KliveProjects/MyFirstKliveProject` is the
project the committed scripting screenshots came from; the guard fires on it before the app
launches. `DOC_SHOTS_PROJECT=<name>` renames the fixture for a run that must not disturb
it — at the cost of the screenshot then showing a name the prose does not use, so publish
with the documented name.

## What this is good for beyond screenshots

The pipeline is a visual regression detector. Regenerating one committed screenshot
surfaced that all Script Output text had become cyan: `sendScriptOutput` defaulted
`foreground: "cyan"` and spread an options bag in which thirteen call sites passed `color`,
a field nothing reads, so errors were indistinguishable from successes. Nothing else caught
it — the suite was green and the type bag was `Record<string, any>`. Fixed, with
`ScriptOutputOptions` and `test/main/script-output-styling.test.ts`.

Two lessons generalize. **Pixel-measure, don't eyeball** — a downscaled preview made a
correctly-rendered window look washed out and sent me chasing a focus bug that did not
exist; counting dominant colours answered it in one step. And **test the half that was
broken**: the first regression test covered `sendScriptOutput`, which was never at fault
and stayed green through the bug; only driving `concludeScript`, where the real call sites
are, actually fails when the bug returns. Mutation-test a regression test before trusting
it.

## Limits

- **Emulator state is not yet deterministic.** Panels like `cpu-view.png` show live
  register values that differ every run. Pausing at a fixed point (reset, then a known
  frame count) is unsolved here.
- **Timings appear in output** — "completed after 1ms" varies run to run.
- **OS-level screenshots are out of scope**: installer dialogs, Finder, permission
  prompts (`getting-started/install-step-*.png` and friends) cannot come from this harness.
- **Hover states** need Playwright's hover with the patience the CDP notes describe;
  tooltips like `bp-explain.png` are untested here.
- Roughly 50-60 of the 91 images referenced by `docs/content/**/*.mdx` look automatable on
  this evidence; the rest are OS dialogs or annotated illustrations.

## Coverage so far

Ten recipes; the rest of the pages were deliberately left ungenerated.

- `recipes/tapes.cjs` — the three `getting-started/tape-viewer*.png` shots. **Verifies before it
  photographs**: it reads the rendered block list, timeline and BASIC preview from the DOM and throws
  if they are wrong, so a broken viewer fails the run instead of publishing a picture of itself. It
  also photographs the **EMU window** — show it through `app.evaluate` on its `BrowserWindow`, then
  `page.screenshot()` on that window's `Page` — after `tape-load -r`, which proves the load path end
  to end.

- `recipes/zx81.cjs` — the three `zx81/*.png` shots of `howto/zx81.mdx`, from the **EMU window**:
  it picks the model from the application menu (`machine_zx81_zx81-16k`), shows the keyboard panel
  (`button[aria-label="Show/Hide keyboard"]`), types on the host keyboard, and runs `tape-load -r`.
  Two traps it hit: **park the mouse away from the toolbar before a shot**, or a toolbar tooltip is in
  the picture; and a machine whose frame pacing is wrong still passes every harness test - this
  recipe is what found the ZX81 running at a fifteenth of its speed in the app.

- `recipes/sprite-inspector.cjs` — the two `working-with-ide/sprite-inspector*.png` shots, and the
  running-app check of the Sprite Inspector. **A Next cannot run IDE-built code without NextZXOS on a
  card**, so it pokes a program into a paused machine instead: `em-debug`, `em-pause`, `setmem` four
  bytes a command, `setz80reg pc $8000`, `em-debug`, `em-pause`. The program's source is
  `recipes/sprite-demo.kz80.asm`; its bytes are pasted into the recipe (re-assemble after editing it).
  It passes `window.userHome`, because a Next launch writes `~/Klive/ks2.cim`. It verifies the table,
  the globals strip, the sheet and the `.spr` export before it photographs, and opens sprite #1's
  pattern as a read-only snapshot (`sprite-pattern-snapshot.png`), checking the editor shows no tools. **It resizes the IDE window
  between shots** (`klive.app.evaluate` → `setContentSize`) to photograph each width-driven layout,
  checks `data-layout` first, and scrolls the table sideways to prove the pinned columns hold. The
  window widths depend on the panel font: Iosevka at 12px is about 6px a `ch`.
- `recipes/tilemap-inspector.cjs` — the two `working-with-ide/tilemap-inspector*.png` shots, and the
  running-app check of the Tilemap Inspector, on the Sprite Inspector recipe's pattern (a program
  poked into a paused Next; source `recipes/tilemap-demo.kz80.asm`). It also **reads canvas pixels**:
  `getContext("2d").getImageData` on the map canvas proves a transparent cell is alpha 0 and a tile's
  frame opaque, in *Whole map* and again after clicking *As displayed*, where it checks the clip and
  the scroll moved the picture. A DOM check alone cannot see a wrong decode. It also opens cell (3, 10)'s tile
  as a snapshot (`tile-snapshot.png`) and checks *As shown* and *As stored* differ as the transform says.
- `recipes/layer2-inspector.cjs` — the two `working-with-ide/layer2-inspector*.png` shots, and the
  running-app check of the Layer 2 Inspector, on the same pattern (source `recipes/layer2-demo.kz80.asm`,
  which runs at 28 MHz so the 80K fill takes frames, not seconds). It reads canvas pixels for the
  *Displayed*, *Shadow* and *Write window* sources and after *As displayed*, and the inspector's decode
  of a clicked pixel. **Do not trust a reset value the firmware may have changed:** in the app `$14`
  read `$00` after boot, not the `$E3` the core resets it to, so the demo sets it before relying on
  index `$E3` being transparent.
- `recipes/layers.cjs` — the three `working-with-ide/layers*.png` shots, and the running-app check
  of the Next layer debug view, in **both windows**: the Layers strip and the pill in the EMU window,
  the probe's tooltip, the clip outlines, and the `$layers` document in the IDE. Same poke-a-program
  pattern (source `recipes/layers-demo.kz80.asm`: a Copper split that switches `$15` from SLU to LSU
  at line 96). Three lessons: **show the EMU window before the machine draws** - the harness hides it,
  and a paused machine does not repaint, so a canvas read after showing it is all zeros; **read the
  emulator screen through its canvas** (`getImageData` at `buffer × canvas.width / 720`), which proves
  the paused recompose without a screenshot diff; and **anything that turns a capture on while paused
  is approximate until a frame runs** - the recipe checks the pill says so, then runs one before
  probing, or the probe reports the registers as they are at the pause, not per line.
- `recipes/beam.cjs` — `working-with-ide/beam-position.png`, and the running-app check of the beam
  position overlay on the Next and the 48K. Same poke-a-program pattern (source
  `recipes/beam-demo.kz80.asm`: the layers demo's Copper split and a loop that changes the border every
  ~20 lines). Two lessons: **to stop mid-frame, use a hit count on a breakpoint inside a delay loop,
  and pick a period that drifts across the line** - `-hit *1000` landed every stop at nearly the same
  `hc` (all in horizontal blanking); `*1037` sweeps the line, so a few `em-debug` continues reach the
  middle of the paper. And **an SVG overlay's `<defs>` hold elements too**: query the shapes as
  `svg > line`, or `querySelector("line")` returns the hatch pattern's line, which has no layout box.
  It also checks geometry the way a user sees it: the beam line's on-screen `top` must equal its
  buffer row times the canvas scale (T5).
- `recipes/scripting.cjs` — `scripting/script-output-pane.png`. The worked template.
- `recipes/disassembly.cjs` — `working-with-ide/disass-branch-verdicts.png`. Adds three
  techniques worth reusing:
  - **`window` can carry panel font settings.** `launchKlive` now takes `panelFontFamily` /
    `panelFontSize` (defaults unchanged, so no existing shot moved). Needed because the
    disassembly view swaps layout on a container query measured in `ch`, so the font's advance
    width and size together decide which layout is photographed. Iosevka at 12px puts the
    threshold near 680px; the default jetbrains-mono at 14px needs ~950px and yields a wider,
    coarser image.
  - **Drive to a state by *inspecting the DOM*, not by address.** The recipe single-steps
    (`em-sti`) until the rendered listing satisfies a predicate — an execution point carrying a
    condition clause, plus at least one fall-through mark in view — so it does not depend on where
    the ROM happens to be when the machine pauses, and it keeps the best state it found as a
    fallback. **`bp-set` was tried first and never fired, silently**; a step either moves PC or
    fails loudly. Prefer stepping.
  - **Shrink the tool panel to buy rows.** `toolPanelHeight: "110px"` with `height: 700` yields
    about twenty disassembly rows. The first attempt at 520px cropped to nine and showed one
    glyph repeated, which made the shot useless for a feature whose point is its vocabulary.

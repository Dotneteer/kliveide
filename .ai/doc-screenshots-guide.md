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
| `newp <machineId> <name> -p <folder> -o` | Creates a project and opens it. The folder is the **named option `-p`**, not positional — the usage string's `[<project folder>]` is misleading. `-o` is what opens it. |
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

One recipe, `recipes/scripting.cjs`, reproducing `scripting/script-output-pane.png`. It is
a worked template, not a finished set — the remaining pages were deliberately left
ungenerated.

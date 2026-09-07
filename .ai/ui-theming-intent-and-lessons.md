# UI Modernization: Intent And Lessons

Durable notes from the Phase 0–9 UI modernization (`.plans/UI_MODERNIZATION_PLAN.md`).
Read `../AGENTS.md` first. Read this before touching theming, tokens, the shared data-display
primitives, or the Monaco palette.

The plan file is the detailed record: every phase has a retrospective written **after** it shipped,
including the mistakes. This file is the part worth carrying into unrelated work.

## Settled Intent — Do Not Re-Litigate

These were decided by the project author. Changing them is a product decision, not a refactor.

| Decision | Choice |
|---|---|
| Visual direction | Refined VS Code / Fleet. Same bones, softer skin. No OS vibrancy, no shell rethink. |
| Density | **Compact.** This is a debugger with many value panels; density is a feature. |
| Layout freedom | Restyle + targeted layout fixes only. *Nothing moves, everything is re-drawn.* |
| Accent | **Six**, a user setting orthogonal to light/dark. Sinclair Blue is the default. |
| Light theme | **Derived by construction** from the same ramps as dark, with four hand-tuned exceptions. |
| Device surfaces | **Theme-invariant.** The emulated machine is hardware; hardware has no light mode. |
| Rainbow motif | Confined to empty states and the About panel. Order (red, yellow, green, cyan) confirmed correct by the author. |
| Monaco | The syntax palette is a **fixed multi-hue table**; only the *keyword* colour follows the accent. Comments are green and italic, never grey. |
| Window chrome | Frameless/title-bar toolbar: **explicitly deferred.** |

> **Phase 8's Monaco palette was wrong and has been replaced.** It generated every class as a
> lightness step of the accent, which put nine of eleven classes in one blue and comments in neutral
> grey. Syntax highlighting needs **hue** to separate classes; grey comments read as disabled text.
> The replacement is a fixed multi-hue table with only the keyword following the accent, and three
> tests now guard it (comment saturation floor, hue spread, and every class held clear of the
> keyword for all six accents). Before touching `theming/tokens/syntax.ts`, read
> **`.plans/SYNTAX_PALETTE_REVISION_PLAN.md`** — including its retrospective, which records that the
> two tightest accent pairings were reviewed and **deliberately left as they are**.

## Token Architecture

Four layers, in `src/renderer/theming/tokens/`:

1. **L1 `palette.ts`** — primitives. Neutral ramp per tone, six accents, status hues, `DEVICE`,
   `DEVICE_INK`, ANSI.
2. **L2 `semantic.ts`** — `semanticTokens(tone, accentId)`. Roles, not shades.
3. **L3 `dimensions.ts`** — spacing, radii, strips, sizes, type scale, measure, shadow, motion, z.
4. **L4 `componentAliases.ts`** — the ~200 legacy `--bgcolor-*` / `--color-*` names repointed onto
   L2. **This is why 110 stylesheets changed palette without being edited.** If you are adding a
   colour to an old stylesheet, alias it here rather than reaching for a literal.

Because L2 varies by tone and the alias map does not, `light-theme.ts` collapsed. Keep it that way:
a new hand-copied light value is a regression.

### The five mandates

- **M1 — the type scale is absolute, never `em`.** `em` compounds. Real example found: a panel set
  `1em` inside a `0.8em` parent and got 12.8px where it plainly meant 16px.
- **M2 — tabular measure is `ch`, never px.** Column widths tuned to one font silently mistune when
  the font changes. **Iosevka is exactly 0.5em**, so 1ch = 6px at `--font-size-200` (12px) — measured
  twice, in a standalone probe and in the running app, not assumed.
- **M3 — row heights are JS-readable.** `rowSizes.ts` is the single source; `VirtualizedList`
  positions rows from a number while CSS draws them, and if they disagree **no stylesheet change can
  fix it**. A ratchet test (`test/theming/row-size-contract.test.ts`) fails on any new
  component-private `*ROW*SIZE|HEIGHT` literal.
- **M4 — shrink imperative theme reads.** Key SVGs still resolve colours through
  `themeService.getThemeProperty("--token")`. That is allowed; passing a raw hex is not. Pass **token
  names** and resolve them, as `Sp48Key` does.
- **M5 — the Monaco syntax palette is generated in one place** (`theming/tokens/syntax.ts`),
  never as colour literals in the seven language providers. *What* it generates is being
  revised (see the note above); *where* it comes from is not.

## Where Things Live Now

- **`controls/data/`** — the shared data-display primitives: `DataPanel`, `DataRow` (+`dense`),
  `DataLabel`/`DataValue`/`DataSecondary` (ref-forwarding), `PanelHeader`, `SectionHeader`,
  `EmptyState`, `HexValue`/`formatHex`, `HexByteGrid`, `PartitionPrefix`, `AddressLabel`.
  `registers.tsx` holds the CPU-state components.
- **`controls/layout/`** — the wrappers with 21+ importers. They now *delegate* their cell to
  `controls/data` and add only `TooltipFactory` behaviour.
- **`theming/tokens/syntax.ts`** — `syntaxPalette(tone, accent)`, `syntaxRules`, `editorColors`,
  plus the colour maths (`contrastRatio`, `ensureContrast`).
- **Deleted:** `controls/valuedisplay/`, `DocumentPanels/helpers/PanelHeader.tsx`,
  `GenericFileViewerPanel`/`GenericFileEditorPanel` (now one `GenericFilePanel`).

Two traps worth knowing:

- `DataRow` needs `dense` for register/state rows (15px). The default carries `--row-size-list`
  (22px) and list chrome, which inflates a register panel ~47%.
- `DataPanel` needs `autoHeight` whenever the panel's registry entry leaves `useScrollViewer` at its
  default — the host supplies the viewer, and a panel pinned to `height: 100%` hides its own
  overflow before the viewer can scroll it.

## Operational Knowledge

**Type-check.** `npm run build:check` is a no-op (see `AGENTS.md`). Use
`npx tsc --noEmit -p build/tsconfig.web.json`. The count at the end of Phase 9 was **166** errors,
all pre-existing. Treat a rise as your regression; diff by message, not by line, since line numbers
shift:

```bash
npx tsc --noEmit -p build/tsconfig.web.json 2>&1 | grep "error TS" | sed -E 's/\([0-9]+,[0-9]+\)//' | sort
```

**Tests.** `npx vitest run --config build/vitest.config.ts --project=jsdom` (509 at end of Phase 9)
and `--project='!perf'` for everything (19714). A bare `npx vitest run` uses the wrong config and
fails ~700 files on module resolution — that is the invocation, not your change.

**Running the app for visual checks.**

```bash
npx electron-vite dev --config build/electron.vite.config.ts --remoteDebuggingPort=9222
```

`.plans/baseline/` holds `drive.mjs` (evaluate JS in a window), `capture.mjs` (screenshots),
`imgdiff.py`, and **before-shots of both windows in both tones**, captured at 2x before any of this
work started. **Keep those scripts in the repo** — they survived a scratchpad wipe between sessions
and saved the work.

**Hunting a visual regression.** The before-shots are the comparison target: re-capture the same view
with `capture.mjs` and diff. Two cautions learned the hard way — capture at the *same window size* as
the baseline (a size mismatch produced a 100+ element diff that was pure noise), and always relaunch
rather than trusting HMR. To A/B a suspect file, `git stash push -- <path>`, relaunch, look, then
`git stash pop`; and `git diff HEAD -- <path>` shows exactly what this work changed in any single
file.

- **Always relaunch for geometry.** HMR after a CSS + several `.tsx` edits has emptied the React root
  and reported all 162 elements as removed.
- **Verify no process before launching.** Electron's single-instance lock makes a second instance
  quit with exit code 0, which looks like success.
- **`klive.settings` is rewritten at startup.** You cannot set the theme or accent by editing it —
  the app silently reverts it. Use the app's own menu.
- **Driving the app menu (macOS) needs one script and an explicit menu-bar click**, or the items are
  not addressable:

```bash
osascript <<'EOF'
tell application "System Events" to tell process "Electron"
  set frontmost to true
  delay 1.5
  click menu bar item "View" of menu bar 1
  delay 0.6
  click menu item "Accent" of menu 1 of menu bar item "View" of menu bar 1
  delay 0.6
  click menu item "Phosphor Green" of menu 1 of menu item "Accent" of menu 1 of menu bar item "View" of menu bar 1
end tell
EOF
```

**Restore anything you change this way** (theme, accent, open tabs) when you are done.

- **Electron does not expose CDP's `Emulator` domain**, so `setDeviceMetricsOverride` is unavailable.
  To test responsive/overflow behaviour, set a temporary `max-width` on the element in the page; it
  drives the same `ResizeObserver` path.
- macOS `screencapture` is permission-blocked here. Use CDP `Page.captureScreenshot`, with `clip`
  and `scale: 2` for readable crops.

## Method Lessons

These cost real time. They generalize past this codebase.

**Automated gates do not see appearance. Look at the pixels, then read the DOM.**
Every gate passed while `--surface-stage` was set within 1% of `--device-bezel` and the emulator
screen had vanished into its own surround. Also caught only by looking: a 38px toolbar with 4px
padding around 32px buttons, and `CON 0LCO 0` where a value ran into the next label.

**And do not trust the screenshot over the DOM.** I read a screenshot as showing unstyled hex
literals and was wrong — querying the computed colour showed they had the correct (deliberately
desaturated) number colour. Screenshots find *classes* of problem; `getComputedStyle` settles them.

**A test written after the fix is worth nothing until you have seen it fail.**
My first remount test drove the parent with a raw `element.click()`, which never flushed the React
update, so it passed against the broken implementation too. `fireEvent` plus an assertion that the
parent actually re-rendered turned it into a real test: 3 mounts before, 1 after. Temporarily
restore the old line and watch red.

**Never merge two things because they resemble each other.** Three planned consolidations turned out
to be pairs of different things — a divider and a spacer (`ToolbarSeparator` vs `LabelSeparator`); a
shared *address gutter*, not a shared row (`DataGridRow`); a tab strip, not a panel header
(`ToolsHeader`). Merging the first would have deleted every group divider in the app. Read both
before combining.

**When you replace a container, check which of its declarations were load-bearing.**
`flex: 0 0 auto` and `height: auto` both looked like noise in the old stylesheets. Dropping the first
let the flex algorithm compress rows to 8px against a 15px line; dropping the second hid 78px of Z80
state behind `overflow: hidden` with no way to scroll to it.

**Read the grammar; do not infer a rule from a sample.** I reported the UI's `$` hex prefix as
disagreeing with Klive's Z80 dialect because one project file used `#7C00`. The lexer accepts both
(`compiler-common/common-token-stream.ts`, `#` at ~301, `$` at ~310). Two minutes of reading would
have prevented escalating a non-problem.

**Measure the font; do not derive it from old constants.** Back-inferring `ch` from previously
converted px values reproduced *Menlo's* advance and was wrong by 15%. Measuring the bundled woff2
settled it in one step.

**Make edits count-asserting.** Python's `str.replace` is global: one unbounded call silently
rewrote an unrelated closing tag, and an unbounded `rindex` once deleted 22 of 32 tests — and the
suite went green. Assert the occurrence count before writing, and check test *counts*, not just
colour.

**Survey with the right pattern.** A `const …WIDTH` grep missed seven inline `width={160}` literals,
which a later refactor then silently reinterpreted from px to `ch`. When a survey drives a
mechanical change, verify the survey catches the shapes you are about to change.

**Prefer properties over values in tests.** Six accents × two tones is twelve palettes; asserting a
contrast floor, that errors never take the accent, and that keywords always do, survives a
thirteenth accent. Hand-checked values do not.

**Flag what only a human can settle.** The rainbow stripe order would have looked deliberate whatever
order it used — no test or screenshot could ever have caught a wrong one. That is the class of
question to raise rather than guess at; the author confirmed it in one line.

## Recommended First Reading For UI Work

1. `../AGENTS.md`
2. This file.
3. `.plans/UI_MODERNIZATION_PLAN.md` §3 (token architecture and the five mandates), then the
   retrospective for whatever area you are touching.
4. `src/renderer/theming/tokens/` — the four layers, in order.

## Non-Negotiable Handoff Message

- Do not add a colour literal to a stylesheet or a `.tsx`. Alias it in L4 or add it to L1/L2.
- Do not add a hand-copied light-theme value. Light is derived.
- Do not add a component-private row height, `em` font-size, or px column width. M1/M2/M3 have tests.
- Run the visual check. The token contract, row-size and syntax-palette tests catch structure, never
  appearance.

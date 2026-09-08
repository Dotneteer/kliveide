# UI Modernization: Intent And Lessons

Durable notes from the Phase 0–9 UI modernization and the Phase 10 follow-up
(`.plans/UI_MODERNIZATION_PLAN.md`). Read `../AGENTS.md` first. Read this before touching theming,
tokens, the shared data-display primitives, the Monaco palette, **or the memory dump/disassembly
colour** (§ "Secondary Accents" and § "View-Scoped Colour" below).

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
| Secondary accent | **Yes, added in Phase 10.** Every accent has a second hue (`--accent-secondary-*`), for the specific case one hue can't cover — two things in the same view that must both read as accent-tied and clearly apart. Not a general "add more colour" licence; see below. |
| Memory dump / disassembly colour | **These two views are exceptions to §5.2's neutral data-panel hierarchy**, added in Phase 10 — hex-editor-style views read better for real colour. The watch panel is unaffected and stays neutral. |
| Register/state panel colour | **A third exception, added after Phase 10** at the author's request, panel by panel — Z80 CPU, ULA & I/O, Next Registers, Next Memory Mapping, Call Stack. Every *value* takes the primary accent (`--color-state-value`); labels stay `--data-label`. **One hue, plus the secondary (`--color-state-value-alt`) wherever a row carries two kinds of number with nothing but position to tell them apart** — `NextRegPanel`'s previous value, `MemMappingPanel`'s page offsets, `CallStackPanel`'s stack slot beside its return address. Contrast the Z80 shadow bank, which asked for the same treatment and was refused — `AF'` is *named* differently from `AF`, so the hue would buy nothing. Panels that have not been converted stay neutral; convert one by passing `valueXclass`/`iconFill`, never by restyling the shared primitives. |

> **Phase 8's Monaco palette was wrong and has been replaced.** It generated every class as a
> lightness step of the accent, which put nine of eleven classes in one blue and comments in neutral
> grey. Syntax highlighting needs **hue** to separate classes; grey comments read as disabled text.
> The replacement is a fixed multi-hue table with only the keyword following the accent, and three
> tests now guard it (comment saturation floor, hue spread, and every class held clear of the
> keyword for all six accents). Before touching `theming/tokens/syntax.ts`, read
> **`.plans/SYNTAX_PALETTE_REVISION_PLAN.md`** — including its retrospective, which records that the
> two tightest accent pairings were reviewed and **deliberately left as they are**.

## Secondary Accents

Full derivation, per-accent numbers and the WCAG accounting are in `.plans/UI_MODERNIZATION_PLAN.md`
§10.2. What to carry forward:

- **Each accent has a second hue**: `--accent-secondary-solid`/`-solid-hover`/`-subtle`/`-border`/
  `-text`/`-text-subtle`, generated in `semantic.ts` from `AccentDef.secondary` exactly the way
  `--accent-*` is generated from `AccentDef.solid`. `--text-on-accent-secondary` mirrors
  `--text-on-accent`.
- **It exists for one reason: two things in the same view both need to read as accent-tied *and*
  clearly apart.** It is not a second colour to reach for whenever something "needs more colour" —
  if only one thing in a view needs an accent, that is `--accent-*`, full stop.
- **The test that separates a real case from a wanted one is whether anything *else* already tells
  the two apart.** Four attempts, three accepted, and the refusal is the instructive one:
  - *Refused* — the Z80 shadow bank. `AF'` is already named differently from `AF`, so a second hue
    duplicates what the label says.
  - *Accepted* — `NextRegPanel`'s previous value (`08 → 08`): the same register a moment apart,
    with nothing but position separating the pair.
  - *Accepted* — `MemMappingPanel`'s page rows (`FF -- 000000 0000FF`): bank numbers and memory
    offsets, four unlabelled hex numbers where only the colour split says where the pair breaks.
  - *Accepted* — `CallStackPanel`'s rows (`4: 5BFF → FF00`): the stack slot an address is *stored
    at* against the address it *returns to*. Two 16-bit numbers of identical shape, one row apart
    from meaning completely different things.

  All three accepted cases share the shape: **one row, two kinds of number, no words**. Dropping the
  weaker of a pair to plain `--data-secondary` is not a consolation prize either — it makes the
  thing read as chrome rather than as a value, which is wrong when both are data.
- They share **one token**, `--color-state-value-alt`, for the same reason the panels share
  `--color-state-value`: the role is "the second kind of value in this row", not "the previous
  value" or "the offset column". Name a role, not a use.
- **A hue rotation with the primary's own lightness is not automatically legible.** Blue-family
  hues carry far less of WCAG's relative-luminance weight than green/yellow (0.0722 vs. 0.7152), so
  a rotation that lands in blue can fail the 4.5:1 text floor even though the primary it was
  derived from clears it comfortably. Separately, hue alone does not reliably separate two colours'
  *luminance* — a rotation can leave the secondary reading as the same colour as its own primary
  even when both are individually legible. **Check contrast against the background AND against the
  primary, not just one.** Sinclair Blue and Deep Teal needed the first fix, Spectrum Magenta the
  second; Ultraviolet and Phosphor Green needed neither because their primaries already sit at a
  lightness that carries over safely.
- If you add a seventh accent (§5.4 already asks for a `token-contract.test.ts` re-run), it needs a
  `secondary`/`onSecondary` pair through the same two checks, not just a hue offset copied from a
  neighbour.

## View-Scoped Colour: Memory Dump, Disassembly & The Register/State Panels

**§5.2's neutral data-panel hierarchy (`--data-value`/`--data-label`/`--data-secondary`) still
stands for the watch panel and every register panel that has not been explicitly excepted.** The
memory dump, the disassembly view and the converted register/state panels (Z80 CPU, ULA & I/O, Next
Registers, Next Memory Mapping, Call Stack) are the deliberate exceptions, and each has
its **own** token family in `componentAliases.ts` (`--color-memory-*`/`--bgcolor-memory-*`,
`--color-disassembly-*`/`--bgcolor-disassembly-*`, `--color-state-value`) rather than a shared one, so
colouring one never touches the others or the still-neutral panels. Full role tables are in the plan
§10.3; the pattern to reuse elsewhere is:

- **One thing anchors the view in the primary accent** (an address column, usually) and **one
  column is the "most legible thing in the row"** in plain bold `--text-primary` — not accent —
  because legibility of the actual data was the point of §5.2 and still is here.
- **A highlight that could be confused with the anchor takes the secondary accent instead of
  echoing the primary.** The memory dump's hovered byte and disassembly's opcode bytes both ended up
  here; disassembly's jump-target label did not, because a label is a *name for* the address rather
  than a different kind of information, so it deliberately shares the address's hue.
- **Give a shared component (`AddressLabel`, `controls/layout`'s `Secondary`/`Value`/`Label`,
  `Tooltip`/`TooltipFactory`) an optional `className`** merged onto its existing class, rather than
  forking it or restyling it for everyone. Every other one of its 20+ other call sites simply does
  not pass the prop.
- **That override class lives in a different stylesheet than the shared component's own base
  class, so both are single-class selectors of equal specificity** — the load order between two
  separate CSS Modules files decides the tie, which is not something to depend on. Nest the
  override under something unique to the caller's own row (`.dumpSection .memoryAddress`,
  `.item .disassemblyAddress`) or double the class (`.memoryTooltip.memoryTooltip`) to force it to
  win regardless of load order.
- **A tooltip usually belongs to the row, not to the cell.** `controls/layout`'s `Label`/`Value`/
  `Secondary`/`Flag` each bind their own tooltip to their own cell, so the hit area ends up being a
  two-character hex value while the rest of a wide row is inert. `DataRow` forwards its ref, and
  `TooltipFactory` binds `mouseenter`/`mouseleave` to whatever element it is handed — so wrap the
  row (see `TipRow` in `MemMappingPanel`) and drop the per-cell `tooltip` props. It renders nothing
  inline (it portals only while visible), so it is safe as a child of the row's flex container.
  Keep per-cell tooltips only where a row genuinely has two things to say — `NextRegPanel` names
  its previous and current values separately.
- A shared primitive can also take an **optional prop that is not a class** where the styling does
  not go through CSS — `FlagValue`/`VerticalFlagValue`/`BitValue` take `iconFill` (a token *name*,
  resolved by `Icon` via `getThemeProperty`), because an SVG presentation attribute cannot read
  `var()`. Same principle as M4: pass token names, never literals.
- **The register/state panels share one role token, `--color-state-value`, rather than a family
  each.** This is the one place the per-view rule above does not apply, and the reason is that the
  rule is about *role tables*, not about view count: memory and disassembly are separate families
  because their roles genuinely differ (address/hex/char against address/opcode/instruction), while
  every register/state panel has the same single role — "this is a live value". Adding
  `--color-ula-value`, `--color-vic-value` and so on would be a near-identical family per panel.
  Split it the day a panel needs a role the others do not have.

## Alignment In The Register Panels

Three traps found the hard way while aligning the Z80 CPU panel. All three produce offsets small
enough to look like "it just feels off" and large enough to be visible.

- **A `DataRow` can contain another `DataRow`.** `Bit16Value`/`Bit8Value`/`SimpleValue`/`FlagValue`
  each render their *own* `DataRow` for their label/value pair, and a panel row puts two of those
  side by side — a register row is literally a row inside a row. Putting horizontal padding on
  `.dense` therefore indented register rows **twice** (16px) and the flag strip, which is built from
  bare divs, **once** (8px): measured live as `.flagLetter` at x=56 against the `AF` label at x=64.
  `.dataRow .dataRow { padding-left: 0; padding-right: 0 }` makes the outermost row own the gutter.
  Prefer that over moving the gutter to the panel, which would stop row backgrounds being
  full-bleed and so break the zebra/hover treatments.
- **A glyph's left side bearing scales with its font size, so a larger label does not optically
  left-align with a normal one even when the boxes share an x.** The flag strip's `F` is `1.6em`:
  in the bundled Iosevka it carries 1.843px of bearing at 19.2px against `A`'s 0.528px at 12px, so
  its stem printed 1.315px right of the label column. Corrected with `margin-left: -0.0685em` on the
  glyph — expressed in the glyph's own em so it tracks the type scale. Keep the scaling on an inner
  span, never on the width-bearing box: `ch` resolves against the element's own font size, so a
  `1.6em` box measuring `3ch` is 28.8px while its `1em` neighbours' `3ch` is 18px.
- **A conditionally rendered cell moves every column after it.** `NextRegPanel` renders its
  `previous value -->` cell only when the register has a `lastWrite`, so the value column sits 10ch
  further right on those rows than on the others — a ragged column in a 128-row virtualized list.
  Left as-is for now (see the note in that panel's review): reserving the column always would put an
  8ch hole in the majority of rows, which fights the Density decision above. Worth knowing as a
  shape: in a tabular list, a cell that can vanish needs a placeholder or the grid is not a grid.
- **`controls/layout`'s `Label` is not on the same origin as `controls/data`'s.** It adds
  `.legacySpacing` — `margin-inline: var(--measure-gap)` on *both* sides — so a row using it starts
  0.8ch right of a row using `DataLabel`/`SimpleValue`. The ULA panel had both shapes and therefore
  two label origins (`KL0` against `FCL`). Override it from the caller's own stylesheet with a
  type+class selector (`span.klLabel { margin-inline: 0 }`), which beats the single-class
  `.legacySpacing` whatever the load order. It also takes its `width` as an **inline style**, so a
  width in your override class is ignored unless you drop the `width` prop. `NextRegPanel` had the
  same margin *plus* a leading `LabelSeparator`, which started its content ~21.6px into the row
  while the two panels stacked above it started at 8px — worth checking the left edge of adjacent
  sidebar panels against each other, not just rows within one panel.
- **A fixed-px icon in a `ch`-sized cell does not align with text in that cell.** A 16px flag dot at
  the value cell's `flex-start` centres ~8px in, while a digit's ink centres half a character in, so
  every dot read as shifted right of the numbers above it. Wrap the icon in a `width: 1ch;
  justify-content: center` box (`.flagDot`) — it then centres on the first character cell whatever
  the font does, and the icon simply overflows that box symmetrically, which is invisible for a
  round glyph. Same idea aligns the flag strip to the value column: `.flagLetter` is
  `calc(var(--measure-label) - 1ch)`, because a `3ch` flag column centres its content 1.5ch in while
  a value cell's first character centres 0.5ch in.

## Verify Geometry In The Running App, Never In A Replica

This is the process lesson from the same work, and it cost two rounds of shipping a "fix" the user
could see was still broken.

A standalone HTML page that copies the stylesheet rules is **not** evidence. The replica used to
"prove" the alignment above flattened the nested `DataRow`, so it measured everything landing within
0.01px while the real panel was 8px out. A replica can only confirm what you already modelled
correctly; it cannot discover the wrapper you did not know about.

Drive the real thing instead — `.plans/baseline/drive.mjs` against a CDP-enabled launch:

```bash
npx electron-vite dev --config build/electron.vite.config.ts --remoteDebuggingPort=9222
node .plans/baseline/drive.mjs ide "<expression returning a JSON string>" - -
```

Specifics worth keeping:

- **CSS Module class names are hashed**, so query by substring: `[class*=flagLetterGlyph]`.
- **The sidebar panels only exist when their activity is selected.** The Z80 panel needs the Debug
  activity; a fresh profile opens on Explorer and the probe returns zero elements. Check for
  `_active_` before clicking an activity button — clicking the active one collapses the sidebar.
- **Relaunch after SCSS + `.tsx` edits.** HMR left the panel missing from the tree mid-session,
  which matches the warning under "Running the app for visual checks" below.
- Measure *ink*, not boxes, when the question is optical: `getBoundingClientRect()` gives the
  advance box, and canvas `measureText(...).actualBoundingBoxLeft` gives the bearing to add to it.
- **Hovering over CDP needs the mouse parked elsewhere first, and patience.** `TooltipFactory`
  listens for `mouseenter` on its `refElement`, so a synthetic `new MouseEvent` often does nothing —
  use `Input.dispatchMouseEvent`. And the previous tooltip's hide timer outlives a fast script:
  reading too early returns the *last* row's tooltip and looks like crossed wiring. Park at a far
  corner, wait ~1s, hover, wait ~1s, then read.

It catches more than geometry. This same loop caught a **blank renderer**: replacing the panel's
`writeOffset ?? 0xff` with a `=== undefined` test let a `null` through to `toHexa6`, which threw
`Cannot read properties of null` and took the whole React tree down — `tsc` and `eslint` were both
clean, because the field's type says `number | undefined` while the emulator actually sends `null`.
When you tighten a nullish check, keep it nullish (`== null`, or an explicit both-branches helper),
and load the panel before believing it.

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
- **`theming/tokens/palette.ts`** — `AccentDef.secondary`/`onSecondary` alongside `solid`/`onSolid`,
  one pair per accent (Phase 10).
- **`theming/tokens/semantic.ts`** — the `--accent-secondary-*` family, generated from `secondary`
  the same way `--accent-*` is generated from `solid` (Phase 10).
- **`theming/tokens/componentAliases.ts`** — `--color-memory-*`/`--bgcolor-memory-*`,
  `--color-disassembly-*`/`--bgcolor-disassembly-*` and `--color-state-value`, the memory dump's,
  disassembly's and the Z80 CPU panel's own scoped colour tokens (see § "View-Scoped Colour" above).
- **Deleted:** `controls/valuedisplay/`, `DocumentPanels/helpers/PanelHeader.tsx`,
  `GenericFileViewerPanel`/`GenericFileEditorPanel` (now one `GenericFilePanel`).

Three traps worth knowing:

- `DataRow` needs `dense` for register/state rows (15px). The default carries `--row-size-list`
  (22px) and list chrome, which inflates a register panel ~47%. `dense` drops the row *height*, not
  the side padding — see the next trap for why that distinction matters.
- **`DataRow` nests**: the value components each render one, so panel row → component row → cells.
  Anything you add to the row primitive applies once per level. See § "Alignment In The Register
  Panels".
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

**An imperative theme read can lag the DOM by exactly one render, and CSS never shows you this.**
`getThemeProperty` resolves a token via `getComputedStyle(root)` *during render*, but `root`'s
`style` attribute only updates at *commit* — one step later. The render that first reacts to a new
accent reads DOM state that still reflects the old one, so `react-switch`/SVG-fill colours lagged
CSS-driven text by however long it took some *unrelated* future render to happen to fix it. Any
`getComputedStyle`/`getBoundingClientRect` read inside a render path that also depends on a style
change from that same update has this bug. Fix: force one more render after commit
(`useLayoutEffect` bumping a tick state), not a bigger `useMemo` dependency list.

**`Array.prototype.map` and `TypedArray.prototype.map` are not interchangeable, and nothing type-
checks the difference if the parameter is typed as `readonly number[]`.** A `Uint8Array` structurally
satisfies that type, but its own `.map` builds a *new typed array*, coercing every callback return
value to a number — return JSX from it and every entry silently becomes `0`. If a prop is typed as
a plain array but a caller might hand it a live buffer view (here: `memory.subarray(...)`, to avoid
copying on every scroll), wrap with `Array.from(...)` before `.map`-ing for anything but numbers.

**A ref that a click handler reads is only as fresh as the last effect that synced it — and effects
run after the handler, not during it.** Two bugs this session had the same shape: a click handler
called an async worker that read `somethingRef.current`, synced by a *different* effect elsewhere,
and the call happened before that effect had run for this update. One symptom was a stale
`autoRefresh` making "Follow PC" silently do a full disassembly instead of the small PC-relative
one; the other was a `ResizeObserver` rebuilt on every render because its setup effect had no
dependency array, invisible in jsdom (no `ResizeObserver` there at all — the test needed its own
stub to see the bug exist). If a value has to be current *inside this same event*, don't route it
through a ref-plus-effect pair; if a value only needs to be current *for the next scheduled work*,
put it in that work's own dependency array instead of calling the work directly from the handler.

**A `border` is part of the box model; an `outline` is not — and that difference is exactly the bug
when a box overlays text it doesn't own.** An absolutely-positioned overlay sized to line up with
real text underneath it stayed positioned correctly at its own edge, but a `border` still pushed its
*content* inward from that edge — invisible until you overlay something whose alignment actually
matters. `outline` paints at the same visual position without participating in layout.

**A shared component's override class and its own base class, from two different CSS Modules
files, are a specificity tie — and ties resolve by stylesheet load order, which is not something to
depend on.** Nest the override under a selector unique to the caller (`.item .foo`) or double the
class (`.foo.foo`) to force a deterministic win instead of an order-dependent one.

## Recommended First Reading For UI Work

1. `../AGENTS.md`
2. This file.
3. `.plans/UI_MODERNIZATION_PLAN.md` §3 (token architecture and the five mandates), then the
   retrospective for whatever area you are touching — §10 for the secondary accent or the memory
   dump/disassembly colour specifically.
4. `src/renderer/theming/tokens/` — the four layers, in order.

## Non-Negotiable Handoff Message

- Do not add a colour literal to a stylesheet or a `.tsx`. Alias it in L4 or add it to L1/L2.
- Do not add a hand-copied light-theme value. Light is derived.
- Do not add a component-private row height, `em` font-size, or px column width. M1/M2/M3 have tests.
- Do not reach for the secondary accent because something "needs more colour". It exists for one
  case: two things in the same view that must both read as accent-tied and clearly apart from each
  other. One accent-worthy thing in a view is `--accent-*`.
- Do not give a register or watch panel colour beyond §5.2's neutral hierarchy. The memory dump, the
  disassembly view and the Z80 CPU panel are the only exceptions, and each was made deliberately, by
  the author, not by drift.
- Do not put horizontal padding on `DataRow`/`.dense` without the nested-row reset — the value
  components each render their own row, so it lands twice on register rows. § "Alignment In The
  Register Panels".
- Run the visual check **in the running app over CDP**, not in a standalone replica of the CSS. A
  replica cannot show you the wrapper you did not model; this shipped two wrong "fixes" in one
  session. § "Verify Geometry In The Running App, Never In A Replica".
- Run the visual check. The token contract, row-size and syntax-palette tests catch structure, never
  appearance.

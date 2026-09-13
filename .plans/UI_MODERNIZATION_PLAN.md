# UI Modernization Plan — Emulator & IDE Shell

**Status:** Draft — awaiting review
**Process:** Phases are amended in place after each retrospective (§6.0). If this file and your
memory of it disagree, this file wins.
**Created:** 2026-09-06
**Updated:** 2026-09-11 (Phase 12 — the System Variables panel → §12; Phase 11 — sidebar
modernization, the two sidebar extension points and the first two badges → §11). Earlier: 2026-09-06 (data-panel audit → §2.4/§3.0; accents settled → §5; Phase 0 detailed, and
the consolidation sliced across Phases 6–7 covering `DocumentPanels/`, `SiteBarPanels/` and
`ToolArea/` → §6). All open questions resolved.
**Branch:** `dotneteer/ui-modernize`
**Scope:** The main panels of both renderer windows — toolbar, status bars, activity bar, sidebar
and its panels, document tabs/header, tool area, emulator area, keyboard panel — plus the design
token layer they all rest on, **plus the content of `SiteBarPanels/` and `DocumentPanels/`**, which a
review of those folders showed cannot be separated from the token work (see §2.4). Monaco's syntax
palette is in scope because it is a second colour system that would otherwise drift; Monaco's own
editor chrome and the dialogs are not, and inherit the new tokens for free.

---

## 1. Direction

Agreed with the user before drafting:

| Decision | Choice |
|---|---|
| Visual direction | **Refined VS Code / Fleet** — same bones, softer skin. No OS-vibrancy, no shell rethink. |
| Layout freedom | **Restyle + targeted layout fixes** where the current arrangement is genuinely awkward. |
| Density | **Compact (pro tool)** — this is a debugger with many value panels; density is a feature. |
| Foundation | **Add a real design-token layer** (spacing, radii, elevation, motion, type — not just colour). |
| Accent | **Six, as a user setting** — Sinclair Blue (default), Spectrum Magenta, Ember, Ultraviolet, Deep Teal, Phosphor Green. Orthogonal to light/dark. Requires re-casting the data-panel label/value colours as a hierarchy. See §5. |
| Window chrome | **Optional later phase**, decided after the restyle is visible in the app. |
| Rollout | **Phased, every phase shippable** — the app is coherent after each one. |
| Latent bugs | **Fix all of them** as part of the relevant phase. |

The through-line: *nothing moves, everything is re-drawn.* A user who knows Klive today should
never have to hunt for a control — they should just notice it looks built rather than assembled.

---

## 2. What is actually there today

This section is evidence, not opinion. Every number below was read out of the tree on this branch.

### 2.1 The shells

**Emulator window** (`src/renderer/appEmu/EmuApp.tsx`) is a four-child flex column:
`Toolbar` (34px content + 4px×2 padding) → `EmulatorArea` (flex) → `EmuStatusBar` (40px) → `BackDrop`.
No activity bar, no tabs. `EmulatorArea` splits screen (top) / keyboard (bottom) with a 4px splitter.

**IDE window** (`src/renderer/appIde/IdeApp.tsx`) is
`Toolbar` (38px) → row[`ActivityBar` (52px) | split[`SiteBar` | split[`DocumentArea` / `ToolArea`]]] → `IdeStatusBar` (40px).
Panel order is done with the CSS `order` property plus `flex-direction: row-reverse`, not grid areas.

### 2.2 The measurable problems

**Eleven near-but-unequal heights in one window.** ActivityBar button 48 · status bar 40 ·
IDE toolbar 38 · documents header 38 · tools header 38 · doc tab 36 · tool tab 36 · sidebar header 36 ·
tab text wrapper 32 · sidebar panel header 24 · explorer row 24. A 36px tab inside a 38px header
leaves 2px of unexplained slack. The **status bar (40px) is taller than the toolbar (34px)** in the
emulator window — the least important strip in the window is the tallest piece of chrome.

**Spacing is 503 hardcoded `px` literals** across 110 `*.module.scss` files, drawn from an ad-hoc
set (`1, 2, 4, 6, 8, 10, 12, 16, 20, 24`) mixed with `em`, `ch`, `rem` and `pt`. Representative
offenders: `ToolArea .wrapper { padding: 12px 0 2px 8px }`, `DocumentTab { padding: 0 8px 0 12px }`,
`SideBarHeader .text { padding-left: 20px }` (a magic offset to fake alignment with panel chevrons).

**A spacing scale already exists and is unused.** `ThemeProvider.tsx` generates
`--space-0 … --space-96` from `--space-base: "0.25em"`. It has **exactly two consumers in the whole
tree**, both in `Toolbar.tsx` (`--space-1_5`, `--space-1`). Zero `var(--space-…)` in any `.scss` file.

**Radius has no scale.** 31 declarations: `6px` (icon button, split button, menu), `5px` (icon
*wrapper*, 1px off from its own parent), `4px` (menu item, overlays, TabButton), `2px`, `0.2em`,
`0`. Only 4 of the 31 use a variable. The activity bar, sidebar, tabs, status bars, emulator screen
and keyboard panel are all perfectly square.

**Motion is essentially absent.** Six `transition` declarations project-wide, all with hardcoded
durations, none of them in the IDE shell except `SplitPanel`. And that one is declared *inside*
`.pointed`, so the splitter fades **in** but snaps **out**. Chevrons rotate with an inline
`transform` and no `transition`, so expand/collapse is a hard cut.

**Hairline borders are the only structural language.** `.notFirst`, sidebar panel `.header`/`.focused`,
`ToolArea .left/.right/.top/.bottom`, every `DocumentTab`, the active-tab top border, `.closingTab`,
the tool tab underline. Several are drawn in colours nearly identical to their own background —
`--color-doc-border` is `#181818` in dark, i.e. **the tab border is invisible against the `#181818`
document body** and barely visible against the `#282828` header. `border-right: none` on every tab
means adjacent inactive tabs merge into one continuous band with no separator.

**Colour is component-scoped with no semantic layer.** 201 tokens, all of the form
`--bgcolor-<component>-<state>`. There is no `surface-*`, no `elevation`, no `accent` ramp, no
primitive palette. VS Code blue `#007acc` is written out **10 times in `dark-theme.ts` and 5 times
in `light-theme.ts`**, doing four unrelated jobs at once: status bar background, selection ring,
splitter highlight, dropdown border. Raw CSS keywords are used as theme values — `white`, `cyan`,
`red`, `orange`, `lightgreen`, `darkgreen`, `darkred`, `brown`, `orangered` — which have no shared
hue family and wildly unequal luminance.

**Typography is unanchored.** No `font-size` is set on `html`, `body`, `#root`, `#themeRoot` or
`.baseRootComponent`, so every `em` in the app resolves against the browser's 16px default. Sizes
in the modules: 38× `0.8em`, 14× `1em`, 7× `0.9em`, 5× `0.9rem`, 5× `0.875rem`, 4× `0.85rem` — and
exactly **one** token use (`--font-size-tooltip`). Inter and Iosevka are already bundled locally
(`assets/fonts/`, built by `scripts/build-fonts.py`) with `font-variant-numeric: tabular-nums`
globally — that groundwork is done and good, and this plan builds on it.

**No global `border-box`.** `index.css` sets `box-sizing` on `html, body, #root` only; there is no
`*, *::before, *::after` rule. So declared heights are content-box heights: the 34px toolbar renders
42px, and `ToolbarSeparator` (30px + 4px×2 padding = 38px) is **taller than the toolbar it sits in**.

### 2.3 Latent bugs to fix (user asked for all of them)

Confirmed by grep on this branch:

| Bug | Where | Effect |
|---|---|---|
| `background-color: var();` — invalid, empty `var()` | `controls/layout/Layout.module.scss:48`, `controls/Next/Layer2Screen.module.scss:8` | Declaration dropped |
| `--color-separator`, `--color-bg-hover` referenced, defined in neither theme | `SiteBarPanels/WatchPanel.module.scss` | Border falls back to `currentColor`; hover does nothing |
| `--main-font` referenced 4× — real name is `--main-font-family` | `ExplorerPanel` (×2), `Modal`, `Button` modules | 4 no-op `font-family` declarations |
| `--color-activitybar-pointed` referenced, theme defines `--bgcolor-…` | `ActivityBar/ActivityButton.module.scss:26` | Dead rule |
| `--console-default` defined in `dark-theme.ts` only | consumed via `getThemeProperty` in `ConsoleOutput.tsx:119`, `BasicPanel.tsx:456` | Console default text unstyled in **light theme** |
| `.label` (`0.8em`) and `.isMonospace` (`1em`) applied to the same `<span>` | `EmuStatusBar.module.scss:20,26` | Later rule wins: every numeric readout renders 16px while its own label renders 12.8px |
| `--bgcolor-emuoverlay` / `--color-emuoverlay` defined in both themes, referenced nowhere | overlays hardcode `#303030` / `lightgreen` instead | Light theme keeps a dark pill |
| `--bgcolor-toolbarbutton-disabled` (`#d0d0d0` in *dark*) used as an icon **fill** | `IconButton.tsx` | Background token doing a foreground job; inverted per theme |
| Hover tracked in React state + a module-global pointer position + an `elementFromPoint` probe | `ActivityButton.tsx`, `DocumentTab.tsx`, `IconButton.tsx` | Can't transition, can't be themed, desyncs from the CSS-`:hover` `ToolbarSplitButton` sitting next to it |
| `outline: none` with no replacement | `SideBarPanel .header`, `DocumentsHeader`, `DocumentArea`, `ExplorerPanel`, ToolArea `.prompt` | The only text input in the tool area has no focus indicator |
| Activity bar, document tabs and tool tabs are plain `<div>`s | no `tabIndex`, no `role`, no `aria-label` | No keyboard path through the shell at all |
| `height: 100000px` as an "expanded" sentinel | `SideBarPanel.module.scss` | — |
| Dead CSS | `.icon`/`.iconPointed` (ActivityButton), `.splitterHor`/`.splitterVert` (SplitPanel), `.sectionSeparator` (IdeStatusBar), `.toolbar` (Toolbar.module.scss — a stale 38px spec contradicting the live 34px) | — |
| Duplicated constants | `SECONDARY_ICON_SIZE = 20` in 3 files; `calculateZoom` + `rootStyle` + `rowStyle` byte-identical across 3 keyboards; `inset 0 1px 3px rgb(0 0 0 / 30%)` in 2 | — |
| Duplicate `name: "arrow-circle-left"` in the icon array | `theming/icon-defs.ts` | Second silently wins in the `Map` |
| Magic constants in JS, not CSS | `- 8` gutter in `useEmulatorScreen.ts`; `- 24 / - 12` in every `calculateZoom`; `top: 40px` on the recording overlay with a comment admitting it is eyeballed | Layout can't respond to token changes |

### 2.4 The deeper problem — the data panels

`SiteBarPanels/` (15 components) and `DocumentPanels/` (32 components) are where Klive actually does
its work, and they expose problems that a colour-token layer alone would not have fixed. These are
architectural, and they change the shape of the token design in §3.

**(a) Three competing component stacks, mixed inside single files.**

There are two parallel "layout + value" libraries, and both are in active use:

| Stack | Exports | Used by |
|---|---|---|
| `controls/layout/` | `Panel`, `Row`, `Column`, `Label`, `Value`, `Flag`, `Separator`, `ExpandableRow` | **14 of 15** SiteBarPanels |
| `controls/valuedisplay/` | `SidePanel`, `Row`, `Col`, `CenteredRow`, `Bit8Value`, `Bit16Value`, `SimpleValue`, `FlagValue`, `BitValue`, `FlagFieldRow` | 5 panels (Z80Cpu, M6510Cpu, Ula, Vic, Blink) |

Both export a component named **`Row`**. Both stylesheets define **`.label`** with `--color-label`
and **`.value`** with `--color-value`. `controls/layout/Layout.module.scss` and
`controls/valuedisplay/Values.module.scss` are two independent implementations of the same idea.

The split is not clean, either. `UlaPanel` and `VicPanel` use `valuedisplay` **and** `controls/layout`
**and** their own `.module.scss`. Three idioms in one file.

**(b) Two competing root-block idioms in the same folder.** Of 12 SiteBarPanel stylesheets, **7**
copy-paste this identical block and **5** use the `side-panel-content` mixin instead:

```scss
.<name>Panel {
  @include fill-parent-flex;
  box-sizing: border-box;
  flex-direction: column;
  user-select: none;
  font-family: var(--monospace-font);
  font-size: 0.8em;
}
```

Neither is canonical. `font-size: 0.8em` alone is written out **25 times** across the two folders.

**(c) `PsgPanel` is an unrenamed copy of `UlaPanel`.** `PsgPanel.module.scss` declares `.ulaPanel`,
and `PsgPanel.tsx:20` renders `<div className={styles.ulaPanel}>`. The copy-paste was never
finished. This is what "16 separate definitions of a data row" looks like in practice — I counted 16
files across `appIde/` and `features/` that each define their own `.item` / `.row` / `.regItem` /
`.sysVar` / `.watchItem` / `.breakpoint` / `.entry` rule.

**(d) Tabular alignment is done with hardcoded pixel widths — and the font just changed.**
`controls/valuedisplay/Values.module.scss` aligns every register and flag column like this:

```scss
.label { width: 44px;  &.flag { width: 41px; } }
.value { width: 48px;  &.flag { width: 51px; } }
.verticalLabel { width: 16px; }
.flagLetter    { width: 32px; font-size: 1.6em; }
```

Those are eyeballed pixel values tuned to a specific monospace advance width. The previous commit
(`61f35cee5 wip: New fonts added`) changed the mono stack from `Menlo, Monaco` / `Consolas` to
**Iosevka**, whose glyph advance is `0.5em` versus `0.6em` — **16.7% narrower**. Every one of those
widths is now mistuned; columns carry roughly 1.2 characters of unintended slack.

Meanwhile the codebase already contains the *correct* technique — font-relative `ch` units — in
`DisassemblyPanel.module.scss` and `MemoryDumpSection.module.scss` (`gap: 0.8ch`, `margin-right: 1.2ch`).
So there are **two contradictory alignment strategies**: 18 hardcoded `px` widths versus 9 `ch` values.
A token layer that only ships colours would leave this exactly as broken as it is now.

**(e) `em` compounds, and it is already biting.** Nothing anchors the root font size (§2.2), and
these panels then nest relative units:

- `TapViewerPanel` / `DskViewerPanel`: root `.panel` at `0.8em`, a child at `1em` — which resolves
  to 12.8px, not the 16px the author almost certainly intended.
- `DisassemblyPanel`: `0.8em` and `0.6rem` in the same file — parent-relative and root-relative mixed.
- `Values.module.scss` `.flagLetter { font-size: 1.6em }` compounds against an already-scaled parent.

This is the same class of bug as the `EmuStatusBar` `.isMonospace` collision in §2.3, and it means
**the type scale cannot be `em`-based.**

**(f) Row heights live in JavaScript, decoupled from the CSS that draws them.**

```
src/renderer/features/memory/MemoryPanel.tsx:40        const MEMORY_ROW_ITEM_SIZE = 20;
src/renderer/appIde/DocumentPanels/DisassemblyPanel.tsx:40  const DISASSEMBLY_ROW_ITEM_SIZE = 18;
```

Both are passed to `VirtualizedList`'s `itemSize`, which positions rows absolutely. If the type scale
or row padding changes — which is exactly what Phase 1 does — virtualized rows overlap or clip, and
**no stylesheet change can fix it**. Any dimension token that affects row height must therefore be
readable from JS, not only from CSS.

**(g) Some components bypass CSS entirely.** 33 `getThemeProperty()` call sites read theme values
imperatively in JS and apply them as inline attributes — 26 of them in the keyboard SVGs, plus
`ActivityButton`, `Icon`, `LabeledSwitch`, `SpriteEditorGrid`. These components cannot be restyled by
changing CSS, cannot use `:hover`, and cannot transition. They are invisible to any stylesheet-level
work.

**(h) A second, parallel colour system for syntax highlighting.** Seven Monaco language providers
define their own light and dark themes with **158 hardcoded colours** between them:

| File | Colours |
|---|---|
| `asmKz80LangaugeProvider.ts` | 42 |
| `turboPascalLanguageProvider.ts` | 26 |
| `zxBasLanguageProvider.ts` | 22 |
| `sjasmZ80LanguageProvider.ts` | 20 |
| `asm6510LangaugeProvider.ts` | 18 |
| `ksxLanguageProvider.ts` | 16 |
| `asmZxbLanguageProvider.ts` | 14 |

None of them reference the theme layer. The editor — the largest surface in the IDE — will visibly
drift from the rest of the app the moment the palette moves. (Two of those filenames also misspell
"Language" as "Langauge".)

**(i) Partial abstractions exist but are not adopted.** `DocumentPanels/helpers/` contains
`PanelHeader`, `GenericViewerPanel`, `GenericFileViewerPanel`, `GenericFileEditorPanel` — the right
idea, stopped halfway. `PanelHeader` is twelve lines and hardcodes its own spacing:

```tsx
export const PanelHeader = ({ children }: Props) => (
  <HStack paddingHorizontal="4px" paddingVertical="2px" verticalContentAlignment="center">
    {children}
  </HStack>
);
```

No title slot, no actions slot, no surface, no border. Six panels use it; `DskViewerPanel`,
`TapViewerPanel`, `StaticMemoryView`, `CommandResult` and `ScriptOutputPanel` each hand-roll their own
header instead. Meanwhile the 22 `DocumentPanels` stylesheets share no root rule at all — the first
declared class is a different name in all eleven top-level files.

**(j) No accessibility surface whatsoever.** Across the **35 `.tsx` files** in these two folders:
`role=` **0**, `tabIndex` **0**, `aria-*` **0**, `<button>` **0**. Not one semantic or focusable
element in the entire data-panel layer.

**(k) Eight byte-identical stylesheets.** All eight `DocumentPanels/Next/*.module.scss` —
`NxiFileEditorPanel`, `ShcFileViewerPanel`, `ShrFileViewerPanel`, `Sl2FileViewerPanel`,
`SlrFileViewerPanel`, `SnaFileViewerPanel`, `VidFileViewerPanel`, `Z80FileViewerPanel` — share one
MD5. 144 lines that should be 18. `ScriptOutputPanel` and `CommandResult` are two more near-copies
of the same 18 lines.

`TapViewerPanel.module.scss` and `DskViewerPanel.module.scss` are 72% byte-identical after
normalizing the name prefix — including duplicated `.error` and `.valueLabel` blocks — and their
`ValueLabel` React component is hand-written twice.

**(l) Three orphan stylesheets, never imported by anything:**

```
SiteBarPanels/UlaPanel.module.scss              25 lines
SiteBarPanels/VicPanel.module.scss              26 lines   (its root class is misnamed .ulaPanel)
DocumentPanels/Next/Z80FileViewerPanel.module.scss  18 lines
```

`UlaPanel` and `VicPanel` were migrated to `valuedisplay`'s `SidePanel` and the stylesheets were left
behind. Counting these plus unused classes in live sheets, roughly **17% of `SiteBarPanels/` SCSS and
12% of `DocumentPanels/` SCSS is dead**.

**(m) A live bug that silently disables ~120 flag indicators.** `controls/valuedisplay/Values.tsx:246`:

```tsx
className={classnames(styles.flag, styles.clickable)}
```

`Values.module.scss` has **no top-level `.flag` and no top-level `.clickable`** — they exist only as
nested compounds (`.label.flag`, `.value.flag`, `.bitValue.clickable`). Both resolve to `undefined`,
so the element gets an empty `className` and neither `justify-content: center` nor `cursor: pointer`
applies. The correct classes (`.bitValue` / `.clickable`, lines 60–69) are never referenced by
anything. Blast radius: every clickable bit in `UlaPanel` (40), `BlinkPanel` (64) and `VicPanel` (8),
plus every `FlagRow`.

**(n) An inverted flag name causes double-nested scroll containers.** `SideBar/SideBarPanel.tsx:56`:

```tsx
const useScrollViewer = sideBar.noScrollViewer ?? true;
```

The variable says "use" but the field says "no" — so to *suppress* the scroll viewer you must write
`noScrollViewer: false`. `NecUpd765Panel` and `ScriptingHistoryPanel` don't set it, so they render a
`VirtualizedList` (which already wraps its own `ScrollViewer`) inside a second `ScrollViewer`. A
virtualizer nested in an auto-sizing scroll parent cannot measure a bounded viewport.

Also at `SideBarPanel.tsx:68`: `tabIndex={index}` — **positive** tabindex values, which override
natural DOM tab order for the whole window.

**(o) The data is not selectable.** `user-select: none` appears in **30 declarations** across these
two folders, against **4** that opt back in. Hex dumps, disassembly, tape and disk block data and
BASIC listings cannot be selected or copied with the mouse. The panels work around their own rule
with bespoke "copy to clipboard" buttons (`BasicPanel.tsx:377`, `CommandResult.tsx:45`,
`ScriptOutputPanel.tsx:148`). For a debugger this is a genuine usability defect, not a style nit.

**(p) "Labeled hex value" is implemented six times.** `layout/LabeledText` (the intended one, **zero
uses** in these panels), `valuedisplay/Bit16Value`, `valuedisplay/Bit8Value`, `controls/LabeledValue`,
a local `ValueFieldRow` in `BlinkPanel.tsx:236`, and a local `ByteValue` in `SysVarsPanel.tsx:163`.
Formatting is forked with it: most panels call the shared `toHexa2`/`toHexa4`, but `WatchPanel.tsx:177`
reimplements it in uppercase and `WatchPanel.tsx:226` renders **lowercase** hex a few lines later. The
`$` prefix is present in `Breakpoints`/`Watch` and absent in `MemMapping`/`SysVars`/`NextReg`/`Blink`.

Widths for those columns are 13 magic constants spread across 8 panels — **six different label widths
(41, 46, 48, 64, 108, 120) for the same semantic role** — plus family B's six CSS widths. The `41/44`
and `48/51` pairs are the giveaway: someone nudged pixels to align two systems that share no token.

*Not problems, checked and cleared:* scrolling is consistent (six `ScrollViewer` users, one raw
`overflow` rule, in a dialog); and `font-variant-numeric: tabular-nums` **is** already set globally on
`body` (`assets/styles/fonts.css:199`), so numeric alignment has the right foundation already.

*Free wins requiring no design decision:* delete the three orphan stylesheets, collapse the eight
identical `Next/` sheets to one, fix `Values.tsx:246`, fix the two empty `var()` calls, add
`--console-default` to the light theme, and drop `react-virtualized-auto-sizer` from `package.json:103`
(the npm package has zero importers; the code uses a vendored fork at `src/lib/`).

---

## 3. The token architecture

This is the heart of the plan and the reason the rest is cheap. Four layers, each one only allowed
to reference the layer above it.

```
L1  Primitives     --klive-gray-1..12, --klive-accent-1..12, --klive-red/amber/green/blue-*
        │              raw ramps; light and dark are two different value sets, same names
        ▼
L2  Semantics      --surface-*, --text-*, --border-*, --accent-*, --focus-ring, --status-*
        │              "what it means", not "what colour it is"
        ▼
L3  Dimensions     --space-*, --radius-*, --size-*, --strip-*, --font-size-*, --shadow-*,
        │          --duration-*, --ease-*, --icon-*, --z-*     (theme-independent)
        ▼
L4  Component      the existing 201 --bgcolor-activitybar / --color-doc-inactiveText / …
                   redefined as thin aliases onto L2/L3
```

**L4 is the migration trick.** The 201 existing tokens keep their names and keep working, but stop
holding literals and start holding `var(--surface-chrome)`. That means:

- **Phase 1 alone visibly modernizes the entire app** by editing three files, with no risk of a
  half-restyled screen — every one of the 110 stylesheets picks up the new palette at once.
- Later phases refine one panel group at a time by *replacing* L4 aliases with direct L2/L3 use,
  and can be reviewed and shipped independently.
- Nothing is ever in a broken intermediate state, which is what "every phase shippable" requires.

### 3.0 Five mandates from §2.4

The data-panel findings constrain the token design. A pure CSS colour-variable layer fails all five.

**M1 — The type scale must be absolute, never `em`.** Because `em` compounds and is already
producing wrong sizes (§2.4e), `--font-size-*` are defined in **px** and every panel sets a size
explicitly rather than inheriting a scaled parent. The root gets an anchored `font-size` in Phase 0
so nothing depends on the browser's 16px default any more.

**M2 — Tabular measure must be font-relative, not px.** Column widths for hex, addresses, registers
and flags get a `ch`-based measure scale, so alignment survives a font or size change instead of
silently mistuning the way the Iosevka switch just did (§2.4d):

```
--measure-1ch … --measure-12ch     column widths for hex/address/opcode fields
--measure-gap                      0.8ch  (matches the existing DisassemblyPanel idiom)
```

**The measured basis (slice 6.5).** Iosevka's advance was measured, not assumed — both in a
standalone probe against the bundled `iosevka-400.woff2` and in the running app via CDP:

| context | font-size | 1ch |
|---|---|---|
| `.dataPanel` (the target) | 12px Iosevka | **6.000px** |
| legacy panel root (`font-size: 0.8em` of the 16px root) | 12.8px | 6.400px |
| Menlo fallback, for comparison | 12px | 7.225px |

Iosevka is exactly **0.5em** at every size tested (11/12/13/15/16px). Two consequences:

1. Slices 6.0–6.2 converted against roughly the *Menlo* figure (48px→7ch, 64px→9ch, i.e. ~7.1px/ch),
   so those columns came out ~15% narrower than the px they replaced. Live measurement of all 187
   migrated cells shows **zero clipping**, so this is tighter-than-before rather than broken, and is
   left alone; it is recorded here so the discrepancy is not rediscovered as a bug.
2. `ch` on a `DataLabel` only means 6px if an ancestor is `.dataPanel`. Legacy `Label`/`Value` cells
   inherit their family, and several were measured rendering in **Inter**, not Iosevka — a
   proportional font, where a `ch` column does not align at all. **Converting a panel's cells to
   `DataLabel`/`DataValue` therefore requires converting its root to `DataPanel` in the same edit.**

The 18 hardcoded px widths are converted; the 9 existing `ch` values become the canonical pattern.

**M3 — Dimension tokens that affect row height must be readable from JS.** `MEMORY_ROW_ITEM_SIZE = 20`
and `DISASSEMBLY_ROW_ITEM_SIZE = 18` (§2.4f) feed `VirtualizedList`'s absolute positioning. Export the
row-height tokens from a plain TS module that *both* `ThemeProvider` (to emit CSS custom properties)
and those components (to pass `itemSize`) import, so there is exactly one source of truth:

```ts
export const rowSizes = { list: 22, memory: 20, disassembly: 18 } as const;
```

Without this, Phase 1 silently breaks every virtualized panel.

**M4 — Imperative theme reads must shrink, not grow.** The 33 `getThemeProperty()` call sites (§2.4g)
are unreachable by CSS. Phase 2 converts everything that *can* be CSS (`ActivityButton`, `Icon`,
`LabeledSwitch`) to CSS. The keyboard SVGs legitimately cannot be, so they stay imperative — but
they must read L2 semantic names, not L4 component names, so they move with the palette.

**M5 — Syntax highlighting must derive from the ramp.** The 158 hardcoded Monaco colours across 7
language providers (§2.4h) are a second colour system that will visibly drift. They get a shared
`syntaxPalette(tone)` derived from the L1 ramps, consumed by every provider.

### 3.0.1 The component layer is part of this work

§2.4a–c show that tokens alone are not enough: there are two `Row` components, two `.label`/`.value`
implementations, 16 hand-rolled data-row rules, 7-vs-5 competing root blocks, and a `PsgPanel` still
wearing `UlaPanel`'s class name. Tokenizing all of that would just make the duplication consistent
rather than removing it.

So the plan adds one deliberate consolidation: **`controls/valuedisplay/` and the value-ish half of
`controls/layout/` merge into a single `controls/data/` primitive set** — `DataPanel`, `DataRow`,
`DataLabel`, `DataValue`, `HexValue`, `FlagValue`, `BitValue`, `PanelSection` — built on M2's measure
scale, with `PanelHeader` promoted to a real component (title + actions + surface). Every panel in
both folders then renders through it and their bespoke `.module.scss` files mostly disappear.

This is the single largest piece of work in the plan and the reason Phase 6 exists. It is also
what makes the result feel designed rather than merely recoloured.

### 3.1 Ramps (L1)

A 12-step Radix-style ramp per hue, because it gives light/dark parity for free: step *n* means the
same *role* in both themes even though the values invert. Steps used by name:
1–2 app/panel backgrounds · 3–5 component backgrounds (rest/hover/active) · 6–8 borders
(subtle/default/strong) · 9–10 solid fills (accent surfaces) · 11–12 text (secondary/primary).

Hues: `gray` (neutral, slightly cool to sit under a warm accent), `accent` (§5), and four status
hues `red` / `amber` / `green` / `blue` replacing the raw `red`/`orange`/`lightgreen`/`cyan` keywords.

### 3.2 Semantics (L2) — the vocabulary panels actually use

```
--surface-canvas      window base, the darkest/lightest ground
--surface-chrome      activity bar, toolbar, status bar
--surface-panel       sidebar, tool area
--surface-raised      active tab, popovers, menus
--surface-overlay     modals, dropdowns, backdrop-lifted things
--surface-hover / --surface-active / --surface-selected

--text-primary / --text-secondary / --text-tertiary / --text-disabled / --text-on-accent

--border-subtle       barely-there division inside a surface
--border-default      real separation between surfaces
--border-strong       focus-adjacent, input outlines

--accent-solid / --accent-solid-hover / --accent-subtle / --accent-border / --accent-text
--focus-ring          a single token, used identically everywhere

--status-error / -warning / -success / -info  (+ -subtle background variants)
```

### 3.3 Dimensions (L3) — compact scale

`--space-base` moves from `0.25em` (which inherits the unanchored 16px problem) to **`4px`**, so the
generated `--space-1 … --space-96` scale becomes absolute and predictable. Then:

| Group | Tokens | Compact values |
|---|---|---|
| Radius | `--radius-xs/sm/md/lg/full` | `2 / 4 / 6 / 10 / 999px` |
| Strips | `--strip-toolbar` `--strip-statusbar` `--strip-tabbar` `--strip-sidebar-header` | `38 / 26 / 36 / 34px` |
| Rows | `--row-panel-header` `--row-list` | `26 / 22px` |
| Controls | `--size-control-sm/md` | `24 / 30px` |
| Activity bar | `--size-activitybar` `--size-activitybutton` | `48 / 44px` |
| Icons | `--icon-sm/md/lg` | `16 / 20 / 24px` |
| Type | `--font-size-50…400` | `10 / 11 / 12 / 13 / 15px` (px, per **M1**) |
| Measure | `--measure-1ch…12ch`, `--measure-gap` | font-relative, per **M2** |
| Virtual rows | `rowSizes.{list,memory,disassembly}` | TS module, not CSS, per **M3** |
| Elevation | `--shadow-1/2/3` | flat-ish, tuned per theme |
| Motion | `--duration-fast/base` `--ease-standard/out` | `80ms / 140ms` |
| Layering | `--z-splitter/overlay/menu/modal` | replaces the current `10 / 10000` free-for-all |

**Status bar 40px → 26px** is the single biggest density win: 14px reclaimed in *both* windows, and
it fixes the "least important strip is the tallest" inversion. **ActivityBar 52 → 48px** and
**button 48 → 44px** bring the icon strip in line.

### 3.4 A test that keeps this honest

`test/theming/token-contract.test.ts` (new, node project — no DOM needed):

1. Scan every `src/renderer/**/*.{scss,css,tsx,ts}` for `var(--…)` and for token-name string
   literals passed to `getThemeProperty` / `processStyleValue`.
2. Assert every referenced name **resolves** — defined in both `dark-theme.ts` and `light-theme.ts`,
   *or* declared as a custom property in one of the app's own stylesheets (OverlayScrollbars'
   29 `--os-*` internals), *or* on a short documented runtime allowlist (`--main-font-family`,
   `--monospace-font`, `--radix-select-trigger-width`, the generated `--space-*` scale).
   Names ending in `-` are concatenation prefixes and are checked as prefixes.
3. Assert both theme files define exactly the same key set.
4. Assert no `var()` with an empty argument.
5. Assert **every accent × theme pair** meets 4.5:1 for text, 3:1 for indicators, and **ΔE2000 ≥ 12
   from every meaning-bearing colour** (§5.4). Today's `#007acc` fails the contrast check, which is
   precisely the point.

Every bug in the table at §2.3 rows 2–5 and 7 is caught by this test, permanently. It is written in
Phase 0 and must be green before Phase 1 starts.

---

## 4. Targeted layout fixes

The scope allows a small number of structural changes. These are the ones worth making; everything
else is pure restyle.

1. **Activity bar active state.** Today the active item is a *solid `#007acc` fill of the entire
   48px cell*. Replace with the modern idiom: a 2px accent stripe on the inner edge, icon in
   `--text-primary`, background `--surface-hover`. This is the single most dated element in the IDE.
2. **Status bar loses its accent background.** A fully saturated blue band across the bottom is the
   most recognizably-2016 thing in the app. Move to `--surface-chrome` with `--text-secondary`
   labels, and let *state* carry colour (error chip, running indicator) instead of the whole bar.
3. **Document tab separation.** Give inactive tabs a `--border-subtle` right edge so they stop
   merging into one band, and mark the active tab with a 2px accent bar plus a genuine
   `--surface-raised` background instead of a 1px border that is invisible against the body.
4. **Tab overflow affordance.** The header currently relies on horizontal scroll plus a
   `useScheduledTabVisibility` hook that calls `ensureTabVisible` immediately, in a `rAF`, and again
   at 0/50/150ms timeouts. Add proper overflow chevrons and a tab-list dropdown, and delete the
   timing hack in favour of a `ResizeObserver`-driven measurement.
5. **Emulator screen gets a frame.** The canvas is currently a bare rectangle on flat `#606060`.
   Give it a `--radius-md` container, a `--border-default` bezel and `--shadow-2`, and move the
   `- 8` magic gutter out of `useEmulatorScreen.ts` into real `padding` on `.emulatorPanel`.
6. **Splitter gets a rest state.** Currently invisible until hovered. Show a `--border-subtle`
   1px line at rest, `--accent-solid` on hover/drag, and move the transition off `.pointed` so it
   fades both ways. Keep the 4px grab zone but widen the *hit* area to 8px via a pseudo-element.
7. **Panel header consistency.** `SideBarHeader` (36px, `padding-left: 4px` + text `padding-left: 20px`)
   and `SideBarPanel .header` (24px) become one `PanelHeader` primitive at `--strip-sidebar-header` /
   `--row-panel-header` with a real chevron transition.
8. **Toolbar rhythm.** `gap: 0` today, so buttons abut. Move to `--space-1` gap, group related
   controls, and replace the content-box `ToolbarSeparator` (which renders taller than its own
   toolbar) with an inset 60%-height rule.

---

## 5. Accents — a shipping set of six

**Decided:** the accent is a **user setting**, orthogonal to light/dark. Six ship.

### 5.1 The measurement that shaped the set

Hue angle turned out to be too crude a test. Switching to **ΔE2000** — perceptual distance, which
accounts for lightness and chroma, not just hue — showed that three accents which passed a 20°
hue-gap rule were in fact nearly indistinguishable from colours Klive already uses:

| Candidate | Hue gap said | ΔE2000 said | Against |
|---|---|---|---|
| Phosphor Amber | 3° — fail | **8.5** | `--color-label` (register names) |
| Deep Cyan | 21° — pass | **17.5** | success green |
| Phosphor Green | 22° — pass | **5.4** | `--color-secondary-label` |
| Spectrum Magenta | 63° — pass | 26.3 | error |

A ΔE of 5.4 is "same colour" to most eyes. The hue rule is therefore replaced by **ΔE2000 ≥ 20**
against every colour that carries meaning.

### 5.2 The data-panel colours change — and should

The binding constraint was never the status palette; it was `--color-label` (`#f89406`) and
`--color-value` (`#00afff`), which tile the register panels densely. Between them they occupied both
the warm and the cool band, which is what made an orange accent impossible.

With the user's agreement these are re-cast as a **hierarchy** rather than a set of categories:

| Role | Dark | Light | Contrast |
|---|---|---|---|
| Value (the data) | `#e4e6ea` | `#1b1d21` | 14.1 / 15.9 |
| Label (`AF`, `DE`, `PC`) | `#949aa4` | `#565c65` | 6.2 / 6.3 |
| Secondary (decimal suffix) | `#7f8690` | `#6b717a` | 4.8 / 4.6 |
| **Changed since last stop** | `--accent-solid` | `--accent-solid` | — |

This is better design independently of the accent question. A dense register panel carrying three
saturated hues is a Turbo-Debugger habit; recessing the labels and giving the *values* the highest
contrast makes the data easier to scan. It also frees colour to mean **state** — the last row is a
signal Klive does not currently express at all, and it is the one a debugger actually wants.

The warning colour also moves from `#e0a33c` to a red-orange `#E8703A` / `#A03F0C` (hue 19–21), which
separates it from the gold Ember accent by ΔE 31.9 / 23.5.

### 5.3 The final six

| Setting | Dark | Light | Dark ΔE | Light ΔE | Contrast |
|---|---|---|---|---|---|
| **Sinclair Blue** *(default)* | `#45A5E6` | `#0A6FB8` | **41.0** | **44.3** | 6.77 / 5.28 |
| **Spectrum Magenta** | `#C264D6` | `#9B2FB4` | 26.3 | 29.7 | 5.30 / 6.07 |
| **Ember** | `#FFC933` | `#8A6A00` | 31.9 | 23.5 | 11.88 / 5.07 |
| **Ultraviolet** | `#A78AF5` | `#6340C8` | 32.7 | 36.0 | 6.61 / 6.78 |
| **Deep Teal** | `#2FC2BE` | `#0A7D78` | 17.5 | 18.0 | 8.34 / 4.98 |
| **Phosphor Green** | `#76C842` | `#3B7A16` | 13.4 | 12.1 | 8.80 / 5.27 |

All twelve combinations clear WCAG AA 4.5:1.

- **Sinclair Blue** is today's `#007acc`, brightened to `#45A5E6` because the original fails AA on
  dark at 4.05:1. Once the register values stop being blue it becomes the **best-separated accent of
  the six** — the colour that was previously most compromised is now the safest.
- **Ember** is gold rather than orange, holding ΔE 31.9 from the retuned warning.
- **Deep Teal (17.5)** and **Phosphor Green (13.4)** are the two weakest and sit just under the ≥20
  bar, both against the success/run green. They ship anyway on the reasoning that success is a
  *sparse, transient* colour — one Run button, one output line — whereas the label collision that
  condemned Amber repeated twenty times per panel. Green is the weakest thing in the set and is the
  first candidate to drop if it looks wrong in the real app.
- **Rainbow Red was dropped**: ΔE 0 from the error colour, and it shares a hue with the recording
  indicator.

### 5.4 What shipping six accents costs

- `ThemeProvider` gains an `accent` axis alongside `tone`. **No component changes** — consumers read
  `--accent-solid` and friends.
- Persistence follows the existing theme path: `appSettings.accent` in `~/Klive/klive.settings`.
- A **View → Accent** submenu beside View → Themes in `app-menu.ts`.
- `token-contract.test.ts` asserts, for **every accent × theme pair**, contrast ≥ 4.5:1 for text,
  ≥ 3:1 for indicators, and **ΔE2000 ≥ 12 from every meaning-bearing colour** (the floor the shipped
  set actually holds). This is what would have caught the amber problem without anyone spotting it.

**Default: Sinclair Blue on the dark theme.** It is the best-separated accent of the six, it is the
least disruptive to existing users (same hue as today, just legible), and it keeps the strongest
colours available as opt-in personality rather than imposing them.

## 6. Phases

Each phase ends green on the verification set in §7 and leaves the app coherent. Phases 0–5 are the
shell. Phases 6–7 are the consolidation that §2.4 forced into scope, run as twelve independently
shippable slices: **Phase 6** unifies the presentational layer (rows, labels, values, headers) and
**Phase 7** the composite components that own behaviour (console, toolbars, viewers, virtualization,
ToolArea). **Phase 8** (Monaco) depends only on Phase 1 and can run any time after it, including in
parallel. **Phase 9** is partly optional.

### 6.0 Every phase ends with a review of the remaining phases

**This plan is written from an audit, not from experience of changing this code.** Several of its
estimates are inferences that the first contact with the codebase will correct. So each phase ends
with a short written retrospective appended to this document, and **the remaining phases are amended
in place** rather than followed as written.

The retrospective answers five questions:

1. **What did this phase cost against the estimate?** Especially the *visual review* pass, which is
   the only real QA here (§7) and the least predictable line item.
2. **Which assumptions were wrong?** Name them explicitly, and mark the sections of this plan they
   invalidate.
3. **What did the code turn out to contain that the audit missed?** The audits were thorough but
   read-only; some duplication only becomes visible when you try to unify it.
4. **Does the remaining phase order still make sense?** A later phase may have become unnecessary,
   or may need to move earlier.
5. **Should the scope change?** Specifically: is the Phase 6–8 consolidation still worth its cost?

Amendments are made to this file directly, with the retrospective dated and kept beneath the phase
it belongs to, so the plan stays the single source of truth rather than being overtaken by a trail of
notes.

**Phase 0 is the most important review of the set**, because it is the first contact and it
calibrates three numbers that every later phase depends on:

| What Phase 0 measures | What it tells you |
|---|---|
| How large the `box-sizing` fallout actually is (0.6) | Whether the height-ladder normalization in Phases 3–5 is a footnote or a project |
| How long one full screenshot review takes (0.0 vs exit) | Multiply by ~9 phases × 2 themes — this is the plan's real hidden cost |
| How many places the contract test catches (0.1) | Whether the L4 aliasing trick in Phase 1 is as safe as §3 claims |

If Phase 0's screenshot review turns out to take hours rather than minutes, that is the signal to
cut scope — and the honest place to cut is the tail of the Phase 6–7 slices, not the shell.

> **Every phase and every slice ends with a §6.0 retrospective and an in-place amendment of the
> phases below it.** A phase is not done when its code lands; it is done when this plan has been
> updated to reflect what building it taught.

### Phase 0 — Foundations & cleanup

Phase 0 earns its own detail because it is the phase most likely to be underestimated. It looks like
a janitorial list, but it contains **the single riskiest line in the plan**, several fixes that are
*visible to users* despite being labelled "cleanup", and the test that every later phase depends on.

It is therefore run as **seven ordered steps, each its own commit**, so that any one can be reverted
without unpicking the others.

**Step order changed from the first draft.** The `box-sizing` change was originally scheduled first,
on the reasoning that it should land alone. It is now **last**: landing alone is a property of it
being its own commit, not of its position, and doing the cleanup first means there is materially
less surface left to re-verify when it does land.

#### 0.0 — Baseline capture *(no code change)*
Screenshot both windows, both themes, at a fixed window size: toolbar, activity bar, sidebar with a
panel expanded, tab strip, tool area, status bar, emulator screen, keyboard. Store under
`.plans/baseline/`. Nothing in CI catches visual regressions (§7), so this is the only reference
later phases can be compared against. Do this before touching anything.

#### 0.1 — The contract test, written to fail
Write `test/theming/token-contract.test.ts` (§3.4) **before** any fix, and let it fail. Its failure
list should match the table in §2.3 exactly. Two benefits: it proves the audit was right, and the
failure output becomes the working checklist for steps 0.2–0.4.

Contrast and ΔE assertions (§5.4) are **not** added here — there are no ramps yet. They arrive with
Phase 1.

#### Phase 0.0–0.1 retrospective *(2026-09-06)*

Per §6.0. Two phases' worth of first contact, and both corrected the plan.

**0.0 — baseline capture.** `screencapture` is unusable in this environment (no macOS Screen
Recording permission), so capture goes through Electron's `--remoteDebuggingPort` and CDP
`Page.captureScreenshot` instead — no OS permission, and it grabs the renderer directly. Seven of
eight images captured; `ide-light-03-commands.png` was lost to a wedged CDP endpoint and is noted in
`.plans/baseline/README.md`. **The theme cannot be switched by editing `klive.settings`** — the app
rewrites it during startup and silently reverts the value. Switching must go through the View →
Themes menu via `osascript`.

**0.1 — contract test.** Written before the fixes and failing as intended: 4 failures, 1 pass.
Every §2.3 prediction was confirmed, with one correction:

> **The audit over-counted `--main-font`.** It reported 8 references; there are **4**
> (`ExplorerPanel` ×2, `Modal`, `Button`). The original grep used `--main-font\b`, and `\b` matches
> at the hyphen inside `--main-font-family`, so correct usages were counted as typos. §2.3 and
> Phase 0.3 are corrected.

The test also needed two accommodations the plan had not anticipated, both now documented in it:

- **Self-declared variables are legitimate.** 29 `--os-*` custom properties belong to
  OverlayScrollbars and are declared in the app's own CSS. The resolution rule is therefore "defined
  by both themes **or** declared in a scanned stylesheet **or** on a short runtime allowlist".
- **Some token names are built by concatenation** — `"--color-tabbutton-fill-" + (isActive ? …)`.
  These cannot be resolved statically, so a name ending in `-` is checked as a prefix instead. Two
  display placeholders (`"--"`, `"----"` in `Values.tsx`) also had to be excluded by requiring a
  letter after the dashes.

**Calibration for later phases (§6.0).** The visual review pass is the number that matters, and it
is cheap so far: capturing and reading 7 screenshots took minutes, not hours. That supports keeping
the full Phase 6–7 scope. The `box-sizing` fallout in 0.6 remains the untested assumption.

#### 0.2 — Dead code *(zero visual risk)*
Delete the 3 orphan stylesheets; collapse the 8 byte-identical `Next/*.module.scss` to one shared
module; remove the dead classes catalogued in §2.3 and §2.4l (`.icon`/`.iconPointed`,
`.splitterHor`/`.splitterVert`, `.sectionSeparator`, the stale `.toolbar` rule, `CommandResult`'s
`.listWrapper`/`.item`, `DisassemblyPanel`'s dead `.panel`/`.header`/`.headerSeparator`/
`.iconPlaceholder`, `DskViewerPanel`'s three unused blocks); drop the duplicate `arrow-circle-left`
icon entry — **delete the *first* one (`icon-defs.ts:257`), not the second**: the two are different
glyphs, and the first carries a mis-copied *right*-pointing path identical to `arrow-circle-right`.
`icons.set()` iterates in order, so the later entry currently wins and the icon renders correctly
today. Removing the wrong one silently flips the glyph; de-duplicate `SECONDARY_ICON_SIZE`; remove the unused `react-virtualized-auto-sizer`
dependency.

*Verification:* `electron-vite build` (catches Vite import-analysis errors after file deletion, per
`AGENTS.md`) plus a spot-check that the screens in 0.0 are pixel-identical. **This step must be
pixel-identical** — if anything moved, something that looked dead was not.

#### Phase 0.2 retrospective *(2026-09-06)*

**Pixel-identical: confirmed.** All three re-captured states match the baseline exactly
(`imgdiff.py`, now kept in `.plans/baseline/` for reuse). Build, typecheck and tests all pass; the
180 `tsc` errors are the pre-existing baseline noted in `AGENTS.md`, and **none are in a touched
file**.

**The audit over-claimed dead CSS, and the method used to find it was unsound.** A first pass that
searched for `styles.<name>` across the whole tree marked `.panel`, `.header`, `.item` and friends as
*live* wherever any other file used the same name. The sound method is **per-importer**: resolve each
`*.module.scss` to the file(s) that import it, and only count `styles.X` in those. Redone that way,
the audit's list held up — but three of its claims did not:

| Audit said | Actually |
|---|---|
| `.icon` and `.iconPointed` dead | both dead ✓ |
| `.sectionSeparator` dead | dead ✓ — and `.infiniteRotate` + its keyframes are too |
| `CommandResult` `.listWrapper`/`.item` dead | dead ✓ |
| `DskViewer` three blocks dead | dead ✓ |

**The per-importer sweep also found dead classes the audit missed** — `PaletteEditor`
(`.checkbox`, `.dropdownWrapper`), `ToolArea` `.outputLine` ×2, three dialog modules, `DataSection`,
`NextPaletteViewer`, `ExplorerPanel` `.editor`, `SpriteEditor` ×3, and three Monaco decoration
classes. **These were deliberately left in place**: 0.2's value is being provably inert, and
widening it past the plan's catalogue would have made that harder to verify. They are a follow-up.

**One class was deliberately *not* deleted.** `Values.module.scss` `.bitValue` reads as dead only
because of the `Values.tsx:246` bug (§2.4m) — fixing that in 0.4 makes it live. Deleting it would
have destroyed the fix's target.

**The icon trap was real.** The two `arrow-circle-left` entries are different glyphs; the first
carries a mis-copied *right*-pointing path. Deleting the second — the obvious "remove the duplicate"
move — would have silently flipped the icon. Verified after deletion that the surviving path differs
from `arrow-circle-right`.

**Method correction for later phases: screenshots must be taken after the UI settles.** A capture
500 ms after clicking the activity bar differed from the baseline by 7 pixels out of 4.2 million
(max channel delta 3). A settled re-capture was pixel-identical, and two consecutive settled captures
were identical to each other. So the renderer *is* deterministic; the noise floor is zero, and any
non-zero diff is either a real change or an unsettled capture. **Do not treat small diffs as noise —
re-capture instead.**

#### 0.3 — Broken references *(mostly invisible — two exceptions)*
Fix both empty `var()` calls; the 4 `--main-font` → `--main-font-family` typos; add `--console-default` to `light-theme.ts`; point
`WatchPanel`'s `--color-separator` and `--color-bg-hover` at real tokens.

**Two of these are visible and belong in the changelog:**
- The Watch panel gains row separators and hover feedback it has never had.
- Console default text becomes correctly coloured **in light mode**.

*Verification:* 0.1's test goes green.

#### Phase 0.3 retrospective *(2026-09-06)*

**The contract test is green — 5/5.** That is a Phase 0 exit criterion met early. Before trusting it,
I injected a bogus `var(--definitely-not-a-token)` and an empty `var()` and confirmed both were
caught with correct line numbers, then reverted: the test still has teeth.

**One item was already done.** `--color-activitybar-pointed` went out with `.iconPointed` in 0.2, so
0.3 had four fixes, not five.

**The test had a bug of its own.** It flagged `Layout.module.scss:49` — matching the literal `var()`
inside the *comment I had just written* explaining the bug. Fixed properly rather than by rewording:
the scanner now blanks SCSS/CSS comments (preserving newlines so line numbers stay accurate).
Comment-stripping is applied to stylesheets only — in TSX a `//` also appears inside string literals
like `"https://…"`, where blanking to end of line could hide a real token reference.

**Fixes applied**, with the token choices justified:

| Broken | Now | Why |
|---|---|---|
| `Layout.module.scss` `background-color: var()` | declaration removed, class kept | `.headerRow` is `HeaderRow`'s default class in `Row.tsx`; the declaration was always dropped, so removing it preserves rendering exactly |
| `Layer2Screen.module.scss` `.header` | rule deleted | both broken *and* unreferenced — `Layer2Screen.tsx` uses only `.panel` |
| `--main-font` ×4 | `--main-font-family` | the real token name |
| `--console-default` missing from light | `#202020` | dark uses `#e5e5e5`, which is its own `--console-ansi-white`; the light mirror of "default terminal foreground" is the theme's own `--color-text` |
| `WatchPanel` `--color-separator` | `--color-panel-border` | already the "border inside the sidebar" colour |
| `WatchPanel` `--color-bg-hover` | `--bgcolor-item-hover` | matches `CallStackPanel`, its closest sibling list panel |

**Verification, and why it took longer than it should have.** The three **dark** states are
pixel-identical to the baseline. The **light** comparison initially showed a 24.7% difference, which
was alarming and entirely spurious: every difference traced to *capture state*, not styling —

1. the sidebar was still on **Debug** from the dark run, while the baseline `light-01` shows Explorer;
2. the tool area was on **OUTPUT**, while the baseline shows **COMMANDS**;
3. clicking an already-active activity button **collapses the sidebar** (VS Code behaviour), which
   removed a whole 212px column;
4. the last 0.63% was Monaco's **minimap slider and scrollbar**, which render only on mouse
   interaction.

Because state proved so hard to reproduce, the fixes were verified directly instead, by reading
computed values over CDP in both themes: `--console-default` now resolves to `#202020` in light
(previously undefined), `--color-panel-border` and `--bgcolor-item-hover` resolve in both, and
`--main-font` is confirmed absent while `--main-font-family` resolves to Inter.

**Method correction — capture state is a fixture, not an afterthought.** 0.2's lesson was "don't
dismiss small diffs". 0.3's is the inverse: **don't panic at large ones until state is proven equal.**
Both are cheap to avoid by driving the app to an explicit known state before every capture rather
than inheriting whatever the previous step left behind. `.plans/baseline/README.md` now records the
exact state each image was taken in.

#### 0.4 — Live bugs *(all visible)*
- `Values.tsx:246` — `styles.flag`/`styles.clickable` resolve to `undefined`. Fixing it restores
  centering and the pointer cursor to **~120 flag indicators** across Ula/Blink/Vic and every
  `FlagRow`. Users will notice.
- `EmuStatusBar` **and `IdeStatusBar`** `.isMonospace` — the specificity collision that renders every
  numeric readout at 16px beside its own 12.8px label. Fixing it makes the 26px status bar viable (§4).
- `SideBarPanel.tsx:56` — the `noScrollViewer` inversion, and the double-nested `ScrollViewer` it
  causes in `NecUpd765Panel` and `ScriptingHistoryPanel`.
- `SideBarPanel.tsx:68` — `tabIndex={index}` (positive tabindex overriding tab order app-wide) → `0`.
- Rename `PsgPanel`'s `.ulaPanel` class *(invisible)*.

*Verification:* focused tests around the touched panels; manual check that the two double-scrolled
panels now measure a bounded viewport.

#### Phase 0.4 retrospective *(2026-09-06)*

All five landed. Contract test still 5/5; `tsc` still exactly 180 errors (the pre-existing baseline),
none in a touched file; build green.

**The status-bar collision existed in *both* windows.** The plan named only `EmuStatusBar`, but
`IdeStatusBar` carries the identical `.label` (0.8em) / `.isMonospace` (1em) pair — visible in the
baseline as `Ln **23** Col **33**`. Fixed in both; fixing one would have left the inconsistency to be
rediscovered in Phase 5. The pixel diff is confined **exactly** to the status-bar row in both
windows — emulator `x 32–257` (the frame-time and PC readouts), IDE `x 1174–1263` (Ln/Col) — and
nothing else moved.

**The `BitValue` bug was real but the audit's mechanism was wrong.** It reported that
`styles.flag` / `styles.clickable` "resolve to `undefined`". They do not: Sass compiles
`.bitValue { &.clickable }` to `.bitValue.clickable`, so CSS Modules exports **both** names. The
element therefore received two perfectly valid class names that simply have **no standalone rules** —
same net effect, different cause. Worth knowing, because "the export is missing" and "the rule is
compound" call for different fixes.

**I deviated from the plan here, deliberately.** The plan said to restore the pointer cursor to
"~120 flag indicators". Only **5 of 29** `BitValue` call sites pass a `clicked` handler, so an
unconditional `cursor: pointer` would advertise interactivity that 24 of them do not have. The fix
applies `.bitValue` always and `.clickable` only when `clicked` is supplied. Verified at runtime: 40
elements in the ULA panel now carry `_bitValue_…`, with `display: flex`, `justify-content: center`
and a working `cursor: pointer`.

**The `BitValue` fix produced no layout change**, which is worth recording so it is not mistaken for
a failed fix later. Without `.bitValue` the div was `display: block`, but as a flex item inside
`.cols` it already shrank to its content, so the icon sat where `justify-content: center` would have
put it anyway. The real repairs are the cursor and the now-explicit centering.

**My analysis of the registry was wrong; the plan was right.** A first regex mis-attributed
`useScrollViewer: false` and suggested five panels double-nested. Correctly parsed, the flag belongs
to CallStack/NextReg/Watch/Breakpoints/SysVars, and exactly the two panels the plan named —
`NecUpd765Panel` and `ScriptingHistoryPanel` — were missing it. Confirmed after the fix:
`overlayScrollbarHosts: 1, nestedScrollHosts: 0` for Scripting History, with a bounded viewport.

**The flag was renamed rather than re-polarised.** `noScrollViewer` now reads `useScrollViewer`,
with the five existing call sites carrying their values across unchanged — **zero behaviour change**,
and the name finally matches what the field does. Inverting the logic instead would have flipped the
behaviour of five working panels to satisfy a name.

#### 0.5 — Anchor the root font size *(intended no-op)*
Set an explicit `font-size` on **`<html>`** — not on the theme root, which would leave the 22 `rem`
values in the tree unanchored, since `rem` resolves against the root element. Today every `em` resolves against the browser's 16px
default (§2.2), so **anchoring at exactly 16px changes nothing visually** — it just stops the value
being implicit before Phase 1 starts moving type onto tokens. Resist the temptation to set the
compact size here; that is a Phase 1 change with a much wider blast radius.

#### Phase 0.5 retrospective *(2026-09-06)*

**A proven no-op.** `html { font-size: 16px }` added to `index.css`; three views
(Explorer, Debug, emulator) are pixel-identical **against the post-0.4 captures**, which is the
comparison that isolates this step — diffing against the original baseline would have folded in
0.4's status-bar change and told us nothing. Runtime confirms `html`, `body` and `#themeRoot` all
compute to `16px`.

**It belongs on `<html>`, not on the theme root.** The plan said "the theme root", which would have
left the 22 `rem` values in the tree unanchored — `rem` resolves against the root *element*, and
`#themeRoot` is a `<div>` well below it. Anchoring `<html>` covers both the 55 `em` font-sizes
inheriting through the chain and the `rem` values. §0.5 of the plan is corrected.

**The pixel-identical result is itself the proof that 16px was the value already in effect.** Had
Chromium's default differed, the diff would have been non-zero everywhere.

*Noise checked and dismissed:* a scan for malformed `rem` literals flagged
`ExcludedProjectItemsDialog.module.scss:33`, which turned out to be the regex matching `.removeButton`
— the `.` of the class selector followed by "rem". Not a defect.

#### 0.6 — `box-sizing: border-box` *(the risky one, alone, last)*
Add `*, *::before, *::after { box-sizing: border-box }` to `index.css`.

Known casualties to fix in the same commit, from §2.2:
- Toolbar renders 42px today (34px content + 4px×2 padding) → becomes 34px. Set it to the intended
  height explicitly rather than letting it shrink.
- `ToolbarSeparator` is 38px inside a 34px toolbar → becomes 30px.
- Any `@include fix-height-panel()` with padding on the same box.

*Verification:* full screenshot diff against 0.0. This is the step where the baseline pays for
itself.

#### Phase 0.6 retrospective *(2026-09-06)*

The riskiest step, and the one that behaved least like the plan predicted. Contract test 5/5, `tsc`
still exactly 180, build green, app runs correctly in both windows.

**Compensations applied, all verified exact.** Measured before and after at the same window size:

| Element | Before | After compensation |
|---|---|---|
| Toolbar (`HStack`) | 42px rendered (34 declared) | `height="42px"` → **42px** ✓ |
| `ToolbarSeparator` | 9 x 38 | `width: 9px; height: 38px` → **9 x 38** ✓ |
| `IconButton` | 34 x 32 | `+4 / +2` on the inline totals → **34 x 32** ✓ |
| `DocumentTab`, sidebar `.header`, explorer `.item`, `.closingTab`, tool-tab `.textWrapper` | — | declared sizes raised by their border widths |

`theme-utils.ts` also had to stop subtracting horizontal padding from `width`: that
`calc(100% - pad - pad)` existed to undo content-box, and under border-box it shrank every padded
panel by twice its padding. That single line was the root of the `y-8` cascade through the whole IDE.

**Two differences remain, and both are corrections rather than regressions.** I chose not to
compensate them, because doing so would mean preserving an overflow bug:

1. **`IconButton`'s `.iconWrapper`** is `fill-parent-flex` plus `border: 2px solid transparent`.
   Under content-box it was 100% of its parent *plus* 4px, so the selection ring on toggled toolbar
   buttons overflowed its own button. It now sits inside it (32x30 within a 34x32 button).
   Preserving the old look would have required `calc(100% + 4px)`.
2. **The split boundaries resolve ~3px differently** (emulator keyboard top CSS 539 → 542). The
   persisted values are unchanged (`keyboardPanelHeight: 241px`), but `SplitPanel` sizes from
   `clientHeight`, which no longer includes an overflowed ancestor. The split is user-draggable and
   persisted, so this is not a visual defect.

The toolbar and both status bars — the things that would actually be noticed — are **pixel-exact**
(toolbar bottom CSS 42, status bar top CSS 788, identical before and after).

**Method corrections, both of which cost time:**

- **Never measure geometry on a hot-reloaded app.** After HMR applied a CSS change plus three `.tsx`
  changes in sequence, the React root emptied and every element reported as REMOVED. Geometry and
  screenshots require a **fresh launch**.
- **The comparison baseline must match window size.** My "before" geometry snapshot was taken at the
  user's own window size and the "after" at the pinned capture size, which produced a 100+ element
  diff that was pure noise. Screenshots were unaffected because both were pinned — but the geometry
  table was worthless until re-taken.

**On the Phase 0 exit criteria:** the list of "five knowingly-visible changes" needs extending to
seven — the two above are visible, intended, and are corrections of real bugs.

#### Phase 0 exit criteria
- `token-contract.test.ts` green.
- `npx tsc --noEmit -p build/tsconfig.web.json`, `npm run lint:renderer`, `npm test -- --project jsdom`,
  and `electron-vite build` all green.
- Screenshot diff vs 0.0 reviewed, and every difference is one of the **seven** knowingly-visible
  changes above (five from 0.3/0.4, plus the two border-box corrections in 0.6).
- **Phase 0 retrospective written** (§6.0) — Phase 0 is the phase that calibrates every estimate that
  follows.

### Phase 1 — Token layer *(the visual moment; 3–4 files)*
- Author L1 ramps + L2 semantics + L3 dimensions, including M2's `ch`-based measure scale, M3's
  JS-readable `rowSizes` module, and `--strip-statusbar: 26px`.
- Build the **accent axis** (§5.4): six accent ramps, `ThemeProvider` gains an `accent` prop, a
  `View → Accent` menu, and an `appSettings.accent` key persisted alongside `theme`.
- **Re-cast the data-panel colours** (§5.2): `--color-label` / `--color-value` /
  `--color-secondary-label` become a contrast hierarchy instead of three hues, the warning colour
  moves to red-orange, and `--accent-solid` takes on the "changed since last stop" role. This is a
  visible change to every register and memory panel, so it lands with the token layer where it can be
  reviewed in one pass rather than leaking across later phases.
- Repoint all 201 existing L4 tokens onto them. **Light is derived, not authored** (§8.2), so
  `light-theme.ts` collapses to the four hand-tuned exceptions plus the `--device-*` set. Retire the raw CSS keywords and the 15 `#007acc`
  copies. Add the `--color-status-*` tier that §2.4 shows the panels currently fake with
  `--console-ansi-*`, and collapse the three different row-hover tokens into one.
- **Review gate:** the whole app should already look new here. Screenshot both windows, both themes.
- **Watch item:** M3 must land with this phase or every virtualized panel breaks.

#### Phase 1 retrospective *(2026-09-06)*

**The token layer is in and the app looks different.** Contract test 5/5, `tsc` still exactly 180,
build green, both windows and both themes verified, accent switching verified end to end.

Sequenced like Phase 0 rather than as one commit:

| Step | What | Visible? |
|---|---|---|
| 1.0 | `tokens/palette.ts` (L1), `semantic.ts` (L2), `dimensions.ts` (L3), `rowSizes.ts` (M3) | no |
| 1.1 | `ThemeProvider` emits all four layers | no |
| 1.2 | Accent axis: `common/theming/accents.ts`, state, persistence, **View → Accent** menu | no |
| 1.3 | `componentAliases.ts` repoints the ~200 legacy tokens onto L2/L3 | **yes — everything** |

**The L4 aliasing trick worked exactly as designed.** Not one stylesheet was edited, and the whole
app changed palette: the saturated `#007acc` status bar is gone, the activity bar's solid accent slab
is gone, and every surface now comes from one ramp. §3's central claim holds.

**And it collapsed the light theme, as §8.2 predicted.** Because L2 already varies by tone, the alias
map is tone-*independent* — one map serves both themes. Light is now derived rather than
hand-maintained.

**The accent registry had to live in `common/`, not the renderer.** `app-menu.ts` runs in the main
process and needs the labels; the renderer needs the ramps. Splitting ids/labels (`common/theming/
accents.ts`) from colour values (`renderer/theming/tokens/palette.ts`) keeps one source of truth
without dragging renderer colour code into main.

**One real bug, caught only by looking at the app.** My first `--surface-stage` value (`#0f1113`) sat
within one step of `--device-bezel` (`#0f1012`), so **the emulator screen disappeared into its own
surround**. Every automated gate passed — contract test, typecheck, build — because nothing here is
checkable by contrast ratio: both are legitimate colours, they just must not be *adjacent*. Fixed to
`#2a2d32`, restoring the "darker screen on a lighter stage" relationship the original design had at
`#404040` on `#606060`.

That is worth recording as a limit of the tooling: **the contract test cannot catch a token that is
correct in isolation and wrong in context.** The screenshot pass is not optional.

#### Phase 1.4 — the theme files are gone

**`dark-theme.ts` and `light-theme.ts` are deleted: 515 lines of hand-authored literals.** A
mechanical audit showed **188 of their 201 tokens** were already produced by L2/L3 or aliased onto
them, and that light held **no** leftovers dark did not — so the remainder collapsed to one shared
`staticTokens.ts` (four font stacks, six data-URI breakpoint glyphs, one padding shorthand) plus a
two-value `toneTokens()` for the backdrop wash and the modal-header texture. A theme is now just a
tone. All 490 jsdom tests and the contract test pass.

**A correctness gap surfaced while doing it, and it mattered more than the deletion.**
`getThemeProperty()` looked tokens up in the theme object, so after 1.3 it was still handing the
**pre-token literals** to the ~30 imperative consumers: every stylesheet had moved to the new palette
while the toolbar icons, activity-bar icons and all 26 keyboard SVGs quietly kept the old one. The
screenshots looked plausible, which is exactly why it nearly passed.

The fix had to resolve *computed* values rather than return the alias text, because the keyboard puts
the result into an SVG **presentation attribute** (`<rect fill={…}>`), where `var()` does not resolve
at all. `getThemeProperty` now reads `getComputedStyle(root).getPropertyValue(key)`, with the merged
map as a first-render fallback.

**And that fix immediately exposed a design error of mine.** With the imperative path finally
resolving real tokens, the toolbar turned out to be painted `--text-secondary` — I had aliased
`--color-toolbarbutton` to the secondary tier, and the whole toolbar read as disabled. Promoted to
`--text-primary`. The genuinely disabled buttons now read correctly too, having previously used
`--bgcolor-toolbarbutton-disabled` (`#d0d0d0` in dark — a *background* token misused as a foreground
fill, which the audit flagged in §2.3).

**The contract test grew a sixth assertion**: every accent must emit the *same key set*, so a
stylesheet cannot resolve under one accent and fail under another.

**Still open**, deferred by design:

- **Monaco still uses its own palette** — Phase 8. It is now visibly the odd one out, which is the
  strongest argument yet for doing it.
- **`--strip-statusbar: 26px` is emitted but not consumed**; the status bars still declare 40px in
  their own stylesheets. Phase 5 wires it.
- **The `--measure-*`, `--row-*` and `--icon-*` scales are emitted but unused** until Phases 3-7
  migrate the panels onto them.

### Phase 2 — Shared primitives
`IconButton` becomes a real `<button>` with CSS `:hover`/`:active`/`:focus-visible`; delete the React
hover state, the module-global pointer position and the `elementFromPoint` probe. One `PanelHeader`
(promoted to a real component: title, actions, surface, border), one `Tab`, one focus-ring treatment.
Keyboard access and ARIA roles across the shell. Reconcile `common/Icon.tsx` vs `controls/Icon.tsx`.

#### Phase 2 retrospective *(2026-09-06)*

490 jsdom tests pass, 54 theming tests pass, build green, and **`tsc` is down to 175 from the
180-error baseline** — five fewer than before the phase started, because several of the errors were
the mistyped tooltip refs on the very components being converted.

**Three `<div>`s became real `<button>`s**, and each one deleted machinery rather than adding it:

| Component | Was | Now |
|---|---|---|
| `IconButton` | `<div>` + `useState` hover + inline `backgroundColor` + `keyDown` state | `<button>`; hover/active/disabled/focus are CSS |
| `TabButton` | `<div>` + `keyDown` state + a spacer `.placeholder` | `<button>`; `:active` and `:disabled` |
| `ActivityButton` | `<div>` + `pointed` state feeding `getThemeProperty` | `<button role="tab">`; `currentColor` |

**The `DocumentTab` hover machinery is gone entirely** — the module-global
`lastDocumentTabPointerPosition`, the `elementFromPoint` probe and the `pointed` state. All three
existed because `onMouseEnter` does not re-fire when tabs reorder or rename under a stationary
pointer. CSS `:hover` re-evaluates on layout change for free. The close button is now hidden with
`visibility` rather than unmounted, which preserves the no-reflow property the spacer placeholder
was there to provide.

**The shell went from essentially unfocusable to 42 focusable elements**, verified at runtime:
`role="tablist"` on the activity bar, `role="tab"` + `aria-selected` + `aria-label` on its buttons,
and `aria-label` on every icon button. A single `focus-ring` mixin in `core.scss` replaces the
ad-hoc treatments, and is applied to the five interactive controls that carried a bare
`outline: none` — including the command prompt, the only text input in the tool area.

**One test had to be rewritten, and it is worth being explicit about why.**
`"reveals the close button when an inactive tab moves under the pointer"` existed specifically to
cover the `elementFromPoint` probe. jsdom does not evaluate `:hover`, so that behaviour is no longer
testable at this level; the test now asserts what still can be — that the button is always rendered
and carries the class the stylesheet keys on. **Deleting a mechanism means honestly re-scoping its
test, not quietly dropping it.**

**A process near-miss worth recording.** My first attempt to replace that test bounded the region
with `rindex("});")` and silently removed **22 of the file's 32 tests** — and the suite went green,
because the remaining 10 passed. Only the test *count* gave it away. Restored from git and redone
with a precisely bounded replacement. **A green suite after an edit to a test file proves nothing
unless the test count is checked too.**

**Deferred from Phase 2**, and honestly still outstanding:

- **`PanelHeader` is not yet a real component** (title / actions / surface / border). It is still the
  twelve-line `HStack` with hardcoded padding. It belongs with slice 7.2, which unifies the 17
  hand-rolled panel toolbars — doing it here would have meant designing the API twice.
- **`common/Icon.tsx` vs `controls/Icon.tsx` are still two files.** Reconciling them touches every
  icon call site and deserves its own reviewable change.

### Phase 3 — IDE: activity bar + sidebar
Fixes 1 and 7 from §4; chevron transition; drop the `100000px` sentinel.

#### Phase 3 retrospective *(2026-09-06)*

All four items landed. 490 jsdom tests, 54 theming tests, build green, `tsc` unchanged at 175.

**The activity bar's solid accent block is gone** — §4's "single most dated element in the IDE". The
active item is now a 2px accent stripe on the inner edge with a subtle surface behind it, drawn as a
`::before` on the button rather than a background fill of the whole cell.

**Geometry is on-token and verified at runtime**, not just declared:

| | Before | Now |
|---|---|---|
| Activity bar | 52px | **48px** (`--size-activitybar`) |
| Activity button | 48px | **44px** (`--size-activitybutton`) |
| Sidebar header | 36px | **34px** (`--strip-sidebarHeader`) |
| Panel header | 26px | **26px** (`--row-panelHeader`) |

**The `100000px` sentinel is gone.** It was standing in for `min-height: 0` — the actual mechanism
that lets a flex child shrink below its content size. The huge number was an approximation of it.

**The sidebar header's fake indent is gone too.** `padding-left: 4px` on the container plus
`padding-left: 20px` on the text existed to eyeball alignment with the panel chevrons below; it is
now one `--space-2` step, and the uppercase title finally has letter-spacing.

**The chevron transition was fixed at the `Icon` level, not the chevron's.** Rotation is applied as
an inline `transform`, so a `transition` next to it covers every rotating icon in the app — the
sidebar chevrons and the tool-area layout toggle both animate now instead of snapping.

**A measurement caveat worth recording.** My first check of the stripe read
`getComputedStyle(btn, "::before").backgroundColor` as transparent, because I queried it in the same
tick as the click that made the button active — React had not re-rendered. The screenshot settled it.
**Reading computed style immediately after a synthetic click measures the previous state.**

### Phase 4 — IDE: document tabs, header, tool area
Fixes 3 and 4; unify the 38/36/32 ladder onto `--strip-tabbar`; give the tool area header its own
surface; restore a focus ring on the command prompt.

#### Phase 4 retrospective *(2026-09-07)*

490 jsdom tests, 54 theming tests, build green, `tsc` unchanged at 175.

**The height ladder is collapsed.** Verified at runtime, all four now report **36px**
(`--strip-tabbar`): documents header, document tab, tools header, tool tab. The `.textWrapper` that
sat at 33px inside a 36px tab is gone with it — it existed only to leave room for the 1px underline
that is now an inset bar on the tab itself.

**Tabs stop merging into one band.** They carried `border-right: none`, and the border they did have
was `--color-doc-border`, which in dark resolved to the *same value as the document body* — so it was
invisible even where it existed. Inactive tabs now have a real `--border-subtle` right edge
(confirmed: `1px rgb(36, 39, 43)`).

**The active tab has a genuine treatment**: a 2px accent bar plus `--surface-raised`, replacing a 1px
top border over a background identical to the body. The bar is an inset shadow rather than a
pseudo-element because `::before`/`::after` are already taken by the drag indicators.

**The tool area header has its own surface** — `#1b1d21` against the body's `#17191c`. It previously
had no background at all, so its tabs sat on exactly the same surface as the output below them,
unlike the document header which always had one.

**The five-shot timing hack is gone.** `useScheduledTabVisibility` fired `ensureTabVisible`
immediately, in a `requestAnimationFrame`, and again at 0ms, 50ms and 150ms — guessing at when tab
geometry might have settled, because nothing told it. A `ResizeObserver` *is* that signal. It also
covers cases the timeouts never could: a window resize, or a long filename arriving late. One rAF
plus the observer replaces all five calls.

**A second test had to be re-scoped**, for the same reason as Phase 2's:
`"clears scheduled DocumentsHeader tab visibility work on unmount"` asserted `clearTimeout` was
called three extra times — cleanup for timers that no longer exist. It now asserts what remains true,
that the pending frame is cancelled. **This time I checked the test count before and after (5 → 5)**,
having nearly lost 22 tests to an unbounded replacement in Phase 2.

**Deferred, and genuinely still outstanding:** fix 4's **overflow chevrons and tab-list dropdown**.
Only the timing-hack half of that fix landed. The affordance is a new piece of UI rather than a
restyle — it needs an overflow measurement, a popup list and its own keyboard handling — and it did
not belong in the same change as the tab geometry it would sit beside.

### Phase 5 — Both windows: status bars + toolbar
Fixes 2 and 8; both status bars to `--strip-statusbar`; toolbar icon sizes collapse from five onto
`--icon-sm/md/lg`.

#### Phase 5 retrospective *(2026-09-07)*

490 jsdom tests, 54 theming tests, build green, `tsc` unchanged at 175. **The shell is now done** —
Phases 0–5 complete.

**Both status bars are 26px**, down from 40px, and identical to each other for the first time. They
were near-duplicate files with divergent values (2px vs 4px separators, different label padding);
they now share one structure on tokens. The height only became viable because Phase 0.4 fixed the
`.isMonospace` collision that was rendering every readout at 16px.

**The toolbar is 38px** (`--strip-toolbar`), down from the accidental 42px that content-box produced,
and its buttons no longer abut — there is a real `--space-0_5` gap between them.

**The separator finally fits inside its own toolbar.** It was 9 x 38px in a 34px content box: taller
than the strip containing it. It is now a 1px rule at 60% height, centred in a 30px slot — a divider
rather than a bar competing with the buttons.

**A follow-on the first pass missed.** After moving the toolbar to 38px the 32px buttons overflowed
its 30px content box by 2px. Invisible, because the backgrounds are transparent — but real. Dropping
the vertical padding to 2px gives a 34px content box, verified at runtime (`fits: true`). **A token
that changes a container's height silently invalidates the padding arithmetic inside it.**

**Icon sizes: five values to four.** 24/20/18/16/12 becomes `iconSizes.lg/md/sm/xs`, exported as
*numbers* — icons are sized through React props as well as stylesheets, the same split `rowSizes.ts`
exists for. The plan asked for three; I kept `xs: 12` because the split-button chevron sits in a
16px-wide button, where a 16px icon would fill it edge to edge. Four deliberate steps beat three
forced ones.

`SECONDARY_ICON_SIZE` no longer holds its own number either — it reads `iconSizes.md`, so the toolbar
cannot drift from the rest of the app.

**Deferred:** the plan wanted the empty 2px/4px spacer `<div>`s in the status bars replaced by a
shared section/separator primitive. Their *sizes* are tokenized, but the elements remain. Collapsing
them into `gap` is a shared-primitive concern and belongs with the `controls/data/` work, not a
one-off here.

### Phase 6 — Presentational primitives, in slices

**Decision: migrate everything, but never in one step.** The original Phase 6/7/8 split — build all
primitives, then migrate 15 panels, then 32 — has a design flaw: it fixes the primitive API *before*
a single panel has been migrated onto it, so the API is a guess. It also produces three enormous
review passes.

Instead the work is sliced **by concern, not by panel**. Each slice introduces one primitive,
replaces every copy of the thing it replaces, and deletes those copies in the same commit.

**Why concern-slices beat panel-slices here.** The duplication the audits found runs *across* panels:
6 identical empty states, 16 data-row rules, 6 "labeled hex value" implementations, 17 hand-rolled
headers, 10 near-identical panel roots. Migrating one panel at a time would touch a little of each
seam and finish none of them, leaving both the old and new stack alive for the whole project. A
concern-slice closes one seam completely.

It is also **cheaper to review**, which matters because visual review is this plan's bottleneck
(§6.0). A concern-slice has a narrow, predictable visual signature — "every empty state changed" is
a two-minute check. "Everything about the Watch panel changed" is not.

#### Slice 6.0 retrospective — the pilot *(2026-09-07)*

490 jsdom tests, 54 theming tests, build green, `tsc` **174** — one below the Phase 5 baseline.

`controls/data/` now exists (`DataPanel`, `DataChrome`, `EmptyState`, `DataRow`, `DataLabel`,
`DataValue`, `DataSecondary`, `HexValue`), and both pilots are migrated: `SysVarsPanel` from
`SiteBarPanels/` and `BinFileViewerPanel` from `DocumentPanels/`.

**The API survived first contact, which was not the expectation.** 6.0 was written expecting to throw
the first attempt away. It held because the two folders turned out to want *the same four things* —
a mono panel shell, an empty state, a row, and a hex value — which is the whole premise of Phase 6
confirmed rather than assumed.

**What the pilot changed about the design:**

- **`DataValue` was not needed directly by either panel.** `HexValue` covers the case, because the
  pattern is always hex-plus-optional-decimal rather than a bare value. The surface is smaller than
  I guessed; `DataValue` stays as the primitive `HexValue` is built from, not as something panels
  reach for.
- **`HexValue` absorbing the decimal echo was right.** `<Value hex/><Secondary (dec)/>` was the
  literal shape in `SysVarsPanel`, and the same pair recurs in `BlinkPanel` — one prop replaces it.
- **`ch` widths work.** `VAR_WIDTH` went from `64px` to `9ch` with no visible change, which is the
  first evidence that M2 is practical and not just principled.
- **A missing primitive surfaced.** `SysVarsPanel` still owns `.byteValue`, `.dumpRows` and
  `.dumpSection` — a hex byte-grid the API does not cover. That is a real gap, not a panel being
  special, and it belongs to slice 6.4 alongside the other hex work.

**A visible change that needs a decision.** `HexValue` defaults to a `$` prefix, so system variables
now read `$00 (0)` where they previously read `00 (0)`. That is the formatter unification working as
intended — the codebase had `$` in `Breakpoints`/`Watch` and not in `SysVars`/`MemMapping`/`NextReg`/
`Blink` — but **slice 6.4 must settle the convention deliberately** rather than letting the default
decide it panel by panel.

**Evidence for the scale of what follows:** `BinFileViewerPanel.module.scss` was deleted outright —
both of its rules were empty states — and `SysVarsPanel.module.scss` lost its root block and empty
state. Two panels in, and one stylesheet is already gone.

**A process lapse worth recording.** I used Python's `str.replace()` without the count assertion I
had been applying all session; it is global, so it rewrote `ByteValue`'s closing `</div>` as
`</DataPanel>` as well as the intended one. TypeScript caught it immediately. **The assertion is
cheap and I should not have dropped it** — the same class of mistake nearly cost 22 tests in Phase 2.

#### The slices, ordered by risk

| # | Slice | Replaces | Risk |
|---|---|---|---|
| **6.0** | **Pilot** — migrate 2 panels by hand (one per folder, e.g. `SysVarsPanel` + `BinFileViewerPanel`) | nothing yet | Discovery. Expect to throw the first API away. |
| **6.1** | `EmptyState` | 6 byte-identical `.center` blocks + 5 hand-written messages (two with stray trailing spaces) | Trivial. Proves the pattern. Also where the rainbow motif lands (§9.2). |
| **6.2** | `PanelHeader` (real: title, actions, surface) | 17 hand-rolled headers, 3 competing heights | Low |
| **6.3** | `DataRow` | 16 separate row rules with 8 different paddings | Low–medium |
| **6.4** | `HexValue` / `FlagValue` / `BitValue` | 6 "labeled hex value" implementations | **Medium** — unifies real behaviour differences: uppercase vs lowercase hex, `$` prefix present in some panels and absent in others. Decide the convention here and apply it everywhere. |
| **6.5** | `DataLabel` / `DataValue` + the `ch` measure scale (M2) | 13 magic width constants, 6 different label widths, 6 CSS widths in `valuedisplay` | **Highest.** Moves sizing out of React props into CSS, which changes how `Label`/`Value`/`Flag`/`Text` are called app-wide. **Sub-slice by folder:** SiteBarPanels first, then DocumentPanels. |
| **6.6** | `DataPanel` root + `DataLabel`/`DataValue` migration + delete the old stacks | 10 near-identical roots; removes one of the two `Row` components and one of the two `.label`/`.value` implementations | Medium — but by now every consumer has already moved. **Carries three items handed over by 6.5:** (a) the `DataLabel`/`DataValue` component migration itself, which 6.5 could not do because `ch` is only 6px under a `.dataPanel` ancestor; (b) the label/value column misalignment between `valuedisplay` and `layout/Label` — equal widths are not enough, `layout/Label`'s `0.4em` side margins have to go and `DataRow`'s `gap` replace them; (c) the `fullWidth` defect that renders `CON 0LCO 0` in the ULA panel, fixed for free by that same `gap`. |

Each slice ships independently and leaves the app coherent: a slice that unifies empty states while
41 panels still use the old row markup is not a half-finished state, because empty states are
self-contained.

#### Slice 6.1 retrospective — `EmptyState` *(2026-09-07)*

490 jsdom tests, 54 theming tests, build green, `tsc` unchanged at 174. Net **-57 lines** across
`SiteBarPanels/`.

Five `.center` blocks removed — `Breakpoints`, `Watch`, `CallStack`, `NecUpd765` migrated to
`EmptyState`, and `ScriptingHistory`'s deleted outright as the audit predicted: it was declared but
never rendered.

**Two stray trailing spaces are gone** — `"No breakpoints defined "` and
`"No log entries collected "`. They survived precisely because each message was written separately;
a single primitive with a `message` prop makes that class of drift impossible.

**The empty states are no longer green.** They rendered in `--color-secondary-label`, which resolved
through the old palette to a green — colour with no meaning attached. They now use
`--data-secondary`.

**The rainbow motif landed here** (§9.2), and two decisions shaped it:

- **The hues are the machine's own**, converted from the ABGR entries in
  `emu/machines/CommonScreenDevice.ts` — bright red, yellow, green, cyan — rather than eyeballed. The
  app already contained the authoritative values.
- **It is held at 0.5 opacity and 18px tall**, so it reads as a watermark. Full-strength Spectrum
  colours next to a debugger's error red and success green would be exactly the competition that
  confined the motif to empty states in the first place.

**One thing I could not verify — since confirmed.** I searched for the case-badge stripe *order*
and neither `worldofspectrum.org` nor Wikipedia documents it; Wikipedia describes "rainbow slashes"
without a sequence. The order shipped (red, yellow, green, cyan) was from memory and flagged as such
in the code. **The project author has since confirmed it is correct**, and the comment now says so
rather than asking for a second opinion. Worth noting the failure mode this avoided: the motif would
have looked deliberate either way, so nothing in the app or its tests could ever have caught a wrong
order — only someone who knows the hardware.

#### Slice 6.2 retrospective — `PanelHeader` *(2026-09-07)*

490 jsdom tests, 54 theming tests, build green, `tsc` unchanged at 174. Net **-57 lines** in
`DocumentPanels/`.

`PanelHeader` and `PanelHeaderActions` now exist in `controls/data`, with a real title slot, an
actions area, a surface and a border — replacing the twelve-line `HStack` that had none of those,
which is why most panels rolled their own instead of using it.

**A new token was needed.** A document panel's header is a different role from the sidebar's
collapsible section header (`--row-panelHeader`, 26px), so it gets `--strip-panelHeader: 30px`
rather than borrowing one. That resolves the 26/30/32 spread the audit found.

**9 of 15 hand-rolled headers migrated**: the seven `Next/` viewers, `ScriptOutputPanel` and
`CommandResult`.

**The `Next/` stylesheet is now gone entirely** — a satisfying arc. Phase 0.2 collapsed eight
byte-identical `Next/*.module.scss` files into one shared module; this slice migrated all seven
consumers to `PanelHeader`, orphaning it. **8 files → 1 → 0.** That is the pattern the whole phase is
built on: consolidate first, then delete the consolidated thing once a primitive absorbs it.

**Six headers remain, deliberately:**

- `TapViewerPanel`, `StaticMemoryView`, `ScriptingHistoryPanel` and `DskViewerPanel`'s top-level
  header — straightforward, but each needs its closing tag matched by hand rather than by pattern,
  and there was no value in rushing four more of those in one sitting.
- **`DskViewerPanel`'s two *nested* headers are a different thing.** They are section headers *inside*
  panel content — a track, a sector — not a panel's own header. Forcing them into `PanelHeader` would
  put a chrome surface and a bottom border in the middle of a data listing. They want a
  `SectionHeader` primitive, which belongs with slice 6.3's row work.

#### Slice 6.3 retrospective — `DataRow` *(2026-09-07)*

490 jsdom tests, 54 theming tests, build green, `tsc` unchanged at 174. Net **-38 lines** in
`SiteBarPanels/`.

**Five row rules replaced across 23 call sites** — `Breakpoints`, `NecUpd765`, `Watch`, `NextReg`
and `MemMapping` (18 rows on its own). Verified at runtime: **39 `DataRow`s** rendering at 22px with
`0 8px` padding and a 4.8px gap — that is `--row-size-list`, `--space-2`, and `0.8ch` resolving
against the 12px mono. The `ch` measure works in practice, not just in principle.

Four different paddings collapsed into one: `2px 8px`, `2px 0`, `2px`, and none at all — plus a
stray `min-height: 20px` on `WatchPanel` that no other row had.

**`SectionHeader` landed here**, as slice 6.2 flagged it should. It is deliberately *not* a
`PanelHeader`: a section heading sits inside content — a disk track, a sector, a memory bank — so it
reads as a heavier data row (recessed background, label colour, no border) rather than carrying the
chrome surface and bottom border that would drop a strip of chrome into the middle of a listing.

**The closings needed a real parser.** 23 `<div>` tags had to become `</DataRow>`, and a naive
replace is precisely the mistake that rewrote `ByteValue`'s closing tag in slice 6.0. I wrote a small
depth-matcher instead — walk forward from each opening tag, track `<div>` depth, replace the `</div>`
at depth 0 — which closed all 23 correctly on the first run. **For a structural edit at this scale,
the ten minutes spent on a matcher is cheaper than one silent mis-close.**

**A trap the guard clause created.** My "add the import" helper skipped any file that already
imported from `controls/data`, which after slice 6.1 meant three panels got `DataRow` used but never
imported. TypeScript caught it immediately. The fix was to *extend* the existing named imports rather
than test for the module path.

**Deliberately not migrated:**

- `ExplorerPanel.item` — a tree row with indentation and selection states, a different role.
- `DisassemblyPanel.item` — its height is pinned to `rowSizes.disassembly` for the virtualizer;
  it belongs with slice 7.4's virtualization contract.
- `StaticMemoryView`, `StaticMemoryDump`, `BasicPanel` — the `DocumentPanels` rows, which want the
  same treatment but were not in this slice's scope.
- `SjasmplusIntegrationDialog.row` — a dialog, outside Phase 6 entirely.

#### Slice 6.4 retrospective — hex values *(2026-09-07)*

490 jsdom tests, 54 theming tests, build green, `tsc` unchanged at 174.

**The convention is settled: uppercase, `$`-prefixed.** Uppercase was not a coin flip — the shared
`toHexa2`/`toHexa4` helpers have always produced it, so `WatchPanel:226`'s lowercase array preview
was simply a fork, forty lines below a `formatNum` in the *same file* that produced uppercase. Both
now route through one function.

**`formatHex` is exported as a function, not only as a component.** That is what made the
unification possible: several call sites need the string outside JSX — tooltip text, array previews —
and a component-only API is exactly why six separate implementations existed.

**`HexByteGrid` closes the gap slice 6.0 found.** `SysVarsPanel` had migrated everything except its
array dump, which kept `.byteValue`, `.dumpRows` and `.dumpSection` alive purely because the
primitive set had nothing for a byte grid. Its stylesheet is now **40 lines → 18**, and the panel's
three local components (`FullDumpSection`, `DumpSection`, `ByteValue`) are gone.

`BlinkPanel`'s local `ValueFieldRow` — a fourth private "labelled hex value" — is gone too, and its
`LAB_WIDTH` moved from `48px` to `7ch`.

**An open question I flagged rather than deciding silently — since answered, and my framing of it
was wrong.** I described the UI's `$` and the sample source's `#7C00` as the debugger and the
assembler *disagreeing*. They do not: Klive's Z80 dialect accepts **both** prefixes. Reading
`compiler-common/common-token-stream.ts` confirms it — `#` is lexed at line 301 (guarded by
`supportsHashedHexadecimal`, on by default) and `$` at line 310, so `.org #7C00` and `.org $7C00`
are the same program. `$` stays, now as a display choice rather than a resolved conflict.

The lesson is about evidence, not hex: I inferred a language rule from **sample code** — one project
file that happened to use `#` — and reported it as an inconsistency in the product. Two minutes in
the lexer would have shown there was nothing to reconcile. Reading the grammar is cheap; inferring
it from a sample is how a non-problem gets escalated.

#### Slice 6.5 retrospective — the `ch` measure scale *(2026-09-07)*

19686 tests pass (490 jsdom), build green, `tsc` unchanged at 174. Zero clipped cells measured in the
live app across every migrated and converted panel.

**I measured the font instead of trusting the plan, and the plan was right while my arithmetic was
wrong.** Iosevka is exactly **0.5em** at every size tested, confirmed twice — a standalone probe
against the bundled `iosevka-400.woff2`, and `document.fonts.check` plus a 100-glyph span inside the
running app. So 1ch = 6px at the 12px data font. Slices 6.0-6.2 had converted against roughly *Menlo's*
7.2px/ch (48px→7ch, 64px→9ch), producing columns ~15% narrower than the px they replaced. I went into
this slice expecting to file that as a regression; measuring all 187 migrated cells in the live app
showed **zero clipping**, so it is tighter-than-before rather than broken, and it stays. The lesson is
narrower than "measure things": *the arithmetic looking wrong is not evidence that the rendering is*.

**The real blocker was discovered by measurement, not by reading.** `ch` on a `DataLabel` only means
6px if an ancestor is `.dataPanel`. Legacy `Label`/`Value` cells set no font-family, and several were
measured rendering in **Inter** — a proportional font, where a `ch` column does not align at all.
That is why this slice converts the *measure scale* and pins the panel roots, and leaves the
`DataLabel`/`DataValue` component migration to 6.6, where `valuedisplay` is deleted anyway. Splitting
it that way was forced by the evidence; the original slice description had them as one job.

**One mixin did most of the work.** `side-panel-content` carried `font-size: 0.8em` (12.8px off the
16px root) and feeds four sidebar data panels. Pinning it to `--font-size-200` put every data panel on
the same 12px Iosevka as `.dataPanel`, so a `ch` width now means the same thing whichever stack drew
the row. Measured after: `valuedisplay .label` 44px → 42px (7ch), `.value` 48px → 48px (8ch) — the
value column did not move at all.

**A misalignment that has always been there, now documented rather than half-fixed.**
`Values.module.scss` declared a 44px label while `UlaPanel` and `FlagFieldRow` passed 48px to sit
beside it and `VicPanel` passed 41px, and `layout/Label` additionally carries `0.4em` side margins
that the `valuedisplay` label has not. Equalising the widths alone would *not* have aligned them, so
I deliberately preserved each component's own capacity rather than snapping them to one token and
claiming a fix. 6.6 settles it, when both stacks land on `DataRow` and its real `gap`.

**A live defect for 6.6, found by screenshot after all automated gates passed.** `SimpleValue`'s
`fullWidth` sets an inline `width: auto`, and with no gap on the row the value butts straight into the
next label: the ULA panel renders **`CON 0LCO 0`**. Confirmed in the DOM as pre-existing
(`inlineWidth: "auto"`, 6px wide, no trailing space) and untouched by this slice. `DataRow`'s
`gap: var(--measure-gap)` removes the whole class of bug.

**Still unverified:** `WatchPanel`'s `LABEL_WIDTH` (19ch) and `MemMappingPanel`'s `VAR_WIDTH` (17ch)
were converted but could not be seen — the watch list was empty and memory mapping needs a machine
that was not loaded. `NextRegPanel`, `VicPanel` and `BlinkPanel` are ZX Next / C64 / Z88 only and were
likewise not renderable in this session's machine. Their conversions are arithmetic-only.

#### Slice 6.6 retrospective — `DataPanel` root, and deleting the third stack *(2026-09-07)*

19686 tests pass (490 jsdom), build green, `tsc` **166** — eight below the 174 baseline.
`controls/valuedisplay/` is gone (4 files), `controls/layout/FlagRow.tsx` with it; net −292 lines.

**There were three `.label`/`.value` implementations, not two.** The plan said two. `controls/data`,
`controls/layout` and `controls/valuedisplay` each had their own, and the deciding fact was import
counts: `controls/layout/Label` has **21 importers** against `valuedisplay`'s 6. So the layout
wrappers now delegate their cell to `controls/data` and keep only what is theirs — the
`TooltipFactory` behaviour — and the register components moved to `controls/data/registers.tsx`.
Making the three data cells `forwardRef` is what made that possible without either adding a wrapper
element or pushing a tooltip hook onto all 187 cells.

**Three bugs, all found after the automated gates were green, none by them.**

1. **`DataRow` had no `flex-shrink: 0`.** The stack it replaced set `flex-grow: 0; flex-shrink: 0`;
   `DataRow` did not. Inside a column that overflows — the ULA panel is taller than the sidebar
   gives it — the flex algorithm compressed every row. Measured at **8px against a 15px line**, with
   the text still painting outside its own row box, which is exactly why no clipping check saw it.
2. **`DataPanel` clipped the panels that do not scroll themselves.** `.dataPanel` fills its parent
   and hides overflow, which suits the panels the registry marks `useScrollViewer: false`. For the
   rest the *host* supplies the viewer, and a panel pinned to `height: 100%` never lets that viewer
   see any overflow: the Z80 panel measured a **325px content box inside a 247px client box** with
   `overflow-y: hidden`, so IM, IF1, INT, CLK and TSP were on screen nowhere and unreachable by
   scrolling. The stack this replaced sized to content. Hence `DataPanel autoHeight`, set on the
   five panels whose registry entries leave `useScrollViewer` at its default.
3. **The `fullWidth` defect handed over from 6.5 is fixed**, as predicted, by `DataRow`'s `gap`:
   `CON 0LCO 0` now reads `CON 0 LCO 0`.

The first two are the same mistake in two forms: **I replaced a container without checking which of
its declarations were load-bearing.** `flex: 0 0 auto` and `height: auto` both looked like noise in
the old stylesheets and both were the only thing standing between the panel and a layout collapse.
Deleting a stack means reading what it did, not just what it looked like.

**A gap in the 6.5 survey, caught by a test.** `LayoutPrimitives` failed with `width: 320px` against
an expected `40px`: delegating `layout/Label` to `DataLabel` silently reinterpreted its numeric
`width` from px to `ch`. Seven call sites pass bare numbers — `DisassemblyRow`'s `width={160}`
instruction column would have become 960px. My 6.5 survey grepped `const …WIDTH` and never saw
inline literals. Numbers therefore stay **px** in the `controls/layout` wrappers, via one shared
`cssWidth` helper, and the tabular call sites move to explicit `ch` strings before that branch dies.
One jsdom test was worth more here than every measurement I took by hand.

**Two things deferred, honestly.** `MemMappingPanel`, `PsgPanel` and `PalettePanel` still use the old
`side-panel-content` mixin rather than `DataPanel`; and `layout/Label`'s `legacySpacing` modifier
still exists for cells that are not yet inside a `DataRow`. Both are bounded and belong with the
remaining panel migrations.

#### Slice 7.2 retrospective — `PanelToolbar` and the tab overflow *(2026-09-07)*

19697 tests pass (5 new), build green, `tsc` unchanged at 166.

**The plan was wrong about the separators, and I checked before consolidating them.** It called
`LabelSeparator width={8}` and `<ToolbarSeparator small>` "two competing separator components doing
the same visual job". They are not: `ToolbarSeparator` renders a visible 1px rule, `LabelSeparator`
renders an empty box that only reserves width. A divider and a spacer, with names similar enough to
read as duplicates. Merging them would have deleted every group divider in the app. The plan entry
is struck through and corrected rather than quietly dropped.

The spacers still went — but for the right reason. Inside a `PanelHeader` the row already has a
`gap`, so a spacer element is redundant; 7 of them are gone from four toolbars, including a
`<LabelSeparator width={0} />` in `DisassemblyToolbars` that reserved nothing at all. Spacers inside
*data rows*, where they align columns, were deliberately left alone — the edit walks each
`<PanelHeader>…</PanelHeader>` block and only strips within it.

**Phase 6 had left the job half-done and the plan did not say so.** `DocumentPanels/helpers/PanelHeader`
— the twelve-line `HStack` with hardcoded 4px/2px padding that §6.2 was supposed to replace — was
still there, still imported by five files. So the app had *two* `PanelHeader`s for the whole of
Phase 6. It is now deleted and its importers point at `controls/data`.

**Fix 4 is in, and it needed a menu that could be used from a keyboard.** The tab-list dropdown is a
`ContextMenu`, per the decision to reuse an existing pattern — but that menu's rows were `<div>`s
with an `onClick` and no keyboard path whatsoever, so a menu opened from a keyboard-reachable control
could be dismissed and never used. Rows are now `role="menuitem"` `<button>`s with arrow-key/Home/End
navigation and focus moved into the menu on open. That fixes the explorer and tab context menus too,
which is the second time in this project that reusing a control has been worth more than the feature
that prompted it.

**Two details the DOM caught that the arithmetic would not have.** The rows first derived their icon
from the file type, which produced *no icon at all* for the virtual documents (`Machine Memory`,
`Disassembly`) because those have no node; they now read `iconName`/`iconFill` off the document, as
`DocumentTabs` does. And the label now comes from the exported `getDocumentTabName`, so a row shows
the disambiguated path exactly when its tab does, instead of deriving the name a second way.

**Verified by constraining the strip, not by opening documents.** The project's three tabs do not
overflow an 823px header. Electron does not expose CDP's `Emulator` domain, so instead of opening
extra documents — which would have altered the workspace — the header was given a temporary
`max-width`, which drives the same `ResizeObserver` path. Measured: left chevron correctly disabled
at scroll 0, right enabled, all rows carrying icons, names and `aria-current` on the active
document.

**A layout observation for a later slice.** At a 420px header the tab strip was left **145px** while
the document command bar kept ~195px: the command bar does not yield to the tabs. That is why all
three rows showed as hidden — correctly, given the viewport. Worth revisiting when the header is
next touched.

**A design detail worth a second opinion:** hidden rows are marked with a trailing `···`, which sits
a little close in meaning to the `···` button that opens the list. Dimming the row instead would read
more clearly. Left as chosen rather than changed unilaterally.

**Deferred:** `TapViewerPanel`, `DskViewerPanel`, `PaletteEditor` and `MemoryToolbar` still inline
their own toolbars rather than using `PanelHeader` — they have bespoke header markup rather than a
simple control strip, and folding them in is a bigger change than the rest of this slice combined.

#### Slice 7.3a retrospective — one `GenericFilePanel` *(2026-09-07)*

19701 tests pass (4 new), build green, `tsc` unchanged at 166. Three helper files became two;
`GenericFileViewerPanel` and `GenericFileEditorPanel` are gone, and with `helpers/PanelHeader`
deleted in 7.2 the `helpers/` folder is down by 430 lines against 263 added.

**The merge itself was the easy half.** The editor was the viewer plus two context members, so giving
every panel `viewState` and `saveToFile` collapses them; a viewer simply never calls `saveToFile`.

**The half that mattered was a bug none of the three files' authors could have seen from the code.**
All three passed their renderers to `createElement`, which makes React treat a renderer as a
component **type**. Every consumer defines its renderer inline at the call site, so that type had a
new identity on each parent render and React unmounted and remounted the entire file view every
time. `StaticMemoryDump`'s renderer holds a `useRef` for the virtualizer and an async scroll restore
in `useInitializeAsync`: all of it was being thrown away and re-run on every render of its parent.

Renderers are now plain render functions that get *called*, so identity stops mattering. The cost is
that a renderer may no longer call hooks, which was true of exactly one — `StaticMemoryDump`'s — now
a module-scope `MemoryDumpBody` component.

**I nearly shipped a test that proved nothing.** The first version of the remount test drove the
parent with a raw `element.click()`, which never flushed the React update, so it passed against the
broken implementation too. Switching to `fireEvent.click` and asserting the parent's own counter
actually changed made it real: against `createElement` the body mounts **3 times**, against the fix
**once**. Verified by temporarily restoring the old line rather than by reasoning about it — a test
written after the fix is worth nothing until it has been seen to fail.

**Also fixed while in there:** the loader effect depended on `document` alone, so new bytes under the
same document showed the old parse; the context was kept in `useState` and written from an effect,
costing two renders per view-state change and leaving the context one render stale; and the editor
called `useAppServices()` twice.

**The second half of the slice is now 7.3b, and the plan's premise for it was half wrong.** Two of
the five hand-rolled viewers do not fit the abstraction at all — `Unknown` loads no file and `Bin`
neither parses nor persists view state. The other three do, and checking them turned up the same
class of defect as above: `DskViewerPanel` has **no `useMemo` anywhere** and calls `readDiskData`
plus `createDiskSurface` in its render body, and `TapViewerPanel` calls `readTapeFile` there too, so
both re-parse the whole file on every render. That is a good reason to migrate them and also why it
is not a rename: they carry a different view-state pattern and are 978 lines between them.

#### Slice 7.4 retrospective — the virtualization contract *(2026-09-07)*

19704 tests pass (3 new), build green, `tsc` unchanged at 166. 56 lines of stylesheet removed
against 13 added.

**M3 was written in Phase 1 and never finished.** `rowSizes.ts` names `MEMORY_ROW_ITEM_SIZE = 20`
and `DISASSEMBLY_ROW_ITEM_SIZE = 18` in its own header as the constants it exists to replace — and
both were still sitting in their components, unchanged, six phases later. The module emitted
`--row-size-*` for the stylesheets while the virtualizer went on reading private literals, so the
two halves of a number that *must* agree were in different files with nothing tying them together,
which is precisely the failure the module was written to prevent. `DisassemblyPanel.module.scss`
carried the third copy as a hardcoded `height: 18px`.

All three now read the module, and a **ratchet test** stops it happening again: it scans every
`.ts`/`.tsx`/`.scss` under `src/renderer` for a component-private `*ROW*SIZE|HEIGHT` literal and
fails naming the file and line. Verified by restoring the old constant and watching it fail — a
guard that has never been seen to fail is not a guard.

**The plan's `DataGridRow` was the wrong shape, and the code said so.** The duplicated block is real
— four rules byte-identical in two stylesheets, plus the JSX that used them — but it is the row's
**address gutter**, not the row. After the address, one row continues with opcodes, T-states and an
instruction and the other with hex and character values; they share nothing else. So the extraction
is two leading cells, `PartitionPrefix` and `AddressLabel`, not a single row component. Building the
row the plan described would have meant a component with two disjoint halves selected by a flag.

**The overscan divergence had no rationale to preserve.** Four of fifteen call sites passed
`overscan={25}` and eleven passed nothing, so two lists in the same panel buffered differently for
no stated reason. The explicit value became the default and the four repetitions went; any list with
a real reason to differ can still say so.

**Seven px widths from the 7.2 leftovers are now `ch`.** Measured at the disassembly row's own
12.8px Iosevka (1ch = 6.4px) and converted preserving capacity: 40→7ch, 48→8ch, 64→10ch, 72→12ch,
100→16ch, 140→22ch, 160→25ch, and `.tstates`. Verified live: rows still 18px, address column
40px→44.8px, **zero clipped cells**. Worth noting the address column is the roomiest of them — 7ch
holding a 4-character address — so sizing these to content rather than to their old pixel counts
would reclaim about 2ch per row. Left as a capacity-preserving conversion, consistent with 6.5.

#### Slice 7.5 retrospective — the `ToolArea` shell *(2026-09-07)*

19708 tests pass (4 new, the tool tabs' first), build green, `tsc` unchanged at 166.

**Two of the three things the plan asked for were already done or wrong, and the third was not in the
plan at all.**

*The focus ring was not missing.* The plan still described the command prompt as `outline: none` with
no replacement. `git log` shows `@include focus-ring` was added to `.prompt` in my own **Phase 3**
commit and the plan entry was never updated. Verified rather than assumed, and the verification took
two attempts: focusing the input from script reported `outline-style: none`, because Chrome only
matches `:focus-visible` once the user has actually used the keyboard. Dispatching a real key event
through CDP first gives `matches(':focus-visible') === true` and a computed
`solid 2px rgba(167, 138, 245, 0.7)` — the accent, at rest. A programmatic focus is not a user
focus, and measuring one while claiming the other is how a working feature gets "fixed" twice.

*`PanelHeader` is the wrong shape for `ToolsHeader`.* The plan said the tool area should adopt it.
`ToolsHeader` is a tab strip that happens to carry an action group; `PanelHeader` is a titled chrome
bar. Forcing one into the other is the same mistake as `Col`→`DataRow` in 6.6 and `DataGridRow` in
7.4 — the third time this phase that a planned consolidation turned out to be two things that merely
look alike. `ConsoleOutput`, the other half of that entry, was genuinely adopted — in 7.1.

*The real defect was `ToolTab`.* The tool area's tabs — Commands and Output, its primary navigation —
were unfocusable `<div>`s with an `onClick`: no `tabIndex`, no `role`, no `aria-selected`, no focus
ring. That is precisely what Phase 2 fixed on the toolbar, the document tabs and the activity bar,
and it survived because this tab is a plain text label rather than one of the shared button
controls, so nothing in that sweep touched it. It is now a `<button role="tab">` inside a
`role="tablist"` strip, mirroring `ActivityButton` exactly, and it has four tests.

**Also cleaned up while in there:** `CommandPanel.module.scss` carried a dead `.outputLine` rule
copied from `ConsoleOutput` and rendered by nothing, and an `.outputWrapper` that set a font family
and size the console has overridden since 7.1. Three `em` sizes and three px literals became tokens.

### Phase 7 complete

7.1-7.5 done. The recurring lesson across the phase is worth stating once: **three of the five slices
found that a planned consolidation was between two things that merely resembled each other** — the
two separators (a divider and a spacer), `DataGridRow` (a shared gutter, not a shared row), and
`PanelHeader` for `ToolsHeader` (a tab strip, not a header). In each case the code said so plainly
and the plan, written from a distance, did not. Checking the shape before merging cost minutes;
merging first would have deleted every group divider in the app in the first case alone.

#### Phase 8 retrospective — the Monaco syntax palette *(2026-09-07)*

19714 tests pass (6 new), build green, `tsc` unchanged at 166. **146 colour literals removed** from
the seven language providers; the count was 146, not the 158 the plan estimated — the difference is
the editor stylesheet's own colours, which this phase also cleaned up.

**The mechanism the plan assumed could not have worked.** §8.1 asks for a palette that follows the
accent, but `ensureLanguage` defined each theme exactly once, guarded by a
register-once-and-return-early check. That was survivable while the colours were literals and only
the *tone* could change, because both themes were defined up front and switching tone just switched
which name was applied. It cannot work when the accent changes a theme's **contents while its name
stays the same**. Theme definition therefore moved out to `defineLanguageThemes`, which is callable
repeatedly — `defineTheme` is idempotent by name — with an explicit `setTheme` afterwards, because
React will not re-apply an unchanged `theme` prop.

**A bug I introduced and caught before shipping.** With definition moved into the theme effect, the
editor opened on Monaco's bare `vs-dark`: the effect runs on mount while `monacoRef` is still empty,
because it is set in `onMount`, which fires later. The themes are now defined in `onMount` too. The
existing `MonacoEditorRefactor` test caught the move (it asserted `defineTheme` was called during
registration) and is updated to assert the new contract deliberately, not silenced.

**Contrast is proved, not eyeballed.** Six accents times two tones is twelve palettes, and every
colour is pushed away from the editor background until it clears 4.5:1 (3.5:1 for comments, which
are recessive by design). A test asserts the floor across all twelve, that the error colour **never**
varies with the accent, and that the keyword colour always does. This is the §5 lesson applied
again: the first accent set passed a hue-angle rule while being perceptually identical to the data
colours, so a property that matters gets asserted rather than inspected.

**The first pass gave keywords and functions the same colour** and leaned on the keyword's bold
weight to separate them — a mnemonic and a call sit on the same line constantly, and weight alone is
not enough. Functions got their own ramp step and the adjacency test grew two more pairs.

**I misread my own screenshot, and the DOM corrected me.** Hex literals looked unstyled — the same
near-grey as operands. Querying the computed colour showed `#7C00` at `#9e89d7`: the *number*
colour, a desaturated accent that reads as grey at 12px next to saturated violet keywords. That is
§8.1's stated intent ("related to keywords but recessive"), not a gap. Worth stating plainly though:
**a single-accent scheme is inherently more monochrome than VS Code's multi-hue default** — labels,
types and numbers are all steps of one hue by construction. That is the design, and it is what makes
the editor look like part of the app; it is not an accident to be fixed later.

**Verified end to end through the app's own menu.** Switching View -> Accent -> Phosphor Green
repainted the editor live: keyword `rgb(188,166,247)` -> `rgb(135,207,90)`, label
`rgb(153,119,243)` -> `rgb(108,190,55)`, number likewise, and the operand colour **unchanged** at
`rgb(228,230,234)`, as a neutral should be. That also proves the one thing a unit test could not:
that `defineTheme` followed by `setTheme` with the *same theme name* actually repaints. The accent
was restored to Ultraviolet afterwards.

**Editor chrome now shares the app's ground.** `editor.background` was never set, so the editor sat
on Monaco's `#1e1e1e` inside a `#141517` window — the plan's own description of the editor as "the
largest surface in the IDE and the one most obviously not part of the same design" was literally
true at the pixel level. Line numbers, gutter, widget and input colours come from the neutral ramp
too.

**Stylesheet cleanup.** `.warningIcon` was declared **three** times, not the two the plan recorded:
once sharing a block with `.errorIcon`, once as `background-color: orangered !important`, and once
as `color: orange` — which never applied, because the shared block's `color: … !important`
outranked it. So a named CSS colour was doing a status token's job and a third of the declaration
was dead. The error and warning squiggles were data-URI SVGs with `%23ff0000` / `%23ff9900` baked
in; they are now masks painted with `--status-error` / `--status-warning`, so they follow the theme
while staying off the accent. `!important` is down from 11 to 12 declarations but now only on the
properties Monaco actually sets inline — the rest were cargo.

**Custom token overrides still work.** `customTokenLoader` writes into each provider's theme block;
those blocks are now empty override slots merged *after* the generated rules, so a user's
`<languageId>.tokens.json` still wins. Deleting them outright would have removed a working feature
along with the literals.

The two `Langauge` filename typos are fixed.

#### Phase 9 retrospective — emulator area and keyboard *(2026-09-07)*

19714 tests pass, build green, `tsc` unchanged at 166. Fixes 5 and 6 are done; the keyboard is a
device surface with its duplication removed. Window chrome stays deferred, as the plan says.

**Fix 5 — the screen is a device now.** A bezel, `--radius-md` and `--shadow-2` around the canvas,
and `image-rendering: pixelated`, which had never been set at all: the canvas is scaled by an
integer ratio, so the browser's default bilinear filter was softening every frame for no reason.

**The `- 8` was worse than a magic number — it was a margin that existed only in JavaScript.**
`useEmulatorScreen` subtracted 8 from the host's `offsetWidth` and `offsetHeight` inside its ratio
arithmetic, so the gutter around the screen was invisible to every stylesheet and could only be
changed by editing a sizing calculation. It is real padding on `.emulatorPanel` now, and the hook
reads what the CSS actually left. That change broke a test, and the test was right to break: it
handed the hook a plain object as its host, which cannot answer `getComputedStyle`. The hook is
guarded and the test now passes a real element — which is what the component passes anyway.

**The two overlays were positioning themselves against each other.** The execution pill sat at
`top: 8px` and the recording pill at `top: 40px`, the latter carrying a comment deriving 40 from
"~8px top + ~28px content height" — arithmetic that is correct only while the pill above keeps
exactly that height. They are a flex column with a gap. Both also hardcoded `#303030` and
`lightgreen` while `--bgcolor-emuoverlay` / `--color-emuoverlay` sat dead in the token layer, which
is exactly why the light theme kept a dark pill.

**Fix 6 — the splitter had a one-way animation.** It was `opacity: 0` at rest, so the only way to
discover that two panels could be resized was to sweep the mouse along the seam. Worse, the
transition was declared *inside* `.pointed`, so it applied only while that class was present: the
splitter faded in over 200ms and snapped out instantly. It now shows a `--border-subtle` hairline at
rest and takes the accent while pointed, with the transition on the base rule so it moves both ways.

**And I introduced a bug fixing it, which the DOM caught.** The orientation classes were applied
only when `showBorder` was set — harmless while the splitter was invisible, since there was nothing
to orient. With a permanent hairline, a splitter without that flag had no orientation, and my
stylesheet fallback guessed *vertical*: the horizontal splitter between screen and keyboard rendered
a 1px x 4px vertical stub. Measured, not seen — at 4px it is invisible in a screenshot. Orientation
is now applied unconditionally.

**The keyboard's duplication was four-fold, not three.** The plan said `calculateZoom` / `rootStyle`
/ `rowStyle` were duplicated across "the three keyboards"; there are four (`Sp48`, `Sp128`, `Next`,
`Z88`), each with a byte-identical copy, and the two inset constants (24 horizontal, 12 vertical)
were repeated four times with nothing keeping them in step.

**Nine Spectrum INK colours became device tokens.** `Sp48Keyboard` carried the machine's own eight
colours plus a grey as inline hex — the keyboard's version of the overlays' `#303030`. They are
`--device-ink-*`, theme-invariant like every other device value (§8.2.1), because the legends are
printed on the case. Per M4 the key SVGs stay imperative, so the caller passes *token names* and
`Sp48Key` resolves them through `themeService`, exactly as it already did for its other seven
colours — rather than introducing a second convention with `fill="var(...)"`.

### Phases 0-9 complete

Every phase in the plan is done except the explicitly deferred window chrome. Both questions that
were standing for the user are now answered: the rainbow **stripe order** is confirmed correct, and
the `$` / `#` **hex prefix** was never a conflict — the Z80 dialect accepts both, so `$` in the UI
is simply a display choice. Both retrospectives above are corrected in place.

#### The ratchet

Old and new stacks coexist during Phase 6, which is exactly when a migration stalls at 80%. Guard it
with a cheap test that only moves one way:

```ts
// test/theming/migration-ratchet.test.ts
const LIMITS = { "controls/valuedisplay": 5, "controls/layout/Label": 12, /* … */ };
// each slice lowers a number; the test fails if any count goes UP
```

It costs ten minutes to write and makes backsliding impossible. The last slice sets the limits to
`0` and deletes the old directories along with the test entries.

#### Slice 7.1 retrospective — `ConsoleOutput` *(2026-09-07)*

19692 tests pass (6 new, the component's first), build green, `tsc` unchanged at 166.

**The API rename was not cosmetic — the old name had already caused a shipped bug.** `scrollLocked`
was *true* when auto-scrolling was **off**, so every call site had to negate it mentally, and
`ScriptOutputPanel` duly negated it wrongly: its button read "Turn auto scrolling off" at the moment
clicking it would turn auto scrolling **on**. The prop is now `followTail`, which cannot be read
backwards, and the tooltip is fixed. The `scrollLocked` *state* and its persisted `locked` key are
left alone — renaming them needs a view-state migration for no user-visible gain.

**Two bugs the new tests found, both pre-existing, neither visible in a screenshot.**

1. **`followTail` never scrolled on mount.** The list is only rendered once there is something to
   show, so on mount the refresh effect runs while the virtualizer handle is still null and its
   scroll silently no-ops. Following only began when the *next* line arrived — a panel reopened on a
   buffer that already had content showed the top of it. The first scroll now happens in
   `apiLoaded`, where the handle actually exists, with a restored scroll position taking precedence.
2. **`SCROLL_END = 5_000_000`** was a sentinel that relied on the virtualizer clamping an
   out-of-range index. It is now `contents.length - 1`. The test asserts both the right index and
   the absence of the sentinel, because this is the kind of thing that reappears.

**A third, from the same family as a Phase 3 finding.** `backgroundColor` was built as
`var(${... : "transparent"})`, interpolating the literal word `transparent` into `var()`. That is not
a custom-property reference, so the declaration was invalid and dropped every time a span had no
background — which is every span. It looked correct only because "no background" was the intent.
Same silent-drop as the empty `background-color: var()` in `.headerRow`.

**The actionable span is now a `<button>`.** It was a bare `<span>` with an `onClick` that runs an
IDE `nav` command: reachable with a mouse and by nothing else, in the component the plan singled out
as the one already handling `user-select` correctly. Same treatment the toolbar and tab controls got
in Phase 2, including the shared `focus-ring` mixin.

**Effect churn removed.** The buffer subscription used a dependency-less `useEffect` guarded by a
`mounted` ref, so it unsubscribed and resubscribed on every render; a `latest` ref now holds the
callbacks that change identity each render, and the effect depends only on the buffer. The dead
`scrollVersion` state — set on every buffer change, read nowhere — is gone.

**Measured, not assumed:** the console was rendering at 12.8px, so `.lineNo`'s `min-width: 48px` was
7.5ch. Pinning the wrapper to `--font-size-200` (M1) makes it 12px, where 8ch is exactly the 48px it
replaced.

**Not verified live:** the actionable button and the line-number gutter. Both need output this
session could not produce without manufacturing a compile error in the user's own project — the
`help` output has neither file links nor line numbers. The unit tests cover both paths.

### Phase 7 — Composite & structural components

Phase 6 unifies the *presentational* layer — rows, labels, values, headers. That leaves a second tier
of **composite components**: things that own behaviour (scrolling, buffering, file loading, command
input), not just markup. They are the reason `DocumentPanels/`, `SiteBarPanels/` and `ToolArea/` still
diverge after Phase 6, and they are what makes those folders *fundamentally* three implementations of
the same ideas rather than one.

These slices depend on Phase 6's primitives, so they run after it — but each is independent of the
others and can be reordered freely.

| # | Slice | Scope today | Why it matters |
|---|---|---|---|
| **7.1** | **`ConsoleOutput`** | 157 lines + 22 SCSS, **4 consumers** across two folders (`CommandPanel`, `OutputPanel`, `ScriptOutputPanel`, `CommandResult`) | The app's shared rich-text/ANSI renderer, and the only component already doing `user-select: text` correctly. Needs a real API, `.lineNo`'s `min-width: 48px` converted to the `ch` measure scale (M2), the `SCROLL_END = 5_000_000` sentinel replaced, and a keyboard path for the clickable `<span>` at `ConsoleOutput.tsx:130` that runs an IDE navigate command. |
| **7.2** | **`PanelToolbar`** | 11 files carrying in-panel toolbars; only `DisassemblyToolbars.tsx` is extracted — `BasicPanel`, `ScriptOutputPanel`, `CommandResult`, `TapViewerPanel`, `DskViewerPanel` (19 controls), `BinFileViewerPanel`, `ImageViewerPanel` and `PaletteEditor` all inline theirs | ~~Also settles the **two competing separator components** doing the same visual job.~~ **Corrected in the 7.2 retrospective: they do different jobs.** `ToolbarSeparator` draws a visible 1px rule; `LabelSeparator` draws nothing at all and only reserves width. They are a divider and a spacer with confusingly similar names, and several files use both.  **Carries fix 4 from §4** — the tab overflow chevrons and tab-list dropdown, deferred from Phase 4. Only the timing-hack half of that fix landed there; the affordance itself belongs here because it is a panel-header action area, and because building its popup before this slice would add a *fourth* menu pattern alongside `ContextMenu`, `Dropdown` and `ToolbarSplitButton`'s portalled menu. The `ResizeObserver` added in Phase 4 already measures the strip, so the overflow signal is a few lines away. Three design questions need answering first, against a project that actually overflows: all tabs or only hidden ones; icons and dirty markers in the list or not; menu-style keys or a filterable list. |
| **7.3a** | **`GenericPanel` family** *(done)* | 347 lines across 3 files, **7 consumers**. `GenericFileEditorPanel` is `GenericFileViewerPanel` plus `saveToFile` — their render bodies are line-for-line identical, as are the `fileLoader` effect and the view-state persistence effect | Collapsed to one `GenericFilePanel`. Also fixed the renderer-identity bug described in the retrospective. |
| **7.3b** | **The hand-rolled viewers** | `Dsk` (363), `Tap` (382), `Image` (233), `Bin` (140), `Unknown` (15) | Split out of 7.3 because the premise was only half right. **Two do not fit at all:** `Unknown` loads no file (it renders a single "no viewer" sentence) and `Bin` neither parses nor persists view state — for them `GenericFilePanel` is pure indirection. **Three do fit, and have a real bug the abstraction fixes:** `DskViewerPanel` (which contains no `useMemo` at all) calls `readDiskData` **and** `createDiskSurface` directly in its render body, and `TapViewerPanel` calls `readTapeFile` the same way, so both re-parse the entire file on every render. They also use a different view-state pattern (`getDocumentViewState` + `signHubStateChanged`) than `GenericFilePanel`, so each needs its own migration rather than a rename. |
| **7.4** | **Virtualization contract** | **15 `VirtualizedList` consumers**, configured differently: `itemSize` passed by 2 and omitted by 3, `overscan: 25` in some and absent in others | Binds row heights to M3's JS-readable `rowSizes` module, which is what stops the type scale and the virtualizer drifting apart. Also folds in the **byte-identical column block** shared by `DisassemblyPanel.module.scss` and `features/memory/MemoryDumpSection.module.scss` (verified identical) and its copy-pasted TSX. **Corrected in the retrospective: this is not one `DataGridRow`.** Only the *address gutter* is shared — after the address the two rows have nothing in common, so the extraction is a pair of leading cells (`PartitionPrefix`, `AddressLabel`). |
| **7.5** | **`ToolArea/` shell** | 532 lines: `ToolsContainer`, `ToolsHeader`, `ToolTab`, `CommandPanel`, `OutputPanel` | Adopts `ConsoleOutput` (7.1). ~~Adopts `PanelHeader` (7.2)~~ and ~~restores a focus ring on the command prompt~~ — **both corrected in the retrospective**: the focus ring was already restored in Phase 3 and is verified working, and `ToolsHeader` is a tab strip rather than a panel header, so `PanelHeader` is the wrong shape for it. The real defect here was `ToolTab`. |

**Boundary with Phase 4.** Phase 4 restyles ToolArea's *chrome* — tab heights, header surface, the
1px active underline. Slice 7.5 changes its *structure*, replacing bespoke components with shared
ones. Doing the restyle first is deliberate: it means 7.5 is a pure structural swap with no visual
delta to review, which is the cheapest possible way to land a refactor of that size.

**The ratchet applies here too.** Add `DocumentPanels/helpers` and the inline-toolbar count to the
limits in `migration-ratchet.test.ts` so 7.1–7.3 cannot stall half-migrated.

### Phase 8 — Monaco syntax palette

Deliberately separate from Phases 6–7: it shares no code with them and depends only on Phase 1's
ramps. It can run **at any point after Phase 1** — including in parallel with the slices — or be
deferred without blocking anything.

Generate `syntaxPalette(tone, accent)` per §8.1 and feed it to all 7 language providers, replacing
158 hardcoded colours. Clean up `MonacoEditor.module.scss` (7 `!important` in one rule, a
doubly-declared `.warningIcon`, named colours `orangered`/`orange`). Fix the two `Langauge` filename
typos.

### Phase 9 — Emulator area, keyboard, and window chrome
- **Emulator area:** fixes 5 and 6; theme the two overlays with the existing dead
  `--bgcolor-emuoverlay` / `--color-emuoverlay` tokens; `image-rendering: pixelated` in CSS; replace
  the eyeballed `top: 40px` recording offset with a flex stack.
- **Keyboard:** stays **dark in both themes** as a device surface (§8.2.1) — what looks today like a
  light-mode bug is ratified as intent, and the 18 keyboard tokens leave the light/dark duplication.
  The work here is craft, not theming: key elevation, a `--duration-fast` press transition, and
  authentic legend colours declared once. De-duplicate `calculateZoom`
  / `rootStyle` / `rowStyle` across the three keyboards. Per M4 the key SVGs stay imperative but must
  read L2 semantic names.
- **Window chrome (optional, decide after Phase 5):** frameless window with the toolbar in the title
  bar. Reclaims ~30px per window; costs per-platform code. **Explicitly deferred.**

---

## 7. Verification

Per `AGENTS.md`, with its caveat that `npm run build:check` is currently a no-op:

```bash
npx tsc --noEmit -p build/tsconfig.web.json
npm run lint:renderer
npm test -- --project jsdom
npx electron-vite build --config build/electron.vite.config.ts
```

Plus, for this work specifically:

- `npm test -- --project node test/theming/token-contract.test.ts` — green from Phase 0 onward.
- **Visual check every phase in both themes and both windows.** The existing jsdom tests assert
  behaviour, not appearance; nothing in CI will catch a regression that is purely visual.
- Watch the `--space-base` unit change (Phase 1, `em` → `px`) — `Toolbar.tsx` is the only current
  consumer, so the blast radius is small, but it is a real behavioural change.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Global `border-box` shifts rendered heights app-wide | Phase 0, alone, reviewed on its own diff |
| L4 repointing changes 110 stylesheets at once | That is the *point* — but it means Phase 1 needs a careful two-theme screenshot pass, not a code skim |
| No visual regression coverage exists | Accepted for now; if it bites twice, add Playwright screenshot tests as a follow-up plan |
| Compact 26px status bar may feel cramped with the current 16px monospace readouts | Those readouts are 16px only because of the `.isMonospace` bug (§2.3); fixing it in Phase 0 makes 26px comfortable |
| Keyboard SVGs resolve colour imperatively via `getThemeProperty`, so they bypass CSS entirely | Phase 8 handles them last, deliberately, once the token vocabulary is settled — and §8.2.1 makes them theme-invariant, which shrinks the problem |
| Phases 6–7 are a real refactor of ~60 components, not a restyle — the largest regression surface in the plan | Sliced by concern into 7 independently shippable steps, ordered cheapest-and-safest first, with a ratchet test preventing a stall at 80%. It also comes *after* the app already looks new (Phases 1–5), so it can be paced or paused without leaving the UI half-finished |
| Moving sizing from React props into CSS (slice 6.5) changes how `Label`/`Value`/`Flag`/`Text` are called across the app | The single riskiest slice; sub-divided by folder, and it runs late enough that the API has already been proven by slices 6.1–6.4 |
| Derived light can go muddy in the mid-tones, and it is the theme nobody dogfoods | The four exceptions in §8.2 cover the known failure modes; beyond that, light needs one deliberate screenshot pass per phase even though it is not hand-authored |
| Deleting "dead" stylesheets could remove something reached dynamically | All three orphans were verified by grepping for the filename across every `.tsx`; the `Next/` collapse keeps one copy |

---

## 8.1 Monaco syntax palette — accent-coherent

> **SUPERSEDED by `.plans/SYNTAX_PALETTE_REVISION_PLAN.md`.** The scheme below — every class a step
> of the accent ramp — optimised for coherence with the accent and lost the thing syntax colouring is
> for: separating token classes by **hue**. It shipped with nine of eleven classes in one blue and
> comments in neutral grey. The section is kept for the record; do not implement from it.

**Decided:** the 158 hardcoded colours across the 7 language providers are regenerated from the L1
ramps and **follow the active accent**, rather than being preserved as-is.

Concretely, `syntaxPalette(tone, accent)` returns the token colours, built on a fixed scheme:

| Token class | Source | Rationale |
|---|---|---|
| Keywords / mnemonics (`ld`, `jr`, `call`) | **accent ramp**, step 9–10 | The most frequent coloured token becomes the app's signature |
| Registers / operands | `--text-primary` | The data, at maximum legibility |
| Numbers, addresses, `$`-literals | accent ramp, step 11 (desaturated) | Related to keywords but recessive |
| Strings | `--status-success` family | Conventional, and rarely adjacent to keywords |
| Comments | `--text-tertiary`, italic | Recessive by design |
| Labels / symbols | accent ramp, step 8 | |
| Directives / preprocessor | `--text-secondary` | |
| Errors / invalid | `--status-error` | Never accent — must stay unambiguous |

Two consequences worth stating plainly:

- **Switching accent restyles the editor**, not just the chrome. That is the point — today the editor
  is the largest surface in the IDE and the one most obviously not part of the same design.
- Error and warning squiggles stay on the status hues and are **excluded from the accent mapping**,
  including the two data-URI SVGs in `MonacoEditor.module.scss` that currently embed `%23ff0000` /
  `%23ff9900`.

The existing per-language *structure* (which Monarch token maps to which class) is preserved; only
the colour values are regenerated, so the seven providers keep their grammars untouched.

## 8.2 Light theme — derived, with four exceptions

**Decided: derive light by construction.** One ramp definition per hue; light is the inverted step
set. Light stops being a hand-maintained copy that drifts, which is what it is today — currently
200 of 201 tokens with `--console-default` simply missing, `--bgcolor-toolbarbutton-disabled`
inverted between the two files, and the emulator overlays hardcoding `#303030` so light keeps a dark
pill.

The practical consequence: **`light-theme.ts` largely ceases to exist.** 256 lines of hand-copied
literals become a derivation from the same ramps that produce dark, and the `token-contract` test's
"both themes define the same key set" assertion becomes true by construction rather than by
vigilance.

Derivation fails in four known places, which stay hand-tuned:

| Exception | Why derivation fails |
|---|---|
| **Shadows** | Shadows do not invert. A shadow tuned for dark reads as dirt on light; light needs shorter, tighter, lower-opacity shadows, not the same values with a flipped ramp. |
| **Disabled states** | On dark, disabled = recede toward the background. On light, the same relative step reads as "faint but active". Needs its own ratio. |
| **Syntax palette** | Monaco's contrast requirements differ enough per tone that a straight inversion produces muddy mid-tone keywords (§8.1). |
| **Device surfaces** | Not derived at all — see below. |

### 8.2.1 Device surfaces are theme-invariant

**The emulated machine is hardware, and hardware does not have a light mode.** The Spectrum's case
and keys are dark; a dark machine framed by light chrome reads correctly as a device sitting on a
desk, the way a video player stays black inside a light UI.

So the token layer gains a small third category alongside the gray and accent axes: **`--device-*`
tokens, identical in both themes.**

| Token | Covers |
|---|---|
| `--device-bezel` | The frame around the emulator screen |
| `--device-body` | The keyboard panel ground |
| `--device-key`, `--device-key-raise` | Key caps |
| `--device-legend-*` | Key legends — the authentic machine colours (main, symbol red, above green, below red) |

Two things fall out of this, both good:

- **The "black slab" stops being a bug.** The keyboard being `#181818` in light mode is currently an
  accident of nobody designing light; under this principle it becomes intentional, and Phase 8 gets
  cheaper rather than more expensive.
- **18 keyboard tokens leave the light/dark duplication entirely.** They were near-identical in both
  files anyway; now they are declared once and there is nothing to keep in sync.

The **emulator area** — the ground the device sits on — is *not* a device surface. It follows the
theme, but stays recessed relative to the panel in both (a mid-neutral rather than white in light),
so a dark machine does not sit on a glaring field.

## 9. Decisions and remaining questions

**Settled:**

1. **Accent** — six ship as a user setting (§5). Default **Sinclair Blue on dark**.
2. **Rainbow motif** — the Spectrum four-stripe flash appears on the **About panel and the six empty
   states only**. Not in the chrome: decorative colour must never sit permanently beside the
   functional accent and the status hues. (Stripe order to be verified against the real case artwork
   rather than from memory.)
3. **Status bar** — **26px** in both windows, down from 40px.
4. **Text selection** — `user-select: text` is restored for data content (hex dumps, disassembly,
   tape/disk blocks, BASIC listings). The bespoke "copy to clipboard" buttons stay, but stop being
   the only way to get data out.
5. **Monaco syntax** — regenerated from the ramps to be **coherent with the active accent**, not
   preserved. See §8.1.

6. **Light theme** — **derived by construction** from shared ramps, with four hand-tuned exceptions
   (shadows, disabled states, syntax palette, device surfaces). `light-theme.ts` largely disappears.
   See §8.2.
7. **Device surfaces** — the keyboard and screen bezel are **theme-invariant dark**: the emulated
   hardware is dark, so it stays dark. See §8.2.1.

8. **Scope of the data-panel work** — **the full migration**, sliced by concern rather than by panel:
   **twelve** independently shippable steps across Phases 6 and 7, ordered cheapest-and-safest first,
   with a ratchet test preventing a stall at 80%.
9. **`ToolArea/` is in scope** alongside `DocumentPanels/` and `SiteBarPanels/` — it shares
   `ConsoleOutput` with both and duplicates their header and toolbar patterns. See Phase 7.

**Phases 0–9 are closed.** Phase 10 below is a post-launch addition, not a re-opening of §5 or §9 —
it adds a second axis to the accent system and revisits two specific views' colour, on user
feedback gathered after Phases 0–9 shipped.

---

## 10. Phase 10 — Secondary accents & per-view colour *(2026-09-08)*

Everything below happened in one review pass after Phases 0–9 shipped: the user exercised the new
UI, filed concrete visual bugs and design requests view by view, and this phase is the record of
both. **`.ai/ui-theming-intent-and-lessons.md` carries the distilled version** — read that first for
anything reusable; this section is the detailed history, in the same spirit as the Phase 0–9
retrospectives above.

### 10.1 Bug fixes (not colour, found along the way)

None of these were part of the accent/colour request; they surfaced from actually using the app
after Phase 0–9 and are recorded here because each is the kind of thing that reappears.

| Area | Symptom | Cause | Fix |
|---|---|---|---|
| Project Explorer | Icon/label gap collapsed to ~0px | `LabelSeparator` used to *borrow* `.label`'s CSS margins as an implicit gap (`layout/Label.module.scss`'s `.label` carried `margin: 0 0.4em`); Phase-6-era cleanup correctly gave `LabelSeparator` its own `.spacer` class with no margins, which broke the one call site (`ExplorerProjectItem.tsx`) that was relying on the borrowed margin via `width={0}` | Pass an explicit `width={8}` instead of relying on inherited margin |
| Main toolbar | Buttons read as touching the strip edges, especially the `selected` border ring | `STRIP.toolbar` (38px) left only 1px of clearance around the 32px `IconButton` after Phase 5's 4px→2px padding fix — mathematically non-overflowing, but visually indistinguishable from touching | `STRIP.toolbar` → 42px. It is the *only* consumer of `--strip-toolbar`, so this is fully scoped |
| Activity bar | Active-tab indicator was a short floating pill, not the VS Code full-height bar | `top: 8px; bottom: 8px` plus rounded corners on the accent stripe — introduced deliberately in Phase 3 as "the standard idiom", but inset from a full-height bar rather than matching it | `top: 0; bottom: 0`, corner radius removed |
| Document tab strip | Horizontal scroll silently undid itself on a narrow strip: `scrollTabsBy` would move the strip, then it snapped straight back | Two independent bugs, same root shape. (1) `scheduleEnsureTabVisible` was built from two inline arrow functions passed to `useTabVisibility` on every render, so the `useCallback` inside it saw a fresh identity every render, and the effect that depends on it re-ran — and re-scrolled to the active tab — on every unrelated render, not just when the active document changed. (2) Independently, `useTabVisibility`'s `ResizeObserver`-setup effect had no dependency array, so it tore the observer down and rebuilt it every render too; `ResizeObserver.observe()` delivers an initial entry for every newly observed target even when nothing resized, so the rebuild alone re-triggered the same re-scroll in a **real browser** — invisible in jsdom, which has no `ResizeObserver`, so this half needed a test that supplies its own stub to see at all | (1) Memoize both callbacks passed into `useTabVisibility`. (2) Build the `ResizeObserver` once, in a mount-only effect; new tab elements register with the same long-lived observer via a returned `observeElement`, queued if they mount before the observer exists (a child's layout effect runs before the parent's own effect on first commit) |
| Theming (app-wide) | A toggled accent/theme recoloured CSS-driven text instantly but left `react-switch`/SVG-fill colours on the old accent for anywhere from one render to several seconds | `getThemeProperty` resolves an aliased token (`--color-switch-on: var(--accent-solid)`) via `getComputedStyle(root)`, called during **render** — but `root`'s `style` attribute (the inline custom properties `ThemeProvider` writes) only updates at **commit**, one step later. The render that first reacts to a new accent reads DOM state that still reflects the *previous* one. CSS-driven consumers never hit this: the browser re-evaluates every `var()` the instant the DOM's custom property changes, commit included | A `useLayoutEffect` bumps a `domCommitTick` state right after the commit that applied the new `styleProps`; `themeValue`'s memo depends on it, so every `getThemeProperty()` caller re-resolves once more, synchronously before paint — invisible to the user, instead of stuck until some unrelated future render |
| Memory dump | ASCII column showed the literal character "0" for every byte, regardless of value | The live panel passes `bytes` as `memory.subarray(...)` — a `Uint8Array` view, not a plain array, to avoid copying on every scroll. `CharDump` built its `<span>`s with `bytes.map(...)`: `Array.prototype.map` returns an array of whatever the callback returns, but **`Uint8Array.prototype.map` builds a new typed array**, coercing every callback return value (a JSX element, here) to a number for storage — a React element coerces to `NaN`, clamped to `0` | `Array.from(bytes).map(...)` — normalizes both array and typed-array inputs to a plain array first |
| Memory dump | Hovered byte's highlighted text sat ~2-3px right and a few px above the real glyphs underneath | A `border` is part of the box model: it pushes the *content box* (and the text inside it) inward from the box's own `left`, while the real, unbordered text underneath does not move — `outline` paints at the same visual position without taking part in layout at all, so it does not shift anything it sits on top of. Separately, the overlay bled 1-2px past the row's own edges (`top: -1px; bottom: -1px`) to look right at the seams, which made its own box a little taller than the text needs; without `display: flex; align-items: center` (matching the parent `.hexValues`'s own centring), a plain block box does not split that extra height evenly and the text sits near the top | Swap `border` for `outline` (same visual position, no layout participation); add `display: flex; align-items: center` to the overlay so it centres its own text the same way its parent does |
| Disassembly | Toggling "Follow PC" took a few seconds and (rarely) failed to scroll to PC on the first click | `onAutoRefreshChanged` called `refreshDisassembly()` directly from the click handler, right after `setAutoRefresh(value)`. `refreshDisassembly()` reads `cachedRefreshState.current.autoRefresh` — a ref that `useDisassemblyViewStatePersistence` only syncs in its *own* effect, one render after the click handler runs. So the very refresh the click triggered still read the **old** `autoRefresh`, and silently ran a manual, full-range disassembly instead of the small ~1KB window around PC. Every other toggle on the same panel (RAM, screen, decimal view, segment) already avoided this because they are bare state setters — the actual `refreshDisassembly()` call for those happens later, from an effect keyed on that value, which fires *after* the sync effect in the same commit. The comment above that effect already said *"Refresh when the follow PC option changes"* — `autoRefresh` was simply missing from its dependency array | Add `autoRefresh` to that effect's dependency array; remove the direct call from the click handler, matching every other toggle's existing pattern |

### 10.2 Secondary accents

**Decided:** each of the six accents (§5.3) gains a **second hue**, for the specific case the
single-hue axis cannot cover — two things in the same view that both need to read as accent-tied
*and* clearly apart from each other. The motivating case: the memory dump's address column already
claims the primary accent, so colouring the hovered-byte highlight with that same primary would read
as "this became an address" rather than "this is highlighted".

**Derivation, not hand-authored:** convert the primary's `solid` to HSL, add a fixed per-accent hue
offset, keep saturation, convert back — the harmony comes from sharing the hue *family*
(analogous colour), the distinction comes from the hue itself. Lightness is kept equal to the
primary's own **only where that still clears legibility**; three of the six needed it corrected
instead, for two different reasons:

1. **Illegible against the background.** Sinclair Blue (H 204°→234°) and Deep Teal (H 178°→223°, see
   below for why its offset is wider) both rotate into blue, and blue carries far less of WCAG's
   relative-luminance weight than green or yellow (0.0722 vs. 0.7152) — so matching the primary's
   own HSL lightness left both nowhere near as bright as the primary actually reads. Sinclair Blue's
   naive `#4554E6` was 3.19:1 against canvas (2.61:1 against the memory dump's own hover
   background); Deep Teal's naive `#2F58C2` was 2.87:1 — both below the 4.5:1 AA floor for text.
   Both lightened independent of the hue rotation (Sinclair Blue 59%→76%, Deep Teal 47%→73%); light
   tone needed no change for either, since light theme needs the opposite lightness move.
2. **Illegible against its own primary.** Spectrum Magenta's naive rotation (H 290°→320°) was legible
   on its own (5.5:1 against canvas) but sat at **1.04:1 against its own primary** — hue alone does
   not move relative luminance evenly, and this rotation barely moved it at all, so the two read as
   the same colour side by side. Lightened for separation rather than background contrast (dark
   62%→72%, light 44.5%→34%, the latter darkened rather than lightened since light theme's primary
   is already dark and needs more of the same to separate further).

The same primary-vs-secondary check on the other three: Phosphor Green sits at 1.13:1 and
Ultraviolet at 1.21:1 — lower than Sinclair Blue/Ember/Deep Teal (2.1–2.9:1 once corrected) but not
adjusted, since both are already legible against the background on their own; worth a look if either
reads flat in practice.

**Final six** (dark tone; light tone and the full alpha ladder are in `palette.ts`):

| Accent | Primary | Secondary | Offset | Note |
|---|---|---|---|---|
| Sinclair Blue | `#45A5E6` | `#939CF0` | +30° (indigo) | Lightened 59%→76% for background legibility |
| Spectrum Magenta | `#C264D6` | `#E18EC6` | +30° (rose) | Lightened 62%→72% for separation from primary |
| Ember | `#FFC933` | `#CFFF33` | +30° (chartreuse) | Full saturation, like the primary — reads as vivid; flagged, not corrected |
| Ultraviolet | `#A78AF5` | `#8AABF5` | −35° (periwinkle) | No correction needed — the primary's own high lightness (75%) carries over safely |
| Deep Teal | `#2FC2BE` | `#90A7E4` | +45° (blue) | Wider than ±30°: the naive rotation landed a few degrees from `info` blue one direction, `success` green the other. Also lightened 47%→73% for background legibility |
| Phosphor Green | `#76C842` | `#B9C842` | −30° (olive) | No correction needed |

**Token family** (`semantic.ts`, mirroring `--accent-*` exactly): `--accent-secondary-solid`,
`--accent-secondary-solid-hover` (88%), `--accent-secondary-subtle` (18%),
`--accent-secondary-border` (55%), `--accent-secondary-text` (= solid),
`--accent-secondary-text-subtle` (85%), plus `--text-on-accent-secondary` mirroring
`--text-on-accent`. `AccentDef` (`palette.ts`) gained `secondary`/`onSecondary`, both
`Record<Tone, string>` alongside the existing `solid`/`onSolid`.

One incidental fix while building this: `--accent-text-subtle` (the primary's own soft-text level,
added earlier for the memory dump's char column) was originally 65% alpha and read as too dark —
alpha is composited *over the panel's own dark surface*, so the transparent remainder darkens it
more than "65% as bright as full strength" suggests. Raised to 85%.

`test/theming/token-contract.test.ts` requires no changes to stay green: it asserts every accent
emits the same *token set*, not fixed values, so a new token family that every accent defines
identically passes by construction.

### 10.3 View-scoped colour: memory dump and disassembly

§5.2 deliberately flattened the register/watch/disassembly-adjacent "data panel" hierarchy
(`--data-value`/`--data-label`/`--data-secondary`) to neutral, on the reasoning that three
competing saturated hues in the densest panels is what made an orange accent impossible in the
first place. **That reasoning still holds for register and watch panels** — nothing here reopens
§5.2's decision or touches `--data-*`.

The memory dump and the disassembly view are different in kind: they are hex-editor-style views,
not dense register grids, and read better for real colour rather than worse. Each gets its **own**
token family (`--color-memory-*`/`--bgcolor-memory-*` and `--color-disassembly-*`/
`--bgcolor-disassembly-*` in `componentAliases.ts`) so the two can carry colour without reopening
the register/watch panels' neutrality — every one of these aliases still bottoms out on the shared
`--accent-*`/`--accent-secondary-*`/`--text-*` tokens, so an accent change still recolours both
automatically.

**Memory dump** (`MemoryDumpSection.tsx`/`.module.scss`):

| Column | Token | Value | Why |
|---|---|---|---|
| Address | `--color-memory-address` | `--accent-text`, bold | Anchors the row in accent |
| Hex bytes | `--color-memory-value` | `--text-primary`, bold | The datum itself — brightest, boldest thing in the row |
| ASCII chars | `--color-memory-char` | `--accent-text-subtle` | Echoes the address's hue at lower strength — same underlying bytes, softer treatment |
| Hovered byte (hex + its ASCII pair) | `--color-memory-highlight` / `--border-memory-highlight` | `--accent-secondary-text` / `--accent-secondary-border` | The *secondary* hue, deliberately not the address's primary — see §10.2's motivating case |

The hover tooltip is scoped the same way: its own box (`.memoryTooltip`, a darker
`--surface-canvas` background and an accent-coloured border, distinct from the app's shared
lighter `--surface-overlay` tooltip) and its content lines individually coloured to match the
column each one describes (address line in `--color-memory-address`, value line in
`--color-memory-value`, char/description line in `--color-memory-char`), rather than uniform plain
text.

**Disassembly** (`DisassemblyRow.tsx`/`DisassemblyPanel.module.scss`) — mapped onto its own columns
rather than reusing memory's roles literally:

| Column | Token | Value | Why |
|---|---|---|---|
| Address | `--color-disassembly-address` | `--accent-text`, bold | Anchors the row, same as memory |
| Decoded instruction | `--color-disassembly-instruction` | `--text-primary`, bold | What a disassembly view is *for* — the "most legible thing in the row" role, same as memory's hex bytes |
| Opcode bytes | `--color-disassembly-opcodes` | `--accent-secondary-text`, bold | The secondary hue — after review, this reads better than echoing the address the way memory's chars do |
| Jump-target label (`L8000:`) | `--color-disassembly-label` | `--accent-text`, bold | A *name for* the same address, not a different kind of information — shares the address's hue rather than needing separation from it |
| Current-PC row | `--bgcolor-disassembly-current` | `--surface-hover` | The row background while paused there, independent of the zebra stripe or a passing mouse hover — declared last in the cascade so it wins both |

Comment/annotation text (`; hardComment`) stays on the shared, neutral `Secondary` styling — it is
editorial text, not part of the address/value/echo relationship the rest of the row expresses.

**Mechanics, both views.** `AddressLabel`, and the `controls/layout` wrappers `Secondary`/`Value`/
`Label` (21+ importers between them, shared with registers and watch), plus `Tooltip`/
`TooltipFactory`, each gained an optional `className` prop merged onto their existing internal
class. Every other consumer simply does not pass it, so this is additive — only `MemoryDumpSection`
and `DisassemblyRow` opt in to their own view's colours.

**The CSS specificity trap this created, twice.** A shared component's own base class
(`.addressLabel`, `.tooltip`) and a caller's override class live in **different stylesheets**, so
both are single-class selectors of equal specificity — whichever module's CSS happens to load
*second* wins, which is not something to depend on. Two fixes, same problem: nest the override
under a selector unique to the caller's own row (`.dumpSection .memoryAddress`,
`.item .disassemblyAddress` — two-class specificity beats one-class regardless of load order), or
double the override class itself (`.memoryTooltip.memoryTooltip`) where nesting is not available.

### Phase 10 exit

- Full suite green: 629 files / 19,755 tests (`npx vitest run --config build/vitest.config.ts`),
  including `test/theming/token-contract.test.ts` (6/6, unchanged assertions).
- Every bug in §10.1 has a regression test that was verified to fail against the pre-fix code and
  pass against the fix — not merely written after and trusted (the Method Lessons in
  `.ai/ui-theming-intent-and-lessons.md` explain why that verification step is the point).
- Not done: extending the secondary accent or the view-scoped colour treatment to any panel beyond
  the memory dump and disassembly view. Nothing here implies register/watch panels should follow —
  §5.2's neutral hierarchy for those stands.

**Nothing is open.** The plan is ready to start at Phase 0.0 (baseline capture) — Phase 10 above is
complete and does not reopen it.

---

## 11. Phase 11 — Sidebar modernization *(2026-09-11)*

Like Phase 10, this was a review pass rather than a planned phase: the author used the new UI, said
the sidebar was the part that had not kept up with the panels, and the work followed from three
specific complaints plus an open invitation for more. **`.ai/ui-theming-intent-and-lessons.md`
carries the distilled version** — read that first.

### 11.0 What was asked

Verbatim, because two of the three turned out to be latent bugs rather than taste:

1. The sidebar's title ("DEBUG") uses a *smaller* font than the panel headers below it.
2. The panel headers could look nicer.
3. There should be a small shadow at the top of a panel's content when it has scrolled up under the
   header.

### 11.1 Bug fixes (found while answering those three)

| Area | Symptom | Cause | Fix |
|---|---|---|---|
| Sidebar header | The sidebar's own title rendered *smaller* than the titles of the panels inside it | An **M1 violation that survived Phases 0–9**. `SideBarHeader`'s `.text` was `--font-size-100` (11px, absolute and correct); `SideBarPanel`'s `.headerText` was `font-size: 0.8em` — 0.8 of the 16px root = **12.8px**. The child outranked its parent by 1.8px, entirely by accident | `.headerText` → `--font-size-100`; the title → `--font-size-300`/700. Tracking dropped 0.09em → 0.04em in the process: wide tracking is what makes an 11px all-caps label legible, and at 13px/700 it only looks loose |
| Overflow shadow (app-wide) | The sidebar appeared to have no scroll affordance at all | **It already had one, and had always been drawing nothing.** `ScrollViewer` has always rendered `AttachedShadow`, driven by real `isScrolled` state — but `--bgcolor-attached-shadow` was aliased to `var(--surface-canvas)`, a *surface* used as a *shadow*. In dark that is `#141517` against a `#17191c` panel: three RGB steps. In light it is `#ffffff` — a white shadow. Wired up, running, invisible in both tones | New `SCROLL_SHADOW` in `dimensions.ts` (per-tone, like `SHADOW`), `--bgcolor-attached-shadow` repointed at it, plus a `-line` companion |
| `AttachedShadow` | Swallowed clicks on the topmost row of every scrollable region | No `pointer-events: none` on an element positioned over content | Added |
| Sidebar header + panel header | Both title elements would push a sibling out of the strip rather than ellipsizing | `width: 100%` together with `flex-grow: 1`. That works only while nothing else shares the row; `min-width: 0` is the mechanism that actually lets a flex child shrink below its content size. Latent until §11.3's badges and menu button arrived | `min-width: 0`, `width: 100%` removed. Same family as the `height: 100000px` → `min-height: 0` note already in `SideBarPanel.module.scss` |

### 11.2 The treatment

Chosen by the author from five prototypes, then narrowed twice (see § "Prototype For Design
Decisions, Never For Verification" in the lessons file for how, and for what was wrong with the
method).

**Panel header band — a shallow top-lit gradient, not a flat fill.** The distinction is not
decorative. The band is 26px tall and the list rows directly beneath it are 22px and also highlight
on hover, so a flat filled strip reads as *a selected row*. A lit strip reads as chrome.

This needed its own semantic pair rather than `--surface-raised`, which is the obvious candidate and
is wrong: "raised" means *lighter*, which only holds in dark. In light, `raised` is pure white —
lighter than the panel it would sit on — so the band would read as a hole rather than a ridge. A
header band is lighter than its panel in dark and **darker** in light.

| Token | Dark | Light |
|---|---|---|
| `--surface-header-lit` (top stop) | `n.hover` | `n.chrome` |
| `--surface-header` (bottom stop) | `n.raised` | `n.hover` |
| `--surface-header-lit-hover` | `n.active` | `n.hover` |
| `--surface-header-hover` | `n.hover` | `n.active` |

In both tones the top stop is the lighter of the pair, so the implied light source is consistent
between them. Exposed through L4 as `--bgcolor-panelHeader` / `-hover`, whose values are
**gradients, not colours** — nothing in the alias layer requires a colour, and expressing the
gradient once beats emitting four stops for every consumer to re-assemble.

The open panel's header takes the stronger foot rule (`--color-panelHeader-rule-open` =
`--border-default`) since that is the edge its data scrolls under; collapsed headers take
`--border-subtle`. The `.notFirst` hairline stays even though headers are now filled: two adjacent
*collapsed* panels are two bands touching edge to edge, and without it they merge into one bar.

**Overflow shadow — a hairline over a gradient, 6px.** Two layers, because a pure gradient is very
nearly invisible on `--surface-panel`: the 1px line carries the *edge*, the gradient carries the
*depth*. Dropping either loses the affordance in one of the two tones. Per-tone strength for the
same reason `SHADOW` is hand-tuned per tone (`rgb(0 0 0 / 75%)` dark, `rgb(20 25 35 / 20%)` light).

Height was chosen by the author against 14/8/6/4/1px side by side. 6px, because the job is to say
"there is content above", not to dim the first row of data — and these panels are dense, monospaced
and ~22px per row. `SCROLL_SHADOW_HEIGHT` records it.

The fade-in ramp moved with it. It was hard-coded to 12px of scroll travel, already slightly wrong
at 14px and clearly wrong at 6px: the shadow would have spent most of its life half-lit. **Height
and ramp have to be chosen together.**

**Also:** `--color-header` repointed `--text-secondary` → `--text-primary` (only `SideBarHeader`
reads it), a closing rule under the title strip, and hover feedback on panel headers — which had
none at all, on an element whose entire purpose is to be clicked.

### 11.3 Two extension points, built before they had users

The author asked for both explicitly, to be filled in later.

**`Activity.commands`** — a "..." menu in the sidebar's title strip. **Omitted by every activity
today, and omitting it renders no button at all**: a control that opens nothing is worse than no
control, so the strip stays clean until an activity has something to put in it.

**`SideBarPanelInfo.badge`** — a small annotation at the right of a panel header.

Both are **components, not descriptor lists**. A sidebar command's label and enabled state, and a
badge's number, depend on live state; a component reads it with the same hooks as everything else,
where a static descriptor would need a context object threaded from a module-level registry that has
no store access. Two consequences worth keeping:

- The commands component is **mounted only while the menu is open**. Command components subscribe to
  the store, and mounting them eagerly would re-render the sidebar header on every machine tick for
  a menu nobody has opened.
- The menu **does not self-close on selection** — some commands are toggles. The item calls `close()`.

`SideBarBadge` (`appIde/SideBar/SideBarBadge.tsx`) supplies the pill in four tones — `neutral`
(default, "a fact"), `accent`, `warning`, `error` — and **renders `null` when there is nothing to
say**: no children, or a count that is zero, negative, `undefined` or `NaN`. That is why it exists
rather than a `<span>` per panel. A badge reading "0" is worse than no badge, because it draws the
eye to a panel exactly when the panel is empty; making the empty case the component's own
responsibility means no future badge can forget it.

Its colours come straight from L2 rather than through new L4 aliases. The alias layer exists to
repoint names the app *already* used (§3); a component written after that layer landed has nothing
to migrate, and eight aliases nothing else would read would make the map longer without making
anything more changeable.

### 11.4 First two badges — and why they look nothing alike

| Panel | Source | Implementation |
|---|---|---|
| Watch | `AppState.watchExpressions` — renderer state | A selector. That is the whole component |
| Breakpoints | Owned by the emulator's `DebugSupport`, reached over IPC | Fetch, plus a refresh contract |

**They differ because the data does, not because one is doing it the long way.** The renderer store
carries only `breakpointsVersion`, a counter `DebugSupport` bumps on every mutation (set, remove,
enable, erase, resolve); that counter plus `machineId` is what says when to re-fetch.

**`BreakpointsBadge` deliberately does not poll**, and copying its own panel would have made it.
`BreakpointsPanel` refreshes on `useEmuStateListener` — on a timer — because it draws disassembly at
each breakpoint address, the resolved address and the current PC, all of which go stale as the
machine executes even when the list does not. A *count* changes only when the list does. Polling
would have bought nothing and cost an IPC round trip per tick, per open sidebar, forever. There is a
test pinning it (`advanceTimersByTimeAsync(10_000)` → exactly one call), because a future "make the
badge more responsive" change is exactly what would undo it.

`WatchBadge` selects `s.watchExpressions?.length ?? 0`, **not** `s.watchExpressions || []` as
`WatchPanel` does. The panel's form is right for the panel — it needs the items — but it allocates a
fresh `[]` on every state change while the list is empty, so referential equality never matches and
the header would re-render on every unrelated store update. A number compares by value.

Both are `neutral`-toned, per `SideBarBadge`'s own convention that a count is a fact rather than
something to act on.

### Phase 11 exit

- Full suite green: 642 files / **20,056 tests**; `tsc --noEmit -p tsconfig.json` clean;
  `electron-vite build` succeeds.
- 23 new tests across three files: `SideBarExtensionPoints.test.tsx` (the two slots),
  `BreakpointsBadge.test.tsx` (the refresh contract, including the no-polling assertion),
  `WatchBadge.test.tsx`.
- Compiled CSS was inspected in `out/renderer/assets/*.css` rather than trusting the SCSS — the
  nested `&:hover .headerText` and `.expanded > .header` rules were verified to emit descendant
  selectors with the specificity they need.
- **Not verified in the running app.** This is the phase's one real gap and it is recorded as a
  process failure, not a footnote — see § "Prototype For Design Decisions, Never For Verification"
  in the lessons file. The author had a dev instance running without `--remoteDebuggingPort`, and
  the CDP check was offered rather than performed.
- Six new L4 aliases were registered in `ThemeProperties` (`theming/theme.ts`) — caught late, and
  only because a concurrent change to the same file did it correctly. Nothing enforces that
  convention; see the note under § "Token Architecture" in the lessons file.
- `sidebar-lab.html` (repo root, untracked) is the prototype gallery. It is a design artefact, not
  evidence; delete it once the treatment is settled.

---

## 12. Phase 12 — System Variables panel *(2026-09-11)*

Another review pass rather than a planned phase: the author asked for this one panel to be
modernized. It is the first sidebar **list** (as opposed to a register/state display) to take the
full treatment, and the first panel whose problems were about *volume* rather than about colour.

### 12.0 What the panel actually had

`SysVarsPanel` was slice 6.0's pilot, so it had been on `controls/data` since Phase 6 and looked
converted. What it had not had was a review against what the panel is *for*:

| Problem | Evidence |
|---|---|
| No address anywhere on screen | The address was in a native `title` on the name cell. Every other converted view anchors its rows with a visible address column |
| Neutral, next to converted neighbours | Sat in the Machine Info activity beside ULA & I/O, which had taken `--color-state-value` |
| Array variables dumped inline, in full | `TSTACK` is 115 bytes on the ZX 128 and `TBUFFER` 192 on the C64 — 15 and 24 grid rows inside a list of 22px ones. Scrolling past one is most of the panel |
| No way to find a variable | The C64 defines **244** system variables, the ZX Next 119. The only navigation was the scrollbar |
| Nothing said what had just moved | The panel refreshes ~1.3×/s while the machine runs and redraws every value identically |
| Two IPC round trips per tick, one of them a constant | `getSysVars()` (the static per-machine table) was fetched beside the 64K memory snapshot on every refresh |
| Native `title` tooltips | On the name cell and on every array byte — unstyled, on the browser's clock, and firing *alongside* any row tooltip |

### 12.1 The treatment

**The row is now `[disclosure] [address] [name] [value]`.** The address takes
`--color-state-value-alt` and the value `--color-state-value`, which is the split §10.3 defines for
a row carrying two numbers that only position tells apart. Which of the two gets the primary follows
`CallStackPanel`: the payload, not the place it lives.

**Arrays longer than one grid row collapse** to a preview of their first eight bytes plus
`(192 bytes)`, and expand in place. At or below eight bytes there is nothing to collapse, so those
rows are unchanged — a chevron on a row already one line tall is friction. The disclosure column is
**present on every row and merely invisible** where there is nothing to disclose, because a cell
that vanishes takes every column after it with it (the `NextRegPanel` raggedness noted in §10.3).
Expansion state lives in the panel, not the row: rows unmount when the virtualized list scrolls.

**A filter box**, as `PanelFilter` in `controls/data` rather than as a private input. "This list is
too long to scroll" is not a System Variables problem — the Next has 141 hardware registers behind
the same shape — and the primitive set is where the second panel will find it. It matches on name
and on the address **as the row writes it** (`5c0`, `$5C`), and deliberately not on the
descriptions: a hit the reader cannot see in the row it produced reads as a bug.

**What moved is marked with a wash, not a colour**, and that is the one finding here worth carrying
past this panel. `--data-changed` has had no consumer since Phase 6 — this is its first — and it
resolves to the accent's `solid`, which is exactly what `--color-state-value` resolves to. So the
obvious implementation repaints an accent value in the same accent: wired up, running, invisible,
the `AttachedShadow` failure from the other side. `.changedWash` (`--data-changed-bg`, the same hue
at 18%, behind the glyphs) is the form that survives conversion, and it is applied per *byte* in an
array, so a 192-byte buffer says which of its bytes moved.

**One tooltip per row, whose content follows the pointer.** A row here can hold eight flag bits or
192 array bytes, each with its own description, and the primitives drawing those each answered with
a tooltip of their own while the row wanted one for the variable — two boxes for one pointer.
`MemoryDumpSection` had already settled this: the row owns the tooltip, the hovered cell reports its
index. `HexByteGrid` gained `onHoverByte` (replacing `titleFor`, whose only consumer this was) and
`FlagRow` gained `onHoverBit`; **both suppress their own per-cell tooltips when passed**, since a
caller taking over the content is the only reason to ask.

**The table is fetched on `machineId`, not on the tick.** Per-field staleness, not per-panel: the
descriptors change when the machine does, the values change constantly. The refresh is a
`useCallback` because `useEmuStateListener` keys its subscription on the callback's identity, and
this panel re-renders on every tick.

### 12.2 Shared-primitive changes

Small, and each one is the "the primitive set is incomplete" signal rather than a panel special
case — the same conclusion slice 6.0 reached about `HexByteGrid` itself:

| Primitive | Change |
|---|---|
| `PanelFilter` | New. One row, inset input, count, clear; content rather than chrome |
| `.changedWash` | New. The wash form of the changed signal, for converted panels |
| `HexValue` | `valueXclass`/`secondaryXclass`, the same opt-in `registers.tsx` already exposed |
| `HexByteGrid` | `titleFor` → `onHoverByte`; `changedFor` for per-byte marking |
| `FlagRow` | `iconFill`, `xclass`, `onHoverBit` |
| `BitValue` | `onHover`, on the cell rather than a wrapper div — `.flagStrip` is a flex row, and an extra div in it is an extra flex item |

### 12.3 Known, not fixed

`FlagFieldRow` (VIC, Blink) still binds a row `TooltipFactory` over eight `BitValue` tooltips, which
is the double-tooltip described above. It is now fixable from the same `onHoverBit` prop, and was
left alone because changing it changes five panels the author has not asked about.

A **badge** was considered and rejected: a count of system variables is a constant of the machine,
and `SideBarBadge`'s own convention is that a badge states a fact worth watching. The filter row's
`12 / 244` covers the only count that moves.

### Phase 12 exit

- 18 new tests (`test/controls/SysVarsPanel.test.tsx`): the row's columns, both array behaviours,
  the five filter behaviours, the change signal across three refreshes (including that it *stops*),
  and the IPC contract — table once, values per tick, re-fetch on machine change.
- `tsc --noEmit -p build/tsconfig.web.json`: 162 errors before and after, the same set by message.
- `electron-vite build` succeeds; the compiled CSS was read to confirm the doubled-class overrides
  (`.sysVarRow.sysVarRow`, `.sysVarAddress.sysVarAddress`) emit at the specificity they need.

---

## 13. Phase 13 — Next Palettes panel & the palette grid *(2026-09-11)*

A third review pass by request: the author said the Next Palettes sidebar panel had "many design
flaws" and that the component drawing a palette was "awkward", asked for prototypes, and chose
**panel variant B** (device rows with an always-on ribbon) and **grid variant D** (fluid mosaic with
an index gutter and quadrant rules) out of four of each.

The prototype loop is the one § "Prototype For Design Decisions" describes and it worked again
unchanged. What is new is that **the gallery's own "A — Current" variant is what found the colour
bug**: drawing the replica out of the real `PaletteDevice` data, through the real
`getCssStringForPaletteCode`, put the app's ULA palette next to the Spectrum colours it is supposed
to be, and they were plainly different. Nothing in a screenshot of the shipped panel says that; a
palette of wrong colours still looks like a palette.

### 13.0 The three bugs

**The sidebar drew every colour wrong.** The Next holds a 9-bit RGB333 entry in two packings that
are a one-bit rotation apart:

| Layout | Shape | Who holds it |
|---|---|---|
| Register | `RRRGGGBB` in bits 7..0, low blue bit in bit 8, priority in bit 15 | `PaletteEditor`, `.nex`/`.pal` files, `SpriteEditor`'s default ramp — and every function in `zxNext/palette.ts` |
| Device | straight `RRRGGGBBB` | `PaletteDevice`, and therefore `getPalettedDeviceInfo`'s payload |

`PalettePanel` passed the device layout into a viewer that speaks the register one, so ULA blue
`$005` (`#0000b6`) drew as `#002449`, a dark teal. **This is a quiet class of bug**: the rotation
leaves greys and whites unchanged and moves saturated colours to another plausible colour, so the
panel looked fine for as long as nobody compared it to the emulator's own screen.

`getRgbPartsForPaletteCode` was decoding the *other* layout from its two siblings, so the viewer's
tooltip and the swatch beside it disagreed about the same number — and each was right for a
different caller. It now decodes the register layout like everything else, which also fixes
`SpriteEditor`'s R/G/B readout.

`colorIntensity` in the same file had `0x25` where the hardware's bit-replication gives `0x24`
(`001` → `00100100`), so `getAbrgForPaletteCode` — the path `Layer2Screen` and `SpriteImage` draw
through — rendered that one level a step brighter than `zxNextBgra` displayed the same colour.

Also: `ArrowDown` wrapped on `> 256` rather than `>= 256`, so the last row selected index 256;
`intiallyVisible` was misspelled *and* never passed, so all eight sections opened collapsed.

### 13.1 The panel

**Four devices, not eight palettes.** A Next device has one palette with two banks and a register
bit saying which is live; the panel had flattened that into eight peers named "ULA first", "ULA
second", … , which threw away the pairing and the live fact both. `DEVICES` is a table, because the
shape is the point.

**A switch was the wrong control twice over.** `LabeledSwitch` says "turn this on" for what is
disclosure, and *two* switches for two mutually exclusive banks says each can be independently on.
Now: a chevron for disclosure, and a two-segment control for the bank.

**The shown bank is a fill; the live bank is an accent ring.** Two fills cannot say which is which,
so the two states take different kinds of mark. The ring marks the *exception*: shown follows live by
default, so it sits under the fill and is invisible until the view is pinned away from the hardware,
which is the only moment it has anything to say. The old panel marked the live palette with
`--bgcolor-button-pointed` — *a hover token* — across only the 140px its inline-styled switch box
occupied, so it read as a half-drawn hover.

This shipped first as a 3px corner dot and the author spotted it immediately, as a possible
rendering bug rather than as a mark — correctly, because on the filled segment the dot had to be
`--text-on-accent` (`#0e0f11` in dark) to be visible at all, and because it was present on all four
devices in the default state. The durable form of that lesson is in the lessons file: **a state mark
that is on screen in the common case is decoration, not a signal.**

**Shown bank follows live until the user picks one, then stays.** The default answers the question
the panel exists for; the pin is what makes comparing the two banks possible while a program flips
`$43`. Nothing resets it — the live dot on the other segment is the standing indication.

**An always-on preview per device.** The previous panel opened on eight collapsed switches and no
colour at all. This shipped first as a wrapped 2×128 gradient ribbon and the author rejected it on
sight: at ~1.7px per entry it cannot show an individual colour, and on the ULA the stripes it showed
were the palette's 16-entry repeat period rather than its colours. It read as texture.

What replaced it is a **32px thumbnail of the real 16×16 grid**, inline in the 36px device row —
2px per entry, chosen against 1px (still aliases a period-16 palette) and 3px (a 52px row, and the
preview starts competing with the grid it previews). Still gradients rather than elements — sixteen
16-stop rows, not 256 nodes — because this panel re-polls on a timer and four devices of per-entry
DOM is a thousand nodes reconciled per tick for something nobody clicks.

**Transparency is marked only where it is an index.** Sprites (`$4B`) and tilemap (`$4C`) name a
palette slot; ULA and Layer 2 do not — `$14` is a global transparency *colour* matched against a
pixel's 8-bit value. `PaletteDeviceInfo` gained the two real indexes and lost `trancparencyColor`,
a misspelled field carrying `fallbackColor` that no consumer had ever read.

### 13.2 The grid

**Sized from the swatch, and no `smallDisplay` prop.** The viewer had two hand-sized modes (18×14
cells in a fixed 324px column, 24×22 in 480px) and the sidebar got the small one, which meant it drew
a 288px grid into whatever width the sidebar had and clipped. One grid now covers the sidebar and the
`.pal` editor from one code path, with each call site naming its own `cellSize` — 14px in the
sidebar, 29px in the `.pal` editor and `.nex` viewer, 17px beside the sprite grid, the last two
reproducing the widths their old fixed `Column`s reserved.

**This was `repeat(16, 1fr)` first, and the author rejected that too.** Fluid columns fixed the
clipping and introduced a worse problem: dragging the sidebar swung the cells 13.9px → 30.2px, and
every one of those widths was fractional, so the cell edges and quadrant rules sat off the pixel grid
at every size. `width: calc(2.2ch + 16 * var(--palette-cell)); max-width: 100%` over `1fr` tracks
fixes both — a definite width so the tracks divide an exact multiple and land on integers, a
percentage cap so a container narrower than the grid degrades by shrinking rather than clipping. The
gutter stays `ch` (M2) and appears in the calc for exactly that reason: the sixteen cells get
`16 × --palette-cell` between them whatever `2.2ch` resolves to.

**Index labels at every size.** The small mode had dropped them entirely, so the panel that most
needed to name an index was the one that could not.

**Quadrant rules every fourth row and column**, as `inset` box-shadows — a grid of `1fr` tracks
cannot afford a box-model change, and a 1px border on every fourth cell takes a pixel out of that
column. Without them, finding `$A7` means counting ten cells across an unbroken band of colour.

**Everything drawn *on* a swatch takes its contrast from that swatch**, including the rules —
`--palette-rule` is set per element from the entry's own luminance. There is no theme answer to
"a hairline over arbitrary user colour": one fixed alpha vanishes over half of any palette and a
theme neutral over more. It is registered in `token-contract.test.ts`'s `RUNTIME_PROVIDED` for that
reason, with the justification written out.

**One tooltip for the grid, not 256.** Each cell mounted its own `TooltipFactory`; the sidebar drew
eight palettes, so 2048 popper instances, rebuilt on every poll. One pointer, one readout — driven
through `isShown` rather than `Tooltip`'s own listeners, which attach on the effect *after* the
`mouseenter` that would have started them. Delay is 220ms, not the app's 800ms: a palette is scanned,
and at 800ms the answer arrives after the eye has moved on.

**The swatch is a `div`.** Each was an `<svg>` with no `width`/`height`/`viewBox`, so every one took
the SVG default replaced size of **300×150** inside an 18px cell; only the absence of a background
on the overflow kept that invisible. The `memo` also never hit — it was keyed on the `palette` array,
whose identity changes on every poll — so the primitives are now per-entry and the memo works.

### Phase 13 exit

- Full suite green: **20,148 tests** / 649 files; `electron-vite build` succeeds;
  `tsc --noEmit -p build/tsconfig.web.json` unchanged against baseline for every touched file.
- 42 new tests: `test/zxnext/palette-codec.test.ts` (the two layouts, both directions, against the
  device's own `nextReg41Value` derivation, and the three intensity tables pinned to each other),
  `test/controls/NextPaletteViewer.test.tsx`, `test/controls/PalettePanel.test.tsx`.
- Two existing gates fired and were satisfied rather than suppressed: `token-contract.test.ts` on
  `--palette-rule`, and `wasm-next-full-matrix.test.ts`, which requires every TypeScript ZX Next
  suite to be accounted for — `palette-codec.test.ts` is `typescript-owned-host-boundary`, since the
  WASM core never sees a CSS string or an ABRG word.
- **Verified in the running app over CDP**, which Phase 11 did not do: both tones, the transparency
  mark, and the hover readout (`$E3 — R: 7, G: 0, B: 7 (transparency)`) — the value that proves the
  device→register conversion end to end. The sizing was measured by driving the sidebar's own width
  host: **14.00px cells and a 242.5px grid at 260, 400 and 520px sidebars**, and a clean shrink to
  11.6px and 10px at 220 and 180px with no overflow past the panel.
- One trap worth recording: **wiping `#themeRoot`'s inline style to test something removes the whole
  token set**, since that is where `ThemeProvider` emits it. It renders the app in initial values and
  looks exactly like a component failing to resolve its own tokens. Reload the window instead.

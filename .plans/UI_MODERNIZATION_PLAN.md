# UI Modernization Plan — Emulator & IDE Shell

**Status:** Draft — awaiting review
**Process:** Phases are amended in place after each retrospective (§6.0). If this file and your
memory of it disagree, this file wins.
**Created:** 2026-09-06
**Updated:** 2026-09-06 (data-panel audit → §2.4/§3.0; accents settled → §5; Phase 0 detailed, and
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

**Still open inside Phase 1**, and the honest reason each was deferred:

- **The literal values in `dark-theme.ts` / `light-theme.ts` are now dead weight.** The alias layer
  overrides them, so they no longer affect rendering, but the files still carry ~200 literals each.
  Deleting them is safe but noisy, and doing it in the same commit as the visual change would have
  made the diff unreviewable. Next step of Phase 1.
- **Monaco still uses its own palette** — that is Phase 8 by design, and it is now visibly the odd
  one out, which is the strongest argument yet for doing it.
- **The `--strip-statusbar: 26px` value is emitted but not consumed**; the status bars still declare
  40px in their own stylesheets. Phase 5 wires it.

### Phase 2 — Shared primitives
`IconButton` becomes a real `<button>` with CSS `:hover`/`:active`/`:focus-visible`; delete the React
hover state, the module-global pointer position and the `elementFromPoint` probe. One `PanelHeader`
(promoted to a real component: title, actions, surface, border), one `Tab`, one focus-ring treatment.
Keyboard access and ARIA roles across the shell. Reconcile `common/Icon.tsx` vs `controls/Icon.tsx`.

### Phase 3 — IDE: activity bar + sidebar
Fixes 1 and 7 from §4; chevron transition; drop the `100000px` sentinel.

### Phase 4 — IDE: document tabs, header, tool area
Fixes 3 and 4; unify the 38/36/32 ladder onto `--strip-tabbar`; give the tool area header its own
surface; restore a focus ring on the command prompt.

### Phase 5 — Both windows: status bars + toolbar
Fixes 2 and 8; both status bars to `--strip-statusbar`; toolbar icon sizes collapse from five onto
`--icon-sm/md/lg`.

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

#### The slices, ordered by risk

| # | Slice | Replaces | Risk |
|---|---|---|---|
| **6.0** | **Pilot** — migrate 2 panels by hand (one per folder, e.g. `SysVarsPanel` + `BinFileViewerPanel`) | nothing yet | Discovery. Expect to throw the first API away. |
| **6.1** | `EmptyState` | 6 byte-identical `.center` blocks + 5 hand-written messages (two with stray trailing spaces) | Trivial. Proves the pattern. Also where the rainbow motif lands (§9.2). |
| **6.2** | `PanelHeader` (real: title, actions, surface) | 17 hand-rolled headers, 3 competing heights | Low |
| **6.3** | `DataRow` | 16 separate row rules with 8 different paddings | Low–medium |
| **6.4** | `HexValue` / `FlagValue` / `BitValue` | 6 "labeled hex value" implementations | **Medium** — unifies real behaviour differences: uppercase vs lowercase hex, `$` prefix present in some panels and absent in others. Decide the convention here and apply it everywhere. |
| **6.5** | `DataLabel` / `DataValue` + the `ch` measure scale (M2) | 13 magic width constants, 6 different label widths, 6 CSS widths in `valuedisplay` | **Highest.** Moves sizing out of React props into CSS, which changes how `Label`/`Value`/`Flag`/`Text` are called app-wide. **Sub-slice by folder:** SiteBarPanels first, then DocumentPanels. |
| **6.6** | `DataPanel` root + delete the old stacks | 10 near-identical roots; removes one of the two `Row` components and one of the two `.label`/`.value` implementations | Medium — but by now every consumer has already moved. |

Each slice ships independently and leaves the app coherent: a slice that unifies empty states while
41 panels still use the old row markup is not a half-finished state, because empty states are
self-contained.

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
| **7.2** | **`PanelToolbar`** | 11 files carrying in-panel toolbars; only `DisassemblyToolbars.tsx` is extracted — `BasicPanel`, `ScriptOutputPanel`, `CommandResult`, `TapViewerPanel`, `DskViewerPanel` (19 controls), `BinFileViewerPanel`, `ImageViewerPanel` and `PaletteEditor` all inline theirs | Also settles the **two competing separator components** doing the same visual job: `LabelSeparator width={8}` (Disassembly/Bin/Image) vs `<ToolbarSeparator small>` (Basic/Script/Command/Tap/Dsk). |
| **7.3** | **`GenericPanel` family** | 347 lines across 3 files, **7 consumers**. `GenericFileEditorPanel` is `GenericFileViewerPanel` plus `saveToFile` — their render bodies are line-for-line identical, as are the `fileLoader` effect and the view-state persistence effect | Collapse to one parameterized component. This is the abstraction the five hand-rolled viewers (`Bin`/`Dsk`/`Tap`/`Image`/`Unknown`) should have been using; migrating them onto it is part of the slice. |
| **7.4** | **Virtualization contract** | **15 `VirtualizedList` consumers**, configured differently: `itemSize` passed by 2 and omitted by 3, `overscan: 25` in some and absent in others | Binds row heights to M3's JS-readable `rowSizes` module, which is what stops the type scale and the virtualizer drifting apart. Also folds in the **byte-identical column block** shared by `DisassemblyPanel.module.scss` and `features/memory/MemoryDumpSection.module.scss` (verified identical) and its copy-pasted TSX (`DisassemblyRow.tsx:123-139` ≡ `MemoryDumpSection.tsx:84-97`) into one `DataGridRow`. |
| **7.5** | **`ToolArea/` shell** | 532 lines: `ToolsContainer`, `ToolsHeader`, `ToolTab`, `CommandPanel`, `OutputPanel` | Adopts `PanelHeader` (7.2) and `ConsoleOutput` (7.1) rather than its own. Restores a focus ring on the command prompt — `outline: none` with no replacement, on **the only text input in the tool area**. |

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

**Nothing is open.** The plan is ready to start at Phase 0.0 (baseline capture).


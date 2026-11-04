# Klive's UI design system: tokens, accents, themes

The record of the UI modernization's design decisions (Phases 0-13, September 2026; the plan was
closed on 2026-11-04 and is in git history at `.plans/UI_MODERNIZATION_PLAN.md`, where every phase's
retrospective is kept). The working rules and the lessons are `.ai/ui-theming-intent-and-lessons.md`,
which `AGENTS.md` requires reading before style work; this file holds the architecture and the numbers
behind it. The code is `src/renderer/theming/tokens/`.

## The token architecture

Four layers, each referencing only the layer above it:

```
L1  Primitives   --klive-gray-1..12, --klive-accent-1..12, --klive-red/amber/green/blue-*
                 raw ramps; light and dark are two value sets with the same names
L2  Semantics    --surface-*, --text-*, --border-*, --accent-*, --focus-ring, --status-*
                 what it means, not what colour it is
L3  Dimensions   --space-*, --radius-*, --size-*, --strip-*, --font-size-*, --shadow-*,
                 --duration-*, --ease-*, --icon-*, --z-*   (theme-independent)
L4  Component    the legacy component tokens (--bgcolor-activitybar, --color-doc-inactiveText, ...)
                 as thin aliases onto L2/L3
```

L4 was the migration trick: the old names kept working but stopped holding literals, so one change
restyled every stylesheet at once and later work replaced aliases with direct L2/L3 use one panel at a
time. **A colour literal never goes in a stylesheet or a component**: alias it at L4 or add it to
L1/L2.

- **L1 ramps** are 12-step, Radix-style, so step *n* means the same role in both themes: 1-2 app and
  panel backgrounds, 3-5 component backgrounds (rest, hover, active), 6-8 borders (subtle, default,
  strong), 9-10 solid fills, 11-12 text (secondary, primary). Hues: `gray` (slightly cool), `accent`,
  and four status hues `red`/`amber`/`green`/`blue`.
- **L2 semantics:** `--surface-canvas` (window base), `-chrome` (activity bar, toolbar, status bar),
  `-panel` (sidebar, tool area), `-raised` (active tab, popovers), `-overlay` (modals, dropdowns),
  `-hover`/`-active`/`-selected`; `--text-primary/-secondary/-tertiary/-disabled/-on-accent`;
  `--border-subtle/-default/-strong`; `--accent-solid/-solid-hover/-subtle/-border/-text`;
  `--focus-ring` (one token, used identically everywhere); `--status-error/-warning/-success/-info`
  with `-subtle` backgrounds.
- **L3 dimensions:** `--space-base` is `4px` (absolute), radius `2/4/6/10/999px`, strips (toolbar 38,
  status bar 26, tab bar 36, sidebar header 34px), rows (panel header 26, list 22px), controls (24/30px),
  activity bar 48 with 44px buttons, icons 16/20/24px, type `--font-size-50..400` = `10/11/12/13/15px`,
  motion 80/140ms, and `--z-splitter/overlay/menu/modal` instead of ad-hoc z-indexes.

### The five mandates

- **M1 The type scale is absolute, never `em`**: `em` compounds through ancestors. Every panel sets a
  size explicitly; the root has an anchored `font-size`. Pinned by `test/theming/type-scale-contract.test.ts`.
- **M2 Tabular measure is font-relative (`ch`), never px** for hex, address, register and flag
  columns. Iosevka's advance is exactly 0.5em (6px at the data panels' 12px). **`ch` means 6px only
  under a `.dataPanel` ancestor**: legacy cells inheriting Inter (proportional) do not align, so
  converting a panel's cells to `DataLabel`/`DataValue` converts its root to `DataPanel` in the same
  edit. Pinned by the same test.
- **M3 Row heights that feed virtualized lists come from one TS module**, `theming/tokens/rowSizes.ts`,
  imported both by the theme (to emit the CSS properties) and by the components (`itemSize`). Pinned
  by `row-size-contract.test.ts`.
- **M4 Imperative theme reads shrink, not grow:** what can be CSS is CSS; what cannot (keyboard SVGs)
  reads L2 names, never L4, so it moves with the palette.
- **M5 Syntax colours come from the token system**, not literals in each language provider. (The first
  scheme derived every class from the accent; it was replaced by the fixed multi-hue table in
  `theming/tokens/syntax.ts`, whose header records why.)

`test/theming/token-contract.test.ts` checks that every referenced token resolves in both themes (or
is an app stylesheet's own property, or on a short runtime allowlist), that both themes define the same
key set, that no `var()` is empty, and that **every accent × theme pair** meets 4.5:1 for text, 3:1 for
indicators and **ΔE2000 ≥ 12** from every meaning-bearing colour.

### The shared data primitives

Tokens alone could not remove the duplication in the data panels (two `Row` components, two
label/value implementations, hand-rolled row rules), so `controls/valuedisplay/` and the value half of
`controls/layout/` became one set, **`@renderer/controls/data`**: `DataPanel`, `DataRow`, `DataLabel`,
`DataValue`, `HexValue`, `FlagValue`, `BitValue`, `PanelSection`, `PanelHeader`, `EmptyState`.
`controls/layout`'s `Label`/`Value`/`Secondary` delegate to them and add only tooltip behaviour.

## Accents

The accent is a **user setting, orthogonal to light/dark**: six ship, the default **Sinclair Blue on
dark**. `ThemeProvider` has an `accent` axis beside `tone`; consumers read `--accent-*` and need no
change; it persists as `appSettings.accent`.

**The rule that chose them is perceptual distance, not hue angle:** a hue-gap rule passed accents that
were nearly the same colour as ones already in use (Phosphor Green was ΔE 5.4 from the secondary label).
The target is **ΔE2000 ≥ 20** against every colour that carries meaning; the test's floor is 12, which
the shipped set holds.

| Accent | Dark | Light | ΔE dark / light | Contrast dark / light |
|---|---|---|---|---|
| **Sinclair Blue** (default) | `#45A5E6` | `#0A6FB8` | 41.0 / 44.3 | 6.77 / 5.28 |
| Spectrum Magenta | `#C264D6` | `#9B2FB4` | 26.3 / 29.7 | 5.30 / 6.07 |
| Ember | `#FFC933` | `#8A6A00` | 31.9 / 23.5 | 11.88 / 5.07 |
| Ultraviolet | `#A78AF5` | `#6340C8` | 32.7 / 36.0 | 6.61 / 6.78 |
| Deep Teal | `#2FC2BE` | `#0A7D78` | 17.5 / 18.0 | 8.34 / 4.98 |
| Phosphor Green | `#76C842` | `#3B7A16` | 13.4 / 12.1 | 8.80 / 5.27 |

All twelve pairs clear WCAG AA. Deep Teal and Phosphor Green sit under the ΔE 20 target, against the
success green; they ship because success is a sparse, transient colour. Phosphor Green is the first
to drop if it reads wrong. Rainbow Red was dropped (ΔE 0 from the error colour, same hue as the
recording indicator), Phosphor Amber too (ΔE 8.5 from the register-label colour). The warning colour
is a red-orange (`#E8703A` / `#A03F0C`), ΔE 31.9 / 23.5 from Ember.

**The data panels are a hierarchy, not categories:** value (the data) `#e4e6ea`/`#1b1d21`, label
(`AF`, `PC`) `#949aa4`/`#565c65`, secondary (a decimal suffix) `#7f8690`/`#6b717a`, and **changed
since the last stop** in the accent. Saturated colour means state. The memory dump, the disassembly and
the converted register/state panels (`--color-state-value`) are the deliberate exceptions; see the
lessons file.

### Secondary accents

Each accent has a second hue (`--accent-secondary-solid/-solid-hover/-subtle/-border/-text/-text-subtle`,
`--text-on-accent-secondary`; `AccentDef.secondary`/`onSecondary` in `palette.ts`) for two things in one
view that must both read as accent-tied yet stay apart (the memory dump's hovered byte against its
address column). It is **derived**: the primary's HSL hue plus a fixed offset, saturation kept;
lightness kept only where that stays legible.

| Accent | Primary | Secondary | Offset | Correction |
|---|---|---|---|---|
| Sinclair Blue | `#45A5E6` | `#939CF0` | +30° (indigo) | lightened 59%→76%: blue carries little WCAG luminance |
| Spectrum Magenta | `#C264D6` | `#E18EC6` | +30° (rose) | lightened 62%→72% (light 44.5%→34%): it sat at 1.04:1 against its own primary |
| Ember | `#FFC933` | `#CFFF33` | +30° (chartreuse) | none; vivid, flagged |
| Ultraviolet | `#A78AF5` | `#8AABF5` | −35° (periwinkle) | none |
| Deep Teal | `#2FC2BE` | `#90A7E4` | +45° (blue) | a wider offset, ±30° landed near `info` or `success`; lightened 47%→73% |
| Phosphor Green | `#76C842` | `#B9C842` | −30° (olive) | none |

Phosphor Green (1.13:1) and Ultraviolet (1.21:1) are the closest to their own primaries; worth a look
if either reads flat. A soft-text alpha composited over a dark surface reads darker than its percentage
suggests (`--accent-text-subtle` had to go from 65% to 85%).

## Themes

**The light theme is derived from the same ramps**, not hand-copied, so both themes define the same
keys by construction. Four places stay hand-tuned:

| Exception | Why |
|---|---|
| Shadows | They do not invert: light needs shorter, tighter, lower-opacity shadows. |
| Disabled states | On dark, disabled recedes to the background; the same step on light reads as faint but active. |
| Syntax palette | A straight inversion gives muddy mid-tone keywords (`syntax.ts`). |
| Device surfaces | Not derived at all. |

**Device surfaces are theme-invariant:** emulated hardware has no light mode. `--device-bezel`,
`--device-body`, `--device-key`/`-key-raise`, `--device-legend-*` (the machines' own legend colours)
are the same in both themes. The emulator area the device sits on follows the theme but stays recessed
(a mid-neutral on light).

## Settled decisions

- The Spectrum four-stripe motif appears on the About panel and the empty states only, never in the
  chrome beside the functional accent and status hues.
- Status bars are 26px in both windows (were 40px); the activity bar's active item is a 2px accent
  stripe on a hover surface, not a solid fill; the status bar is `--surface-chrome`, and state carries
  colour, not the whole bar.
- `user-select: text` for data content (hex dumps, disassembly, tape and disk blocks, BASIC listings).
- `ToolArea/` shares the data-panel conventions with `DocumentPanels/` and `SideBarPanels/`.

## Known, not fixed

- `FlagFieldRow` (VIC, Blink) binds a row tooltip over eight `BitValue` tooltips (a double tooltip);
  fixable from its `onHoverBit` prop, left because it changes five panels nobody asked about.

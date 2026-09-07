/**
 * L3 — dimensions.
 *
 * Spacing, radii, sizes, type, elevation, motion and layering. All theme-independent: a 4px gap is
 * 4px in both tones.
 *
 * Two rules here are load-bearing, and both come from problems found in the audit
 * (§3.0 of .plans/UI_MODERNIZATION_PLAN.md):
 *
 * - **M1 — the type scale is absolute, never `em`.** `em` compounds, and it was already producing
 *   wrong sizes: `TapViewerPanel` set `1em` inside a `0.8em` parent and got 12.8px rather than the
 *   16px it plainly intended.
 * - **M2 — tabular measure is `ch`, never px.** Column widths for hex and registers were hardcoded
 *   pixel values tuned to a specific font, and the mono stack had just changed from Menlo/Consolas
 *   (0.6em advance) to Iosevka (0.5em) — 17% narrower — silently mistuning every one of them.
 */

/** Base unit for the generated `--space-*` scale. Absolute, so the scale cannot drift with type. */
export const SPACE_BASE = "4px";

export const RADIUS = {
  xs: "2px",
  sm: "4px",
  md: "6px",
  lg: "10px",
  full: "999px"
} as const;

/**
 * Heights of the app's horizontal strips.
 *
 * The audit counted eleven near-but-unequal heights across the shell (48/40/38/38/38/36/36/36/32/
 * 24/24). These are the values they collapse onto.
 *
 * `statusbar` drops from 40px to 26px — the single biggest density win, and it also fixes the
 * inversion where the least important strip in the window was the tallest. It only became viable
 * once the `.isMonospace` collision was fixed in Phase 0.4; before that the readouts were 16px.
 */
export const STRIP = {
  toolbar: "38px",
  statusbar: "26px",
  tabbar: "36px",
  sidebarHeader: "34px",
  /** A document panel's own header. Was 30px in some panels and 32px in others. */
  panelHeader: "30px"
} as const;

export const ROW = {
  panelHeader: "26px",
  list: "22px"
} as const;

export const SIZE = {
  controlSm: "24px",
  controlMd: "30px",
  activitybar: "48px",
  activitybutton: "44px"
} as const;

/**
 * Icon sizes.
 *
 * Numbers, not CSS strings, because icons are sized through React props (`<Icon width=... />`) as
 * well as from stylesheets — the same split that `rowSizes.ts` exists for. `iconTokens()` emits the
 * px forms for CSS.
 *
 * The toolbar family previously used five unrelated sizes: 24 for run/pause, 20 for the secondary
 * controls, 18 for `SmallIconButton`, 16 in the status bars and 12 for the split-button chevron.
 * `xs` earns its place — the chevron sits in a 16px-wide button, where a 16px icon would fill it
 * edge to edge — so five values collapse to four deliberate steps rather than three forced ones.
 */
export const iconSizes = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24
} as const;

export type IconSizeKey = keyof typeof iconSizes;

/** M1: px, not em. Named by weight rather than by use so panels cannot re-litigate sizing. */
export const FONT_SIZE = {
  50: "10px",
  100: "11px",
  200: "12px",
  300: "13px",
  400: "15px"
} as const;

/**
 * M2: font-relative measures for tabular data.
 *
 * `--measure-gap` matches the `0.8ch` already used by `DisassemblyPanel` and `MemoryDumpSection`,
 * which were the only two places doing this correctly.
 */
export const MEASURE = {
  gap: "0.8ch",
  hex2: "2ch",
  hex4: "4ch",
  hex8: "8ch",
  label: "6ch",
  value: "9ch"
} as const;

/**
 * Elevation. Light needs shorter, tighter, lower-opacity shadows than dark — a shadow tuned for one
 * tone reads as dirt in the other, which is why this is one of the four hand-tuned exceptions to
 * deriving the light theme (§8.2).
 */
export const SHADOW = {
  dark: {
    1: "0 1px 2px rgb(0 0 0 / 40%)",
    2: "0 2px 8px rgb(0 0 0 / 45%)",
    3: "0 8px 24px rgb(0 0 0 / 55%)"
  },
  light: {
    1: "0 1px 2px rgb(20 25 35 / 8%)",
    2: "0 2px 8px rgb(20 25 35 / 12%)",
    3: "0 8px 24px rgb(20 25 35 / 16%)"
  }
} as const;

export const DURATION = {
  fast: "80ms",
  base: "140ms"
} as const;

export const EASE = {
  standard: "cubic-bezier(0.2, 0, 0.2, 1)",
  out: "cubic-bezier(0, 0, 0.2, 1)"
} as const;

/** Replaces the current ad-hoc `z-index: 10` / `z-index: 10000` pairing. */
export const Z = {
  splitter: "10",
  overlay: "100",
  menu: "1000",
  modal: "2000"
} as const;

/**
 * Emit the L3 scale as CSS custom properties.
 *
 * `tone` selects the shadow set; everything else is tone-independent.
 */
export function dimensionTokens(tone: "dark" | "light"): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(RADIUS)) out[`--radius-${k}`] = v;
  for (const [k, v] of Object.entries(STRIP)) out[`--strip-${k}`] = v;
  for (const [k, v] of Object.entries(ROW)) out[`--row-${k}`] = v;
  for (const [k, v] of Object.entries(SIZE)) out[`--size-${k}`] = v;
  for (const [k, v] of Object.entries(iconSizes)) out[`--icon-${k}`] = `${v}px`;
  for (const [k, v] of Object.entries(FONT_SIZE)) out[`--font-size-${k}`] = v;
  for (const [k, v] of Object.entries(MEASURE)) out[`--measure-${k}`] = v;
  for (const [k, v] of Object.entries(SHADOW[tone])) out[`--shadow-${k}`] = v;
  for (const [k, v] of Object.entries(DURATION)) out[`--duration-${k}`] = v;
  for (const [k, v] of Object.entries(EASE)) out[`--ease-${k}`] = v;
  for (const [k, v] of Object.entries(Z)) out[`--z-${k}`] = v;
  return out;
}

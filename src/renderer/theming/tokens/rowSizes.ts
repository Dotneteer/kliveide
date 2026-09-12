import { DEFAULT_PANEL_FONT_SIZE, getPanelFontSize } from "@common/settings/font-sizes";

/**
 * M3 — row heights that both CSS and JavaScript must agree on.
 *
 * `VirtualizedList` positions rows absolutely from an `itemSize` number, so a row height is not
 * purely a styling concern: if the CSS that draws a row and the number that places it disagree,
 * rows overlap or clip, and **no stylesheet change can fix it**.
 *
 * Before this module those numbers lived as private constants in the components that used them —
 * `MEMORY_ROW_ITEM_SIZE = 20` in `MemoryPanel.tsx`, `DISASSEMBLY_ROW_ITEM_SIZE = 18` in
 * `DisassemblyPanel.tsx` — with nothing tying them to the stylesheets. Changing the type scale would
 * have broken every virtualized panel silently.
 *
 * So this is the single source of truth, consumed two ways:
 *
 * - `ThemeProvider` emits it as `--row-size-*` custom properties for the stylesheets;
 * - the panels read `useRowSizes()` (in `theming/useRowSizes.ts`, which keeps React out of this
 *   layer) for their `itemSize`.
 *
 * **The heights are now a function of the panel font size**, not constants. A row must be tall
 * enough for its text, and the text size became a user setting (View | Panel Options | Font Size);
 * pinning the rows while the type moved is exactly the CSS/JS disagreement M3 exists to prevent,
 * only with the stylesheet and the virtualizer both wrong together. `ROW_SIZE_RATIOS` below holds
 * what the four constants used to be, expressed against the 12px they were chosen at, so the
 * default size reproduces 22/20/18/16 exactly and nothing moves for a user who never opens the
 * menu.
 */

/**
 * Each row height as a multiple of the panel font size.
 *
 * Ratios rather than fixed offsets, because the thing a row must contain — the line box — is itself
 * proportional to the type. A `+4px` offset reproduces today's numbers just as well at 12px but
 * fails at the top of the ladder: at 16px a monospace line box is ~21.3px against a 20px row, so
 * console output would clip. The ratios hold across the whole 10–16px range.
 */
export const ROW_SIZE_RATIOS = {
  /** Sidebar list rows: breakpoints, call stack, watch, system variables. 22px at 12px type. */
  list: 11 / 6,
  /** Memory dump rows — wider glyph runs, so slightly taller than disassembly. 20px at 12px. */
  memory: 5 / 3,
  /** Disassembly rows. The densest list in the app. 18px at 12px. */
  disassembly: 3 / 2,
  /**
   * Console lines — Output, Command, Script Output, Command Result.
   *
   * Unlike the three above, this is not a padded, hoverable UI row: it is exactly one line box of
   * monospace text and nothing else, so it sits at the bare line box (~4/3 of the type size) rather
   * than the padded floor the others need. `row-size-contract.test.ts` records that exception.
   *
   * It is here, rather than in the stylesheet, because `VirtualizedList` gets the same number as its
   * `itemSize` hint — which is precisely the CSS/JS pair M3 exists to keep together.
   */
  console: 4 / 3
} as const;

/**
 * The leading the panels render at, as a multiple of the panel font size.
 *
 * Identical to `console` above, and deliberately so: a console line *is* one line box. It has its
 * own name because it is applied as `line-height` to every data panel rather than as a row height
 * to one of them.
 *
 * Declaring this at all is the point. Left to `line-height: normal`, leading comes from the chosen
 * font's own metrics, and those vary far more than they look: 1.250em for Iosevka, 1.312em for Fira
 * Code, 1.320em for JetBrains Mono — and 0.885em for the ZX Spectrum face, whose glyphs sit in an
 * 8x8 cell with essentially no descent. In a `dense` row (`min-height: 0`, so the row *is* its line
 * box) that made the Z80 and ULA registers collapse onto each other the moment that font was
 * picked. Pinning the leading makes every font render the same rows at the same height.
 */
export const PANEL_LINE_HEIGHT_RATIO = ROW_SIZE_RATIOS.console;

/** The panel leading in whole pixels, for a given panel font size. */
export function getPanelLineHeight(panelFontSize: number = DEFAULT_PANEL_FONT_SIZE): number {
  return Math.round(getPanelFontSize(panelFontSize) * PANEL_LINE_HEIGHT_RATIO);
}

export type RowSizeKey = keyof typeof ROW_SIZE_RATIOS;

export type RowSizes = Record<RowSizeKey, number>;

/**
 * The row heights for a given panel font size, in whole pixels.
 *
 * Rounded, because `VirtualizedList` multiplies `itemSize` by an index to place a row absolutely: a
 * fractional height accumulates down the list until a row sits visibly off its own background.
 * @param panelFontSize The size the panels render their data at
 */
export function getRowSizes(panelFontSize: number = DEFAULT_PANEL_FONT_SIZE): RowSizes {
  const size = getPanelFontSize(panelFontSize);
  const out = {} as RowSizes;
  for (const [key, ratio] of Object.entries(ROW_SIZE_RATIOS) as [RowSizeKey, number][]) {
    out[key] = Math.round(size * ratio);
  }
  return out;
}

/**
 * The row heights at the default panel font size.
 *
 * Kept for the callers that genuinely have no access to the setting. Anything rendering inside the
 * app should use `useRowSizes()` instead, so it follows the user's choice.
 */
export const rowSizes: RowSizes = getRowSizes(DEFAULT_PANEL_FONT_SIZE);

/** Emit the row sizes as CSS custom properties so stylesheets and JS cannot drift apart. */
export function rowSizeTokens(
  panelFontSize: number = DEFAULT_PANEL_FONT_SIZE
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(getRowSizes(panelFontSize))) {
    out[`--row-size-${key}`] = `${value}px`;
  }
  out["--panel-line-height"] = `${getPanelLineHeight(panelFontSize)}px`;
  return out;
}

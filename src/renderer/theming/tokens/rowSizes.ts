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
 * - the panels import the numbers directly for `itemSize`.
 *
 * Values are px and must stay in step with `--font-size-*` in `dimensions.ts`. A row must be tall
 * enough for its text: at `--font-size-200` (12px) a monospace line box is ~16px, so 18px is the
 * practical floor for a single-line data row.
 */
export const rowSizes = {
  /** Sidebar list rows: breakpoints, call stack, watch, system variables. */
  list: 22,
  /** Memory dump rows — wider glyph runs, so slightly taller than disassembly. */
  memory: 20,
  /** Disassembly rows. The densest list in the app. */
  disassembly: 18
} as const;

export type RowSizeKey = keyof typeof rowSizes;

/** Emit the row sizes as CSS custom properties so stylesheets and JS cannot drift apart. */
export function rowSizeTokens(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(rowSizes)) {
    out[`--row-size-${key}`] = `${value}px`;
  }
  return out;
}

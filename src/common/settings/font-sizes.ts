/**
 * THE single registry of the font sizes Klive offers, the counterpart to `monospace-fonts.ts`.
 *
 * Two ladders, because the two surfaces are not the same kind of text:
 *   - `editorOptions.fontSize` -> View | Editor Options | Font Size. Prose-sized code you read a
 *     line at a time, so it climbs to 24px.
 *   - `panelOptions.fontSize`  -> View | Panel Options | Font Size. Dense tabular data - hex dumps,
 *     register banks, disassembly - where the point is how many rows and columns fit at once. It
 *     stays between 10 and 16px, and 12px (the value the panels have always rendered at) is the
 *     middle rung.
 *
 * The panel ladder stops at 16px deliberately: the strip and row heights in
 * `renderer/theming/tokens/dimensions.ts` are absolute pixels, and a larger size starts to crowd
 * `--row-list` (22px). Column widths need no such care - they are `ch`, so they track the size on
 * their own.
 *
 * Both menus are built from here by `createFontSizeMenu` in `main/app-menu.ts`, so a rung added
 * here shows up in the menu with nothing else to change.
 */

export type FontSizeOption = {
  /** Label shown in the menu. */
  label: string;
  /** Size in pixels, persisted in the settings file. */
  value: number;
};

/** The editor's ladder. `Medium` matches the 16px Monaco has always defaulted to. */
export const EDITOR_FONT_SIZES: FontSizeOption[] = [
  { label: "Smallest", value: 12 },
  { label: "Small", value: 14 },
  { label: "Medium", value: 16 },
  { label: "Large", value: 20 },
  { label: "Largest", value: 24 }
];

/** The panels' ladder. `Medium` is 12px, what every data panel rendered at before it was settable. */
export const PANEL_FONT_SIZES: FontSizeOption[] = [
  { label: "Smallest", value: 10 },
  { label: "Small", value: 11 },
  { label: "Medium", value: 12 },
  { label: "Large", value: 14 },
  { label: "Largest", value: 16 }
];

/** 16px: Monaco's own default, and what the editor rendered at before the setting existed. */
export const DEFAULT_EDITOR_FONT_SIZE = 16;

/**
 * 12px: the size `--font-size-200` gave every data panel before this became a setting, chosen back
 * then so that 1ch is exactly 6px. Keeping it as the default means no panel moves on upgrade.
 */
export const DEFAULT_PANEL_FONT_SIZE = 12;

/**
 * Clamps a stored panel size to the ladder above. A settings file can carry anything - hand-edited,
 * or written by a future version with a wider ladder - and an out-of-range value would either
 * collapse the rows or overflow them, so an unrecognised size falls back to the default rather than
 * being applied verbatim.
 */
export function getPanelFontSize(value: unknown): number {
  return PANEL_FONT_SIZES.some((s) => s.value === value)
    ? (value as number)
    : DEFAULT_PANEL_FONT_SIZE;
}

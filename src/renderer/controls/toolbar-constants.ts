import { iconSizes } from "@renderer/theming/tokens/dimensions";

/**
 * Shared toolbar metrics.
 *
 * `SECONDARY_ICON_SIZE` was declared independently in `Toolbar.tsx`, `ExecutionControls.tsx` and
 * `ViewControls.tsx` — three copies of the same number in components that render each other. It now
 * comes from the icon scale, so the toolbar cannot drift from the rest of the app.
 *
 * It lives here rather than in `Toolbar.tsx` because `ExecutionControls` and `ViewControls` are
 * rendered *by* `Toolbar`, which would make the import graph circular.
 */
export const SECONDARY_ICON_SIZE = iconSizes.sm;

/**
 * The run/debug split button's glyph: one step above the secondary icons, so the primary action
 * still reads as the primary one.
 */
export const PRIMARY_ICON_SIZE = iconSizes.md;

/**
 * The content box of every toolbar `IconButton` (its 1px padding adds 4px across and 2px down).
 * Icons and boxes were shrunk together by 20% (20px icons in 30px boxes became 16px in 24px) so
 * more buttons fit in the strip; a smaller glyph in the old box would have saved no width at all.
 */
export const TOOLBAR_BUTTON_SIZE = 24;

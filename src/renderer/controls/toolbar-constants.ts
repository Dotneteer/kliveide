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
export const SECONDARY_ICON_SIZE = iconSizes.md;

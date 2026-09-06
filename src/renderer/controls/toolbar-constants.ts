/**
 * Shared toolbar metrics.
 *
 * `SECONDARY_ICON_SIZE` was declared independently in `Toolbar.tsx`, `ExecutionControls.tsx` and
 * `ViewControls.tsx` — three copies of the same number in components that render each other.
 * It lives here because `ExecutionControls` and `ViewControls` are rendered *by* `Toolbar`, so
 * exporting it from `Toolbar.tsx` would make the import graph circular.
 *
 * Superseded by the `--icon-*` scale in Phase 5 of .plans/UI_MODERNIZATION_PLAN.md, which collapses
 * the toolbar's five icon sizes (24/20/18/16/12) onto three tokens.
 */
export const SECONDARY_ICON_SIZE = 20;

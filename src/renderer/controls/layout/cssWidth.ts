/**
 * Legacy px width for the `controls/layout` cell wrappers.
 *
 * `controls/data`'s cells read a bare number as `ch` (M2). These wrappers cannot: 21 files import
 * them and seven call sites pass a bare number meaning **px**, so reading those as `ch` would
 * silently inflate a `width={160}` instruction column to 960px — a change no test outside
 * `LayoutPrimitives` would have caught.
 *
 * The number therefore stays px here while the tabular call sites move to explicit `ch` strings.
 * When none are left, this helper and the number half of the `width` prop go with it.
 */
export const cssWidth = (width?: string | number): string | undefined =>
  width === undefined ? undefined : typeof width === "number" ? `${width}px` : width;

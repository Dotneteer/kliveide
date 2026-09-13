import type { Tone } from "./palette";

/**
 * The tokens that survive the token layer.
 *
 * Of the 201 values the two theme files used to carry, 188 are now produced by L2/L3 or aliased onto
 * them by `componentAliases.ts`. These are the remainder — the ones that are not colours in the
 * semantic sense and so have nothing to derive from:
 *
 * - the four platform font stacks;
 * - the six breakpoint glyphs, which are data-URI SVGs with their fills baked into the markup;
 * - `--padding-tooltip`, a composite padding shorthand.
 *
 * All of the above are identical in both tones, which is why they live here rather than in a
 * per-theme file. Only one value still genuinely differs by tone, and it is in `toneTokens()`
 * below.
 *
 * This is what §8.2 meant by light no longer being hand-authored: there is no longer a
 * `light-theme.ts` to drift out of step with its dark counterpart.
 */
export const staticTokens: Record<string, string> = {
  // --- Font stacks ------------------------------------------------------------------------------
  "--shell-font-family":
    "Inter, -apple-system, BlinkMacSystemFont, Helvetica, Neue-Light, Ubuntu, Droid Sans, sans-serif",
  "--shell-windows-font-family": "Inter, Segoe WPC, Segoe UI, sans-serif",
  // --- There is deliberately no monospace stack here. `--monospace-font` is resolved in
  // --- ThemeProvider from the user's View | Panel Font setting against the shared registry in
  // --- @common/settings/monospace-fonts, which supplies its own bundled-Iosevka fallback.

  // --- Tooltip padding --------------------------------------------------------------------------
  "--padding-tooltip": "0.25em 0.5em",

  // --- Breakpoint glyphs ------------------------------------------------------------------------
  // Data-URI SVGs used as CSS `background-image` in the editor's glyph margin. Their fills are baked
  // into the markup and cannot reference a custom property, so they stay literal. Phase 8 revisits
  // them alongside the Monaco palette.
  "--image-breakpoint-current": `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="rgb(245, 245, 67)"><path d="M21.75 10.725l-6.39-7.11-1.11-0.83H6.375L4.5 4.875v14.22l1.875 1.875h7.59l1.395-0.63 6.39-7.11v-1.065zm-7.785 8.37H6.375V4.875h7.59l6.39 7.11-6.39 7.11z"/></svg>')`,
  "--image-breakpoint-current-existing": `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="rgb(245, 245, 67)"><circle cx="12" cy="12" r="4" fill="red"/><path d="M21.75 10.725l-6.39-7.11-1.11-0.83H6.375L4.5 4.875v14.22l1.875 1.875h7.59l1.395-0.63 6.39-7.11v-1.065zm-7.785 8.37H6.375V4.875h7.59l6.39 7.11-6.39 7.11z"/></svg>')`,
  "--image-breakpoint-current-existing-bin": `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="rgb(245, 245, 67)"><circle cx="12" cy="12" r="4" fill="rgb(41, 184, 219)"/><path d="M21.75 10.725l-6.39-7.11-1.11-0.83H6.375L4.5 4.875v14.22l1.875 1.875h7.59l1.395-0.63 6.39-7.11v-1.065zm-7.785 8.37H6.375V4.875h7.59l6.39 7.11-6.39 7.11z"/></svg>')`,
  "--image-breakpoint-macro": `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="24" height="24" fill="rgb(120, 224, 67)"><path d="M1.5 2l-.5.5v11l.5.5H4v-1H2V3h2V2H1.5zm13 12l.5-.5v-11l-.5-.5H12v1h2v10h-2v1h2.5z"/></svg>')`,
  "--image-breakpoint-macro-existing": `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="24" height="24" fill="rgb(120, 224, 67)"><circle cx="8" cy="8" r="3" fill="red"/><path d="M1.5 2l-.5.5v11l.5.5H4v-1H2V3h2V2H1.5zm13 12l.5-.5v-11l-.5-.5H12v1h2v10h-2v1h2.5z"/></svg>')`,
  "--image-breakpoint-macro-existing-bin": `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="24" height="24" fill="rgb(120, 224, 67)"><circle cx="8" cy="8" r="3" fill="rgb(41, 184, 219)"/><path d="M1.5 2l-.5.5v11l.5.5H4v-1H2V3h2V2H1.5zm13 12l.5-.5v-11l-.5-.5H12v1h2v10h-2v1h2.5z"/></svg>')`
};

/**
 * The one value that still differs by tone and is not derivable from the neutral ramp.
 *
 * The backdrop is an alpha wash over whatever is behind it, so it needs a different opacity per
 * tone rather than a different colour.
 *
 * `--bgimage-modal-header` used to live here: a 1px/3px scanline over the dialog header. It was the
 * only texture of its kind left in the app, and it was doing real work by accident — in the light
 * tone the header, the body and the footer all resolved to `#ffffff`, so a 2%-opacity stripe was the
 * only thing separating them. The header now takes `--surface-chrome`, which is a different value
 * from the body in both tones, and the texture has nothing left to hide.
 */
export function toneTokens(tone: Tone): Record<string, string> {
  return tone === "dark"
    ? { "--bgcolor-backdrop": "#00000080" }
    : { "--bgcolor-backdrop": "#00000040" };
}

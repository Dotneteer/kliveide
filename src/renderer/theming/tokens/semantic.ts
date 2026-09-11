import { ACCENTS, ANSI, DEVICE, NEUTRAL, STATUS, type AccentId, type Tone, DEVICE_INK } from "./palette";

/**
 * L2 — semantics.
 *
 * The vocabulary components are meant to read: names that say what a colour *means*, not what it
 * looks like. This is the layer that makes tone and accent independent axes — a component asking
 * for `--surface-panel` or `--accent-solid` keeps working when either axis changes.
 *
 * Everything here is derived from L1. No literal colours below this line except the two alpha
 * washes, which have to be composed at use time.
 */

/** Mix a hex colour with an alpha channel, for washes that must sit over an unknown surface. */
function alpha(hex: string, pct: number): string {
  return `${hex}${Math.round((pct / 100) * 255)
    .toString(16)
    .padStart(2, "0")}`;
}

export function semanticTokens(tone: Tone, accentId: AccentId): Record<string, string> {
  const n = NEUTRAL[tone];
  const s = STATUS[tone];
  const accent = ACCENTS[accentId];
  const solid = accent.solid[tone];
  const secondary = accent.secondary[tone];

  return {
    // --- Surfaces ------------------------------------------------------------------------------
    "--surface-canvas": n.canvas,
    "--surface-chrome": n.chrome,
    "--surface-panel": n.panel,
    "--surface-raised": n.raised,
    "--surface-overlay": n.overlay,
    "--surface-hover": n.hover,
    "--surface-active": n.active,
    "--surface-selected": n.selected,
    /**
     * The ground the emulated machine sits on.
     *
     * It must stay clearly *lighter* than `--device-bezel`, or the screen disappears into its own
     * surround — which is exactly what happened on the first pass, when both landed near #0f10xx.
     * The original design had the same relationship (a #404040 screen on a #606060 area); this keeps
     * it while dropping the overall brightness.
     *
     * In light it stays recessed relative to `panel`, so a dark device does not sit on a glaring
     * white field (§8.2.1).
     */
    "--surface-stage": tone === "dark" ? "#2a2d32" : "#c8ccd2",

    /**
     * The band behind a collapsible panel header.
     *
     * Two stops, painted as a shallow top-lit gradient: `-lit` is the top edge, `-header` the
     * bottom. A flat fill at this size reads as a *selected row* — the sidebar's list rows are the
     * same height and also highlight on hover — whereas a lit strip reads as chrome. That
     * distinction is the whole point of the band, so it is expressed here rather than left to
     * whichever stylesheet happens to draw it.
     *
     * It cannot reuse `--surface-raised`, which is the obvious candidate: "raised" means *lighter*,
     * and that is only correct in dark. In light, `raised` is pure white — lighter than the panel
     * it would sit on — so the band would read as a hole rather than a ridge. A header band is
     * lighter than its panel in dark and *darker* in light, which is why it needs its own name.
     *
     * In both tones the top stop is the lighter of the pair, so the implied light source is
     * consistent between them.
     */
    "--surface-header": tone === "dark" ? n.raised : n.hover,
    "--surface-header-lit": tone === "dark" ? n.hover : n.chrome,
    "--surface-header-hover": tone === "dark" ? n.hover : n.active,
    "--surface-header-lit-hover": tone === "dark" ? n.active : n.hover,

    // --- Text ----------------------------------------------------------------------------------
    "--text-primary": n.text,
    "--text-secondary": n.textSecondary,
    "--text-tertiary": n.textTertiary,
    "--text-disabled": n.textDisabled,
    "--text-on-accent": accent.onSolid[tone],
    "--text-on-accent-secondary": accent.onSecondary[tone],

    // --- Borders -------------------------------------------------------------------------------
    "--border-subtle": n.borderSubtle,
    "--border-default": n.border,
    "--border-strong": n.borderStrong,

    // --- Accent --------------------------------------------------------------------------------
    "--accent-solid": solid,
    "--accent-solid-hover": alpha(solid, 88),
    /** Wash for selected rows and current-line highlights. */
    "--accent-subtle": alpha(solid, 18),
    "--accent-border": alpha(solid, 55),
    "--accent-text": solid,
    /**
     * A softer accent for text that should read as accent-tinted without competing with
     * `--accent-text` for attention - e.g. the memory dump's character column, sitting beside its
     * accent-solid address column (§ memory dump colour, below `--data-*`).
     *
     * This is alpha over the panel's own (dark) surface, so it is not just "a dimmer accent" - the
     * surface shows through the transparent remainder, and 65% read as too dark/muddy to be legible
     * body text at a normal reading size. 85% keeps it visibly softer than full-strength
     * `--accent-text` while staying close to the accent's own true brightness.
     */
    "--accent-text-subtle": alpha(solid, 85),
    /** One focus treatment for the whole app; nothing should invent its own. */
    "--focus-ring": alpha(solid, 70),

    /*
     * A second hue for the same accent - see `AccentDef.secondary` in palette.ts. Same six-level
     * shape as `--accent-*` above, generated the same way, so a consumer of one already knows the
     * other. For the moments the primary and its shades run out of contrast to spend against each
     * other - e.g. a hovered byte needs to read as distinct from the address column beside it,
     * which already claims the primary.
     */
    "--accent-secondary-solid": secondary,
    "--accent-secondary-solid-hover": alpha(secondary, 88),
    "--accent-secondary-subtle": alpha(secondary, 18),
    "--accent-secondary-border": alpha(secondary, 55),
    "--accent-secondary-text": secondary,
    "--accent-secondary-text-subtle": alpha(secondary, 85),

    // --- Status --------------------------------------------------------------------------------
    // Fixed across accents on purpose: an error must look like an error whichever accent is chosen.
    "--status-error": s.error,
    "--status-warning": s.warning,
    "--status-success": s.success,
    "--status-info": s.info,
    "--status-error-subtle": alpha(s.error, 18),
    "--status-warning-subtle": alpha(s.warning, 18),
    "--status-success-subtle": alpha(s.success, 18),

    // --- Data panels ---------------------------------------------------------------------------
    /**
     * A contrast *hierarchy* rather than three competing hues (§5.2).
     *
     * The register panels used to carry an amber label, a blue value and a green secondary label —
     * three saturated colours in the densest part of the UI. That is what made an orange accent
     * impossible and left the old Deep Cyan indistinguishable from the register values.
     *
     * Now the value is the most legible thing in the row, the label recedes, and colour is freed to
     * mean *state*: `--data-changed` marks what moved since the last stop, which is the signal a
     * debugger actually wants and which Klive did not previously express at all.
     */
    "--data-value": n.text,
    "--data-label": n.textSecondary,
    "--data-secondary": n.textTertiary,
    "--data-changed": solid,
    "--data-changed-bg": alpha(solid, 18),

    // --- ANSI console ---------------------------------------------------------------------------
    ...Object.fromEntries(
      Object.entries(ANSI[tone]).map(([k, v]) => [
        k === "default" || k === "lineNo" ? `--console-${k}` : `--console-ansi-${k}`,
        v
      ])
    ),

    // --- Device surfaces (theme-invariant, §8.2.1) ---------------------------------------------
    "--device-bezel": DEVICE.bezel,
    "--device-body": DEVICE.body,
    "--device-key": DEVICE.key,
    "--device-key-raise": DEVICE.keyRaise,
    "--device-key-128": DEVICE.key128,
    "--device-legend-main": DEVICE.legendMain,
    "--device-legend-symbol": DEVICE.legendSymbol,
    "--device-legend-above": DEVICE.legendAbove,
    "--device-legend-below": DEVICE.legendBelow,
    ...Object.fromEntries(
      Object.entries(DEVICE_INK).map(([k, v]) => [`--device-ink-${k.toLowerCase()}`, v])
    )
  };
}

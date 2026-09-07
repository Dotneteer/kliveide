/**
 * L1 — primitives.
 *
 * Raw colour values, and the only place in the app where a literal colour may be written. Nothing
 * outside `tokens/` should import from here: components read the L2 semantic names produced by
 * `semantic.ts`, which is what makes the accent and tone axes swappable.
 *
 * See §3 and §5 of .plans/UI_MODERNIZATION_PLAN.md.
 */

import { ACCENT_IDS, DEFAULT_ACCENT, isAccentId, type AccentId } from "@common/theming/accents";

export { ACCENT_IDS, DEFAULT_ACCENT, isAccentId };
export type { AccentId };

export type Tone = "dark" | "light";

// ---------------------------------------------------------------------------------------------
// Neutral ramp
// ---------------------------------------------------------------------------------------------

/**
 * The neutral ramp, slightly cool so it sits under any of the accents without turning muddy.
 *
 * Steps are roles, not shades, and they mean the same thing in both tones even though the values
 * run in opposite directions. That is what lets the light tone be derived rather than hand-authored
 * (§8.2): a component asks for `canvas` or `border`, never for "the light grey one".
 */
export type NeutralRamp = {
  /** Window ground — the darkest surface in dark, the lightest in light. */
  canvas: string;
  /** Toolbar, activity bar, status bar. */
  chrome: string;
  /** Sidebar and tool area. */
  panel: string;
  /** Active tab, popovers, menus — a surface that reads as lifted. */
  raised: string;
  /** Modals and anything above the backdrop. */
  overlay: string;
  hover: string;
  active: string;
  selected: string;
  /** Barely-there division inside a single surface. */
  borderSubtle: string;
  /** Real separation between two surfaces. */
  border: string;
  /** Input outlines and focus-adjacent edges. */
  borderStrong: string;
  /** Body text at full contrast. */
  text: string;
  /** Labels and supporting text. */
  textSecondary: string;
  /** Annotations; still AA against `panel`. */
  textTertiary: string;
  /** Text that has been switched off. Deliberately below AA — it must read as unavailable. */
  textDisabled: string;
};

export const NEUTRAL: Record<Tone, NeutralRamp> = {
  dark: {
    canvas: "#141517",
    chrome: "#1b1d21",
    panel: "#17191c",
    raised: "#202329",
    overlay: "#22262d",
    hover: "#24272e",
    active: "#2a2e36",
    selected: "#2a2e36",
    borderSubtle: "#24272b",
    border: "#2e3238",
    borderStrong: "#3d424a",
    text: "#e4e6ea",
    textSecondary: "#949aa4",
    textTertiary: "#7f8690",
    textDisabled: "#5a606a"
  },
  light: {
    canvas: "#ffffff",
    chrome: "#f1f2f4",
    panel: "#f7f8f9",
    raised: "#ffffff",
    overlay: "#ffffff",
    hover: "#e8eaee",
    active: "#e2e6ec",
    selected: "#e2e6ec",
    borderSubtle: "#e5e7ea",
    border: "#d5d8dd",
    borderStrong: "#b9bec6",
    text: "#1b1d21",
    textSecondary: "#565c65",
    textTertiary: "#6b717a",
    textDisabled: "#9aa0a8"
  }
};

// ---------------------------------------------------------------------------------------------
// Accents
// ---------------------------------------------------------------------------------------------

export type AccentDef = {
  id: AccentId;
  /** Shown in the View -> Accent menu. */
  label: string;
  solid: Record<Tone, string>;
  /** Foreground for text placed *on* `solid`. */
  onSolid: Record<Tone, string>;
};

/**
 * The six shipped accents (§5.3).
 *
 * Every value clears WCAG AA 4.5:1 against its own canvas, and every one is held clear of the hues
 * Klive's data panels use for meaning. Two of the six were retuned specifically for that: Deep Teal
 * was pulled off the register-value blue, and Phosphor Green off the secondary-label green. Amber
 * was dropped outright — at hue 38 it *was* the register-label colour.
 *
 * Do not add an accent without re-running the checks in `test/theming/token-contract.test.ts`.
 */
export const ACCENTS: Record<AccentId, AccentDef> = {
  sinclairBlue: {
    id: "sinclairBlue",
    label: "Sinclair Blue",
    // Today's #007acc, brightened because the original is 4.05:1 on dark and fails AA.
    solid: { dark: "#45A5E6", light: "#0A6FB8" },
    onSolid: { dark: "#0e0f11", light: "#ffffff" }
  },
  spectrumMagenta: {
    id: "spectrumMagenta",
    label: "Spectrum Magenta",
    solid: { dark: "#C264D6", light: "#9B2FB4" },
    onSolid: { dark: "#0e0f11", light: "#ffffff" }
  },
  ember: {
    id: "ember",
    label: "Ember",
    // Gold rather than orange: true orange sits on top of the warning hue whatever we do.
    solid: { dark: "#FFC933", light: "#8A6A00" },
    onSolid: { dark: "#0e0f11", light: "#ffffff" }
  },
  ultraviolet: {
    id: "ultraviolet",
    label: "Ultraviolet",
    solid: { dark: "#A78AF5", light: "#6340C8" },
    onSolid: { dark: "#0e0f11", light: "#ffffff" }
  },
  deepTeal: {
    id: "deepTeal",
    label: "Deep Teal",
    solid: { dark: "#2FC2BE", light: "#0A7D78" },
    onSolid: { dark: "#0e0f11", light: "#ffffff" }
  },
  phosphorGreen: {
    id: "phosphorGreen",
    label: "Phosphor Green",
    solid: { dark: "#76C842", light: "#3B7A16" },
    onSolid: { dark: "#0e0f11", light: "#ffffff" }
  }
};

// ---------------------------------------------------------------------------------------------
// Status hues
// ---------------------------------------------------------------------------------------------

/**
 * Colours that carry meaning. These are deliberately *not* part of the accent axis: an error must
 * look like an error whichever accent is selected.
 *
 * `warning` is a red-orange (hue ~20) rather than the amber it used to be, so that it stays
 * distinguishable from the Ember accent and from the register-label colour.
 */
export const STATUS: Record<Tone, Record<"error" | "warning" | "success" | "info", string>> = {
  dark: {
    error: "#f0566b",
    warning: "#E8703A",
    success: "#4ec98a",
    info: "#45A5E6"
  },
  light: {
    error: "#c8253f",
    warning: "#A03F0C",
    success: "#1a8f52",
    info: "#0A6FB8"
  }
};

// ---------------------------------------------------------------------------------------------
// Device surfaces
// ---------------------------------------------------------------------------------------------

/**
 * Theme-invariant surfaces (§8.2.1).
 *
 * The emulated machine is hardware, and hardware has no light mode: a dark Spectrum framed by light
 * chrome reads correctly as a device on a desk. These values are identical in both tones, which is
 * also why the keyboard's 18 colours no longer need a light/dark pair each.
 *
 * The ground the device *sits on* is not here — that follows the theme, and lives in `semantic.ts`
 * as `--surface-stage`.
 */
export const DEVICE = {
  /** Frame around the emulator screen. */
  bezel: "#0f1012",
  /** Keyboard panel ground. */
  body: "#181818",
  key: "#707070",
  keyRaise: "#303030",
  key128: "#1c1c1c",
  legendMain: "#e0e0e0",
  legendSymbol: "#c00000",
  legendAbove: "#00a000",
  legendBelow: "#d02000"
} as const;

/**
 * The Spectrum's INK legends printed above the number keys.
 *
 * These are the machine's own eight colours plus the two greys used for BRIGHT/FLASH, and they were
 * nine hex literals inline in `Sp48Keyboard.tsx` — the keyboard equivalent of the emulator overlays
 * hardcoding `#303030`. Theme-invariant like every other `--device-*` value (§8.2.1): the legends
 * are printed on the case, and print does not have a light mode.
 */
export const DEVICE_INK = {
  blue: "#0030ff",
  red: "#ff0000",
  magenta: "#e000e0",
  green: "#00c000",
  cyan: "#00c0c0",
  yellow: "#fff000",
  white: "#ffffff",
  grey: "#a0a0a0",
  greyDark: "#505050"
} as const;

// ---------------------------------------------------------------------------------------------
// ANSI console palette
// ---------------------------------------------------------------------------------------------

/**
 * The 16 ANSI colours plus the console default.
 *
 * These are a fixed, externally-defined palette — a program emitting ANSI red expects red — so they
 * are authored per tone rather than derived. `default` is the console's own foreground: it was
 * missing from the light theme entirely until Phase 0.3, which left light-mode console text with no
 * colour at all.
 */
export const ANSI: Record<Tone, Record<string, string>> = {
  dark: {
    black: "#000000", red: "#cd3131", green: "#0DBC79", yellow: "#e5e510",
    blue: "#2472c8", magenta: "#bc3fbc", cyan: "#11a8cd", white: "#e5e5e5",
    "bright-black": "#666666", "bright-red": "#f14c4c", "bright-green": "#23d18b",
    "bright-yellow": "#f5f543", "bright-blue": "#3b8eea", "bright-magenta": "#d670d6",
    "bright-cyan": "#29b8db", "bright-white": "#e5e5e5",
    default: "#e5e5e5", lineNo: "#808080"
  },
  light: {
    black: "#000000", red: "#cd3131", green: "#00BC00", yellow: "#949800",
    blue: "#0451a5", magenta: "#bc05bc", cyan: "#0598bc", white: "#e5e5e5",
    "bright-black": "#666666", "bright-red": "#cd3131", "bright-green": "#14CE14",
    "bright-yellow": "#b5ba00", "bright-blue": "#0451a5", "bright-magenta": "#bc05bc",
    "bright-cyan": "#0598bc", "bright-white": "#a5a5a5",
    default: "#202020", lineNo: "#808080"
  }
};

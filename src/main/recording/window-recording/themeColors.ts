import type { Rgb } from "./pointer";
import type { ComposerColors } from "./FrameComposer";

/**
 * The recording's colours come from the IDE's theme tokens, read once when a recording starts
 * (plan §4.3, §4.4.1), so they follow the user's theme and accent without a colour literal here.
 *
 * - fill (the area neither window covers): `--surface-canvas`
 * - left / middle button rings: `--accent-solid`
 * - right button rings: `--accent-secondary-solid`
 */
export const THEME_COLOR_TOKENS = {
  fill: "--surface-canvas",
  primary: "--accent-solid",
  secondary: "--accent-secondary-solid"
} as const;

/**
 * Script run in the IDE page: finds the element the ThemeProvider sets the tokens on (its inline
 * style carries them) and returns their computed values.
 */
export const READ_THEME_COLORS_SCRIPT = `(() => {
  const names = ${JSON.stringify(Object.values(THEME_COLOR_TOKENS))};
  const root = document.querySelector('[style*="${THEME_COLOR_TOKENS.primary}"]') || document.documentElement;
  const style = getComputedStyle(root);
  const result = {};
  for (const name of names) result[name] = style.getPropertyValue(name).trim();
  return result;
})()`;

/** Parses "#rgb", "#rrggbb", "#rrggbbaa" and "rgb()/rgba()" values; undefined when not a colour */
export function parseCssColor(value: string | undefined): Rgb | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(v);
  if (m) {
    const [r, g, b] = m[1].split("").map((c) => parseInt(c + c, 16));
    return { r, g, b };
  }
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(v);
  if (m) {
    return {
      r: parseInt(m[1].slice(0, 2), 16),
      g: parseInt(m[1].slice(2, 4), 16),
      b: parseInt(m[1].slice(4, 6), 16)
    };
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(v);
  if (m) {
    const clamp = (s: string) => Math.max(0, Math.min(255, Math.round(parseFloat(s))));
    return { r: clamp(m[1]), g: clamp(m[2]), b: clamp(m[3]) };
  }
  return undefined;
}

/*
 * Used only when the IDE page cannot be read (it is still loading, or the script fails): plain
 * black, white and mid-grey, so a recording never fails for want of a colour.
 */
const FALLBACK: ComposerColors = {
  fill: { r: 0, g: 0, b: 0 },
  primary: { r: 255, g: 255, b: 255 },
  secondary: { r: 160, g: 160, b: 160 }
};

/** Turns the values read by `READ_THEME_COLORS_SCRIPT` into the composer's colours */
export function toComposerColors(values: Record<string, string> | undefined): ComposerColors {
  return {
    fill: parseCssColor(values?.[THEME_COLOR_TOKENS.fill]) ?? FALLBACK.fill,
    primary: parseCssColor(values?.[THEME_COLOR_TOKENS.primary]) ?? FALLBACK.primary,
    secondary: parseCssColor(values?.[THEME_COLOR_TOKENS.secondary]) ?? FALLBACK.secondary
  };
}

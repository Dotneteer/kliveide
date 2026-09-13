import { ACCENTS, NEUTRAL, STATUS, type Tone } from "./palette";
import type { AccentId } from "@common/theming/accents";

/**
 * The Monaco syntax palette (§8.1).
 *
 * Before this, 146 colour literals were spread across seven language providers — VS Code's Dark+
 * and Light+ values, copied per language. Two consequences: the editor, the largest surface in the
 * IDE, was visibly not part of the same design as everything around it; and adding a language meant
 * hand-copying a palette, so the seven had already drifted from each other.
 *
 * Here the colours are **generated** from the same ramps as the rest of the app and **follow the
 * active accent**, so switching accent restyles the editor rather than just the chrome.
 *
 * The per-language *structure* is untouched: each provider keeps its Monarch grammar and its token
 * names. Only the mapping from token name to colour lives here.
 */

// ---------------------------------------------------------------------------------------------
// Colour maths
// ---------------------------------------------------------------------------------------------

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16)
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const to = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h, s, l };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 };
  const hue = (t0: number) => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return { r: hue(h + 1 / 3) * 255, g: hue(h) * 255, b: hue(h - 1 / 3) * 255 };
}

function adjust(hex: string, { dl = 0, ds = 0 }: { dl?: number; ds?: number }): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  return rgbToHex(
    hslToRgb({
      h: hsl.h,
      s: Math.min(1, Math.max(0, hsl.s + ds)),
      l: Math.min(1, Math.max(0, hsl.l + dl))
    })
  );
}

function channelLuminance(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/**
 * Hue (0-360) and saturation (0-1) of a colour.
 *
 * Exported for the palette tests: "these two colours differ" is not a useful assertion — two colours
 * four degrees apart pass a `!==` check and are indistinguishable on screen, which is how the
 * previous all-one-hue scheme passed its own adjacency test. The tests assert hue *separation*, and
 * a saturation floor on comments.
 */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const hsl = rgbToHsl(hexToRgb(hex));
  return { h: hsl.h * 360, s: hsl.s, l: hsl.l };
}

/**
 * Perceptual distance between two colours (CIE76 dE on CIELAB).
 *
 * Hue alone is the wrong measure for this palette: the accent is a blue, so keywords, operands and
 * functions are legitimately in one hue family and separate by lightness and chroma instead. A
 * hue-only assertion would either fail that valid design or, set loose enough to pass it, would also
 * pass two colours four degrees apart — which is how the previous all-one-hue scheme satisfied its
 * own adjacency test. Distance accounts for all three channels at once.
 *
 * Rule of thumb used by the tests: dE > 20 reads as clearly different text on screen.
 */
export function colourDistance(a: string, b: string): number {
  const lab = (hex: string) => {
    const { r, g, b: bl } = hexToRgb(hex);
    const lin = (c: number) => {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    const [rl, gl, bll] = [lin(r), lin(g), lin(bl)];
    const x = (rl * 0.4124 + gl * 0.3576 + bll * 0.1805) / 0.95047;
    const y = rl * 0.2126 + gl * 0.7152 + bll * 0.0722;
    const z = (rl * 0.0193 + gl * 0.1192 + bll * 0.9505) / 1.08883;
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const [fx, fy, fz] = [f(x), f(y), f(z)];
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  };
  const [la, lb] = [lab(a), lab(b)];
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
}

/** WCAG 2.1 contrast ratio between two opaque colours. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Push a colour away from the background until it clears `target`.
 *
 * Six accents times two tones is twelve palettes, and a hand-checked palette is only correct until
 * someone adds a thirteenth. Deriving the colour and then *proving* the ratio is what makes an
 * accent-following syntax scheme safe to ship: the same approach §5 used for the UI accents, where
 * the naive first attempt produced accents that were perceptually identical to the data colours.
 */
function ensureContrast(colour: string, background: string, target: number): string {
  const lighten = relativeLuminance(background) < 0.5;
  let out = colour;
  for (let i = 0; i < 100 && contrastRatio(out, background) < target; i++) {
    out = adjust(out, { dl: lighten ? 0.01 : -0.01 });
  }
  return out;
}

/**
 * Push a colour away from another until they are perceptually distinct.
 *
 * The palette pairs a fixed hue table with a keyword colour that follows the accent, and those two
 * can collide: with the Ultraviolet accent the keyword is `#6340C8` in light, which is *exactly* the
 * lavender the table assigns to numbers — dE 0. A fixed table cannot anticipate six accents, so the
 * collision is resolved the same way contrast is: mechanically, and then asserted by a test.
 *
 * Lightness is the axis used, in the same direction `ensureContrast` moves, so pushing a colour away
 * from the accent also pushes it away from the background rather than fighting it. Hue is left
 * alone, which keeps a lavender recognisably lavender instead of rotating it into whatever the
 * neighbouring class already owns.
 */
function ensureDistinct(colour: string, from: string, minDistance: number, tone: Tone): string {
  const lighten = tone === "dark";
  let out = colour;
  for (let i = 0; i < 60 && colourDistance(out, from) < minDistance; i++) {
    out = adjust(out, { dl: lighten ? 0.01 : -0.01 });
  }
  return out;
}

/** Below this, two colours of text read as the same colour on screen. */
const MIN_CLASS_DISTANCE = 22;

// ---------------------------------------------------------------------------------------------
// The palette
// ---------------------------------------------------------------------------------------------

/**
 * The classes a syntax token can belong to.
 *
 * §8.1 named eight; the seven grammars between them use 36 distinct Monaco token names, and three of
 * those did not fit any of the eight — functions, type names and punctuation are all real, frequent
 * and visually distinct roles in these languages. Adding them was cheaper than forcing `macro` to
 * be a keyword and `delimiter` to be an operand.
 */
export type SyntaxClass =
  | "keyword"
  | "directive"
  | "label"
  | "type"
  | "function"
  | "operand"
  | "number"
  | "string"
  | "comment"
  | "punctuation"
  | "error";

export type SyntaxStyle = {
  /** Monaco wants bare hex with no leading `#`. */
  foreground: string;
  fontStyle?: string;
};

/** Text must clear this against the editor background. Comments are allowed to recede. */
const TEXT_CONTRAST = 4.5;
const COMMENT_CONTRAST = 3.5;

/** The editor's own ground, so the editor stops being VS Code's `#1e1e1e` inside a Klive window. */
export function editorBackground(tone: Tone): string {
  return NEUTRAL[tone].canvas;
}

/**
 * The fixed hue per class, per tone — candidate "Spectrum Warm", chosen by the project author.
 *
 * **Hue carries class.** The scheme this replaces derived every colour from the accent, so nine of
 * eleven classes were lightness steps of a single blue and comments were neutral grey. Hue is by far
 * the strongest channel for telling token classes apart at a glance; lightness alone is the weakest.
 * See `.plans/SYNTAX_PALETTE_REVISION_PLAN.md`, which supersedes §8.1 of the modernization plan.
 *
 * `keyword` and `error` are deliberately absent:
 *
 * - **keyword** is the active accent, so switching accent still visibly re-tints the editor. It is
 *   the one class that moves, which is what keeps the editor part of the app without making the
 *   whole palette hostage to twelve accent x tone combinations.
 * - **error** is `--status-error`, so it means the same thing under every accent.
 *
 * Numbers are lavender rather than the conventional pale green specifically so they can never blur
 * into comments — Z80 source is dense with literals, and a comment/number collision is the exact
 * failure this revision exists to remove.
 *
 * Every value here already clears its contrast floor against the editor background unaided, so
 * `ensureContrast` below is a no-op for them; it stays as the guard for accents and any future
 * edits to this table.
 */
const SYNTAX_HUES: Record<Tone, Record<Exclude<SyntaxClass, "keyword" | "error">, string>> = {
  dark: {
    comment: "#5FB37A",
    directive: "#D68FE6",
    label: "#E8C56B",
    operand: "#A8D8F0",
    number: "#C0A6F5",
    string: "#E0906A",
    type: "#4ECFB0",
    function: "#6FD3FF",
    punctuation: "#B4BAC4"
  },
  /*
   * The light blues are not the dark ones darkened.
   *
   * On a dark ground the keyword, operand and function blues separate by *lightness* (0.59 / 0.80 /
   * 0.72) at essentially one hue, which reads fine. On white that trick is unavailable: lighter also
   * means less contrast, so everything has to go darker, and the first pass had function at hue 205
   * lum 0.41 against a keyword at hue 205 lum 0.38 — the same colour, distinguished only by the
   * keyword's bold weight. Here function goes clearly darker and operand becomes a near-neutral
   * slate, which is the light-tone equivalent of the pale, plain-reading operand in dark.
   */
  light: {
    comment: "#1F7A44",
    directive: "#9B2FB4",
    label: "#8A6A00",
    operand: "#3E4C54",
    number: "#6340C8",
    string: "#B4551F",
    type: "#1A7F72",
    function: "#0A4E7A",
    punctuation: "#565C65"
  }
};

export function syntaxPalette(tone: Tone, accentId: AccentId): Record<SyntaxClass, SyntaxStyle> {
  const bg = editorBackground(tone);
  const hues = SYNTAX_HUES[tone];
  const keyword = ensureContrast(ACCENTS[accentId].solid[tone], bg, TEXT_CONTRAST);

  /*
   * Every class is held clear of the keyword before its contrast is fixed, because the keyword is
   * the one colour that moves with the accent and so the one thing the fixed table can collide with.
   */
  /** Monaco wants bare lowercase hex; a table value that needs no adjustment must still be normalised. */
  const bare = (c: string) => c.replace("#", "").toLowerCase();
  const fix = (c: string, target = TEXT_CONTRAST) =>
    bare(ensureContrast(ensureDistinct(c, keyword, MIN_CLASS_DISTANCE, tone), bg, target));

  return {
    // The most frequent coloured token carries the app's signature — and is the only class that
    // moves with the accent.
    keyword: { foreground: bare(keyword), fontStyle: "bold" },
    directive: { foreground: fix(hues.directive) },
    label: { foreground: fix(hues.label) },
    type: { foreground: fix(hues.type) },
    function: { foreground: fix(hues.function) },
    operand: { foreground: fix(hues.operand) },
    number: { foreground: fix(hues.number) },
    string: { foreground: fix(hues.string) },
    // Coloured and italic. Grey comments read as disabled UI rather than as authored text, which is
    // what the previous scheme shipped; `comment-is-not-grey` in the test suite guards this.
    comment: { foreground: fix(hues.comment, COMMENT_CONTRAST), fontStyle: "italic" },
    punctuation: { foreground: fix(hues.punctuation) },
    // Never the accent, never a syntax hue — an error must be unambiguous whatever else changes.
    error: { foreground: fix(STATUS[tone].error) }
  };
}

/**
 * Monaco token name -> syntax class.
 *
 * Read out of the seven grammars rather than invented: every name here is one some provider emits.
 * Names are shared across the languages, which is why one map serves all of them.
 */
export const TOKEN_CLASSES: Record<string, SyntaxClass> = {
  comment: "comment",

  keyword: "keyword",
  "keyword.block": "keyword",
  statement: "keyword",
  condasm: "keyword",
  macro: "keyword",

  pragma: "directive",
  directive: "directive",
  preproc: "directive",
  pseudoop: "directive",
  specop: "directive",
  annotation: "directive",
  macroparam: "directive",
  luadef: "directive",

  identifier: "label",
  variable: "label",
  namespace: "label",

  type: "type",
  struct: "type",

  function: "function",
  "support.function": "function",

  register: "operand",
  condition: "operand",

  number: "number",
  "number.hex": "number",
  equ: "number",
  constant: "number",

  string: "string",
  "string.quote": "string",
  "string.escape": "string",
  escape: "string",
  regexp: "string",
  "regexp.escape": "string",
  "regexp.escape.control": "string",

  delimiter: "punctuation",
  "delimiter.bracket": "punctuation",
  asmdel: "punctuation",

  /*
   * The `.invalid` variants.
   *
   * Monaco resolves a theme rule by longest matching prefix, so `string.invalid` would otherwise
   * inherit `string` and an unterminated literal would look exactly like a valid one. Naming them
   * explicitly is what makes them read as wrong.
   */
  "string.invalid": "error",
  "string.escape.invalid": "error",
  "regexp.invalid": "error"
};

/** Extra emphasis a token keeps beyond its class — the grammars' own conventions, preserved. */
const TOKEN_FONT_STYLE: Record<string, string> = {
  macroparam: "italic",
  macro: "bold italic",
  statement: "bold"
};

/** The Monaco `rules` array for a tone and accent. */
export function syntaxRules(
  tone: Tone,
  accentId: AccentId
): { token: string; foreground: string; fontStyle?: string }[] {
  const palette = syntaxPalette(tone, accentId);
  return Object.entries(TOKEN_CLASSES).map(([token, cls]) => {
    const style = palette[cls];
    const fontStyle = TOKEN_FONT_STYLE[token] ?? style.fontStyle;
    return fontStyle
      ? { token, foreground: style.foreground, fontStyle }
      : { token, foreground: style.foreground };
  });
}

/**
 * Editor chrome overrides.
 *
 * The providers each carried their own copy of six `input.*` / `editorWidget.*` literals; they now
 * come from the neutral ramp, and `editor.background` is set so the editor shares the app's ground.
 */
export function editorColors(tone: Tone): Record<string, string> {
  const n = NEUTRAL[tone];
  return {
    "editor.background": editorBackground(tone),
    "editor.foreground": n.text,
    "editorLineNumber.foreground": n.textTertiary,
    "editorLineNumber.activeForeground": n.text,
    "editorGutter.background": editorBackground(tone),
    "editorWidget.background": n.raised,
    "editorWidget.foreground": n.text,
    "editorWidget.border": n.border,
    "input.background": n.raised,
    "input.foreground": n.text,
    "input.border": n.borderStrong
  };
}

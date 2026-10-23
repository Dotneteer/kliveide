import type { Ht1080zRomSetId } from "./Ht1080zRoms";

/**
 * Text as HT-1080Z keystrokes (`.plans/HT1080Z_PLAN.md` §7, Phase 4). Every value here was observed
 * on the core running the real ROMs (`test/ht1080z-hw/keyboard.test.ts`).
 *
 * - Letters are unshifted for capitals and shifted for lowercase. The bare Level II BASIC shows both
 *   as capitals; the extension ROM (switched on with `SYSTEM` then `/12288`) shows lowercase.
 * - The symbols are the TRS-80's: SHIFT+1 `!`, SHIFT+2 `"`, SHIFT+7 `'`, SHIFT+: `*`, SHIFT+; `+`,
 *   SHIFT+- `=`, SHIFT+@ `` ` `` ...
 * - Series II accents: CLEAR held, then A/E/U/O give Á É Ü Ö, with SHIFT too á é ü ö. CLEAR must be
 *   down before the letter (`lead`): pressed in the same frame, the extension types the plain letter.
 * - /64 special characters: `` ` `` (SHIFT+@), then a key, after the HS ROM page's table (A E I O U
 *   Á É Í Ó Ú; 3 4 5 6 Ö Ő Ü Ű; 7 8 9 Ω ∞ ■; B G M S Ψ π λ Σ; with SHIFT the lowercase letters and
 *   ω α √ β γ μ ∫). Stored as two bytes; the extension converts them for display.
 *
 * Both accent schemes are the extension's: with it off, CLEAR clears the screen and `` ` `` stays.
 */

/** One keystroke: `keys` pressed together; with `lead`, `keys[0]` goes down after the others */
export type Ht1080zStroke = { keys: string[]; lead?: boolean };

const SYMBOLS: Record<string, string[]> = {
  "\n": ["Enter"],
  "\r": ["Enter"],
  " ": ["Space"],
  // --- The left arrow deletes the last character; the right arrow tabs; up prints `[`
  "\b": ["Left"],
  "\t": ["Right"],
  "[": ["Up"],
  "@": ["At"],
  "`": ["At", "Shift"],
  "!": ["N1", "Shift"],
  '"': ["N2", "Shift"],
  "#": ["N3", "Shift"],
  $: ["N4", "Shift"],
  "%": ["N5", "Shift"],
  "&": ["N6", "Shift"],
  "'": ["N7", "Shift"],
  "(": ["N8", "Shift"],
  ")": ["N9", "Shift"],
  ":": ["Colon"],
  "*": ["Colon", "Shift"],
  ";": ["Semicolon"],
  "+": ["Semicolon", "Shift"],
  ",": ["Comma"],
  "<": ["Comma", "Shift"],
  "-": ["Minus"],
  "=": ["Minus", "Shift"],
  ".": ["Period"],
  ">": ["Period", "Shift"],
  "/": ["Slash"],
  "?": ["Slash", "Shift"]
};

/** Series II: CLEAR (+ SHIFT) held, then the letter */
const SERIES2_ACCENTS: Record<string, string[]> = {
  Á: ["A", "Clear"],
  É: ["E", "Clear"],
  Ü: ["U", "Clear"],
  Ö: ["O", "Clear"],
  á: ["A", "Clear", "Shift"],
  é: ["E", "Clear", "Shift"],
  ü: ["U", "Clear", "Shift"],
  ö: ["O", "Clear", "Shift"]
};

/** The /64: the key after `` ` `` (SHIFT+@), unshifted then shifted */
const S64_SPECIALS: [string, string, string][] = [
  ["A", "Á", "á"],
  ["E", "É", "é"],
  ["I", "Í", "í"],
  ["O", "Ó", "ó"],
  ["U", "Ú", "ú"],
  ["N3", "Ö", "ö"],
  ["N4", "Ő", "ő"],
  ["N5", "Ü", "ü"],
  ["N6", "Ű", "ű"],
  ["N7", "Ω", "ω"],
  ["N8", "∞", "α"],
  ["N9", "■", "√"],
  ["B", "Ψ", "β"],
  ["G", "π", "γ"],
  ["M", "λ", "μ"],
  ["S", "Σ", "∫"]
];
const S64_PREFIX: Ht1080zStroke = { keys: ["At", "Shift"] };

/**
 * The strokes that type `ch` on a model, or undefined for a character its keyboard cannot type
 */
export function ht1080zStrokesForCharacter(ch: string, romSet: Ht1080zRomSetId): Ht1080zStroke[] | undefined {
  const symbol = SYMBOLS[ch];
  if (symbol) return [{ keys: symbol }];
  if (/^[A-Z]$/.test(ch)) return [{ keys: [ch] }];
  if (/^[a-z]$/.test(ch)) return [{ keys: [ch.toUpperCase(), "Shift"] }];
  if (/^[0-9]$/.test(ch)) return [{ keys: [`N${ch}`] }];
  if (romSet === "s2" && SERIES2_ACCENTS[ch]) return [{ keys: SERIES2_ACCENTS[ch], lead: true }];
  if (romSet === "s64") {
    for (const [key, plain, shifted] of S64_SPECIALS) {
      if (ch === plain) return [S64_PREFIX, { keys: [key] }];
      if (ch === shifted) return [S64_PREFIX, { keys: [key, "Shift"] }];
    }
  }
  return undefined;
}

/** A string as strokes; throws on a character the model's keyboard cannot type */
export function ht1080zStrokesForText(text: string, romSet: Ht1080zRomSetId): Ht1080zStroke[] {
  return [...text].flatMap((ch) => {
    const strokes = ht1080zStrokesForCharacter(ch, romSet);
    if (!strokes) throw new Error(`The HT-1080Z keyboard cannot type '${ch}'`);
    return strokes;
  });
}

/** The command that switches the extension ROM on (HARDWARE.md §10): `SYSTEM`, then `/12288` */
export const HT1080Z_EXTENSION_ON = "SYSTEM\n/12288\n";

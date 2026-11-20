/*
 * Text as SAM Coupé keystrokes, for the IDE's typing, Run and the tests (`dev/plans/SAM_COUPE_PLAN.md`
 * §9.1). The legends are the SAM's keycaps (SOUND_INPUT_IO.md §3.2): plain keys give lower case, SHIFT
 * upper case and the digit keys' symbols as on a Spectrum (SAM BASIC keeps the Spectrum's shifted digits),
 * SYMBOL the second legend of the punctuation keys. `test/sam-hw/keyboard.test.ts` reads every one back
 * from the running ROM.
 */

/** A keystroke: `SamKeyCode` names, the key first and its modifier after it */
export type SamStroke = { keys: string[] };

const plain = (key: string): SamStroke => ({ keys: [key] });
const shifted = (key: string): SamStroke => ({ keys: [key, "Shift"] });

const STROKES = new Map<string, SamStroke>();
for (let i = 0; i < 26; i++) {
  const letter = String.fromCharCode(65 + i);
  STROKES.set(letter.toLowerCase(), plain(letter));
  STROKES.set(letter, shifted(letter));
}
const DIGITS: [string, string][] = [
  ["1", "!"],
  ["2", "@"],
  ["3", "#"],
  ["4", "$"],
  ["5", "%"],
  ["6", "&"],
  ["7", "'"],
  ["8", "("],
  ["9", ")"],
  ["0", "~"]
];
for (const [digit, symbol] of DIGITS) {
  STROKES.set(digit, plain(`N${digit}`));
  STROKES.set(symbol, shifted(`N${digit}`));
}
/** The punctuation keys: the key, its plain legend, its shifted legend */
const PAIRS: [string, string, string][] = [
  ["Minus", "-", "/"],
  ["Plus", "+", "*"],
  ["Equals", "=", "_"],
  ["Quote", '"', "`"],
  ["Semicolon", ";", "<"],
  ["Colon", ":", ">"],
  ["Comma", ",", "{"],
  ["Period", ".", "}"],
  ["Inv", "\\", "|"]
];
for (const [key, lower, upper] of PAIRS) {
  STROKES.set(lower, plain(key));
  STROKES.set(upper, shifted(key));
}
STROKES.set(" ", plain("Space"));
STROKES.set("\n", plain("Enter"));

/** Whether the typer can type `char` */
export function canTypeOnSam(char: string): boolean {
  return STROKES.has(char);
}

/** Overrides a character's stroke (the keyboard test corrects the table from what the ROM shows) */
export function samStrokeFor(char: string): SamStroke | undefined {
  return STROKES.get(char);
}

/**
 * The keystrokes of `text`.
 * @throws when a character has no key
 */
export function samStrokesForText(text: string): SamStroke[] {
  return Array.from(text.replace(/\r\n?/g, "\n"), (char) => {
    const stroke = STROKES.get(char);
    if (!stroke) throw new Error(`The SAM Coupé keyboard cannot type '${char}'.`);
    return stroke;
  });
}

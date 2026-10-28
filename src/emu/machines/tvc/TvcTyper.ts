/*
 * Text as TVC keystrokes, for the IDE's typing and the tests (`.plans/VIDEOTON_TVC_PLAN.md` §8). Every
 * character here was typed on the running machine (BASIC 1.2) and read back from its screen
 * (`test/tvc-hw/keyboard.test.ts`): plain keys give lower case, SHIFT upper case and the second
 * symbol. SHIFT+0's symbol is left out: its glyph could not be read with certainty.
 */

/** A keystroke: `TvcKeyCode` names, the key first and its modifier after it */
export type TvcStroke = { keys: string[] };

const plain = (key: string): TvcStroke => ({ keys: [key] });
const shifted = (key: string): TvcStroke => ({ keys: [key, "Shift"] });

const STROKES = new Map<string, TvcStroke>();
for (let i = 0; i < 26; i++) {
  const letter = String.fromCharCode(65 + i);
  STROKES.set(letter.toLowerCase(), plain(letter));
  STROKES.set(letter, shifted(letter));
}
for (let d = 0; d <= 9; d++) STROKES.set(String(d), plain(`N${d}`));
const SHIFTED_DIGITS = ["'", '"', "+", "!", "%", "/", "=", "(", ")"];
SHIFTED_DIGITS.forEach((c, i) => STROKES.set(c, shifted(`N${i + 1}`)));
const PAIRS: [string, string, string][] = [
  ["Comma", ",", "?"],
  ["Period", ".", ":"],
  ["Minus", "-", "_"],
  ["Semicolon", ";", "$"],
  ["Caret", "^", "~"],
  ["Asterisk", "*", "#"],
  ["At", "@", "`"],
  ["LBracket", "[", "{"],
  ["RBracket", "]", "}"],
  ["Backslash", "\\", "|"],
  ["Less", "<", ">"],
  ["AAcute", "á", "Á"],
  ["EAcute", "é", "É"],
  ["IAcute", "í", "Í"],
  ["OAcute", "ó", "Ó"],
  ["OUml", "ö", "Ö"],
  ["ODblAcute", "ő", "Ő"],
  ["UAcute", "ú", "Ú"],
  ["UUml", "ü", "Ü"],
  ["UDblAcute", "ű", "Ű"]
];
for (const [key, lower, upper] of PAIRS) {
  STROKES.set(lower, plain(key));
  STROKES.set(upper, shifted(key));
}
STROKES.set(" ", plain("Space"));
STROKES.set("\n", plain("Return"));

/** Whether the typer can type `char` */
export function canTypeOnTvc(char: string): boolean {
  return STROKES.has(char);
}

/**
 * The keystrokes of `text`.
 * @throws when a character has no key
 */
export function tvcStrokesForText(text: string): TvcStroke[] {
  return Array.from(text.replace(/\r\n?/g, "\n"), (char) => {
    const stroke = STROKES.get(char);
    if (!stroke) throw new Error(`The TVC keyboard cannot type '${char}'.`);
    return stroke;
  });
}

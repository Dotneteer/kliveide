/*
 * Text as Enterprise keystrokes, for the IDE's typing and the tests (`.plans/ENTERPRISE_PLAN.md` §9.1).
 * Every character here was typed on the running machine (EXOS 2.1 with IS-BASIC 2.1, each key and
 * SHIFT with each key) and read back from its screen (`test/ep-hw/keyboard.test.ts`): plain keys give
 * lower case and the key's symbol, SHIFT upper case and its second symbol.
 */

/** A keystroke: `EpKeyCode` names, the key first and its modifier after it */
export type EpStroke = { keys: string[] };

const plain = (key: string): EpStroke => ({ keys: [key] });
const shifted = (key: string): EpStroke => ({ keys: [key, "LShift"] });

const STROKES = new Map<string, EpStroke>();
for (let i = 0; i < 26; i++) {
  const letter = String.fromCharCode(65 + i);
  STROKES.set(letter.toLowerCase(), plain(letter));
  STROKES.set(letter, shifted(letter));
}
/** The digit keys and their shifted symbols, 1 to 0 */
const DIGITS: [string, string][] = [
  ["1", "!"],
  ["2", '"'],
  ["3", "#"],
  ["4", "$"],
  ["5", "%"],
  ["6", "&"],
  ["7", "'"],
  ["8", "("],
  ["9", ")"],
  ["0", "_"]
];
for (const [digit, symbol] of DIGITS) {
  STROKES.set(digit, plain(`N${digit}`));
  STROKES.set(symbol, shifted(`N${digit}`));
}
const PAIRS: [string, string, string][] = [
  ["Minus", "-", "="],
  ["Caret", "^", "~"],
  ["Backslash", "\\", "|"],
  ["At", "@", "`"],
  ["LBracket", "[", "{"],
  ["RBracket", "]", "}"],
  ["Semicolon", ";", "+"],
  ["Colon", ":", "*"],
  ["Comma", ",", "<"],
  ["Period", ".", ">"],
  ["Slash", "/", "?"]
];
for (const [key, lower, upper] of PAIRS) {
  STROKES.set(lower, plain(key));
  STROKES.set(upper, shifted(key));
}
STROKES.set(" ", plain("Space"));
STROKES.set("\n", plain("Enter"));

/** Whether the typer can type `char` */
export function canTypeOnEnterprise(char: string): boolean {
  return STROKES.has(char);
}

/**
 * The keystrokes of `text`.
 * @throws when a character has no key
 */
export function epStrokesForText(text: string): EpStroke[] {
  return Array.from(text.replace(/\r\n?/g, "\n"), (char) => {
    const stroke = STROKES.get(char);
    if (!stroke) throw new Error(`The Enterprise keyboard cannot type '${char}'.`);
    return stroke;
  });
}

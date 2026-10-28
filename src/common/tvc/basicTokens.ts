/*
 * The Videoton TVC's BASIC tokens (`.plans/VIDEOTON_TVC_PLAN.md` §11), as the ROMs' keyword tables
 * hold them: BASIC 1.2's at DE6Dh (SYS, `tvc12-d4.rom` offset 1E6Dh) and BASIC 2.2's at D73Ah
 * (`tvc22-d6.rom` offset 173Ah). Each word ends with bit 7 set; the table opens with FFh (the end of a
 * line) and closes with FFh again (7Fh | 80h), and the words between are tokens FEh down to 95h.
 * `test/tvc/tvc-basic-tokens.test.ts` decodes both tables from the shipped ROMs and checks these.
 *
 * The slots the tables fill with "!" are free: BASIC 2.2 uses seven of them. FEh "!" is the comment
 * statement itself.
 */

/** The highest and lowest token; FFh ends a line */
export const TVC_LAST_TOKEN = 0xfe;
export const TVC_FIRST_TOKEN = 0x95;

/** BASIC 1.2's words, token FEh first */
export const TVC12_TOKENS: readonly string[] = [
  "!", ":", "REM", "DATA", "CLOSE", "CLS", "CONTINUE", "DEF", "DELETE", "DIM",
  "ELSE", "END", "FOR", "GET", "GOSUB", "GOTO", "GRAPHICS", "IF", "INPUT", "LET",
  "LIST", "LLIST", "LOAD", "LOMEM", "NEW", "NEXT", "OK", "ON", "OPEN", "OUTPUT",
  "OUT", "PLOT", "POKE", "PRINT", "RANDOMIZE", "READ", "RESTORE", "RETURN", "RUN", "SAVE",
  "SET", "SOUND", "STOP", "TRACE", "VERIFY", "EXT", "LPRINT", "!", "!", "!",
  "!", "!", "!", "AND", "CHARACTER", "DELAY", "DURATION", "INKEY$", "INK", "MODE",
  "NOT", "OFF", "ORD", "OR", "PAINT", "PALETTE", "PAPER", "PITCH", "PROMPT", "RATE",
  "STEP", "STYLE", "TAB", "THEN", "TO", "VOLUME", "XOR", "ATN", "AT", "USING",
  "BORDER", "!", "!", "!", "!", "!", "*", "#", "=>", "><",
  ",", "=<", "-", "/", ";", "^", ">=", "<>", ">", "<=",
  "=", "<", "+", "&", "(", ")"
];

/** What BASIC 2.2 adds in BASIC 1.2's free slots */
const TVC22_ADDITIONS: Readonly<Record<number, string>> = {
  0xcf: "AUTO",
  0xce: "FKEY",
  0xcd: "RENUMBER",
  0xcc: "EXCEPTION",
  0xad: "ELLIPSE",
  0xac: "RECTANGLE",
  0xab: "POLYGON"
};

/** BASIC 2.2's words, token FEh first */
export const TVC22_TOKENS: readonly string[] = TVC12_TOKENS.map((word, i) => TVC22_ADDITIONS[TVC_LAST_TOKEN - i] ?? word);

/** The word of a token, or undefined for a byte that is not one */
export function tvcTokenName(code: number, basic22: boolean): string | undefined {
  if (code < TVC_FIRST_TOKEN || code > TVC_LAST_TOKEN) return undefined;
  return (basic22 ? TVC22_TOKENS : TVC12_TOKENS)[TVC_LAST_TOKEN - code];
}

/** The tokens the listing treats specially */
export const TVC_TOKEN = {
  comment: 0xfe,
  colon: 0xfd,
  rem: 0xfc,
  data: 0xfb
} as const;

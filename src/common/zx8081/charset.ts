/**
 * The ZX81 and ZX80 character sets and keyword tokens, shared by the emulator (program files, the
 * listing views) and the Klive assembler (`.defzx`, the program image builder in `programImage.ts`).
 *
 * The character tables were read off the glyphs in the ROMs' character sets (ZX81 at $1E00, ZX80 at
 * $0E00). The ZX80's token codes were read off its ROM's keyword table ($00BA-$013A) and checked by
 * typing every K-mode key on the emulated ZX80 (`.plans/ZX8081_CODE_INJECTION_PLAN.md` §3).
 */

/** The ZX81 character set, codes $00-$3F (bit 7 = inverse) */
export const ZX81_CHARSET: readonly string[] = [
  " ", "▘", "▝", "▀", "▖", "▌", "▞", "▛", "▒", "▄", "▀", '"',
  "£", "$", ":", "?", "(", ")", ">", "<", "=", "+", "-", "*", "/", ";", ",", ".",
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"
];

/**
 * Plain-text stand-ins of the ZX81 chequered graphics, which Unicode has only in its legacy-computing
 * block: $08 is the full chequer, $09 its bottom half, $0A its top half
 */
export const ZX81_GRAPHIC_NAMES: Readonly<Record<number, string>> = {
  0x08: "chequer",
  0x09: "chequer, bottom half",
  0x0a: "chequer, top half"
};

/** The ZX80 character set, codes $00-$3F (bit 7 = inverse) */
export const ZX80_CHARSET: readonly string[] = [
  " ", '"', "▌", "▄", "▘", "▝", "▖", "▗", "▞", "▒", "▄", "▀",
  "£", "$", ":", "?", "(", ")", "-", "+", "*", "/", "=", ">", "<", ";", ",", ".",
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"
];

/**
 * The ZX81's keyword tokens: codes $C0-$FF (the ROM's TOKENS table at $0111, entries 1-64), and
 * $40-$42
 */
export const ZX81_TOKENS: Readonly<Record<number, string>> = (() => {
  const high = [
    '""', "AT ", "TAB ", "?", "CODE ", "VAL ", "LEN ", "SIN ", "COS ", "TAN ", "ASN ", "ACS ", "ATN ",
    "LN ", "EXP ", "INT ", "SQR ", "SGN ", "ABS ", "PEEK ", "USR ", "STR$ ", "CHR$ ", "NOT ", "**",
    " OR ", " AND ", "<=", ">=", "<>", " THEN ", " TO ", " STEP ", " LPRINT ", " LLIST ", " STOP ",
    " SLOW ", " FAST ", " NEW ", " SCROLL ", " CONT ", " DIM ", " REM ", " FOR ", " GOTO ", " GOSUB ",
    " INPUT ", " LOAD ", " LIST ", " LET ", " PAUSE ", " NEXT ", " POKE ", " PRINT ", " PLOT ", " RUN ",
    " SAVE ", " RAND ", " IF ", " CLS ", " UNPLOT ", " CLEAR ", " RETURN ", " COPY "
  ];
  const tokens: Record<number, string> = { 0x40: "RND", 0x41: "INKEY$", 0x42: "PI" };
  high.forEach((t, i) => (tokens[0xc0 + i] = t));
  return tokens;
})();

/**
 * The ZX80's keyword and operator tokens: codes $D4-$FE (the ROM's keyword table, in order; $F1,
 * $F2, $F5 and $FF are "?" placeholders). Functions such as `USR` are not tokens on the ZX80: they
 * are stored as their letters.
 */
export const ZX80_TOKENS: Readonly<Record<number, string>> = (() => {
  const words = [
    '"', " THEN ", " TO ", ";", ",", ")", "(", "NOT ", "-", "+", "*", "/", " AND ", " OR ", "**",
    "=", ">", "<", "LIST ", "RETURN ", "CLS ", "DIM ", "SAVE ", "FOR ", "GO TO ", "POKE ", "INPUT ",
    "RANDOMISE ", "LET ", undefined, undefined, "NEXT ", "PRINT ", undefined, "NEW ", "RUN ", "STOP ",
    "CONTINUE ", "IF ", "GO SUB ", "LOAD ", "CLEAR ", "REM "
  ];
  const tokens: Record<number, string> = {};
  words.forEach((t, i) => {
    if (t !== undefined) tokens[0xd4 + i] = t;
  });
  return tokens;
})();

/** ZX81 token codes the program image builder writes */
export const ZX81_TOKEN_REM = 0xea;
export const ZX81_TOKEN_RAND = 0xf9;
export const ZX81_TOKEN_USR = 0xd4;
/** The ZX81's marker that a number's 5-byte floating-point form follows its digits */
export const ZX81_NUMBER_MARK = 0x7e;

/** ZX80 token codes the program image builder writes */
export const ZX80_TOKEN_REM = 0xfe;
export const ZX80_TOKEN_RANDOMISE = 0xef;
export const ZX80_TOKEN_OPEN_PAREN = 0xda;
export const ZX80_TOKEN_CLOSE_PAREN = 0xd9;

/** NEWLINE, which ends every BASIC line and display-file line on both machines */
export const ZX8081_NEWLINE = 0x76;

/**
 * The character code of `ch` in the machine's character set, or undefined when the set has no such
 * character. Letters are upper case; a lower-case letter gives the inverse-video capital (bit 7).
 */
export function zx8081CharCode(ch: string, isZx81: boolean): number | undefined {
  const charset = isZx81 ? ZX81_CHARSET : ZX80_CHARSET;
  if (/^[a-z]$/.test(ch)) return charset.indexOf(ch.toUpperCase()) | 0x80;
  const code = charset.indexOf(ch);
  return code < 0 ? undefined : code;
}

/** The digits of a number in the machine's character set ("0" is $1C on both) */
export function zx8081Digits(value: number): number[] {
  return [...String(value)].map((d) => 0x1c + d.charCodeAt(0) - 0x30);
}

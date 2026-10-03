/**
 * ZX80 `.O`/`.80` and ZX81 `.P`/`.81` program files: recognition, the machine and memory they need,
 * and the two character sets.
 *
 * The recognition is ported from Clock Signal (CLK) by Thomas Harte, `Storage/Data/ZX8081.cpp`
 * (MIT; Copyright (c) 2015 Thomas Harte - the full notice is in
 * `src/emu/machines/zx8081/wasm/zx8081/zx8081.c` and THIRD_PARTY_NOTICES.md).
 *
 * The character tables are not CLK's: they were read off the glyphs in the ROMs' character sets
 * (ZX81 at $1E00, ZX80 at $0E00). CLK's two tables have the rows of symbols swapped between the
 * machines and its block graphics in the wrong order (an upstream TODO).
 */

/** A recognised program file */
export type ZxProgramFile = {
  /** ZX81 (`.P`) or ZX80 (`.O`) */
  isZx81: boolean;
  /** The bytes the ROM's LOAD reads, from $4009 (ZX81) or $4000 (ZX80) */
  data: Uint8Array;
  /** The byte stream on tape: a `.P` is preceded by the nameless-file marker $80 */
  tapeBytes: Uint8Array;
  /** The memory model the program needs: 1K, or 16K when it ends past $4400 */
  ramKb: 1 | 16;
};

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

/** The text of a ZX81 or ZX80 character code: printable codes, inverse ones, ZX81 tokens */
export function zx8081CharText(code: number, isZx81: boolean): string | undefined {
  const charset = isZx81 ? ZX81_CHARSET : ZX80_CHARSET;
  if ((code & 0x7f) < 0x40) return charset[code & 0x3f];
  return isZx81 ? ZX81_TOKENS[code] : undefined;
}

/** Converts file-name or screen bytes to text (CLK `StringFromData`) */
export function zx8081StringFromData(data: ArrayLike<number>, isZx81: boolean): string {
  const charset = isZx81 ? ZX81_CHARSET : ZX80_CHARSET;
  let text = "";
  for (let i = 0; i < data.length; i++) text += charset[data[i] & 0x3f];
  return text;
}

const word = (data: Uint8Array, offset: number) => data[offset] | (data[offset + 1] << 8);

/**
 * A ZX81 `.P` image: the bytes from VERSN ($4009) to the end of the program and variables, E_LINE
 * ($4014) saying where that is. CLK accepts an optional leading name (bit 7 ends it); a `.P` file has
 * none. Returns undefined when the data is too short for the system variables or E_LINE points past
 * its end.
 */
function zx81FileFromData(data: Uint8Array): ZxProgramFile | undefined {
  // --- The system variables up to $405E must be there (CLK)
  if (data.length < 0x405e - 0x4009) return undefined;
  const eLine = word(data, 0x4014 - 0x4009);
  if (eLine < 0x4009 || eLine - 0x4009 > data.length) return undefined;
  const tapeBytes = new Uint8Array(data.length + 1);
  tapeBytes[0] = 0x80;
  tapeBytes.set(data, 1);
  // --- 16K when the program and its variables end past the 1K machine's RAM ($4400). CLK goes by
  // --- the file size (over 1K), which misjudges files with trailing bytes.
  return { isZx81: true, data, tapeBytes, ramKb: eLine > 0x4400 ? 16 : 1 };
}

/**
 * A ZX80 `.O` image: from $4000; VARS ($4008), E_LINE ($400A) and D_FILE ($400C) in order, and the
 * end of the file inside the data (CLK).
 */
function zx80FileFromData(data: Uint8Array): ZxProgramFile | undefined {
  if (data.length < 0x28) return undefined;
  const vars = word(data, 0x08);
  const endOfFile = word(data, 0x0a);
  const displayAddress = word(data, 0x0c);
  if (endOfFile < 0x4000 || endOfFile - 0x4000 > data.length) return undefined;
  if (vars > endOfFile || endOfFile > displayAddress) return undefined;
  return { isZx81: false, data, tapeBytes: data, ramKb: endOfFile > 0x4400 ? 16 : 1 };
}

/** The extensions of the two formats */
export const ZX81_FILE_EXTENSIONS = [".p", ".81"];
export const ZX80_FILE_EXTENSIONS = [".o", ".80"];

/** Whether a file name has a ZX80 or ZX81 program extension */
export function isZx8081ProgramFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return [...ZX81_FILE_EXTENSIONS, ...ZX80_FILE_EXTENSIONS].some((ext) => lower.endsWith(ext));
}

/**
 * Recognises a program file. The extension decides the machine, as in CLK's `ZX80O81P`: `.p`/`.81`
 * is a ZX81 file, `.o`/`.80` a ZX80 file; with no telling extension, a ZX81 image is tried first.
 * Returns undefined for data that is neither.
 */
export function parseZxProgramFile(data: Uint8Array, fileName = ""): ZxProgramFile | undefined {
  const lower = fileName.toLowerCase();
  if (ZX81_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext))) return zx81FileFromData(data);
  if (ZX80_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext))) return zx80FileFromData(data);
  return zx81FileFromData(data) ?? zx80FileFromData(data);
}

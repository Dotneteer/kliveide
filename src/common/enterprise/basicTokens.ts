/*
 * IS-BASIC 2.1's stored program (Enterprise 128, `.plans/ENTERPRISE_PLAN.md` §11.4): the statement
 * tokens and a detokeniser that turns a program's bytes into the lines LIST prints.
 *
 * Nothing here comes from a published listing or another emulator. It was found by running the ROM on
 * Klive's core: typing lines at IS-BASIC's prompt, reading the bytes it stored, then poking crafted
 * lines into the program and reading back what LIST printed (`test/ep-hw/ep-basic-tokens.test.ts`
 * repeats the typing part).
 *
 * Where the program is
 * - IS-BASIC's work area is segment F8h at page 0. The word at 021Ah is the address of the current
 *   program's first line (12C9h for program 0 after a boot); the word at 0236h is one past the byte
 *   that ends it. RUN leaves both alone (variables go above the program; 0234h moves with them).
 *   `EDIT 1` points 021Ah at 4000h: the other programs live in segments IS-BASIC pages in at page 1
 *   while it works on them, so through the CPU's paging at the prompt only program 0 is reliably
 *   visible.
 *
 * A line
 * - its length (the length byte and the closing 00h included), the line number (little-endian), a
 *   byte whose low seven bits are the indentation level LIST uses (1 inside a FOR/DO/IF/DEF block, two
 *   spaces a level), the statements and 00h. A length of 0 ends the program. RUN sets bit 7 of the
 *   indentation byte on the STRING and NUMERIC lines it has executed; editing any line clears it.
 * - A statement starts with a byte from 60h-7Fh (60h is stored) and its token: the statement's index
 *   in the ROM's keyword table (F5A7h with the ROM at page 3, 93 entries, each with a flag byte). The
 *   four whose flag has bit 6 clear (DATA, IMAGE, REM and !) keep the rest of the line as typed text,
 *   leading space included. Statements are separated by `:` (10h).
 * - The other items, by their first byte:
 *   - 00h ends the line;
 *   - 01h is a `!` comment after a statement: the rest of the line is text;
 *   - 02h-0Fh are the characters 22h-2Fh; 10h-1Bh are `:` `;` `<` `=` `>` `<>` `<=` `>=` `[` `\`
 *     `]` `^` (`><` and `=>` are stored as `<>` and `>=`);
 *   - 20h-3Fh: a numeric name, its length in the low five bits (the letters upper-cased); 40h-5Fh a
 *     name ending in `$`. Functions (SIN, CHR$) and the secondary words (THEN, TO, STEP, AND, ELSE,
 *     ACCESS...) are stored as names too, and so is a statement word after ELSE;
 *   - 80h-9Fh: a string literal, a length byte and the characters (a `"` once; LIST doubles it);
 *   - A0h-BFh and C0h-DFh: a number, the low five bits its byte count. C2h (a constant) and A2h (a line
 *     number after GOTO, GOSUB, THEN, RUN...) carry a signed 16-bit integer; C6h a 6-byte decimal float:
 *     five little-endian BCD bytes holding ten digits d.ddddddddd and an exponent byte, 40h plus the
 *     power of ten, bit 7 the sign.
 * - LIST puts a space after a statement word, and between an item that ends a word (a name, a number,
 *   a string, a line number, `)`) and one that starts a word (a name, a number, a string, a line
 *   number, a statement word, `"`, `#`, `!`); nowhere else.
 * - LIST prints a number with up to ten significant digits, without a leading zero (`.5`); it falls
 *   back to `1E10`, `1.25E-09` (the exponent in at least two digits) when the plain form needs more
 *   than ten digits.
 */

/** The statement words, by token: the ROM's keyword table in order (two DEFs and two IFs) */
export const EP_BASIC_TOKENS: readonly string[] = [
  "ALLOCATE", "ASK", "AUTO", "CALL", "CAPTURE", "CASE", "CAUSE", "CLEAR", "CLOSE", "CODE", "CONTINUE",
  "COPY", "DATA", "DEF", "DEF", "DELETE", "DIM", "DISPLAY", "DO", "CHAIN", "EDIT", "ELSE", "ELSE IF",
  "END", "END DEF", "END HANDLER", "END IF", "END SELECT", "END WHEN", "ENVELOPE", "EXIT", "FOR",
  "GOSUB", "GOTO", "GRAPHICS", "HANDLER", "IMAGE", "IF", "IF", "INPUT", "LET", "LINE", "LIST", "LOAD",
  "LOOP", "MERGE", "NEW", "NEXT", "NUMERIC", "OPEN", "OPTION", "OK", "OUT", "PLOT", "POKE", "SPOKE",
  "PRINT", "PROGRAM", "RANDOMIZE", "READ", "REDIRECT", "REM", "RENUMBER", "RESTORE", "RETRY",
  "RETURN", "RUN", "SAVE", "SELECT", "SET", "SOUND", "START", "STOP", "INFO", "STRING", "TEXT",
  "TOGGLE", "TRACE", "TYPE", "VERIFY", "WHEN", "!", "LLIST", "LPRINT", "EXT", "GET", "FLUSH", "LOOK",
  "PING", "DATE", "TIME", "WAIT", "ON"
];

/** The statements whose text is kept as typed: DATA, IMAGE, REM and ! */
export const EP_BASIC_TEXT_TOKENS: ReadonlySet<number> = new Set([0x0c, 0x24, 0x3d, 0x51]);

/** IS-BASIC's variables (segment F8h at page 0) that say where the current program is */
export const EP_BASIC_PROGRAM_START = 0x021a;
export const EP_BASIC_PROGRAM_END = 0x0236;
/** Where program 0 starts after a boot */
export const EP_BASIC_PROGRAM_0 = 0x12c9;

/** The characters of codes 10h-1Bh */
const OPERATORS_10 = [":", ";", "<", "=", ">", "<>", "<=", ">=", "[", "\\", "]", "^"];

/** One listed line */
export type EpBasicLine = {
  /** The address of the line's length byte */
  address: number;
  lineNo: number;
  /** LIST's indentation level */
  indent: number;
  /** The statements as LIST prints them, without the line number and the indentation */
  text: string;
};

/** The word of a statement token, or undefined for a byte that is not one */
export function epBasicTokenName(token: number): string | undefined {
  return EP_BASIC_TOKENS[token];
}

/** A character of a string or a typed text; codes with no ASCII glyph as `{NN}` */
function charOf(code: number): string {
  return code >= 0x20 && code < 0x7f ? String.fromCharCode(code) : `{${code.toString(16).toUpperCase().padStart(2, "0")}}`;
}

/** A 6-byte IS-BASIC float (`bytes[0..4]` little-endian BCD, `bytes[5]` the exponent), as LIST prints it */
export function formatEpBasicFloat(bytes: ArrayLike<number>): string {
  let digits = "";
  for (let i = 4; i >= 0; i--) digits += (bytes[i] >> 4).toString() + (bytes[i] & 0x0f).toString();
  const significant = digits.replace(/0+$/, "");
  if (!significant) return "0";
  const sign = bytes[5] & 0x80 ? "-" : "";
  const exponent = (bytes[5] & 0x7f) - 0x40;
  if (exponent >= 0 && exponent <= 9) {
    const whole = significant.slice(0, exponent + 1).padEnd(exponent + 1, "0");
    const fraction = significant.slice(exponent + 1);
    return sign + whole + (fraction ? "." + fraction : "");
  }
  if (exponent < 0 && -exponent - 1 + significant.length <= 10) {
    return sign + "." + "0".repeat(-exponent - 1) + significant;
  }
  const mantissa = significant[0] + (significant.length > 1 ? "." + significant.slice(1) : "");
  return `${sign}${mantissa}E${exponent < 0 ? "-" : ""}${Math.abs(exponent).toString().padStart(2, "0")}`;
}

/**
 * The text of one line's statements, from the byte after the indentation to the 00h that ends it.
 * @param memory The memory holding the program
 * @param from The first statement byte (the line's address + 4)
 * @param limit Where the line must end at the latest (its address + length)
 */
export function detokeniseEpBasicLine(memory: ArrayLike<number>, from: number, limit: number): string {
  let text = "";
  // --- "word": the last item ends a word; "keyword": it was a statement word; "": anything else
  let previous: "" | "word" | "keyword" = "";
  const put = (item: string, startsWord: boolean, kind: typeof previous) => {
    if (previous === "keyword" || (previous === "word" && startsWord)) text += " ";
    text += item;
    previous = kind;
  };
  const rest = (p: number) => {
    let s = "";
    for (; p < limit && memory[p] !== 0; p++) s += charOf(memory[p]);
    return s;
  };

  let p = from;
  while (p < limit) {
    const code = memory[p];
    if (code === 0x00) break;
    if (code < 0x20) {
      p++;
      if (code === 0x01) {
        put("!", true, "");
        text += rest(p);
        break;
      }
      if (code < 0x10) put(String.fromCharCode(0x20 + code), code === 0x02 || code === 0x03, code === 0x09 ? "word" : "");
      else put(OPERATORS_10[code - 0x10] ?? charOf(code), false, "");
      continue;
    }
    if (code < 0x60) {
      // --- A name, numeric (20h-3Fh) or string (40h-5Fh)
      const length = code & 0x1f;
      let name = "";
      for (let i = 1; i <= length; i++) name += charOf(memory[p + i]);
      put(name, true, "word");
      p += 1 + length;
      continue;
    }
    if (code < 0x80) {
      const token = memory[p + 1];
      p += 2;
      const word = EP_BASIC_TOKENS[token] ?? `{token ${token.toString(16).toUpperCase().padStart(2, "0")}}`;
      if (EP_BASIC_TEXT_TOKENS.has(token)) {
        put(word, true, "");
        text += rest(p);
        break;
      }
      put(word, true, "keyword");
      continue;
    }
    if (code < 0xa0) {
      // --- A string literal: a length byte and the characters
      const length = memory[p + 1];
      let s = "";
      for (let i = 0; i < length; i++) {
        const c = memory[p + 2 + i];
        s += c === 0x22 ? '""' : charOf(c);
      }
      put(`"${s}"`, true, "word");
      p += 2 + length;
      continue;
    }
    if (code < 0xe0) {
      // --- A number: 2 bytes are a signed integer, otherwise a 6-byte float
      const size = code & 0x1f;
      let value: string;
      if (size === 2) {
        const word = memory[p + 1] | (memory[p + 2] << 8);
        value = (word >= 0x8000 ? word - 0x10000 : word).toString();
      } else {
        value = formatEpBasicFloat(Array.from({ length: 6 }, (_, i) => memory[p + 1 + i]));
      }
      put(value, true, "word");
      p += 1 + size;
      continue;
    }
    // --- E0h-FFh: never seen in a stored line
    put(charOf(code), false, "");
    p++;
  }
  return text;
}

/**
 * The lines of the program between `start` and `end` (IS-BASIC's 021Ah and 0236h). Stops at a length
 * of 0, at `end`, or at a line that would run past the memory.
 */
export function decodeEpBasicProgram(memory: ArrayLike<number>, start: number, end = memory.length): EpBasicLine[] {
  const lines: EpBasicLine[] = [];
  const limit = Math.min(end, memory.length);
  let p = start;
  while (p + 4 < limit) {
    const length = memory[p];
    if (length < 5 || p + length > limit) break;
    lines.push({
      address: p,
      lineNo: memory[p + 1] | (memory[p + 2] << 8),
      indent: memory[p + 3] & 0x7f,
      text: detokeniseEpBasicLine(memory, p + 4, p + length)
    });
    p += length;
  }
  return lines;
}

/** A line as LIST prints it: the number right-aligned in five columns, two spaces per indent level */
export function formatEpBasicLine(line: EpBasicLine): string {
  return `${line.lineNo.toString().padStart(5)} ${"  ".repeat(line.indent)}${line.text}`;
}

/** The current program, through IS-BASIC's own pointers in the 64K the CPU sees at the prompt */
export function decodeEpBasicFromMemory(memory: ArrayLike<number>): EpBasicLine[] {
  const word = (a: number) => memory[a] | (memory[a + 1] << 8);
  return decodeEpBasicProgram(memory, word(EP_BASIC_PROGRAM_START), word(EP_BASIC_PROGRAM_END));
}

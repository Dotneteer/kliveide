import { ZxSpectrumChars } from "@common/machines/char-codes";

/*
 * Spectrum BASIC text to the tokenised form the ROM stores
 * (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, B4): the inverse of `basicListing.ts`'s decoder,
 * for putting a `.bas` file on a disk and for the disk export's loader.
 *
 * A line is its number (2 bytes, high first), the length of the rest (2 bytes, low first), the
 * tokenised text and ENTER ($0D). A keyword becomes its token (the token table is `char-codes.ts`'s
 * own); a number literal stays as its digits and is followed by $0E and the value in the ROM's 5-byte
 * form: the small-integer form (0, sign, low, high, 0) for whole numbers up to 65535, the floating
 * form (exponent + 128, 4 mantissa bytes with the sign in place of the always-set top bit)
 * otherwise. Text in quotes and after REM is copied as it is.
 *
 * Keywords are matched case-insensitively, longest first, and only as whole words: `TOTAL` is a
 * variable, not `TO` + `TAL`. `GOTO`, `GOSUB` and `DEFFN` are accepted for `GO TO`, `GO SUB` and
 * `DEF FN`.
 */

/** Why a line could not be tokenised */
export class BasicTokenizeError extends Error {
  constructor (readonly lineIndex: number, message: string) {
    super(message);
    this.name = "BasicTokenizeError";
  }
}

export type TokenizeOptions = {
  /** Accept the 128K/+3 keywords SPECTRUM ($A3) and PLAY ($A4) */
  plus128?: boolean;
  /**
   * Leave out the hidden 5-byte forms after number literals. The ROM adds them when it checks a
   * line's syntax, which stops at REM: text after a REM keeps its numbers as digits only - and
   * TR-DOS, which reads its command after `REM :`, reports "Nonsense in BASIC" on a $0E there.
   */
  noHiddenNumbers?: boolean;
};

type Keyword = { text: string; token: number; alpha: boolean };

let keywords48: Keyword[] | undefined;
let keywords128: Keyword[] | undefined;

function keywordTable (plus128: boolean): Keyword[] {
  const build = () => {
    const list: Keyword[] = [];
    for (let code = 0xa5; code <= 0xff; code++) {
      const text = ZxSpectrumChars[code]?.t;
      if (text) list.push({ text, token: code, alpha: /[A-Z]$/.test(text) });
    }
    list.push({ text: "GOTO", token: 0xec, alpha: true });
    list.push({ text: "GOSUB", token: 0xed, alpha: true });
    list.push({ text: "DEFFN", token: 0xce, alpha: true });
    return list;
  };
  if (!keywords48) keywords48 = build().sort((a, b) => b.text.length - a.text.length);
  if (!plus128) return keywords48;
  if (!keywords128) {
    keywords128 = [...keywords48, { text: "SPECTRUM", token: 0xa3, alpha: true }, { text: "PLAY", token: 0xa4, alpha: true }].sort(
      (a, b) => b.text.length - a.text.length
    );
  }
  return keywords128;
}

const isAlnum = (ch: string | undefined) => !!ch && /[A-Za-z0-9]/.test(ch);

/** A number in the ROM's 5-byte form */
export function basicNumberBytes (value: number): number[] {
  if (Number.isInteger(value) && Math.abs(value) <= 65535) {
    const magnitude = Math.abs(value);
    if (value >= 0) return [0x00, 0x00, magnitude & 0xff, magnitude >> 8, 0x00];
    // --- The small-integer form of a negative number holds it as 65536 + value
    const stored = (65536 + value) & 0xffff;
    return [0x00, 0xff, stored & 0xff, stored >> 8, 0x00];
  }
  if (value === 0) return [0, 0, 0, 0, 0];
  const negative = value < 0;
  let magnitude = Math.abs(value);
  let exponent = Math.floor(Math.log2(magnitude)) + 1;
  let mantissa = Math.round((magnitude / 2 ** exponent) * 2 ** 32);
  if (mantissa >= 2 ** 32) {
    exponent++;
    mantissa = Math.round((magnitude / 2 ** exponent) * 2 ** 32);
  }
  if (exponent + 128 > 255 || exponent + 128 < 1) {
    throw new RangeError(`${value} is out of the Spectrum's number range`);
  }
  magnitude = mantissa;
  const bytes = [(magnitude >>> 24) & 0xff, (magnitude >>> 16) & 0xff, (magnitude >>> 8) & 0xff, magnitude & 0xff];
  bytes[0] = negative ? bytes[0] | 0x80 : bytes[0] & 0x7f;
  return [exponent + 128, ...bytes];
}

/** One line's text after its number, tokenised (without the ENTER) */
export function tokenizeStatementText (text: string, options: TokenizeOptions = {}, lineIndex = 0): number[] {
  const table = keywordTable(!!options.plus128);
  const out: number[] = [];
  let i = 0;
  let afterBin = false;
  while (i < text.length) {
    const ch = text[i];

    // --- A string: copied to its closing quote ("" stands for one quote)
    if (ch === '"') {
      let j = i + 1;
      while (j < text.length && !(text[j] === '"' && text[j + 1] !== '"')) j += text[j] === '"' ? 2 : 1;
      if (j >= text.length) throw new BasicTokenizeError(lineIndex, `A string is not closed: ${text}`);
      for (let k = i; k <= j; k++) out.push(text.charCodeAt(k) & 0xff);
      i = j + 1;
      continue;
    }

    // --- A keyword, as a whole word
    if (!isAlnum(text[i - 1]) || !/[A-Za-z]/.test(ch)) {
      const keyword = matchKeyword(text, i, table);
      if (keyword) {
        out.push(keyword.token);
        i = keyword.end;
        // --- The listing puts a space after a keyword; the one typed is not stored
        if (text[i] === " ") i++;
        if (keyword.token === 0xea) {
          // --- REM: the rest of the line as it is
          for (; i < text.length; i++) out.push(text.charCodeAt(i) & 0xff);
        }
        afterBin = keyword.token === 0xc4;
        continue;
      }
    }

    // --- A number literal (not part of a name such as A1)
    if ((/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(text[i + 1] ?? ""))) && !isAlnum(text[i - 1])) {
      const match = afterBin ? /^[01]+/.exec(text.slice(i)) : /^(\d+\.?\d*|\.\d+)(E[+-]?\d+)?/i.exec(text.slice(i));
      if (match) {
        const literal = match[0];
        for (const c of literal) out.push(c.charCodeAt(0));
        if (!options.noHiddenNumbers) {
          out.push(0x0e, ...basicNumberBytes(afterBin ? parseInt(literal, 2) : parseFloat(literal)));
        }
        i += literal.length;
        afterBin = false;
        continue;
      }
    }

    afterBin = false;
    const code = text.charCodeAt(i);
    if (code > 0x7f) throw new BasicTokenizeError(lineIndex, `"${ch}" is not a Spectrum character`);
    out.push(code);
    i++;
  }
  return out;
}

function matchKeyword (text: string, at: number, table: Keyword[]): { token: number; end: number } | undefined {
  const upper = text.slice(at, at + 12).toUpperCase();
  for (const keyword of table) {
    // --- "OPEN #", "CLOSE #", "GO TO", "DEF FN": a space inside the keyword may be any run of spaces
    const pattern = keyword.text.replace(/[.*+?^${}()|[\]\\#]/g, "\\$&").replace(/ /g, " *");
    const match = new RegExp(`^${pattern}`).exec(upper);
    if (!match) continue;
    const end = at + match[0].length;
    if (keyword.alpha && isAlnum(text[end])) continue;
    return { token: keyword.token, end };
  }
  return undefined;
}

/**
 * A program's text (one statement line per text line, each starting with its number) tokenised as
 * the ROM stores the program
 */
export function tokenizeBasicProgram (source: string, options: TokenizeOptions = {}): Uint8Array {
  const out: number[] = [];
  source.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    const match = /^(\d+)\s*(.*)$/.exec(line);
    if (!match) throw new BasicTokenizeError(index, `A program line must start with its number: ${line}`);
    const number = parseInt(match[1], 10);
    if (number < 1 || number > 9999) throw new BasicTokenizeError(index, `Line number ${number} is out of 1..9999`);
    const body = [...tokenizeStatementText(match[2], options, index), 0x0d];
    out.push(number >> 8, number & 0xff, body.length & 0xff, body.length >> 8, ...body);
  });
  return new Uint8Array(out);
}

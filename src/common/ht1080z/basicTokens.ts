/**
 * The HT-1080Z's Level II BASIC keywords by token (`.plans/HT1080Z_PLAN.md` §11): the ROM's
 * reserved-word table at 1650h lists them for tokens 80h-FBh in order, each keyword with bit 7 set on
 * its first character. `test/ht1080z/basic-tokens.test.ts` decodes the table from every model's ROM
 * and compares it with this list. D1h is the power operator, shown as `↑` on the HT's screen.
 */
export const HT1080Z_FIRST_TOKEN = 0x80;

export const HT1080Z_TOKENS: readonly string[] = [
  // 80h-8Fh
  "END", "FOR", "RESET", "SET", "CLS", "CMD", "RANDOM", "NEXT",
  "DATA", "INPUT", "DIM", "READ", "LET", "GOTO", "RUN", "IF",
  // 90h-9Fh
  "RESTORE", "GOSUB", "RETURN", "REM", "STOP", "ELSE", "TRON", "TROFF",
  "DEFSTR", "DEFINT", "DEFSNG", "DEFDBL", "LINE", "EDIT", "ERROR", "RESUME",
  // A0h-AFh
  "OUT", "ON", "OPEN", "FIELD", "GET", "PUT", "CLOSE", "LOAD",
  "MERGE", "NAME", "KILL", "LSET", "RSET", "SAVE", "SYSTEM", "LPRINT",
  // B0h-BFh
  "DEF", "POKE", "PRINT", "CONT", "LIST", "LLIST", "DELETE", "AUTO",
  "CLEAR", "CLOAD", "CSAVE", "NEW", "TAB(", "TO", "FN", "USING",
  // C0h-CFh
  "VARPTR", "USR", "ERL", "ERR", "STRING$", "INSTR", "POINT", "TIME$",
  "MEM", "INKEY$", "THEN", "NOT", "STEP", "+", "-", "*",
  // D0h-DFh
  "/", "[", "AND", "OR", ">", "=", "<", "SGN",
  "INT", "ABS", "FRE", "INP", "POS", "SQR", "RND", "LOG",
  // E0h-EFh
  "EXP", "COS", "SIN", "TAN", "ATN", "PEEK", "CVI", "CVS",
  "CVD", "EOF", "LOC", "LOF", "MKI$", "MKS$", "MKD$", "CINT",
  // F0h-FBh
  "CSNG", "CDBL", "FIX", "LEN", "STR$", "VAL", "ASC", "CHR$",
  "LEFT$", "RIGHT$", "MID$", "'"
];

/** The last token the ROM knows (FBh, the apostrophe remark). */
export const HT1080Z_LAST_TOKEN = HT1080Z_FIRST_TOKEN + HT1080Z_TOKENS.length - 1;

/** The keyword of a token byte, or undefined for a byte that is not one. */
export function ht1080zTokenName(code: number): string | undefined {
  return code >= HT1080Z_FIRST_TOKEN && code <= HT1080Z_LAST_TOKEN
    ? HT1080Z_TOKENS[code - HT1080Z_FIRST_TOKEN]
    : undefined;
}

/**
 * The reserved words of ZX BASIC (`.ai/zxbasic-syntax/zxbasic-syntax.json` `keywords`, which a test
 * keeps this table equal to) plus the CODEBANK extension's CODEBANK and FARPTR (plan D6).
 */
export type KeywordKind = "statement" | "function" | "operator" | "modifier" | "type" | "declaration" | "misc";

export const KEYWORDS: Readonly<Record<string, KeywordKind>> = {
  ABS: "function",
  ACS: "function",
  AND: "operator",
  AS: "modifier",
  ASM: "statement",
  ASN: "function",
  AT: "modifier",
  ATN: "function",
  BAND: "operator",
  BEEP: "statement",
  BIN: "misc",
  BNOT: "operator",
  BOLD: "statement",
  BOR: "operator",
  BORDER: "statement",
  BRIGHT: "statement",
  BXOR: "operator",
  BYREF: "modifier",
  BYTE: "type",
  BYVAL: "modifier",
  CAST: "function",
  CHR: "function",
  CHR$: "function",
  CIRCLE: "statement",
  CLS: "statement",
  CODE: "function",
  CONST: "declaration",
  CONTINUE: "statement",
  COS: "function",
  DATA: "statement",
  DECLARE: "declaration",
  DIM: "declaration",
  DO: "statement",
  DRAW: "statement",
  ELSE: "misc",
  ELSEIF: "misc",
  END: "statement",
  ENDIF: "misc",
  ERROR: "statement",
  EXIT: "statement",
  EXP: "function",
  FASTCALL: "modifier",
  FIXED: "type",
  FLASH: "statement",
  FLOAT: "type",
  FOR: "statement",
  FUNCTION: "declaration",
  GO: "statement",
  GOSUB: "statement",
  GOTO: "statement",
  IF: "statement",
  IN: "function",
  INK: "statement",
  INKEY: "function",
  INKEY$: "function",
  INT: "function",
  INTEGER: "type",
  INVERSE: "statement",
  ITALIC: "statement",
  LBOUND: "function",
  LEN: "function",
  LET: "statement",
  LN: "function",
  LOAD: "statement",
  LONG: "type",
  LOOP: "misc",
  MOD: "operator",
  NEXT: "misc",
  NOT: "operator",
  ON: "statement",
  OR: "operator",
  OUT: "statement",
  OVER: "statement",
  PAPER: "statement",
  PAUSE: "statement",
  PEEK: "function",
  PI: "function",
  PLOT: "statement",
  POKE: "statement",
  PRINT: "statement",
  RANDOMIZE: "statement",
  READ: "statement",
  REM: "misc",
  RESTORE: "statement",
  RETURN: "statement",
  RND: "function",
  SAVE: "statement",
  SGN: "function",
  SHL: "operator",
  SHR: "operator",
  SIN: "function",
  SIZEOF: "function",
  SQR: "function",
  STDCALL: "modifier",
  STEP: "modifier",
  STOP: "statement",
  STR: "function",
  STR$: "function",
  STRING: "type",
  SUB: "declaration",
  TAB: "modifier",
  TAN: "function",
  THEN: "modifier",
  TO: "modifier",
  UBOUND: "function",
  UBYTE: "type",
  UINTEGER: "type",
  ULONG: "type",
  UNTIL: "misc",
  USR: "function",
  VAL: "function",
  VERIFY: "statement",
  WEND: "misc",
  WHILE: "statement",
  XOR: "operator"
};

/** Keywords of the CODEBANK extension (spec `extensions.codebank`). */
export const EXTENSION_KEYWORDS: Readonly<Record<string, KeywordKind>> = {
  CODEBANK: "declaration",
  FARPTR: "operator"
};

/** The canonical keyword of a word (upper case, `$` kept for CHR$, STR$, INKEY$), or undefined. */
export function keywordOf(word: string): string | undefined {
  const upper = word.toUpperCase();
  return upper in KEYWORDS || upper in EXTENSION_KEYWORDS ? upper : undefined;
}

/** The spelling aliases: CHR$ is CHR, STR$ is STR, INKEY$ is INKEY. */
export function baseKeyword(keyword: string): string {
  return keyword.endsWith("$") ? keyword.slice(0, -1) : keyword;
}

/** The type names a declaration accepts, by keyword. */
export const TYPE_KEYWORDS = ["BYTE", "UBYTE", "INTEGER", "UINTEGER", "LONG", "ULONG", "FIXED", "FLOAT", "STRING"] as const;
export type TypeName = (typeof TYPE_KEYWORDS)[number];

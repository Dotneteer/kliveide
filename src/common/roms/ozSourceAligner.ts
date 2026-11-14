/*
 * The OZ source aligner (`dev/plans/Z88_OZ47_ROM_ANNOTATIONS_PLAN.md`, Phase 2, D-OZ5): places the lines of
 * the Cambridge Z88 operating system's published assembler source (mpm syntax) on the ROM bytes,
 * without assembling them.
 *
 * mpm 1.5 is not available, so OZ is not rebuilt. Instead, the source of one module is read the way mpm
 * reads it, as far as the layout depends on it: `include` files, `IF`/`ELSE`/`ENDIF` on the build's
 * defines, `defc` constants and `defvars` blocks. Then it is walked over Klive's own decoding of the
 * ROM, from the module's start:
 *
 * - a label is placed at the current offset;
 * - an instruction must have the same shape as the instruction decoded there (mnemonic, registers and
 *   condition codes, with every number, symbol and expression one "N"), and the walk moves on by the
 *   decoded length;
 * - `defb`/`defw`/`defp`/`defl`/`defm`/`defs` move on by their size, and every byte the source spells
 *   out must be the ROM's.
 *
 * The first mismatch ends the walk: what was placed before it is reported as placed, the rest of the
 * module as not. Each jump or call to a label of the module is checked once the walk is done: the
 * decoded target must be the label's offset. So a module that walks to its end has been checked line
 * by line against the ROM, which is the comparison a rebuild would have given.
 *
 * Pure: the caller reads the files and decodes the ROM (`dev/scripts/import-oz-source.cjs`).
 */

// ------------------------------------------------------------------------------------------------
// Inputs

/** A source file the aligner may read: the module itself, or a file it includes. */
export type OzSourceReader = {
  /** The text of `name` as included from `from` (searching the include folders), or `undefined`. */
  include(from: string, name: string): { path: string; text: string } | undefined;
};

/** An instruction decoded from the ROM at an offset of the bank. */
export type OzDecodedInstruction = {
  length: number;
  /** The listing text: `ld a,$80`, `jp nz,LC0B0`, `oz OS_Bye`. */
  text: string;
  /** The control-transfer target, as an offset in the bank, when inside it. */
  target?: number;
};

export type OzAlignInput = {
  /** The module's path, for messages. */
  path: string;
  text: string;
  /** The bank's 16K. */
  bytes: Uint8Array;
  /**
   * The offset in the bank where the module's first byte is. Absent: the module's own `org`, whose low
   * 14 bits are its offset (OZ places code so that they are).
   */
  start?: number;
  /**
   * The address of the bank's offset 0 in the segment the module runs in ($C000 for segment 3). A
   * label's value is its address, `base + offset` (`defw Label` stores it). Absent: the module's `org`
   * gives it, else $0000.
   */
  base?: number;
  /** The build's defines (`-DOZ_SLOT0`), each with the value 1. */
  defines: string[];
  reader: OzSourceReader;
  /** Klive's decoding of the instruction at an offset of the bank. */
  decodeAt(offset: number): OzDecodedInstruction | undefined;
};

// ------------------------------------------------------------------------------------------------
// Output

/** A line of the module placed on the ROM. */
export type OzPlacedLine = {
  file: string;
  line: number;
  offset: number;
  length: number;
  kind: "code" | "data";
  /** The source's trailing comment, if any. */
  comment?: string;
};

export type OzPlacedLabel = {
  name: string;
  offset: number;
  file: string;
  line: number;
  /** The comment lines right above the label (separators and blank lines dropped). */
  header: string[];
  /** A macro's own label (`.\start` in `macros.def`), not one of the source's: not exported. */
  internal?: boolean;
};

export type OzMismatch = {
  file: string;
  line: number;
  offset: number;
  source: string;
  decoded?: string;
  reason: string;
};

export type OzAlignResult = {
  /** The module's `org`, when it has one: its top two bits are the segment it runs in. */
  org?: number;
  /** The offset in the bank where the module starts. */
  start: number;
  labels: OzPlacedLabel[];
  lines: OzPlacedLine[];
  /** The offset just past the last placed byte. */
  end: number;
  /** The walk's stop, when it did not reach the module's end. */
  stop?: OzMismatch;
  /** Jumps and calls whose decoded target is not the label's offset. */
  targetMismatches: OzMismatch[];
  /** Lines of the module not placed (after a stop). */
  unplaced: number;
  /**
   * Jumps and calls to a symbol that is not a label of this module (another module's, through
   * `xref`), with their decoded targets: a project checks them once every module is placed.
   */
  externalJumps: { offset: number; file: string; line: number; label: string; source: string; target?: number }[];
};

// ------------------------------------------------------------------------------------------------
// Lines

type SourceLine = {
  file: string;
  line: number;
  label?: string;
  op?: string;
  args?: string;
  comment?: string;
  /** The line is only a comment (no label, no statement). */
  commentOnly: boolean;
  blank: boolean;
  /** A line a macro expansion made: its label is the macro's own. */
  internal?: boolean;
};

/** Splits a line at its comment: `;` outside a string and outside a character literal. */
export function splitComment(text: string): { code: string; comment?: string } {
  let quote: string | undefined;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = undefined;
      continue;
    }
    if (ch === '"') quote = ch;
    else if (ch === "'" && text[i + 2] === "'") i += 2;
    else if (ch === ";") return { code: text.slice(0, i), comment: text.slice(i + 1) };
  }
  return { code: text };
}

function parseLine(file: string, line: number, raw: string): SourceLine {
  const { code, comment } = splitComment(raw);
  const trimmedComment = comment?.trim();
  let rest = code.trim();
  const result: SourceLine = {
    file,
    line,
    commentOnly: rest.length === 0 && comment !== undefined,
    blank: rest.length === 0 && comment === undefined,
    ...(trimmedComment ? { comment: trimmedComment } : {})
  };
  // --- `.Label` (mpm), or `Label:`
  const dotted = /^\.([A-Za-z_][\w]*)\s*(.*)$/.exec(rest);
  const colon = /^([A-Za-z_][\w]*):\s*(.*)$/.exec(rest);
  const labelMatch = dotted ?? colon;
  if (labelMatch) {
    result.label = labelMatch[1];
    rest = labelMatch[2].trim();
  }
  if (rest) {
    // --- A macro called with its arguments in brackets and no space: `call_oz(gn_sop)`
    const bracketed = /^([A-Za-z_][\w]*)\((.*)\)$/.exec(rest);
    if (bracketed && !Z80_MNEMONICS.has(bracketed[1].toLowerCase())) {
      result.op = bracketed[1].toLowerCase();
      result.args = bracketed[2].trim();
      return result;
    }
    // --- The mnemonic ends at a space, or at a comma typed for one (`djnz,next_seconds_bit`)
    const space = rest.search(/[\s,]/);
    result.op = (space < 0 ? rest : rest.slice(0, space)).toLowerCase();
    result.args = space < 0 ? "" : rest.slice(space + 1).trim();
    // --- `scf return error` (flashstore/lib.asm): words after an instruction with no operands are a
    // --- comment with its semicolon left out; mpm ignores them (the ROM has the bare `scf`)
    if (NO_OPERANDS.has(result.op) && result.args) {
      if (!result.comment) result.comment = result.args;
      result.args = "";
    }
    // --- `pop af   : discard AF` (gndiedei.asm): a colon typed for a semicolon. mpm ignores what
    // --- follows it (the ROM has the bare `pop af`), so it is read as the comment
    const colon = /\s:\s/.exec(result.args);
    if (colon && !/["']/.test(result.args)) {
      const tail = result.args.slice(colon.index + colon[0].length).trim();
      result.args = result.args.slice(0, colon.index).trim();
      if (!result.comment && tail) result.comment = tail;
    }
  }
  return result;
}

// ------------------------------------------------------------------------------------------------
// Expressions

/**
 * A symbol: a number, a `defc` expression not evaluated yet, or a label, which is an offset in the
 * bank (its address is the segment's base plus the offset, `evaluateRelocatable`).
 */
type Symbols = Map<string, string | number | { offset: number }>;

/**
 * The value of an mpm expression, or `undefined` when a symbol in it is unknown.
 *
 * @param pc The current offset in the bank: `$` and `$PC` are `base + pc`
 * @param unknownAsZero An unknown symbol counts as 0, as in an mpm `IF` (`IF !__OZ_DEF__`, the guard)
 * @param base The address of the bank's offset 0, which labels and `$` are counted from
 */
export function evaluateOzExpression(
  text: string,
  symbols: Symbols,
  pc?: number,
  unknownAsZero = false,
  base = 0
): number | undefined {
  const tokens = tokenize(text);
  if (!tokens) return undefined;
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const resolving = new Set<string>();

  const symbolValue = (name: string): number | undefined => {
    if (name.toUpperCase() === "$PC" || name === "$") return pc === undefined ? undefined : base + pc;
    const value = symbols.get(name);
    if (typeof value === "number") return value;
    if (typeof value === "object") return base + value.offset;
    if (typeof value === "string") {
      if (resolving.has(name)) return undefined;
      resolving.add(name);
      const v = evaluateOzExpression(value, symbols, pc, false, base);
      resolving.delete(name);
      // --- A constant is kept evaluated; one that names a label or `$` depends on the base
      if (v !== undefined && evaluateOzExpression(value, symbols, pc, false, base + 0x10000) === v) {
        symbols.set(name, v);
      }
      return v;
    }
    return unknownAsZero && /^[A-Za-z_]/.test(name) ? 0 : undefined;
  };

  const primary = (): number | undefined => {
    const token = next();
    if (token === undefined) return undefined;
    if (token === "(") {
      const value = expression(0);
      if (next() !== ")") return undefined;
      return value;
    }
    if (token === "-") {
      const v = primary();
      return v === undefined ? undefined : -v;
    }
    if (token === "+") return primary();
    if (token === "~") {
      const v = primary();
      return v === undefined ? undefined : ~v;
    }
    if (token === "!") {
      const v = primary();
      return v === undefined ? undefined : v ? 0 : 1;
    }
    return literal(token) ?? symbolValue(token);
  };

  const BINARY: Record<string, [number, (a: number, b: number) => number]> = {
    "||": [1, (a, b) => (a || b ? 1 : 0)],
    "&&": [2, (a, b) => (a && b ? 1 : 0)],
    "|": [3, (a, b) => a | b],
    "^": [4, (a, b) => a ^ b],
    "&": [5, (a, b) => a & b],
    "=": [6, (a, b) => (a === b ? 1 : 0)],
    "==": [6, (a, b) => (a === b ? 1 : 0)],
    "!=": [6, (a, b) => (a !== b ? 1 : 0)],
    "<>": [6, (a, b) => (a !== b ? 1 : 0)],
    "<": [7, (a, b) => (a < b ? 1 : 0)],
    ">": [7, (a, b) => (a > b ? 1 : 0)],
    "<=": [7, (a, b) => (a <= b ? 1 : 0)],
    ">=": [7, (a, b) => (a >= b ? 1 : 0)],
    "<<": [8, (a, b) => a << b],
    ">>": [8, (a, b) => a >> b],
    "+": [9, (a, b) => a + b],
    "-": [9, (a, b) => a - b],
    "*": [10, (a, b) => a * b],
    "/": [10, (a, b) => (b === 0 ? NaN : Math.trunc(a / b))],
    "%": [10, (a, b) => (b === 0 ? NaN : a % b)]
  };

  const expression = (minPrecedence: number): number | undefined => {
    let left = primary();
    for (;;) {
      const op = peek();
      const entry = op !== undefined ? BINARY[op] : undefined;
      if (!entry || entry[0] < minPrecedence) return left;
      next();
      const right = expression(entry[0] + 1);
      left = left === undefined || right === undefined ? undefined : entry[1](left, right);
    }
  };

  const value = expression(0);
  if (pos !== tokens.length || value === undefined || Number.isNaN(value)) return undefined;
  return value;
}

/**
 * An expression as mpm's relocatable arithmetic gives it. Labels and `$` are relocatable: an
 * expression whose result moves with the base (`defw Label`, `ld hl,Label+3`) is an address, and
 * gets the segment's base; one that does not (`\end - $ - 1`, the difference of two addresses) or
 * moves the other way (`$0021-$PC`, the room left to an offset) is counted from the bank's start.
 * Evaluating it at two bases tells which.
 */
export function evaluateRelocatable(
  text: string,
  symbols: Symbols,
  pc: number | undefined,
  base: number
): number | undefined {
  const relative = evaluateOzExpression(text, symbols, pc, false, 0);
  if (relative === undefined || base === 0) return relative;
  const absolute = evaluateOzExpression(text, symbols, pc, false, base);
  if (absolute === undefined) return undefined;
  return absolute - relative === base ? absolute : relative;
}

function literal(token: string): number | undefined {
  if (/^\$[0-9a-f]+$/i.test(token)) return parseInt(token.slice(1), 16);
  if (/^0x[0-9a-f]+$/i.test(token)) return parseInt(token.slice(2), 16);
  if (/^[0-9][0-9a-f]*h$/i.test(token)) return parseInt(token.slice(0, -1), 16);
  if (/^@[01]+$/.test(token)) return parseInt(token.slice(1), 2);
  if (/^%[01]+$/.test(token)) return parseInt(token.slice(1), 2);
  if (/^[0-9]+$/.test(token)) return parseInt(token, 10);
  if (/^'.'$/.test(token)) return token.charCodeAt(1);
  return undefined;
}

function tokenize(text: string): string[] | undefined {
  const tokens: string[] = [];
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    const space = /^\s+/.exec(rest);
    if (space) {
      i += space[0].length;
      continue;
    }
    const match =
      /^'.'/.exec(rest) ??
      /^\$PC\b/i.exec(rest) ??
      /^\$[0-9a-f]+/i.exec(rest) ??
      /^0x[0-9a-f]+/i.exec(rest) ??
      /^[0-9][0-9a-f]*h\b/i.exec(rest) ??
      /^[0-9]+/.exec(rest) ??
      /^[@%][01]+/.exec(rest) ??
      /^[A-Za-z_][\w]*/.exec(rest) ??
      /^(\|\||&&|<<|>>|<=|>=|==|!=|<>)/.exec(rest) ??
      /^[-+*/%&|^~!()<>=$]/.exec(rest);
    if (!match) return undefined;
    tokens.push(match[0]);
    i += match[0].length;
  }
  return tokens;
}

/** Splits an argument list at its top-level commas (not inside brackets or quotes). */
export function splitArguments(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | undefined;
  let current = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      current += ch;
      if (ch === quote) quote = undefined;
      continue;
    }
    if (ch === '"') quote = ch;
    else if (ch === "'" && text[i + 2] === "'") {
      current += text.slice(i, i + 3);
      i += 2;
      continue;
    } else if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim() || parts.length) parts.push(current.trim());
  return parts;
}

// ------------------------------------------------------------------------------------------------
// Instruction shapes

const REGISTERS = new Set([
  "a", "b", "c", "d", "e", "h", "l", "i", "r", "f",
  "af", "bc", "de", "hl", "sp", "ix", "iy", "af'",
  "ixh", "ixl", "iyh", "iyl", "xh", "xl", "yh", "yl",
  "nz", "z", "nc", "po", "pe", "p", "m"
]);
const INDIRECT = new Set(["(hl)", "(bc)", "(de)", "(sp)", "(c)"]);

/** The index registers' halves under one spelling: mpm writes `ixl`, Klive lists `xl` */
const HALF_INDEX: Record<string, string> = { xh: "ixh", xl: "ixl", yh: "iyh", yl: "iyl" };

function operandShape(operand: string): string {
  const o = operand.replace(/\s+/g, "").toLowerCase();
  if (HALF_INDEX[o]) return HALF_INDEX[o];
  if (REGISTERS.has(o) || INDIRECT.has(o)) return o;
  // --- `(ix)` is `(ix+0)`: Klive lists a zero displacement without it, mpm source may write it
  if (o === "(ix)" || o === "(iy)") return `${o.slice(0, 3)}+N)`;
  const indexed = /^\((ix|iy)[-+].*\)$/.exec(o);
  if (indexed) return `(${indexed[1]}+N)`;
  if (o.startsWith("(") && o.endsWith(")")) return "(N)";
  return "N";
}

/**
 * An instruction's shape: mnemonic and operands, with every value one `N`. `ld a, (ix+3)` and
 * `ld a,(ix+$03)` are both `ld a,(ix+N)`; `jp nz, Loop` and `jp nz,LC0B0` are both `jp nz,N`.
 */
export function instructionShape(op: string, args: string): string {
  const mnemonic = op.toLowerCase();
  const raw = args.trim() ? splitArguments(args).map((a) => a.replace(/\s+/g, "").toLowerCase()) : [];
  // --- `jp (hl)` / `jp hl` are one instruction (no displacement); mpm and Klive may spell it either way
  if (mnemonic === "jp" && raw.length === 1 && /^\(?(hl|ix|iy)\)?$/.test(raw[0])) {
    return `jp (${raw[0].replace(/[()]/g, "")})`;
  }
  let operands = raw.map(operandShape);
  // --- `sub a,c` is `sub c`: mpm takes the accumulator spelled out for the one-operand ALU
  // --- instructions, on either side (`or MAT_ALLOCFIXED, a` in malloc.asm is `or $40`)
  if (/^(sub|and|or|xor|cp)$/.test(mnemonic) && operands.length === 2 && operands.includes("a")) {
    operands = operands[0] === "a" ? operands.slice(1) : operands.slice(0, 1);
  }
  // --- `sbc c` is `sbc a,c`: mpm takes the accumulator left out of `adc`/`sbc` with an 8-bit operand
  if (/^(adc|sbc)$/.test(mnemonic) && operands.length === 1) operands = ["a", ...operands];
  return operands.length ? `${mnemonic} ${operands.join(",")}` : mnemonic;
}

/** Splits a decoded listing text into its mnemonic and argument text. */
function splitDecoded(text: string): { op: string; args: string } {
  const t = text.trim();
  const space = t.search(/\s/);
  return space < 0 ? { op: t.toLowerCase(), args: "" } : { op: t.slice(0, space).toLowerCase(), args: t.slice(space + 1) };
}

const Z80_MNEMONICS = new Set(
  (
    "adc add and bit call ccf cp cpd cpdr cpi cpir cpl daa dec di djnz ei ex exx halt im in inc ind indr ini inir " +
    "jp jr ld ldd lddr ldi ldir neg nop or otdr otir out outd outi pop push res ret reti retn rl rla rlc rlca rld rr " +
    "rra rrc rrca rrd rst sbc scf set sla sll sl1 sra srl sub xor"
  ).split(" ")
);

/** The instructions that take no operands: words after one are a comment (`scf return error`). */
const NO_OPERANDS = new Set(
  (
    "ccf cpd cpdr cpi cpir cpl daa di ei exx halt ind indr ini inir ldd lddr ldi ldir neg nop otdr otir " +
    "outd outi reti retn rla rlca rld rra rrca rrd scf"
  ).split(" ")
);

// ------------------------------------------------------------------------------------------------
// The OZ call macros (`def/macros.def`): an RST followed by the call's code

/** The bytes an OZ call macro puts down, `undefined` for one whose value is not known. */
type CallBytes = (number | undefined)[];

const CALL_FORMS = new Set(["oz", "call_oz", "fpp", "extcall", "call_pkg"]);

/**
 * The bytes of `oz`/`call_oz` (RST 20h and the call: a byte, or a word above 255), `fpp` (RST 18h and
 * the operation), `extcall` (RST 28h, the address and the bank as words) and `call_pkg` (RST 08h and
 * a word), as `macros.def` defines them. An `oz` call whose code is not known takes its width from the
 * ROM (the decoded row's length).
 */
function callBytes(
  op: string,
  args: string,
  value: (text: string) => number | undefined,
  decodedLength: number | undefined
): CallBytes | undefined {
  const values = splitArguments(args).map(value);
  const word = (v: number | undefined): CallBytes => [
    v === undefined ? undefined : v & 0xff,
    v === undefined ? undefined : (v >> 8) & 0xff
  ];
  switch (op) {
    case "oz":
    case "call_oz": {
      const v = values[0];
      if (v === undefined) {
        if (decodedLength === undefined || decodedLength < 2) return undefined;
        return [0xe7, ...new Array<number | undefined>(decodedLength - 1).fill(undefined)];
      }
      return v > 255 ? [0xe7, ...word(v)] : [0xe7, v & 0xff];
    }
    case "fpp":
      return [0xdf, values[0] === undefined ? undefined : values[0] & 0xff];
    case "extcall":
      return [0xef, ...word(values[0]), ...word(values[1])];
    case "call_pkg":
      return [0xcf, ...word(values[0])];
    default:
      return undefined;
  }
}

// ------------------------------------------------------------------------------------------------
// Reading the module: includes, conditions, constants

type Statement = SourceLine & { op: string };

/** An mpm macro: `macro name (param, param = default)` ... `endmacro`. */
type OzMacro = { name: string; params: { name: string; fallback?: string }[]; body: string[] };

type Prepared = {
  /** The module's own lines, conditions applied (includes read for their symbols only). */
  lines: SourceLine[];
  symbols: Symbols;
  problems: string[];
  /** The macros the module and its includes define, by lower-case name. */
  macros: Map<string, OzMacro>;
};

function prepare(input: OzAlignInput): Prepared {
  const symbols: Symbols = new Map();
  for (const define of input.defines) symbols.set(define, 1);
  const problems: string[] = [];
  const lines: SourceLine[] = [];
  const macros = new Map<string, OzMacro>();
  let defvarsNext = 0;

  const read = (path: string, text: string, own: boolean, depth: number) => {
    if (depth > 16) {
      problems.push(`${path}: includes nested too deep`);
      return;
    }
    // --- The IF stack: whether each level is active, and whether a branch of it was taken
    const conditions: { active: boolean; taken: boolean }[] = [];
    const active = () => conditions.every((c) => c.active);
    let inDefvars = false;
    let inDefgroup = false;
    let defgroupNext = 0;
    let macro: OzMacro | undefined;
    const rows = text.split(/\r?\n/);
    for (let index = 0; index < rows.length; index++) {
      const parsed = parseLine(path, index + 1, rows[index]);
      const op = parsed.op;
      // --- A macro's body is kept as written: its IFs belong to each expansion
      if (macro) {
        if (op === "endmacro") {
          macros.set(macro.name.toLowerCase(), macro);
          macro = undefined;
        } else {
          macro.body.push(rows[index]);
        }
        continue;
      }
      if (op === "macro" && active()) {
        const m = /^([A-Za-z_][\w]*)\s*(?:\((.*)\))?\s*$/.exec(parsed.args ?? "");
        if (m) {
          macro = {
            name: m[1],
            params: splitArguments(m[2] ?? "")
              .filter(Boolean)
              .map((p) => {
                const [name, fallback] = p.split("=").map((x) => x.trim());
                return fallback !== undefined ? { name, fallback } : { name };
              }),
            body: []
          };
        }
        continue;
      }
      // --- Conditions are read whether or not the level is active
      if (op === "if") {
        const outer = active();
        const value = outer ? evaluateOzExpression(parsed.args ?? "", symbols, undefined, true) : 0;
        conditions.push({ active: outer && !!value, taken: outer && !!value });
        continue;
      }
      if (op === "else") {
        const top = conditions[conditions.length - 1];
        if (top) {
          const outer = conditions.slice(0, -1).every((c) => c.active);
          top.active = outer && !top.taken;
          top.taken = top.taken || top.active;
        }
        continue;
      }
      if (op === "endif") {
        conditions.pop();
        continue;
      }
      if (!active()) continue;

      if (inDefvars) {
        if (op === "enddef" || op === "}" || parsed.label === "enddef") {
          inDefvars = false;
          continue;
        }
        // --- `name ds.b n` (the name is written without a dot inside defvars)
        const field = /^\s*([A-Za-z_][\w]*)\s+ds\.([bwpl])\s+(.+?)\s*(;.*)?$/i.exec(rows[index]);
        if (field) {
          const size = { b: 1, w: 2, p: 3, l: 4 }[field[2].toLowerCase() as "b" | "w" | "p" | "l"];
          const count = evaluateOzExpression(field[3], symbols) ?? 0;
          symbols.set(field[1], defvarsNext);
          defvarsNext += size * count;
        }
        continue;
      }
      if (inDefgroup) {
        if (op === "enddef" || op === "}" || parsed.label === "enddef") {
          inDefgroup = false;
          continue;
        }
        // --- `name, name = value, name`: consecutive values, `= value` restarting the count
        for (const item of splitComment(rows[index]).code.split(/[,{}]/)) {
          const m = /^\s*([A-Za-z_][\w]*)\s*(?:=\s*(.+?))?\s*$/.exec(item);
          if (!m) continue;
          if (m[2] !== undefined) defgroupNext = evaluateOzExpression(m[2], symbols) ?? defgroupNext;
          symbols.set(m[1], defgroupNext++);
        }
        continue;
      }

      switch (op) {
        case "defgroup":
          inDefgroup = true;
          defgroupNext = 0;
          continue;
        case "include": {
          const name = (parsed.args ?? "").replace(/^["']|["']$/g, "");
          const file = input.reader.include(path, name);
          if (!file) {
            problems.push(`${path}:${index + 1}: include "${name}" not found (its symbols are unknown)`);
          } else {
            read(file.path, file.text, false, depth + 1);
          }
          continue;
        }
        case "define":
          symbols.set((parsed.args ?? "").trim(), 1);
          continue;
        case "defc": {
          // --- `defc NAME = expr`
          const m = /^([A-Za-z_][\w]*)\s*=\s*(.+)$/.exec(parsed.args ?? "");
          if (m) symbols.set(m[1], m[2].trim());
          continue;
        }
        case "defvars": {
          const base = (parsed.args ?? "").replace(/\{.*$/, "").trim();
          const value = evaluateOzExpression(base, symbols);
          // --- `defvars -1` continues where the last block ended
          if (value !== undefined && value !== -1) defvarsNext = value;
          inDefvars = true;
          continue;
        }
        default:
          if (own) lines.push(parsed);
      }
    }
  };
  read(input.path, input.text, true, 0);
  return { lines, symbols, problems, macros };
}

/**
 * A macro call's lines, as mpm expands it (`def/macros.def`): `\param` is the argument (or its default),
 * `\%` the number of arguments given, `\$?[n]` whether argument n is given, and any other `\name` a
 * label of this expansion's own (`.\start`). The body's `IF`s are decided here, `exitmacro` ends the
 * expansion and an `error` in force is the source's error. A macro called from the body is left as a
 * line: the walk expands it in turn. The lines carry the call's place in the source, and the call's
 * comment goes to the first of them.
 */
function expandMacro(
  macro: OzMacro,
  call: Statement,
  symbols: Symbols,
  nextId: () => number
): { lines: SourceLine[] } | { error: string } {
  const args = call.args?.trim() ? splitArguments(call.args) : [];
  const given = (n: number) => args[n] !== undefined && args[n] !== "";
  const id = nextId();
  const valueOf = (i: number) => (given(i) ? args[i] : (macro.params[i]?.fallback ?? ""));
  const paramIndex = (word: string) => macro.params.findIndex((p) => p.name.toLowerCase() === word.toLowerCase());
  const substitute = (row: string) =>
    row
      // --- `defm "\string"` with a string argument: its text, not the string twice quoted
      .replace(/"\\([A-Za-z_][\w]*)"/g, (whole, word: string) => {
        const i = paramIndex(word);
        return i < 0 ? whole : `"${valueOf(i).replace(/^"(.*)"$/, "$1")}"`;
      })
      .replace(/\\\$\?\[(\d+)\]/g, (_, n) => (given(Number(n)) ? "1" : "0"))
      .replace(/\\%/g, String(args.filter((a) => a !== "").length))
      .replace(/\\\$\$/g, valueOf(0))
      .replace(/\\([A-Za-z_][\w]*)/g, (_, word: string) => {
        const i = macro.params.findIndex((p) => p.name.toLowerCase() === word.toLowerCase());
        return i >= 0 ? valueOf(i) : `${word}__m${id}`;
      });

  const lines: SourceLine[] = [];
  const conditions: { active: boolean; taken: boolean }[] = [];
  const active = () => conditions.every((c) => c.active);
  for (const row of macro.body) {
    const parsed = parseLine(call.file, call.line, substitute(row));
    const op = parsed.op;
    if (op === "if") {
      const outer = active();
      const v = outer ? evaluateOzExpression(parsed.args ?? "", symbols, undefined, true) : 0;
      conditions.push({ active: outer && !!v, taken: outer && !!v });
      continue;
    }
    if (op === "else") {
      const top = conditions[conditions.length - 1];
      if (top) {
        top.active = conditions.slice(0, -1).every((c) => c.active) && !top.taken;
        top.taken = top.taken || top.active;
      }
      continue;
    }
    if (op === "endif") {
      conditions.pop();
      continue;
    }
    if (!active()) continue;
    if (op === "exitmacro") break;
    if (op === "error") return { error: `the ${macro.name} macro's error: ${parsed.args ?? ""}` };
    if (parsed.blank || parsed.commentOnly) continue;
    lines.push({ ...parsed, internal: true, comment: lines.length === 0 ? call.comment : undefined });
  }
  return { lines };
}

// ------------------------------------------------------------------------------------------------
// Data sizes

const DATA_DIRECTIVES = new Set(["defb", "defm", "defw", "defp", "defl", "defs", "binary", "db", "dw", "dm", "ds"]);
const IGNORED = new Set([
  "module", "xdef", "xref", "lib", "xlib", "lstoff", "lston", "org", "include", "defc", "define", "defvars",
  "defgroup", "enddef"
]);

/**
 * The bytes a data directive puts down: each value known (`number`) or not (`undefined`, a symbol
 * the aligner cannot evaluate), or `undefined` when even the size is not known.
 */
function dataBytes(
  statement: Statement,
  value: (text: string) => number | undefined
): (number | undefined)[] | undefined {
  const args = statement.args ?? "";
  const op = statement.op;
  if (op === "defs" || op === "ds") {
    // --- `defs count`, `defs count, fill`, `defs (count) (fill)` or `defs count (fill)`
    const m =
      /^\((.*)\)\s*\((.*)\)\s*$/.exec(args) ??
      /^([^(),]+?)\s*\(([^()]*)\)\s*$/.exec(args) ??
      /^(.*?)(?:,\s*(.*))?$/.exec(args);
    if (!m) return undefined;
    const count = value(m[1]);
    if (count === undefined || count < 0 || count > 0x4000) return undefined;
    const fill = m[2] !== undefined ? value(m[2]) : 0;
    return new Array(count).fill(fill === undefined ? undefined : fill & 0xff);
  }
  const width = op === "defw" || op === "dw" ? 2 : op === "defp" ? 3 : op === "defl" ? 4 : 1;
  const bytes: (number | undefined)[] = [];
  for (const item of splitArguments(args)) {
    if (!item) continue;
    const string = /^"(.*)"$/.exec(item);
    if (string) {
      // --- `\\` is one backslash and `\"` a quote (calc.asm's `"PTXMD\\E"` is `PTXMD\E` in the ROM)
      for (const ch of string[1].replace(/\\([\\"])/g, "$1")) bytes.push(ch.charCodeAt(0) & 0xff);
      continue;
    }
    const v = value(item);
    for (let k = 0; k < width; k++) bytes.push(v === undefined ? undefined : (v >> (8 * k)) & 0xff);
  }
  return bytes;
}

// ------------------------------------------------------------------------------------------------
// The walk

/** Places a module's lines on the bank's bytes (see the file's header). */
export function alignOzModule(input: OzAlignInput): OzAlignResult & { problems: string[] } {
  const { lines, symbols, problems, macros } = prepare(input);
  let expansions = 0;
  const labels: OzPlacedLabel[] = [];
  const placed: OzPlacedLine[] = [];
  const jumps: { from: OzPlacedLine; label: string; source: string; target?: number }[] = [];
  let offset = input.start ?? 0;
  let start = input.start;
  let base = input.base ?? 0;
  let org: number | undefined;
  let stop: OzMismatch | undefined;
  let header: string[] = [];
  let index = 0;

  for (; index < lines.length; index++) {
    const line = lines[index];
    if (line.blank) continue;
    if (line.commentOnly) {
      const text = line.comment ?? "";
      // --- A separator (`;       ----`) or an empty comment line ends a header
      if (/^[-=*\s]*$/.test(text)) header = [];
      else header.push(text);
      continue;
    }
    if (line.label) {
      labels.push({
        name: line.label,
        offset,
        file: line.file,
        line: line.line,
        header,
        ...(line.internal ? { internal: true } : {})
      });
      symbols.set(line.label, { offset });
      header = [];
    }
    if (!line.op) continue;
    header = [];
    const statement = line as Statement;
    const op = statement.op;
    if (op === "org") {
      // --- Only a module's first org places it; a later one would need an address to jump to
      const value = evaluateOzExpression(statement.args ?? "", symbols);
      if (value === undefined) {
        stop = mismatch(statement, offset, "the org's address is not known");
        break;
      }
      if (placed.length > 0) {
        stop = mismatch(statement, offset, "an org after code (not supported yet)");
        break;
      }
      org = value;
      if (input.base === undefined) base = value & 0xc000;
      if (start === undefined) {
        start = value & 0x3fff;
        offset = start;
        for (const label of labels) {
          label.offset = start;
          symbols.set(label.name, { offset: start });
        }
      }
      continue;
    }
    if (IGNORED.has(op)) continue;
    if (start === undefined) start = offset;
    // --- An expression's value here: labels and `$` relocatable, from this segment's base
    const here = offset;
    const value = (text: string) => evaluateRelocatable(text, symbols, here, base);

    // --- A macro (`dorchd`, `mthcmd`, ...): its expansion takes the call's place, line by line
    const macro = macros.get(op);
    if (macro && !CALL_FORMS.has(op)) {
      const expanded = expandMacro(macro, statement, symbols, () => ++expansions);
      if ("error" in expanded) {
        stop = mismatch(statement, offset, expanded.error);
        break;
      }
      lines.splice(index + 1, 0, ...expanded.lines);
      continue;
    }

    if (DATA_DIRECTIVES.has(op)) {
      if (op === "binary") {
        stop = mismatch(statement, offset, "a binary include (not read yet)");
        break;
      }
      const bytes = dataBytes(statement, value);
      if (!bytes) {
        stop = mismatch(statement, offset, "the size of this data is not known");
        break;
      }
      const wrong = bytes.findIndex((b, k) => b !== undefined && input.bytes[offset + k] !== b);
      if (offset + bytes.length > input.bytes.length) {
        stop = mismatch(statement, offset, "the data runs past the bank");
        break;
      }
      if (wrong >= 0) {
        stop = mismatch(
          statement,
          offset,
          `byte ${wrong} is $${hex2(input.bytes[offset + wrong])} in the ROM, $${hex2(bytes[wrong]!)} in the source`
        );
        break;
      }
      placed.push(placedLine(statement, offset, bytes.length, "data"));
      offset += bytes.length;
      continue;
    }

    if (CALL_FORMS.has(op)) {
      const bytes = callBytes(op, statement.args ?? "", value, input.decodeAt(offset)?.length);
      if (!bytes) {
        stop = mismatch(statement, offset, "the call's width is not known");
        break;
      }
      const wrong = bytes.findIndex((b, k) => b !== undefined && input.bytes[offset + k] !== b);
      if (wrong >= 0) {
        stop = mismatch(
          statement,
          offset,
          `byte ${wrong} is $${hex2(input.bytes[offset + wrong])} in the ROM, $${hex2(bytes[wrong]!)} in the source`
        );
        break;
      }
      placed.push(placedLine(statement, offset, bytes.length, "code"));
      offset += bytes.length;
      continue;
    }

    if (!Z80_MNEMONICS.has(op)) {
      stop = mismatch(statement, offset, `"${op}" is not an instruction or a directive the aligner knows`);
      break;
    }
    const decoded = input.decodeAt(offset);
    if (!decoded) {
      stop = mismatch(statement, offset, "nothing decodes here");
      break;
    }
    const expected = instructionShape(op, statement.args ?? "");
    const { op: decodedOp, args: decodedArgs } = splitDecoded(decoded.text);
    const actual = instructionShape(decodedOp, decodedArgs);
    if (expected !== actual) {
      stop = { ...mismatch(statement, offset, `the shapes differ: ${expected} / ${actual}`), decoded: decoded.text };
      break;
    }
    const entry = placedLine(statement, offset, decoded.length, "code");
    placed.push(entry);
    // --- A jump or call to a plain symbol is checked once every label is known
    if (/^(jp|jr|call|djnz)$/.test(op)) {
      const operands = splitArguments(statement.args ?? "");
      const target = operands[operands.length - 1];
      if (target && /^[A-Za-z_][\w]*$/.test(target) && !REGISTERS.has(target.toLowerCase())) {
        jumps.push({ from: entry, label: target, source: `${op} ${statement.args}`, target: decoded.target });
      }
    }
    offset += decoded.length;
  }

  const unplaced = stop ? lines.slice(index).filter((l) => !l.blank && !l.commentOnly).length : 0;
  const local = new Map(labels.map((l) => [l.name, l.offset]));
  const targetMismatches: OzMismatch[] = [];
  const externalJumps: OzAlignResult["externalJumps"] = [];
  for (const jump of jumps) {
    const labelOffset = local.get(jump.label);
    if (labelOffset === undefined) {
      externalJumps.push({
        offset: jump.from.offset,
        file: jump.from.file,
        line: jump.from.line,
        label: jump.label,
        source: jump.source,
        ...(jump.target !== undefined ? { target: jump.target } : {})
      });
      continue;
    }
    if (jump.target !== labelOffset) {
      targetMismatches.push({
        file: jump.from.file,
        line: jump.from.line,
        offset: jump.from.offset,
        source: jump.source,
        reason: `the target is ${jump.target === undefined ? "outside the bank" : `$${hex4(jump.target)}`}, the label is at $${hex4(labelOffset)}`
      });
    }
  }
  return {
    ...(org !== undefined ? { org } : {}),
    start: start ?? offset,
    labels,
    lines: placed,
    end: offset,
    stop,
    targetMismatches,
    unplaced,
    externalJumps,
    problems
  };
}

function placedLine(statement: Statement, offset: number, length: number, kind: "code" | "data"): OzPlacedLine {
  return {
    file: statement.file,
    line: statement.line,
    offset,
    length,
    kind,
    ...(statement.comment ? { comment: statement.comment } : {})
  };
}

function mismatch(statement: Statement, offset: number, reason: string): OzMismatch {
  return {
    file: statement.file,
    line: statement.line,
    offset,
    source: `${statement.op} ${statement.args ?? ""}`.trim(),
    reason
  };
}

const hex2 = (v: number) => v.toString(16).toUpperCase().padStart(2, "0");
const hex4 = (v: number) => v.toString(16).toUpperCase().padStart(4, "0");

// ------------------------------------------------------------------------------------------------
// Label names

/**
 * Common words of OZ's label names and their abbreviations, for `shortLabelName`. Matched whole and
 * without regard to case; the abbreviation keeps the word's own capitalisation.
 */
const WORD_ABBREVIATIONS: Record<string, string> = {
  address: "addr", allocate: "alloc", application: "app", available: "avail", buffer: "buf",
  calculate: "calc", character: "chr", check: "chk", command: "cmd", compare: "cmp", count: "cnt",
  current: "cur", default: "dflt", delete: "del", device: "dev", directory: "dir", display: "disp",
  enable: "enbl", entry: "ent", error: "err", execute: "exec", filename: "fname", format: "fmt",
  handle: "hnd", handshaking: "hshk", header: "hdr", information: "info", initialise: "init",
  initialize: "init", length: "len", message: "msg", number: "num", parameter: "par", pointer: "ptr",
  position: "pos", previous: "prev", print: "prt", process: "proc", program: "prog", programming: "prog",
  receive: "rcv", received: "rcvd", release: "rel", request: "req", restore: "rstr", return: "ret",
  select: "sel", selected: "sel", settings: "sets", space: "spc", status: "stat", string: "str",
  system: "sys", table: "tbl", toggle: "tgl", total: "tot", transfer: "xfer", translations: "trans",
  update: "upd", validate: "valid", value: "val", verify: "vrfy", window: "win", block: "blk",
  blocks: "blks", banner: "bnr", create: "crt", files: "fls", filearea: "farea", partial: "part",
  active: "act", empty: "empty", fetch: "fetch", topic: "tpc", aborted: "abrtd", adjust: "adj"
};

/** A name split into words: at underscores and at a lower-case letter followed by a capital. */
function nameWords(name: string): string[] {
  return name
    .split(/(_+)/)
    .flatMap((part) => (part.startsWith("_") ? [part] : part.split(/(?<=[a-z0-9])(?=[A-Z])/)))
    .filter((w) => w.length > 0);
}

function withCase(word: string, abbreviation: string): string {
  if (word === word.toUpperCase()) return abbreviation.toUpperCase();
  if (word[0] === word[0].toUpperCase()) return abbreviation[0].toUpperCase() + abbreviation.slice(1);
  return abbreviation;
}

/**
 * A label name of at most `max` characters for an OZ name that is longer (Klive's labels have 16), by
 * rules a reader can undo: common words are abbreviated (`Display` -> `Disp`), then the inner vowels of
 * the longest words are dropped (`Bullet` -> `Bllt`), then, only if still too long, the longest words
 * are cut. A name `taken` gets a number. Deterministic, so a re-import gives the same names; the
 * import records each in the reviewed table (`z88-label-renames.json`), where a hand-made name wins.
 */
export function shortLabelName(name: string, taken: ReadonlySet<string> = new Set(), max = 16): string {
  const fits = (words: string[]) => words.join("").length <= max;
  let words = nameWords(name);
  if (!fits(words)) {
    words = words.map((w) => {
      const abbreviation = WORD_ABBREVIATIONS[w.toLowerCase()];
      return abbreviation ? withCase(w, abbreviation) : w;
    });
  }
  // --- Then the words lose their inner vowels, the longest first, every word before any is cut;
  // --- only then is the longest word cut, a letter at a time, to no less than two
  const longestWhere = (ok: (w: string) => boolean) =>
    words.reduce((best, w, i) => (!w.startsWith("_") && ok(w) && w.length > (words[best]?.length ?? 0) ? i : best), -1);
  // --- Words of five letters or more lose their vowels before the short ones (`File`, `Page`) do
  for (const minimum of [5, 3]) {
    const innerVowels = (w: string) => w.length >= minimum && /[aeiou]/.test(w.slice(1, -1));
    while (!fits(words)) {
      const i = longestWhere(innerVowels);
      if (i < 0) break;
      const w = words[i];
      words[i] = w[0] + w.slice(1, -1).replace(/[aeiou]/g, "") + w[w.length - 1];
    }
  }
  while (!fits(words)) {
    const i = longestWhere((w) => w.length > 2);
    if (i < 0) break;
    words[i] = words[i].slice(0, -1);
  }
  // --- Separators go last, then a hard cut (a name that is all one word)
  let result = words.join("");
  if (result.length > max) result = words.map((w) => (w.startsWith("_") ? "_" : w)).join("");
  if (result.length > max) result = result.slice(0, max);
  if (!taken.has(result)) return result;
  for (let n = 2; n < 100; n++) {
    const suffix = String(n);
    const candidate = result.slice(0, max - suffix.length) + suffix;
    if (!taken.has(candidate)) return candidate;
  }
  return result;
}

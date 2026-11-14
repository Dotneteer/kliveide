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
    const space = rest.search(/\s/);
    result.op = (space < 0 ? rest : rest.slice(0, space)).toLowerCase();
    result.args = space < 0 ? "" : rest.slice(space + 1).trim();
  }
  return result;
}

// ------------------------------------------------------------------------------------------------
// Expressions

type Symbols = Map<string, string | number>;

/** The value of an mpm expression, or `undefined` when a symbol in it is unknown. */
export function evaluateOzExpression(
  text: string,
  symbols: Symbols,
  pc?: number,
  /** An unknown symbol counts as 0, as in an mpm `IF` (`IF !__OZ_DEF__`, the include guard) */
  unknownAsZero = false
): number | undefined {
  const tokens = tokenize(text);
  if (!tokens) return undefined;
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const resolving = new Set<string>();

  const symbolValue = (name: string): number | undefined => {
    if (name.toUpperCase() === "$PC" || name === "$") return pc;
    const key = [...symbols.keys()].find((k) => k === name) ?? name;
    const value = symbols.get(key);
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      if (resolving.has(key)) return undefined;
      resolving.add(key);
      const v = evaluateOzExpression(value, symbols, pc);
      resolving.delete(key);
      if (v !== undefined) symbols.set(key, v);
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

function operandShape(operand: string): string {
  const o = operand.replace(/\s+/g, "").toLowerCase();
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
  const operands = raw.map(operandShape);
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

// ------------------------------------------------------------------------------------------------
// Reading the module: includes, conditions, constants

type Statement = SourceLine & { op: string };

type Prepared = {
  /** The module's own lines, conditions applied (includes read for their symbols only). */
  lines: SourceLine[];
  symbols: Symbols;
  problems: string[];
};

function prepare(input: OzAlignInput): Prepared {
  const symbols: Symbols = new Map();
  for (const define of input.defines) symbols.set(define, 1);
  const problems: string[] = [];
  const lines: SourceLine[] = [];
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
    const rows = text.split(/\r?\n/);
    for (let index = 0; index < rows.length; index++) {
      const parsed = parseLine(path, index + 1, rows[index]);
      const op = parsed.op;
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

      switch (op) {
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
  return { lines, symbols, problems };
}

// ------------------------------------------------------------------------------------------------
// Data sizes

const DATA_DIRECTIVES = new Set(["defb", "defm", "defw", "defp", "defl", "defs", "binary", "db", "dw", "dm", "ds"]);
const IGNORED = new Set([
  "module", "xdef", "xref", "lib", "xlib", "lstoff", "lston", "org", "include", "defc", "define", "defvars"
]);

/**
 * The bytes a data directive puts down: each value known (`number`) or not (`undefined`, a symbol
 * the aligner cannot evaluate), or `undefined` when even the size is not known.
 */
function dataBytes(
  statement: Statement,
  symbols: Symbols,
  pc: number
): (number | undefined)[] | undefined {
  const args = statement.args ?? "";
  const op = statement.op;
  if (op === "defs" || op === "ds") {
    // --- `defs count` or `defs (count) (fill)`; mpm's form puts both in brackets
    const m = /^\((.*)\)\s*\((.*)\)\s*$/.exec(args) ?? /^(.*?)(?:,\s*(.*))?$/.exec(args);
    if (!m) return undefined;
    const count = evaluateOzExpression(m[1], symbols, pc);
    if (count === undefined || count < 0 || count > 0x4000) return undefined;
    const fill = m[2] !== undefined ? evaluateOzExpression(m[2], symbols, pc) : 0;
    return new Array(count).fill(fill === undefined ? undefined : fill & 0xff);
  }
  const width = op === "defw" || op === "dw" ? 2 : op === "defp" ? 3 : op === "defl" ? 4 : 1;
  const bytes: (number | undefined)[] = [];
  for (const item of splitArguments(args)) {
    if (!item) continue;
    const string = /^"(.*)"$/.exec(item);
    if (string) {
      for (const ch of string[1]) bytes.push(ch.charCodeAt(0) & 0xff);
      continue;
    }
    const value = evaluateOzExpression(item, symbols, pc);
    for (let k = 0; k < width; k++) bytes.push(value === undefined ? undefined : (value >> (8 * k)) & 0xff);
  }
  return bytes;
}

// ------------------------------------------------------------------------------------------------
// The walk

/** Places a module's lines on the bank's bytes (see the file's header). */
export function alignOzModule(input: OzAlignInput): OzAlignResult & { problems: string[] } {
  const { lines, symbols, problems } = prepare(input);
  const labels: OzPlacedLabel[] = [];
  const placed: OzPlacedLine[] = [];
  const jumps: { from: OzPlacedLine; label: string; source: string; target?: number }[] = [];
  let offset = input.start ?? 0;
  let start = input.start;
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
      labels.push({ name: line.label, offset, file: line.file, line: line.line, header });
      symbols.set(line.label, offset);
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
      if (start === undefined) {
        start = value & 0x3fff;
        offset = start;
        for (const label of labels) {
          label.offset = start;
          symbols.set(label.name, start);
        }
      }
      continue;
    }
    if (IGNORED.has(op)) continue;
    if (start === undefined) start = offset;
    const pcRelative = offset - start;

    if (DATA_DIRECTIVES.has(op)) {
      if (op === "binary") {
        stop = mismatch(statement, offset, "a binary include (not read yet)");
        break;
      }
      const bytes = dataBytes(statement, symbols, pcRelative);
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
  for (const jump of jumps) {
    const labelOffset = local.get(jump.label);
    if (labelOffset === undefined) continue;
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

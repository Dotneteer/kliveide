import { isZ80Keyword } from "@main/z80-compiler/z80-token-stream";

/**
 * Inline assembly in zxbasm's dialect (compatibility plan C5, D-C4) turned into Klive's assembler
 * dialect before assembly. The dialect's rules come from upstream's documentation and from what zxbc
 * does with Klive's own test programs (the `asm` compatibility suite), never from zxbasm's source:
 *
 * - `:` separates instructions on a line; `;` starts a comment. Mnemonics, registers and
 *   directives ignore case; labels do not.
 * - Numbers: `$1F`, `0x1F`, `1Fh` hexadecimal, `%101` binary, `'A'` a character code. A number
 *   ending in `b` or `f` is a temporary label reference (`1b` is the `1:` label before, `1f` the one
 *   after), not a binary or hexadecimal number.
 * - `PROC` ... `ENDP` makes only the names its `LOCAL` lines list local to it; every other label in
 *   it stays global (Klive's `.proc` makes them all local, so this is done by renaming instead).
 * - A label may start with a dot (`.skip:`). `.LABEL._name` is a BASIC label, `._name` a global,
 *   `.core.name` the runtime (through `RUNTIME_ALIASES`).
 * - `DEFB`/`DB`, `DEFW`/`DW`, `DEFS`/`DS` (with a fill value), `DEFM`/`DM`, `EQU`, `ALIGN`;
 *   strings double a quote to include it.
 *
 * Labels the zxbasm code defines that are keywords of Klive's assembler (`bank`) are renamed
 * everywhere in the program's zxbasm blocks.
 */
export type AsmLine = { text: string; span: unknown };

/**
 * zxbc runtime entry points user asm may call, by their upstream name (after `.core.`), and the
 * Klive runtime routine with the same register contract. Filled per supported library (plan §6.5):
 * NextLib calls none.
 */
export const RUNTIME_ALIASES: Record<string, string> = {};

type Token = { kind: "word" | "number" | "string" | "char" | "op" | "space"; text: string };

/** Mnemonics that take no operand: `rlca : rlca` is two instructions, not a label and one. */
const BARE_MNEMONICS = new Set(
  (
    "nop halt di ei exx rlca rrca rla rra daa cpl scf ccf ret reti retn ldi ldir ldd lddr cpi cpir cpd cpdr ini inir ind indr " +
    "outi otir outd otdr neg rld rrd swapnib mirror pixeldn pixelad setae ldix ldirx lddx lddrx ldpirx ldws outinb"
  ).split(" ")
);

const DIRECTIVES: Record<string, string> = {
  db: ".defb", defb: ".defb", dw: ".defw", defw: ".defw", ds: ".defs", defs: ".defs", dm: ".defm", defm: ".defm",
  equ: ".equ", align: ".align", org: ".org"
};

/** Converts every block, in place: each returned line keeps the span of the source line it came from. */
export function convertZxbasmBlocks(blocks: AsmLine[][], report: (span: unknown, message: string) => void = () => {}): AsmLine[][] {
  // --- Pass 1: labels the zxbasm code defines that Klive's assembler reads as keywords
  const clashes = new Set<string>();
  for (const block of blocks) {
    for (const line of block) {
      const statements = split(tokenize(line.text));
      for (const st of statements) {
        const words = st.filter((t) => t.kind !== "space");
        const first = words[0];
        if (first?.kind !== "word" || first.text.startsWith(".")) continue;
        const isLabel = words[1]?.kind === "op" && words[1].text === ":";
        const isEqu = words[1]?.kind === "word" && words[1].text.toLowerCase() === "equ";
        if ((isLabel || isEqu) && isZ80Keyword(first.text) && !DIRECTIVES[first.text.toLowerCase()]) clashes.add(first.text);
      }
    }
  }
  // --- Pass 2: every statement of every block, in order: zxbc assembles the blocks as one file, so
  // --- a PROC and its temporary labels may span blocks, and LOCAL covers the whole PROC
  let unique = 0;
  const next = () => unique++;
  type Item = { block: number; line: number; st: Token[]; scope: number };
  const items: Item[] = [];
  const scopes: { parent: number; locals: Map<string, string> }[] = [{ parent: -1, locals: new Map() }];
  let scope = 0;
  blocks.forEach((block, bi) =>
    block.forEach((line, li) => {
      for (const raw of split(tokenize(line.text))) {
        const st = raw.filter((t) => t.kind !== "space");
        const head = st[0]?.kind === "word" ? st[0].text.toLowerCase() : "";
        if (head === "proc") {
          scopes.push({ parent: scope, locals: new Map() });
          scope = scopes.length - 1;
        }
        items.push({ block: bi, line: li, st, scope });
        if (head === "local") for (const t of st.slice(1)) if (t.kind === "word") scopes[scope].locals.set(t.text, `${t.text}__zxl${next()}`);
        if (head === "endp" && scope > 0) scope = scopes[scope].parent;
      }
    })
  );
  const temps: Temp[] = [];
  items.forEach((it, k) => {
    if (it.st[0]?.kind === "number" && /^\d+$/.test(it.st[0].text) && it.st[1]?.text === ":") temps.push({ n: it.st[0].text, at: k, name: `__zxt${it.st[0].text}_${next()}` });
  });

  const out: AsmLine[][] = blocks.map(() => []);
  // --- The source lines each block has given out so far: the ones without a statement stay blank
  const done = blocks.map(() => -1);
  const fill = (bi: number, upTo: number) => {
    while (done[bi] < upTo) out[bi].push({ text: "", span: blocks[bi][++done[bi]].span });
  };
  items.forEach((it, k) => {
    fill(it.block, it.line - 1);
    done[it.block] = it.line;
    const span = blocks[it.block][it.line].span;
    const head = it.st[0]?.kind === "word" ? it.st[0].text.toLowerCase() : "";
    if (head === "proc" || head === "endp" || head === "local") {
      out[it.block].push({ text: `; ${head.toUpperCase()}`, span });
      return;
    }
    // --- `name: EQU value` is a syntax error to zxbasm (the colon-less `name EQU value` is its form)
    if (it.st[1]?.text === ":" && it.st.length === 2 && items[k + 1]?.st[0]?.kind === "word" && items[k + 1].st[0].text.toLowerCase() === "equ" && items[k + 1].line === it.line) {
      report(span, "EQU after a label with a colon: zxbasm's form is 'name EQU value'");
    }
    const chain: Map<string, string>[] = [];
    for (let s = it.scope; s >= 0; s = scopes[s].parent) chain.push(scopes[s].locals);
    out[it.block].push({ text: convertStatement(it.st, { chain, temps, at: k, clashes, report: (m) => report(span, m) }), span });
  });
  blocks.forEach((lines, bi) => fill(bi, lines.length - 1));
  return out;
}

type Temp = { n: string; at: number; name: string };

type Context = {
  /** The LOCAL names of the enclosing PROCs, innermost first. */
  chain: Map<string, string>[];
  temps: Temp[];
  /** The statement's index in the whole stream. */
  at: number;
  clashes: Set<string>;
  report: (message: string) => void;
};

function convertStatement(st: Token[], ctx: Context): string {
  st = groupingBrackets(st);
  const parts: string[] = [];
  // --- The mnemonic or directive: the first word that is not a label definition
  const head = st.findIndex((t, k) => t.kind === "word" && st[k + 1]?.text !== ":");
  const directive = st.find((t, k) => t.kind === "word" && (k === 0 || (k === 1 && st[0].kind === "word") || (k === 2 && st[1]?.text === ":")) && DIRECTIVES[t.text.toLowerCase()]);
  const byteData = !!directive && [".defb", ".defm"].includes(DIRECTIVES[directive.text.toLowerCase()]);
  // --- A label on its own (`lbl`, `.lbl`, `1:`) keeps its colon
  st.forEach((t, k) => {
    const prev = st[k - 1];
    const text = convertToken(t, ctx, byteData, prev);
    parts.push(text);
    // --- A blank after the mnemonic, and between two words or numbers
    const next = st[k + 1];
    const spacing = t.kind === "word" && next && (next.kind !== "op" || (k === head && ![",", ":"].includes(next.text))) ? " " : "";
    if (spacing) parts.push(spacing);
  });
  if (st.length === 1 && st[0].kind === "word" && !BARE_MNEMONICS.has(st[0].text.toLowerCase()) && !isZ80Keyword(st[0].text) && !DIRECTIVES[st[0].text.toLowerCase()]) parts.push(":");
  return "    " + parts.join("").replace(/\s+,/g, ",");
}

/**
 * zxbasm reads `(` ... `)` around a whole instruction operand as a memory reference and anywhere
 * else as grouping (`ld hl,(2+3)*4` is 20); Klive's assembler groups with `[` ... `]`.
 */
function groupingBrackets(st: Token[]): Token[] {
  const out = st.map((t) => ({ ...t }));
  const head = out.findIndex((t) => t.kind === "word");
  const isDirective = out.some((t) => t.kind === "word" && DIRECTIVES[t.text.toLowerCase()]);
  // --- The operands: after the mnemonic, split at top-level commas
  const operands: number[][] = [];
  let current: number[] = [];
  let depth = 0;
  for (let k = head + 1; k < out.length; k++) {
    const t = out[k];
    if (t.kind === "op" && t.text === "(") depth++;
    if (t.kind === "op" && t.text === ")") depth--;
    if (t.kind === "op" && t.text === "," && depth === 0) {
      operands.push(current);
      current = [];
      continue;
    }
    current.push(k);
  }
  operands.push(current);
  for (const operand of operands) {
    let wrap = -1;
    if (!isDirective && operand.length && out[operand[0]].text === "(" && out[operand[0]].kind === "op") {
      let d = 0;
      for (const k of operand) {
        if (out[k].kind !== "op") continue;
        if (out[k].text === "(") d++;
        else if (out[k].text === ")" && --d === 0) {
          if (k === operand[operand.length - 1]) wrap = k;
          break;
        }
      }
    }
    for (const k of operand) {
      if (out[k].kind !== "op" || (k === operand[0] && wrap >= 0) || k === wrap) continue;
      if (out[k].text === "(") out[k].text = "[";
      else if (out[k].text === ")") out[k].text = "]";
    }
  }
  return out;
}

function convertToken(t: Token, ctx: Context, byteData: boolean, prev: Token | undefined): string {
  switch (t.kind) {
    case "string": {
      const value = t.text.slice(1, -1).replace(/""/g, '"');
      // --- Bytes in DEFB/DEFM (no escape conventions to reconcile); a number elsewhere
      if (byteData) return [...value].map((c) => c.charCodeAt(0)).join(",");
      return String(value.charCodeAt(0) || 0);
    }
    case "char":
      return String(t.text.charCodeAt(1));
    case "number":
      return convertNumber(t.text, ctx);
    case "word":
      return convertWord(t.text, ctx, prev);
    default:
      return t.text;
  }
}

function convertNumber(text: string, ctx: Context): string {
  const lower = text.toLowerCase();
  // --- A temporary label reference: `1b` the latest `1:` before, `1f` the next one after
  const temp = /^(\d+)([bf])$/.exec(lower);
  if (temp) {
    const [, n, dir] = temp;
    const before = ctx.temps.filter((d) => d.n === n && d.at <= ctx.at);
    const after = ctx.temps.filter((d) => d.n === n && d.at > ctx.at);
    const target = dir === "b" ? before[before.length - 1] : after[0];
    if (!target) ctx.report(`Undefined temporary label '${text}'`);
    return target ? target.name : text;
  }
  if (/^\d+$/.test(lower)) {
    // --- A numeric label definition (`1:`) takes its generated name
    const def = ctx.temps.find((d) => d.at === ctx.at && d.n === lower);
    return def ? def.name : text;
  }
  if (/^\$[0-9a-f]+$/.test(lower)) return String(parseInt(lower.slice(1), 16));
  if (/^0x[0-9a-f]+$/.test(lower)) return String(parseInt(lower.slice(2), 16));
  if (/^[0-9][0-9a-f]*h$/.test(lower)) return String(parseInt(lower.slice(0, -1), 16));
  if (/^%[01]+$/.test(lower)) return String(parseInt(lower.slice(1), 2));
  return text;
}

function convertWord(text: string, ctx: Context, prev: Token | undefined): string {
  const lower = text.toLowerCase();
  if (lower.startsWith(".label.")) return `_label.${text.slice(7).replace(/^_/, "")}`;
  if (lower.startsWith(".core.")) return RUNTIME_ALIASES[text.slice(6)] ?? `core.${text.slice(6)}`;
  // --- Labels are case-sensitive; mnemonics, registers and directives are not
  const bare = text.startsWith(".") ? text.slice(1) : text;
  for (const locals of ctx.chain) {
    const local = locals.get(bare);
    if (local) return local;
  }
  if (ctx.clashes.has(bare)) return `${bare}__zx`;
  if (DIRECTIVES[lower] && prev?.kind !== "op") return DIRECTIVES[lower];
  return !text.startsWith(".") && isZ80Keyword(lower) ? lower : bare;
}

// ------------------------------------------------------------------------------------------------
// Scanning

function tokenize(line: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < line.length) {
    const c = line[i];
    if (c === ";") break;
    if (c === " " || c === "\t" || c === "\r") {
      let j = i;
      while (j < line.length && /[ \t\r]/.test(line[j])) j++;
      out.push({ kind: "space", text: " " });
      i = j;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      while (j < line.length) {
        if (line[j] === '"' && line[j + 1] === '"') j += 2;
        else if (line[j] === '"') break;
        else j++;
      }
      out.push({ kind: "string", text: line.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    if (c === "'") {
      // --- `af'` is a register; otherwise a character literal
      const last = out.filter((t) => t.kind !== "space").pop();
      if (last?.kind === "word" && last.text.toLowerCase() === "af") {
        last.text += "'";
        i++;
        continue;
      }
      out.push({ kind: "char", text: line.slice(i, i + 3) });
      i += 3;
      continue;
    }
    const word = /^\.?[A-Za-z_][\w.]*/.exec(line.slice(i));
    if (word) {
      out.push({ kind: "word", text: word[0] });
      i += word[0].length;
      continue;
    }
    const num = /^(\$[0-9A-Fa-f]+|%[01]+|0[xX][0-9A-Fa-f]+|[0-9][0-9A-Fa-f]*[hH]|\d+[bfBF]?)/.exec(line.slice(i));
    if (num && !(c === "$" && !/[0-9A-Fa-f]/.test(line[i + 1] ?? "")) && !(c === "%" && !/[01]/.test(line[i + 1] ?? ""))) {
      out.push({ kind: "number", text: num[0] });
      i += num[0].length;
      continue;
    }
    out.push({ kind: "op", text: c });
    i++;
  }
  return out;
}

/** Statements separated by `:`; a leading `label:` stays with the statement after it. */
function split(tokens: Token[]): Token[][] {
  const out: Token[][] = [];
  let current: Token[] = [];
  const meaningful = () => current.filter((t) => t.kind !== "space");
  for (const t of tokens) {
    if (t.kind === "op" && t.text === ":") {
      const m = meaningful();
      // --- `lbl:` or `1:` at the start: a label definition, kept as its own statement
      if (m.length === 1 && ((m[0].kind === "word" && !BARE_MNEMONICS.has(m[0].text.toLowerCase())) || (m[0].kind === "number" && /^\d+$/.test(m[0].text)))) {
        out.push([...m, t]);
        current = [];
        continue;
      }
      if (m.length) out.push(current);
      current = [];
      continue;
    }
    current.push(t);
  }
  if (meaningful().length) out.push(current);
  return out;
}

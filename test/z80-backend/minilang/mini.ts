import type { StatementKind } from "@abstractions/CompilerInfo";
import { FunctionBuilder, imm, MirBuilder } from "@main/z80-backend/mir/builder";
import type { BinOp, MModule, Span, Value, VReg } from "@main/z80-backend/mir/mir";
import { compileModule, type BackendResult } from "@main/z80-backend/link/compile-module";
import type { BackendOptions } from "@main/z80-backend/options";

/**
 * "mini": a test-only language on the shared Z80 back end (`.plans/SHARED_Z80_BACKEND_PLAN.md` §5,
 * Phase 6). It exists to fail the day the back end grows an assumption of Klive BASIC's: it is
 * written only against the front-end API (plan §4.4) — the MIR, its builder, `compileModule` and
 * `BackendOptions` — and links only the back end's `core` and `zx` runtime packages.
 *
 * ```
 * var total                     16-bit signed integers, all global
 * proc show(n)                  a procedure with one 16-bit parameter (an IX frame)
 *   print n * 2                 print a number on its own line (the zx package's PrintI16)
 * end
 * total = 7 / 2                 + - * wrap at 16 bits and / truncates: mini says so on every operation
 * while total > 0 do ... end
 * if total == 0 then ... end
 * call show(total)
 * ```
 */

type Token = { kind: "num" | "id" | "op" | "nl" | "eof"; text: string; start: number; end: number };

function tokenize(text: string): Token[] {
  const out: Token[] = [];
  const re = /[ \t]+|(\n)|(\d+)|([A-Za-z_]\w*)|(==|[-+*/<>=(),])/y;
  let at = 0;
  while (at < text.length) {
    re.lastIndex = at;
    const m = re.exec(text);
    if (!m) throw new Error(`mini: unexpected character at ${at}`);
    const start = at;
    at = re.lastIndex;
    if (m[1]) out.push({ kind: "nl", text: "\n", start, end: at });
    else if (m[2]) out.push({ kind: "num", text: m[2], start, end: at });
    else if (m[3]) out.push({ kind: "id", text: m[3], start, end: at });
    else if (m[4]) out.push({ kind: "op", text: m[4], start, end: at });
  }
  out.push({ kind: "eof", text: "", start: at, end: at });
  return out;
}

type Expr =
  | { kind: "num"; value: number }
  | { kind: "var"; name: string }
  | { kind: "bin"; op: string; left: Expr; right: Expr };

type Stmt = { span: Span } & (
  | { kind: "assign"; name: string; value: Expr }
  | { kind: "print"; value: Expr }
  | { kind: "call"; name: string; arg: Expr }
  | { kind: "if"; cond: Expr; body: Stmt[] }
  | { kind: "while"; cond: Expr; body: Stmt[] }
);

type Proc = { name: string; param: string; body: Stmt[]; span: Span; end: Span };
type Program = { globals: { name: string; span: Span }[]; procs: Proc[]; main: Stmt[] };

/** The source file as the back end's debug builders read it: offsets to lines and columns. */
export class MiniSource {
  private readonly lineStarts: number[] = [0];
  constructor(
    readonly name: string,
    readonly text: string
  ) {
    for (let i = 0; i < text.length; i++) if (text[i] === "\n") this.lineStarts.push(i + 1);
  }
  location(offset: number) {
    let line = 0;
    while (line + 1 < this.lineStarts.length && this.lineStarts[line + 1] <= offset) line++;
    return { fileName: this.name, line: line + 1, column: offset - this.lineStarts[line] };
  }
}

function parse(text: string): Program {
  const tokens = tokenize(text);
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const expect = (t: string) => {
    const tok = next();
    if (tok.text !== t) throw new Error(`mini: '${t}' expected at ${tok.start}, found '${tok.text}'`);
    return tok;
  };
  const skipLines = () => {
    while (peek().kind === "nl") pos++;
  };
  const span = (from: number) => ({ file: 0, start: from, end: tokens[pos - 1].end });

  const PREC: Record<string, number> = { "==": 1, "<": 1, ">": 1, "+": 2, "-": 2, "*": 3, "/": 3 };
  const primary = (): Expr => {
    const t = next();
    if (t.kind === "num") return { kind: "num", value: Number(t.text) };
    if (t.kind === "id") return { kind: "var", name: t.text };
    if (t.text === "(") {
      const e = expr(0);
      expect(")");
      return e;
    }
    throw new Error(`mini: an expression expected at ${t.start}`);
  };
  const expr = (min: number): Expr => {
    let left = primary();
    while (peek().kind === "op" && (PREC[peek().text] ?? 0) > min) {
      const op = next().text;
      left = { kind: "bin", op, left, right: expr(PREC[op]) };
    }
    return left;
  };
  const block = (): Stmt[] => {
    const body: Stmt[] = [];
    skipLines();
    while (peek().text !== "end") {
      body.push(statement());
      skipLines();
    }
    expect("end");
    return body;
  };
  const statement = (): Stmt => {
    const t = peek();
    const from = t.start;
    if (t.text === "print") {
      next();
      return { kind: "print", value: expr(0), span: span(from) };
    }
    if (t.text === "call") {
      next();
      const name = next().text;
      expect("(");
      const arg = expr(0);
      expect(")");
      return { kind: "call", name, arg, span: span(from) };
    }
    if (t.text === "if" || t.text === "while") {
      next();
      const cond = expr(0);
      expect(t.text === "if" ? "then" : "do");
      const headerSpan = span(from);
      return { kind: t.text, cond, body: block(), span: headerSpan } as Stmt;
    }
    const name = next().text;
    expect("=");
    return { kind: "assign", name, value: expr(0), span: span(from) };
  };

  const program: Program = { globals: [], procs: [], main: [] };
  skipLines();
  while (peek().kind !== "eof") {
    const t = peek();
    if (t.text === "var") {
      next();
      const name = next();
      program.globals.push({ name: name.text, span: { file: 0, start: name.start, end: name.end } });
    } else if (t.text === "proc") {
      next();
      const name = next().text;
      expect("(");
      const param = next().text;
      expect(")");
      const header = span(t.start);
      const body: Stmt[] = [];
      skipLines();
      while (peek().text !== "end") {
        body.push(statement());
        skipLines();
      }
      const endTok = expect("end");
      program.procs.push({ name, param, body, span: { file: 0, start: header.start, end: endTok.end }, end: { file: 0, start: endTok.start, end: endTok.end } });
    } else program.main.push(statement());
    skipLines();
  }
  return program;
}

const OPS: Record<string, BinOp> = { "+": "add", "-": "sub", "*": "mul", "/": "div", "==": "eq", "<": "lt", ">": "gt" };

/** Lowers a mini program to MIR, stating mini's meanings: wrapping arithmetic, truncating division. */
export function lowerMini(text: string): MModule {
  const program = parse(text);
  const m = new MirBuilder();
  const label = (name: string) => `_m_${name}`;
  let labels = 0;
  const newLabel = () => `_m.${labels++}`;
  for (const g of program.globals) {
    m.data({ kind: "var", label: label(g.name), size: 2 });
    m.global({ name: g.name, displayName: g.name, type: "i16", typeLabel: "int", kind: "global", storage: { label: label(g.name) }, declaredAt: g.span });
  }

  const lower = (f: FunctionBuilder, body: Stmt[], param?: string) => {
    const value = (sid: number, e: Expr): Value => {
      if (e.kind === "num") return imm("i16", e.value);
      if (e.kind === "var") {
        return e.name === param ? f.load(sid, "i16", { kind: "frame", offset: 4 }) : f.load(sid, "i16", { kind: "global", name: label(e.name) });
      }
      const a = value(sid, e.left);
      const b = value(sid, e.right);
      const bop = OPS[e.op];
      const meaning = bop === "div" ? { rounding: "trunc" as const } : bop === "add" || bop === "sub" || bop === "mul" ? { overflow: "wrap" as const } : {};
      return f.bin(sid, bop, a.kind === "imm" ? f.const(sid, a) : a, b, meaning);
    };
    const stmt = (s: Stmt, kind: StatementKind): number => {
      const sid = m.statement(f, s.span, kind);
      f.stmt(sid);
      return sid;
    };
    for (const s of body) {
      if (s.kind === "assign") {
        const sid = stmt(s, "assignment");
        f.store(sid, "i16", { kind: "global", name: label(s.name) }, value(sid, s.value));
      } else if (s.kind === "print") {
        const sid = stmt(s, "other");
        f.rtcall(sid, "core.PrintI16", [value(sid, s.value)]);
        f.rtcall(sid, "core.PrintNewline", []);
      } else if (s.kind === "call") {
        const sid = stmt(s, "call");
        f.call(sid, label(s.name), [value(sid, s.arg)], { kind: "routine", callee: s.name, moreCallsFollow: false, order: 0 });
      } else {
        const top = newLabel();
        const inside = newLabel();
        const after = newLabel();
        if (s.kind === "while") {
          f.end({ op: "jmp", target: top, sid: -1 }).block(top);
        }
        const sid = stmt(s, s.kind === "if" ? "if" : "loop");
        const cond = value(sid, s.cond) as VReg;
        f.end({ op: "br", cond, ifTrue: inside, ifFalse: after, sid }).block(inside);
        lower(f, s.body, param);
        f.end({ op: "jmp", target: s.kind === "while" ? top : after, sid: -1 }).block(after);
      }
    }
  };

  const main = m.fn({ label: "_main", name: "main", kind: "entry" });
  main.block("_main");
  lower(main, program.main);
  main.end({ op: "ret", sid: -1 });

  for (const p of program.procs) {
    const f = m.fn({
      label: label(p.name),
      name: p.name,
      kind: "routine",
      params: [{ name: p.param, type: "i16", offset: 4 }],
      argBytes: 2,
      epilogue: `${label(p.name)}.leave`,
      span: p.span,
      vars: [{ name: p.param, displayName: p.param, type: "i16", typeLabel: "int", kind: "parameter", storage: { frameOffset: 4 }, declaredAt: p.span }]
    });
    f.block(label(p.name)).marker("prologue.end", -1);
    lower(f, p.body, p.param);
    f.end({ op: "jmp", target: `${label(p.name)}.leave`, sid: -1 }).block(`${label(p.name)}.leave`);
    const sid = m.statement(f, p.end, "return");
    f.stmt(sid).marker("epilogue.begin", sid);
    f.end({ op: "ret", sid });
  }
  return m.build();
}

export const MINI_OPTIONS: BackendOptions = {
  target: "zx48k",
  optimize: 0,
  origin: 0x8000,
  heapSize: 512,
  codebank: { window: 0xc000, windowSize: "16k", firstPage: 32, depth: 16 },
  nex: { core: "3.01.10" }
};

/** Compiles a mini program with the shared back end. */
export async function compileMini(text: string, options: Partial<BackendOptions> = {}): Promise<BackendResult & { source: MiniSource }> {
  const source = new MiniSource("main.mini", text);
  const mir = lowerMini(text);
  const result = await compileModule(mir, { ...MINI_OPTIONS, ...options }, {
    language: "mini",
    packages: [],
    sources: { get: () => source },
    isLibraryFile: () => false,
    isLibraryFileName: () => false,
    programName: "main",
    programFile: "main.mini.asm"
  });
  return { ...result, source };
}

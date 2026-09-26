import { describe, expect, it } from "vitest";

import { parseProgram } from "@main/kbasic/front-end";
import type { Argument, Expression, Statement } from "@main/kbasic/syntax/ast";

export function parseText(text: string, files: Record<string, string> = {}) {
  const r = parseProgram("/p/main.zxbas", text, { read: (p) => files[p] });
  return { ...r, errors: r.diagnostics.items.filter((d) => d.severity === "error") };
}

/** An S-expression view of an expression. */
export function sx(e: Expression): string {
  switch (e.kind) {
    case "number":
      return e.text;
    case "string":
      return JSON.stringify(e.value);
    case "name":
      return e.name + (e.sigil ?? "");
    case "unary":
      return `(${e.op} ${sx(e.operand)})`;
    case "binary":
      return `(${e.op} ${sx(e.left)} ${sx(e.right)})`;
    case "paren":
      return `[${sx(e.expression)}]`;
    case "call":
      return `${sx(e.callee)}${e.parens ? "" : "~"}(${e.args.map(sa).join(", ")})`;
    case "builtin":
      return `${e.name}${e.parens ? "" : "~"}(${[...(e.type ? [e.type.name] : []), ...e.args.map(sx)].join(", ")})`;
    case "addressOf":
      return `@${sx(e.target)}`;
    case "farptr":
      return `FARPTR ${sx(e.target)}`;
    case "error":
      return "<error>";
  }
}

function sa(a: Argument): string {
  if (a.kind === "arg") return sx(a.value);
  if (a.kind === "named") return `${a.name.name}:=${sx(a.value)}`;
  return `${a.from ? sx(a.from) : ""} TO ${a.to ? sx(a.to) : ""}`.trim();
}

function expr(text: string): string {
  const r = parseText(`x = ${text}`);
  expect(r.errors.map((e) => e.message)).toEqual([]);
  const s = r.program.statements[0];
  if (s.kind !== "let") throw new Error("not a LET");
  return sx(s.value);
}

function statements(text: string): Statement[] {
  const r = parseText(text);
  expect(r.errors.map((e) => `${e.code} ${e.message}`)).toEqual([]);
  return r.program.statements;
}

describe("Klive BASIC parser: expressions", () => {
  it.each([
    ["1 + 2 * 3", "(+ 1 (* 2 3))"],
    ["2 ^ 3 ^ 2", "(^ 2 (^ 3 2))"],
    ["-2 ^ 2", "(- (^ 2 2))"],
    ["-a * b", "(* (- a) b)"],
    ["a MOD b * c", "(MOD a (* b c))"],
    ["a + b MOD c", "(+ a (MOD b c))"],
    ["a bAND b + 1", "(BAND a (+ b 1))"],
    ["a bAND 3 = 1", "(= (BAND a 3) 1)"],
    ["a & b | c", "(BOR (BAND a b) c)"],
    ["a << 2 ~ b", "(BXOR (SHL a 2) b)"],
    ["NOT a = b", "(NOT (= a b))"],
    ["NOT a AND b", "(AND (NOT a) b)"],
    ["a OR b AND c", "(OR a (AND b c))"],
    ["a AND b XOR c", "(AND a (XOR b c))"],
    ["a < b < c", "(< (< a b) c)"],
    ["!a + b", "(+ (BNOT a) b)"],
    ["bNOT a * b", "(BNOT (* a b))"],
    ["(1 + 2) * 3", "(* [(+ 1 2)] 3)"],
    ["a$ + \"x\"", '(+ a$ "x")']
  ])("%s", (text, expected) => {
    expect(expr(text)).toBe(expected);
  });

  it.each([
    ["f(1, 2)", "f(1, 2)"],
    ["a(i)(1 TO 3)", "a(i)(1 TO 3)"],
    ["s$(TO 3)", "s$(TO 3)"],
    ["s$(2 TO)", "s$(2 TO)"],
    ['"hello"(1)', '"hello"(1)'],
    ["(a$ + b$)(0 TO 1)", "[(+ a$ b$)](0 TO 1)"],
    ["f 5 + 1", "(+ f~(5) 1)"],
    ["f(x := 1, y := 2)", "f(x:=1, y:=2)"],
    ["@a", "@a"],
    ["@a(1, 2)", "@a(1, 2)"],
    ["PEEK 23672 + 1", "(+ PEEK~(23672) 1)"],
    ["PEEK(UINTEGER, 23672)", "PEEK(UINTEGER, 23672)"],
    ["IN 254", "IN~(254)"],
    ["USR @routine", "USR~(@routine)"],
    ["CAST(UBYTE, 300)", "CAST(UBYTE, 300)"],
    ["SIZEOF(FLOAT) + SIZEOF(v)", "(+ SIZEOF(FLOAT) SIZEOF(v))"],
    ["LBOUND(a, 1) + UBOUND(a)", "(+ LBOUND(a, 1) UBOUND(a))"],
    ["CHR$(65, 66)", "CHR(65, 66)"],
    ["STR$(1)(0)", "STR(1)(0)"],
    ["INKEY$ + INKEY", "(+ INKEY~() INKEY~())"],
    ["RND + RND()", "(+ RND~() RND())"],
    ["PI * 2", "(* PI~() 2)"],
    ["ABS(-1) + SQR(4)", "(+ ABS((- 1)) SQR(4))"],
    ["FARPTR buffer", "FARPTR buffer"],
    ["BIN 1010 + %11 + $FF", "(+ (+ BIN 1010 %11) $FF)"]
  ])("%s", (text, expected) => {
    expect(expr(text)).toBe(expected);
  });

  it("requires parentheses for most built-ins", () => {
    expect(parseText("x = ABS 3").errors.map((e) => e.code)).toEqual(["E310"]);
  });
});

describe("Klive BASIC parser: statements", () => {
  it("splits a line into statements with exact spans, without ':' and comments", () => {
    const text = "a = 1 : b = 2 :: PRINT a + b ' sum";
    const r = parseText(text);
    expect(r.errors).toEqual([]);
    expect(r.program.statements.map((s) => text.slice(s.span.start, s.span.end))).toEqual(["a = 1", "b = 2", "PRINT a + b"]);
  });

  it("does not split at ':' inside strings or comments", () => {
    const text = 'PRINT "a:b" : REM x : y\nPRINT 1 /\' : \'/ + 2';
    const s = statements(text);
    expect(s.map((x) => text.slice(x.span.start, x.span.end))).toEqual(['PRINT "a:b"', "PRINT 1 /' : '/ + 2"]);
  });

  it("reads line numbers and labels at the start of a line only", () => {
    const s = statements("10 PRINT 1\nstart: PRINT 2\n  20 GOTO start");
    expect(s.filter((x) => x.kind === "label").map((x) => (x.kind === "label" ? [x.name, x.lineNumber] : 0))).toEqual([
      ["10", 10],
      ["start", undefined],
      ["20", 20]
    ]);
  });

  it("reports a line number that is not whole", () => {
    expect(parseText("1.5 PRINT").errors.map((e) => e.code)).toEqual(["E304"]);
  });

  it("parses a SUB call with and without parentheses", () => {
    const s = statements("Ding\nMove(1, 2)\nMove 1, 2\nMove (1 + 2) * 3, 4\ntest x := 1");
    expect(s.map((x) => (x.kind === "callStatement" ? `${x.callee.name}${x.parens ? "" : "~"}(${x.args.map(sa).join(", ")})` : x.kind))).toEqual([
      "Ding~()",
      "Move(1, 2)",
      "Move~(1, 2)",
      "Move~((* [(+ 1 2)] 3), 4)",
      "test~(x:=1)"
    ]);
  });

  it("parses assignments of every target form", () => {
    const s = statements('LET a = 1\nb(2, 3) = 4\nc$(1 TO 2) = "xy"\nd$(1)(TO 2) = "z"');
    expect(s.map((x) => (x.kind === "let" ? `${x.hasLet ? "LET " : ""}${sx(x.target)} = ${sx(x.value)}` : x.kind))).toEqual([
      "LET a = 1",
      "b(2, 3) = 4",
      'c$(1 TO 2) = "xy"',
      'd$(1)(TO 2) = "z"'
    ]);
  });

  it("parses PRINT items and separators", () => {
    const [p] = statements('PRINT AT 1, 2; INK 3; "x", TAB 5; a;');
    if (p.kind !== "print") throw new Error();
    expect(p.items.map((i) => i.kind)).toEqual(["at", "separator", "attrModifier", "separator", "expr", "separator", "tab", "separator", "expr", "separator"]);
  });

  it("parses single-line IF with ELSE and a trailing END IF", () => {
    const [s] = statements("IF a THEN PRINT 1: PRINT 2 ELSE PRINT 3: END IF");
    if (s.kind !== "if") throw new Error();
    expect([s.singleLine, s.then.length, s.else?.length]).toEqual([true, 2, 1]);
  });

  it("gives an ELSE to the nearest single-line IF", () => {
    const [s] = statements("IF a THEN IF b THEN PRINT 1 ELSE PRINT 2");
    if (s.kind !== "if" || s.then[0].kind !== "if") throw new Error();
    expect([s.else, s.then[0].else?.length]).toEqual([undefined, 1]);
  });

  it("parses block IF with ELSEIF, ELSE, END IF or ENDIF, and labels inside", () => {
    const [s] = statements("IF a THEN\n  PRINT 1\nELSEIF b\n10 PRINT 2\nELSE PRINT 3\n  PRINT 4\nENDIF");
    if (s.kind !== "if") throw new Error();
    expect([s.singleLine, s.then.length, s.elseIfs.length, s.elseIfs[0].body.map((x) => x.kind), s.else?.length]).toEqual([
      false,
      1,
      1,
      ["label", "print"],
      2
    ]);
  });

  it("parses loops, on one line or several", () => {
    const s = statements(
      "FOR i = 1 TO 10 STEP 2: PRINT i: NEXT i\nWHILE a\n  a = a - 1\nWEND\nWHILE b: END WHILE\nDO\nLOOP UNTIL k\nDO WHILE x: x = 0: LOOP\nDO: LOOP"
    );
    expect(s.map((x) => (x.kind === "do" ? `do:${x.test}` : x.kind))).toEqual(["for", "while", "while", "do:postUntil", "do:preWhile", "do:none"]);
  });

  it("parses DIM in all its forms", () => {
    const s = statements(
      "DIM a, b, c AS INTEGER\nDIM d = 5\nDIM e AS UBYTE AT 23672\nDIM f(10)\nDIM g(1 TO 3, 5) AS FLOAT AT @buffer\nDIM h(2, 1) AS UBYTE => {{1, 2}, {3, 4}, {5, 6}}\nDIM s$(10)"
    );
    expect(s.map((x) => (x.kind === "dim" ? `${x.names.length}:${x.bounds?.length ?? 0}:${!!x.initialValue}:${!!x.at}:${!!x.vector}` : x.kind))).toEqual([
      "3:0:false:false:false",
      "1:0:true:false:false",
      "1:0:false:true:false",
      "1:1:false:false:false",
      "1:2:false:true:false",
      "1:2:false:false:true",
      "1:1:false:false:false"
    ]);
  });

  it("parses SUB and FUNCTION definitions, conventions and parameters", () => {
    const [f] = statements(
      "FUNCTION FASTCALL Add(BYVAL a AS INTEGER, BYREF b, c = 2, arr() AS UBYTE) AS LONG\n  RETURN a + b\nEND FUNCTION"
    );
    if (f.kind !== "routine") throw new Error();
    expect(f.header.convention).toBe("FASTCALL");
    expect(f.header.returnType?.name).toBe("LONG");
    expect(f.header.params.map((p) => [p.name.name, p.passing, p.type?.name, !!p.defaultValue, p.isArray])).toEqual([
      ["a", "BYVAL", "INTEGER", false, false],
      ["b", "BYREF", undefined, false, false],
      ["c", undefined, undefined, true, false],
      ["arr", undefined, "UBYTE", false, true]
    ]);
  });

  it("reports a SUB with a return type and an unclosed routine", () => {
    expect(parseText("SUB s() AS INTEGER\nEND SUB").errors.map((e) => e.code)).toEqual(["E308"]);
    expect(parseText("SUB s\n  PRINT 1\nSUB t\nEND SUB").errors.map((e) => e.code)).toEqual(["E303"]);
  });

  it("keeps ASM lines raw", () => {
    const [a] = statements("ASM\n  ld a,1\n  ret\nEND ASM");
    if (a.kind !== "asm") throw new Error();
    expect(a.lines.map((l) => l.text)).toEqual(["  ld a,1", "  ret"]);
  });

  it("parses tape statements", () => {
    const s = statements('LOAD "x" CODE\nLOAD n$ CODE 32768, 100\nSAVE "s" SCREEN$\nVERIFY "d" DATA a()\nSAVE "c" CODE 16384, 6912\nLOAD "" DATA');
    expect(s.map((x) => (x.kind === "tape" ? `${x.operation}:${x.target.kind}` : x.kind))).toEqual([
      "LOAD:code",
      "LOAD:code",
      "SAVE:screen",
      "VERIFY:data",
      "SAVE:code",
      "LOAD:data"
    ]);
  });

  it("parses the POKE forms", () => {
    const s = statements("POKE 1, 2\nPOKE (3, 4)\nPOKE UINTEGER 5, 6\nPOKE (FLOAT 7, 8)\nPOKE LONG, 9, 10\nPOKE (addr + 1), 5");
    expect(s.map((x) => (x.kind === "poke" ? `${x.parens}:${x.type?.name ?? "-"}:${sx(x.address)}` : x.kind))).toEqual([
      "false:-:1",
      "true:-:3",
      "false:UINTEGER:5",
      "true:FLOAT:7",
      "false:LONG:9",
      "false:-:[(+ addr 1)]"
    ]);
  });

  it("parses jumps", () => {
    const s = statements("GOTO 10\nGO TO start\nGOSUB 100\nGO SUB there\nON x GOTO a, 20, b\nON y GO SUB c\nRESTORE\nRESTORE 30");
    expect(s.map((x) => x.kind)).toEqual(["goto", "goto", "gosub", "gosub", "on", "on", "restore", "restore"]);
  });

  it("keeps #pragma lines as statements", () => {
    const [p] = statements("#pragma array_base = 1");
    expect(p).toMatchObject({ kind: "pragma", text: "array_base = 1" });
  });

  it("parses CODEBANK blocks", () => {
    const [c] = statements("CODEBANK 1\nSUB Far()\nEND SUB\nDIM buf(10) AS UBYTE\nEND CODEBANK");
    if (c.kind !== "codebank") throw new Error();
    expect(c.body.map((x) => x.kind)).toEqual(["routine", "dim"]);
  });

  it("recovers after an error and reports the rest of the program", () => {
    const r = parseText("PRINT 1 +\nx = = 2\nFOR i = 1 TO\nPRINT 2");
    expect(r.errors.map((e) => e.code)).toEqual(["E309", "E309", "E309"]);
    expect(r.program.statements.map((s) => s.kind)).toContain("print");
  });

  it("reports closers without openers and blocks without closers", () => {
    expect(parseText("NEXT i").errors.map((e) => e.code)).toEqual(["E306"]);
    expect(parseText("END IF").errors.map((e) => e.code)).toEqual(["E305"]);
    expect(parseText("FOR i = 1 TO 3\nPRINT i").errors.map((e) => e.code)).toEqual(["E303"]);
    expect(parseText("DO\nPRINT").errors.map((e) => e.code)).toEqual(["E303"]);
    expect(parseText("IF a THEN\nPRINT").errors.map((e) => e.code)).toEqual(["E303"]);
  });

  it("points errors inside macros at the macro use", () => {
    const r = parseText("#define BAD )\nPRINT BAD");
    const text = r.sources.get(0).text;
    expect(text.slice(r.errors[0].span.start, r.errors[0].span.end)).toBe("BAD");
  });
});

describe("Klive BASIC parser: a whole program", () => {
  it("parses a typical program without errors", () => {
    const program = `' A small game loop
#define SPEED 2
#pragma array_base = 0
CONST TITLE$ = "Klive"
DIM x, y AS UBYTE
DIM score AS UINTEGER = 0
DIM map(3, 3) AS UBYTE => {{1, 0, 0, 1}, {0, 1, 1, 0}, _
                           {0, 1, 1, 0}, {1, 0, 0, 1}}

DECLARE FUNCTION Clamp(v AS INTEGER, lo AS INTEGER, hi AS INTEGER) AS INTEGER

SUB DrawPlayer(px AS UBYTE, py AS UBYTE)
  PRINT AT py, px; INK 2; BRIGHT 1; "A";
END SUB

FUNCTION Clamp(v AS INTEGER, lo AS INTEGER, hi AS INTEGER) AS INTEGER
  IF v < lo THEN RETURN lo
  IF v > hi THEN RETURN hi
  RETURN v
END FUNCTION

start:
  CLS: BORDER 0
  PRINT TITLE$(0 TO 2); " "; score
  DO
    k$ = INKEY$
    IF k$ = "q" THEN
      x = Clamp(x - SPEED, 0, 31)
    ELSEIF k$ = "p" THEN
      x = Clamp(x + SPEED, 0, 31)
    ELSE
      score = score + 1
    END IF
    FOR i = 0 TO 3: FOR j = 0 TO 3
      IF map(i, j) THEN PLOT INK 4; i * 8, j * 8
    NEXT j: NEXT i
    DrawPlayer x, y
    PAUSE 1
  LOOP UNTIL k$ = " "
  GO SUB finish
  END

finish:
  BEEP 0.1, 12: RETURN
`;
    const r = parseText(program);
    expect(r.errors.map((e) => `${e.code} ${e.message}`)).toEqual([]);
    expect(r.program.statements.filter((s) => s.kind === "routine").length).toBe(2);
  });
});

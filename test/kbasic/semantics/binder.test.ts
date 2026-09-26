import { describe, expect, it } from "vitest";
import { DiagnosticBag } from "@main/kbasic/diagnostics";
import { parseProgram } from "@main/kbasic/front-end";
import { defaultOptions } from "@main/kbasic/options/options";
import { bind } from "@main/kbasic/semantics/binder";
import type { BoundExpr, BoundStatement } from "@main/kbasic/semantics/bound";
import type { ArraySymbol, VariableSymbol } from "@main/kbasic/semantics/symbols";
import { CASES } from "../syntax/spec-cases";
import { bindText, globalSymbol, statements, valueOf } from "./bind-kit";

/** A compact rendering of a bound expression: types, conversions and folded constants. */
function show(e: BoundExpr): string {
  switch (e.kind) {
    case "constant": {
      const v = e.constant!.value;
      const text = v.kind === "int" ? String(v.value) : v.kind === "string" ? JSON.stringify(v.value) : v.kind === "fixed" ? `fixed ${v.raw}` : v.kind === "float" ? `float ${v.value.join(",")}` : `@${v.symbol}+${v.offset}`;
      return `${text}:${e.type}`;
    }
    case "variable":
      return `${e.symbol.name}:${e.type}`;
    case "convert":
      return `${e.type}(${show(e.operand)})`;
    case "unary":
      return `(${e.op}${show(e.operand)}):${e.type}`;
    case "binary":
      return `(${show(e.left)} ${e.op} ${show(e.right)}):${e.type}`;
    case "element":
      return `${e.symbol.name}(${e.indices.map(show).join(", ")}):${e.type}`;
    case "slice":
      return `${show(e.target)}[${e.from ? show(e.from) : ""}..${e.to ? show(e.to) : ""}${e.single ? " char" : ""}]`;
    case "call":
      return `${e.routine.name}(${e.args.map((a) => (a.value ? show(a.value) : "default")).join(", ")}):${e.type}`;
    case "builtin":
      return `${e.name}(${e.args.map(show).join(", ")}):${e.type}`;
    default:
      return `${e.kind}:${e.type}`;
  }
}

/** The value PRINTed by the program's last statement. */
function printed(source: string): string {
  const b = bindText(source);
  const all = statements(b);
  return show(valueOf(all[all.length - 1]));
}

describe("expression types (spec types and operators)", () => {
  const decl = "DIM b AS Byte\nDIM ub AS UByte\nDIM i AS Integer\nDIM ui AS UInteger\nDIM fl AS Float\nDIM fx AS Fixed\n";
  it.each([
    ["b + ub", "(b:Byte + Byte(ub:UByte)):Byte"],
    ["ub + i", "(Integer(ub:UByte) + i:Integer):Integer"],
    ["ui + b", "(Integer(ui:UInteger) + Integer(b:Byte)):Integer"],
    ["-ub", "(-Byte(ub:UByte)):Byte"],
    ["ub * 2.5", "(Float(ub:UByte) * float 130,32,0,0,0:Float):Float"],
    ["fx + 1", "(fx:Fixed + fixed 65536:Fixed):Fixed"],
    ["i SHL 2", "(i:Integer SHL 2:UByte):Integer"],
    ["fl bAND 3", "(Long(fl:Float) BAND 3:Long):Long"],
    ["ub = 1", "(ub:UByte = 1:UByte):Boolean"],
    ["ub AND i", "(ub:UByte AND i:Integer):Boolean"],
    ["2 ^ ub", "(float 0,0,2,0,0:Float ^ Float(ub:UByte)):Float"]
  ])("%s", (expression, expected) => {
    expect(printed(`${decl}PRINT ${expression}\n`)).toBe(expected);
  });
});

describe("constant folding", () => {
  it.each([
    ["200 + 100", "300:UInteger"],
    ["1 - 2", "-1:Byte"],
    ["7 / 2", "3:UByte"],
    ["-7 MOD 2", "-1:Byte"],
    ["1 < 2", "1:Boolean"],
    ['"ab" + "cd"', '"abcd":String'],
    ['"hello"(1 TO 3)', '"ell":String'],
    ['"hello"(4)', '"o":String'],
    ['CHR$(72, 105)', '"Hi":String'],
    ['CODE("A")', "65:UByte"],
    ['LEN("four")', "4:UInteger"],
    ["INT(-2.5)", "-3:Long"],
    ["SGN(-5)", "-1:Byte"],
    ["ABS(-5)", "5:Byte"],
    ["CAST(UByte, 300)", "44:UByte"],
    ["SIZEOF(Float)", "5:UByte"],
    ["NOT 0", "1:Boolean"],
    ["bNOT 0", "255:UByte"]
  ])("%s", (expression, expected) => {
    expect(printed(`PRINT ${expression}\n`)).toBe(expected);
  });

  it("folds constants and uses them in bounds", () => {
    const b = bindText("CONST n = 2 * 5\nDIM t(n) AS UByte\nPRINT t(0)\n");
    expect((globalSymbol(b, "t") as ArraySymbol).bounds).toEqual([{ lower: 0, upper: 10 }]);
    expect(b.semantic).toEqual([]);
  });

  it("gives PI the ROM's value", () => {
    expect(printed("PRINT PI\n")).toBe("float 130,73,15,218,162:Float");
  });

  it("folds VAL of a constant string", () => {
    expect(printed('PRINT VAL("12")\n')).toBe("float 0,0,12,0,0:Float");
  });
});

describe("implicit variables (spec types.default_type)", () => {
  it.each([
    ["a = 1", "UByte"],
    ["a = -1", "Byte"],
    ["a = 1000", "UInteger"],
    ["a = 1.5", "Float"],
    ['a = "x"', "String"],
    ["a = 1 < 2", "UByte"]
  ])("%s makes a %s", (source, type) => {
    const b = bindText(`${source}\nPRINT a\n`);
    expect((globalSymbol(b, "a") as VariableSymbol).type).toBe(type);
    expect(b.semantic).toEqual([]);
  });

  it("types a FOR variable by the common type of its values", () => {
    expect((globalSymbol(bindText("FOR i = 1 TO 10: NEXT"), "i") as VariableSymbol).type).toBe("UByte");
    expect((globalSymbol(bindText("FOR i = -1 TO 10: NEXT"), "i") as VariableSymbol).type).toBe("Byte");
    expect((globalSymbol(bindText("FOR i = 1 TO 1000 STEP 2: NEXT"), "i") as VariableSymbol).type).toBe("UInteger");
  });

  it("makes a READ target a Float, a sigil a String or Integer", () => {
    const b = bindText("READ r, s$, n%\nDATA 1, \"x\", 2\n");
    expect((globalSymbol(b, "r") as VariableSymbol).type).toBe("Float");
    expect((globalSymbol(b, "s") as VariableSymbol).type).toBe("String");
    expect((globalSymbol(b, "n") as VariableSymbol).type).toBe("Integer");
  });

  it("creates a routine's undeclared variables as locals", () => {
    const b = bindText("SUB s()\n x = 1\n PRINT x\nEND SUB\ns\n");
    expect(globalSymbol(b, "x")).toBeUndefined();
    const routine = b.program.routines[0];
    expect(routine.scope?.lookupLocal("x", false)).toMatchObject({ kind: "variable", storage: "local", type: "UByte" });
  });

  it("uses a global from inside a routine", () => {
    const b = bindText("DIM g AS UInteger\nSUB s()\n g = 1\nEND SUB\ns\nPRINT g\n");
    expect(b.program.routines[0].scope?.lookupLocal("g", false)).toBeUndefined();
    expect(b.semantic).toEqual([]);
  });
});

describe("pragmas", () => {
  it("changes the array base from its line on", () => {
    const b = bindText("DIM a(3) AS UByte\n#pragma array_base = 1\nDIM c(3) AS UByte\n");
    expect((globalSymbol(b, "a") as ArraySymbol).bounds[0].lower).toBe(0);
    expect((globalSymbol(b, "c") as ArraySymbol).bounds[0].lower).toBe(1);
  });

  it("counts string indices from string_base", () => {
    expect(printed('#pragma string_base = 1\nPRINT "hello"(1 TO 2)\n')).toBe('"he":String');
  });

  it("matches names regardless of case while case_insensitive is on, and restores it with pop", () => {
    const source = "DIM Total AS UByte\n#pragma push(case_insensitive)\n#pragma case_insensitive = true\nPRINT total\n#pragma pop(case_insensitive)\nPRINT total\n";
    const b = bindText(source, { optimize: 0 });
    expect(b.semantic.map((d) => d.code)).toEqual(["W100"]);
    expect(b.semantic[0].text).toBe("total");
  });

  it("turns on explicit declarations", () => {
    expect(bindText("#pragma explicit = true\nPRINT q\n").semantic.map((d) => d.code)).toContain("E427");
  });
});

describe("routines", () => {
  const source =
    "FUNCTION add(a AS UByte, b AS UByte = 2) AS UInteger\n RETURN a + b\nEND FUNCTION\nSUB inc(BYREF v AS UInteger)\n v = v + 1\nEND SUB\nDIM r AS UInteger\nr = add(1)\ninc r\nPRINT add(b := 3, a := 4)\n";

  it("fills defaults and matches named arguments", () => {
    const b = bindText(source);
    expect(b.semantic).toEqual([]);
    const all = statements(b);
    expect(show(valueOf(all.find((s) => s.kind === "assign")!))).toBe("add(1:UByte, default):UInteger");
    expect(show(valueOf(all[all.length - 1]))).toBe("add(4:UByte, 3:UByte):UInteger");
  });

  it("passes a BYREF argument as the variable", () => {
    const call = statements(bindText(source)).find((s) => s.kind === "call") as Extract<BoundStatement, { kind: "call" }>;
    expect(call.args[0]).toMatchObject({ byref: true, value: { kind: "variable", symbol: { name: "r" } } });
  });

  it("calls a FUNCTION defined later, with its real signature", () => {
    const b = bindText("PRINT twice(4)\nFUNCTION twice(n AS UByte) AS UInteger\n RETURN n * 2\nEND FUNCTION\n");
    expect(b.semantic).toEqual([]);
    expect(show(valueOf(statements(b)[0]))).toBe("twice(4:UByte):UInteger");
  });

  it("keeps the definition's signature when a DECLARE matches", () => {
    const b = bindText("DECLARE FUNCTION f(a AS UByte) AS UByte\nPRINT f(1)\nFUNCTION f(a AS UByte) AS UByte\n RETURN a\nEND FUNCTION\n");
    expect(b.semantic).toEqual([]);
  });

  it("gives parameters and locals their own scope", () => {
    const b = bindText("SUB s(p AS UByte)\n DIM l AS Integer = p\n PRINT l\nEND SUB\ns 1\n");
    const scope = b.program.routines[0].scope!;
    expect(scope.lookupLocal("p", false)).toMatchObject({ storage: "param", type: "UByte" });
    expect(scope.lookupLocal("l", false)).toMatchObject({ storage: "local", type: "Integer" });
  });

  it("passes a whole array to an array parameter", () => {
    const b = bindText("SUB s(a() AS UByte)\n PRINT a(1)\nEND SUB\nDIM t(3) AS UByte\ns(t)\n");
    expect(b.semantic).toEqual([]);
  });
});

describe("declarations", () => {
  it("keeps a constant global initial value static", () => {
    const b = bindText("DIM n AS UByte = 5\nPRINT n\n");
    expect((globalSymbol(b, "n") as VariableSymbol).initial?.value).toEqual({ kind: "int", value: 5n });
    expect(statements(b).filter((s) => s.kind === "dim")).toEqual([]);
  });

  it("assigns a non-constant initial value where the DIM stands", () => {
    const b = bindText("DIM a AS UByte = 1\nDIM n AS UByte = a + 1\nPRINT n\n");
    expect(statements(b).find((s) => s.kind === "dim")).toMatchObject({ kind: "dim", symbol: { name: "n" } });
  });

  it("maps a variable to an address", () => {
    const b = bindText("DIM frames AS UInteger AT 23672\nPRINT frames\n");
    expect((globalSymbol(b, "frames") as VariableSymbol).at?.value).toEqual({ kind: "int", value: 23672n });
  });

  it("maps a variable to a label's address", () => {
    const b = bindText("DIM x AS UByte AT @table\nPRINT x\nEND\ntable: ASM\n defb 1\nEND ASM\n");
    expect((globalSymbol(b, "x") as VariableSymbol).at?.value).toEqual({ kind: "address", symbol: "label:table", offset: 0 });
  });

  it("orders an initialiser row-major, converted to the element type", () => {
    const b = bindText("DIM m(1, 2) AS Integer => {{1, 2, 3}, {4, 5, -6}}\nPRINT m(0, 0)\n");
    expect((globalSymbol(b, "m") as ArraySymbol).initial?.map((c) => (c.value as { value: bigint }).value)).toEqual([1n, 2n, 3n, 4n, 5n, -6n]);
  });

  it("takes an extra subscript of a String array as a character index", () => {
    const b = bindText('DIM s$(3)\ns$(1) = "abc"\nPRINT s$(1, 2)\n', { optimize: 0 });
    expect(b.semantic).toEqual([]);
    expect(show(valueOf(statements(b)[1]))).toBe("s(1:UInteger):String[2:UInteger..2:UInteger char]");
  });

  it("assigns into a substring", () => {
    const b = bindText('a$ = "hello"\na$(0 TO 1) = "HE"\nPRINT a$\n');
    expect(b.semantic).toEqual([]);
    expect((statements(b)[1] as Extract<BoundStatement, { kind: "assign" }>).target.kind).toBe("slice");
  });
});

describe("robustness", () => {
  // --- Every spec form, accepted or rejected by the parser, binds without throwing
  const programs = Object.values(CASES).flatMap((c) => [...c.accept, ...c.reject]);
  it(`binds all ${programs.length} spec-form programs without throwing`, () => {
    for (const source of programs) {
      const diagnostics = new DiagnosticBag();
      const front = parseProgram("/t.bas", source, { read: () => undefined }, {}, diagnostics);
      expect(() => bind(front.program, defaultOptions(), diagnostics), source).not.toThrow();
    }
  });
});

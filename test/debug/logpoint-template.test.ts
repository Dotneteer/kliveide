import { describe, expect, it } from "vitest";

import {
  DEFAULT_LOG_GROUP,
  compileLogTemplate,
  defaultFormatOf,
  formatLogValue,
  logGroupOf,
  renderLogTemplate,
  type CompiledLogTemplate
} from "@common/utils/breakpoint-condition/logpoint-template";
import { parseDezogExpression } from "@common/utils/breakpoint-condition/dezog/dezog-parser";
import { compileCondition, compileConditionWith } from "@common/utils/breakpoint-condition/condition-checker";
import { CondOp, emitCondition } from "@common/utils/breakpoint-condition/condition-bytecode";
import type { ConditionEnvironment } from "@common/utils/breakpoint-condition/condition-types";
import type { SyntaxNode } from "@common/utils/breakpoint-condition/condition-parser";

/*
 * Logpoint templates and the DeZog expression dialect - the front end only: parsing, checking,
 * groups, formats and the tree each dialect builds (`.plans/LOGPOINTS_PLAN.md` §3, Phase 2).
 * Evaluation runs on the C evaluator, in `test/wasm/condition/logpoint-evaluation.test.ts`.
 */

const EXEC: ConditionEnvironment = { accessKind: "exec" };
const MEMORY: ConditionEnvironment = { accessKind: "memory" };

function klive(text: string, env: ConditionEnvironment = EXEC): CompiledLogTemplate {
  const result = compileLogTemplate(text, "klive", env);
  if (!result.template) throw new Error(`'${text}': ${result.errors[0]?.message}`);
  return result.template;
}

function dezog(text: string, env: ConditionEnvironment = EXEC): CompiledLogTemplate {
  const result = compileLogTemplate(text, "dezog", env);
  if (!result.template) throw new Error(`'${text}': ${result.errors[0]?.message}`);
  return result.template;
}

function error(text: string, dialect: "klive" | "dezog" = "klive", env = EXEC) {
  const result = compileLogTemplate(text, dialect, env);
  expect(result.template).toBeUndefined();
  return result.errors[0];
}

/** A compact rendering of a syntax tree, for precedence checks. */
function shape(node: SyntaxNode): string {
  switch (node.k) {
    case "num":
      return String(node.v);
    case "name":
      return node.quoted ? `label(${node.name})` : node.name;
    case "mem":
      return `${node.access.name}(${shape(node.addr)})`;
    case "machine":
      return `${node.fn}()`;
    case "un":
      return `${node.op}${shape(node.e)}`;
    case "bin":
      return `(${shape(node.l)} ${node.op} ${shape(node.r)})`;
    default:
      return node.k;
  }
}

describe("Klive dialect templates", () => {
  it("splits literal text and placeholders", () => {
    const t = klive("x={A} at {PC:hex16}");
    expect(t.group).toBe(DEFAULT_LOG_GROUP);
    expect(t.segments.map((s) => s.k)).toEqual(["text", "value", "text", "value"]);
    expect(t.segments[0]).toEqual({ k: "text", text: "x=" });
    const pc = t.segments[3];
    expect(pc.k === "value" && pc.format).toBe("hex16");
    expect(pc.k === "value" && pc.source).toBe("PC");
  });

  it("reads doubled braces as literal braces and keeps a lone $", () => {
    const t = klive("{{literal braces}} and a dollar $ sign");
    expect(t.segments).toEqual([{ k: "text", text: "{literal braces} and a dollar $ sign" }]);
  });

  it("takes a leading [NAME] as the group and does not print it", () => {
    const t = klive("[sprites] sprite {B} at {w[IX+2]:hex16}, visible={b[IX+4] & $80 != 0}");
    expect(t.group).toBe("SPRITES");
    expect(t.segments[0]).toEqual({ k: "text", text: "sprite " });
    expect(logGroupOf("[Loop.1] B={B}")).toBe("LOOP.1");
    expect(logGroupOf("B={B}")).toBe("DEFAULT");
    // --- Only a leading group counts
    expect(klive("B={B} [X]").group).toBe("DEFAULT");
  });

  it("holds a full condition expression in a placeholder", () => {
    const t = klive("{A == 3}");
    const seg = t.segments[0];
    expect(seg.k === "value" && seg.compiled.tree.k).toBe("bin");
  });

  it("recognises a format only as a top-level ':' followed by a format name", () => {
    const sp128: ConditionEnvironment = {
      accessKind: "exec",
      hasPartitions: true,
      isNext: true,
      parsePartitionLabel: (label) => (/^[0-9a-f]{1,2}$/i.test(label) ? parseInt(label, 16) : undefined)
    };
    const part = klive("{b[05:$C010]}", sp128).segments[0];
    expect(part.k === "value" && part.format).toBeUndefined();
    expect(part.k === "value" && part.compiled.tree.k).toBe("mem");

    const bankLabel = klive("{05:Flags}", sp128).segments[0];
    expect(bankLabel.k === "value" && bankLabel.format).toBeUndefined();
    expect(bankLabel.k === "value" && bankLabel.compiled.labels).toEqual(["5:flags"]);

    const formatted = klive("{05:hex8}", sp128).segments[0];
    expect(formatted.k === "value" && formatted.format).toBe("hex8");

    const parenthesized = klive("{(05:hex8)}", sp128).segments[0];
    expect(parenthesized.k === "value" && parenthesized.format).toBeUndefined();
    expect(parenthesized.k === "value" && parenthesized.compiled.labels).toEqual(["5:hex8"]);
  });

  it("does not take a ':' inside a string or after a prime as a format", () => {
    const t = klive('{w[HL] == "A:"}', MEMORY);
    expect(t.segments[0].k === "value" && t.segments[0].format).toBeUndefined();
    const primed = klive("{AF':hex16}").segments[0];
    expect(primed.k === "value" && primed.format).toBe("hex16");
  });

  it("accepts every format, case-insensitively", () => {
    for (const fmt of ["hex8", "HEX16", "int8", "int16", "uint8", "uint16", "bits", "string"]) {
      const seg = klive(`{HL:${fmt}}`).segments[0];
      expect(seg.k === "value" && seg.format).toBe(fmt.toLowerCase());
    }
  });

  it("compiles slots() as a whole placeholder only", () => {
    expect(klive("map={slots()}").segments[1]).toEqual({ k: "slots" });
    expect(error("{slots() + 1}").message).toMatch(/slots\(\) is text/);
    expect(error("{slots():hex8}").message).toMatch(/takes no format/);
  });

  it("compiles the machine specials", () => {
    const seg = klive("{tstates()} {cpufreq()} {frame()}").segments;
    expect(seg.filter((s) => s.k === "value").map((s) => s.k === "value" && s.compiled.tree.k)).toEqual([
      "machine",
      "machine",
      "machine"
    ]);
    expect(seg[0].k === "value" && seg[0].usesEnv).toBe(false); // --- tstates is read by the core
    expect(seg[2].k === "value" && seg[2].usesEnv).toBe(true);
    expect(error("{frame(1)}").message).toBe("frame() takes no argument");
  });

  it("reports errors with ranges in the whole template", () => {
    const unterminated = error("x={A");
    expect(unterminated.message).toMatch(/Unterminated placeholder/);
    expect(unterminated.start).toBe(2);

    const lone = error("x=}");
    expect(lone.message).toBe("A literal '}' is written '}}'");
    expect([lone.start, lone.end]).toEqual([2, 3]);

    expect(error("x={}").message).toBe("Empty placeholder");

    const bad = error("ok {A +} then");
    expect(bad.start).toBeGreaterThanOrEqual(4);
    expect(bad.start).toBeLessThanOrEqual(8);

    const fmt = error("{A:hex}");
    expect(fmt.message).toMatch(/Unknown format 'hex'/);
    expect([fmt.start, fmt.end]).toEqual([3, 6]);

    expect(error("{VAL}").message).toMatch(/execution breakpoint has none/);
    expect(compileLogTemplate("{VAL}", "klive", MEMORY).template).toBeDefined();
  });

  it("warns about an unknown label and makes the template inactive", () => {
    const result = compileLogTemplate("n={b[counter]} m={max}", "klive", { ...EXEC, symbols: { max: 3 } });
    expect(result.warnings.map((w) => w.message)).toEqual([
      "Unknown label counter: the breakpoint is inactive until a build defines it"
    ]);
    expect(result.warnings[0].start).toBe(5);
    expect(result.template!.inactiveReason).toBe("unknown label counter");
  });

  it("is refused on a machine that is not a Z80", () => {
    expect(error("{A}", "klive", { ...EXEC, isZ80: false }).message).toMatch(/Z80 machines only/);
  });
});

describe("DeZog dialect templates", () => {
  it("reads the DeZog examples", () => {
    const t = dezog("[SPRITES] Status=${A:hex8}, Counter=${b@(sprite.counter)}");
    expect(t.group).toBe("SPRITES");
    expect(t.segments.map((s) => s.k)).toEqual(["text", "value", "text", "value"]);
    const counter = t.segments[3];
    expect(counter.k === "value" && counter.compiled.labels).toEqual(["sprite.counter"]);

    const t2 = dezog("Status=${w@(HL)}, ${DE}, ${b@(DE+1)}");
    expect(t2.segments.filter((s) => s.k === "value")).toHaveLength(3);

    const t3 = dezog("Freq=${Remote.cpuFrequency/1000000}MHz");
    expect(t3.segments[2]).toEqual({ k: "text", text: "MHz" });

    expect(dezog("${Remote.slots}").segments[0]).toEqual({ k: "slots" });
  });

  it("keeps a lone $ and braces as literal text", () => {
    const t = dezog("cost $5 {x} ${A}");
    expect(t.segments[0]).toEqual({ k: "text", text: "cost $5 {x} " });
  });

  it("refuses an unterminated placeholder and an unknown format", () => {
    expect(error("x=${A", "dezog").message).toMatch(/Unterminated placeholder/);
    expect(error("${A:hexa}", "dezog").message).toMatch(/Unknown format 'hexa'/);
  });
});

describe("DeZog expression dialect", () => {
  const parse = (text: string) => shape(parseDezogExpression(text));

  it("uses C precedence", () => {
    expect(parse("A & 0x0F == 3")).toBe("(A & (15 == 3))");
    expect(parse("x || y && z")).toBe("(label(x) || (label(y) && label(z)))");
    expect(parse("A < 3 == 1")).toBe("((A < 3) == 1)");
    expect(parse("1 + 2 * 3 % 4")).toBe("(1 + ((2 * 3) % 4))");
    expect(parse("1 << 2 + 3")).toBe("(1 << (2 + 3))");
    expect(parse("A | B ^ C & D")).toBe("(A | (B ^ (C & D)))");
  });

  it("differs from the Klive dialect where precedence does", () => {
    const k = compileCondition("A & $0F == 3", EXEC).compiled!;
    expect(k.tree.k === "bin" && k.tree.op).toBe("==");
    const d = compileConditionWith("A & 0x0F == 3", EXEC, parseDezogExpression).compiled!;
    expect(d.tree.k === "bin" && d.tree.op).toBe("&");
  });

  it("reads b@ and w@ memory and leaves bare parentheses as grouping", () => {
    expect(parse("b@(HL)")).toBe("b@(HL)");
    expect(parse("w@(DE+1)")).toBe("w@((DE + 1))");
    expect(parse("(HL)")).toBe("HL");
    expect(() => parseDezogExpression("b@HL")).toThrow(/b@\(HL\)/);
  });

  it("reads 0x, h-suffix and decimal literals and refuses other forms", () => {
    expect(parse("0x12FA")).toBe(String(0x12fa));
    expect(parse("7Fh")).toBe(String(0x7f));
    expect(parse("0FFh")).toBe(String(0xff));
    expect(parse("31")).toBe("31");
    expect(() => parseDezogExpression("$1F")).toThrow(/0x1F or 1Fh/);
    expect(() => parseDezogExpression("12G")).toThrow(/Invalid number/);
    expect(() => parseDezogExpression("'A'")).toThrow(/literals are not part/);
  });

  it("treats registers by DeZog's names and everything else as a label", () => {
    expect(parse("AF' + IXL + hl")).toBe("((AF' + IXL) + hl)");
    // --- Klive's flag names and VAL mean nothing in DeZog: they are labels there
    expect(parse("zf + val")).toBe("(label(zf) + label(val))");
    expect(parse("sprite.counter")).toBe("label(sprite.counter)");
    const compiled = compileConditionWith("val", EXEC, parseDezogExpression).compiled!;
    expect(compiled.tree.k).toBe("label");
  });

  it("reads the Remote specials", () => {
    expect(parse("Remote.tStates")).toBe("tstates()");
    expect(parse("remote.CPUFREQUENCY / 1000000")).toBe("(cpufreq() / 1000000)");
    expect(() => parseDezogExpression("Remote.foo")).toThrow(/Unknown special/);
  });

  it("emits the new operators", () => {
    const compiled = compileConditionWith("A * 2 / 3 % 4", EXEC, parseDezogExpression).compiled!;
    const code = Array.from(emitCondition(compiled));
    expect(code).toContain(CondOp.MUL);
    expect(code).toContain(CondOp.DIV);
    expect(code).toContain(CondOp.MOD);
  });
});

describe("Klive dialect: the new operators", () => {
  it("binds * and / tighter than + and -", () => {
    const c = compileCondition("A + B * 2 == 7", EXEC).compiled!;
    expect(c.tree.k === "bin" && c.tree.l.k === "bin" && c.tree.l.op).toBe("+");
    const l = c.tree.k === "bin" && c.tree.l.k === "bin" ? c.tree.l.r : undefined;
    expect(l?.k === "bin" && l.op).toBe("*");
  });

  it("has no % operator: % starts a binary literal", () => {
    expect(compileCondition("A % 2", EXEC).errors[0]?.message).toMatch(/Invalid number|Unexpected/);
  });
});

describe("Formats", () => {
  const hex2 = { kind: "hex", digits: 2 } as const;
  const dec = { kind: "decimal" } as const;

  it("prints each format at its boundaries", () => {
    expect(formatLogValue(0xf3n, "hex8", dec)).toBe("F3");
    expect(formatLogValue(0xf3n, "hex16", dec)).toBe("00F3");
    expect(formatLogValue(0xf3n, "uint8", dec)).toBe("243");
    expect(formatLogValue(0xf3n, "int8", dec)).toBe("-13");
    expect(formatLogValue(0x80n, "int8", dec)).toBe("-128");
    expect(formatLogValue(0x7fn, "int8", dec)).toBe("127");
    expect(formatLogValue(0x8000n, "int16", dec)).toBe("-32768");
    expect(formatLogValue(0x1ffffn, "uint16", dec)).toBe("65535");
    expect(formatLogValue(0xf3n, "bits", dec)).toBe("11110011");
    expect(formatLogValue(0xffn, "bits", dec)).toBe("11111111");
    expect(formatLogValue(0x100n, "bits", dec)).toBe("0000000100000000");
    expect(formatLogValue(-1n, "bits", dec)).toBe("1111111111111111");
    expect(formatLogValue(-13n, "hex8", dec)).toBe("F3");
  });

  it("reads a string from memory up to a 0 or 64 bytes, mapping ZX characters back", () => {
    const memory = new Uint8Array(0x10000);
    const text = [0x48, 0x49, 0x60, 0x7f, 0x5e, 0x01, 0];
    memory.set(text, 0x8000);
    const peek = (a: number) => memory[a];
    expect(formatLogValue(0x8000n, "string", dec, peek)).toBe("HI£©↑\\x01");
    memory.fill(0x41, 0x9000, 0x9100);
    expect(formatLogValue(0x9000n, "string", dec, peek)).toBe("A".repeat(64));
  });

  it("prints a bare value by what it reads (Q2)", () => {
    expect(formatLogValue(0x3fn, undefined, hex2)).toBe("$3F");
    expect(formatLogValue(0xc000n, undefined, { kind: "hex", digits: 4 })).toBe("$C000");
    expect(formatLogValue(0x12345678n, undefined, { kind: "hex", digits: 8 })).toBe("$12345678");
    expect(formatLogValue(1n, undefined, { kind: "flag" })).toBe("1");
    expect(formatLogValue(-5n, undefined, dec)).toBe("-5");
  });

  it("chooses the default format from the expression", () => {
    const fallback = (text: string, env = EXEC) => defaultFormatOf(compileCondition(text, env).compiled!.tree);
    expect(fallback("A")).toEqual({ kind: "hex", digits: 2 });
    expect(fallback("HL")).toEqual({ kind: "hex", digits: 4 });
    expect(fallback("ZF")).toEqual({ kind: "flag" });
    expect(fallback("VAL", MEMORY)).toEqual({ kind: "hex", digits: 2 });
    expect(fallback("ADDR", MEMORY)).toEqual({ kind: "hex", digits: 4 });
    expect(fallback("w[HL]")).toEqual({ kind: "hex", digits: 4 });
    expect(fallback("l[HL]")).toEqual({ kind: "hex", digits: 8 });
    expect(fallback("sb[HL]")).toEqual({ kind: "decimal" });
    expect(fallback("A + 1")).toEqual({ kind: "decimal" });
    expect(fallback("tstates()")).toEqual({ kind: "decimal" });
  });

  it("renders a template from evaluated values", () => {
    const t = klive("[G] a={A} b={B:int8} c={1/0} d={slots()} e={HL:string}");
    const values = new Map<number, bigint>();
    t.segments.forEach((s, i) => {
      if (s.k === "value" && s.source === "A") values.set(i, 0x3fn);
      if (s.k === "value" && s.source === "B") values.set(i, 0xffn);
      if (s.k === "value" && s.source === "HL") values.set(i, 0x10n);
    });
    const text = renderLogTemplate(
      t,
      (i) => (values.has(i) ? { status: "ok", value: values.get(i)! } : { status: "divZero" }),
      { peek: (a) => (a === 0x10 ? 0x4b : 0), slots: () => "R0 B5 B2 B0" }
    );
    expect(text).toBe("a=$3F b=-1 c=<division by zero> d=R0 B5 B2 B0 e=K");
  });
});

import { describe, expect, it } from "vitest";

import type { SourceLevelDebugInfo } from "@abstractions/CompilerInfo";
import type { VariableDebugInfo } from "@abstractions/SourceDebugInfo";
import { BASIC_LANGUAGE } from "@renderer/appIde/debugger/languages/basic";
import { C_LANGUAGE, parseCExpression } from "@renderer/appIde/debugger/languages/c";
import { debugLanguageOf } from "@renderer/appIde/debugger/languages/registry";
import { arrayTypeLabel, elementName, formatRaw, NEUTRAL_LANGUAGE } from "@renderer/appIde/debugger/source/language-support";
import { decodeValue, encodeValue, memoryView, valueSize } from "@renderer/appIde/debugger/source/value-decoder";
import { variableNode } from "@renderer/appIde/debugger/source/variables-model";
import { evaluateWatch } from "@renderer/appIde/debugger/source/watch-expression";

/**
 * The language-neutral presentation core and its language plugins (`.plans/SHARED_Z80_BACKEND_PLAN.md`
 * §12.3, §12.4): representations decode without a language; a plugin decides how values, arrays and
 * local activations are written, and what a watch means.
 */

const memory = new Uint8Array(0x10000);
const mem = memoryView(memory);

describe("value representations", () => {
  it("decodes the built-in representations without a language", () => {
    memory.set([0xfe, 0xff], 0x8000);
    expect(decodeValue("i16", mem, 0x8000).text).toBe("-2");
    expect(decodeValue("u16", mem, 0x8000).text).toBe("65534");
    expect(decodeValue("ptr16", mem, 0x8000).text).toBe("$FFFE");
    memory[0x8010] = 65;
    expect(decodeValue("char8", mem, 0x8010).text).toBe("65 'A'");
    memory[0x8011] = 0xff;
    expect(decodeValue("bool", mem, 0x8011).text).toBe("true");
  });

  it("reads C strings, Pascal short strings and heap strings", () => {
    memory.set([...Buffer.from("hi"), 0], 0x9000);
    memory.set([0x00, 0x90], 0x8020);
    expect(decodeValue("str.c", mem, 0x8020).string).toBe("hi");
    memory.set([3, ...Buffer.from("abcdef")], 0x8030);
    expect(valueSize("str.short:6")).toBe(7);
    expect(decodeValue("str.short:6", mem, 0x8030).string).toBe("abc");
    memory.set([2, 0, ...Buffer.from("ok")], 0x9100);
    memory.set([0x00, 0x91], 0x8040);
    expect(decodeValue("str.heap", mem, 0x8040).text).toBe('"ok"');
    expect(decodeValue("str.heap", mem, 0x8040, BASIC_LANGUAGE).text).toBe('"ok"');
  });

  it("shows a representation nobody decodes as its bytes", () => {
    memory.set([0x81, 0x00, 0x00, 0x00, 0x00, 0x00], 0x8050);
    expect(valueSize("real48")).toBe(1);
    expect(decodeValue("real48", mem, 0x8050).text).toBe("81");
  });

  it("uses a decoder a language registers for its own representation", () => {
    const lang = { id: "x", decoders: { word2: { size: 2, decode: (b: number[]) => ({ kind: "int" as const, value: b[0] * 2 }) } } };
    memory.set([21, 0], 0x8060);
    expect(decodeValue("word2", mem, 0x8060, lang).text).toBe("42");
  });

  it("stores true as the representation says", () => {
    expect(encodeValue("bool", "Boolean", "TRUE")).toEqual({ bytes: [1] });
    expect(encodeValue("bool/ff", "Boolean", "true")).toEqual({ bytes: [0xff] });
    expect(encodeValue("i8", "char", "200")).toEqual({ error: expect.stringContaining("char") });
    expect(encodeValue("str.c", "char *", "x")).toHaveProperty("error");
  });
});

describe("how a language writes values", () => {
  it("writes the neutral form without a plugin", () => {
    expect(formatRaw(NEUTRAL_LANGUAGE, { kind: "bool", value: true })).toBe("true");
    expect(formatRaw(NEUTRAL_LANGUAGE, { kind: "text", codes: [72, 34, 7], truncated: false })).toBe('"H\\"\\x07"');
    expect(arrayTypeLabel(NEUTRAL_LANGUAGE, "Integer", [{ lower: 1, count: 3 }])).toBe("Integer[1..3]");
    expect(elementName(NEUTRAL_LANGUAGE, "a", [1, 2], false)).toBe("a[1][2]");
  });

  it("writes BASIC's forms with the BASIC plugin, and C's with the C plugin", () => {
    expect(formatRaw(BASIC_LANGUAGE, { kind: "bool", value: false })).toBe("FALSE");
    expect(formatRaw(BASIC_LANGUAGE, { kind: "text", codes: [72, 34], truncated: false })).toBe('"H"""');
    expect(arrayTypeLabel(BASIC_LANGUAGE, "UByte", [{ lower: 0, count: 10 }, { lower: 1 }])).toBe("UByte(0 TO 9, 1 TO ?)");
    expect(arrayTypeLabel(C_LANGUAGE, "int", [{ lower: 0, count: 10 }])).toBe("int[10]");
    expect(BASIC_LANGUAGE.localActivationLabel!("100")).toBe("GOSUB 100");
  });

  it("finds a plugin by the producer's language, and the neutral one otherwise", () => {
    expect(debugLanguageOf("basic")).toBe(BASIC_LANGUAGE);
    expect(debugLanguageOf("c")).toBe(C_LANGUAGE);
    expect(debugLanguageOf("pascal")).toBe(NEUTRAL_LANGUAGE);
    expect(debugLanguageOf(undefined)).toBe(NEUTRAL_LANGUAGE);
  });
});

describe("inline arrays (a C or Pascal array: the elements themselves at the variable's address)", () => {
  it("expands by the declared bounds", () => {
    memory.set([1, 0, 2, 0, 3, 0], 0xa000);
    const v: VariableDebugInfo = {
      name: "a",
      displayName: "a",
      type: "i16",
      typeLabel: "int",
      kind: "global",
      location: { at: "absolute", address: 0xa000 },
      array: { elementType: "i16", elementLabel: "int", layout: "inline", dimensions: [{ lower: 0, upper: 2 }] },
      scope: "global",
      declaredAt: { fileIndex: 0, line: 1, column: 0 }
    };
    const node = variableNode(v, mem, undefined, C_LANGUAGE)!;
    expect(node.type).toBe("int[3]");
    expect(node.expand!().map((n) => `${n.name}=${n.value}`)).toEqual(["a[0]=1", "a[1]=2", "a[2]=3"]);
  });
});

describe("watch expressions in each language", () => {
  memory.set([7, 0], 0xb000);
  const info = {
    language: "c",
    files: [],
    statements: [],
    callables: [],
    addressToStatement: [],
    extensions: {
      variables: [
        { name: "n", displayName: "n", type: "i16", typeLabel: "int", kind: "global", location: { at: "absolute", address: 0xb000 }, scope: "global", declaredAt: { fileIndex: 0, line: 1, column: 0 } }
      ],
      callSites: [],
      frames: [],
      mainBaselineSymbol: 0,
      runtimeSymbols: [],
      optimizationLevel: 0
    }
  } as unknown as SourceLevelDebugInfo;
  const w = (text: string, lang = C_LANGUAGE) => {
    const r = evaluateWatch(text, { info, chain: [], frame: 0, mem, lang });
    return "error" in r ? `error: ${r.error}` : r.text;
  };

  it("gives C's meanings to C's operators", () => {
    expect(w("n / 2")).toBe("3");
    expect(w("n / 2.0")).toBe("3.5");
    expect(w("-n % 4")).toBe("-3");
    expect(w("-8 >> 1")).toBe("-4");
    expect(w("n > 5 || 0")).toBe("1");
    expect(w("0x10 + 010 + 'A'")).toBe(String(16 + 8 + 65));
    expect(w("abs(-n)")).toBe("7");
    expect(w('"a" + "b"')).toMatch(/^error/);
    expect(w("N")).toMatch(/^error/);
    expect(w("n +")).toMatch(/^error/);
  });

  it("gives BASIC's meanings to BASIC's operators", () => {
    expect(w("n / 2", BASIC_LANGUAGE)).toBe("3.5");
    expect(w("-n MOD 4", BASIC_LANGUAGE)).toBe("-3");
    expect(w('"a" + "b"', BASIC_LANGUAGE)).toBe('"ab"');
    // --- BASIC matches names without regard to case when nothing matches exactly
    expect(w("N", BASIC_LANGUAGE)).toBe("7");
  });

  it("says so for a language without watch expressions", () => {
    expect(w("n", NEUTRAL_LANGUAGE)).toMatch(/not available/);
  });

  it("parses C with C's precedence", () => {
    expect(parseCExpression("1 + 2 * 3")).toEqual({
      kind: "binary",
      op: "add",
      left: { kind: "number", value: 1 },
      right: { kind: "binary", op: "mul", left: { kind: "number", value: 2 }, right: { kind: "number", value: 3 } }
    });
    expect(parseCExpression("&a[1][2]")).toMatchObject({ kind: "addressOf", target: { kind: "element", name: "a" } });
  });
});

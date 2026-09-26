import { describe, expect, it } from "vitest";

import { DiagnosticBag } from "@main/kbasic/diagnostics";
import { preprocess, siteSpan, type FileReader } from "@main/kbasic/syntax/preprocessor";
import { SourceSet } from "@main/kbasic/syntax/source";

function run(text: string, files: Record<string, string> = {}, defines?: Record<string, string>, includePaths?: string[]) {
  const reader: FileReader = { read: (path) => files[path] };
  const sources = new SourceSet();
  const root = sources.add("/p/main.zxbas", text);
  const diagnostics = new DiagnosticBag();
  const result = preprocess(sources, root, reader, diagnostics, { defines, includePaths });
  const out = result.tokens
    .filter((t) => t.kind !== "eof")
    .map((t) => (t.kind === "newline" ? "\n" : t.kind === "pragma" ? `#pragma(${t.text})` : t.text))
    .join(" ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n+/g, "\n")
    .trim();
  return { out, diagnostics: diagnostics.items, codes: diagnostics.items.map((d) => d.code), result, sources };
}

describe("Klive BASIC preprocessor", () => {
  it("passes code without directives through unchanged", () => {
    expect(run("PRINT 1\nx = 2").out).toBe("PRINT 1\nx = 2");
  });

  it("expands object-like macros, nested and lazily", () => {
    expect(run("#define B A + 1\n#define A 5\nPRINT B").out).toBe("PRINT 5 + 1");
  });

  it("expands function-like macros, with parentheses and commas inside arguments", () => {
    expect(run("#define ADD(x, y) ((x) + (y))\nPRINT ADD(f(1, 2), 3)").out).toBe("PRINT ( ( f ( 1 , 2 ) ) + ( 3 ) )");
  });

  it("leaves a function-like macro name alone without '('", () => {
    expect(run("#define F(x) x\nPRINT F").out).toBe("PRINT F");
  });

  it("stringizes with # and pastes with ##", () => {
    expect(run('#define S(x) #x\nPRINT S(say "hi")').out).toBe('PRINT "say ""hi"""');
    expect(run("#define V(n) var##n\nV(3) = 1").out).toBe("var3 = 1");
  });

  it("does not expand a macro inside its own expansion", () => {
    expect(run("#define X X + 1\nPRINT X").out).toBe("PRINT X + 1");
  });

  it("reports a wrong argument count and duplicate parameters", () => {
    expect(run("#define F(a, b) a\nPRINT F(1)").codes).toEqual(["E218"]);
    expect(run("#define F(a, a) a").codes).toEqual(["E211"]);
  });

  it("warns on redefinition, a built-in's redefinition and a missing blank after the name", () => {
    expect(run("#define A 1\n#define A 2").codes).toEqual(["W510"]);
    expect(run("#define A 1\n#define A 1").codes).toEqual([]);
    expect(run("#define __LINE__ 3").codes).toEqual(["W500"]);
    expect(run('#define A"x"').codes).toEqual(["W520"]);
  });

  it("continues a #define over lines ending in \\ or _", () => {
    expect(run("#define LONG 1 + \\\n  2 + _\n  3\nPRINT LONG").out).toBe("PRINT 1 + 2 + 3");
  });

  it("undefines", () => {
    expect(run("#define A 1\n#undef A\nPRINT A").out).toBe("PRINT A");
  });

  it("chooses branches with #ifdef, #ifndef, #else and nests them", () => {
    const text = "#define ON\n#ifdef ON\nA\n#ifndef ON\nB\n#else\nC\n#endif\n#else\nD\n#endif";
    expect(run(text).out).toBe("A\nC");
  });

  it.each([
    ["LEVEL == 3", true],
    ["LEVEL = 3", true],
    ["LEVEL != 3", false],
    ["LEVEL <> 2", true],
    ["LEVEL > 2 && LEVEL < 4", true],
    ["LEVEL >= 4 || NAME == \"klive\"", true],
    ["!(LEVEL)", false],
    ["ZERO", false],
    ["NAME", true],
    ["UNDEFINED", false],
    ["NAME > 1", false],
    ["$10 == 16", true]
  ])("evaluates #if %s", (expr, expected) => {
    const r = run(`#define LEVEL 3\n#define ZERO 0\n#define NAME klive\n#if ${expr}\nYES\n#else\nNO\n#endif`);
    expect(r.codes).toEqual([]);
    expect(r.out).toBe(expected ? "YES" : "NO");
  });

  it("supports #elif", () => {
    const text = (v: number) => `#define V ${v}\n#if V == 1\nONE\n#elif V == 2\nTWO\n#elif V == 3\nTHREE\n#else\nOTHER\n#endif`;
    expect([1, 2, 3, 4].map((v) => run(text(v)).out)).toEqual(["ONE", "TWO", "THREE", "OTHER"]);
  });

  it("reports unbalanced conditionals and bad expressions", () => {
    expect(run("#if 1\nA").codes).toEqual(["E201"]);
    expect(run("#endif").codes).toEqual(["E209"]);
    expect(run("#if 1\n#else\n#else\n#endif").codes).toEqual(["E202"]);
    expect(run("#if (1\n#endif").codes).toEqual(["E213"]);
  });

  it("ignores directives in an inactive section, except the conditionals", () => {
    expect(run("#if 0\n#error no\n#include \"x\"\n#endif\nOK").out).toBe("OK");
  });

  it('includes "file" from the including file\'s folder, then the include path', () => {
    const files = { "/p/lib.bas": "LIB\n#include \"sub/inner.bas\"", "/p/sub/inner.bas": "INNER", "/inc/sys.bas": "SYS" };
    expect(run('#include "lib.bas"\n#include <sys.bas>\nMAIN', files, undefined, ["/inc"]).out).toBe("LIB\nINNER\nSYS\nMAIN");
  });

  it("includes through a macro, once, and with #pragma once", () => {
    const files = { "/p/a.bas": "A", "/p/b.bas": "#pragma once\nB" };
    expect(run('#define LIB "a.bas"\n#include LIB', files).out).toBe("A");
    expect(run('#include once "a.bas"\n#include once "a.bas"', files).out).toBe("A");
    expect(run('#include "b.bas"\n#include "b.bas"', files).out).toBe("B");
    expect(run('#include once [arch:zx48k] "a.bas"', files).out).toBe("A");
    expect(run('#include once [cpu:z80] "a.bas"', files).codes).toEqual(["E214"]);
  });

  it("reports a missing file, an unavailable library and self-inclusion", () => {
    expect(run('#include "none.bas"').codes).toEqual(["E216"]);
    const lib = run("#include <zx0.bas>");
    expect(lib.diagnostics[0].message).toBe("<zx0.bas> is not available in Klive BASIC yet");
    expect(run("#include <nowhere.bas>").diagnostics[0].message).toMatch(/not in Klive BASIC's library, nor in the include path/);
    const loop = { "/p/loop.bas": '#include "main.zxbas"', "/p/main.zxbas": "" };
    expect(run('#include "loop.bas"', loop).codes).toEqual(["K216"]);
  });

  it("keeps #pragma lines for the parser and records #require and #init", () => {
    const r = run('#pragma array_base = 1\n#require "mem.asm"\n#init "Setup"\n#init core.Other\nX');
    expect(r.out).toBe("#pragma(array_base = 1)\nX");
    expect(r.result.requires.map((q) => q.name)).toEqual(["mem.asm"]);
    expect(r.result.inits.map((q) => q.name)).toEqual(["Setup", "core.Other"]);
  });

  it("reports #error and #warning with their text", () => {
    const r = run("#warning don't do this\n#error stop here");
    expect(r.diagnostics.map((d) => [d.code, d.severity, d.message])).toEqual([
      ["K205", "warning", "don't do this"],
      ["E205", "error", "stop here"]
    ]);
  });

  it("remaps line numbers with #line", () => {
    const r = run('A\n#line 100 "game.zxbas"\nB');
    const b = r.result.tokens.find((t) => t.text === "B")!;
    expect(r.sources.get(0).location(b.span.start)).toMatchObject({ fileName: "game.zxbas", line: 100 });
  });

  it("gives __LINE__ and __FILE__ where the macro is used", () => {
    expect(run("\n\nPRINT __LINE__, __FILE__, __BASE_FILE__").out).toBe('PRINT 3 , "/p/main.zxbas" , "/p/main.zxbas"');
  });

  it("takes predefined macros, and reports their lexer problems only when used in code", () => {
    expect(run("#if DEBUG\nON\n#endif", {}, { DEBUG: "1" }).out).toBe("ON");
    expect(run('#include LIB', { "/p/x.bas": "X" }, { LIB: '"x.bas"' }).out).toBe("X");
    expect(run("#define ODD <a.b>\nOK").codes).toEqual([]);
    expect(run("#define ODD a ? b\nPRINT ODD").codes).toEqual(["E101"]);
  });

  it("points macro output at the macro use", () => {
    const r = run("#define TWO 1 + 1\nPRINT TWO");
    const plus = r.result.tokens.find((t) => t.text === "+")!;
    expect(r.sources.get(0).text.slice(siteSpan(plus).start, siteSpan(plus).end)).toBe("TWO");
    expect(plus.expansion?.[0].macro).toBe("TWO");
  });

  it("keeps ASM lines and handles directives inside ASM blocks", () => {
    expect(run("ASM\n#ifdef NOPE\n  halt\n#endif\n  nop\nEND ASM").out).toBe("ASM\n  nop\nEND ASM");
  });

  it("accepts macro names that are BASIC keywords, matching their exact spelling", () => {
    expect(run("#define ON 1\n#ifdef ON\nYES\n#endif").out).toBe("YES");
    expect(run("#define PRINT PRINT AT 0,0;\nPRINT 1\nprint 2").out).toBe("PRINT AT 0 , 0 ; 1\nprint 2");
  });

  it("reports unknown directives", () => {
    expect(run("#frobnicate").codes).toEqual(["E208"]);
  });
});

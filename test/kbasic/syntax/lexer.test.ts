import { describe, expect, it } from "vitest";

import { DiagnosticBag } from "@main/kbasic/diagnostics";
import { KEYWORDS } from "@main/kbasic/syntax/keywords";
import { lex } from "@main/kbasic/syntax/lexer";
import { SourceSet } from "@main/kbasic/syntax/source";
import type { Token } from "@main/kbasic/syntax/tokens";

import spec from "../../../.ai/zxbasic-syntax/zxbasic-syntax.json";

function tokens(text: string) {
  const sources = new SourceSet();
  const file = sources.add("test.zxbas", text);
  const diagnostics = new DiagnosticBag();
  const result = lex(file, diagnostics);
  return { ...result, diagnostics: diagnostics.items, file };
}

/** A compact view: kind:text, newline as NL. */
function shape(text: string): string[] {
  return tokens(text)
    .tokens.filter((t) => t.kind !== "eof")
    .map((t) => (t.kind === "newline" ? "NL" : `${t.kind}:${t.text}`));
}

function only(text: string): Token {
  const ts = tokens(text).tokens.filter((t) => t.kind !== "newline" && t.kind !== "eof");
  expect(ts.length, `one token in ${JSON.stringify(text)}`).toBe(1);
  return ts[0];
}

describe("Klive BASIC lexer", () => {
  it("knows exactly the spec's reserved words", () => {
    const specNames = spec.keywords.map((k) => k.name).sort();
    expect(Object.keys(KEYWORDS).sort()).toEqual(specNames);
    for (const k of spec.keywords) expect(KEYWORDS[k.name], k.name).toBe(k.kind);
  });

  it("reads keywords case-insensitively and identifiers with sigils", () => {
    expect(only("PrInT")).toMatchObject({ kind: "keyword", keyword: "PRINT" });
    expect(only("chr$")).toMatchObject({ kind: "keyword", keyword: "CHR$" });
    expect(only("name$")).toMatchObject({ kind: "identifier", name: "name", sigil: "$" });
    expect(only("count%")).toMatchObject({ kind: "identifier", name: "count", sigil: "%" });
    expect(only("_under_score9")).toMatchObject({ kind: "identifier", name: "_under_score9" });
    expect(only("SCREEN$")).toMatchObject({ kind: "identifier", name: "SCREEN", sigil: "$" });
    expect(only("codebank")).toMatchObject({ kind: "keyword", keyword: "CODEBANK" });
  });

  it("rejects a sigil on a reserved word", () => {
    expect(tokens("print$").diagnostics.map((d) => d.code)).toEqual(["E106"]);
  });

  it.each([
    ["123", 123, "integer"],
    ["1.5", 1.5, "real"],
    [".5", 0.5, "real"],
    ["1e3", 1000, "real"],
    ["2.5E-3", 0.0025, "real"],
    ["$9C", 0x9c, "based"],
    ["0x9C", 0x9c, "based"],
    ["9Ch", 0x9c, "based"],
    ["0C9h", 0xc9, "based"],
    ["17o", 15, "based"],
    ["%101", 5, "based"],
    ["101b", 5, "based"],
    ["00B", 0, "based"],
    ["00Bh", 0x0b, "based"],
    ["BIN 101", 5, "based"],
    ["bin", 0, "based"]
  ])("reads the number %s", (text, value, form) => {
    expect(only(text)).toMatchObject({ kind: "number", value, numberForm: form });
  });

  it("does not read C9h as a number", () => {
    expect(only("C9h")).toMatchObject({ kind: "identifier", name: "C9h" });
  });

  it("reads BIN followed by a non-binary token as 0 and keeps the token", () => {
    expect(shape("BIN x")).toEqual(["number:BIN", "identifier:x", "NL"]);
  });

  it.each([
    ['"Hello"', "Hello"],
    ['"say ""hi"""', 'say "hi"'],
    ['"\\\\"', "\\"],
    ['"\\*"', "\x7f"],
    ['"\\A\\u"', "\x90\xa4"],
    ['"\\ :\\\'."', String.fromCharCode(128 + 0 + 5, 128 + 2 + 4)],
    ['"\\#065"', "A"],
    ['"\\{i2}x"', "\x10\x02x"],
    ['"\\{vi}\\{v0}"', "\x14\x01\x14\x00"],
    ['"\\{I1}\\{B0}"', "\x0f\x01\x0e\x00"],
    ['"a\\zb"', "a\\zb"],
    ['"£©"', "\x60\x7f"]
  ])("decodes the string %s", (text, value) => {
    expect(only(text)).toMatchObject({ kind: "string", stringValue: value });
  });

  it("reports an unterminated string", () => {
    expect(tokens('PRINT "abc\nPRINT').diagnostics.map((d) => d.code)).toEqual(["E104"]);
  });

  it("reads every operator, longest first", () => {
    expect(shape("a<=b>=c<>d<<e>>f:=g=>h").filter((s) => s.startsWith("operator"))).toEqual(
      ["<=", ">=", "<>", "<<", ">>", ":=", "=>"].map((o) => `operator:${o}`)
    );
    const singles = shape("+ - * / ^ ( ) = < > ~ & | ! @ { } , ; :").filter((s) => s !== "NL");
    expect(singles.length).toBe(20);
    expect(singles.every((s) => s.startsWith("operator"))).toBe(true);
  });

  it("keeps comments aside: ', REM and nested /' '/", () => {
    const r = tokens("PRINT 1 ' note\n10 REM remark\nx = /' a /' b '/ c '/ 2\n");
    expect(r.diagnostics).toEqual([]);
    expect(r.comments.map((c) => r.file.text.slice(c.start, c.end))).toEqual(["' note", "REM remark", "/' a /' b '/ c '/"]);
    expect(shape("x = /' a\n b '/ 2")).toEqual(["identifier:x", "operator:=", "number:2", "NL"]);
  });

  it("requires ':' before a REM that follows a statement", () => {
    expect(tokens("PRINT 1 REM x").diagnostics.map((d) => d.code)).toEqual(["E107"]);
    expect(tokens("PRINT 1: REM x\nIF a THEN REM b\nlabel: REM c").diagnostics).toEqual([]);
  });

  it("does not take REMARK for a comment", () => {
    expect(only("REMARK")).toMatchObject({ kind: "identifier", name: "REMARK" });
  });

  it("joins lines ending in _ or \\, even before a comment", () => {
    expect(shape("PRINT 1, _\n 2, \\ ' more\n 3\nx")).toEqual([
      "keyword:PRINT",
      "number:1",
      "operator:,",
      "number:2",
      "operator:,",
      "number:3",
      "NL",
      "identifier:x",
      "NL"
    ]);
  });

  it("marks the first token of a line, not of a continued line", () => {
    const ts = tokens("10 PRINT _\n  a\nlabel: x").tokens;
    expect(ts.filter((t) => t.atLineStart).map((t) => t.text)).toEqual(["10", "label"]);
  });

  it("makes a # line one directive token", () => {
    const ts = tokens("  #  Define X 1\nPRINT X\n#define LONG a + _\n  b\n").tokens;
    const directives = ts.filter((t) => t.kind === "directive");
    expect(directives.map((d) => d.directive!.name)).toEqual(["define", "define"]);
    expect(directives[1].text).toBe("#define LONG a + _\n  b");
  });

  it("reports a # that does not start a line", () => {
    expect(tokens("x = #1").diagnostics.map((d) => d.code)).toEqual(["E101"]);
  });

  it("keeps the lines of an ASM block raw, with directives and END ASM", () => {
    expect(shape("ASM\n  ld a,1 ; 'x'\n#line 5\n\n  end asm\nPRINT")).toEqual([
      "keyword:ASM",
      "NL",
      "asm:  ld a,1 ; 'x'",
      "NL",
      "directive:#line 5",
      "NL",
      "asm:",
      "NL",
      "keyword:end",
      "keyword:asm",
      "NL",
      "keyword:PRINT",
      "NL"
    ]);
  });

  it("reports an ASM block that never ends", () => {
    expect(tokens("ASM\n nop\n").diagnostics.map((d) => d.code)).toEqual(["E102"]);
  });

  it("gives exact spans and positions", () => {
    const r = tokens("a = 1\n  PRINT a$");
    const print = r.tokens.find((t) => t.keyword === "PRINT")!;
    expect(r.file.position(print.span.start)).toEqual({ line: 2, column: 2 });
    expect(print.span.end - print.span.start).toBe(5);
  });

  it("reports characters that are not ZX BASIC", () => {
    expect(tokens("x = 1 ? 2").diagnostics.map((d) => d.code)).toEqual(["E101"]);
    expect(tokens('PRINT "€"').diagnostics.map((d) => d.code)).toEqual(["E105"]);
  });
});

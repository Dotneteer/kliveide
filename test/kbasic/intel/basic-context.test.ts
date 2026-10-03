import { describe, expect, it } from "vitest";
import { scanBasicCall, scanBasicContext } from "@renderer/appIde/services/basic-context";

/** The context at the `|` of the last line. */
function ctx(text: string) {
  const lines = text.split("\n");
  const last = lines.length;
  const column = lines[last - 1].indexOf("|") + 1;
  lines[last - 1] = lines[last - 1].replace("|", "");
  return scanBasicContext(lines, last, column);
}

function call(text: string, isSub = (n: string) => n === "mySub") {
  const lines = text.split("\n");
  const last = lines.length;
  const column = lines[last - 1].indexOf("|") + 1;
  lines[last - 1] = lines[last - 1].replace("|", "");
  return scanBasicCall(lines, last, column, isSub);
}

describe("scanBasicContext", () => {
  it("header options", () => {
    expect(ctx("'@heap|")).toEqual({ kind: "header-option", part: "name", prefix: "heap" });
    expect(ctx("' title\n'@target zx|")).toEqual({ kind: "header-option", part: "value", option: "target", prefix: "zx" });
    expect(ctx("PRINT 1\n'@target |")).toEqual({ kind: "none" });
  });

  it("directives, pragmas and include paths", () => {
    expect(ctx("#inc|")).toEqual({ kind: "directive", prefix: "inc" });
    expect(ctx("#pragma arr|")).toEqual({ kind: "pragma", part: "name", prefix: "arr" });
    expect(ctx("#pragma push(case|")).toEqual({ kind: "pragma", part: "name", prefix: "case" });
    expect(ctx("#pragma explicit = tr|")).toEqual({ kind: "pragma", part: "value", option: "explicit", prefix: "tr" });
    expect(ctx("#include <str|")).toEqual({ kind: "include-path", system: true, prefix: "str" });
    expect(ctx('#include "lib/|')).toEqual({ kind: "include-path", system: false, prefix: "lib/" });
  });

  it("types, labels, statements and expressions", () => {
    expect(ctx("DIM a AS UB|")).toEqual({ kind: "type", prefix: "UB" });
    expect(ctx("SUB s(x AS |")).toEqual({ kind: "type", prefix: "" });
    expect(ctx("GOTO lo|")).toEqual({ kind: "label", prefix: "lo" });
    expect(ctx("  GO SUB |")).toEqual({ kind: "label", prefix: "" });
    expect(ctx("ON n GOTO a, b|")).toEqual({ kind: "label", prefix: "b" });
    expect(ctx("  PR|")).toEqual({ kind: "statement-start", prefix: "PR" });
    expect(ctx("CLS: pr|")).toEqual({ kind: "statement-start", prefix: "pr" });
    expect(ctx("10 |")).toEqual({ kind: "statement-start", prefix: "" });
    expect(ctx("IF a THEN pr|")).toEqual({ kind: "statement-start", prefix: "pr" });
    expect(ctx("PRINT ab|")).toEqual({ kind: "expression", prefix: "ab" });
    expect(ctx("x = 1 + |")).toEqual({ kind: "expression", prefix: "" });
  });

  it("nothing in strings, comments and ASM", () => {
    expect(ctx('PRINT "ab|')).toEqual({ kind: "none" });
    expect(ctx("PRINT 1 ' ab|")).toEqual({ kind: "none" });
    expect(ctx("REM ab|")).toEqual({ kind: "none" });
    expect(ctx("/' start\n  ab|")).toEqual({ kind: "none" });
    expect(ctx("ASM\n  ld a|")).toEqual({ kind: "none" });
    expect(ctx('PRINT "a": PR|')).toEqual({ kind: "statement-start", prefix: "PR" });
  });
});

describe("scanBasicCall", () => {
  it("finds the call and the argument", () => {
    expect(call("x = f(1, |")).toEqual({ name: "f", argIndex: 1, parens: true });
    expect(call("x = f(g(1, 2), |")).toEqual({ name: "f", argIndex: 1, parens: true });
    expect(call("x = f(g(1, |")).toEqual({ name: "g", argIndex: 1, parens: true });
    expect(call('x = f("a,b", |')).toEqual({ name: "f", argIndex: 1, parens: true });
    expect(call("PRINT CHR$(|")).toEqual({ name: "CHR$", argIndex: 0, parens: true });
    expect(call("x = (1 + |")).toBeUndefined();
  });

  it("treats a paren-less statement call as one only when asked", () => {
    expect(call("mySub 1, |")).toEqual({ name: "mySub", argIndex: 1, parens: false });
    expect(call("other 1, |")).toBeUndefined();
  });
});

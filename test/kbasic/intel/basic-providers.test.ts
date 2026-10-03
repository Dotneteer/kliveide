import { describe, expect, it } from "vitest";
import { BasicIntelService } from "@renderer/appIde/services/BasicIntelService";
import {
  computeBasicCompletions,
  computeBasicDefinition,
  computeBasicDocumentSymbols,
  computeBasicHighlights,
  computeBasicHover,
  computeBasicIncludeFileItems,
  computeBasicIncludeLinks,
  computeBasicReferences,
  computeBasicRenameEdits,
  computeBasicRenameValidation,
  computeBasicSignatureHelp,
  includeInsertPosition,
  type BasicRequest
} from "@renderer/appIde/services/basic-providers";
import { intelOf } from "./intel-kit";

const ROOT = "/p/main.zxbas";

/** A request over `text`, with a snapshot of `snapshotText` (default: the same text). */
function request(text: string, files: Record<string, string> = {}, snapshotText = text, options = {}): BasicRequest {
  const service = new BasicIntelService();
  service.update({ [ROOT]: intelOf(snapshotText, files, options) }, ROOT);
  return { service, path: ROOT, lines: text.split("\n"), projectFolder: "/p" };
}

/** The 1-based line and column of the n-th occurrence of `needle` (plus an offset into it). */
function at(text: string, needle: string, offset = 0, nth = 0): [number, number] {
  let index = -1;
  for (let i = 0; i <= nth; i++) index = text.indexOf(needle, index + 1);
  if (index < 0) throw new Error(`no ${needle}`);
  const before = text.slice(0, index + offset);
  const line = before.split("\n").length;
  return [line, before.length - before.lastIndexOf("\n")];
}

const PROGRAM = `#include <attr.bas>
CONST limit AS UByte = 10
DIM total AS UInteger

' Adds one value.
' Returns the new total.
FUNCTION add(BYVAL v AS UByte) AS UInteger
  DIM total AS UInteger
  total = v
  RETURN total
END FUNCTION

total = add(limit)
PRINT ATTR(1, 2)
GOTO done
done:
`;

describe("hover", () => {
  it("shows a symbol's signature, kind, doc comment and file", () => {
    const req = request(PROGRAM);
    const hover = computeBasicHover(req, ...at(PROGRAM, "add(limit)", 1))!;
    expect(hover.contents[0]).toBe("```zxbas\nFUNCTION add(BYVAL v AS UByte) AS UInteger\n```");
    expect(hover.contents[1]).toBe("*FUNCTION*");
    expect(hover.contents[2]).toBe("Adds one value.\nReturns the new total.");
    expect(hover.contents[3]).toBe("Declared in `main.zxbas` line 7");
    const local = computeBasicHover(req, ...at(PROGRAM, "total = v", 1))!;
    expect(local.contents[1]).toBe("*local variable* · UInteger");
    const global = computeBasicHover(req, ...at(PROGRAM, "total = add", 1))!;
    expect(global.contents[1]).toBe("*global variable* · UInteger");
    const constant = computeBasicHover(req, ...at(PROGRAM, "limit)", 1))!;
    expect(constant.contents[1]).toBe("*constant* · value 10");
  });

  it("shows a library routine's file", () => {
    const req = request(PROGRAM);
    const hover = computeBasicHover(req, ...at(PROGRAM, "ATTR(", 1))!;
    expect(hover.contents.at(-1)).toBe("Declared in standard library, `attr.bas` line 9");
  });

  it("shows keyword help with the attribution, and directive help", () => {
    const req = request(PROGRAM);
    const print = computeBasicHover(req, ...at(PROGRAM, "PRINT", 1))!;
    expect(print.contents[0]).toMatch(/^```zxbas\nPRINT/);
    expect(print.contents.at(-1)).toMatch(/CC BY 4\.0/);
    const include = computeBasicHover(req, 1, 3)!;
    expect(include.contents[0]).toMatch(/#include <file>/);
  });

  it("shows header options and numbers; nothing in comments", () => {
    const text = "'@heap-size 2048\nPOKE $5800, BIN 101\n' PRINT\n";
    const req = request(text);
    const option = computeBasicHover(req, 1, 4)!;
    expect(option.contents[0]).toBe("`'@heap-size` — heap size in bytes");
    expect(option.contents).toContain("In this build: `2048`");
    expect(computeBasicHover(req, 2, 8)!.contents[0]).toBe("**`$5800`** = 22528 decimal");
    expect(computeBasicHover(req, 2, 17)!.contents[0]).toMatch(/^\*\*`BIN 101`\*\* = 5 decimal/);
    expect(computeBasicHover(req, 3, 4)).toBeNull();
  });

  it("works without a snapshot (zxbc mode, E13)", () => {
    const req: BasicRequest = { service: new BasicIntelService(), path: ROOT, lines: ["BORDER 1"] };
    expect(computeBasicHover(req, 1, 2)!.contents[0]).toBe("```zxbas\nBORDER expr\n```");
  });
});

describe("definition, references, highlights", () => {
  it("goes to a declaration, into a library and through an #include line", () => {
    const req = request(PROGRAM);
    expect(computeBasicDefinition(req, ...at(PROGRAM, "add(limit)", 1))).toEqual([{ path: ROOT, line: 7, startColumn: 10, endColumn: 13 }]);
    expect(computeBasicDefinition(req, ...at(PROGRAM, "ATTR(", 1))).toEqual([{ path: "<kbasic-stdlib>/attr.bas", line: 9, startColumn: 10, endColumn: 14 }]);
    expect(computeBasicDefinition(req, 1, 13)).toEqual([{ path: "<kbasic-stdlib>/attr.bas", line: 1, startColumn: 1, endColumn: 1 }]);
    expect(computeBasicDefinition(req, ...at(PROGRAM, "GOTO done", 6))).toEqual([{ path: ROOT, line: 16, startColumn: 1, endColumn: 5 }]);
  });

  it("finds the references of a shadowed name, scope-correct", () => {
    const req = request(PROGRAM);
    const global = computeBasicReferences(req, ...at(PROGRAM, "total = add", 1), true);
    expect(global.map((r) => r.line)).toEqual([3, 13]);
    const local = computeBasicReferences(req, ...at(PROGRAM, "total = v", 1), false);
    expect(local.map((r) => r.line)).toEqual([9, 10]);
  });

  it("highlights a symbol's occurrences in the file, or a block's keywords", () => {
    const req = request(PROGRAM);
    expect(computeBasicHighlights(req, ...at(PROGRAM, "total = v", 1)).map((h) => h.line)).toEqual([8, 9, 10]);
    expect(computeBasicHighlights(req, ...at(PROGRAM, "END FUNCTION", 1)).map((h) => h.line)).toEqual([7, 11]);
  });

  it("links #include file names", () => {
    const text = '#include <attr.bas>\n#include "lib.zxbas"\nPRINT twice(1)\n';
    const req = request(text, { "/p/lib.zxbas": "FUNCTION twice(a AS UByte) AS UByte\n RETURN a\nEND FUNCTION\n" });
    expect(computeBasicIncludeLinks(req)).toEqual([
      { line: 1, startColumn: 11, endColumn: 19, path: "<kbasic-stdlib>/attr.bas" },
      { line: 2, startColumn: 11, endColumn: 20, path: "/p/lib.zxbas" }
    ]);
  });
});

describe("outline", () => {
  it("lists routines with their parameters and locals, constants, globals and labels", () => {
    const req = request(PROGRAM);
    const symbols = computeBasicDocumentSymbols(req);
    expect(symbols.map((s) => `${s.name}:${s.line}-${s.endLine}:${s.children.map((c) => c.name).join(",")}`)).toEqual([
      "limit:2-2:",
      "total:3-3:",
      "add:7-11:v,total",
      "done:16-16:"
    ]);
  });

  it("lists the variables a statement created, at their first use", () => {
    const text = "DIM t1 AS FLOAT\nFOR n = 1 TO 3\nNEXT n\nWHILE INKEY$ = \"\"\n  LET a = t1 / 30\n  LET sx = 72 * SIN a\nEND WHILE\n";
    const symbols = computeBasicDocumentSymbols(request(text));
    expect(symbols.map((s) => `${s.name}:${s.line}:${s.detail}`)).toEqual([
      "t1:1:DIM t1 AS Float",
      "n:2:n AS UByte (implicit)",
      "a:5:a AS Float (implicit)",
      "sx:6:sx AS Float (implicit)"
    ]);
  });

  it("an included file's outline is its own", () => {
    const text = '#include "lib.zxbas"\nPRINT twice(1)\n';
    const service = new BasicIntelService();
    service.update({ [ROOT]: intelOf(text, { "/p/lib.zxbas": "FUNCTION twice(a AS UByte) AS UByte\n RETURN a\nEND FUNCTION\n" }) }, ROOT);
    expect(computeBasicDocumentSymbols({ service, path: ROOT, lines: [] })).toEqual([]);
    expect(computeBasicDocumentSymbols({ service, path: "/p/lib.zxbas", lines: [] }).map((s) => s.name)).toEqual(["twice"]);
  });
});

describe("completion", () => {
  const items = (text: string, cursorText: string, snapshot?: string) => {
    const [line, column] = at(text, cursorText, cursorText.length);
    // --- The snapshot is the last good check: the program without the line being typed
    const lines = text.split("\n");
    lines[line - 1] = "";
    const req = request(text, {}, snapshot ?? lines.join("\n"));
    return computeBasicCompletions(req, line, column);
  };

  it("offers types after AS, in the typed case", () => {
    const list = items("DIM a AS ub\n", "AS ub");
    expect(list.startColumn).toBe(10);
    expect(list.items.map((i) => i.label)).toContain("ubyte");
  });

  it("offers labels after GOTO", () => {
    const text = "start:\nGOTO \n10 PRINT\n";
    const list = items(text, "GOTO ");
    expect(list.items.map((i) => i.label)).toEqual(["start", "10"]);
  });

  it("offers statements, snippets and SUBs at a statement start; values in an expression", () => {
    const text = "SUB greet()\nEND SUB\nDIM n AS UByte\nFUNCTION f() AS UByte\nEND FUNCTION\nPR\nn = \n";
    const snapshot = "SUB greet()\nEND SUB\nDIM n AS UByte\nFUNCTION f() AS UByte\nEND FUNCTION\n";
    const start = items(text, "\nPR", snapshot).items.map((i) => i.label);
    expect(start).toEqual(expect.arrayContaining(["PRINT", "FOR …", "greet", "n"]));
    expect(start).not.toContain("f");
    const expr = items(text, "n = ", snapshot).items.map((i) => i.label);
    expect(expr).toEqual(expect.arrayContaining(["ABS", "NOT", "f", "n"]));
    expect(expr).not.toContain("greet");
    expect(expr).not.toContain("PRINT");
  });

  it("offers a library routine that adds its #include", () => {
    const text = "' My program\nDIM a AS UByte\na = \n";
    const list = items(text, "a = ");
    const attr = list.items.find((i) => i.label === "ATTR")!;
    expect(attr.additionalTextEdits).toEqual([{ line: 2, column: 1, text: "#include <attr.bas>\n" }]);
    const included = "#include <attr.bas>\nDIM a AS UByte\na = \n";
    const list2 = items(included, "a = ", "#include <attr.bas>\nDIM a AS UByte\n");
    expect(list2.items.filter((i) => i.label.toUpperCase() === "ATTR")).toHaveLength(1);
    expect(list2.items.find((i) => i.label.toUpperCase() === "ATTR")!.additionalTextEdits).toBeUndefined();
    expect(includeInsertPosition(["#include <a.bas>", "#include <b.bas>", "PRINT"])).toEqual({ line: 3, column: 1 });
  });

  it("offers header options and their values, directives, pragmas and library files", () => {
    expect(items("'@tar\n", "'@tar").items.map((i) => i.label)).toContain("target");
    expect(items("'@target \n", "'@target ").items.map((i) => i.label)).toEqual(["next", "zx48k", "zx128k", "zxplus3"]);
    expect(items("#in\n", "#in").items.map((i) => i.label)).toContain("include");
    expect(items("#pragma \n", "#pragma ").items.map((i) => i.label)).toContain("case_insensitive");
    expect(items("#include <\n", "#include <").items.map((i) => i.label)).toContain("attr.bas");
    expect(computeBasicIncludeFileItems("/p/main.zxbas", ["/p/main.zxbas", "/p/lib/x.zxbas", "/p/a.asm"]).map((i) => i.label)).toEqual(["lib/x.zxbas"]);
  });

  it("nothing in a string or comment", () => {
    expect(items('PRINT "ab\n', '"ab').items).toEqual([]);
  });
});

describe("signature help", () => {
  const sig = (text: string, cursorText: string, snapshot?: string) => {
    const [line, column] = at(text, cursorText, cursorText.length);
    const lines = text.split("\n");
    lines[line - 1] = "";
    const req = request(text, {}, snapshot ?? lines.join("\n"));
    return computeBasicSignatureHelp(req, line, column);
  };

  it("for a user routine, in a nested call", () => {
    const text = "FUNCTION f(BYVAL a AS UByte, BYVAL b AS UByte) AS UByte\n RETURN a\nEND FUNCTION\nPRINT f(1, f(2, \n";
    const snapshot = "FUNCTION f(BYVAL a AS UByte, BYVAL b AS UByte) AS UByte\n RETURN a\nEND FUNCTION\n";
    const help = sig(text, "f(2, ", snapshot)!;
    expect(help.label).toBe("f(BYVAL a AS UByte, BYVAL b AS UByte) AS UByte");
    expect(help.activeParameter).toBe(1);
    expect(help.label.slice(...help.parameters[1])).toBe("BYVAL b AS UByte");
  });

  it("for a paren-less SUB call", () => {
    const snapshot = "SUB s(BYVAL a AS UByte, BYVAL b AS UByte)\nEND SUB\n";
    const help = sig(snapshot + "s 1, ", "s 1, ", snapshot)!;
    expect(help.label).toBe("s(BYVAL a AS UByte, BYVAL b AS UByte)");
    expect(help.activeParameter).toBe(1);
  });

  it("for built-ins, statements and library routines", () => {
    expect(sig("PRINT CHR$(65, ", "CHR$(65, ")!).toMatchObject({ label: "CHR$(expr, …)", activeParameter: 1 });
    expect(sig("BEEP 1, ", "BEEP 1, ")!).toMatchObject({ label: "BEEP expr, expr", activeParameter: 1 });
    expect(sig("x = ATTR(", "ATTR(")!.label).toBe("ATTR(row AS numeric, col AS numeric) AS attribute byte (type not stated)");
  });
});

describe("rename", () => {
  const LIB = "/p/lib.zxbas";
  const files = { [LIB]: "SUB show(BYVAL value$ AS String)\n  PRINT value$\nEND SUB\n" };

  it("renames across files, keeping sigils, and refuses keywords and bad names", () => {
    const text = '#include "lib.zxbas"\nshow("a")\nshow "b"\n';
    const req = request(text, files);
    const result = computeBasicRenameEdits(req, 2, 2, "display");
    expect("edits" in result && result.edits.map((e) => `${e.filePath}:${e.line}:${e.startColumn}-${e.endColumn}`)).toEqual([
      "/p/main.zxbas:2:1-5",
      "/p/main.zxbas:3:1-5",
      "/p/lib.zxbas:1:5-9"
    ]);
    const libReq: BasicRequest = { ...req, path: LIB, lines: files[LIB].split("\n") };
    const param = computeBasicRenameEdits(libReq, 2, 10, "text$");
    expect("edits" in param && param.edits.map((e) => `${e.line}:${e.startColumn}-${e.endColumn}:${e.newText}`)).toEqual(["1:16-21:text", "2:9-14:text"]);
    expect(computeBasicRenameEdits(req, 2, 2, "PRINT")).toEqual({ error: "'PRINT' is a keyword" });
    expect(computeBasicRenameEdits(req, 2, 2, "9x")).toEqual({ error: "'9x' is not a valid name" });
  });

  it("refuses a collision in a routine scope, and a library name", () => {
    const text = "DIM g AS UByte\nSUB s()\n  DIM loc AS UByte\n  g = loc\nEND SUB\n";
    const req = request(text);
    expect(computeBasicRenameEdits(req, 1, 5, "loc")).toMatchObject({ error: expect.stringMatching(/already local variable loc/) });
    expect(computeBasicRenameEdits(req, 1, 5, "attr")).toEqual({ error: "'attr' is a standard library routine" });
    expect(computeBasicRenameEdits(req, 1, 5, "other")).toMatchObject({ edits: [{ line: 1 }, { line: 4 }] });
  });

  it("refuses library symbols, line numbers and macro uses", () => {
    const text = "#include <attr.bas>\nPRINT ATTR(1, 2)\n10 GOTO 10\n#define RESET n = 0\nDIM n AS UByte\nRESET\n";
    const req = request(text);
    expect(computeBasicRenameValidation(req, 2, 8)).toEqual({ rejectReason: "'ATTR' is in the standard library, which is read-only" });
    expect(computeBasicRenameValidation(req, 3, 1)).toEqual({ rejectReason: "Line numbers cannot be renamed" });
    expect(computeBasicRenameValidation(req, 5, 5)).toEqual({ rejectReason: "'n' is used through a macro at main.zxbas line 6; rename it by hand" });
  });

  it("refuses while the snapshot is older than the text", () => {
    const snapshot = "DIM g AS UByte\ng = 1\n";
    const req = request("' new\n" + snapshot, {}, snapshot);
    expect(computeBasicRenameEdits(req, 3, 1, "h")).toEqual({ error: "The file changed since its last check; try again in a moment" });
  });

  it("compares names in any case in a case-insensitive program", () => {
    const text = "DIM Count AS UByte\nDIM other AS UByte\ncount = 1\n";
    const req = request(text, {}, text, { caseInsensitive: true });
    expect(computeBasicRenameEdits(req, 3, 2, "OTHER")).toMatchObject({ error: expect.stringMatching(/already/) });
    expect(computeBasicRenameEdits(req, 3, 2, "total")).toMatchObject({ edits: [{ line: 1, startColumn: 5 }, { line: 3, startColumn: 1 }] });
  });
});

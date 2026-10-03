import { describe, expect, it } from "vitest";
import { intelOf, occurrencesOf, symbolsNamed, where } from "./intel-kit";

const src = (text: string) => text.replace(/^\n/, "");

describe("extractBasicIntel", () => {
  it("tells a local from a global of the same name", () => {
    const intel = intelOf(
      src(`
DIM x AS UByte
SUB s()
  DIM x AS Integer
  x = 2
END SUB
x = 1
s()
`)
    );
    const [global, local] = symbolsNamed(intel, "x");
    expect(global).toMatchObject({ scopeId: 0, storage: "global", typeText: "UByte" });
    expect(local).toMatchObject({ storage: "local", typeText: "Integer" });
    expect(local.scopeId).toBeGreaterThan(0);
    expect(where(occurrencesOf(intel, global))).toEqual(["1:4-5", "6:0-1"]);
    expect(where(occurrencesOf(intel, local))).toEqual(["3:6-7", "4:2-3"]);
    const scope = intel.scopes[local.scopeId];
    expect(scope).toMatchObject({ startLine: 2, endLine: 5 });
    expect(intel.symbols[scope.routineId!].name).toBe("s");
  });

  it("gives a parameter one id, used in the body and as a named argument", () => {
    const intel = intelOf(
      src(`
SUB s(BYVAL a AS UByte, BYVAL b AS Integer = 0)
  PRINT a + b
END SUB
DIM v AS Integer
s(1, v)
s(b := v, a := 2)
`)
    );
    const [a] = symbolsNamed(intel, "a");
    const [b] = symbolsNamed(intel, "b");
    expect(a).toMatchObject({ kind: "param", typeText: "UByte" });
    expect(b).toMatchObject({ kind: "param", detail: "BYVAL b AS Integer = 0" });
    expect(where(occurrencesOf(intel, a))).toEqual(["1:12-13", "2:8-9", "6:10-11"]);
    expect(where(occurrencesOf(intel, b))).toEqual(["1:30-31", "2:12-13", "6:2-3"]);
    const [s] = symbolsNamed(intel, "s");
    expect(s.detail).toBe("SUB s(BYVAL a AS UByte, BYVAL b AS Integer = 0)");
    expect(s.params!.map((p) => p.name)).toEqual(["a", "b"]);
  });

  it("records an implicit variable and the NEXT variable", () => {
    const intel = intelOf(
      src(`
FOR i = 1 TO 3
  n = n + i
NEXT i
`)
    );
    const [i] = symbolsNamed(intel, "i");
    const [n] = symbolsNamed(intel, "n");
    expect(i.implicit).toBe(true);
    expect(where(occurrencesOf(intel, i))).toEqual(["1:4-5", "2:10-11", "3:5-6"]);
    expect(n).toMatchObject({ implicit: true, detail: "n AS Float (implicit)" });
  });

  it("knows a DECLARE and the definition", () => {
    const intel = intelOf(
      src(`
DECLARE FUNCTION f(a AS UByte) AS UByte
PRINT f(1)
' Doubles it.
FUNCTION f(a AS UByte) AS UByte
  RETURN a * 2
END FUNCTION
`)
    );
    const [f] = symbolsNamed(intel, "f");
    expect(f).toMatchObject({ kind: "function", returnType: "UByte", doc: "Doubles it." });
    expect(f.declaration).toMatchObject({ line: 4, startColumn: 9 });
    expect(f.forwardDeclaration).toMatchObject({ line: 1, startColumn: 17 });
    expect(where(occurrencesOf(intel, f))).toEqual(["1:17-18", "2:6-7", "4:9-10"]);
  });

  it("knows labels and line numbers", () => {
    const intel = intelOf(
      src(`
10 GOTO start
start:
  GOSUB 10
`)
    );
    const [start] = symbolsNamed(intel, "start");
    const [ten] = symbolsNamed(intel, "10");
    expect(start.kind).toBe("label");
    expect(ten.kind).toBe("lineNumber");
    expect(where(occurrencesOf(intel, start))).toEqual(["1:8-13", "2:0-5"]);
    expect(where(occurrencesOf(intel, ten))).toEqual(["1:0-2", "3:8-10"]);
    expect(intel.outline.map((o) => o.name)).toEqual(["start"]);
  });

  it("marks a use a macro produced as not editable", () => {
    const intel = intelOf(
      src(`
#define BUMP(v) v = v + 1
DIM counter AS UByte
BUMP(counter)
counter = 0
`)
    );
    const [counter] = symbolsNamed(intel, "counter");
    // --- The macro's argument is reported at the macro call: not the name, so not editable
    expect(where(occurrencesOf(intel, counter))).toEqual(["2:4-11", "3:0-13!", "4:0-7"]);
    const intel2 = intelOf(
      src(`
#define RESET counter = 0
DIM counter AS UByte
RESET
`)
    );
    const [c2] = symbolsNamed(intel2, "counter");
    expect(where(occurrencesOf(intel2, c2))).toEqual(["2:4-11", "3:0-5!"]);
    expect(intel2.defines).toEqual([
      { name: "RESET", declaration: { fileIndex: 0, line: 1, startColumn: 8, endColumn: 13 }, uses: [{ fileIndex: 0, line: 3, startColumn: 0, endColumn: 5 }], body: "counter = 0" }
    ]);
  });

  it("keeps a used library routine, drops unused ones and library internals", () => {
    const intel = intelOf(
      src(`
#include <string.bas>
#include <attr.bas>
PRINT ATTR(1, 2)
`)
    );
    const [attr] = symbolsNamed(intel, "ATTR");
    expect(attr).toBeDefined();
    expect(intel.files[attr.declaration.fileIndex]).toMatchObject({ path: "<kbasic-stdlib>/attr.bas", library: true, virtual: true });
    expect(attr.doc).toMatch(/attribute byte/);
    expect(symbolsNamed(intel, "LEFT")).toEqual([]);
    expect(intel.symbols.some((s) => s.name.startsWith("__"))).toBe(false);
    // --- The library tab's outline lists its routines
    const stringFile = intel.files.find((f) => f.path.endsWith("string.bas"))!;
    expect(intel.outline.some((o) => o.fileIndex === stringFile.index && o.name.toUpperCase() === "LEFT")).toBe(true);
  });

  it("follows case-insensitive", () => {
    const sensitive = intelOf(src(`DIM Count AS UByte\nCount = 1\n`));
    expect(where(occurrencesOf(sensitive, symbolsNamed(sensitive, "Count")[0]))).toEqual(["1:4-9", "2:0-5"]);
    const insensitive = intelOf(src(`DIM Count AS UByte\ncount = 1\n`), {}, { caseInsensitive: true });
    expect(insensitive.caseInsensitive).toBe(true);
    expect(where(occurrencesOf(insensitive, symbolsNamed(insensitive, "Count")[0]))).toEqual(["1:4-9", "2:0-5"]);
  });

  it("uses physical lines under #line", () => {
    const intel = intelOf(src(`#line 100\nDIM v AS UByte\nv = 1\n`));
    expect(where(occurrencesOf(intel, symbolsNamed(intel, "v")[0]))).toEqual(["2:4-5", "3:0-1"]);
  });

  it("follows #include files", () => {
    const intel = intelOf(src(`#include "lib.zxbas"\nPRINT twice(2)\n`), {
      "/p/lib.zxbas": "FUNCTION twice(a AS UByte) AS UByte\n  RETURN a * 2\nEND FUNCTION\n"
    });
    const [twice] = symbolsNamed(intel, "twice");
    expect(intel.files[twice.declaration.fileIndex].path).toBe("/p/lib.zxbas");
    expect(intel.outline.filter((o) => o.name === "twice")).toHaveLength(1);
  });

  it("describes constants, arrays, the outline and header options", () => {
    const intel = intelOf(
      src(`
'@heap-size 2048
CONST max AS UByte = 10
DIM grid(1 TO 3, 0 TO 4) AS UByte
CODEBANK 1
SUB far()
END SUB
END CODEBANK
`)
    );
    expect(symbolsNamed(intel, "max")[0]).toMatchObject({ constValue: "10", detail: "CONST max AS UByte = 10" });
    expect(symbolsNamed(intel, "grid")[0]).toMatchObject({ arrayBounds: "(1 TO 3, 0 TO 4)", detail: "DIM grid(1 TO 3, 0 TO 4) AS UByte" });
    expect(intel.outline.map((o) => `${o.kind}:${o.name}:${(o.children ?? []).map((c) => c.name).join(",")}`)).toEqual([
      "const:max:",
      "array:grid:",
      "codebank:CODEBANK 1:far"
    ]);
    expect(intel.headerOptions).toEqual([{ name: "heap-size", location: { fileIndex: 0, line: 1, startColumn: 1, endColumn: 11 }, value: "2048" }]);
  });
});

import { describe, expect, it } from "vitest";
import { SEMANTIC_ERRORS, SEMANTIC_WARNINGS } from "@main/kbasic/semantics/codes";
import type { KBasicOptions } from "@main/kbasic/options/options";
import { bindText } from "./bind-kit";

/**
 * Plan §14, Phase 2's exit criterion: every spec'd warning and error class has a test. Each case is
 * a small program that must raise its code, and `text` is the source the diagnostic must point at.
 * The coverage test at the end fails when a code in `codes.ts` has no case here.
 */
type Case = { source: string; text?: string; options?: Partial<KBasicOptions> };

const ERRORS: Record<keyof typeof SEMANTIC_ERRORS, Case[]> = {
  E401: [
    { source: "PRINT b(1)\n", text: "b" },
    { source: "GOTO nowhere\n", text: "nowhere" },
    { source: "GOSUB 100\n", text: "100" },
    { source: "undefinedSub 1\n", text: "undefinedSub" }
  ],
  E402: [
    { source: "DIM a(3) AS UByte\nPRINT a + 1\n", text: "a" },
    { source: "start: PRINT start\n", text: "start" },
    { source: "CONST k = 1\nPRINT @k\n", text: "k" },
    { source: "DIM x AS UByte\nFOR y = 1 TO 2: NEXT\nFUNCTION f() AS UByte\n RETURN 1\nEND FUNCTION\nFOR f = 1 TO 2: NEXT\n", text: "f" }
  ],
  E403: [
    { source: "DIM a AS UByte\nDIM a AS UByte\n", text: "a" },
    { source: "10 PRINT 1\n10 PRINT 2\n", text: "10" },
    { source: "x: PRINT 1\nx: PRINT 2\n", text: "x" },
    { source: "CONST k = 1\nCONST k = 2\n", text: "k" },
    { source: "SUB s()\nEND SUB\nSUB s()\nEND SUB\n", text: "s" },
    { source: "SUB s(a AS UByte)\n DIM a AS UByte\nEND SUB\n", text: "a" }
  ],
  E404: [{ source: "PRINT n\nDIM n AS UByte\n", text: "n" }],
  E405: [
    { source: "DIM x AS UByte = 3\nDIM a(x) AS UByte\n", text: "x" },
    { source: "DIM a(5 TO 2) AS UByte\n", text: "5 TO 2" },
    { source: "DIM a(-1 TO 3) AS UByte\n", text: "-1 TO 3" }
  ],
  E406: [
    { source: "DIM v AS UInteger = 5\nDIM p AS UByte AT v\n", text: "v" },
    { source: "DIM v AS UByte = 5\nDIM a(1) AS UByte => {v, 2}\n", text: "v" },
    { source: "DIM v AS UByte = 5\nSUB s(a AS UByte = v)\nEND SUB\n", text: "v" }
  ],
  E407: [
    { source: "DIM a(2) AS UByte => {1, 2}\n", text: "{1, 2}" },
    { source: "DIM a(1, 1) AS UByte => {1, 2}\n", text: "1" }
  ],
  E408: [{ source: 'DIM a$(1) => {"x", "y"}\n', text: '{"x", "y"}' }],
  E409: [
    { source: 'x$ = 1\n', text: "1" },
    { source: 'DIM n AS UByte\nn = "a"\n', text: '"a"' },
    { source: 'PRINT "a" + 1\n', text: '"a" + 1' },
    { source: 'IF "a" THEN PRINT 1\n', text: '"a"' }
  ],
  E410: [
    { source: 'PRINT "a" * "b"\n', text: '"a" * "b"' },
    { source: 'PRINT "a" - "b"\n', text: '"a" - "b"' },
    { source: 'PRINT -"a"\n', text: '-"a"' }
  ],
  E411: [{ source: "FOR i = 1 TO 3\nNEXT j\n", text: "j" }],
  E412: [
    { source: "EXIT FOR\n", text: "EXIT FOR" },
    { source: "WHILE 1 = 1\n CONTINUE DO\nWEND\n", text: "CONTINUE DO" }
  ],
  E413: [
    { source: "10 PRINT 1\nSUB s()\n GOSUB 10\nEND SUB\n", text: "GOSUB 10" },
    { source: "SUB s()\n DATA 1\nEND SUB\n", text: "DATA 1" }
  ],
  E414: [
    { source: "RETURN 5\n", text: "5" },
    { source: "SUB s()\n RETURN 1\nEND SUB\n", text: "1" },
    { source: "FUNCTION f() AS UByte\n RETURN\nEND FUNCTION\n", text: "RETURN" },
    { source: 'FUNCTION f() AS UByte\n RETURN "x"\nEND FUNCTION\n', text: '"x"' }
  ],
  E415: [
    { source: "DECLARE FUNCTION f(a AS UByte) AS UByte\nFUNCTION f(a AS Integer) AS UByte\n RETURN 1\nEND FUNCTION\n", text: "a" },
    { source: "DECLARE SUB s(a AS UByte)\nSUB s(a AS UByte, b AS UByte)\nEND SUB\n", text: "s" },
    { source: "SUB s()\nEND SUB\nDECLARE SUB s()\n", text: "s" }
  ],
  E416: [{ source: "DECLARE SUB s()\ns\n", text: "SUB s()" }],
  E417: [
    { source: "SUB s(a AS UByte)\nEND SUB\ns 1, 2\n", text: "2" },
    { source: "SUB s(a AS UByte)\nEND SUB\ns\n", text: "s" },
    { source: "SUB s(a AS UByte)\nEND SUB\ns(b := 1)\n", text: "b" },
    { source: "SUB s(a AS UByte, b AS UByte)\nEND SUB\ns(a := 1, 2)\n", text: "2" },
    { source: "SUB s(a AS UByte)\nEND SUB\ns(a := 1, a := 2)\n", text: "a" }
  ],
  E418: [
    { source: "SUB s(BYREF a AS UByte)\nEND SUB\ns(1 + 2)\n", text: "1 + 2" },
    { source: "SUB s(BYREF a AS UByte)\nEND SUB\nDIM i AS Integer\ns(i)\n", text: "i" },
    { source: "SUB s(a() AS UByte)\nEND SUB\ns(3)\n", text: "3" }
  ],
  E419: [
    { source: "SUB s(BYVAL a() AS UByte)\nEND SUB\n", text: "BYVAL a() AS UByte" }
  ],
  E420: [{ source: "SUB s(a AS UByte = 1, b AS UByte)\nEND SUB\n", text: "b AS UByte" }],
  E421: [{ source: "DIM a(3) AS UByte\nREAD a\nDATA 1\n", text: "a" }],
  E422: [
    { source: "DIM n AS UByte\nPRINT n$\n", text: "n$" },
    { source: "DIM n$ AS UByte\n", text: "n$" }
  ],
  E423: [
    { source: "CONST k = 1\nk = 2\n", text: "k" },
    { source: "SUB s()\nEND SUB\ns = 1\n", text: "s" },
    { source: "DIM a(3) AS UByte\nDIM x AS UByte\nx = a\n", text: "a" }
  ],
  E424: [{ source: "DIM a(3) AS UByte\nDIM b(3) AS Integer\na = b\n", text: "a = b" }],
  E425: [
    { source: "DIM x AS UByte\nCONST k = x + 1\n", text: "x + 1" },
    { source: "PRINT 1e38 * 1e38\n", text: "1e38 * 1e38" },
    { source: "PRINT 1.5 / 0\n", text: "1.5 / 0" }
  ],
  E426: [
    { source: "DIM n\n", text: "n", options: { requireTypes: true } },
    { source: "FUNCTION f()\n RETURN 1\nEND FUNCTION\n", text: "f", options: { requireTypes: true } }
  ],
  E427: [{ source: "PRINT q\n", text: "q", options: { requireDeclarations: true } }],
  E428: [
    { source: "DIM a(3, 3) AS UByte\nPRINT a(1)\n", text: "a(1)" },
    { source: "DIM a(3) AS UByte\nPRINT a(1 TO 2)\n", text: "1 TO 2" }
  ],
  E429: [
    { source: "SUB s()\nEND SUB\nPRINT s\n", text: "s" },
    { source: "DIM n AS UByte\nPRINT n(1)\n", text: "n" },
    { source: "DIM n AS UByte\nn\n", text: "n" }
  ],
  E430: [{ source: "SUB s()\ninside: PRINT 1\nEND SUB\nGOTO inside\n", text: "inside" }],
  E431: [
    { source: "SUB FASTCALL s(a AS UByte)\n DIM t AS UByte\nEND SUB\ns 1\n", text: "t" },
    { source: "SUB FASTCALL s(a AS UByte)\n x = a\nEND SUB\ns 1\n", text: "x" }
  ],
  E450: [
    { source: "DIM b AS UByte = 1\nCODEBANK b\nSUB s()\nEND SUB\nEND CODEBANK\n", text: "b" },
    { source: "CODEBANK 300\nSUB s()\nEND SUB\nEND CODEBANK\n", text: "300" }
  ],
  E451: [{ source: "CODEBANK 1\nfar: \nSUB s()\nEND SUB\nEND CODEBANK\nGOTO far\n", text: "far" }],
  E452: [{ source: "CODEBANK 1\nDIM t(3) AS UByte\nSUB s()\nEND SUB\nEND CODEBANK\nPRINT t(0)\n", text: "t" }],
  E453: [], // needs the preprocessor's #init list: tested below
  E454: [{ source: "CODEBANK 1\nSUB s()\n ASM\n  codebank 2\n  nop\n END ASM\nEND SUB\nEND CODEBANK\n" }]
};

const WARNINGS: Record<keyof typeof SEMANTIC_WARNINGS, Case[]> = {
  W100: [
    { source: "PRINT q\n", text: "q" },
    { source: "DIM n\n", text: "n" },
    { source: "SUB s(a)\nEND SUB\ns 1\n", text: "a" },
    { source: "FUNCTION f()\n RETURN 1\nEND FUNCTION\nPRINT f\n", text: "f" }
  ],
  W101: [{ source: "PRINT s$\n", text: "s$" }],
  W110: [
    { source: "IF 1 THEN PRINT 1\n", text: "1" },
    { source: "WHILE 0\n PRINT 1\nWEND\n", text: "0" },
    { source: "CONST forever = 1\nDO\n PRINT 1\nLOOP UNTIL forever\n", text: "forever" }
  ],
  W120: [
    { source: "DIM b AS UByte = 300\n", text: "300" },
    { source: "DIM b AS Integer\nb = 2.5\n", text: "2.5" }
  ],
  W130: [
    { source: "DIM n AS UByte\nWHILE n < 3\nWEND\n" },
    { source: "FOR i = 1 TO 3\nNEXT i\n" },
    { source: "DO\nLOOP\n" }
  ],
  W140: [{ source: "DIM n AS UByte\nIF n THEN\nEND IF\n" }],
  W150: [
    { source: "DIM unused AS UByte\n", text: "unused", options: { optimize: 1 } },
    { source: "SUB s(p AS UByte)\nEND SUB\ns 1\n", text: "p", options: { optimize: 1 } }
  ],
  W160: [{ source: "SUB FASTCALL s(a AS UByte, b AS UByte)\nEND SUB\ns 1, 2\n", text: "s" }],
  W170: [{ source: "SUB never()\nEND SUB\n", text: "never", options: { optimize: 1 } }],
  W180: [
    { source: "END\nPRINT 1\n", text: "PRINT 1" },
    { source: "SUB s()\n RETURN\n PRINT 1\nEND SUB\ns\n", text: "PRINT 1" }
  ],
  W190: [{ source: "FUNCTION f(a AS UByte) AS UByte\n IF a THEN RETURN 1\nEND FUNCTION\nPRINT f(1)\n", text: "f" }],
  W200: [{ source: "DIM f AS Float\nDIM b AS UByte\nb = f\n", text: "f" }],
  W900: [{ source: "CODEBANK 1\nSUB s(BYREF a AS UByte)\nEND SUB\nEND CODEBANK\nDIM v AS UByte\ns(v)\n", text: "v" }],
  W910: [{ source: "CODEBANK 1\nDIM t(3) AS UByte\nEND CODEBANK\n" }],
  W920: [{ source: "CODEBANK 1\nDIM t(3) AS UByte\nSUB s()\n PRINT @t\nEND SUB\nEND CODEBANK\ns\n", text: "@t" }],
  K401: [{ source: "FOR i = 1 TO 5 STEP 0\n PRINT i\nNEXT\n", text: "0" }],
  K402: [{ source: "FOR i = 10 TO 1\n PRINT i\nNEXT\n" }],
  K403: [
    { source: "DIM u AS UByte\nPRINT SGN(u)\n", text: "SGN(u)" },
    { source: "DIM u AS UInteger\nPRINT ABS(u)\n", text: "ABS(u)" }
  ],
  K404: [{ source: "DIM a(3) AS UByte\nDIM b(1, 1) AS UByte\na = b\n", text: "a = b" }],
  K405: [{ source: "DECLARE SUB s(a AS UByte)\nSUB s(b AS UByte)\nEND SUB\ns 1\n", text: "b" }],
  K406: [{ source: "PRINT 5 / 0\n", text: "5 / 0" }],
  K407: [{ source: 'PRINT VAL("abc")\n', text: 'VAL("abc")' }]
};

function expectCode(code: string, c: Case) {
  const result = bindText(c.source, c.options);
  const found = result.semantic.filter((d) => d.code === code);
  expect(found.length, `${code} not reported; got ${JSON.stringify(result.semantic)}`).toBeGreaterThan(0);
  if (c.text !== undefined) expect(found.map((d) => d.text)).toContain(c.text);
}

describe("semantic errors", () => {
  for (const [code, cases] of Object.entries(ERRORS)) {
    cases.forEach((c, i) => {
      it(`${code} #${i + 1}: ${SEMANTIC_ERRORS[code as keyof typeof SEMANTIC_ERRORS]}`, () => {
        expectCode(code, c);
        expect(bindText(c.source, c.options).diagnostics.items.find((d) => d.code === code)?.severity).toBe("error");
      });
    });
  }
});

describe("semantic warnings", () => {
  for (const [code, cases] of Object.entries(WARNINGS)) {
    cases.forEach((c, i) => {
      it(`${code} #${i + 1}: ${SEMANTIC_WARNINGS[code as keyof typeof SEMANTIC_WARNINGS]}`, () => {
        expectCode(code, c);
        expect(bindText(c.source, c.options).diagnostics.items.find((d) => d.code === code)?.severity).toBe("warning");
      });
    });
  }

  it("does not report W150 or W170 without optimisation", () => {
    const codes = bindText("DIM unused AS UByte\nSUB never()\nEND SUB\n", { optimize: 0 }).semantic.map((d) => d.code);
    expect(codes).not.toContain("W150");
    expect(codes).not.toContain("W170");
  });
});

describe("coverage", () => {
  it("has a case for every error and warning code", () => {
    for (const code of Object.keys(SEMANTIC_ERRORS)) {
      if (code === "E453") continue;
      expect((ERRORS as Record<string, Case[]>)[code]?.length ?? 0, `no case for ${code}`).toBeGreaterThan(0);
    }
    for (const code of Object.keys(SEMANTIC_WARNINGS)) {
      expect((WARNINGS as Record<string, Case[]>)[code]?.length ?? 0, `no case for ${code}`).toBeGreaterThan(0);
    }
  });
});

describe("clean programs", () => {
  it.each([
    ["assignments and PRINT", 'a = 1\nb$ = "x"\nPRINT a; b$\n'],
    ["a typed program", "DIM n AS UByte = 3\nDIM total AS UInteger\nFOR i = 1 TO n\n total = total + i\nNEXT i\nPRINT total\n"],
    [
      "routines with defaults and named arguments",
      "FUNCTION add(a AS UByte, b AS UByte = 2) AS UInteger\n RETURN a + b\nEND FUNCTION\nDIM r AS UInteger\nr = add(1)\nr = add(b := 3, a := 4)\nPRINT r\n"
    ],
    ["labels, GOSUB and DATA", '10 PRINT 1\nGOSUB sub1\nRESTORE 10\nREAD q\nPRINT q\nEND\nsub1: PRINT 2\nRETURN\nDATA 1, 2\n'],
    ["arrays and initialisers", "DIM m(1, 2) AS UByte => {{1, 2, 3}, {4, 5, 6}}\nDIM s$(3)\ns$(1) = \"ab\"\nPRINT m(1, 2), s$(1)(0)\n"],
    ["a CODEBANK", "CODEBANK 1\nSUB far()\n PRINT 1\nEND SUB\nEND CODEBANK\nfar\n"]
  ])("%s", (_, source) => {
    expect(bindText(source).semantic).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { runBasic, type Run } from "./run-kit";

/**
 * Strings on the 48K, and the heap check of `.docs/kbasic-string-ownership.md` §6: when a program
 * ends, the heap holds exactly the blocks of its global Strings, nothing else.
 */
function heapUsed(r: Run): number {
  const s = r.session;
  let free = 0;
  for (let p = s.peekWord(r.program.symbol("core.FreeList")); p !== 0; p = s.peekWord(p + 2)) free += s.peekWord(p);
  return r.program.symbol("core.HeapSize") - free;
}

/** Bytes the heap gives the global String variables' current values (block size is at payload - 2). */
function globalStringBytes(r: Run, names: string[]): number {
  let total = 0;
  for (const name of names) {
    const p = r.word(name);
    if (p) total += r.session.peekWord(p - 2);
  }
  return total;
}

async function runChecked(source: string, globals: string[], rows = 4): Promise<string[]> {
  const r = await runBasic(source);
  expect(heapUsed(r), "the heap holds only the global Strings' values").toBe(globalStringBytes(r, globals));
  return r.screen(rows);
}

describe("String values", () => {
  it("concatenates, measures and slices", async () => {
    const source = 'a$ = "Hello"\nb$ = a$ + ", " + "World"\nPRINT b$\nPRINT LEN(b$); " "; CODE(b$)\nPRINT b$(0 TO 4); "|"; b$(7); "|"; b$(7 TO); "|"; b$( TO 1)\n';
    expect(await runChecked(source, ["a", "b"])).toEqual(["Hello, World", "12 72", "Hello|W|World|He"]);
  });

  it("compares like the runtime: character codes, a prefix first", async () => {
    const source = 'a$ = "abc"\nPRINT a$ = "abc"; a$ < "abd"; a$ > "ab"; a$ <> "abc"; "" < a$\n';
    expect((await runChecked(source, ["a"]))[0]).toBe("11101");
  });

  it("builds strings with CHR$", async () => {
    expect((await runChecked('PRINT CHR$(72, 105); CHR$(33)\n', []))[0]).toBe("Hi!");
  });

  it("counts string indices from string_base", async () => {
    expect((await runChecked("#pragma string_base = 1\na$ = \"Klive\"\nPRINT a$(1 TO 2); a$(5)\n", ["a"]))[0]).toBe("Kle");
  });

  it("assigns a variable to itself and to a slice of itself safely", async () => {
    const source = 'a$ = "abcdef"\na$ = a$\na$ = a$(2 TO 4)\na$ = a$ + a$\nPRINT a$\n';
    expect((await runChecked(source, ["a"]))[0]).toBe("cdecde");
  });
});

describe("String ownership", () => {
  it("frees every temporary: concatenations, slices, comparisons, LEN, PRINT", async () => {
    const source = [
      'a$ = "x"',
      "DIM n AS UInteger",
      "FOR i = 1 TO 40",
      ' b$ = a$ + "yz"',
      ' n = n + LEN(a$ + b$)',
      ' IF b$ + "!" = "xyz!" THEN n = n + 1',
      ' PRINT AT 0, 0; b$(1 TO) + "-"',
      "NEXT i",
      "PRINT AT 1, 0; n",
      ""
    ].join("\n");
    expect(await runChecked(source, ["a", "b"])).toEqual(["yz-", "200"]);
  });

  it("passes copies by value, frees locals and by-value parameters, and frees discarded results", async () => {
    const source = [
      'FUNCTION greet(n$ AS String) AS String',
      ' DIM t$ AS String',
      ' t$ = "Hi " + n$',
      ' RETURN t$',
      'END FUNCTION',
      'name$ = "Ann"',
      'FOR i = 1 TO 20',
      ' x$ = greet(name$)',
      ' greet("Bob")',
      'NEXT i',
      'PRINT x$; " "; name$',
      ''
    ].join("\n");
    expect((await runChecked(source, ["name", "x"]))[0]).toBe("Hi Ann Ann");
  });

  it("keeps local Strings apart across recursion", async () => {
    const source = [
      "FUNCTION stars(n AS UByte) AS String",
      ' DIM s$ AS String',
      ' IF n = 0 THEN RETURN ""',
      ' s$ = "*" + stars(n - 1)',
      " RETURN s$",
      "END FUNCTION",
      "PRINT stars(5)",
      ""
    ].join("\n");
    expect((await runChecked(source, []))[0]).toBe("*****");
  });

  it("copies a borrowed global a FUNCTION changes in the same statement (rule B1)", async () => {
    const source = [
      'a$ = "old"',
      "FUNCTION change() AS String",
      ' a$ = "NEW"',
      ' RETURN "!"',
      "END FUNCTION",
      "b$ = a$ + change()",
      "PRINT b$; \" \"; a$",
      ""
    ].join("\n");
    expect((await runChecked(source, ["a", "b"]))[0]).toBe("old! NEW");
  });

  it("changes a caller's String through BYREF", async () => {
    const source = 'SUB shout(BYREF s$ AS String)\n s$ = s$ + "!"\nEND SUB\nw$ = "hey"\nshout w$\nshout w$\nPRINT w$\n';
    expect((await runChecked(source, ["w"]))[0]).toBe("hey!!");
  });
});

describe("substring assignment", () => {
  it("overwrites in place: a short value is padded with spaces, a long one cut, the length kept", async () => {
    const source = [
      'a$ = "abcdefgh"',
      'a$(1 TO 3) = "XY"',
      "PRINT a$; \"|\";",
      'a$(5 TO) = "123456789"',
      "PRINT a$; \"|\";",
      'a$(0) = "Q"',
      'a$( TO 1) = a$(6 TO 7)',
      "PRINT a$; \"|\"; LEN(a$)",
      ""
    ].join("\n");
    expect((await runChecked(source, ["a"]))[0]).toBe("aXY efgh|aXY e123|23Y e123|8");
  });

  it("works on a String array element, and on an empty String", async () => {
    const source = 'DIM w$(1)\nw$(1) = "hello"\nw$(1)(0 TO 0) = "J"\nw$(0)(0 TO 3) = "xyz"\nPRINT w$(1); "|"; w$(0); "|"\n';
    const r = await runBasic(source);
    expect(r.screen(1)[0]).toBe("Jello||");
  });
});

describe("whole-array copy", () => {
  it("copies numbers and duplicates Strings", async () => {
    const source = [
      "DIM a(2) AS UInteger => {1, 2, 3}",
      "DIM b(2) AS UInteger",
      "DIM s$(1)",
      "DIM t$(1)",
      "b = a",
      "a(0) = 99",
      's$(0) = "x": s$(1) = "y"',
      "t$ = s$",
      's$(0) = "changed"',
      "PRINT b(0); b(1); b(2); \" \"; t$(0); t$(1); \" \"; s$(0)",
      ""
    ].join("\n");
    const r = await runBasic(source);
    expect(r.screen(1)[0]).toBe("123 xy changed");
  });
});

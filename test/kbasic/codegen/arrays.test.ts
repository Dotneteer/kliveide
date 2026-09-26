import { describe, expect, it } from "vitest";

import { compileBasic, runBasic, type Run } from "./run-kit";

/** Arrays on the 48K: the runtime-abi.md §2.3 layout, element access, parameters and local arrays. */
const firstLines = async (source: string, rows = 1) => (await runBasic(source)).screen(rows);

function heapUsed(r: Run): number {
  const s = r.session;
  let free = 0;
  for (let p = s.peekWord(r.program.symbol("core.FreeList")); p !== 0; p = s.peekWord(p + 2)) free += s.peekWord(p);
  return r.program.symbol("core.HeapSize") - free;
}

describe("global arrays", () => {
  it("lays out the descriptor, the data straight after it, and the tables", async () => {
    const r = await runBasic("DIM a(2, 3) AS UInteger\nDIM b(1 TO 4) AS UByte => {10, 20, 30, 40}\n");
    const s = r.session;
    const a = r.program.symbol("_a");
    expect(s.peekWord(a + 2), "the data follows the descriptor").toBe(a + 8);
    expect(s.peekWord(a + 4), "no lower-bound table for a zero base").toBe(0);
    const dims = s.peekWord(a);
    expect([s.peekWord(dims), s.peekWord(dims + 2), s.peek(dims + 4)]).toEqual([1, 4, 2]);
    const b = r.program.symbol("_b");
    const lower = s.peekWord(b + 4);
    expect(s.peekWord(lower)).toBe(1);
    expect([0, 1, 2, 3].map((i) => s.peek(b + 8 + i))).toEqual([10, 20, 30, 40]);
  });

  it("reads and writes elements with constant and computed subscripts", async () => {
    const source = [
      "DIM a(3, 4) AS Integer",
      "DIM i, j AS UByte",
      "FOR i = 0 TO 3",
      " FOR j = 0 TO 4",
      "  a(i, j) = i * 10 - j",
      " NEXT j",
      "NEXT i",
      "PRINT a(0, 0); \" \"; a(2, 3); \" \"; a(3, 4); \" \"; a(i - 1, 1)",
      ""
    ].join("\n");
    expect((await firstLines(source))[0]).toBe("0 17 26 29");
  });

  it("honours non-zero lower bounds and array_base", async () => {
    const source = "DIM a(5 TO 7) AS UByte => {1, 2, 3}\nDIM k AS UByte = 6\nPRINT a(5); a(k); a(k + 1)\n";
    expect((await firstLines(source))[0]).toBe("123");
    expect((await firstLines("#pragma array_base = 1\nDIM a(3) AS UByte => {7, 8, 9}\nDIM k AS UByte = 2\nPRINT a(1); a(k); a(3)\n"))[0]).toBe("789");
  });

  it("gives @a the descriptor and @a(i) the element", async () => {
    const r = await runBasic("DIM a(9) AS UInteger\nDIM p, q, k AS UInteger\nk = 3\np = @a\nq = @a(k)\n");
    const a = r.program.symbol("_a");
    expect(r.word("p")).toBe(a);
    expect(r.word("q")).toBe(a + 8 + 6);
    const { generated } = await compileBasic("DIM a(9) AS UInteger\nDIM q AS UInteger\nq = @a(2)\n");
    expect(generated.emitted.text).toContain("_a.data+4");
  });

  it("places an array AT an address", async () => {
    const r = await runBasic("DIM a(3) AS UByte AT 50000\na(2) = 42\nPRINT a(2)\n");
    expect(r.session.peek(50002)).toBe(42);
    expect(r.screen(1)[0]).toBe("42");
  });

  it("keeps String elements with the ownership rules", async () => {
    const source = [
      "DIM s$(3)",
      "DIM i AS UByte",
      "FOR i = 0 TO 3",
      ' s$(i) = CHR$(65 + i) + "x"',
      "NEXT i",
      "s$(1) = s$(1) + s$(2)",
      "PRINT s$(0); s$(1); s$(3)",
      ""
    ].join("\n");
    const r = await runBasic(source);
    expect(r.screen(1)[0]).toBe("AxBxCxDx");
    // --- Only the elements' values are left on the heap
    const data = r.program.symbol("_s.data");
    const held = [0, 1, 2, 3].reduce((n, i) => n + r.session.peekWord(r.session.peekWord(data + 2 * i) - 2), 0);
    expect(heapUsed(r)).toBe(held);
  });
});

describe("array parameters", () => {
  it("passes the descriptor and indexes through it, bounds and all", async () => {
    const source = [
      "FUNCTION total(a() AS UInteger) AS UInteger",
      " DIM i AS UByte",
      " DIM t AS UInteger",
      " FOR i = LBOUND(a, 1) TO UBOUND(a, 1)",
      "  t = t + a(i)",
      " NEXT i",
      " RETURN t",
      "END FUNCTION",
      "SUB fill(BYREF m() AS UByte, v AS UByte)",
      " m(1, 2) = v",
      "END SUB",
      "DIM x(4) AS UInteger => {1, 2, 3, 4, 5}",
      "DIM y(2 TO 3) AS UInteger => {100, 200}",
      "DIM m(2, 3) AS UByte",
      "fill m, 99",
      "PRINT total(x); \" \"; total(y); \" \"; m(1, 2); \" \"; LBOUND(m, 0)",
      ""
    ].join("\n");
    expect((await firstLines(source))[0]).toBe("15 300 99 2");
  });

  it("passes an element BYREF", async () => {
    const source = "SUB inc(BYREF v AS UInteger)\n v = v + 1\nEND SUB\nDIM a(3) AS UInteger\ninc a(2)\ninc a(2)\nPRINT a(2)\n";
    expect((await firstLines(source))[0]).toBe("2");
  });
});

describe("local arrays", () => {
  it("allocates zeroed data on entry, per activation, and frees it on exit", async () => {
    const source = [
      "FUNCTION sum(n AS UByte) AS UInteger",
      " DIM v(4) AS UInteger",
      " DIM i AS UByte",
      " IF n = 0 THEN RETURN 0",
      " FOR i = 0 TO 4",
      "  v(i) = v(i) + n",
      " NEXT i",
      " RETURN v(0) + v(4) + sum(n - 1)",
      "END FUNCTION",
      "PRINT sum(3)",
      ""
    ].join("\n");
    const r = await runBasic(source);
    expect(r.screen(1)[0]).toBe("12");
    expect(heapUsed(r)).toBe(0);
  });

  it("copies an initialiser in when its DIM runs, and frees local String elements", async () => {
    const source = [
      "SUB show()",
      " DIM a(1 TO 3) AS UByte => {4, 5, 6}",
      " DIM s$(2)",
      ' s$(0) = "p"',
      ' s$(2) = s$(0) + "q"',
      " PRINT a(1); a(3); s$(2)",
      " a(1) = 9",
      "END SUB",
      "show",
      "show",
      ""
    ].join("\n");
    const r = await runBasic(source);
    expect(r.screen(2)).toEqual(["46pq", "46pq"]);
    expect(heapUsed(r)).toBe(0);
  });

  it("gives @a of a local array its descriptor in the frame", async () => {
    const source = "SUB s()\n DIM a(2) AS UByte\n DIM p AS UInteger\n p = @a\n PRINT PEEK(UInteger, p + 2) = @a(0)\nEND SUB\ns\n";
    expect((await firstLines(source))[0]).toBe("1");
  });
});

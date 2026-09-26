import { describe, expect, it } from "vitest";

import { runBasic } from "./run-kit";

/** DATA, READ and RESTORE on the 48K (data.kz80.asm and the generated item code). */
const firstLine = async (source: string) => (await runBasic(source)).screen(1)[0];

describe("DATA and READ", () => {
  it("reads numbers into every type, and Strings", async () => {
    const source = [
      "DIM b AS UByte",
      "DIM i AS Integer",
      "DIM l AS Long",
      "DIM f AS Float",
      "DIM s$ AS String",
      "READ b, i, l, f, s$",
      'PRINT b; " "; i; " "; l; " "; f; " "; s$',
      'DATA 200, -300, 100000, 1.5, "hi"',
      ""
    ].join("\n");
    expect(await firstLine(source)).toBe("200 -300 100000 1.5 hi");
  });

  it("evaluates expression items when READ takes them, and wraps round after the last item", async () => {
    const source = [
      "DIM n, x AS UInteger",
      "DIM i AS UByte",
      "n = 10",
      "FOR i = 1 TO 5",
      " READ x",
      ' PRINT x; " ";',
      " n = n + 1",
      "NEXT i",
      "DATA n * 2, 7",
      ""
    ].join("\n");
    // --- n is 10, 11, 12, ... when each item is read: 20, 7, then round again: 24, 7, 28
    expect(await firstLine(source)).toBe("20 7 24 7 28");
  });

  it("RESTOREs to the start or to the DATA after a label", async () => {
    const source = [
      "DIM a, b, c AS UByte",
      "READ a",
      "RESTORE second",
      "READ b",
      "RESTORE",
      "READ c",
      'PRINT a; b; c',
      "DATA 1, 2",
      "second:",
      "DATA 3",
      ""
    ].join("\n");
    expect(await firstLine(source)).toBe("131");
  });

  it("reads into array elements and inside a SUB", async () => {
    const source = [
      "DIM v(2) AS Integer",
      "SUB fill()",
      " DIM k AS UByte",
      " FOR k = 0 TO 2",
      "  READ v(k)",
      " NEXT k",
      "END SUB",
      "fill",
      'PRINT v(0); " "; v(1); " "; v(2)',
      "DATA -1, 2, -3",
      ""
    ].join("\n");
    expect(await firstLine(source)).toBe("-1 2 -3");
  });

  it("stops with C Nonsense in BASIC when a String meets a number", async () => {
    const r = await runBasic('DIM x AS UByte\nREAD x\nDATA "text"\n', { expectEnd: false, frames: 100 });
    expect(r.session.screenLine(23)).toMatch(/^C Nonsense in BASIC/);
  });

  it("stops with E Out of DATA when there is none", async () => {
    const r = await runBasic("DIM x AS UByte\nREAD x\n", { expectEnd: false, frames: 100 });
    expect(r.session.screenLine(23)).toMatch(/^E Out of DATA/);
  });

  it("gives a DATA line a breakpoint that stops when READ takes its first item", async () => {
    const r = await runBasic("DIM x AS UByte\nREAD x\nDATA 5\n");
    const { classic } = r.generated.debug;
    expect(classic.listFileItems.map((i) => i.lineNumber)).toContain(3);
    expect(r.generated.debug.problems).toEqual([]);
  });
});

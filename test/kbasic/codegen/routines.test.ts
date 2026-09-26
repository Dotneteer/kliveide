import { describe, expect, it } from "vitest";
import { compileBasic, runBasic } from "./run-kit";

/** SUB and FUNCTION on the 48K: frames, parameters, locals, results, both conventions. */
const firstLines = async (source: string, rows = 2) => (await runBasic(source)).screen(rows);

describe("SUB and FUNCTION", () => {
  it("passes arguments and fills defaults", async () => {
    const source = "FUNCTION add(a AS UByte, b AS Integer = 10) AS Integer\n RETURN a + b\nEND FUNCTION\nPRINT add(5); \" \"; add(5, 100); \" \"; add(b := 1, a := 2)\n";
    expect((await firstLines(source, 1))[0]).toBe("15 105 3");
  });

  it("keeps locals in the frame, zeroed at entry", async () => {
    const source = "SUB show(n AS UInteger)\n DIM t AS UInteger\n PRINT t; \" \";\n t = n * 2\n PRINT t\nEND SUB\nshow 21\nshow(1000)\n";
    expect(await firstLines(source)).toEqual(["0 42", "0 2000"]);
  });

  it("recurses, each activation with its own frame", async () => {
    const source = "FUNCTION fact(n AS UInteger) AS UInteger\n IF n <= 1 THEN RETURN 1\n RETURN n * fact(n - 1)\nEND FUNCTION\nPRINT fact(7); \" \"; fact(8)\n";
    expect((await firstLines(source, 1))[0]).toBe("5040 40320");
  });

  it("changes the caller's variable through a BYREF parameter, local or global", async () => {
    const source = [
      "SUB inc(BYREF v AS Integer)",
      " v = v + 1",
      "END SUB",
      "SUB twice(BYREF w AS Integer)",
      " DIM k AS Integer = 5",
      " inc k",
      " inc w",
      " inc w",
      " PRINT k",
      "END SUB",
      "DIM x AS Integer = 40",
      "twice x",
      "PRINT x",
      ""
    ].join("\n");
    expect(await firstLines(source)).toEqual(["6", "42"]);
  });

  it("takes a FASTCALL routine's first parameter in a register and removes the others", async () => {
    const source = "FUNCTION FASTCALL twice(a AS UInteger) AS UInteger\n RETURN a * 2\nEND FUNCTION\nFUNCTION FASTCALL half(a AS UByte, b AS UByte) AS UByte\n RETURN a / 2 + b\nEND FUNCTION\nPRINT twice(21); \" \"; half(8, 1)\n";
    expect((await firstLines(source, 1))[0]).toBe("42 5");
  });

  it("returns the result of a FUNCTION that falls off its end as 0", async () => {
    const source = "FUNCTION f(a AS UByte) AS UByte\n IF a THEN RETURN 9\nEND FUNCTION\nPRINT f(1); f(0)\n";
    expect((await firstLines(source, 1))[0]).toBe("90");
  });

  it("discards a FUNCTION's result when it is called as a statement", async () => {
    const source = "DIM calls AS UByte\nFUNCTION f() AS UInteger\n calls = calls + 1\n RETURN 7\nEND FUNCTION\nf\nf()\nPRINT calls\n";
    expect((await firstLines(source, 1))[0]).toBe("2");
  });

  it("leaves the stack as it found it (the program returns to its caller)", async () => {
    const r = await runBasic("FUNCTION g(a AS UByte, b AS UInteger, c AS Byte) AS Integer\n RETURN a + b + c\nEND FUNCTION\nDIM i AS UByte\nFOR i = 1 TO 50\n PRINT AT 0, 0; g(i, 1000, -1)\nNEXT i\n");
    expect(r.screen(1)).toEqual(["1049"]);
    // --- runBasic ran to the stub's loop after the call: SP is back to the stub's own value
    expect(r.session.machine.sp).toBe(r.session.peekWord(0x5c3d));
  });
});

describe("routine code", () => {
  it("records a call site on every user call, with the calls that follow it in the same statement", async () => {
    const { generated } = await compileBasic("FUNCTION f(a AS UByte) AS UByte\n RETURN a\nEND FUNCTION\nDIM x AS UByte\nx = f(1) + f(2)\nx = f(3)\n");
    const sites = generated.emitted.lines.filter((l) => l.site).map((l) => [l.site!.callee, l.site!.moreCallsFollow, l.site!.order]);
    // --- Arguments are evaluated last first, so f(2) is called before f(1)
    expect(sites).toEqual([
      ["f", true, 0],
      ["f", false, 1],
      ["f", false, 0]
    ]);
  });

  it("gives END SUB its own statement: the epilogue", async () => {
    const { generated } = await compileBasic("SUB s()\n PRINT 1\nEND SUB\ns\n");
    const texts = generated.mir.statements.map((st) => st.kind);
    expect(texts).toContain("return");
    expect(generated.debug.problems).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";

import { runBasic } from "./run-kit";

/** Float on the 48K: the ROM calculator through the float runtime module. */
const lines = async (source: string, rows = 1) => (await runBasic(source)).screen(rows);

describe("Float", () => {
  it("computes and prints as Sinclair BASIC does", async () => {
    const source = "DIM a, b AS Float\na = 1.5\nb = a * 4 - 1.0 / 4\nPRINT b; \" \"; a / 3; \" \"; -a; \" \"; 2 ^ 10; \" \"; 1E10 * a\n";
    expect((await lines(source))[0]).toBe("5.75 0.5 -1.5 1024 1.5E+10");
  });

  it("compares", async () => {
    const source = "DIM a AS Float = 0.1\nPRINT a < 0.2; a > 0.2; a = 0.1; a <> 0.1; a <= 0.1; a >= 0.11\n";
    expect((await lines(source))[0]).toBe("101010");
  });

  it("converts to and from integers: towards minus infinity, and modulo the width", async () => {
    const source = [
      "DIM f AS Float",
      "DIM i AS Integer",
      "DIM u AS UByte",
      "DIM l AS Long",
      "f = -2.5: i = f: PRINT i; \" \";",
      "f = 300.7: u = f: PRINT u; \" \";",
      "l = 100000: f = l * 3: PRINT f; \" \";",
      "i = -7: f = i / 2.0: PRINT f",
      ""
    ].join("\n");
    expect((await lines(source))[0]).toBe("-3 44 300000 -3.5");
  });

  it("evaluates the maths functions", async () => {
    const source = "PRINT SQR(16); \" \"; INT(-2.5); \" \"; ABS(-2.25); \" \"; SGN(-0.1); \" \"; SIN(0); \" \"; INT(COS(0) * 100); \" \"; INT(LN(EXP(2)) + 0.5); \" \"; INT(ATN(1) * 4 * 1000)\n";
    expect((await lines(source))[0]).toBe("4 -3 2.25 -1 0 100 2 3141");
  });

  it("takes ABS and SGN of integers in their own type", async () => {
    const source = "DIM i AS Integer = -300\nDIM l AS Long = -100000\nDIM b AS Byte = -5\nDIM u AS UInteger = 7\nPRINT ABS(i); \" \"; ABS(l); \" \"; ABS(b); \" \"; SGN(i); SGN(u); SGN(l - l)\n";
    expect((await lines(source))[0]).toBe("300 100000 5 -110");
  });

  it("converts with STR$ and VAL", async () => {
    const source = 'DIM s$ AS String\nDIM f AS Float\ns$ = STR$(1.0 / 8) + "|" + STR$(-12)\nf = VAL("2.5") * 2 + VAL(s$(0 TO 4))\nPRINT s$; " "; f\n';
    expect((await lines(source))[0]).toBe("0.125|-12 5.125");
  });

  it("takes MOD with the dividend's sign", async () => {
    const source = "DIM a AS Float = -7\nPRINT a MOD 3; \" \"; 7.5 MOD 2\n";
    expect((await lines(source))[0]).toBe("-1 1.5");
  });

  it("passes, returns and keeps Floats: parameters, FASTCALL, locals, arrays", async () => {
    const source = [
      "FUNCTION hyp(a AS Float, b AS Float) AS Float",
      " DIM t AS Float",
      " t = a * a + b * b",
      " RETURN SQR(t)",
      "END FUNCTION",
      "FUNCTION FASTCALL half(x AS Float) AS Float",
      " RETURN x / 2",
      "END FUNCTION",
      "DIM v(2) AS Float => {1.5, 2.5, 3.5}",
      "v(1) = v(0) + v(2)",
      "PRINT hyp(3, 4); \" \"; half(7); \" \"; v(1)",
      ""
    ].join("\n");
    expect((await lines(source))[0]).toBe("5 3.5 5");
  });

  it("counts a FOR loop with a fractional step", async () => {
    const source = "DIM x AS Float\nFOR x = 0 TO 1 STEP 0.25\n PRINT x; \" \";\nNEXT x\n";
    expect((await lines(source))[0]).toBe("0 0.25 0.5 0.75 1");
  });

  it("gives RND values in [0, 1) that RANDOMIZE repeats", async () => {
    const source = [
      "DIM a, b AS Float",
      "DIM i, ok AS UByte",
      "ok = 1",
      "RANDOMIZE 42: a = RND",
      "RANDOMIZE 42: b = RND",
      "IF a <> b THEN ok = 0",
      "FOR i = 1 TO 50",
      " a = RND",
      " IF a < 0 OR a >= 1 THEN ok = 0",
      "NEXT i",
      "PRINT ok",
      ""
    ].join("\n");
    expect((await lines(source))[0]).toBe("1");
  });

  it("stops with the ROM's report for a calculator error", async () => {
    const r = await runBasic("DIM z AS Float\nPRINT 1 / z\n", { expectEnd: false, frames: 100 });
    expect(r.session.screenLine(23)).toMatch(/^6 Number too big/);
  });
});

describe("USR", () => {
  it("calls machine code and returns its BC, and gives a character's UDG address", async () => {
    const source = 'POKE 40000, 1: POKE 40001, 57: POKE 40002, 48: POKE 40003, 201\nPRINT USR 40000; " "; USR "b" - PEEK(UInteger, 23675); " "; USR "U" - USR "a"\n';
    expect((await lines(source))[0]).toBe("12345 8 160");
  });
});

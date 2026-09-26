import { describe, expect, it } from "vitest";

import { runBasic } from "./run-kit";

/** Long and ULong on the 48K: DE:HL values, arith32, 32-bit PRINT, frames and arrays. */
const lines = async (source: string, rows = 1) => (await runBasic(source)).screen(rows);

describe("Long and ULong", () => {
  it("adds, subtracts, multiplies, divides and prints across the 16-bit boundary", async () => {
    const source = [
      "DIM a, b AS Long",
      "a = 100000",
      "b = -70000",
      "PRINT a + b; \" \"; a - b; \" \"; a * 3; \" \"; b / 7; \" \"; b MOD 7",
      "DIM u AS ULong = 4000000000",
      "PRINT u; \" \"; u / 3; \" \"; u + u",
      ""
    ].join("\n");
    // --- u + u wraps to 32 bits: 8000000000 - 2^32
    expect(await lines(source, 2)).toEqual(["30000 170000 300000 -10000 0", "4000000000 1333333333 3705032704"]);
  });

  it("compares signed and unsigned values, both ways round", async () => {
    const source = [
      "DIM a, b AS Long",
      "DIM u, v AS ULong",
      "a = -1: b = 65536",
      "u = 4294967295: v = 65536",
      "PRINT a < b; a > b; a <= b; a >= b; a = b; a <> b; \" \"; u < v; u > v; u = u; b = 65536",
      ""
    ].join("\n");
    expect((await lines(source))[0]).toBe("101001 0111");
  });

  it("negates, complements, shifts and masks", async () => {
    const source = [
      "DIM a AS Long = 123456",
      "DIM n AS UByte = 4",
      "PRINT -a; \" \"; BNOT a; \" \"; a SHL n; \" \"; -a SHR 3; \" \"; a BAND 65535; \" \"; a BOR 1; \" \"; a BXOR a",
      ""
    ].join("\n");
    // --- SHR of a Long is arithmetic: -123456 >> 3 = -15432
    expect((await lines(source, 2)).join("")).toBe("-123456 -123457 1975296 -15432 57920 123457 0");
  });

  it("widens and narrows: signed values keep their sign", async () => {
    const source = [
      "DIM i AS Integer = -2",
      "DIM b AS Byte = -3",
      "DIM w AS UInteger = 65535",
      "DIM a AS Long",
      "a = i: PRINT a; \" \";",
      "a = b: PRINT a; \" \";",
      "a = w: PRINT a; \" \";",
      "a = 70000: i = a: PRINT i",
      ""
    ].join("\n");
    expect((await lines(source))[0]).toBe("-2 -3 65535 4464");
  });

  it("passes, returns and keeps Longs in frames, both conventions", async () => {
    const source = [
      "FUNCTION sq(x AS Long) AS Long",
      " DIM t AS Long",
      " t = x * x",
      " RETURN t",
      "END FUNCTION",
      "FUNCTION FASTCALL twice(x AS ULong, k AS UByte) AS ULong",
      " RETURN x * k",
      "END FUNCTION",
      "PRINT sq(-3000); \" \"; twice(3000000000, 1); \" \"; twice(100000, 3)",
      ""
    ].join("\n");
    expect((await lines(source))[0]).toBe("9000000 3000000000 300000");
  });

  it("counts a FOR loop past 65535, and keeps Long arrays", async () => {
    const source = [
      "DIM i AS Long",
      "DIM a(2) AS Long => {-1, 100000, 7}",
      "DIM n AS UInteger",
      "FOR i = 65530 TO 65545 STEP 5",
      " n = n + 1",
      "NEXT i",
      "a(1) = a(1) * 2 + a(0)",
      "PRINT n; \" \"; i; \" \"; a(1); \" \"; a(2)",
      ""
    ].join("\n");
    expect((await lines(source))[0]).toBe("4 65550 199999 7");
  });
});

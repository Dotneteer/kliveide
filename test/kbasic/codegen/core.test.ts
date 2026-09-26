import { describe, expect, it } from "vitest";
import { compileBasic, runBasic } from "./run-kit";

/**
 * Phase 3's first slice, run on the real 48K: integers, PRINT, control flow. Each program prints
 * what it computes; the test reads the screen (or memory) back.
 */
const screenOf = async (source: string, rows = 6) => (await runBasic(source)).screen(rows);

describe("PRINT", () => {
  it("prints literals and numbers with ';' and ends the line", async () => {
    expect(await screenOf('PRINT "Hello"\nPRINT 1; 2; "x"\nPRINT -5; 300; 65535\n')).toEqual(["Hello", "12x", "-530065535"]);
  });

  it("keeps the line open after a trailing ';' and moves to column 16 with ','", async () => {
    const lines = await screenOf('PRINT "a";\nPRINT "b"\nPRINT "c", "d"\n');
    expect(lines[0]).toBe("ab");
    expect(lines[1]).toBe("c               d");
  });

  it("prints AT a position and TAB to a column", async () => {
    const lines = await screenOf('PRINT AT 2, 5; "X"\nPRINT TAB 3; "Y"\n');
    expect(lines[2]).toBe("     X");
    expect(lines[3]).toBe("   Y");
  });

  it("applies INK and PAPER to one PRINT only", async () => {
    const r = await runBasic('PRINT INK 2; PAPER 6; "A"\nPRINT "B"\n');
    const attr = (row: number, col: number) => r.session.peek(0x5800 + row * 32 + col);
    expect(attr(0, 0) & 0x3f).toBe((6 << 3) | 2);
    expect(attr(1, 0) & 0x3f).toBe(7 << 3);
  });
});

describe("integer arithmetic", () => {
  it.each([
    ["DIM a AS UByte = 200\nDIM b AS UByte = 100\nPRINT a + b", "44"],
    ["DIM a AS Integer = 200\nDIM b AS Integer = 100\nPRINT a + b; \" \"; a - b; \" \"; b - a", "300 100 -100"],
    ["DIM a AS Integer = -7\nDIM b AS Integer = 2\nPRINT a / b; \" \"; a MOD b", "-3 -1"],
    ["DIM a AS UInteger = 50000\nDIM b AS UInteger = 7\nPRINT a / b; \" \"; a MOD b", "7142 6"],
    ["DIM a AS Byte = -100\nDIM b AS Byte = 3\nPRINT a / b; \" \"; a MOD b", "-33 -1"],
    ["DIM a AS UInteger = 300\nDIM b AS UInteger = 200\nPRINT a * b", "60000"],
    ["DIM a AS UByte = 13\nPRINT a * 7", "91"],
    ["DIM a AS Integer = 1\nPRINT a SHL 10; \" \"; -1024 SHR 3", "1024 -128"],
    ["DIM a AS UInteger = 40000\nPRINT a SHR 2", "10000"],
    ["DIM a AS UByte = $F0\nDIM b AS UByte = $3C\nPRINT a bAND b; \" \"; a bOR b; \" \"; a bXOR b; \" \"; bNOT a", "48 252 204 15"],
    ["DIM a AS Integer = 1000\nPRINT -a", "-1000"],
    ["DIM a AS Byte = -5\nDIM w AS Integer\nw = a\nPRINT w", "-5"]
  ])("%s", async (source, expected) => {
    expect((await screenOf(`${source}\n`, 1))[0]).toBe(expected);
  });
});

describe("comparisons and logic", () => {
  it.each([
    ["DIM a AS Integer = -1\nDIM b AS Integer = 1\nPRINT a < b; a > b; a = b; a <> b; a <= b; a >= b", "100110"],
    ["DIM a AS UInteger = 65535\nDIM b AS UInteger = 1\nPRINT a < b; a > b", "01"],
    ["DIM a AS Byte = -128\nDIM b AS Byte = 127\nPRINT a < b; b > a; a <= a", "111"],
    ["DIM a AS UByte = 0\nDIM b AS UByte = 5\nPRINT (a AND b); (a OR b); (b XOR a); NOT a; NOT b", "01110"]
  ])("%s", async (source, expected) => {
    expect((await screenOf(`${source}\n`, 1))[0]).toBe(expected);
  });
});

describe("control flow", () => {
  it("runs IF, ELSEIF and ELSE branches", async () => {
    const source = "FOR i = 1 TO 3\n IF i = 1 THEN\n  PRINT \"one\";\n ELSEIF i = 2 THEN\n  PRINT \"two\";\n ELSE\n  PRINT \"many\";\n END IF\nNEXT i\n";
    expect((await screenOf(source, 1))[0]).toBe("onetwomany");
  });

  it("counts FOR loops up, down and by a step computed at run time", async () => {
    const source = "FOR i = 1 TO 5 STEP 2: PRINT i;: NEXT i\nPRINT\nFOR j = 3 TO 1 STEP -1: PRINT j;: NEXT j\nPRINT\nDIM s AS Byte = -2\nFOR k = 6 TO 1 STEP s: PRINT k;: NEXT k\n";
    expect(await screenOf(source, 3)).toEqual(["135", "321", "642"]);
  });

  it("skips a FOR loop whose range is empty", async () => {
    expect((await screenOf('FOR i = 5 TO 1: PRINT "x";: NEXT i\nPRINT "end"\n', 1))[0]).toBe("end");
  });

  it("runs WHILE and every DO form", async () => {
    const source = [
      "DIM n AS UByte",
      "WHILE n < 3: PRINT n;: n = n + 1: WEND",
      'PRINT ";";',
      "DO WHILE n > 0: PRINT n;: n = n - 1: LOOP",
      'PRINT ";";',
      "DO: n = n + 1: PRINT n;: LOOP UNTIL n = 2",
      'PRINT ";";',
      "DO UNTIL n = 0: n = n - 1: LOOP",
      "DO: PRINT n;: n = n + 1: LOOP WHILE n < 2",
      ""
    ].join("\n");
    expect((await screenOf(source, 1))[0]).toBe("012;321;12;01");
  });

  it("leaves and restarts loops with EXIT and CONTINUE", async () => {
    const source = "FOR i = 1 TO 9\n IF i = 2 THEN CONTINUE FOR\n IF i = 5 THEN EXIT FOR\n PRINT i;\nNEXT i\nDIM n AS UByte\nDO\n n = n + 1\n IF n = 3 THEN EXIT DO\nLOOP\nPRINT \" \"; n\n";
    expect((await screenOf(source, 1))[0]).toBe("134 3");
  });

  it("jumps with GOTO, calls with GOSUB and dispatches with ON", async () => {
    const source = [
      'GOSUB show',
      'DIM k AS UByte = 1',
      'ON k GOTO zero, one, two',
      'PRINT "none"',
      'GOTO after',
      'zero: PRINT "zero": GOTO after',
      'one: PRINT "one": GOTO after',
      'two: PRINT "two"',
      'after: k = 2',
      'ON k GOSUB zero2, one2, two2',
      'PRINT "back"',
      'END',
      'show: PRINT "sub": RETURN',
      'zero2: PRINT "z": RETURN',
      'one2: PRINT "o": RETURN',
      'two2: PRINT "t": RETURN',
      ''
    ].join("\n");
    expect(await screenOf(source, 4)).toEqual(["sub", "one", "t", "back"]);
  });

  it("goes on after ON when the selector is out of range", async () => {
    expect((await screenOf('DIM k AS UByte = 7\nON k GOTO a, b\nPRINT "fell"\nEND\na: PRINT "a"\nb: PRINT "b"\n', 1))[0]).toBe("fell");
  });

  it("jumps to line numbers", async () => {
    expect((await screenOf('10 PRINT "a";\n20 GOTO 40\n30 PRINT "skipped";\n40 PRINT "b"\n', 1))[0]).toBe("ab");
  });
});

describe("memory, END and errors", () => {
  it("POKEs and PEEKs bytes and words", async () => {
    const r = await runBasic("POKE 40000, 7\nPOKE UInteger 40002, 1234\nDIM a AS UByte\na = PEEK 40000\nDIM w AS UInteger\nw = PEEK(UInteger, 40002)\n");
    expect(r.session.peek(40000)).toBe(7);
    expect(r.session.peekWord(40002)).toBe(1234);
    expect(r.byte("a")).toBe(7);
    expect(r.word("w")).toBe(1234);
  });

  it("returns END's value in BC, as USR expects", async () => {
    const r = await runBasic('PRINT "x"\nEND 1234\nPRINT "not here"\n');
    expect(r.session.machine.bc).toBe(1234);
    expect(r.screen(1)).toEqual(["x"]);
  });

  it("stops with the STOP report", async () => {
    const r = await runBasic('PRINT "a"\nSTOP\nPRINT "b"\n', { expectEnd: false, frames: 60 });
    expect(r.screen(1)).toEqual(["a"]);
    expect(r.session.screenLine(23)).toMatch(/^9 STOP statement/);
  });

  it("raises an error report with ERROR", async () => {
    const r = await runBasic("ERROR 2\n", { expectEnd: false, frames: 60 });
    expect(r.session.screenLine(23)).toMatch(/^3 Subscript wrong/);
  });

  it("keeps mapped variables at their address", async () => {
    const r = await runBasic("DIM counter AS UInteger AT 40010\ncounter = 4321\n");
    expect(r.session.peekWord(40010)).toBe(4321);
  });
});

describe("code generation facts", () => {
  it("starts every statement with an empty stack (G4 by construction) and emits a marker per statement", async () => {
    const { generated } = await compileBasic("DIM a AS UByte = 1\na = a + 1 : PRINT a\nIF a THEN PRINT 1\n");
    const markers = generated.emitted.lines.filter((l) => l.marker === "stmt").length;
    expect(markers).toBe(generated.mir.statements.length);
    expect(generated.debug.problems).toEqual([]);
  });

  it("reports what the code generator cannot do yet (E501) instead of generating wrong code", async () => {
    await expect(compileBasic("CODEBANK 1\nSUB s()\nEND SUB\nEND CODEBANK\n")).rejects.toThrow(/E501/);
  });
});

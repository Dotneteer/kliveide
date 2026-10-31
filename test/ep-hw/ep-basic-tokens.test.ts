import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  EP_BASIC_PROGRAM_0,
  EP_BASIC_PROGRAM_END,
  EP_BASIC_PROGRAM_START,
  EP_BASIC_TEXT_TOKENS,
  EP_BASIC_TOKENS,
  decodeEpBasicProgram,
  formatEpBasicFloat,
  formatEpBasicLine
} from "@common/enterprise/basicTokens";
import { createEpSession, EpTestSession } from "../harness/enterprise";

/*
 * IS-BASIC 2.1's stored program (`src/common/enterprise/basicTokens.ts`, plan §11.4): lines typed at
 * the prompt of the real ROM, read back from IS-BASIC's memory, detokenised, and compared with what the
 * ROM's own LIST prints.
 */

const word = (s: EpTestSession, address: number) => s.peek(address) | (s.peek(address + 1) << 8);

function storedProgram(s: EpTestSession) {
  const memory = new Uint8Array(0x10000);
  for (let a = 0; a < 0x10000; a++) memory[a] = s.peek(a);
  return decodeEpBasicProgram(memory, word(s, EP_BASIC_PROGRAM_START), word(s, EP_BASIC_PROGRAM_END));
}

/** The lines LIST printed: the rows after "LIST" up to "ok", continuation rows (six spaces) joined */
function listedLines(screen: string): string[] {
  const rows = screen.split("\n");
  const lines: string[] = [];
  for (const row of rows.slice(rows.lastIndexOf("LIST") + 1)) {
    if (row === "ok") break;
    if (/^ {0,4}\d+ /.test(row)) lines.push(row);
    else if (row.startsWith("      ") && lines.length) lines[lines.length - 1] += row.slice(6);
  }
  return lines;
}

/** Typed, then as LIST prints them */
const PROGRAM: [string, string][] = [
  ["10 print sin(1)+cos(2)*3-4/5^6", "   10 PRINT SIN(1)+COS(2)*3-4/5^6"],
  ['20 IF A<B AND C=>D THEN PRINT "X"', '   20 IF A<B AND C>=D THEN PRINT "X"'],
  ["30 FOR I=1 TO 10 STEP 2", "   30 FOR I=1 TO 10 STEP 2"],
  ["40 PRINT I;-1,A AND -B,NOT A", "   40   PRINT I;-1,A AND-B,NOT A"],
  ["50 NEXT I", "   50 NEXT I"],
  ["60 REM  Hello, World", "   60 REM  Hello, World"],
  ["70 DATA 1,2,abc", "   70 DATA 1,2,abc"],
  ["80 LET A$=\"SAY \"\"HI\"\"\"&CHR$(65)", '   80 LET A$="SAY ""HI"""&CHR$(65)'],
  ["90 PRINT 1.5,0.25,32768,1E10", "   90 PRINT 1.5,.25,32768,1E10"],
  ["100 PRINT 1.25E-9,0.000001", "  100 PRINT 1.25E-09,.000001"],
  ["110 GOSUB 30:GOTO 10", "  110 GOSUB 30:GOTO 10"],
  ['120 OPEN #1:"FILE:X" ACCESS OUTPUT', '  120 OPEN #1:"FILE:X" ACCESS OUTPUT'],
  ["130 PRINT A$(1:2) ! done", "  130 PRINT A$(1:2) ! done"],
  ["140 DO WHILE X<=3", "  140 DO WHILE X<=3"],
  ["150 LET X=X+1", "  150   LET X=X+1"],
  ["160 LOOP", "  160 LOOP"],
  ["170 DEF F(X)=X*2", "  170 DEF F(X)=X*2"],
  ["180 IMAGE ###.##", "  180 IMAGE ###.##"],
  ["190 END", "  190 END"]
];

describe("IS-BASIC 2.1 program", () => {
  it("is detokenised as LIST prints it", async () => {
    const s = await createEpSession();
    s.bootToBasic();
    expect(word(s, EP_BASIC_PROGRAM_START)).toBe(EP_BASIC_PROGRAM_0);
    expect(storedProgram(s)).toEqual([]);

    s.typeKeys(PROGRAM.map(([typed]) => typed + "\n").join(""), { settle: 30 });
    const lines = storedProgram(s);
    expect(lines.map(formatEpBasicLine)).toEqual(PROGRAM.map(([, listed]) => listed));
    expect(lines[0].address).toBe(EP_BASIC_PROGRAM_0);

    // --- The ROM's own LIST agrees
    s.typeKeys("CLEAR SCREEN\nLIST\n", { settle: 300 });
    expect(listedLines(s.screenText())).toEqual(PROGRAM.map(([, listed]) => listed));

    // --- RUN puts the variables above the program and leaves its pointers alone
    s.typeKeys("NEW\n", { settle: 30 }).typeKeys("10 STRING S$*8\n20 LET A=1:LET S$=\"HI\"\n", { settle: 30 });
    const end = word(s, EP_BASIC_PROGRAM_END);
    s.typeKeys("RUN\n", { settle: 100 });
    expect(word(s, EP_BASIC_PROGRAM_END)).toBe(end);
    expect(storedProgram(s).map(formatEpBasicLine)).toEqual([
      "   10 STRING S$*8",
      '   20 LET A=1:LET S$="HI"'
    ]);
  }, 120_000);

  it("has the statement words of the ROM's keyword table, DATA, IMAGE, REM and ! keeping their text", () => {
    // --- IS-BASIC's ROM is at page 3; the table is at F5A7h. Each entry: two handler words, a flag
    // --- byte (bit 6 clear for the statements that keep their text), the length and the word; a zero
    // --- handler word ends it.
    const rom = new Uint8Array(readFileSync(join(__dirname, "../../src/public/roms/ep-basic21.rom")));
    const words: string[] = [];
    const text = new Set<number>();
    for (let p = 0x35a7; rom[p] | rom[p + 1]; p += 6 + rom[p + 5]) {
      if ((rom[p + 4] & 0x40) === 0) text.add(words.length);
      words.push(String.fromCharCode(...rom.subarray(p + 6, p + 6 + rom[p + 5])));
    }
    expect(words).toEqual(EP_BASIC_TOKENS);
    expect([...text]).toEqual([...EP_BASIC_TEXT_TOKENS]);
  });

  it("prints floats as LIST was seen to", () => {
    const float = (digits: string, exponent: number) => {
      const bcd = digits.padEnd(10, "0");
      const bytes = Array.from({ length: 5 }, (_, i) => parseInt(bcd.slice(8 - 2 * i, 10 - 2 * i), 16));
      return formatEpBasicFloat([...bytes, exponent]);
    };
    expect(float("1", 0x49)).toBe("1000000000");
    expect(float("1234567891", 0x49)).toBe("1234567891");
    expect(float("1", 0x4a)).toBe("1E10");
    expect(float("15", 0x4a)).toBe("1.5E10");
    expect(float("1", 0x35)).toBe("1E-11");
    expect(float("15", 0x36)).toBe("1.5E-10");
    expect(float("125", 0x37)).toBe("1.25E-09");
    expect(float("123", 0x3c)).toBe(".000123");
    expect(float("123456", 0x42)).toBe("123.456");
    expect(float("1", 0x63)).toBe("1E35");
    expect(float("1", 0x0e)).toBe("1E-50");
    expect(float("1", 0x36)).toBe(".0000000001");
    expect(float("12", 0x36)).toBe("1.2E-10");
    expect(float("12", 0x37)).toBe(".0000000012");
    expect(float("123456789", 0x4c)).toBe("1.23456789E12");
    expect(float("15", 0xc0)).toBe("-1.5");
    expect(float("0", 0x40)).toBe("0");
  });
});

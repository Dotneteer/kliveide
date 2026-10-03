import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  computeBasicBlockMatch,
  computeBasicFoldingRanges,
  computeBasicStructure,
  scanBasicLines
} from "@renderer/appIde/services/basic-structure";

const lines = (text: string) => text.replace(/^\n/, "").split("\n");

function filesUnder(folder: string, ext: RegExp): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(full, ext));
    else if (ext.test(entry.name)) out.push(full);
  }
  return out;
}

describe("BASIC text structure", () => {
  it("splits statements and blanks strings and comments", () => {
    const [info] = scanBasicLines(['PRINT "a:b": x = 1 \' rest: here']);
    expect(info.statements.map((s) => s.text.trim())).toEqual(['PRINT "   "', "x = 1"]);
    expect(info.statements[1].column).toBe(13);
  });

  it("knows comment lines, REM and block comments", () => {
    const infos = scanBasicLines(["' one", "REM two", "10 REM three", "/' a", "b '/ PRINT 1", "x = 1"]);
    expect(infos.map((i) => i.commentOnly)).toEqual([true, true, false, true, false, false]);
    expect(infos[2].statements.map((s) => s.text.trim())).toEqual(["10"]);
    expect(infos[3].blockCommentEnd).toBe(5);
    expect(infos[4].statements[0].text.trim()).toBe("PRINT 1");
  });

  it("does not read ASM blocks as BASIC", () => {
    const infos = scanBasicLines(["ASM", "  ld a, 1 ; FOR", "END ASM"]);
    expect(infos.map((i) => i.asm)).toEqual([false, true, false]);
    const s = computeBasicStructure(["ASM", "  FOR", "END ASM"]);
    expect(s.blocks.map((b) => [b.kind, b.startLine, b.endLine])).toEqual([["asm", 1, 3]]);
  });

  it("finds blocks, single-line forms and ELSE", () => {
    const s = computeBasicStructure(
      lines(`
SUB s(a AS UByte)
  IF a THEN
    PRINT 1
  ELSEIF a > 2 THEN
    PRINT 2
  ELSE
    PRINT 3
  END IF
  IF a THEN PRINT 4: END IF
  FOR i = 1 TO 3: PRINT i: NEXT i
  DO
  LOOP UNTIL a
  WHILE a
  WEND
END SUB
#ifdef X
#else
#endif`)
    );
    expect(s.unmatchedClosers).toEqual([]);
    expect(s.blocks.map((b) => `${b.kind}:${b.startLine}-${b.endLine}:${b.keywords.length}`)).toEqual([
      "sub:1-15:2",
      "if:2-8:4",
      "for:10-10:2",
      "do:11-12:2",
      "while:13-14:2",
      "#if:16-18:3"
    ]);
  });

  it("ELSE with statements ends the IF on its line", () => {
    const s = computeBasicStructure(lines(`
IF a THEN
  PRINT 1
ELSE PRINT 2: END IF
PRINT 3`));
    expect(s.unmatchedClosers).toEqual([]);
    expect(s.blocks.map((b) => [b.startLine, b.endLine])).toEqual([[1, 3]]);
  });

  it("folds blocks up to the closer, comment runs and #if regions", () => {
    const ranges = computeBasicFoldingRanges(
      lines(`
' a
' b
FUNCTION f AS UByte
  RETURN 1
END FUNCTION`)
    );
    expect(ranges).toEqual([
      { line: 1, endLine: 2, kind: "comment" },
      { line: 3, endLine: 4 }
    ]);
  });

  it("matches block keywords", () => {
    const text = lines(`
FOR i = 1 TO 2
  PRINT i
NEXT i`);
    expect(computeBasicBlockMatch(text, 3, 2)).toEqual([
      { line: 1, startColumn: 1, endColumn: 4 },
      { line: 3, startColumn: 1, endColumn: 5 }
    ]);
    expect(computeBasicBlockMatch(text, 2, 4)).toBeNull();
  });

  it("every corpus program and library file folds without an unmatched block", () => {
    const files = [
      ...filesUnder(path.resolve("test/kbasic/corpus"), /\.zxbas$/),
      ...filesUnder(path.resolve("src/main/kbasic/stdlib"), /\.bas$/)
    ];
    expect(files.length).toBeGreaterThan(100);
    const problems: string[] = [];
    for (const file of files) {
      const s = computeBasicStructure(fs.readFileSync(file, "utf8").replace(/\r\n?/g, "\n").split("\n"));
      for (const c of s.unmatchedClosers) problems.push(`${file}:${c.line} unmatched closer`);
      for (const b of s.blocks) if (b.endLine === undefined) problems.push(`${file}:${b.startLine} unclosed ${b.kind}`);
    }
    expect(problems).toEqual([]);
  });
});

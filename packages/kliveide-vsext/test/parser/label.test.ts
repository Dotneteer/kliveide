import "mocha";
import * as expect from "expect";

import {
  LabelOnlyLine,
  Z80AssemblyLine,
} from "../../src/z80lang/parser/tree-nodes";
import { InputStream } from "../../src/z80lang/parser/input-stream";
import { TokenStream } from "../../src/z80lang/parser/token-stream";
import { Z80AsmParser } from "../../src/z80lang/parser/z80-asm-parser";

describe("Parser - labels", () => {
  const labelIds = [
    "continue",
    "CONTINUE",
    "break",
    "BREAK",
    "endm",
    "ENDM",
    "mend",
    "MEND",
    "endl",
    "ENDL",
    "lend",
    "LEND",
    "proc",
    "PROC",
    "endp",
    "ENDP",
    "pend",
    "PEND",
    "repeat",
    "REPEAT",
    "endw",
    "ENDW",
    "wend",
    "WEND",
    "ends",
    "ENDS",
    "else",
    "ELSE",
    "elif",
    "ELIF",
    "endif",
    "ENDIF",
    "while",
    "WHILE",
    "until",
    "UNTIL",
    "loop",
    "LOOP",
    "next",
    "NEXT",
  ];
  labelIds.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst}:`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "LabelOnlyLine").toBe(true);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label.name).toBe(inst);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 1);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 1);
    });
  });

  labelIds.forEach((inst) => {
    it(`${inst} #2`, () => {
      const parser = createParser(`${inst}: ld a,b`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "LdInstruction").toBe(true);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label.name).toBe(inst);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 8);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 8);
    });
  });

  it("dot can start an identifier", () => {
    const parser = createParser(`.myLabel`);
    const parsed = parser.parseProgram();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.assemblyLines.length).toBe(1);
    expect(parsed.assemblyLines[0].type === "LabelOnlyLine").toBe(true);
    const line = parsed.assemblyLines[0] as Z80AssemblyLine;
    expect(line.label.name).toBe(".myLabel");
  });

});

function createParser(source: string): Z80AsmParser {
  const is = new InputStream(source);
  const ts = new TokenStream(is);
  return new Z80AsmParser(ts);
}

import "mocha";
import * as expect from "expect";

import { SimpleZ80Instruction, Z80AssemblyLine, Z80Instruction } from "../../src/z80lang/parser/tree-nodes";
import { InputStream } from "../../src/z80lang/parser/input-stream";
import { TokenStream } from "../../src/z80lang/parser/token-stream";
import { Z80AsmParser } from "../../src/z80lang/parser/z80-asm-parser";

describe("Parser - simple Z80 instructions", () => {
  it("label-only #1", () => {
    const parser = createParser("myLabel");
    const parsed = parser.parseProgram();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.assemblyLines.length).toBe(1);
    expect(parsed.assemblyLines[0].type).toBe("LabelOnlyLine");
    const line = parsed.assemblyLines[0] as Z80AssemblyLine;
    expect(line.label.name).toBe("myLabel");
    expect(line.startPosition).toBe(0);
    expect(line.endPosition).toBe(7);
    expect(line.line).toBe(1);
    expect(line.startColumn).toBe(0);
    expect(line.endColumn).toBe(7);
  });

  it("label-only #2", () => {
    const parser = createParser("myLabel:");
    const parsed = parser.parseProgram();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.assemblyLines.length).toBe(1);
    expect(parsed.assemblyLines[0].type).toBe("LabelOnlyLine");
    const line = parsed.assemblyLines[0] as Z80AssemblyLine;
    expect(line.label.name).toBe("myLabel");
    expect(line.startPosition).toBe(0);
    expect(line.endPosition).toBe(8);
    expect(line.line).toBe(1);
    expect(line.startColumn).toBe(0);
    expect(line.endColumn).toBe(8);
  });

  it("label-only #3", () => {
    const parser = createParser("  myLabel:");
    const parsed = parser.parseProgram();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.assemblyLines.length).toBe(1);
    expect(parsed.assemblyLines[0].type).toBe("LabelOnlyLine");
    const line = parsed.assemblyLines[0] as Z80AssemblyLine;
    expect(line.label.name).toBe("myLabel");
    expect(line.startPosition).toBe(2);
    expect(line.endPosition).toBe(10);
    expect(line.line).toBe(1);
    expect(line.startColumn).toBe(2);
    expect(line.endColumn).toBe(10);
  });

  it("label-only #4", () => {
    const parser = createParser("  myLabel:\r\n");
    const parsed = parser.parseProgram();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.assemblyLines.length).toBe(1);
    expect(parsed.assemblyLines[0].type).toBe("LabelOnlyLine");
    const line = parsed.assemblyLines[0] as Z80AssemblyLine;
    expect(line.label.name).toBe("myLabel");
    expect(line.startPosition).toBe(2);
    expect(line.endPosition).toBe(10);
    expect(line.line).toBe(1);
    expect(line.startColumn).toBe(2);
    expect(line.endColumn).toBe(10);
  });

  const simpleInstructions = [
    "nop",
    "rlca",
    "rrca",
    "rla",
    "rra",
    "daa",
    "cpl",
    "scf",
    "ccf",
    "halt",
    "exx",
    "di",
    "ei",
    "neg",
    "retn",
    "reti",
    "rld",
    "rrd",
    "ldi",
    "cpi",
    "ini",
    "outi",
    "ldd",
    "cpd",
    "ind",
    "outd",
    "ldir",
    "cpir",
    "inir",
    "otir",
    "lddr",
    "cpdr",
    "indr",
    "otdr",
    "ldix",
    "ldws",
    "ldirx",
    "lddx",
    "lddrx",
    "ldpirx",
    "outinb",
    "swapnib",
    "pixeldn",
    "pixelad",
    "setae",
  ];

  simpleInstructions.forEach((instr) => {
    it(`${instr}`, () => {
      testInstruction(instr);
    });
  });
});

function testInstruction(source: string): void {
  // --- Normal case
  let parser = createParser(source);
  let parsed = parser.parseProgram();
  expect(parser.hasErrors).toBe(false);
  expect(parsed).not.toBeNull();
  expect(parsed.assemblyLines.length).toBe(1);
  expect(parsed.assemblyLines[0].type).toBe("SimpleZ80Instruction");
  let line = (parsed.assemblyLines[0] as unknown) as SimpleZ80Instruction;
  expect(line.mnemonic).toBe(source.toUpperCase());
  let asmLine = parsed.assemblyLines[0] as Z80AssemblyLine;
  expect(asmLine.label).toBeNull();
  expect(asmLine.startPosition).toBe(0);
  expect(asmLine.endPosition).toBe(source.length);
  expect(asmLine.line).toBe(1);
  expect(asmLine.startColumn).toBe(0);
  expect(asmLine.endColumn).toBe(source.length);

  // --- Whitespaced case
  parser = createParser("  " + source);
  parsed = parser.parseProgram();
  expect(parser.hasErrors).toBe(false);
  expect(parsed).not.toBeNull();
  expect(parsed.assemblyLines.length).toBe(1);
  expect(parsed.assemblyLines[0].type).toBe("SimpleZ80Instruction");
  line = (parsed.assemblyLines[0] as unknown) as SimpleZ80Instruction;
  expect(line.mnemonic).toBe(source.toUpperCase());
  asmLine = parsed.assemblyLines[0] as Z80AssemblyLine;
  expect(asmLine.label).toBeNull();
  expect(asmLine.startPosition).toBe(2);
  expect(asmLine.endPosition).toBe(2 + source.length);
  expect(asmLine.line).toBe(1);
  expect(asmLine.startColumn).toBe(2);
  expect(asmLine.endColumn).toBe(2 + source.length);

  // --- New line before case #1
  parser = createParser("\n" + source);
  parsed = parser.parseProgram();
  expect(parser.hasErrors).toBe(false);
  expect(parsed).not.toBeNull();
  expect(parsed.assemblyLines.length).toBe(1);
  expect(parsed.assemblyLines[0].type).toBe("SimpleZ80Instruction");
  line = (parsed.assemblyLines[0] as unknown) as SimpleZ80Instruction;
  expect(line.mnemonic).toBe(source.toUpperCase());
  asmLine = parsed.assemblyLines[0] as Z80AssemblyLine;
  expect(asmLine.label).toBeNull();
  expect(asmLine.startPosition).toBe(1);
  expect(asmLine.endPosition).toBe(1 + source.length);
  expect(asmLine.line).toBe(2);
  expect(asmLine.startColumn).toBe(0);
  expect(asmLine.endColumn).toBe(source.length);

  // --- New line before case #2
  parser = createParser("\r\n" + source);
  parsed = parser.parseProgram();
  expect(parser.hasErrors).toBe(false);
  expect(parsed).not.toBeNull();
  expect(parsed.assemblyLines.length).toBe(1);
  expect(parsed.assemblyLines[0].type).toBe("SimpleZ80Instruction");
  line = (parsed.assemblyLines[0] as unknown) as SimpleZ80Instruction;
  expect(line.mnemonic).toBe(source.toUpperCase());
  asmLine = parsed.assemblyLines[0] as Z80AssemblyLine;
  expect(asmLine.label).toBeNull();
  expect(asmLine.startPosition).toBe(2);
  expect(asmLine.endPosition).toBe(2 + source.length);
  expect(asmLine.line).toBe(2);
  expect(asmLine.startColumn).toBe(0);
  expect(asmLine.endColumn).toBe(source.length);

  // --- New line after case #1
  parser = createParser(source + "\n");
  parsed = parser.parseProgram();
  expect(parser.hasErrors).toBe(false);
  expect(parsed).not.toBeNull();
  expect(parsed.assemblyLines.length).toBe(1);
  expect(parsed.assemblyLines[0].type).toBe("SimpleZ80Instruction");
  line = (parsed.assemblyLines[0] as unknown) as SimpleZ80Instruction;
  expect(line.mnemonic).toBe(source.toUpperCase());
  asmLine = parsed.assemblyLines[0] as Z80AssemblyLine;
  expect(asmLine.label).toBeNull();
  expect(asmLine.startPosition).toBe(0);
  expect(asmLine.endPosition).toBe(source.length);
  expect(asmLine.line).toBe(1);
  expect(asmLine.startColumn).toBe(0);
  expect(asmLine.endColumn).toBe(source.length);

  // --- New line after case #1
  parser = createParser(source + "\n\r");
  parsed = parser.parseProgram();
  expect(parser.hasErrors).toBe(false);
  expect(parsed).not.toBeNull();
  expect(parsed.assemblyLines.length).toBe(1);
  expect(parsed.assemblyLines[0].type).toBe("SimpleZ80Instruction");
  line = (parsed.assemblyLines[0] as unknown) as SimpleZ80Instruction;
  expect(line.mnemonic).toBe(source.toUpperCase());
  asmLine = parsed.assemblyLines[0] as Z80AssemblyLine;
  expect(asmLine.label).toBeNull();
  expect(asmLine.startPosition).toBe(0);
  expect(asmLine.endPosition).toBe(source.length);
  expect(asmLine.line).toBe(1);
  expect(asmLine.startColumn).toBe(0);
  expect(asmLine.endColumn).toBe(source.length);

  // --- Labeled case #1
  parser = createParser("myLabel " + source);
  parsed = parser.parseProgram();
  expect(parser.hasErrors).toBe(false);
  expect(parsed).not.toBeNull();
  expect(parsed.assemblyLines.length).toBe(1);
  expect(parsed.assemblyLines[0].type).toBe("SimpleZ80Instruction");
  line = (parsed.assemblyLines[0] as unknown) as SimpleZ80Instruction;
  expect(line.mnemonic).toBe(source.toUpperCase());
  asmLine = parsed.assemblyLines[0] as Z80AssemblyLine;
  expect(asmLine.label.name).toBe("myLabel");
  expect(asmLine.startPosition).toBe(0);
  expect(asmLine.endPosition).toBe(8 + source.length);
  expect(asmLine.line).toBe(1);
  expect(asmLine.startColumn).toBe(0);
  expect(asmLine.endColumn).toBe(8 + source.length);

  // --- Labeled case #2
  parser = createParser("myLabel:" + source);
  parsed = parser.parseProgram();
  expect(parser.hasErrors).toBe(false);
  expect(parsed).not.toBeNull();
  expect(parsed.assemblyLines.length).toBe(1);
  expect(parsed.assemblyLines[0].type).toBe("SimpleZ80Instruction");
  line = (parsed.assemblyLines[0] as unknown) as SimpleZ80Instruction;
  expect(line.mnemonic).toBe(source.toUpperCase());
  asmLine = parsed.assemblyLines[0] as Z80AssemblyLine;
  expect(asmLine.label.name).toBe("myLabel");
  expect(asmLine.startPosition).toBe(0);
  expect(asmLine.endPosition).toBe(8 + source.length);
  expect(asmLine.line).toBe(1);
  expect(asmLine.startColumn).toBe(0);
  expect(asmLine.endColumn).toBe(8 + source.length);

  // --- Labeled case #3
  parser = createParser("myLabel: " + source);
  parsed = parser.parseProgram();
  expect(parser.hasErrors).toBe(false);
  expect(parsed).not.toBeNull();
  expect(parsed.assemblyLines.length).toBe(1);
  expect(parsed.assemblyLines[0].type).toBe("SimpleZ80Instruction");
  line = (parsed.assemblyLines[0] as unknown) as SimpleZ80Instruction;
  expect(line.mnemonic).toBe(source.toUpperCase());
  asmLine = parsed.assemblyLines[0] as Z80AssemblyLine;
  expect(asmLine.label.name).toBe("myLabel");
  expect(asmLine.startPosition).toBe(0);
  expect(asmLine.endPosition).toBe(9 + source.length);
  expect(asmLine.line).toBe(1);
  expect(asmLine.startColumn).toBe(0);
  expect(asmLine.endColumn).toBe(9 + source.length);
}

function createParser(source: string): Z80AsmParser {
  const is = new InputStream(source);
  const ts = new TokenStream(is);
  return new Z80AsmParser(ts);
}

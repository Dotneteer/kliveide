import "mocha";
import * as expect from "expect";

import {
  SimpleZ80Instruction,
  Z80AssemblyLine,
  TestInstruction,
  NextRegInstruction,
  OperandType,
} from "../../src/z80lang/parser/tree-nodes";
import { InputStream } from "../../src/z80lang/parser/input-stream";
import { TokenStream } from "../../src/z80lang/parser/token-stream";
import { Z80AsmParser } from "../../src/z80lang/parser/z80-asm-parser";

describe("Parser - Next Z80 instructions", () => {
  const bsInsts = [
    "bsla",
    "BSLA",
    "bsra",
    "BSRA",
    "bsrl",
    "BSRL",
    "bsrf",
    "BSRF",
    "brlc",
    "BRLC",
  ];
  bsInsts.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} de,b`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "SimpleZ80Instruction").toBe(
        true
      );
      const instr = (parsed
        .assemblyLines[0] as unknown) as SimpleZ80Instruction;
      expect(instr.mnemonic).toBe(inst.toLowerCase());
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(9);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst} a,b`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0103").toBe(true);
    });

    it(`${inst} #3`, () => {
      const parser = createParser(`${inst} de*`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0003").toBe(true);
    });

    it(`${inst} #4`, () => {
      const parser = createParser(`${inst} de,hl`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0102").toBe(true);
    });
  });

  const testInst = ["test", "TEST"];
  testInst.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "TestInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as TestInstruction;
      expect(instr.expr.type === "IntegerLiteral").toBe(true);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(10);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(10);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(inst);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0111").toBe(true);
    });
  });

  const nextRegInst = ["nextreg", "NEXTREG"];
  nextRegInst.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #20, #10`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "NextRegInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as NextRegInstruction;
      expect(instr.operand1.operandType === OperandType.Expression).toBe(true);
      expect(instr.operand2.operandType === OperandType.Expression).toBe(true);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(16);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(16);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst} #20, a`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "NextRegInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as NextRegInstruction;
      expect(instr.operand1.operandType === OperandType.Expression).toBe(true);
      expect(instr.operand2.operandType === OperandType.Reg8).toBe(true);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(14);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(14);
    });

    it(`${inst} #3`, () => {
      const parser = createParser(inst);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0113").toBe(true);
    });
  });

  const mirrorInst = ["mirror", "MIRROR"];
  mirrorInst.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} A`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "SimpleZ80Instruction").toBe(true);
      const instr = parsed.assemblyLines[0] as unknown as SimpleZ80Instruction;
      expect(instr.mnemonic).toBe("mirror");
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(8);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(8);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(inst);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0101").toBe(true);
    });

    it(`${inst} #3`, () => {
      const parser = createParser(`${inst} HL`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0101").toBe(true);
    });
  });

  const mulInst = ["mul", "MUL"];
  mulInst.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} D,E`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "SimpleZ80Instruction").toBe(true);
      const instr = parsed.assemblyLines[0] as unknown as SimpleZ80Instruction;
      expect(instr.mnemonic).toBe("mul");
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(7);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(7);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(inst);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0104").toBe(true);
    });

    it(`${inst} #3`, () => {
      const parser = createParser(`${inst} D`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0003").toBe(true);
    });

    it(`${inst} #4`, () => {
      const parser = createParser(`${inst} D,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0105").toBe(true);
    });

    it(`${inst} #5`, () => {
      const parser = createParser(`${inst} D,A`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0105").toBe(true);
    });
  });
});

function createParser(source: string): Z80AsmParser {
  const is = new InputStream(source);
  const ts = new TokenStream(is);
  return new Z80AsmParser(ts);
}

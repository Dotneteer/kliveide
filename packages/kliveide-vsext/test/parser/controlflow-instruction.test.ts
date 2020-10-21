import "mocha";
import * as expect from "expect";

import {
  CallInstruction,
  DjnzInstruction,
  ImInstruction,
  JpInstruction,
  JrInstruction,
  OperandType,
  RetInstruction,
  RstInstruction,
  Z80AssemblyLine,
} from "../../src/z80lang/parser/tree-nodes";
import { InputStream } from "../../src/z80lang/parser/input-stream";
import { TokenStream } from "../../src/z80lang/parser/token-stream";
import { Z80AsmParser } from "../../src/z80lang/parser/z80-asm-parser";

describe("Parser - control flow instructions", () => {
  const djnzInsts = ["djnz", "DJNZ"];
  djnzInsts.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "DjnzInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as DjnzInstruction;
      expect(instr.target.operandType === OperandType.Expression).toBe(true);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(10);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(10);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst}`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1016").toBe(true);
    });
  });

  const rstInsts = ["rst", "RST"];
  rstInsts.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "RstInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as RstInstruction;
      expect(instr.target.operandType === OperandType.Expression).toBe(true);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(9);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst}`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1016").toBe(true);
    });
  });

  const imInsts = ["im", "IM"];
  imInsts.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "ImInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as ImInstruction;
      expect(instr.mode.operandType === OperandType.Expression).toBe(true);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(8);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(8);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst}`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1016").toBe(true);
    });
  });

  const jrInsts = ["jr", "JR"];
  jrInsts.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "JrInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as JrInstruction;
      expect(instr.operand2).toBeFalsy();
      expect(instr.operand1.operandType === OperandType.Expression).toBe(true);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(8);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(8);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst}`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1016").toBe(true);
    });

    it(`${inst} z #1`, () => {
      const parser = createParser(`${inst} z,#4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "JrInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as JrInstruction;
      expect(instr.operand1.register).toBe("z");
      expect(instr.operand2.operandType === OperandType.Expression).toBe(true);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(10);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(10);
    });

    it(`${inst} z #2`, () => {
      const parser = createParser(`${inst} z,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1016").toBe(true);
    });

    it(`${inst} nz #1`, () => {
      const parser = createParser(`${inst} nz,#4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "JrInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as JrInstruction;
      expect(instr.operand1.register).toBe("nz");
      expect(instr.operand2.operandType === OperandType.Expression).toBe(true);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(11);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(11);
    });

    it(`${inst} nz #2`, () => {
      const parser = createParser(`${inst} nz,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1016").toBe(true);
    });

    it(`${inst} c #1`, () => {
      const parser = createParser(`${inst} c,#4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "JrInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as JrInstruction;
      expect(instr.operand1.register).toBe("c");
      expect(instr.operand2.operandType === OperandType.Expression).toBe(true);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(10);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(10);
    });

    it(`${inst} c #2`, () => {
      const parser = createParser(`${inst} c,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1016").toBe(true);
    });

    it(`${inst} nc #1`, () => {
      const parser = createParser(`${inst} nc,#4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "JrInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as JrInstruction;
      expect(instr.operand1.register).toBe("nc");
      expect(instr.operand2.operandType === OperandType.Expression).toBe(true);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(11);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(11);
    });

    it(`${inst} nc #2`, () => {
      const parser = createParser(`${inst} nc,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1016").toBe(true);
    });
  });

  const jpInsts = ["jp", "JP"];
  jpInsts.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "JpInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as JpInstruction;
      expect(instr.operand2).toBeUndefined();
      expect(instr.operand1.operandType).toBe(OperandType.Expression);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(8);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(8);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst}`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1016").toBe(true);
    });

    it(`${inst} z #1`, () => {
      const parser = createParser(`${inst} z,#4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "JpInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as JpInstruction;
      expect(instr.operand1.register).toBe("z");
      expect(instr.operand2.operandType).toBe(OperandType.Expression);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(10);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(10);
    });

    it(`${inst} z #2`, () => {
      const parser = createParser(`${inst} z,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1016").toBe(true);
    });

    it(`${inst} nz #1`, () => {
      const parser = createParser(`${inst} nz,#4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "JpInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as JpInstruction;
      expect(instr.operand1.register).toBe("nz");
      expect(instr.operand2.operandType).toBe(OperandType.Expression);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(11);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(11);
    });

    it(`${inst} nz #2`, () => {
      const parser = createParser(`${inst} nz,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1016").toBe(true);
    });

    it(`${inst} c #1`, () => {
      const parser = createParser(`${inst} c,#4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "JpInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as JpInstruction;
      expect(instr.operand1.register).toBe("c");
      expect(instr.operand2.operandType).toBe(OperandType.Expression);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(10);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(10);
    });

    it(`${inst} c #2`, () => {
      const parser = createParser(`${inst} c,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1016").toBe(true);
    });

    it(`${inst} nc #1`, () => {
      const parser = createParser(`${inst} nc,#4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "JpInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as JpInstruction;
      expect(instr.operand1.register).toBe("nc");
      expect(instr.operand2.operandType).toBe(OperandType.Expression);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(11);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(11);
    });

    it(`${inst} nc #2`, () => {
      const parser = createParser(`${inst} nc,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1016").toBe(true);
    });

    it(`${inst} po #1`, () => {
      const parser = createParser(`${inst} po,#4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "JpInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as JpInstruction;
      expect(instr.operand1.register).toBe("po");
      expect(instr.operand2.operandType).toBe(OperandType.Expression);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(11);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(11);
    });

    it(`${inst} po #2`, () => {
      const parser = createParser(`${inst} po,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1016").toBe(true);
    });

    it(`${inst} pe #1`, () => {
      const parser = createParser(`${inst} pe,#4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "JpInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as JpInstruction;
      expect(instr.operand1.register).toBe("pe");
      expect(instr.operand2.operandType).toBe(OperandType.Expression);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(11);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(11);
    });

    it(`${inst} pe #2`, () => {
      const parser = createParser(`${inst} pe,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1016").toBe(true);
    });

    it(`${inst} m #1`, () => {
      const parser = createParser(`${inst} m,#4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "JpInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as JpInstruction;
      expect(instr.operand1.register).toBe("m");
      expect(instr.operand2.operandType).toBe(OperandType.Expression);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(10);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(10);
    });

    it(`${inst} m #2`, () => {
      const parser = createParser(`${inst} m,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1016").toBe(true);
    });

    it(`${inst} p #1`, () => {
      const parser = createParser(`${inst} p,#4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "JpInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as JpInstruction;
      expect(instr.operand1.register).toBe("p");
      expect(instr.operand2.operandType).toBe(OperandType.Expression);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(10);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(10);
    });
  });

  const callInsts = ["call", "CALL"];
  callInsts.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "CallInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as CallInstruction;
      expect(instr.operand2).toBeFalsy();
      expect(instr.operand1.operandType === OperandType.Expression).toBe(true);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(10);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(10);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst}`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1016").toBe(true);
    });

    it(`${inst} z #1`, () => {
      const parser = createParser(`${inst} z,#4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "CallInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as CallInstruction;
      expect(instr.operand1.register).toBe("z");
      expect(instr.operand2.operandType === OperandType.Expression).toBe(true);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(12);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(12);
    });

    it(`${inst} z #2`, () => {
      const parser = createParser(`${inst} z,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1016").toBe(true);
    });

    it(`${inst} nz #1`, () => {
      const parser = createParser(`${inst} nz,#4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "CallInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as CallInstruction;
      expect(instr.operand1.register).toBe("nz");
      expect(instr.operand2.operandType === OperandType.Expression).toBe(true);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(13);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(13);
    });

    it(`${inst} nz #2`, () => {
      const parser = createParser(`${inst} nz,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1016").toBe(true);
    });

    it(`${inst} c #1`, () => {
      const parser = createParser(`${inst} c,#4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "CallInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as CallInstruction;
      expect(instr.operand1.register).toBe("c");
      expect(instr.operand2.operandType === OperandType.Expression).toBe(true);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(12);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(12);
    });

    it(`${inst} c #2`, () => {
      const parser = createParser(`${inst} c,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1016").toBe(true);
    });

    it(`${inst} nc #1`, () => {
      const parser = createParser(`${inst} nc,#4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "CallInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as CallInstruction;
      expect(instr.operand1.register).toBe("nc");
      expect(instr.operand2.operandType === OperandType.Expression).toBe(true);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(13);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(13);
    });

    it(`${inst} nc #2`, () => {
      const parser = createParser(`${inst} nc,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1016").toBe(true);
    });

    it(`${inst} po #1`, () => {
      const parser = createParser(`${inst} po,#4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "CallInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as CallInstruction;
      expect(instr.operand1.register).toBe("po");
      expect(instr.operand2.operandType === OperandType.Expression).toBe(true);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(13);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(13);
    });

    it(`${inst} po #2`, () => {
      const parser = createParser(`${inst} po,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1016").toBe(true);
    });

    it(`${inst} pe #1`, () => {
      const parser = createParser(`${inst} pe,#4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "CallInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as CallInstruction;
      expect(instr.operand1.register).toBe("pe");
      expect(instr.operand2.operandType === OperandType.Expression).toBe(true);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(13);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(13);
    });

    it(`${inst} pe #2`, () => {
      const parser = createParser(`${inst} pe,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1016").toBe(true);
    });

    it(`${inst} m #1`, () => {
      const parser = createParser(`${inst} m,#4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "CallInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as CallInstruction;
      expect(instr.operand1.register).toBe("m");
      expect(instr.operand2.operandType === OperandType.Expression).toBe(true);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(12);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(12);
    });

    it(`${inst} m #2`, () => {
      const parser = createParser(`${inst} m,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1016").toBe(true);
    });

    it(`${inst} p #1`, () => {
      const parser = createParser(`${inst} p,#4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "CallInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as CallInstruction;
      expect(instr.operand1.register).toBe("p");
      expect(instr.operand2.operandType === OperandType.Expression).toBe(true);
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(12);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(12);
    });

    it(`${inst} p #2`, () => {
      const parser = createParser(`${inst} p,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1016").toBe(true);
    });
  });

  const retInsts = ["ret", "RET"];
  retInsts.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(inst);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "RetInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as RetInstruction;
      expect(instr.condition).toBeFalsy();
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(3);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(3);
    });

    it(`${inst} z #1`, () => {
      const parser = createParser(`${inst} z`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "RetInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as RetInstruction;
      expect(instr.condition?.register).toBe("z");
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(5);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(5);
    });

    it(`${inst} nz #1`, () => {
      const parser = createParser(`${inst} nz`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "RetInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as RetInstruction;
      expect(instr.condition?.register).toBe("nz");
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(6);
    });

    it(`${inst} c #1`, () => {
      const parser = createParser(`${inst} c`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "RetInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as RetInstruction;
      expect(instr.condition?.register).toBe("c");
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(5);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(5);
    });

    it(`${inst} nc #1`, () => {
      const parser = createParser(`${inst} nc`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "RetInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as RetInstruction;
      expect(instr.condition?.register).toBe("nc");
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(6);
    });

    it(`${inst} po #1`, () => {
      const parser = createParser(`${inst} po`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "RetInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as RetInstruction;
      expect(instr.condition?.register).toBe("po");
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(6);
    });

    it(`${inst} pe #1`, () => {
      const parser = createParser(`${inst} pe`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "RetInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as RetInstruction;
      expect(instr.condition?.register).toBe("pe");
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(6);
    });

    it(`${inst} m #1`, () => {
      const parser = createParser(`${inst} m`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "RetInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as RetInstruction;
      expect(instr.condition?.register).toBe("m");
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(5);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(5);
    });

    it(`${inst} p #1`, () => {
      const parser = createParser(`${inst} p`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "RetInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as RetInstruction;
      expect(instr.condition?.register).toBe("p");
      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(5);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(5);
    });
  });
});

function createParser(source: string): Z80AsmParser {
  const is = new InputStream(source);
  const ts = new TokenStream(is);
  return new Z80AsmParser(ts);
}

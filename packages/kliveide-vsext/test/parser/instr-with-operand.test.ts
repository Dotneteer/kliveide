import "mocha";
import * as expect from "expect";

import { InputStream } from "../../src/z80lang/parser/input-stream";
import { TokenStream } from "../../src/z80lang/parser/token-stream";
import { Z80AsmParser } from "../../src/z80lang/parser/z80-asm-parser";
import {
  AdcInstruction,
  AddInstruction,
  AndInstruction,
  BitInstruction,
  CpInstruction,
  DecInstruction,
  ExInstruction,
  IncInstruction,
  InInstruction,
  LdInstruction,
  OperandType,
  OrInstruction,
  OutInstruction,
  PopInstruction,
  PushInstruction,
  ResInstruction,
  RlcInstruction,
  RlInstruction,
  RrcInstruction,
  RrInstruction,
  SbcInstruction,
  SetInstruction,
  SlaInstruction,
  SllInstruction,
  SraInstruction,
  SrlInstruction,
  SubInstruction,
  XorInstruction,
  Z80AssemblyLine,
} from "../../src/z80lang/parser/tree-nodes";

describe("Parser - instructions with operands", () => {
  const incOp = ["inc", "INC"];
  incOp.forEach((inst) => {
    it(`${inst}`, () => {
      const parser = createParser(`${inst} #4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "IncInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as IncInstruction;

      const operand = instr.operand;
      expect(operand.operandType).toBe(OperandType.Expression);
      expect(operand.expr.type === "IntegerLiteral").toBe(true);

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 6);
    });
  });

  const decOp = ["dec", "DEC"];
  decOp.forEach((inst) => {
    it(`${inst}`, () => {
      const parser = createParser(`${inst} #4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "DecInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as DecInstruction;

      const operand = instr.operand;
      expect(operand.operandType).toBe(OperandType.Expression);
      expect(operand.expr.type === "IntegerLiteral").toBe(true);

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 6);
    });
  });

  const pushOp = ["push", "PUSH"];
  pushOp.forEach((inst) => {
    it(`${inst}`, () => {
      const parser = createParser(`${inst} #4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "PushInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as PushInstruction;

      const operand = instr.operand;
      expect(operand.operandType).toBe(OperandType.Expression);
      expect(operand.expr.type === "IntegerLiteral").toBe(true);

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 6);
    });
  });

  const popOp = ["pop", "POP"];
  popOp.forEach((inst) => {
    it(`${inst}`, () => {
      const parser = createParser(`${inst} #4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "PopInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as PopInstruction;

      const operand = instr.operand;
      expect(operand.operandType).toBe(OperandType.Expression);
      expect(operand.expr.type === "IntegerLiteral").toBe(true);

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 6);
    });
  });

  const ldOp = ["ld", "LD"];
  ldOp.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #4000,hl`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "LdInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as LdInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      const operand2 = instr.operand2;
      expect(operand2.operandType).toBe(OperandType.Reg16);
      expect(operand2.register).toBe("hl");

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 9);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst} #4000`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0003").toBe(true);
    });

    it(`${inst} #3`, () => {
      const parser = createParser(`${inst} #4000,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0113").toBe(true);
    });

  });

  const exOp = ["ex", "EX"];
  exOp.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #4000,hl`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "ExInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as ExInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      const operand2 = instr.operand2;
      expect(operand2.operandType).toBe(OperandType.Reg16);
      expect(operand2.register).toBe("hl");

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 9);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst} #4000`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0003").toBe(true);
    });

    it(`${inst} #3`, () => {
      const parser = createParser(`${inst} #4000,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0113").toBe(true);
    });

  });

  const addOp = ["add", "ADD"];
  addOp.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #4000,hl`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "AddInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as AddInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      const operand2 = instr.operand2;
      expect(operand2.operandType).toBe(OperandType.Reg16);
      expect(operand2.register).toBe("hl");

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 9);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst} #4000`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0003").toBe(true);
    });

    it(`${inst} #3`, () => {
      const parser = createParser(`${inst} #4000,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0113").toBe(true);
    });

  });

  const adcOp = ["adc", "ADC"];
  adcOp.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #4000,hl`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "AdcInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as AdcInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      const operand2 = instr.operand2;
      expect(operand2.operandType).toBe(OperandType.Reg16);
      expect(operand2.register).toBe("hl");

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 9);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst} #4000`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0003").toBe(true);
    });

    it(`${inst} #3`, () => {
      const parser = createParser(`${inst} #4000,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0113").toBe(true);
    });

  });

  const sbcOp = ["sbc", "SBC"];
  sbcOp.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #4000,hl`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "SbcInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as SbcInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      const operand2 = instr.operand2;
      expect(operand2.operandType).toBe(OperandType.Reg16);
      expect(operand2.register).toBe("hl");

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 9);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst} #4000`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0003").toBe(true);
    });

    it(`${inst} #3`, () => {
      const parser = createParser(`${inst} #4000,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0113").toBe(true);
    });

  });

  const bitOp = ["bit", "BIT"];
  bitOp.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #4000,hl`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "BitInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as BitInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      const operand2 = instr.operand2;
      expect(operand2.operandType).toBe(OperandType.Reg16);
      expect(operand2.register).toBe("hl");

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 9);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst} #4000`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0003").toBe(true);
    });

    it(`${inst} #3`, () => {
      const parser = createParser(`${inst} #4000,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0113").toBe(true);
    });

  });

  const subOp = ["sub", "SUB"];
  subOp.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #4000,hl`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "SubInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as SubInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      const operand2 = instr.operand2;
      expect(operand2.operandType).toBe(OperandType.Reg16);
      expect(operand2.register).toBe("hl");

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 9);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst} #4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "SubInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as SubInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      expect(instr.operand2).toBeUndefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 6);
    });

    it(`${inst} #3`, () => {
      const parser = createParser(`${inst} #4000,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0113").toBe(true);
    });

  });

  const andOp = ["and", "AND"];
  andOp.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #4000,hl`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "AndInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as AndInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      const operand2 = instr.operand2;
      expect(operand2.operandType).toBe(OperandType.Reg16);
      expect(operand2.register).toBe("hl");

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 9);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst} #4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "AndInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as AndInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      expect(instr.operand2).toBeUndefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 6);
    });

    it(`${inst} #3`, () => {
      const parser = createParser(`${inst} #4000,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0113").toBe(true);
    });

  });

  const xorOp = ["xor", "XOR"];
  xorOp.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #4000,hl`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "XorInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as XorInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      const operand2 = instr.operand2;
      expect(operand2.operandType).toBe(OperandType.Reg16);
      expect(operand2.register).toBe("hl");

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 9);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst} #4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "XorInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as XorInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      expect(instr.operand2).toBeUndefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 6);
    });

    it(`${inst} #3`, () => {
      const parser = createParser(`${inst} #4000,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0113").toBe(true);
    });

  });

  const orOp = ["or", "OR"];
  orOp.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #4000,hl`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "OrInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as OrInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      const operand2 = instr.operand2;
      expect(operand2.operandType).toBe(OperandType.Reg16);
      expect(operand2.register).toBe("hl");

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 9);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst} #4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "OrInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as OrInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      expect(instr.operand2).toBeUndefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 6);
    });

    it(`${inst} #3`, () => {
      const parser = createParser(`${inst} #4000,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0113").toBe(true);
    });

  });

  const cpOp = ["cp", "CP"];
  cpOp.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #4000,hl`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "CpInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as CpInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      const operand2 = instr.operand2;
      expect(operand2.operandType).toBe(OperandType.Reg16);
      expect(operand2.register).toBe("hl");

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 9);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst} #4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "CpInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as CpInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      expect(instr.operand2).toBeUndefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 6);
    });

    it(`${inst} #3`, () => {
      const parser = createParser(`${inst} #4000,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0113").toBe(true);
    });

  });

  const inOp = ["in", "IN"];
  inOp.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #4000,hl`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "InInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as InInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      const operand2 = instr.operand2;
      expect(operand2.operandType).toBe(OperandType.Reg16);
      expect(operand2.register).toBe("hl");

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 9);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst} #4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "InInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as InInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      expect(instr.operand2).toBeUndefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 6);
    });

    it(`${inst} #3`, () => {
      const parser = createParser(`${inst} #4000,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0113").toBe(true);
    });

  });

  const outOp = ["out", "OUT"];
  outOp.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #4000,hl`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "OutInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as OutInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      const operand2 = instr.operand2;
      expect(operand2.operandType).toBe(OperandType.Reg16);
      expect(operand2.register).toBe("hl");

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 9);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst} #4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "OutInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as OutInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      expect(instr.operand2).toBeUndefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 6);
    });

    it(`${inst} #3`, () => {
      const parser = createParser(`${inst} #4000,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0113").toBe(true);
    });

  });

  const rlcOp = ["rlc", "RLC"];
  rlcOp.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #4000,hl`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "RlcInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as RlcInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      const operand2 = instr.operand2;
      expect(operand2.operandType).toBe(OperandType.Reg16);
      expect(operand2.register).toBe("hl");

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 9);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst} #4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "RlcInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as RlcInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      expect(instr.operand2).toBeUndefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 6);
    });

    it(`${inst} #3`, () => {
      const parser = createParser(`${inst} #4000,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0113").toBe(true);
    });

  });

  const rrcOp = ["rrc", "RRC"];
  rrcOp.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #4000,hl`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "RrcInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as RrcInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      const operand2 = instr.operand2;
      expect(operand2.operandType).toBe(OperandType.Reg16);
      expect(operand2.register).toBe("hl");

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 9);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst} #4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "RrcInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as RrcInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      expect(instr.operand2).toBeUndefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 6);
    });

    it(`${inst} #3`, () => {
      const parser = createParser(`${inst} #4000,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0113").toBe(true);
    });

  });

  const rlOp = ["rl", "RL"];
  rlOp.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #4000,hl`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "RlInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as RlInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      const operand2 = instr.operand2;
      expect(operand2.operandType).toBe(OperandType.Reg16);
      expect(operand2.register).toBe("hl");

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 9);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst} #4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "RlInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as RlInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      expect(instr.operand2).toBeUndefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 6);
    });

    it(`${inst} #3`, () => {
      const parser = createParser(`${inst} #4000,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0113").toBe(true);
    });

  });

  const rrOp = ["rr", "RR"];
  rrOp.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #4000,hl`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "RrInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as RrInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      const operand2 = instr.operand2;
      expect(operand2.operandType).toBe(OperandType.Reg16);
      expect(operand2.register).toBe("hl");

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 9);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst} #4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "RrInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as RrInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      expect(instr.operand2).toBeUndefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 6);
    });

    it(`${inst} #3`, () => {
      const parser = createParser(`${inst} #4000,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0113").toBe(true);
    });

  });

  const slaOp = ["sla", "SLA"];
  slaOp.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #4000,hl`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "SlaInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as SlaInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      const operand2 = instr.operand2;
      expect(operand2.operandType).toBe(OperandType.Reg16);
      expect(operand2.register).toBe("hl");

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 9);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst} #4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "SlaInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as SlaInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      expect(instr.operand2).toBeUndefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 6);
    });

    it(`${inst} #3`, () => {
      const parser = createParser(`${inst} #4000,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0113").toBe(true);
    });

  });

  const sraOp = ["sra", "SRA"];
  sraOp.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #4000,hl`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "SraInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as SraInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      const operand2 = instr.operand2;
      expect(operand2.operandType).toBe(OperandType.Reg16);
      expect(operand2.register).toBe("hl");

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 9);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst} #4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "SraInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as SraInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      expect(instr.operand2).toBeUndefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 6);
    });

    it(`${inst} #3`, () => {
      const parser = createParser(`${inst} #4000,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0113").toBe(true);
    });

  });

  const sllOp = ["sll", "SLL"];
  sllOp.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #4000,hl`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "SllInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as SllInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      const operand2 = instr.operand2;
      expect(operand2.operandType).toBe(OperandType.Reg16);
      expect(operand2.register).toBe("hl");

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 9);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst} #4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "SllInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as SllInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      expect(instr.operand2).toBeUndefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 6);
    });

    it(`${inst} #3`, () => {
      const parser = createParser(`${inst} #4000,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0113").toBe(true);
    });

  });

  const srlOp = ["srl", "SRL"];
  srlOp.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #4000,hl`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "SrlInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as SrlInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      const operand2 = instr.operand2;
      expect(operand2.operandType).toBe(OperandType.Reg16);
      expect(operand2.register).toBe("hl");

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 9);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst} #4000`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "SrlInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as SrlInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      expect(instr.operand2).toBeUndefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 6);
    });

    it(`${inst} #3`, () => {
      const parser = createParser(`${inst} #4000,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0113").toBe(true);
    });

  });

  const resOp = ["res", "RES"];
  resOp.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #4000,hl,a`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "ResInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as ResInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      const operand2 = instr.operand2;
      expect(operand2.operandType).toBe(OperandType.Reg16);
      expect(operand2.register).toBe("hl");
      const operand3 = instr.operand3;
      expect(operand3.operandType).toBe(OperandType.Reg8);
      expect(operand3.register).toBe("a");

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 11);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 11);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst} #4000,hl`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "ResInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as ResInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      const operand2 = instr.operand2;
      expect(operand2.operandType).toBe(OperandType.Reg16);
      expect(operand2.register).toBe("hl");
      expect(instr.operand3).toBeUndefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 9);
    });

    it(`${inst} #3`, () => {
      const parser = createParser(`${inst} #4000,hl,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0113").toBe(true);
    });

    it(`${inst} #4`, () => {
      const parser = createParser(`${inst} #4000,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0113").toBe(true);
    });
  });

  const setOp = ["set", "SET"];
  setOp.forEach((inst) => {
    it(`${inst} #1`, () => {
      const parser = createParser(`${inst} #4000,hl,a`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "SetInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as SetInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      const operand2 = instr.operand2;
      expect(operand2.operandType).toBe(OperandType.Reg16);
      expect(operand2.register).toBe("hl");
      const operand3 = instr.operand3;
      expect(operand3.operandType).toBe(OperandType.Reg8);
      expect(operand3.register).toBe("a");

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 11);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 11);
    });

    it(`${inst} #2`, () => {
      const parser = createParser(`${inst} #4000,hl`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "SetInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as SetInstruction;

      const operand1 = instr.operand1;
      expect(operand1.operandType).toBe(OperandType.Expression);
      expect(operand1.expr.type === "IntegerLiteral").toBe(true);
      const operand2 = instr.operand2;
      expect(operand2.operandType).toBe(OperandType.Reg16);
      expect(operand2.register).toBe("hl");
      expect(instr.operand3).toBeUndefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(inst.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(inst.length + 9);
    });

    it(`${inst} #3`, () => {
      const parser = createParser(`${inst} #4000,hl,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0113").toBe(true);
    });

    it(`${inst} #4`, () => {
      const parser = createParser(`${inst} #4000,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0113").toBe(true);
    });
  });
});

function createParser(source: string): Z80AsmParser {
  const is = new InputStream(source);
  const ts = new TokenStream(is);
  return new Z80AsmParser(ts);
}

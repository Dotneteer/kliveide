import "mocha";
import * as expect from "expect";

import { InputStream } from "../../src/z80lang/parser/input-stream";
import { TokenStream } from "../../src/z80lang/parser/token-stream";
import { Z80AsmParser } from "../../src/z80lang/parser/z80-asm-parser";
import {
  IncInstruction,
  OperandType,
  Z80AssemblyLine,
} from "../../src/z80lang/parser/tree-nodes";

describe("Parser - operands", () => {
  const reg8Ops = [
    "a",
    "A",
    "b",
    "B",
    "c",
    "C",
    "d",
    "D",
    "e",
    "E",
    "h",
    "H",
    "l",
    "L",
  ];
  reg8Ops.forEach((opr) => {
    it(`reg8: ${opr} #1`, () => {
      const parser = createParser(`inc ${opr}`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "IncInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as IncInstruction;

      const operand = instr.operand;
      expect(operand.operandType).toBe(OperandType.Reg8);
      expect(operand.register).toBe(opr.toLowerCase());

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(5);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(5);
    });
  });

  const reg8SpecOps = ["i", "I", "r", "R"];
  reg8SpecOps.forEach((opr) => {
    it(`reg8Spec: ${opr} #1`, () => {
      const parser = createParser(`inc ${opr}`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "IncInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as IncInstruction;

      const operand = instr.operand;
      expect(operand.operandType).toBe(OperandType.Reg8Spec);
      expect(operand.register).toBe(opr.toLowerCase());

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(5);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(5);
    });
  });

  const reg8IdxOps = [
    "xl",
    "XL",
    "ixl",
    "IXL",
    "IXl",
    "xh",
    "XH",
    "ixh",
    "IXH",
    "IXh",
    "yl",
    "YL",
    "iyl",
    "IYL",
    "IYl",
    "yh",
    "YH",
    "iyh",
    "IYH",
    "IYh",
  ];
  reg8IdxOps.forEach((opr) => {
    it(`reg8Idx: ${opr} #1`, () => {
      const parser = createParser(`inc ${opr}`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "IncInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as IncInstruction;

      const operand = instr.operand;
      expect(operand.operandType).toBe(OperandType.Reg8Idx);
      expect(operand.register).toBe(opr.toLowerCase());

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(4 + opr.length);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(4 + opr.length);
    });
  });

  const reg16Ops = ["bc", "BC", "de", "DE", "hl", "HL", "sp", "SP"];
  reg16Ops.forEach((opr) => {
    it(`reg16: ${opr} #1`, () => {
      const parser = createParser(`inc ${opr}`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "IncInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as IncInstruction;

      const operand = instr.operand;
      expect(operand.operandType).toBe(OperandType.Reg16);
      expect(operand.register).toBe(opr.toLowerCase());

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(6);
    });
  });

  const reg16IdxOps = ["ix", "IX", "iy", "IY"];
  reg16IdxOps.forEach((opr) => {
    it(`reg16Idx: ${opr} #1`, () => {
      const parser = createParser(`inc ${opr}`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "IncInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as IncInstruction;

      const operand = instr.operand;
      expect(operand.operandType).toBe(OperandType.Reg16Idx);
      expect(operand.register).toBe(opr.toLowerCase());

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(6);
    });
  });

  const reg16SpecOps = ["af", "AF", "af'", "AF'"];
  reg16SpecOps.forEach((opr) => {
    it(`reg16Spec: ${opr} #1`, () => {
      const parser = createParser(`inc ${opr}`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "IncInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as IncInstruction;

      const operand = instr.operand;
      expect(operand.operandType).toBe(OperandType.Reg16Spec);
      expect(operand.register).toBe(opr.toLowerCase());

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(opr.length + 4);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(opr.length + 4);
    });
  });

  const cportOps = ["(c)", "(C)"];
  cportOps.forEach((opr) => {
    it(`cport: ${opr} #1`, () => {
      const parser = createParser(`inc ${opr}`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "IncInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as IncInstruction;

      const operand = instr.operand;
      expect(operand.operandType).toBe(OperandType.CPort);

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(opr.length + 4);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(opr.length + 4);
    });
  });

  const noneArgOps = ["$<none>$"];
  noneArgOps.forEach((opr) => {
    it(`nonearg: ${opr} #1`, () => {
      const parser = createParser(`inc ${opr}`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "IncInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as IncInstruction;

      const operand = instr.operand;
      expect(operand.operandType).toBe(OperandType.NoneArg);

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(opr.length + 4);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(opr.length + 4);
    });
  });

  const regIndirectOps = [
    "(bc)",
    "(BC)",
    "(de)",
    "(DE)",
    "(hl)",
    "(HL)",
    "(sp)",
    "(SP)",
  ];
  regIndirectOps.forEach((opr) => {
    it(`regindirect: ${opr} #1`, () => {
      const parser = createParser(`inc ${opr}`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "IncInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as IncInstruction;

      const operand = instr.operand;
      expect(operand.operandType).toBe(OperandType.RegIndirect);
      expect(operand.register).toBe(opr.substr(1, 2).toLowerCase());

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(opr.length + 4);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(opr.length + 4);
    });
  });

  const memIndirectOps = ["(#4000)", "(123)", "(myLabel)", "(123+myLabel)"];
  memIndirectOps.forEach((opr) => {
    it(`memindirect: ${opr} #1`, () => {
      const parser = createParser(`inc ${opr}`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "IncInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as IncInstruction;

      const operand = instr.operand;
      expect(operand.operandType).toBe(OperandType.MemIndirect);
      expect(operand.expr).toBeDefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(opr.length + 4);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(opr.length + 4);
    });
  });

  const exprOps = ["#4000", "123", "myLabel", "123+myLabel"];
  exprOps.forEach((opr) => {
    it(`expr ${opr} #1`, () => {
      const parser = createParser(`inc ${opr}`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "IncInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as IncInstruction;

      const operand = instr.operand;
      expect(operand.operandType).toBe(OperandType.Expression);
      expect(operand.expr).toBeDefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(opr.length + 4);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(opr.length + 4);
    });
  });

  const idxAddrOps = [
    { src: "(ix+123)", reg: "ix", sign: "+" },
    { src: "(IX+123)", reg: "ix", sign: "+" },
    { src: "(iy+123)", reg: "iy", sign: "+" },
    { src: "(IY+123)", reg: "iy", sign: "+" },
    { src: "(ix-123)", reg: "ix", sign: "-" },
    { src: "(IX-123)", reg: "ix", sign: "-" },
    { src: "(iy-123)", reg: "iy", sign: "-" },
    { src: "(IY-123)", reg: "iy", sign: "-" },
    { src: "(ix)", reg: "ix", sign: <string|undefined>undefined },
    { src: "(iy)", reg: "iy", sign: <string|undefined>undefined },
    { src: "(IX)", reg: "ix", sign: <string|undefined>undefined },
    { src: "(IY)", reg: "iy", sign: <string|undefined>undefined },
  ];
  idxAddrOps.forEach((opr) => {
    it(`indexedAddr ${opr.src} #1`, () => {
      const parser = createParser(`inc ${opr.src}`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "IncInstruction").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as IncInstruction;
      const operand = instr.operand;
      expect(operand.operandType).toBe(OperandType.IndexedIndirect);
      expect(operand.register).toBe(opr.reg.toLowerCase());
      expect(operand.offsetSign).toBe(opr.sign);
      if (opr.sign) {
        expect(operand.expr.type === "IntegerLiteral").toBe(true);
      } else {
        expect(operand.expr).toBeUndefined();
      }

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(opr.src.length + 4);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(opr.src.length + 4);
    });

    it(`indexedAddr ${opr.src} #2`, () => {
      const parser = createParser(`inc ${opr.src.substr(0, opr.src.length - 1)}`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0005").toBe(true);
    });

  });
});

function createParser(source: string): Z80AsmParser {
  const is = new InputStream(source);
  const ts = new TokenStream(is);
  return new Z80AsmParser(ts);
}

import "mocha";
import * as expect from "expect";

import { InputStream } from "../../src/parser/input-stream";
import { TokenStream } from "../../src/parser/token-stream";
import { Z80AsmParser } from "../../src/parser/z80-asm-parser";
import {
  BuiltInFunctionInvocation,
  ByteEmittingPragma,
  EquPragma,
  FieldAssignment,
  FunctionInvocation,
  MacroOrStructInvocation,
  Z80AssemblyLine,
} from "../../src/parser/tree-nodes";

describe("Parser - miscellaneous", () => {
  const fieldAsgs: { prg: string; type: ByteEmittingPragma["type"] }[] = [
    { prg: ".defb #10", type: "DefBPragma" },
    { prg: ".defw #10", type: "DefWPragma" },
    { prg: ".defm #10", type: "DefMPragma" },
    { prg: ".defn #10", type: "DefNPragma" },
    { prg: ".defh #10", type: "DefHPragma" },
    { prg: ".defs #10, ' '", type: "DefSPragma" },
    { prg: ".fillb #10, ' '", type: "FillbPragma" },
    { prg: ".fillw #10, ' '", type: "FillwPragma" },
    { prg: ".defgx #10", type: "DefGxPragma" },
    { prg: ".defg ....OOOO", type: "DefGPragma" },
  ];
  fieldAsgs.forEach((inp) => {
    it(`-> ${inp.prg}`, () => {
      const source = `-> ${inp.prg}`;
      const parser = createParser(source);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "FieldAssignment").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as FieldAssignment;
      expect(instr.assignment.type).toBe(inp.type);

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(source.length);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(source.length);
    });
  });

  it("-> (none)", () => {
    const parser = createParser("->");
    parser.parseProgram();
    expect(parser.hasErrors).toBe(true);
    expect(parser.errors[0].code === "Z1021").toBe(true);
  });

  it("macro invocation #1", () => {
    const source = "myMacro()";
    const parser = createParser(source);
    const parsed = parser.parseProgram();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.assemblyLines.length).toBe(1);
    expect(parsed.assemblyLines[0].type === "MacroOrStructInvocation").toBe(
      true
    );
    const instr = (parsed
      .assemblyLines[0] as unknown) as MacroOrStructInvocation;
    expect(instr.identifier).toBe("myMacro");
    expect(instr.operands.length).toBe(0);

    const line = parsed.assemblyLines[0] as Z80AssemblyLine;
    expect(line.label).toBe(null);
    expect(line.startPosition).toBe(0);
    expect(line.endPosition).toBe(source.length);
    expect(line.line).toBe(1);
    expect(line.startColumn).toBe(0);
    expect(line.endColumn).toBe(source.length);
  });

  it("macro invocation #2", () => {
    const source = "myMacro(abcd)";
    const parser = createParser(source);
    const parsed = parser.parseProgram();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.assemblyLines.length).toBe(1);
    expect(parsed.assemblyLines[0].type === "MacroOrStructInvocation").toBe(
      true
    );
    const instr = (parsed
      .assemblyLines[0] as unknown) as MacroOrStructInvocation;
    expect(instr.identifier).toBe("myMacro");
    expect(instr.operands.length).toBe(1);

    const line = parsed.assemblyLines[0] as Z80AssemblyLine;
    expect(line.label).toBe(null);
    expect(line.startPosition).toBe(0);
    expect(line.endPosition).toBe(source.length);
    expect(line.line).toBe(1);
    expect(line.startColumn).toBe(0);
    expect(line.endColumn).toBe(source.length);
  });

  it("macro invocation #3", () => {
    const source = "myMacro(abcd, #115)";
    const parser = createParser(source);
    const parsed = parser.parseProgram();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.assemblyLines.length).toBe(1);
    expect(parsed.assemblyLines[0].type === "MacroOrStructInvocation").toBe(
      true
    );
    const instr = (parsed
      .assemblyLines[0] as unknown) as MacroOrStructInvocation;
    expect(instr.identifier).toBe("myMacro");
    expect(instr.operands.length).toBe(2);

    const line = parsed.assemblyLines[0] as Z80AssemblyLine;
    expect(line.label).toBe(null);
    expect(line.startPosition).toBe(0);
    expect(line.endPosition).toBe(source.length);
    expect(line.line).toBe(1);
    expect(line.startColumn).toBe(0);
    expect(line.endColumn).toBe(source.length);
  });

  it("macro invocation #4", () => {
    const source = "myMacro(abcd, #115, {{param}})";
    const parser = createParser(source);
    const parsed = parser.parseProgram();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.assemblyLines.length).toBe(1);
    expect(parsed.assemblyLines[0].type === "MacroOrStructInvocation").toBe(
      true
    );
    const instr = (parsed
      .assemblyLines[0] as unknown) as MacroOrStructInvocation;
    expect(instr.identifier).toBe("myMacro");
    expect(instr.operands.length).toBe(3);

    const line = parsed.assemblyLines[0] as Z80AssemblyLine;
    expect(line.label).toBe(null);
    expect(line.startPosition).toBe(0);
    expect(line.endPosition).toBe(source.length);
    expect(line.line).toBe(1);
    expect(line.startColumn).toBe(0);
    expect(line.endColumn).toBe(source.length);
  });

  it("macro invocation #5", () => {
    const source = "myMacro(abcd,";
    const parser = createParser(source);
    parser.parseProgram();
    expect(parser.hasErrors).toBe(true);
    expect(parser.errors[0].code === "Z1016").toBe(true);
  });

  it("macro invocation #6", () => {
    const source = "myMacro(abcd";
    const parser = createParser(source);
    parser.parseProgram();
    expect(parser.hasErrors).toBe(true);
    expect(parser.errors[0].code === "Z1014").toBe(true);
  });

  const builtIns = [
    "def",
    "isreg8",
    "isreg8std",
    "isreg8spec",
    "isreg8idx",
    "isreg16",
    "isreg16std",
    "isreg16idx",
    "isregindirect",
    "iscport",
    "isindexedaddr",
    "iscondition",
    "isexpr",
    "isrega",
    "isregaf",
    "isregb",
    "isregc",
    "isregbc",
    "isregd",
    "isrege",
    "isregde",
    "isregh",
    "isregl",
    "isreghl",
    "isregi",
    "isregr",
    "isregxh",
    "isregxl",
    "isregix",
    "isregyh",
    "isregyl",
    "isregiy",
    "isregsp",
    "DEF",
    "ISREG8",
    "ISREG8STD",
    "ISREG8SPEC",
    "ISREG8IDX",
    "ISREG16",
    "ISREG16STD",
    "ISREG16IDX",
    "ISREGINDIRECT",
    "ISCPORT",
    "ISINDEXEDADDR",
    "ISCONDITION",
    "ISEXPR",
    "ISREGA",
    "ISREGAF",
    "ISREGB",
    "ISREGC",
    "ISREGBC",
    "ISREGD",
    "ISREGE",
    "ISREGDE",
    "ISREGH",
    "ISREGL",
    "ISREGHL",
    "ISREGI",
    "ISREGR",
    "ISREGXH",
    "ISREGXL",
    "ISREGIX",
    "ISREGYH",
    "ISREGYL",
    "ISREGIY",
    "ISREGSP",
  ];
  builtIns.forEach((func) => {
    it(`${func} #1`, () => {
      const source = `equ ${func}(arg)`;
      const parser = createParser(source);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "EquPragma").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as EquPragma;
      expect(instr.value.type === "BuiltInFunctionInvocation").toBe(true);
      const invocation = (instr.value as unknown) as BuiltInFunctionInvocation;
      expect(invocation.operand).toBeDefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(source.length);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(source.length);
    });
  });

  const mnemonics = [
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
    "ld",
    "inc",
    "dec",
    "ex",
    "add",
    "adc",
    "sub",
    "sbc",
    "and",
    "xor",
    "or",
    "cp",
    "djnz",
    "jr",
    "jp",
    "call",
    "ret",
    "rst",
    "push",
    "pop",
    "in",
    "out",
    "im",
    "rlc",
    "rrc",
    "rl",
    "rr",
    "sla",
    "sra",
    "sll",
    "srl",
    "bit",
    "res",
    "set",
    "ldix",
    "ldws",
    "ldirx",
    "lddx",
    "lddrx",
    "ldpirx",
    "outinb",
    "mul",
    "swapnib",
    "mirror",
    "nextreg",
    "pixeldn",
    "pixelad",
    "setae",
    "test",
    "bsla",
    "bsra",
    "bsrl",
    "bsrf",
    "brlc",
  ];

  mnemonics.forEach((mne) => {
    it(`textof ${mne}`, () => {
      const source = `equ textof(${mne})`;
      const parser = createParser(source);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "EquPragma").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as EquPragma;
      expect(instr.value.type === "BuiltInFunctionInvocation").toBe(true);
      const invocation = (instr.value as unknown) as BuiltInFunctionInvocation;
      expect(invocation.functionName).toBe("textof");
      expect(invocation.operand).toBeUndefined();
      expect(invocation.mnemonic).toBe(mne.toLowerCase());
      expect(invocation.regsOrConds).toBeUndefined();
      expect(invocation.macroParam).toBeUndefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(source.length);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(source.length);
    });

    it(`TEXTOF ${mne.toUpperCase()} #1`, () => {
      const source = `equ TEXTOF(${mne.toUpperCase()})`;
      const parser = createParser(source);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "EquPragma").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as EquPragma;
      expect(instr.value.type === "BuiltInFunctionInvocation").toBe(true);
      const invocation = (instr.value as unknown) as BuiltInFunctionInvocation;
      expect(invocation.functionName).toBe("textof");
      expect(invocation.operand).toBeUndefined();
      expect(invocation.mnemonic).toBe(mne.toLowerCase());
      expect(invocation.regsOrConds).toBeUndefined();
      expect(invocation.macroParam).toBeUndefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(source.length);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(source.length);
    });

    it(`ltextof ${mne}`, () => {
      const source = `equ ltextof(${mne})`;
      const parser = createParser(source);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "EquPragma").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as EquPragma;
      expect(instr.value.type === "BuiltInFunctionInvocation").toBe(true);
      const invocation = (instr.value as unknown) as BuiltInFunctionInvocation;
      expect(invocation.functionName).toBe("ltextof");
      expect(invocation.operand).toBeUndefined();
      expect(invocation.mnemonic).toBe(mne.toLowerCase());
      expect(invocation.regsOrConds).toBeUndefined();
      expect(invocation.macroParam).toBeUndefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(source.length);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(source.length);
    });

    it(`LTEXTOF ${mne.toUpperCase()} #1`, () => {
      const source = `equ LTEXTOF(${mne.toUpperCase()})`;
      const parser = createParser(source);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "EquPragma").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as EquPragma;
      expect(instr.value.type === "BuiltInFunctionInvocation").toBe(true);
      const invocation = (instr.value as unknown) as BuiltInFunctionInvocation;
      expect(invocation.functionName).toBe("ltextof");
      expect(invocation.operand).toBeUndefined();
      expect(invocation.mnemonic).toBe(mne.toLowerCase());
      expect(invocation.regsOrConds).toBeUndefined();
      expect(invocation.macroParam).toBeUndefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(source.length);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(source.length);
    });
  });

  const regsOrCons = [
    "a",
    "af",
    "af'",
    "b",
    "c",
    "bc",
    "d",
    "e",
    "de",
    "h",
    "l",
    "hl",
    "i",
    "r",
    "sp",
    "xh",
    "xl",
    "ix",
    "yh",
    "yl",
    "iy",
    "(bc)",
    "(de)",
    "(hl)",
    "(sp)",
    "z",
    "nz",
    "nc",
    "po",
    "pe",
    "m",
    "p",
  ];
  regsOrCons.forEach((reg) => {
    it(`textof ${reg}`, () => {
      const source = `equ textof(${reg})`;
      const parser = createParser(source);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "EquPragma").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as EquPragma;
      expect(instr.value.type === "BuiltInFunctionInvocation").toBe(true);
      const invocation = (instr.value as unknown) as BuiltInFunctionInvocation;
      expect(invocation.functionName).toBe("textof");
      expect(invocation.operand).toBeUndefined();
      expect(invocation.mnemonic).toBeUndefined();
      expect(invocation.regsOrConds).toBe(reg);
      expect(invocation.macroParam).toBeUndefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(source.length);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(source.length);
    });

    it(`TEXTOF ${reg.toUpperCase()} #1`, () => {
      const source = `equ TEXTOF(${reg.toUpperCase()})`;
      const parser = createParser(source);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "EquPragma").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as EquPragma;
      expect(instr.value.type === "BuiltInFunctionInvocation").toBe(true);
      const invocation = (instr.value as unknown) as BuiltInFunctionInvocation;
      expect(invocation.functionName).toBe("textof");
      expect(invocation.operand).toBeUndefined();
      expect(invocation.mnemonic).toBeUndefined();
      expect(invocation.regsOrConds).toBe(reg);
      expect(invocation.macroParam).toBeUndefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(source.length);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(source.length);
    });

    it(`ltextof ${reg}`, () => {
      const source = `equ ltextof(${reg})`;
      const parser = createParser(source);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "EquPragma").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as EquPragma;
      expect(instr.value.type === "BuiltInFunctionInvocation").toBe(true);
      const invocation = (instr.value as unknown) as BuiltInFunctionInvocation;
      expect(invocation.functionName).toBe("ltextof");
      expect(invocation.operand).toBeUndefined();
      expect(invocation.mnemonic).toBeUndefined();
      expect(invocation.regsOrConds).toBe(reg);
      expect(invocation.macroParam).toBeUndefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(source.length);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(source.length);
    });

    it(`LTEXTOF ${reg.toUpperCase()} #1`, () => {
      const source = `equ LTEXTOF(${reg.toUpperCase()})`;
      const parser = createParser(source);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "EquPragma").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as EquPragma;
      expect(instr.value.type === "BuiltInFunctionInvocation").toBe(true);
      const invocation = (instr.value as unknown) as BuiltInFunctionInvocation;
      expect(invocation.functionName).toBe("ltextof");
      expect(invocation.operand).toBeUndefined();
      expect(invocation.mnemonic).toBeUndefined();
      expect(invocation.regsOrConds).toBe(reg);
      expect(invocation.macroParam).toBeUndefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(source.length);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(source.length);
    });
  });

  it(`textof {{abc}}`, () => {
    const source = `equ textof({{abc}})`;
    const parser = createParser(source);
    const parsed = parser.parseProgram();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.assemblyLines.length).toBe(1);
    expect(parsed.assemblyLines[0].type === "EquPragma").toBe(true);
    const instr = (parsed.assemblyLines[0] as unknown) as EquPragma;
    expect(instr.value.type === "BuiltInFunctionInvocation").toBe(true);
    const invocation = (instr.value as unknown) as BuiltInFunctionInvocation;
    expect(invocation.functionName).toBe("textof");
    expect(invocation.operand).toBeUndefined();
    expect(invocation.mnemonic).toBeUndefined();
    expect(invocation.regsOrConds).toBeUndefined();
    expect(invocation.macroParam).toBe("abc");

    const line = parsed.assemblyLines[0] as Z80AssemblyLine;
    expect(line.label).toBe(null);
    expect(line.startPosition).toBe(0);
    expect(line.endPosition).toBe(source.length);
    expect(line.line).toBe(1);
    expect(line.startColumn).toBe(0);
    expect(line.endColumn).toBe(source.length);
  });

  it(`TEXTOF {{abc}}`, () => {
    const source = `equ TEXTOF({{abc}})`;
    const parser = createParser(source);
    const parsed = parser.parseProgram();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.assemblyLines.length).toBe(1);
    expect(parsed.assemblyLines[0].type === "EquPragma").toBe(true);
    const instr = (parsed.assemblyLines[0] as unknown) as EquPragma;
    expect(instr.value.type === "BuiltInFunctionInvocation").toBe(true);
    const invocation = (instr.value as unknown) as BuiltInFunctionInvocation;
    expect(invocation.functionName).toBe("textof");
    expect(invocation.operand).toBeUndefined();
    expect(invocation.mnemonic).toBeUndefined();
    expect(invocation.regsOrConds).toBeUndefined();
    expect(invocation.macroParam).toBe("abc");

    const line = parsed.assemblyLines[0] as Z80AssemblyLine;
    expect(line.label).toBe(null);
    expect(line.startPosition).toBe(0);
    expect(line.endPosition).toBe(source.length);
    expect(line.line).toBe(1);
    expect(line.startColumn).toBe(0);
    expect(line.endColumn).toBe(source.length);
  });

  it(`ltextof {{abc}}`, () => {
    const source = `equ ltextof({{abc}})`;
    const parser = createParser(source);
    const parsed = parser.parseProgram();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.assemblyLines.length).toBe(1);
    expect(parsed.assemblyLines[0].type === "EquPragma").toBe(true);
    const instr = (parsed.assemblyLines[0] as unknown) as EquPragma;
    expect(instr.value.type === "BuiltInFunctionInvocation").toBe(true);
    const invocation = (instr.value as unknown) as BuiltInFunctionInvocation;
    expect(invocation.functionName).toBe("ltextof");
    expect(invocation.operand).toBeUndefined();
    expect(invocation.mnemonic).toBeUndefined();
    expect(invocation.regsOrConds).toBeUndefined();
    expect(invocation.macroParam).toBe("abc");

    const line = parsed.assemblyLines[0] as Z80AssemblyLine;
    expect(line.label).toBe(null);
    expect(line.startPosition).toBe(0);
    expect(line.endPosition).toBe(source.length);
    expect(line.line).toBe(1);
    expect(line.startColumn).toBe(0);
    expect(line.endColumn).toBe(source.length);
  });

  it(`LTEXTOF {{abc}}`, () => {
    const source = `equ LTEXTOF({{abc}})`;
    const parser = createParser(source);
    const parsed = parser.parseProgram();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.assemblyLines.length).toBe(1);
    expect(parsed.assemblyLines[0].type === "EquPragma").toBe(true);
    const instr = (parsed.assemblyLines[0] as unknown) as EquPragma;
    expect(instr.value.type === "BuiltInFunctionInvocation").toBe(true);
    const invocation = (instr.value as unknown) as BuiltInFunctionInvocation;
    expect(invocation.functionName).toBe("ltextof");
    expect(invocation.operand).toBeUndefined();
    expect(invocation.mnemonic).toBeUndefined();
    expect(invocation.regsOrConds).toBeUndefined();
    expect(invocation.macroParam).toBe("abc");

    const line = parsed.assemblyLines[0] as Z80AssemblyLine;
    expect(line.label).toBe(null);
    expect(line.startPosition).toBe(0);
    expect(line.endPosition).toBe(source.length);
    expect(line.line).toBe(1);
    expect(line.startColumn).toBe(0);
    expect(line.endColumn).toBe(source.length);
  });

  it(`function invocation #1`, () => {
    const source = `equ myFunc()`;
    const parser = createParser(source);
    const parsed = parser.parseProgram();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.assemblyLines.length).toBe(1);
    expect(parsed.assemblyLines[0].type === "EquPragma").toBe(true);
    const instr = (parsed.assemblyLines[0] as unknown) as EquPragma;
    expect(instr.value.type === "FunctionInvocation").toBe(true);
    const invocation = (instr.value as unknown) as FunctionInvocation;
    expect(invocation.functionName).toBe("myFunc");
    expect(invocation.args.length).toBe(0);

    const line = parsed.assemblyLines[0] as Z80AssemblyLine;
    expect(line.label).toBe(null);
    expect(line.startPosition).toBe(0);
    expect(line.endPosition).toBe(source.length);
    expect(line.line).toBe(1);
    expect(line.startColumn).toBe(0);
    expect(line.endColumn).toBe(source.length);
  });

  it(`function invocation #2`, () => {
    const source = `equ myFunc(abc)`;
    const parser = createParser(source);
    const parsed = parser.parseProgram();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.assemblyLines.length).toBe(1);
    expect(parsed.assemblyLines[0].type === "EquPragma").toBe(true);
    const instr = (parsed.assemblyLines[0] as unknown) as EquPragma;
    expect(instr.value.type === "FunctionInvocation").toBe(true);
    const invocation = (instr.value as unknown) as FunctionInvocation;
    expect(invocation.functionName).toBe("myFunc");
    expect(invocation.args.length).toBe(1);

    const line = parsed.assemblyLines[0] as Z80AssemblyLine;
    expect(line.label).toBe(null);
    expect(line.startPosition).toBe(0);
    expect(line.endPosition).toBe(source.length);
    expect(line.line).toBe(1);
    expect(line.startColumn).toBe(0);
    expect(line.endColumn).toBe(source.length);
  });

  it(`function invocation #3`, () => {
    const source = `equ myFunc(abc, 123)`;
    const parser = createParser(source);
    const parsed = parser.parseProgram();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.assemblyLines.length).toBe(1);
    expect(parsed.assemblyLines[0].type === "EquPragma").toBe(true);
    const instr = (parsed.assemblyLines[0] as unknown) as EquPragma;
    expect(instr.value.type === "FunctionInvocation").toBe(true);
    const invocation = (instr.value as unknown) as FunctionInvocation;
    expect(invocation.functionName).toBe("myFunc");
    expect(invocation.args.length).toBe(2);

    const line = parsed.assemblyLines[0] as Z80AssemblyLine;
    expect(line.label).toBe(null);
    expect(line.startPosition).toBe(0);
    expect(line.endPosition).toBe(source.length);
    expect(line.line).toBe(1);
    expect(line.startColumn).toBe(0);
    expect(line.endColumn).toBe(source.length);
  });

});

function createParser(source: string): Z80AsmParser {
  const is = new InputStream(source);
  const ts = new TokenStream(is);
  return new Z80AsmParser(ts);
}

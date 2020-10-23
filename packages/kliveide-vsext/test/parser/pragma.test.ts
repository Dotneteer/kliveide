import "mocha";
import * as expect from "expect";

import { InputStream } from "../../src/z80lang/parser/input-stream";
import { TokenStream } from "../../src/z80lang/parser/token-stream";
import { Z80AsmParser } from "../../src/z80lang/parser/z80-asm-parser";
import {
  AlignPragma,
  BankPragma,
  CompareBinPragma,
  DefBPragma,
  DefCPragma,
  DefGPragma,
  DefGxPragma,
  DefHPragma,
  DefMPragma,
  DefNPragma,
  DefSPragma,
  DefWPragma,
  DispPragma,
  EntPragma,
  EquPragma,
  ErrorPragma,
  FillbPragma,
  FillwPragma,
  IncBinPragma,
  InjectOptPragma,
  ModelPragma,
  OrgPragma,
  RndSeedPragma,
  SkipPragma,
  TracePragma,
  VarPragma,
  XentPragma,
  XorgPragma,
  Z80AssemblyLine,
} from "../../src/z80lang/parser/tree-nodes";

describe("Parser - pragmas", () => {
  const orgPragmas = [".org", ".ORG", "org", "ORG"];
  orgPragmas.forEach((pragma) => {
    it(`${pragma} #1`, () => {
      const parser = createParser(pragma + " #4000");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "OrgPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as OrgPragma;
      expect(prg.address.type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 6);
    });

    it(`${pragma} #2`, () => {
      const parser = createParser(pragma);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });
  });

  const bankPragmas = [".bank", ".BANK", "bank", "BANK"];
  bankPragmas.forEach((pragma) => {
    it(`${pragma} #1`, () => {
      const parser = createParser(pragma + " #4000");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "BankPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as BankPragma;
      expect(prg.bankId.type === "IntegerLiteral").toBe(true);
      expect(prg.offset).toBe(null);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 6);
    });

    it(`${pragma} #2`, () => {
      const parser = createParser(pragma + " 3, #4000");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "BankPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as BankPragma;
      expect(prg.bankId.type === "IntegerLiteral").toBe(true);
      expect(prg.offset.type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 9);
    });

    it(`${pragma} #3`, () => {
      const parser = createParser(pragma + " #4000,");
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });
  });

  const xorgPragmas = [".xorg", ".XORG", "xorg", "XORG"];
  xorgPragmas.forEach((pragma) => {
    it(`${pragma} #1`, () => {
      const parser = createParser(pragma + " #4000");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "XorgPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as XorgPragma;
      expect(prg.address.type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 6);
    });

    it(`${pragma} #2`, () => {
      const parser = createParser(pragma);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });
  });

  const entPragmas = [".ent", ".ENT", "ent", "ENT"];
  entPragmas.forEach((pragma) => {
    it(`${pragma} #1`, () => {
      const parser = createParser(pragma + " #4000");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "EntPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as EntPragma;
      expect(prg.address.type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 6);
    });

    it(`${pragma} #2`, () => {
      const parser = createParser(pragma);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });
  });

  const xentPragmas = [".xent", ".XENT", "xent", "XENT"];
  xentPragmas.forEach((pragma) => {
    it(`${pragma} #1`, () => {
      const parser = createParser(pragma + " #4000");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "XentPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as XentPragma;
      expect(prg.address.type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 6);
    });

    it(`${pragma} #2`, () => {
      const parser = createParser(pragma);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });
  });

  const equPragmas = [".equ", ".EQU", "equ", "EQU"];
  equPragmas.forEach((pragma) => {
    it(`${pragma} #1`, () => {
      const parser = createParser(pragma + " #4000");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "EquPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as EquPragma;
      expect(prg.value.type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 6);
    });

    it(`${pragma} #2`, () => {
      const parser = createParser(pragma);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });
  });

  const varPragmas = ["=", ".var", ".VAR", "var", "VAR"];
  varPragmas.forEach((pragma) => {
    it(`${pragma} #1`, () => {
      const parser = createParser(pragma + " #4000");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "VarPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as VarPragma;
      expect(prg.value.type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 6);
    });

    it(`${pragma} #2`, () => {
      const parser = createParser(pragma);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });
  });

  const dispPragmas = [".disp", ".DISP", "disp", "DISP"];
  dispPragmas.forEach((pragma) => {
    it(`${pragma} #1`, () => {
      const parser = createParser(pragma + " #4000");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "DispPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as DispPragma;
      expect(prg.offset.type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 6);
    });

    it(`${pragma} #2`, () => {
      const parser = createParser(pragma);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });
  });

  const defcPragmas = [".defc", ".DEFC", "defc", "DEFC"];
  defcPragmas.forEach((pragma) => {
    it(`${pragma} #1`, () => {
      const parser = createParser(pragma + " #4000");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "DefCPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as DefCPragma;
      expect(prg.value.type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 6);
    });

    it(`${pragma} #2`, () => {
      const parser = createParser(pragma);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });
  });

  const defmPragmas = [".defm", ".DEFM", "defm", "DEFM"];
  defmPragmas.forEach((pragma) => {
    it(`${pragma} #1`, () => {
      const parser = createParser(pragma + " #4000");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "DefMPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as DefMPragma;
      expect(prg.value.type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 6);
    });

    it(`${pragma} #2`, () => {
      const parser = createParser(pragma);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });
  });

  const defnPragmas = [".defn", ".DEFN", "defn", "DEFN"];
  defnPragmas.forEach((pragma) => {
    it(`${pragma} #1`, () => {
      const parser = createParser(pragma + " #4000");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "DefNPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as DefNPragma;
      expect(prg.value.type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 6);
    });

    it(`${pragma} #2`, () => {
      const parser = createParser(pragma);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });
  });

  const defhPragmas = [".defh", ".DEFH", "defh", "DEFH"];
  defhPragmas.forEach((pragma) => {
    it(`${pragma} #1`, () => {
      const parser = createParser(pragma + " #4000");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "DefHPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as DefHPragma;
      expect(prg.value.type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 6);
    });

    it(`${pragma} #2`, () => {
      const parser = createParser(pragma);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });
  });

  const defgxPragmas = [".defgx", ".DEFGX", "defgx", "DEFGX"];
  defgxPragmas.forEach((pragma) => {
    it(`${pragma} #1`, () => {
      const parser = createParser(pragma + " #4000");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "DefGxPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as DefGxPragma;
      expect(prg.pattern.type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 6);
    });

    it(`${pragma} #2`, () => {
      const parser = createParser(pragma);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });
  });

  const errorPragmas = [".error", ".ERROR", "error", "ERROR"];
  errorPragmas.forEach((pragma) => {
    it(`${pragma} #1`, () => {
      const parser = createParser(pragma + " #4000");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "ErrorPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as ErrorPragma;
      expect(prg.message.type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 6);
    });

    it(`${pragma} #2`, () => {
      const parser = createParser(pragma);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });
  });

  const alignPragmas = [".align", ".ALIGN", "align", "ALIGN"];
  alignPragmas.forEach((pragma) => {
    it(`${pragma} #1`, () => {
      const parser = createParser(pragma + " #4000");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "AlignPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as AlignPragma;
      expect(prg.alignExpr.type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 6);
    });

    it(`${pragma} #2`, () => {
      const parser = createParser(pragma);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "AlignPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as AlignPragma;
      expect(prg.alignExpr).toBe(null);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length);
    });
  });

  const rndSeedPragmas = [".rndseed", ".RNDSEED", "rndseed", "RNDSEED"];
  rndSeedPragmas.forEach((pragma) => {
    it(`${pragma} #1`, () => {
      const parser = createParser(pragma + " #4000");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "RndSeedPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as RndSeedPragma;
      expect(prg.seedExpr.type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 6);
    });

    it(`${pragma} #2`, () => {
      const parser = createParser(pragma);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "RndSeedPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as RndSeedPragma;
      expect(prg.seedExpr).toBe(null);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length);
    });
  });

  const skipPragmas = [".skip", ".SKIP", "skip", "SKIP"];
  skipPragmas.forEach((pragma) => {
    it(`${pragma} #1`, () => {
      const parser = createParser(pragma + " #4000");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "SkipPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as SkipPragma;
      expect(prg.skip.type === "IntegerLiteral").toBe(true);
      expect(prg.fill).toBe(null);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 6);
    });

    it(`${pragma} #2`, () => {
      const parser = createParser(pragma + " 3, #4000");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "SkipPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as SkipPragma;
      expect(prg.skip.type === "IntegerLiteral").toBe(true);
      expect(prg.fill.type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 9);
    });

    it(`${pragma} #3`, () => {
      const parser = createParser(pragma + " #4000,");
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });
  });

  const defsPragmas = [".defs", ".DEFS", "defs", "DEFS"];
  defsPragmas.forEach((pragma) => {
    it(`${pragma} #1`, () => {
      const parser = createParser(pragma + " #4000");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "DefSPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as DefSPragma;
      expect(prg.count.type === "IntegerLiteral").toBe(true);
      expect(prg.fill).toBe(null);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 6);
    });

    it(`${pragma} #2`, () => {
      const parser = createParser(pragma + " 3, #4000");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "DefSPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as DefSPragma;
      expect(prg.count.type === "IntegerLiteral").toBe(true);
      expect(prg.fill.type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 9);
    });

    it(`${pragma} #3`, () => {
      const parser = createParser(pragma + " #4000,");
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });
  });

  const fillbPragmas = [".fillb", ".FILLB", "fillb", "FILLB"];
  fillbPragmas.forEach((pragma) => {
    it(`${pragma} #1`, () => {
      const parser = createParser(pragma + " #4000, 3");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "FillbPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as FillbPragma;
      expect(prg.count.type === "IntegerLiteral").toBe(true);
      expect(prg.fill.type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 9);
    });

    it(`${pragma} #2`, () => {
      const parser = createParser(pragma + " #4000");
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0003").toBe(true);
    });

    it(`${pragma} #3`, () => {
      const parser = createParser(pragma + " #4000,");
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });

    it(`${pragma} #4`, () => {
      const parser = createParser(pragma);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });
  });

  const fillwPragmas = [".fillw", ".FILLW", "fillw", "FILLW"];
  fillwPragmas.forEach((pragma) => {
    it(`${pragma} #1`, () => {
      const parser = createParser(pragma + " #4000, 3");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "FillwPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as FillwPragma;
      expect(prg.count.type === "IntegerLiteral").toBe(true);
      expect(prg.fill.type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 9);
    });

    it(`${pragma} #2`, () => {
      const parser = createParser(pragma + " #4000");
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0003").toBe(true);
    });

    it(`${pragma} #3`, () => {
      const parser = createParser(pragma + " #4000,");
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });

    it(`${pragma} #4`, () => {
      const parser = createParser(pragma);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });
  });

  const incBinPragmas = [
    ".includebin",
    ".INCLUDEBIN",
    "includebin",
    "INCLUDEBIN",
    ".include_bin",
    ".INCLUDE_BIN",
    "include_bin",
    "INCLUDE_BIN",
  ];
  incBinPragmas.forEach((pragma) => {
    it(`${pragma} #1`, () => {
      const parser = createParser(pragma + " #4000, 3, 8");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "IncBinPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as IncBinPragma;
      expect(prg.filename.type === "IntegerLiteral").toBe(true);
      expect(prg.offset.type === "IntegerLiteral").toBe(true);
      expect(prg.length.type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 12);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 12);
    });

    it(`${pragma} #2`, () => {
      const parser = createParser(pragma + " #4000, 3");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "IncBinPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as IncBinPragma;
      expect(prg.filename.type === "IntegerLiteral").toBe(true);
      expect(prg.offset.type === "IntegerLiteral").toBe(true);
      expect(prg.length).toBe(null);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 9);
    });

    it(`${pragma} #3`, () => {
      const parser = createParser(pragma + " #4000");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "IncBinPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as IncBinPragma;
      expect(prg.filename.type === "IntegerLiteral").toBe(true);
      expect(prg.offset).toBe(null);
      expect(prg.length).toBe(null);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 6);
    });

    it(`${pragma} #4`, () => {
      const parser = createParser(pragma + " #4000, 3,");
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });

    it(`${pragma} #5`, () => {
      const parser = createParser(pragma + " #4000,");
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });

    it(`${pragma} #6`, () => {
      const parser = createParser(pragma);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });
  });

  const compBinPragmas = [
    ".comparebin",
    ".COMPAREBIN",
    "comparebin",
    "COMPAREBIN",
  ];
  compBinPragmas.forEach((pragma) => {
    it(`${pragma} #1`, () => {
      const parser = createParser(pragma + " #4000, 3, 8");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "CompareBinPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as CompareBinPragma;
      expect(prg.filename.type === "IntegerLiteral").toBe(true);
      expect(prg.offset.type === "IntegerLiteral").toBe(true);
      expect(prg.length.type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 12);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 12);
    });

    it(`${pragma} #2`, () => {
      const parser = createParser(pragma + " #4000, 3");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "CompareBinPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as CompareBinPragma;
      expect(prg.filename.type === "IntegerLiteral").toBe(true);
      expect(prg.offset.type === "IntegerLiteral").toBe(true);
      expect(prg.length).toBe(null);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 9);
    });

    it(`${pragma} #3`, () => {
      const parser = createParser(pragma + " #4000");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "CompareBinPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as CompareBinPragma;
      expect(prg.filename.type === "IntegerLiteral").toBe(true);
      expect(prg.offset).toBe(null);
      expect(prg.length).toBe(null);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 6);
    });

    it(`${pragma} #4`, () => {
      const parser = createParser(pragma + " #4000, 3,");
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });

    it(`${pragma} #5`, () => {
      const parser = createParser(pragma + " #4000,");
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });

    it(`${pragma} #6`, () => {
      const parser = createParser(pragma);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });
  });

  const defbPragmas = [
    ".defb",
    ".DEFB",
    "defb",
    "DEFB",
    ".db",
    ".DB",
    "db",
    "DB",
  ];
  defbPragmas.forEach((pragma) => {
    it(`${pragma} #1`, () => {
      const parser = createParser(pragma + " #4000, 3, 8");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "DefBPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as DefBPragma;
      expect(prg.values.length).toBe(3);
      expect(prg.values[0].type === "IntegerLiteral").toBe(true);
      expect(prg.values[1].type === "IntegerLiteral").toBe(true);
      expect(prg.values[2].type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 12);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 12);
    });

    it(`${pragma} #2`, () => {
      const parser = createParser(pragma + " #4000, 3");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "DefBPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as DefBPragma;
      expect(prg.values.length).toBe(2);
      expect(prg.values[0].type === "IntegerLiteral").toBe(true);
      expect(prg.values[1].type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 9);
    });

    it(`${pragma} #3`, () => {
      const parser = createParser(pragma + " #4000");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "DefBPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as DefBPragma;
      expect(prg.values.length).toBe(1);
      expect(prg.values[0].type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 6);
    });

    it(`${pragma} #4`, () => {
      const parser = createParser(pragma + " #4000, 3,");
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });

    it(`${pragma} #5`, () => {
      const parser = createParser(pragma + " #4000,");
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });

    it(`${pragma} #6`, () => {
      const parser = createParser(pragma);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });
  });

  const defwPragmas = [
    ".defw",
    ".DEFW",
    "defw",
    "DEFW",
    ".dw",
    ".DW",
    "dw",
    "DW",
  ];
  defwPragmas.forEach((pragma) => {
    it(`${pragma} #1`, () => {
      const parser = createParser(pragma + " #4000, 3, 8");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "DefWPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as DefWPragma;
      expect(prg.values.length).toBe(3);
      expect(prg.values[0].type === "IntegerLiteral").toBe(true);
      expect(prg.values[1].type === "IntegerLiteral").toBe(true);
      expect(prg.values[2].type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 12);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 12);
    });

    it(`${pragma} #2`, () => {
      const parser = createParser(pragma + " #4000, 3");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "DefWPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as DefWPragma;
      expect(prg.values.length).toBe(2);
      expect(prg.values[0].type === "IntegerLiteral").toBe(true);
      expect(prg.values[1].type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 9);
    });

    it(`${pragma} #3`, () => {
      const parser = createParser(pragma + " #4000");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "DefWPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as DefWPragma;
      expect(prg.values.length).toBe(1);
      expect(prg.values[0].type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 6);
    });

    it(`${pragma} #4`, () => {
      const parser = createParser(pragma + " #4000, 3,");
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });

    it(`${pragma} #5`, () => {
      const parser = createParser(pragma + " #4000,");
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });

    it(`${pragma} #6`, () => {
      const parser = createParser(pragma);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });
  });


  const tracePragmas = [
    ".trace",
    ".TRACE",
    "trace",
    "TRACE"
  ];
  tracePragmas.forEach((pragma) => {
    it(`${pragma} #1`, () => {
      const parser = createParser(pragma + " #4000, 3, 8");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "TracePragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as TracePragma;
      expect(prg.isHex).toBe(false);
      expect(prg.values.length).toBe(3);
      expect(prg.values[0].type === "IntegerLiteral").toBe(true);
      expect(prg.values[1].type === "IntegerLiteral").toBe(true);
      expect(prg.values[2].type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 12);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 12);
    });

    it(`${pragma} #2`, () => {
      const parser = createParser(pragma + " #4000");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "TracePragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as TracePragma;
      expect(prg.isHex).toBe(false);
      expect(prg.values.length).toBe(1);
      expect(prg.values[0].type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 6);
    });

    it(`${pragma} #3`, () => {
      const parser = createParser(pragma + " #4000,");
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });

    it(`${pragma} #4`, () => {
      const parser = createParser(pragma);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });
  });

  const traceHexPragmas = [
    ".tracehex",
    ".TRACEHEX",
    "tracehex",
    "TRACEHEX"
  ];
  traceHexPragmas.forEach((pragma) => {
    it(`${pragma} #1`, () => {
      const parser = createParser(pragma + " #4000, 3, 8");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "TracePragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as TracePragma;
      expect(prg.isHex).toBe(true);
      expect(prg.values.length).toBe(3);
      expect(prg.values[0].type === "IntegerLiteral").toBe(true);
      expect(prg.values[1].type === "IntegerLiteral").toBe(true);
      expect(prg.values[2].type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 12);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 12);
    });

    it(`${pragma} #2`, () => {
      const parser = createParser(pragma + " #4000");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "TracePragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as TracePragma;
      expect(prg.isHex).toBe(true);
      expect(prg.values.length).toBe(1);
      expect(prg.values[0].type === "IntegerLiteral").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 6);
    });

    it(`${pragma} #3`, () => {
      const parser = createParser(pragma + " #4000,");
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });

    it(`${pragma} #4`, () => {
      const parser = createParser(pragma);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });
  });

  const modelPragmas = [
    ".model",
    ".MODEL",
    "model",
    "MODEL"
  ];
  modelPragmas.forEach((pragma) => {
    it(`${pragma} #1`, () => {
      const parser = createParser(pragma + " Spectrum48");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "ModelPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as ModelPragma;
      expect(prg.modelId).toBe("Spectrum48");
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 11);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 11);
    });

    it(`${pragma} #2`, () => {
      const parser = createParser(pragma + " next");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "ModelPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as ModelPragma;
      expect(prg.modelId).toBe("next");
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 5);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 5);
    });

    it(`${pragma} #3`, () => {
      const parser = createParser(pragma);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1004").toBe(true);
    });
  });

  const injectOptPragmas = [
    ".injectopt",
    ".INJECTOPT",
    "injectopt",
    "INJECTOPT"
  ];
  injectOptPragmas.forEach((pragma) => {
    it(`${pragma} #1`, () => {
      const parser = createParser(pragma + " option");
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "InjectOptPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as InjectOptPragma;
      expect(prg.identifier.name).toBe("option");
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length + 7);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length + 7);
    });

    it(`${pragma} #2`, () => {
      const parser = createParser(pragma);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1004").toBe(true);
    });
  });

  const externPragmas = [".extern", ".EXTERN", "extern", "EXTERN"];
  externPragmas.forEach((pragma) => {
    it(`${pragma} #1`, () => {
      const parser = createParser(pragma);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "ExternPragma").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length);
    });
  });

  const zxBasicPragmas = [".zxbasic", ".ZXBASIC", "zxbasic", "ZXBASIC"];
  zxBasicPragmas.forEach((pragma) => {
    it(`${pragma} #1`, () => {
      const parser = createParser(pragma);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "ZxBasicPragma").toBe(true);
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.length);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.length);
    });
  });

  const defgPragmas = [
    { source: ".defg .... OOOO", pattern: ".... OOOO"},
    { source: ".DEFG .... OOOO", pattern: ".... OOOO"},
    { source: "defg .... OOOO", pattern: ".... OOOO"},
    { source: "DEFG .... OOOO", pattern: ".... OOOO"},
    { source: ".dg .... OOOO", pattern: ".... OOOO"},
    { source: ".DG .... OOOO", pattern: ".... OOOO"},
    { source: "dg .... OOOO", pattern: ".... OOOO"},
    { source: "DG .... OOOO", pattern: ".... OOOO"},
    { source: ".dg ", pattern: ""},
    { source: ".DG ", pattern: ""},
    { source: "defg ", pattern: ""},
    { source: "DEFG ", pattern: ""},
    { source: ".dg ", pattern: ""},
    { source: ".DG ", pattern: ""},
    { source: "dg ", pattern: ""},
    { source: "DG ", pattern: ""},
  ];
  defgPragmas.forEach((pragma) => {
    it(`${pragma.source} #1`, () => {
      const parser = createParser(pragma.source);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines[0].type === "DefGPragma").toBe(true);
      const prg = (parsed.assemblyLines[0] as unknown) as DefGPragma;
      const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(pragma.source.length);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(pragma.source.length);
    });
  });

});

function createParser(source: string): Z80AsmParser {
  const is = new InputStream(source);
  const ts = new TokenStream(is);
  return new Z80AsmParser(ts);
}

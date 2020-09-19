import "mocha";
import * as expect from "expect";

import { InputStream } from "../../src/parser/input-stream";
import { TokenStream } from "../../src/parser/token-stream";
import { Z80AsmParser } from "../../src/parser/z80-asm-parser";
import {
  LoopEndStatement,
  LoopStatement,
  MacroEndStatement,
  MacroStatement,
  WhileStatement,
  Z80AssemblyLine,
} from "../../src/parser/tree-nodes";

describe("Parser - statements", () => {
  const macroStmt = [".macro", ".MACRO", "macro", "MACRO"];
  macroStmt.forEach((stmt) => {
    it(`${stmt} #1`, () => {
      const parser = createParser(`${stmt} ()`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "MacroStatement").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as MacroStatement;
      expect(instr.parameters.length).toBe(0);

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(stmt.length + 3);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(stmt.length + 3);
    });

    it(`${stmt} #2`, () => {
      const parser = createParser(`${stmt} (abc)`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "MacroStatement").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as MacroStatement;
      expect(instr.parameters.length).toBe(1);
      expect(instr.parameters[0]).toBe("abc");

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(stmt.length + 6);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(stmt.length + 6);
    });

    it(`${stmt} #3`, () => {
      const parser = createParser(`${stmt} (abc, cde)`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "MacroStatement").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as MacroStatement;
      expect(instr.parameters.length).toBe(2);
      expect(instr.parameters[0]).toBe("abc");
      expect(instr.parameters[1]).toBe("cde");

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(stmt.length + 11);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(stmt.length + 11);
    });

    it(`${stmt} #4`, () => {
      const parser = createParser(`${stmt} (abc, cde,hgi)`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "MacroStatement").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as MacroStatement;
      expect(instr.parameters.length).toBe(3);
      expect(instr.parameters[0]).toBe("abc");
      expect(instr.parameters[1]).toBe("cde");
      expect(instr.parameters[2]).toBe("hgi");

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(stmt.length + 15);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(stmt.length + 15);
    });

    it(`${stmt} #5`, () => {
      const parser = createParser(`${stmt} (abc,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1004").toBe(true);
    });

    it(`${stmt} #6`, () => {
      const parser = createParser(`${stmt} (abc`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1014").toBe(true);
    });

    it(`${stmt} #7`, () => {
      const parser = createParser(`${stmt} `);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1013").toBe(true);
    });
  });

  const endMacroStmt = [
    ".endm",
    ".ENDM",
    "endm",
    "ENDM",
    ".mend",
    ".MEND",
    "mend",
    "MEND",
  ];
  endMacroStmt.forEach((stmt) => {
    it(`${stmt} #1`, () => {
      const parser = createParser(`${stmt}`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "MacroEndStatement").toBe(true);

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(stmt.length);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(stmt.length);
    });
  });

  const loopStmt = [".loop", ".LOOP", "loop", "LOOP"];
  loopStmt.forEach((stmt) => {
    it(`${stmt} #1`, () => {
      const parser = createParser(`${stmt} #3`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "LoopStatement").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as LoopStatement;
      expect(instr.expr.type === "IntegerLiteral").toBe(true);

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(stmt.length + 3);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(stmt.length + 3);
    });

    it(`${stmt} #2`, () => {
      const parser = createParser(`${stmt}`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });
  });

  const endLoopStmt = [
    ".endl",
    ".ENDL",
    "endl",
    "ENDL",
    ".lend",
    ".LEND",
    "lend",
    "LEND",
  ];
  endLoopStmt.forEach((stmt) => {
    it(`${stmt} #1`, () => {
      const parser = createParser(`${stmt}`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "LoopEndStatement").toBe(true);

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(stmt.length);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(stmt.length);
    });
  });

  const whileStmt = [".while", ".WHILE", "while", "WHILE"];
  whileStmt.forEach((stmt) => {
    it(`${stmt} #1`, () => {
      const parser = createParser(`${stmt} #3`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "WhileStatement").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as WhileStatement;
      expect(instr.expr.type === "IntegerLiteral").toBe(true);

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(stmt.length + 3);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(stmt.length + 3);
    });

    it(`${stmt} #2`, () => {
      const parser = createParser(`${stmt}`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });
  });

  const endWhileStmt = [
    ".endw",
    ".ENDW",
    "endw",
    "ENDW",
    ".wend",
    ".WEND",
    "wend",
    "WEND",
  ];
  endWhileStmt.forEach((stmt) => {
    it(`${stmt} #1`, () => {
      const parser = createParser(`${stmt}`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "WhileEndStatement").toBe(true);

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(stmt.length);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(stmt.length);
    });
  });
});

function createParser(source: string): Z80AsmParser {
  const is = new InputStream(source);
  const ts = new TokenStream(is);
  return new Z80AsmParser(ts);
}

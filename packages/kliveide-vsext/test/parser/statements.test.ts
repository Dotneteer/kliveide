import "mocha";
import * as expect from "expect";

import { InputStream } from "../../src/z80lang/parser/input-stream";
import { TokenStream } from "../../src/z80lang/parser/token-stream";
import { Z80AsmParser } from "../../src/z80lang/parser/z80-asm-parser";
import {
  ElseIfStatement,
  ForStatement,
  IfNUsedStatement,
  IfStatement,
  IfUsedStatement,
  LocalStatement,
  LoopEndStatement,
  LoopStatement,
  MacroEndStatement,
  MacroStatement,
  ModuleStatement,
  UntilStatement,
  WhileStatement,
  Z80AssemblyLine,
} from "../../src/z80lang/parser/tree-nodes";

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
      expect(instr.parameters[0].name).toBe("abc");

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
      expect(instr.parameters[0].name).toBe("abc");
      expect(instr.parameters[1].name).toBe("cde");

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
      expect(instr.parameters[0].name).toBe("abc");
      expect(instr.parameters[1].name).toBe("cde");
      expect(instr.parameters[2].name).toBe("hgi");

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
      expect(parser.errors[0].code === "Z0005").toBe(true);
    });

    it(`${stmt} #7`, () => {
      const parser = createParser(`${stmt} `);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0004").toBe(true);
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

  const repeatStmt = [".repeat", ".REPEAT", "repeat", "REPEAT"];
  repeatStmt.forEach((stmt) => {
    it(`${stmt} #1`, () => {
      const parser = createParser(`${stmt}`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "RepeatStatement").toBe(true);

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(stmt.length);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(stmt.length);
    });
  });

  const untilStmt = [".until", ".UNTIL", "until", "UNTIL"];
  untilStmt.forEach((stmt) => {
    it(`${stmt} #1`, () => {
      const parser = createParser(`${stmt} #3`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "UntilStatement").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as UntilStatement;
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

  const procStmt = [".proc", ".PROC", "proc", "PROC"];
  procStmt.forEach((stmt) => {
    it(`${stmt} #1`, () => {
      const parser = createParser(`${stmt}`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "ProcStatement").toBe(true);

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(stmt.length);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(stmt.length);
    });
  });

  const endProcStmt = [
    ".endp",
    ".ENDP",
    "endp",
    "ENDP",
    ".pend",
    ".PEND",
    "pend",
    "PEND",
  ];
  endProcStmt.forEach((stmt) => {
    it(`${stmt} #1`, () => {
      const parser = createParser(`${stmt}`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "ProcEndStatement").toBe(true);

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(stmt.length);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(stmt.length);
    });
  });

  const ifStmt = [".if", ".IF", "if", "IF"];
  ifStmt.forEach((stmt) => {
    it(`${stmt} #1`, () => {
      const parser = createParser(`${stmt} #3`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "IfStatement").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as IfStatement;
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

  const ifUsedStmt = [".ifused", ".IFUSED", "ifused", "IFUSED"];
  ifUsedStmt.forEach((stmt) => {
    it(`${stmt} #1`, () => {
      const parser = createParser(`${stmt} abcq`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "IfUsedStatement").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as IfUsedStatement;
      expect(instr.symbol).toBeDefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(stmt.length + 5);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(stmt.length + 5);
    });

    it(`${stmt} #2`, () => {
      const parser = createParser(`${stmt}`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1004").toBe(true);
    });
  });

  const ifNUsedStmt = [".ifnused", ".IFNUSED", "ifnused", "IFNUSED"];
  ifNUsedStmt.forEach((stmt) => {
    it(`${stmt} #1`, () => {
      const parser = createParser(`${stmt} abcq`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "IfNUsedStatement").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as IfNUsedStatement;
      expect(instr.symbol).toBeDefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(stmt.length + 5);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(stmt.length + 5);
    });

    it(`${stmt} #2`, () => {
      const parser = createParser(`${stmt}`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1004").toBe(true);
    });
  });

  const elseStmt = [".else", ".ELSE", "else", "ELSE"];
  elseStmt.forEach((stmt) => {
    it(`${stmt} #1`, () => {
      const parser = createParser(`${stmt}`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "ElseStatement").toBe(true);

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(stmt.length);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(stmt.length);
    });
  });

  const endIfStmt = [".endif", ".ENDIF", "endif", "ENDIF"];
  endIfStmt.forEach((stmt) => {
    it(`${stmt} #1`, () => {
      const parser = createParser(`${stmt}`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "EndIfStatement").toBe(true);

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(stmt.length);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(stmt.length);
    });
  });

  const elseIfStmt = [".elif", ".ELIF", "elif", "ELIF"];
  elseIfStmt.forEach((stmt) => {
    it(`${stmt} #1`, () => {
      const parser = createParser(`${stmt} #3`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "ElseIfStatement").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as ElseIfStatement;
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

  const breakStmt = [".break", ".BREAK", "break", "BREAK"];
  breakStmt.forEach((stmt) => {
    it(`${stmt} #1`, () => {
      const parser = createParser(`${stmt}`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "BreakStatement").toBe(true);

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(stmt.length);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(stmt.length);
    });
  });

  const continueStmt = [".continue", ".CONTINUE", "continue", "CONTINUE"];
  continueStmt.forEach((stmt) => {
    it(`${stmt} #1`, () => {
      const parser = createParser(`${stmt}`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "ContinueStatement").toBe(true);

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(stmt.length);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(stmt.length);
    });
  });

  const moduleStmt = [
    ".module",
    ".MODULE",
    "module",
    "MODULE",
    ".scope",
    ".SCOPE",
    "scope",
    "SCOPE",
  ];
  moduleStmt.forEach((stmt) => {
    it(`${stmt} #1`, () => {
      const parser = createParser(`${stmt}`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "ModuleStatement").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as ModuleStatement;
      expect(instr.identifier).toBeUndefined;

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(stmt.length);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(stmt.length);
    });

    it(`${stmt} #2`, () => {
      const parser = createParser(`${stmt} myModule`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "ModuleStatement").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as ModuleStatement;
      expect(instr.identifier.name).toBe("myModule");

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(stmt.length + 9);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(stmt.length + 9);
    });
  });

  const endModuleStmt = [
    ".endmodule",
    ".ENDMODULE",
    "endmodule",
    "ENDMODULE",
    ".moduleend",
    ".MODULEEND",
    "moduleend",
    "MODULEEND",
    ".endscope",
    ".ENDSCOPE",
    "endscope",
    "ENDSCOPE",
    ".scopeend",
    ".SCOPEEND",
    "scopeend",
    "SCOPEEND",
  ];
  endModuleStmt.forEach((stmt) => {
    it(`${stmt} #1`, () => {
      const parser = createParser(`${stmt}`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "ModuleEndStatement").toBe(true);

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(stmt.length);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(stmt.length);
    });
  });

  const structStmt = [".struct", ".STRUCT", "struct", "STRUCT"];
  structStmt.forEach((stmt) => {
    it(`${stmt} #1`, () => {
      const parser = createParser(`${stmt}`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "StructStatement").toBe(true);

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(stmt.length);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(stmt.length);
    });
  });

  const endStructStmt = [".ends", ".ENDS", "ends", "ENDS"];
  endStructStmt.forEach((stmt) => {
    it(`${stmt} #1`, () => {
      const parser = createParser(`${stmt}`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "StructEndStatement").toBe(true);

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(stmt.length);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(stmt.length);
    });
  });

  const localStmt = [".local", ".LOCAL", "local", "LOCAL", "Local"];
  localStmt.forEach((stmt) => {
    it(`${stmt} #1`, () => {
      const parser = createParser(`${stmt} myId`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "LocalStatement").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as LocalStatement;
      expect(instr.identifiers.length).toBe(1);
      expect(instr.identifiers[0].name).toBe("myId");

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(stmt.length + 5);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(stmt.length + 5);
    });

    it(`${stmt} #2`, () => {
      const parser = createParser(`${stmt} myId, other`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "LocalStatement").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as LocalStatement;
      expect(instr.identifiers.length).toBe(2);
      expect(instr.identifiers[0].name).toBe("myId");
      expect(instr.identifiers[1].name).toBe("other");

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(stmt.length + 12);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(stmt.length + 12);
    });

    it(`${stmt} #3`, () => {
      const parser = createParser(`${stmt}`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1004").toBe(true);
    });

    it(`${stmt} #4`, () => {
      const parser = createParser(`${stmt} myId,`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1004").toBe(true);
    });
  });

  const forStmt = [".for", ".FOR", "for", "FOR"];
  forStmt.forEach((stmt) => {
    it(`${stmt} #1`, () => {
      const parser = createParser(`${stmt} abc = 1 to 2 step 3`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "ForStatement").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as ForStatement;
      expect(instr.identifier.name).toBe("abc");
      expect(instr.startExpr.type === "IntegerLiteral").toBe(true);
      expect(instr.toExpr.type === "IntegerLiteral").toBe(true);
      expect(instr.stepExpr.type === "IntegerLiteral").toBe(true);

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(stmt.length + 20);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(stmt.length + 20);
    });

    it(`${stmt} #2`, () => {
      const parser = createParser(`${stmt} abc = 1 to 2`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "ForStatement").toBe(true);
      const instr = (parsed.assemblyLines[0] as unknown) as ForStatement;
      expect(instr.identifier.name).toBe("abc");
      expect(instr.startExpr.type === "IntegerLiteral").toBe(true);
      expect(instr.toExpr.type === "IntegerLiteral").toBe(true);
      expect(instr.stepExpr).toBeUndefined();

      const line = parsed.assemblyLines[0] as Z80AssemblyLine;
      expect(line.label).toBe(null);
      expect(line.startPosition).toBe(0);
      expect(line.endPosition).toBe(stmt.length + 13);
      expect(line.line).toBe(1);
      expect(line.startColumn).toBe(0);
      expect(line.endColumn).toBe(stmt.length + 13);
    });

    it(`${stmt} #3`, () => {
      const parser = createParser(`${stmt}`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1004").toBe(true);
    });

    it(`${stmt} #4`, () => {
      const parser = createParser(`${stmt} abc`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0007").toBe(true);
    });

    it(`${stmt} #5`, () => {
      const parser = createParser(`${stmt} abc = `);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });

    it(`${stmt} #6`, () => {
      const parser = createParser(`${stmt} abc = 0`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z0008").toBe(true);
    });

    it(`${stmt} #7`, () => {
      const parser = createParser(`${stmt} abc = 0 to`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });

    it(`${stmt} #8`, () => {
      const parser = createParser(`${stmt} abc = 0 to 2 step`);
      parser.parseProgram();
      expect(parser.hasErrors).toBe(true);
      expect(parser.errors[0].code === "Z1003").toBe(true);
    });

  });

  const nextStmt = [".next", ".NEXT", "next", "NEXT"];
  nextStmt.forEach((stmt) => {
    it(`${stmt} #1`, () => {
      const parser = createParser(`${stmt}`);
      const parsed = parser.parseProgram();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.assemblyLines.length).toBe(1);
      expect(parsed.assemblyLines[0].type === "NextStatement").toBe(true);

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

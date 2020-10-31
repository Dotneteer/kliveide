import "mocha";
import * as expect from "expect";

import {
  DefineDirective,
  IfDefDirective,
  IfDirective,
  IfModDirective,
  IfNDefDirective,
  IfNModDirective,
  IncludeDirective,
  LineDirective,
  UndefDirective,
  Z80AssemblyLine,
} from "../../src/z80lang/parser/tree-nodes";
import { InputStream } from "../../src/z80lang/parser/input-stream";
import { TokenStream } from "../../src/z80lang/parser/token-stream";
import { Z80AsmParser } from "../../src/z80lang/parser/z80-asm-parser";

describe("Parser - directives", () => {
  it("#ifdef #1", () => {
    const parser = createParser("#ifdef myId");
    const parsed = parser.parseProgram();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.assemblyLines.length).toBe(1);
    expect(parsed.assemblyLines[0].type === "IfDefDirective").toBe(true);
    const dir = (parsed.assemblyLines[0] as unknown) as IfDefDirective;
    expect(dir.identifier.name).toBe("myId");
    const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
    expect(line.startPosition).toBe(0);
    expect(line.endPosition).toBe(11);
    expect(line.line).toBe(1);
    expect(line.startColumn).toBe(0);
    expect(line.endColumn).toBe(11);
  });

  it("#ifdef #2", () => {
    const parser = createParser("#ifdef");
    parser.parseProgram();
    expect(parser.hasErrors).toBe(true);
    expect(parser.errors[0].code === "Z0107").toBe(true);
  });

  it("#ifndef #1", () => {
    const parser = createParser("#ifndef myId");
    const parsed = parser.parseProgram();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.assemblyLines.length).toBe(1);
    expect(parsed.assemblyLines[0].type === "IfNDefDirective").toBe(true);
    const dir = (parsed.assemblyLines[0] as unknown) as IfNDefDirective;
    expect(dir.identifier.name).toBe("myId");
    const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
    expect(line.startPosition).toBe(0);
    expect(line.endPosition).toBe(12);
    expect(line.line).toBe(1);
    expect(line.startColumn).toBe(0);
    expect(line.endColumn).toBe(12);
  });

  it("#ifndef #2", () => {
    const parser = createParser("#ifndef");
    parser.parseProgram();
    expect(parser.hasErrors).toBe(true);
    expect(parser.errors[0].code === "Z0107").toBe(true);
  });

  it("#undef #1", () => {
    const parser = createParser("#undef myId");
    const parsed = parser.parseProgram();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.assemblyLines.length).toBe(1);
    expect(parsed.assemblyLines[0].type === "UndefDirective").toBe(true);
    const dir = (parsed.assemblyLines[0] as unknown) as UndefDirective;
    expect(dir.identifier.name).toBe("myId");
    const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
    expect(line.startPosition).toBe(0);
    expect(line.endPosition).toBe(11);
    expect(line.line).toBe(1);
    expect(line.startColumn).toBe(0);
    expect(line.endColumn).toBe(11);
  });

  it("#undef #2", () => {
    const parser = createParser("#undef");
    parser.parseProgram();
    expect(parser.hasErrors).toBe(true);
    expect(parser.errors[0].code === "Z0107").toBe(true);
  });

  it("#ifmod #1", () => {
    const parser = createParser("#ifmod myId");
    const parsed = parser.parseProgram();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.assemblyLines.length).toBe(1);
    expect(parsed.assemblyLines[0].type === "IfModDirective").toBe(true);
    const dir = (parsed.assemblyLines[0] as unknown) as IfModDirective;
    expect(dir.identifier.name).toBe("myId");
    const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
    expect(line.startPosition).toBe(0);
    expect(line.endPosition).toBe(11);
    expect(line.line).toBe(1);
    expect(line.startColumn).toBe(0);
    expect(line.endColumn).toBe(11);
  });

  it("#ifmod #2", () => {
    const parser = createParser("#ifmod");
    parser.parseProgram();
    expect(parser.hasErrors).toBe(true);
    expect(parser.errors[0].code === "Z0107").toBe(true);
  });

  it("#ifnmod #1", () => {
    const parser = createParser("#ifnmod myId");
    const parsed = parser.parseProgram();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.assemblyLines.length).toBe(1);
    expect(parsed.assemblyLines[0].type === "IfNModDirective").toBe(true);
    const dir = (parsed.assemblyLines[0] as unknown) as IfNModDirective;
    expect(dir.identifier.name).toBe("myId");
    const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
    expect(line.startPosition).toBe(0);
    expect(line.endPosition).toBe(12);
    expect(line.line).toBe(1);
    expect(line.startColumn).toBe(0);
    expect(line.endColumn).toBe(12);
  });

  it("#ifnmod #2", () => {
    const parser = createParser("#ifnmod");
    parser.parseProgram();
    expect(parser.hasErrors).toBe(true);
    expect(parser.errors[0].code === "Z0107").toBe(true);
  });

  it("#endif", () => {
    const parser = createParser("#endif");
    const parsed = parser.parseProgram();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.assemblyLines.length).toBe(1);
    expect(parsed.assemblyLines[0].type === "EndIfDirective").toBe(true);
    const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
    expect(line.startPosition).toBe(0);
    expect(line.endPosition).toBe(6);
    expect(line.line).toBe(1);
    expect(line.startColumn).toBe(0);
    expect(line.endColumn).toBe(6);
  });

  it("#else", () => {
    const parser = createParser("#else");
    const parsed = parser.parseProgram();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.assemblyLines.length).toBe(1);
    expect(parsed.assemblyLines[0].type === "ElseDirective").toBe(true);
    const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
    expect(line.startPosition).toBe(0);
    expect(line.endPosition).toBe(5);
    expect(line.line).toBe(1);
    expect(line.startColumn).toBe(0);
    expect(line.endColumn).toBe(5);
  });

  it("#if #1", () => {
    const parser = createParser("#if myId");
    const parsed = parser.parseProgram();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.assemblyLines.length).toBe(1);
    expect(parsed.assemblyLines[0].type === "IfDirective").toBe(true);
    const dir = (parsed.assemblyLines[0] as unknown) as IfDirective;
    expect(dir.condition.type === "Symbol").toBe(true);
    const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
    expect(line.startPosition).toBe(0);
    expect(line.endPosition).toBe(8);
    expect(line.line).toBe(1);
    expect(line.startColumn).toBe(0);
    expect(line.endColumn).toBe(8);
  });

  it("#if #2", () => {
    const parser = createParser("#if");
    parser.parseProgram();
    expect(parser.hasErrors).toBe(true);
    expect(parser.errors[0].code === "Z0111").toBe(true);
  });

  it("#line #1", () => {
    const parser = createParser('#line 123 "myComment"');
    const parsed = parser.parseProgram();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.assemblyLines.length).toBe(1);
    expect(parsed.assemblyLines[0].type === "LineDirective").toBe(true);
    const lineDir = (parsed.assemblyLines[0] as unknown) as LineDirective;
    expect(lineDir.lineNumber.type === "IntegerLiteral").toBe(true);
    expect(lineDir.filename).toBe("myComment");
    const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
    expect(line.startPosition).toBe(0);
    expect(line.endPosition).toBe(21);
    expect(line.line).toBe(1);
    expect(line.startColumn).toBe(0);
    expect(line.endColumn).toBe(21);
  });

  it("#line #2", () => {
    const parser = createParser("#line");
    parser.parseProgram();
    expect(parser.hasErrors).toBe(true);
    expect(parser.errors[0].code === "Z0111").toBe(true);
  });

  it("#line #3", () => {
    const parser = createParser("#line 123");
    const parsed = parser.parseProgram();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.assemblyLines.length).toBe(1);
    expect(parsed.assemblyLines[0].type === "LineDirective").toBe(true);
    const lineDir = (parsed.assemblyLines[0] as unknown) as LineDirective;
    expect(lineDir.lineNumber.type === "IntegerLiteral").toBe(true);
    expect(lineDir.filename).toBeNull();
    const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
    expect(line.startPosition).toBe(0);
    expect(line.endPosition).toBe(9);
    expect(line.line).toBe(1);
    expect(line.startColumn).toBe(0);
    expect(line.endColumn).toBe(9);
  });

  it("#line #4", () => {
    const parser = createParser("#line 123,");
    parser.parseProgram();
    expect(parser.hasErrors).toBe(true);
    expect(parser.errors[0].code === "Z0108").toBe(true);
  });

  it("#include #1", () => {
    const parser = createParser('#include "myFile.z80"');
    const parsed = parser.parseProgram();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.assemblyLines.length).toBe(1);
    expect(parsed.assemblyLines[0].type === "IncludeDirective").toBe(true);
    const lineDir = (parsed.assemblyLines[0] as unknown) as IncludeDirective;
    expect(lineDir.filename).toBe("myFile.z80");
    const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
    expect(line.startPosition).toBe(0);
    expect(line.endPosition).toBe(21);
    expect(line.line).toBe(1);
    expect(line.startColumn).toBe(0);
    expect(line.endColumn).toBe(21);
  });

  it("#include #2", () => {
    const parser = createParser("#include");
    parser.parseProgram();
    expect(parser.hasErrors).toBe(true);
    expect(parser.errors[0].code === "Z0108").toBe(true);
  });

  it("#define #1", () => {
    const parser = createParser("#define myId");
    const parsed = parser.parseProgram();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.assemblyLines.length).toBe(1);
    expect(parsed.assemblyLines[0].type === "DefineDirective").toBe(true);
    const dir = (parsed.assemblyLines[0] as unknown) as DefineDirective;
    expect(dir.identifier.name).toBe("myId");
    const line = (parsed.assemblyLines[0] as unknown) as Z80AssemblyLine;
    expect(line.startPosition).toBe(0);
    expect(line.endPosition).toBe(12);
    expect(line.line).toBe(1);
    expect(line.startColumn).toBe(0);
    expect(line.endColumn).toBe(12);
  });

  it("#define #2", () => {
    const parser = createParser("#define");
    parser.parseProgram();
    expect(parser.hasErrors).toBe(true);
    expect(parser.errors[0].code === "Z0107").toBe(true);
  });
});

function createParser(source: string): Z80AsmParser {
  const is = new InputStream(source);
  const ts = new TokenStream(is);
  return new Z80AsmParser(ts);
}

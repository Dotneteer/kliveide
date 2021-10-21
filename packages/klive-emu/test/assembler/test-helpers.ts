import "mocha";
import * as path from "path";
import * as expect from "expect";

import { Z80Assembler } from "../../src/main/z80-compiler/assembler";
import {
  AssemblerOptions,
  AssemblerOutput,
} from "../../src/main/z80-compiler/assembler-in-out";
import { SymbolValueMap } from "../../src/main/z80-compiler/assembler-types"
import { ErrorCodes } from "../../src/main/z80-compiler/assembler-errors";

export function testExpression(
  source: string,
  value: number | boolean | string | null,
  symbols?: SymbolValueMap
): void {
  const compiler = new Z80Assembler();
  const options = new AssemblerOptions();
  if (symbols) {
    options.predefinedSymbols = symbols;
  }

  const output = compiler.compile(`MySymbol .equ ${source}`, options);

  expect(output.errorCount).toBe(0);
  expect(output.segments.length).toBe(1);
  const symbol = output.getSymbol("MySymbol");
  expect(symbol).toBeDefined();
  if (!symbol) {
    return;
  }
  expect(symbol.value).toBeDefined();
  if (!symbol.value) {
    return;
  }

  if (value === null) {
    expect(symbol.value.isValid).toBe(false);
  } else {
    if (typeof value === "string") {
      expect(symbol.value.asString()).toBe(value);
    } else if (typeof value === "number") {
      if (Number.isInteger(value)) {
        expect(symbol.value.asLong()).toBe(value);
      } else {
        expect(symbol.value.asReal()).toBe(value);
      }
    } else {
      expect(symbol.value.value).toBe(value);
    }
  }
}

export function expressionFails(
  source: string,
  symbols?: SymbolValueMap,
  ...params: [ErrorCodes?, string?][]
): void {
  const compiler = new Z80Assembler();
  const options = new AssemblerOptions();
  if (symbols) {
    options.predefinedSymbols = symbols;
  }

  const output = compiler.compile(`MySymbol .equ ${source}`, options);

  if (params.length === 0) {
    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0606").toBe(true);
  } else {
    expect(output.errorCount).toBe(params.length);
    for (let i = 0; i < params.length; i++) {
      const entry = params[i];
      const code: ErrorCodes = entry[0] ?? "Z0606";
      expect(output.errors[i].errorCode === code).toBe(true);
      if (entry[1]) {
        expect(
          output.errors[i].message.indexOf(entry[1])
        ).toBeGreaterThanOrEqual(0);
      }
    }
  }
}

export function testCodeEmit(source: string, ...bytes: number[]): void {
  const compiler = new Z80Assembler();

  const output = compiler.compile(source);
  expect(output.errorCount).toBe(0);
  expect(output.segments.length).toBe(1);
  expect(output.segments[0].emittedCode.length).toBe(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    expect(output.segments[0].emittedCode[i]).toBe(bytes[i]);
  }
}

export function testCodeEmitWithOptions(
  source: string,
  options: AssemblerOptions,
  ...bytes: number[]
): void {
  const compiler = new Z80Assembler();

  const output = compiler.compile(source, options);
  expect(output.errorCount).toBe(0);
  expect(output.segments.length).toBe(1);
  expect(output.segments[0].emittedCode.length).toBe(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    expect(output.segments[0].emittedCode[i]).toBe(bytes[i]);
  }
}

export function codeRaisesError(source: string, ...code: ErrorCodes[]): void {
  const compiler = new Z80Assembler();

  const output = compiler.compile(source);
  expect(output.errorCount).toBe(code.length);
  for (let i = 0; i < code.length; i++) {
    expect(output.errors[i].errorCode === code[i]).toBe(true);
  }
}

export function codeRaisesErrorWithOptions(
  source: string,
  options: AssemblerOptions,
  code: ErrorCodes
): void {
  const compiler = new Z80Assembler();

  const output = compiler.compile(source, options);
  expect(output.errorCount).toBe(1);
  expect(output.errors[0].errorCode === code).toBe(true);
}

export function compileFileWorks(filename: string): AssemblerOutput {
  const output = compileFile(filename);
  expect(output.errorCount).toBe(0);
  return output;
}

export function compileFileFails(filename: string, code: ErrorCodes): void {
  const output = compileFile(filename);
  expect(output.errorCount).toBe(1);
  expect(output.errors[0].errorCode === code).toBe(true);
}

export function compileFile(filename: string): AssemblerOutput {
  const fullname = path.join(__dirname, "../testfiles", filename);
  const assembler = new Z80Assembler();
  return assembler.compileFile(fullname);
}

export function testCodeFileEmit(filename: string, ...bytes: number[]): void {
  const output = compileFile(filename);
  expect(output.errorCount).toBe(0);
  expect(output.segments.length).toBe(1);
  expect(output.segments[0].emittedCode.length).toBe(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    expect(output.segments[0].emittedCode[i]).toBe(bytes[i]);
  }
}

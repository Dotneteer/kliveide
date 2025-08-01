import path from "path";
import { expect } from "vitest";
import { Z80Assembler } from "@main/z80-compiler/assembler";
import {
  AssemblerOptions,
  AssemblerOutput
} from "@main/z80-compiler/assembler-in-out";
import { SymbolValueMap } from "@main/compiler-common/abstractions";
import { ErrorCodes } from "@main/compiler-common/assembler-errors";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";

export async function testExpression (
  source: string,
  value: number | boolean | string | null,
  symbols?: SymbolValueMap
): Promise<void> {
  const compiler = new Z80Assembler();
  const options = new AssemblerOptions();
  if (symbols) {
    options.predefinedSymbols = symbols;
  }

  const output = await compiler.compile(`MySymbol .equ ${source}`, options);

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

export async function expressionFails (
  source: string,
  symbols?: SymbolValueMap,
  ...params: [ErrorCodes?, string?][]
): Promise<void> {
  const compiler = new Z80Assembler();
  const options = new AssemblerOptions();
  if (symbols) {
    options.predefinedSymbols = symbols;
  }

  const output = await compiler.compile(`MySymbol .equ ${source}`, options);

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

export async function testCodeEmit (
  source: string,
  ...bytes: number[]
): Promise<void> {
  const compiler = new Z80Assembler();

  const output = await compiler.compile(source);
  expect(output.errorCount).toBe(0);
  expect(output.segments.length).toBe(1);
  expect(output.segments[0].emittedCode.length).toBe(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    expect(output.segments[0].emittedCode[i]).toBe(bytes[i]);
  }
}

export async function testFlexibleCodeEmit (
  source: string,
  ...bytes: number[]
): Promise<void> {
  const compiler = new Z80Assembler();

  const output = await compiler.compile(source, {
    predefinedSymbols: {},
    currentModel: SpectrumModelType.Spectrum48,
    useCaseSensitiveSymbols: true,
    maxLoopErrorsToReport: 100,
    flexibleDefPragmas: true
  });
  expect(output.errorCount).toBe(0);
  expect(output.segments.length).toBe(1);
  expect(output.segments[0].emittedCode.length).toBe(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    expect(output.segments[0].emittedCode[i]).toBe(bytes[i]);
  }
}

export async function testCodeEmitWithOptions (
  source: string,
  options: AssemblerOptions,
  ...bytes: number[]
): Promise<void> {
  const compiler = new Z80Assembler();

  const output = await compiler.compile(source, options);
  expect(output.errorCount).toBe(0);
  expect(output.segments.length).toBe(1);
  expect(output.segments[0].emittedCode.length).toBe(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    expect(output.segments[0].emittedCode[i]).toBe(bytes[i]);
  }
}

export async function codeRaisesError (
  source: string,
  ...code: ErrorCodes[]
): Promise<void> {
  const compiler = new Z80Assembler();

  const output = await compiler.compile(source);
  expect(output.errorCount).toBe(code.length);
  for (let i = 0; i < code.length; i++) {
    expect(output.errors[i].errorCode === code[i]).toBe(true);
  }
}

export async function codeRaisesErrorWithOptions (
  source: string,
  options: AssemblerOptions,
  code: ErrorCodes
): Promise<void> {
  const compiler = new Z80Assembler();

  const output = await compiler.compile(source, options);
  expect(output.errorCount).toBe(1);
  expect(output.errors[0].errorCode === code).toBe(true);
}

export async function compileFileWorks (
  filename: string
): Promise<AssemblerOutput> {
  const output = await compileFile(filename);
  expect(output.errorCount).toBe(0);
  return output;
}

export async function compileFileFails (
  filename: string,
  code: ErrorCodes
): Promise<void> {
  const output = await compileFile(filename);
  expect(output.errorCount).toBe(1);
  expect(output.errors[0].errorCode === code).toBe(true);
}

export async function compileFile (filename: string): Promise<AssemblerOutput> {
  const fullname = path.join(__dirname, "../testfiles", filename);
  const assembler = new Z80Assembler();
  return await assembler.compileFile(fullname);
}

export async function testCodeFileEmit (
  filename: string,
  ...bytes: number[]
): Promise<void> {
  const output = await compileFile(filename);
  expect(output.errorCount).toBe(0);
  expect(output.segments.length).toBe(1);
  expect(output.segments[0].emittedCode.length).toBe(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    expect(output.segments[0].emittedCode[i]).toBe(bytes[i]);
  }
}

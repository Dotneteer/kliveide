import "mocha";
import { expect } from "expect";
import { Z80Assembler } from "@main/z80-compiler/assembler";
import { AssemblerOptions } from "@main/z80-compiler/assembler-in-out";
import { ExpressionValue } from "@main/z80-compiler/expressions";
import { SpectrumModelType } from "@abstractions/IZ80CompilerService";

describe("Assembler - directives", async () => {
  it("No preproc does not change line", async () => {
    const compiler = new Z80Assembler();
    const source = `
      nop
      nop
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(3);
  });

  it("#define adds new conditional", async () => {
    const compiler = new Z80Assembler();
    const source = `
      nop
      #define MySymbol
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(2);
    expect(compiler.conditionSymbols["MySymbol"]).toBeDefined();
  });

  it("#define keeps existing conditional", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols["MySymbol"] = new ExpressionValue(true);
    const source = `
      nop
      #define MySymbol
      nop
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(2);
    options.predefinedSymbols["MySymbol"] = new ExpressionValue(true);
  });

  it("#undef removes existing conditional", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols["MySymbol"] = new ExpressionValue(true);
    const source = `
      nop
      #undef MySymbol
      nop
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(2);
    expect(compiler.conditionSymbols["MySymbol"]).toBeUndefined();
  });

  it("#undef keeps undefined conditional", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    const source = `
      nop
      #undef MySymbol
      nop
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(2);
    expect(compiler.conditionSymbols["MySymbol"]).toBeUndefined();
  });

  it("#ifdef true works without else branch", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols["MySymbol"] = new ExpressionValue(true);
    const source = `
      nop ; 1
      #ifdef MySymbol
      nop ; 2
      nop ; 3
      nop ; 4
      #endif
      nop ; 5
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("#ifdef false works without else branch", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    const source = `
      nop ; 1
      #ifdef MySymbol
      nop
      nop
      nop
      #endif
      nop ; 2
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(2);
  });

  it("#ifdef true works with else branch", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols["MySymbol"] = new ExpressionValue(true);
    const source = `
      nop ; 1
      #ifdef MySymbol
      nop ; 2
      nop ; 3
      nop ; 4
      #else
      nop
      nop
      #endif
      nop ; 5
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("#ifdef false works with else branch", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    const source = `
      nop ; 1
      #ifdef MySymbol
      nop
      nop
      nop
      #else
      nop ; 2
      nop ; 3
      #endif
      nop ; 4
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(4);
  });

  it("#ifndef true works without else branch", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    const source = `
      nop ; 1
      #ifndef MySymbol
      nop ; 2
      nop ; 3
      nop ; 4
      #endif
      nop ; 5
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("#ifndef false works without else branch", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols["MySymbol"] = new ExpressionValue(true);
    const source = `
      nop ; 1
      #ifndef MySymbol
      nop
      nop
      nop
      #endif
      nop ; 2
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(2);
  });

  it("#ifndef true works with else branch", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    const source = `
      nop ; 1
      #ifndef MySymbol
      nop ; 2
      nop ; 3
      nop ; 4
      #else
      nop
      nop
      #endif
      nop ; 5
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("#ifndef false works with else branch", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols["MySymbol"] = new ExpressionValue(true);
    const source = `
      nop ; 1
      #ifndef MySymbol
      nop
      nop
      nop
      #else
      nop ; 2
      nop ; 3
      #endif
      nop ; 4
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(4);
  });

  it("unexpected #else raises error", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    const source = `
      nop
      #else ; 1
      nop
      nop
      nop
      #else ; 2
      nop
      nop
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(2);
    expect(output.errors[0].errorCode === "Z0207").toBe(true);
    expect(output.errors[1].errorCode === "Z0207").toBe(true);
  });

  it("unexpected #endif raises error", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    const source = `
      nop
      #endif ; 1
      nop
      nop
      nop
      #endif ; 2
      nop
      nop
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(2);
    expect(output.errors[0].errorCode === "Z0208").toBe(true);
    expect(output.errors[1].errorCode === "Z0208").toBe(true);
  });

  it("nested #ifdef true-true works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols["MySymbol"] = new ExpressionValue(true);
    options.predefinedSymbols["MySymbol2"] = new ExpressionValue(true);
    const source = `
      #ifdef MySymbol
      nop ; 1
      nop ; 2
      #ifdef MySymbol2
      nop ; 3
      nop ; 4
      nop ; 5
      #endif
      nop ; 6
      nop ; 7
      nop ; 8
      nop ; 9
      #endif
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(9);
  });

  it("nested #ifdef true-false works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols["MySymbol"] = new ExpressionValue(true);
    const source = `
      #ifdef MySymbol
      nop ; 1
      nop ; 2
      #ifdef MySymbol2
      nop
      nop
      nop
      #endif
      nop ; 3
      nop ; 4
      nop ; 5
      nop ; 6
      #endif
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(6);
  });

  it("nested #ifdef false-true works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols["MySymbol2"] = new ExpressionValue(true);
    const source = `
      #ifdef MySymbol
      nop
      nop
      #ifdef MySymbol2
      nop
      nop
      nop
      #endif
      nop
      nop
      nop
      nop
      #endif
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(0);
  });

  it("nested #ifdef false-false works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    const source = `
      #ifdef MySymbol
      nop
      nop
      #ifdef MySymbol2
      nop
      nop
      nop
      #endif
      nop
      nop
      nop
      nop
      #endif
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(0);
  });

  it("nested #ifdef true-true-else-else works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols["MySymbol"] = new ExpressionValue(true);
    options.predefinedSymbols["MySymbol2"] = new ExpressionValue(true);
    const source = `
      #ifdef MySymbol
      nop ; 1
      #ifdef MySymbol2
      nop ; 2
      nop ; 3
      #else
      nop
      nop
      nop
      #endif
      nop ; 4
      nop ; 5
      nop ; 6
      nop ; 7
      #else
      nop
      nop
      nop
      nop
      nop
      #endif
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(7);
  });

  it("nested #ifdef true-true-else-no-else works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols["MySymbol"] = new ExpressionValue(true);
    options.predefinedSymbols["MySymbol2"] = new ExpressionValue(true);
    const source = `
      #ifdef MySymbol
      nop ; 1
      #ifdef MySymbol2
      nop ; 2
      nop ; 3
      #else
      nop
      nop
      nop
      #endif
      nop ; 4
      nop ; 5
      nop ; 6
      nop ; 7
      #endif
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(7);
  });

  it("nested #ifdef true-true-no-else-else works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols["MySymbol"] = new ExpressionValue(true);
    options.predefinedSymbols["MySymbol2"] = new ExpressionValue(true);
    const source = `
      #ifdef MySymbol
      nop ; 1
      #ifdef MySymbol2
      nop ; 2
      nop ; 3
      #else
      nop
      nop
      nop
      #endif
      nop ; 4
      nop ; 5
      nop ; 6
      nop ; 7
      #endif
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(7);
  });

  it("nested #ifdef true-false-else-else works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols["MySymbol"] = new ExpressionValue(true);
    const source = `
      #ifdef MySymbol
      nop ; 1
      #ifdef MySymbol2
      nop
      nop
      #else
      nop ; 2
      nop ; 3
      nop ; 4
      #endif
      nop ; 5
      nop ; 6
      nop ; 7
      nop ; 8
      #else
      nop
      nop
      nop
      nop
      nop
      #endif
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(8);
  });

  it("nested #ifdef true-false-else-no-else works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols["MySymbol"] = new ExpressionValue(true);
    const source = `
      #ifdef MySymbol
      nop ; 1
      #ifdef MySymbol2
      nop
      nop
      #endif
      nop ; 2
      nop ; 3
      nop ; 4
      nop ; 5
      #else
      nop
      nop
      nop
      nop
      nop
      #endif
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("nested #ifdef true-false-no-else-else works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols["MySymbol"] = new ExpressionValue(true);
    const source = `
      #ifdef MySymbol
      nop ; 1
      #ifdef MySymbol2
      nop
      nop
      #else
      nop ; 2
      nop ; 3
      nop ; 4
      #endif
      nop ; 5
      nop ; 6
      nop ; 7
      nop ; 8
      #endif
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(8);
  });

  it("nested #ifdef false-true-else-else works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols["MySymbol2"] = new ExpressionValue(true);
    const source = `
      #ifdef MySymbol
      nop
      #ifdef MySymbol2
      nop
      nop
      #else
      nop
      nop
      nop
      #endif
      nop
      nop
      nop
      nop
      #else
      nop ; 1
      nop ; 2
      nop ; 3
      nop ; 4
      nop ; 5
      #endif
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("nested #ifdef false-true-no-else-else works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols["MySymbol2"] = new ExpressionValue(true);
    const source = `
      #ifdef MySymbol
      nop
      #ifdef MySymbol2
      nop
      nop
      #else
      nop
      nop
      nop
      #endif
      nop
      nop
      nop
      nop
      #endif
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(0);
  });

  it("nested #ifdef false-true-else-no-else works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols["MySymbol2"] = new ExpressionValue(true);
    const source = `
      #ifdef MySymbol
      nop
      #ifdef MySymbol2
      nop
      nop
      #endif
      nop
      nop
      nop
      nop
      #else
      nop ; 1
      nop ; 2
      nop ; 3
      nop ; 4
      nop ; 5
      #endif
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("nested #ifdef false-false-else-else works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    const source = `
      #ifdef MySymbol
      nop
      #ifdef MySymbol2
      nop
      nop
      #else
      nop
      nop
      nop
      #endif
      nop
      nop
      nop
      nop
      #else
      nop ; 1
      nop ; 2
      nop ; 3
      nop ; 4
      nop ; 5
      #endif
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("nested #ifdef false-false-no-else-else works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    const source = `
      #ifdef MySymbol
      nop
      #ifdef MySymbol2
      nop
      nop
      #else
      nop
      nop
      nop
      #endif
      nop
      nop
      nop
      nop
      #endif
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(0);
  });

  it("nested #ifdef false-false-else-no-else works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    const source = `
      #ifdef MySymbol
      nop
      #ifdef MySymbol2
      nop
      nop
      #endif
      nop
      nop
      nop
      nop
      #else
      nop ; 1
      nop ; 2
      nop ; 3
      nop ; 4
      nop ; 5
      #endif
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("else-nested #ifdef true-true-else works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols["MySymbol"] = new ExpressionValue(true);
    options.predefinedSymbols["MySymbol2"] = new ExpressionValue(true);
    const source = `
      #ifdef MySymbol
      nop ; 1
      nop ; 2
      nop ; 3
      nop ; 4
      nop ; 5
      #else
      nop
      #ifdef MySymbol2
      nop
      nop
      #else
      nop
      nop
      nop
      #endif
      nop
      #endif
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("else-nested #ifdef true-true-no-else works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols["MySymbol"] = new ExpressionValue(true);
    options.predefinedSymbols["MySymbol2"] = new ExpressionValue(true);
    const source = `
      #ifdef MySymbol
      nop ; 1
      nop ; 2
      nop ; 3
      nop ; 4
      nop ; 5
      #else
      nop
      #ifdef MySymbol2
      nop
      nop
      #endif
      nop
      #endif
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("else-nested #ifdef true-false-else works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols["MySymbol"] = new ExpressionValue(true);
    options.predefinedSymbols["MySymbol2"] = new ExpressionValue(true);
    const source = `
      #ifdef MySymbol
      nop ; 1
      nop ; 2
      nop ; 3
      nop ; 4
      nop ; 5
      #else
      nop
      #ifdef MySymbol2
      nop
      nop
      #else
      nop
      nop
      nop
      #endif
      nop
      #endif
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("else-nested #ifdef true-false-no-else works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols["MySymbol"] = new ExpressionValue(true);
    options.predefinedSymbols["MySymbol2"] = new ExpressionValue(true);
    const source = `
      #ifdef MySymbol
      nop ; 1
      nop ; 2
      nop ; 3
      nop ; 4
      nop ; 5
      #else
      nop
      #ifdef MySymbol2
      nop
      nop
      #endif
      nop
      #endif
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("else-nested #ifdef false-true-else works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols["MySymbol2"] = new ExpressionValue(true);
    const source = `
      #ifdef MySymbol
      nop
      nop
      nop
      nop
      nop
      #else
      nop ; 1
      #ifdef MySymbol2
      nop ; 2
      nop ; 3
      #else
      nop
      nop
      nop
      #endif
      nop ; 4
      #endif
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(4);
  });

  it("else-nested #ifdef false-true-no-else works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols["MySymbol2"] = new ExpressionValue(true);
    const source = `
      #ifdef MySymbol
      nop
      nop
      nop
      nop
      nop
      #else
      nop ; 1
      #ifdef MySymbol2
      nop ; 2
      nop ; 3
      #endif
      nop ; 4
      #endif
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(4);
  });

  it("else-nested #ifdef false-false-else works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    const source = `
      #ifdef MySymbol
      nop
      nop
      nop
      nop
      nop
      #else
      nop ; 1
      #ifdef MySymbol2
      nop
      nop
      #else
      nop ; 2
      nop ; 3
      nop ; 4
      #endif
      nop ; 5
      #endif
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("else-nested #ifdef false-false-no-else works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    const source = `
      #ifdef MySymbol
      nop
      nop
      nop
      nop
      nop
      #else
      nop ; 1
      #ifdef MySymbol2
      nop
      nop
      #endif
      nop ; 2
      #endif
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(2);
  });

  it("#if true-no-else works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    const source = `
      nop ; 1
      #if 3 > 2
      nop ; 2
      nop ; 3
      nop ; 4
      #endif
      nop ; 5
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("#if false-no-else works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    const source = `
      nop ; 1
      #if 2 == 3
      nop
      nop
      nop
      #endif
      nop ; 2
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(2);
  });

  it("#if true-else works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    const source = `
      nop ; 1
      #if 6*8 != 49
      nop ; 2
      nop ; 3
      nop ; 4
      #else
      nop
      nop
      #endif
      nop ; 5
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("#if false-else works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    const source = `
      nop ; 1
      #if 34 <= 13
      nop
      nop
      nop
      #else
      nop ; 2
      nop ; 3
      #endif
      nop ; 4
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(4);
  });

  it("#ifmod true-no-else works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.currentModel = SpectrumModelType.Spectrum48;
    const source = `
      nop ; 1
      #ifmod Spectrum48
      nop ; 2
      nop ; 3
      nop ; 4
      #endif
      nop ; 5
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("#ifmod false-no-else works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.currentModel = SpectrumModelType.Spectrum128;
    const source = `
      nop ; 1
      #ifmod Spectrum48
      nop
      nop
      nop
      #endif
      nop ; 2
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(2);
  });

  it("#ifnmod false-no-else works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.currentModel = SpectrumModelType.Spectrum48;
    const source = `
      nop ; 1
      #ifnmod Spectrum48
      nop
      nop
      nop
      #endif
      nop ; 2
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(2);
  });

  it("#ifnmod true-no-else works", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.currentModel = SpectrumModelType.Spectrum128;
    const source = `
      nop ; 1
      #ifnmod Spectrum48
      nop ; 2
      nop ; 3
      nop ; 4
      #endif
      nop ; 5
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("#ifmod with invalid mode", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.currentModel = SpectrumModelType.Spectrum128;
    const source = `
      nop
      #ifmod unknown
      nop
      nop
      nop
      #endif
      nop
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0206").toBe(true);
  });

  it("#ifnmod with invalid mode", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.currentModel = SpectrumModelType.Spectrum128;
    const source = `
      nop
      #ifnmod unknown
      nop
      nop
      nop
      #endif
      nop
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0206").toBe(true);
  });

  it("#if false holds back an include", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    const source = `
      nop ; 1
      #if false
      nop
      nop
      #include "/dev/null"
      nop
      #endif
      nop ; 2
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(2);
  });

  it("#if true-else holds back an include", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    const source = `
      nop ; 1
      #if true
      nop ; 2
      nop ; 3
      #else
      #include "/dev/null"
      nop
      #endif
      nop ; 4
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(4);
  });
});

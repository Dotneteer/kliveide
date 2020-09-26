import "mocha";
import * as expect from "expect";

import { Z80Assembler } from "../../src/z80lang/assembler/assembler";
import { AssemblerOptions } from "../../src/z80lang/assembler/assembler-in-out";

describe("Assembler - directives", () => {
  it("No preproc does not change line", () => {
    const compiler = new Z80Assembler();
    const source = `
      nop
      nop
      nop
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(3);
  });

  it("#define adds new conditional", () => {
    const compiler = new Z80Assembler();
    const source = `
      nop
      #define MySymbol
      nop
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(2);
    expect(compiler.conditionSymbols.has("MySymbol")).toBe(true);
  });

  it("#define keeps existing conditional", () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols.push("MySymbol");
    const source = `
      nop
      #define MySymbol
      nop
    `;

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(2);
    expect(compiler.conditionSymbols.has("MySymbol")).toBe(true);
  });

  it("#undef removes existing conditional", () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols.push("MySymbol");
    const source = `
      nop
      #undef MySymbol
      nop
    `;

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(2);
    expect(compiler.conditionSymbols.has("MySymbol")).toBe(false);
  });

  it("#undef keeps undefined conditional", () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    const source = `
      nop
      #undef MySymbol
      nop
    `;

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(2);
    expect(compiler.conditionSymbols.has("MySymbol")).toBe(false);
  });

  it("#ifdef true works without else branch", () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols.push("MySymbol");
    const source = `
      nop ; 1
      #ifdef MySymbol
      nop ; 2
      nop ; 3
      nop ; 4
      #endif
      nop ; 5
    `;

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("#ifdef false works without else branch", () => {
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(2);
  });

  it("#ifdef true works with else branch", () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols.push("MySymbol");
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("#ifdef false works with else branch", () => {
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(4);
  });

  it("#ifndef true works without else branch", () => {
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("#ifndef false works without else branch", () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols.push("MySymbol");
    const source = `
      nop ; 1
      #ifndef MySymbol
      nop
      nop
      nop
      #endif
      nop ; 2
    `;

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(2);
  });

  it("#ifndef true works with else branch", () => {
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("#ifndef false works with else branch", () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols.push("MySymbol");
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(4);
  });

  it("unexpected #else raises error", () => {
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(2);
    expect(output.errors[0].errorCode === "Z2009").toBe(true);
    expect(output.errors[1].errorCode === "Z2009").toBe(true);
  });

  it("unexpected #endif raises error", () => {
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(2);
    expect(output.errors[0].errorCode === "Z2010").toBe(true);
    expect(output.errors[1].errorCode === "Z2010").toBe(true);
  });

  it("nested #ifdef true-true works", () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols.push("MySymbol");
    options.predefinedSymbols.push("MySymbol2");
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(9);
  });

  it("nested #ifdef true-false works", () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols.push("MySymbol");
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(6);
  });

  it("nested #ifdef false-true works", () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols.push("MySymbol2");
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(0);
  });

  it("nested #ifdef false-false works", () => {
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(0);
  });

  it("nested #ifdef true-true-else-else works", () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols.push("MySymbol");
    options.predefinedSymbols.push("MySymbol2");
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(7);
  });

  it("nested #ifdef true-true-else-no-else works", () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols.push("MySymbol");
    options.predefinedSymbols.push("MySymbol2");
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(7);
  });

  it("nested #ifdef true-true-no-else-else works", () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols.push("MySymbol");
    options.predefinedSymbols.push("MySymbol2");
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(7);
  });

  it("nested #ifdef true-false-else-else works", () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols.push("MySymbol");
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(8);
  });

  it("nested #ifdef true-false-else-no-else works", () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols.push("MySymbol");
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("nested #ifdef true-false-no-else-else works", () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols.push("MySymbol");
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(8);
  });

  it("nested #ifdef false-true-else-else works", () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols.push("MySymbol2");
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("nested #ifdef false-true-no-else-else works", () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols.push("MySymbol2");
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(0);
  });

  it("nested #ifdef false-true-else-no-else works", () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols.push("MySymbol2");
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("nested #ifdef false-false-else-else works", () => {
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("nested #ifdef false-false-no-else-else works", () => {
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(0);
  });

  it("nested #ifdef false-false-else-no-else works", () => {
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("else-nested #ifdef true-true-else works", () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols.push("MySymbol");
    options.predefinedSymbols.push("MySymbol2");
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("else-nested #ifdef true-true-no-else works", () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols.push("MySymbol");
    options.predefinedSymbols.push("MySymbol2");
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("else-nested #ifdef true-false-else works", () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols.push("MySymbol");
    options.predefinedSymbols.push("MySymbol2");
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("else-nested #ifdef true-false-no-else works", () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols.push("MySymbol");
    options.predefinedSymbols.push("MySymbol2");
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("else-nested #ifdef false-true-else works", () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols.push("MySymbol2");
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(4);
  });

  it("else-nested #ifdef false-true-no-else works", () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.predefinedSymbols.push("MySymbol2");
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(4);
  });

  it("else-nested #ifdef false-false-else works", () => {
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(5);
  });

  it("else-nested #ifdef false-false-no-else works", () => {
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

    const output = compiler.compile(source, options);

    expect(output.errorCount).toBe(0);
    expect(compiler.preprocessedLines.length).toBe(2);
  });

});

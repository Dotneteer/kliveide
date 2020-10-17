import "mocha";
import * as expect from "expect";

import { compileFileFails, compileFileWorks } from "./test-helpers";
import { IncludeDirective, Node } from "../../src/z80lang/parser/tree-nodes";

describe("Assembler - .includebin", () => {
  it("works with existing binary file", () => {
    const output = compileFileWorks("IncludeBinExists.z80asm");
    const code = output.segments[0].emittedCode;
    expect(code.length).toBe(0x4000);
    expect(code[0]).toBe(0xf3);
  });

  it("fails with non-existing file", () => {
    compileFileFails("IncludeBinNotExists.z80asm", "Z2038");
  });

  it("works with zero offset", () => {
    const output = compileFileWorks("IncludeBinWithZeroOffset.z80asm");
    const code = output.segments[0].emittedCode;
    expect(code.length).toBe(0x4000);
    expect(code[0]).toBe(0xf3);
  });

  it("works with non-zero offset", () => {
    const output = compileFileWorks("IncludeBinWithNonZeroOffset.z80asm");
    const code = output.segments[0].emittedCode;
    expect(code.length).toBe(0x3000);
    expect(code[0]).toBe(0x6d);
  });

  it("works with zero offset and length", () => {
    const output = compileFileWorks("IncludeBinWithZeroOffsetAndLength.z80asm");
    const code = output.segments[0].emittedCode;
    expect(code.length).toBe(0x1800);
    expect(code[0]).toBe(0xf3);
  });

  it("works with non-zero offset and length", () => {
    const output = compileFileWorks(
      "IncludeBinWithNonZeroOffsetAndLength.z80asm"
    );
    const code = output.segments[0].emittedCode;
    expect(code.length).toBe(0x1800);
    expect(code[0]).toBe(0x6d);
  });

  it("fails with negative offset", () => {
    compileFileFails("IncludeBinWithNegativeOffset.z80asm", "Z2036");
  });

  it("fails with too long offset", () => {
    compileFileFails("IncludeBinWithTooLongOffset.z80asm", "Z2036");
  });

  it("works with tight offset", () => {
    const output = compileFileWorks("IncludeBinWithTightOffset.z80asm");
    const code = output.segments[0].emittedCode;
    expect(code.length).toBe(0x01);
    expect(code[0]).toBe(0x3c);
  });

  it("fails with negative length", () => {
    compileFileFails("IncludeBinWithNegativeLength.z80asm", "Z2037");
  });

  it("fails with too long segment", () => {
    compileFileFails("IncludeBinWithTooLongSegment.z80asm", "Z2037");
  });

  it("works with tight segment", () => {
    const output = compileFileWorks("IncludeBinWithTightSegment.z80asm");
    const code = output.segments[0].emittedCode;
    expect(code.length).toBe(0x2000);
    expect(code[0]).toBe(0x0d);
  });
});

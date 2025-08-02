import { describe, it, expect } from "vitest";
import { compileFileFails, compileFileWorks } from "./test-helpers";

describe("Assembler - .includebin", async () => {
  it("works with existing binary file", async () => {
    const output = await compileFileWorks("IncludeBinExists.z80asm");
    const code = output.segments[0].emittedCode;
    expect(code.length).toBe(0x4000);
    expect(code[0]).toBe(0xf3);
  });

  it("fails with non-existing file", async () => {
    compileFileFails("IncludeBinNotExists.z80asm", "Z0322");
  });

  it("works with zero offset", async () => {
    const output = await compileFileWorks("IncludeBinWithZeroOffset.z80asm");
    const code = output.segments[0].emittedCode;
    expect(code.length).toBe(0x4000);
    expect(code[0]).toBe(0xf3);
  });

  it("works with non-zero offset", async () => {
    const output = await compileFileWorks("IncludeBinWithNonZeroOffset.z80asm");
    const code = output.segments[0].emittedCode;
    expect(code.length).toBe(0x3000);
    expect(code[0]).toBe(0x6d);
  });

  it("works with zero offset and length", async () => {
    const output = await compileFileWorks("IncludeBinWithZeroOffsetAndLength.z80asm");
    const code = output.segments[0].emittedCode;
    expect(code.length).toBe(0x1800);
    expect(code[0]).toBe(0xf3);
  });

  it("works with non-zero offset and length", async () => {
    const output = await compileFileWorks("IncludeBinWithNonZeroOffsetAndLength.z80asm");
    const code = output.segments[0].emittedCode;
    expect(code.length).toBe(0x1800);
    expect(code[0]).toBe(0x6d);
  });

  it("fails with negative offset", async () => {
    compileFileFails("IncludeBinWithNegativeOffset.z80asm", "Z0320");
  });

  it("fails with too long offset", async () => {
    compileFileFails("IncludeBinWithTooLongOffset.z80asm", "Z0320");
  });

  it("works with tight offset", async () => {
    const output = await compileFileWorks("IncludeBinWithTightOffset.z80asm");
    const code = output.segments[0].emittedCode;
    expect(code.length).toBe(0x01);
    expect(code[0]).toBe(0x3c);
  });

  it("fails with negative length", async () => {
    compileFileFails("IncludeBinWithNegativeLength.z80asm", "Z0321");
  });

  it("fails with too long segment", async () => {
    compileFileFails("IncludeBinWithTooLongSegment.z80asm", "Z0321");
  });

  it("works with tight segment", async () => {
    const output = await compileFileWorks("IncludeBinWithTightSegment.z80asm");
    const code = output.segments[0].emittedCode;
    expect(code.length).toBe(0x2000);
    expect(code[0]).toBe(0x0d);
  });

  it("Regression #1", async () => {
    const output = await compileFileWorks("Regression1.z80asm");
    let code = output.segments[0].emittedCode;
    expect(code.length).toBe(0x0001);
    expect(code[0]).toBe(0xaf);
    code = output.segments[1].emittedCode;
    expect(code.length).toBe(14536);
    expect(code[0]).toBe(0x01);
    expect(code[14535]).toBe(0xc8);
  });
});

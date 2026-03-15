import { describe, it, expect } from "vitest";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";

// Regression tests for error line number reporting.
// Previously, "Operand expected" errors were reported on the NEXT line
// (line N+1) instead of the line with the incomplete instruction (line N),
// because the tokenizer advanced input._line when look-ahead-consuming \n.
describe("Assembler - error line number reporting", () => {
  it("ld with no operands: error reported on ld line when next line has a comment", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile("ld\n; comment\nxor a");
    expect(output.errors.length).toBeGreaterThan(0);
    expect(output.errors[0].errorCode).toBe("Z0113");
    expect(output.errors[0].line).toBe(1);
  });

  it("ld with no operands: error reported on ld line when next line is empty", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile("ld\n\nxor a");
    expect(output.errors.length).toBeGreaterThan(0);
    expect(output.errors[0].errorCode).toBe("Z0113");
    expect(output.errors[0].line).toBe(1);
  });

  it("ld with no operands: error reported on ld line when ld is last line", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile("nop\nld");
    expect(output.errors.length).toBeGreaterThan(0);
    expect(output.errors[0].errorCode).toBe("Z0113");
    expect(output.errors[0].line).toBe(2);
  });

  it("add with no operands: error reported on add line, not next line", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile("add\n; comment");
    expect(output.errors.length).toBeGreaterThan(0);
    expect(output.errors[0].errorCode).toBe("Z0113");
    expect(output.errors[0].line).toBe(1);
  });
});

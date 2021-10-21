import "mocha";

import { compileFileFails, compileFileWorks } from "./test-helpers";

describe("Assembler - .comparebin", () => {
  it("works with existing binary file", () => {
    compileFileWorks("CompareBinExists.z80asm");
  });

  it("fails with non-existing file", () => {
    compileFileFails("CompareBinNotExists.z80asm", "Z0329");
  });

  it("works with zero offset", () => {
    compileFileWorks("CompareBinWithZeroOffset.z80asm");
  });

  it("works with non-zero offset", () => {
    compileFileWorks("CompareBinWithNonZeroOffset.z80asm");
  });

  it("works with zero offset and length", () => {
    compileFileWorks("CompareBinWithZeroOffsetAndLength.z80asm");
  });

  it("works with non-zero offset and length", () => {
    compileFileWorks("CompareBinWithNonZeroOffsetAndLength.z80asm");
  });

  it("fails with negative offset", () => {
    compileFileFails("CompareBinWithNegativeOffset.z80asm", "Z0327");
  });

  it("fails with too long offset", () => {
    compileFileFails("CompareBinWithTooLongOffset.z80asm", "Z0327");
  });

  it("works with tight offset", () => {
    compileFileWorks("CompareBinWithTightOffset.z80asm");
  });

  it("fails with negative length", () => {
    compileFileFails("CompareBinWithNegativeLength.z80asm", "Z0328");
  });

  it("fails with too long segment", () => {
    compileFileFails("CompareBinWithTooLongSegment.z80asm", "Z0330");
  });
});

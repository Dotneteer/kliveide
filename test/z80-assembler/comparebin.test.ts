import { describe, it} from "vitest";
import { compileFileFails, compileFileWorks } from "./test-helpers";

describe("Assembler - .comparebin", () => {
  it("works with existing binary file", async () => {
    await compileFileWorks("CompareBinExists.z80asm");
  });

  it("fails with non-existing file", async () => {
    await compileFileFails("CompareBinNotExists.z80asm", "Z0329");
  });

  it("works with zero offset", async () => {
    await compileFileWorks("CompareBinWithZeroOffset.z80asm");
  });

  it("works with non-zero offset", async () => {
    await compileFileWorks("CompareBinWithNonZeroOffset.z80asm");
  });

  it("works with zero offset and length", async () => {
    await compileFileWorks("CompareBinWithZeroOffsetAndLength.z80asm");
  });

  it("works with non-zero offset and length", async () => {
    await compileFileWorks("CompareBinWithNonZeroOffsetAndLength.z80asm");
  });

  it("fails with negative offset", async () => {
    await compileFileFails("CompareBinWithNegativeOffset.z80asm", "Z0327");
  });

  it("fails with too long offset", async () => {
    await compileFileFails("CompareBinWithTooLongOffset.z80asm", "Z0327");
  });

  it("works with tight offset", async () => {
    await compileFileWorks("CompareBinWithTightOffset.z80asm");
  });

  it("fails with negative length", async () => {
    await compileFileFails("CompareBinWithNegativeLength.z80asm", "Z0328");
  });

  it("fails with too long segment", async () => {
    await compileFileFails("CompareBinWithTooLongSegment.z80asm", "Z0330");
  });
});
